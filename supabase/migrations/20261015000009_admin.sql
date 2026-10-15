-- AJUDA AQUI — administração: lista de admins por e-mail, métricas completas, ficha do usuário e aviso geral.

-- ---------- 1) LISTA DE ADMINS ----------
-- Os e-mails NÃO ficam no código: são inseridos direto no banco (SQL Editor / service role).
create table if not exists public.admin_allowlist (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);
alter table public.admin_allowlist enable row level security; -- sem políticas: só service role / funções
revoke all on public.admin_allowlist from anon, authenticated;

-- Promove a ADMIN quem se cadastrar com um e-mail da lista (roda depois de handle_new_user).
create or replace function public.apply_admin_allowlist()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.admin_allowlist where email = lower(new.email)) then
    update public.profiles set role = 'ADMIN' where id = new.id;
  end if;
  return new;
end $$;
drop trigger if exists zz_on_auth_user_admin_allowlist on auth.users;
create trigger zz_on_auth_user_admin_allowlist after insert on auth.users
  for each row execute function public.apply_admin_allowlist();

-- ---------- 2) MÉTRICAS ----------
create or replace function public.admin_metrics(p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  since timestamptz;
  result jsonb;
begin
  perform public._require_admin();
  p_days := least(greatest(coalesce(p_days, 30), 1), 365);
  since := now() - make_interval(days => p_days);

  with
  active_users as (
    select user_id, max(at) as last_at from (
      select user_id, created_at as at from public.analytics_events where user_id is not null
      union all select requester_id, created_at from public.help_requests
      union all select helper_id, created_at from public.help_request_offers
      union all select sender_id, created_at from public.messages where sender_id is not null
    ) a group by user_id
  ),
  helps as (
    select selected_helper_id as uid, count(*) as n from public.help_requests
     where status = 'COMPLETED' and selected_helper_id is not null group by 1
  ),
  asks as (
    select requester_id as uid, count(*) filter (where status <> 'DRAFT') as n,
           count(*) filter (where status = 'COMPLETED') as done
      from public.help_requests group by 1
  ),
  ratings as (
    select reviewee_id as uid, round(avg(rating)::numeric, 2) as avg, count(*) as n from public.reviews group by 1
  ),
  first_offer as (
    select r.id, extract(epoch from (min(o.created_at) - coalesce(r.published_at, r.created_at))) / 3600 as hours
      from public.help_requests r join public.help_request_offers o on o.request_id = r.id
     where r.published_at is not null group by r.id, r.published_at, r.created_at
  ),
  days as (select generate_series((now() - make_interval(days => p_days - 1))::date, now()::date, '1 day')::date as d)
  select jsonb_build_object(
    'period_days', p_days,
    'generated_at', now(),
    'users', jsonb_build_object(
      'total', (select count(*) from public.profiles),
      'active_status', (select count(*) from public.profiles where status = 'ACTIVE'),
      'suspended', (select count(*) from public.profiles where status = 'SUSPENDED'),
      'blocked', (select count(*) from public.profiles where status = 'BLOCKED'),
      'new_period', (select count(*) from public.profiles where created_at >= since),
      'new_7d', (select count(*) from public.profiles where created_at >= now() - interval '7 days'),
      'active_1d', (select count(*) from active_users where last_at >= now() - interval '1 day'),
      'active_7d', (select count(*) from active_users where last_at >= now() - interval '7 days'),
      'active_30d', (select count(*) from active_users where last_at >= now() - interval '30 days'),
      'onboarded', (select count(*) from public.profiles where onboarding_completed),
      'helpers_available', (select count(*) from public.helper_preferences where active),
      'with_push', (select count(distinct user_id) from public.push_subscriptions where is_active),
      'admins', (select count(*) from public.profiles where role in ('ADMIN', 'SUPER_ADMIN'))
    ),
    'requests', jsonb_build_object(
      'total', (select count(*) from public.help_requests where status <> 'DRAFT'),
      'open', (select count(*) from public.help_requests where status = 'OPEN'),
      'in_progress', (select count(*) from public.help_requests where status in ('ASSIGNED', 'AWAITING_CONFIRMATION', 'IN_PROGRESS', 'COMPLETION_PENDING')),
      'completed', (select count(*) from public.help_requests where status = 'COMPLETED'),
      'cancelled', (select count(*) from public.help_requests where status = 'CANCELLED'),
      'expired', (select count(*) from public.help_requests where status = 'EXPIRED'),
      'disputed', (select count(*) from public.help_requests where status = 'DISPUTED'),
      'drafts', (select count(*) from public.help_requests where status = 'DRAFT'),
      'created_period', (select count(*) from public.help_requests where status <> 'DRAFT' and created_at >= since),
      'completed_period', (select count(*) from public.help_requests where status = 'COMPLETED' and completed_at >= since),
      'with_offer_pct', (select round(100.0 * count(*) filter (where exists (select 1 from public.help_request_offers o where o.request_id = r.id)) / nullif(count(*), 0), 1)
                           from public.help_requests r where r.status <> 'DRAFT'),
      'avg_offers', (select round(avg(c)::numeric, 2) from (select count(o.id) c from public.help_requests r left join public.help_request_offers o on o.request_id = r.id where r.status <> 'DRAFT' group by r.id) x),
      'median_hours_first_offer', (select round((percentile_cont(0.5) within group (order by hours))::numeric, 1) from first_offer),
      'completion_rate_pct', (select round(100.0 * count(*) filter (where status = 'COMPLETED') /
                                nullif(count(*) filter (where status in ('COMPLETED', 'CANCELLED', 'EXPIRED')), 0), 1) from public.help_requests),
      'paid_volume_cents', (select coalesce(sum(amount_cents), 0) from public.help_requests where status = 'COMPLETED' and help_type = 'PAID'),
      'by_type', (select jsonb_object_agg(help_type, n) from (select help_type, count(*) n from public.help_requests where status <> 'DRAFT' group by 1) t)
    ),
    'offers', jsonb_build_object(
      'total', (select count(*) from public.help_request_offers),
      'period', (select count(*) from public.help_request_offers where created_at >= since),
      'accepted', (select count(*) from public.help_request_offers where status = 'ACCEPTED')
    ),
    'engagement', jsonb_build_object(
      'messages_period', (select count(*) from public.messages where message_type = 'TEXT' and created_at >= since),
      'reviews_total', (select count(*) from public.reviews),
      'avg_rating', (select round(avg(rating)::numeric, 2) from public.reviews),
      'request_views_period', (select count(*) from public.analytics_events where event = 'REQUEST_VIEWED' and created_at >= since),
      'logins_period', (select count(*) from public.analytics_events where event = 'LOGIN' and created_at >= since)
    ),
    'safety', jsonb_build_object(
      'reports_open', (select count(*) from public.reports where status in ('OPEN', 'UNDER_REVIEW')),
      'reports_period', (select count(*) from public.reports where created_at >= since),
      'disputes_open', (select count(*) from public.disputes where status in ('OPEN', 'UNDER_REVIEW')),
      'blocks_total', (select count(*) from public.blocks),
      'reports_by_reason', (select coalesce(jsonb_object_agg(reason, n), '{}') from (select reason, count(*) n from public.reports group by 1) t)
    ),
    'push', jsonb_build_object(
      'subscriptions_active', (select count(*) from public.push_subscriptions where is_active),
      'sent_period', (select count(*) from public.notifications where push_status = 'SENT' and created_at >= since),
      'failed_period', (select count(*) from public.notifications where push_status = 'FAILED' and created_at >= since),
      'notifications_period', (select count(*) from public.notifications where created_at >= since)
    ),
    'funnel', jsonb_build_object(
      'signups', (select count(*) from public.profiles where created_at >= since),
      'onboarded', (select count(*) from public.profiles where created_at >= since and onboarding_completed),
      'first_request', (select count(distinct r.requester_id) from public.help_requests r join public.profiles p on p.id = r.requester_id
                         where p.created_at >= since and r.status <> 'DRAFT'),
      'first_offer', (select count(distinct o.helper_id) from public.help_request_offers o join public.profiles p on p.id = o.helper_id where p.created_at >= since),
      'first_completion', (select count(distinct u) from (
          select requester_id u from public.help_requests where status = 'COMPLETED'
          union select selected_helper_id from public.help_requests where status = 'COMPLETED') x
          join public.profiles p on p.id = x.u where p.created_at >= since)
    ),
    'series', (select jsonb_agg(jsonb_build_object(
        'day', d,
        'signups', (select count(*) from public.profiles where created_at::date = d),
        'requests', (select count(*) from public.help_requests where status <> 'DRAFT' and created_at::date = d),
        'completed', (select count(*) from public.help_requests where status = 'COMPLETED' and completed_at::date = d),
        'offers', (select count(*) from public.help_request_offers where created_at::date = d),
        'messages', (select count(*) from public.messages where message_type = 'TEXT' and created_at::date = d)
      ) order by d) from days),
    'categories', (select coalesce(jsonb_agg(x order by x->>'requests' desc), '[]') from (
        select jsonb_build_object('name', c.name, 'requests', count(r.id), 'completed', count(r.id) filter (where r.status = 'COMPLETED'),
                                  'helpers', (select count(*) from public.user_categories uc where uc.category_id = c.id)) x
          from public.categories c left join public.help_requests r on r.category_id = c.id and r.status <> 'DRAFT'
         group by c.id, c.name) t),
    'cities', (select coalesce(jsonb_agg(x), '[]') from (
        select jsonb_build_object('city', city, 'state', state, 'users', users, 'requests', requests) x from (
          select coalesce(p.city, '—') city, coalesce(p.state, '—') state, count(distinct p.id) users,
                 (select count(*) from public.help_requests r where lower(r.city) = lower(p.city) and r.state = p.state and r.status <> 'DRAFT') requests
            from public.profiles p group by p.city, p.state order by count(distinct p.id) desc limit 12) y) t),
    'top_helpers', (select coalesce(jsonb_agg(x), '[]') from (
        select jsonb_build_object('id', p.id, 'name', p.full_name, 'city', p.city, 'helps', h.n, 'rating', rt.avg, 'reviews', coalesce(rt.n, 0)) x
          from helps h join public.profiles p on p.id = h.uid left join ratings rt on rt.uid = h.uid
         order by h.n desc, rt.avg desc nulls last limit 10) t),
    'top_requesters', (select coalesce(jsonb_agg(x), '[]') from (
        select jsonb_build_object('id', p.id, 'name', p.full_name, 'city', p.city, 'requests', a.n, 'completed', a.done) x
          from asks a join public.profiles p on p.id = a.uid where a.n > 0
         order by a.n desc limit 10) t),
    'top_rated', (select coalesce(jsonb_agg(x), '[]') from (
        select jsonb_build_object('id', p.id, 'name', p.full_name, 'city', p.city, 'rating', rt.avg, 'reviews', rt.n) x
          from ratings rt join public.profiles p on p.id = rt.uid where rt.n >= 3
         order by rt.avg desc, rt.n desc limit 10) t),
    'most_reported', (select coalesce(jsonb_agg(x), '[]') from (
        select jsonb_build_object('id', p.id, 'name', p.full_name, 'status', p.status, 'reports', count(*)) x
          from public.reports rp join public.profiles p on p.id = rp.reported_user_id
         group by p.id, p.full_name, p.status order by count(*) desc limit 10) t)
  ) into result;
  return result;
end $$;

-- ---------- 3) FICHA DO USUÁRIO (inclui e-mail e último acesso, que vivem em auth.users) ----------
create or replace function public.admin_user_overview(p_user uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare result jsonb;
begin
  perform public._require_admin();
  select jsonb_build_object(
    'email', u.email,
    'created_at', u.created_at,
    'last_sign_in_at', u.last_sign_in_at,
    'email_confirmed', u.email_confirmed_at is not null,
    'phone', (select phone from public.profile_contacts where user_id = p_user),
    'requests', (select count(*) from public.help_requests where requester_id = p_user and status <> 'DRAFT'),
    'requests_completed', (select count(*) from public.help_requests where requester_id = p_user and status = 'COMPLETED'),
    'helps_completed', (select count(*) from public.help_requests where selected_helper_id = p_user and status = 'COMPLETED'),
    'offers', (select count(*) from public.help_request_offers where helper_id = p_user),
    'messages', (select count(*) from public.messages where sender_id = p_user),
    'reviews_received', (select count(*) from public.reviews where reviewee_id = p_user),
    'avg_rating', (select round(avg(rating)::numeric, 2) from public.reviews where reviewee_id = p_user),
    'reports_against', (select count(*) from public.reports where reported_user_id = p_user),
    'reports_made', (select count(*) from public.reports where reporter_id = p_user),
    'blocked_by', (select count(*) from public.blocks where blocked_id = p_user),
    'push_devices', (select count(*) from public.push_subscriptions where user_id = p_user and is_active)
  ) into result
  from auth.users u where u.id = p_user;
  if result is null then raise exception 'NOT_FOUND'; end if;
  perform public.write_audit('user.viewed', 'user', p_user::text, null, null);
  return result;
end $$;

-- ---------- 4) AVISO GERAL ----------
create or replace function public.admin_broadcast(p_title text, p_body text, p_url text default null, p_state text default null)
returns integer language plpgsql security definer set search_path = public as $$
declare me uuid := public._require_admin(); u record; n integer := 0;
begin
  if char_length(trim(coalesce(p_title, ''))) < 3 or char_length(trim(coalesce(p_body, ''))) < 5 then raise exception 'INVALID_INPUT'; end if;
  if p_url is not null and (p_url not like '/%' or p_url like '//%') then raise exception 'INVALID_INPUT'; end if;
  perform public.enforce_rate_limit('admin_broadcast', 5, 86400);
  for u in select id from public.profiles where status = 'ACTIVE' and (p_state is null or state = p_state) loop
    if public.create_notification(u.id, 'SYSTEM_ALERT', left(trim(p_title), 120), left(trim(p_body), 300), p_url) is not null then
      n := n + 1;
    end if;
  end loop;
  perform public.write_audit('broadcast.sent', 'notification', null, null,
    jsonb_build_object('title', p_title, 'body', p_body, 'url', p_url), jsonb_build_object('state', p_state, 'recipients', n));
  return n;
end $$;

revoke execute on function public.admin_metrics(integer), public.admin_user_overview(uuid),
  public.admin_broadcast(text, text, text, text), public.apply_admin_allowlist() from public, anon;
grant execute on function public.admin_metrics(integer), public.admin_user_overview(uuid),
  public.admin_broadcast(text, text, text, text) to authenticated;
