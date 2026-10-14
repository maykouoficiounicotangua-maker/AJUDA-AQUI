-- AJUDA AQUI — notificações (interna + push), auditoria, analytics, rate limit

-- ---------- PREFERÊNCIAS ----------
create table public.notification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  in_app_enabled boolean not null default true,
  push_enabled boolean not null default true,
  pref_matches boolean not null default true,   -- novos pedidos compatíveis
  pref_messages boolean not null default true,
  pref_offers boolean not null default true,    -- propostas
  pref_requests boolean not null default true,  -- atualizações de pedidos
  pref_reviews boolean not null default true,
  pref_system boolean not null default true,    -- avisos importantes
  updated_at timestamptz not null default now()
);
create trigger notification_preferences_touch before update on public.notification_preferences
  for each row execute function public.touch_updated_at();

-- ---------- NOTIFICAÇÕES (camada interna) ----------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null check (type in (
    'NEW_MATCH', 'NEW_HELP_REQUEST', 'NEW_OFFER', 'OFFER_ACCEPTED', 'OFFER_REJECTED',
    'NEW_MESSAGE', 'REQUEST_ASSIGNED', 'REQUEST_STARTED', 'REQUEST_COMPLETION_PENDING',
    'REQUEST_COMPLETED', 'REQUEST_CANCELLED', 'NEW_REVIEW', 'REPORT_CREATED',
    'REPORT_UPDATED', 'DISPUTE_OPENED', 'SYSTEM_ALERT')),
  title text not null check (char_length(title) <= 120),
  body text not null check (char_length(body) <= 300),
  url text check (url is null or (url like '/%' and url not like '//%')),
  data jsonb not null default '{}'::jsonb,
  read boolean not null default false,
  read_at timestamptz,
  -- entrega push desacoplada: o servidor processa PENDING (ver app/api/push/dispatch)
  push_status text not null default 'SKIPPED' check (push_status in ('PENDING', 'SENDING', 'SENT', 'FAILED', 'SKIPPED')),
  push_sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, read, created_at desc);
create index notifications_push_pending_idx on public.notifications (created_at) where push_status = 'PENDING';

-- ---------- PUSH SUBSCRIPTIONS (Web Push / VAPID) ----------
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique check (char_length(endpoint) between 20 and 2048),
  p256dh text not null check (char_length(p256dh) between 10 and 256),
  auth text not null check (char_length(auth) between 10 and 128),
  user_agent text check (user_agent is null or char_length(user_agent) <= 300),
  device_type text check (device_type is null or device_type in ('desktop', 'mobile', 'tablet', 'unknown')),
  browser text check (browser is null or char_length(browser) <= 60),
  is_active boolean not null default true,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index push_subscriptions_user_idx on public.push_subscriptions (user_id) where is_active;
create index push_subscriptions_active_idx on public.push_subscriptions (is_active);
create trigger push_subscriptions_touch before update on public.push_subscriptions
  for each row execute function public.touch_updated_at();

-- ---------- AUDITORIA ----------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  old_data jsonb,
  new_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

-- ---------- ANALYTICS ----------
create table public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  event text not null check (event in (
    'SIGNUP', 'LOGIN', 'REQUEST_CREATED', 'REQUEST_VIEWED', 'OFFER_SENT', 'OFFER_ACCEPTED',
    'CHAT_STARTED', 'REQUEST_COMPLETED', 'REVIEW_CREATED', 'REPORT_CREATED')),
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index analytics_events_event_idx on public.analytics_events (event, created_at desc);

-- ---------- RATE LIMIT ----------
create table public.rate_limit_events (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  action text not null,
  created_at timestamptz not null default now()
);
create index rate_limit_events_lookup_idx on public.rate_limit_events (user_id, action, created_at desc);

-- Retorna true se a ação é permitida (e a registra). Usuário comum só limita a si mesmo;
-- p_user só é respeitado em contexto de servidor (service role, sem auth.uid()).
create or replace function public.check_rate_limit(p_action text, p_max integer, p_window_seconds integer, p_user uuid default null)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  uid uuid := coalesce(auth.uid(), p_user);
  cnt integer;
begin
  if uid is null then
    return false;
  end if;
  select count(*) into cnt from public.rate_limit_events
   where user_id = uid and action = p_action
     and created_at > now() - make_interval(secs => p_window_seconds);
  if cnt >= p_max then
    return false;
  end if;
  insert into public.rate_limit_events (user_id, action) values (uid, p_action);
  -- limpeza oportunista (1% das chamadas)
  if random() < 0.01 then
    delete from public.rate_limit_events where created_at < now() - interval '2 days';
  end if;
  return true;
end $$;

create or replace function public.enforce_rate_limit(p_action text, p_max integer, p_window_seconds integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.check_rate_limit(p_action, p_max, p_window_seconds) then
    raise exception 'RATE_LIMITED' using errcode = 'P0001';
  end if;
end $$;

-- ---------- FUNÇÕES INTERNAS (não expostas a usuários) ----------
create or replace function public.create_notification(
  p_user uuid, p_type text, p_title text, p_body text, p_url text default null, p_data jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  prefs public.notification_preferences%rowtype;
  grp_enabled boolean;
  nid uuid;
begin
  -- destinatário inexistente (ex.: conta excluída no mesmo instante): nada a fazer
  if not exists (select 1 from public.profiles where id = p_user) then
    return null;
  end if;
  select * into prefs from public.notification_preferences where user_id = p_user;
  if not found then
    insert into public.notification_preferences (user_id) values (p_user)
    on conflict do nothing;
    select * into prefs from public.notification_preferences where user_id = p_user;
  end if;

  grp_enabled := case
    when p_type in ('NEW_MATCH', 'NEW_HELP_REQUEST') then prefs.pref_matches
    when p_type = 'NEW_MESSAGE' then prefs.pref_messages
    when p_type in ('NEW_OFFER', 'OFFER_ACCEPTED', 'OFFER_REJECTED') then prefs.pref_offers
    when p_type like 'REQUEST\_%' then prefs.pref_requests
    when p_type = 'NEW_REVIEW' then prefs.pref_reviews
    else prefs.pref_system
  end;

  if not prefs.in_app_enabled or not grp_enabled then
    return null;
  end if;

  insert into public.notifications (user_id, type, title, body, url, data, push_status)
  values (
    p_user, p_type, left(p_title, 120), left(p_body, 300), p_url, coalesce(p_data, '{}'::jsonb),
    case when prefs.push_enabled then 'PENDING' else 'SKIPPED' end
  ) returning id into nid;
  return nid;
end $$;

create or replace function public.notify_admins(p_type text, p_title text, p_body text, p_url text default null, p_data jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare a record;
begin
  for a in select id from public.profiles where role in ('ADMIN', 'SUPER_ADMIN') and status = 'ACTIVE' loop
    perform public.create_notification(a.id, p_type, p_title, p_body, p_url, p_data);
  end loop;
end $$;

create or replace function public.write_audit(
  p_action text, p_entity_type text, p_entity_id text, p_old jsonb, p_new jsonb, p_meta jsonb default '{}'::jsonb
) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.audit_logs (admin_id, action, entity_type, entity_id, old_data, new_data, metadata)
  values (auth.uid(), p_action, p_entity_type, p_entity_id, p_old, p_new, coalesce(p_meta, '{}'::jsonb));
end $$;

create or replace function public.track_event(p_user uuid, p_event text, p_props jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into public.analytics_events (user_id, event, properties) values (p_user, p_event, coalesce(p_props, '{}'::jsonb));
$$;

-- Auditoria automática das categorias (alteradas só por admin via RLS)
create or replace function public.audit_category_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.write_audit(
    'category.' || lower(tg_op), 'category', coalesce(new.id, old.id)::text,
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );
  return coalesce(new, old);
end $$;
create trigger categories_audit after insert or update or delete on public.categories
  for each row execute function public.audit_category_change();

-- ---------- NOVO USUÁRIO ----------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare m jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
begin
  insert into public.profiles (id, full_name, avatar_url, state, city, neighborhood)
  values (
    new.id,
    coalesce(nullif(trim(m ->> 'full_name'), ''), 'Usuário'),
    nullif(m ->> 'avatar_url', ''),
    nullif(m ->> 'state', ''),
    nullif(m ->> 'city', ''),
    nullif(m ->> 'neighborhood', '')
  );
  insert into public.profile_contacts (user_id, phone)
  values (new.id, case when (m ->> 'phone') ~ '^\+?[0-9 ()\-]{8,20}$' then m ->> 'phone' end);
  insert into public.notification_preferences (user_id) values (new.id);
  -- consentimento versionado informado no cadastro (a aplicação define as versões vigentes)
  if nullif(m ->> 'terms_version', '') is not null
     and nullif(m ->> 'privacy_version', '') is not null
     and nullif(m ->> 'safety_version', '') is not null then
    insert into public.consents (user_id, terms_version, privacy_version, safety_version)
    values (new.id, left(m ->> 'terms_version', 40), left(m ->> 'privacy_version', 40), left(m ->> 'safety_version', 40))
    on conflict do nothing;
  end if;
  perform public.track_event(new.id, 'SIGNUP');
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
