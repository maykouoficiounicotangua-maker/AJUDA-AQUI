-- AJUDA AQUI — navegação sem login + alcance dos avisos de novos pedidos
-- Visitantes (anon) podem conhecer o app: ver pedidos ABERTOS e futuros, com dados mínimos e seguros.
-- Nada de endereço, telefone, coordenada exata, sobrenome ou id do solicitante.

-- ---------- 1) LEITURA PÚBLICA (somente via funções; tabelas continuam fechadas para anon) ----------
create or replace function public.public_feed(
  p_state text default null,
  p_city text default null,
  p_neighborhood text default null,
  p_category uuid default null,
  p_help_type public.help_type default null,
  p_day text default null,
  p_query text default null,
  p_sort text default 'recent',
  p_limit integer default 20,
  p_offset integer default 0
) returns table (
  id uuid, category_id uuid, title text, description text, help_type public.help_type,
  amount_cents integer, exchange_description text, state text, city text, neighborhood text,
  scheduled_date date, scheduled_time time, duration_minutes integer, timezone text,
  status public.request_status, created_at timestamptz, requester_first_name text
) language sql stable security definer set search_path = public as $$
  select r.id, r.category_id, r.title, r.description, r.help_type, r.amount_cents, r.exchange_description,
         r.state, r.city, r.neighborhood, r.scheduled_date, r.scheduled_time, r.duration_minutes, r.timezone,
         r.status, r.created_at,
         case when p.profile_visibility = 'PUBLIC' then split_part(p.full_name, ' ', 1) else 'Membro' end
  from public.help_requests r
  join public.profiles p on p.id = r.requester_id and p.status = 'ACTIVE'
  where r.status = 'OPEN'
    and public.request_starts_at(r) > now()
    and (p_state is null or r.state = p_state)
    and (p_city is null or lower(r.city) = lower(p_city))
    and (p_neighborhood is null or lower(r.neighborhood) = lower(p_neighborhood))
    and (p_category is null or r.category_id = p_category)
    and (p_help_type is null or r.help_type = p_help_type)
    and (p_day is null
         or (p_day = 'today' and r.scheduled_date = (now() at time zone r.timezone)::date)
         or (p_day = 'tomorrow' and r.scheduled_date = (now() at time zone r.timezone)::date + 1))
    and (p_query is null or r.title ilike '%' || replace(replace(p_query, '%', ''), '_', '') || '%'
         or r.description ilike '%' || replace(replace(p_query, '%', ''), '_', '') || '%')
  order by
    case when p_sort = 'time' then r.scheduled_date end asc,
    case when p_sort = 'time' then r.scheduled_time end asc,
    case when p_sort = 'category' then r.category_id end asc,
    r.created_at desc
  limit least(greatest(p_limit, 1), 50) offset greatest(p_offset, 0);
$$;

create or replace function public.public_request(p_id uuid)
returns table (
  id uuid, category_id uuid, title text, description text, help_type public.help_type,
  amount_cents integer, exchange_description text, state text, city text, neighborhood text,
  scheduled_date date, scheduled_time time, duration_minutes integer, timezone text,
  status public.request_status, created_at timestamptz,
  requester_first_name text, requester_avatar_url text, requester_rating numeric, requester_reviews integer, requester_helps integer
) language sql stable security definer set search_path = public as $$
  select r.id, r.category_id, r.title, r.description, r.help_type, r.amount_cents, r.exchange_description,
         r.state, r.city, r.neighborhood, r.scheduled_date, r.scheduled_time, r.duration_minutes, r.timezone,
         r.status, r.created_at,
         case when p.profile_visibility = 'PUBLIC' then split_part(p.full_name, ' ', 1) else 'Membro' end,
         case when p.profile_visibility = 'PUBLIC' then p.avatar_url end,
         case when p.profile_visibility = 'PUBLIC' and p.show_rating then
           (select round(avg(rating)::numeric, 1) from public.reviews where reviewee_id = p.id) end,
         case when p.profile_visibility = 'PUBLIC' and p.show_rating then
           (select count(*)::int from public.reviews where reviewee_id = p.id) else 0 end,
         case when p.profile_visibility = 'PUBLIC' and p.show_help_count then
           (select count(*)::int from public.help_requests h where h.selected_helper_id = p.id and h.status = 'COMPLETED') else 0 end
  from public.help_requests r
  join public.profiles p on p.id = r.requester_id and p.status = 'ACTIVE'
  where r.id = p_id and r.status = 'OPEN' and public.request_starts_at(r) > now();
$$;

revoke execute on function public.public_feed(text, text, text, uuid, public.help_type, text, text, text, integer, integer) from public;
revoke execute on function public.public_request(uuid) from public;
grant execute on function public.public_feed(text, text, text, uuid, public.help_type, text, text, text, integer, integer) to anon, authenticated;
grant execute on function public.public_request(uuid) to anon, authenticated;

-- ---------- 2) ALCANCE DOS AVISOS DE NOVOS PEDIDOS ----------
-- COMPATIBLE: só pedidos que combinam comigo (categoria + distância + horário…)
-- NEARBY:     qualquer pedido dentro da minha distância máxima (ou da minha cidade)
alter table public.notification_preferences
  add column if not exists match_scope text not null default 'COMPATIBLE'
  check (match_scope in ('COMPATIBLE', 'NEARBY'));
grant update (match_scope) on public.notification_preferences to authenticated;

-- ---------- 3) CANDIDATOS A AVISO DE NOVO PEDIDO (somente servidor) ----------
-- Quem tem área de ajuda ativa na mesma cidade OU dentro da própria distância máxima,
-- com avisos de novos pedidos ligados, conta ativa e sem bloqueio com o solicitante.
create or replace function public.helper_candidates(p_request uuid, p_limit integer default 300)
returns table (
  user_id uuid, category_ids uuid[], state text, city text, neighborhood text,
  latitude double precision, longitude double precision, max_distance_km integer,
  accepts_paid boolean, accepts_free boolean, accepts_exchange boolean,
  available_days smallint[], availability_start time, availability_end time,
  match_scope text, distance_km double precision
) language sql stable security definer set search_path = public as $$
  select hp.user_id,
         coalesce((select array_agg(uc.category_id) from public.user_categories uc where uc.user_id = hp.user_id), '{}'),
         hp.state, hp.city, hp.neighborhood, hp.latitude, hp.longitude, hp.max_distance_km,
         hp.accepts_paid, hp.accepts_free, hp.accepts_exchange, hp.available_days, hp.availability_start, hp.availability_end,
         coalesce(np.match_scope, 'COMPATIBLE'),
         public.haversine_km(r.public_latitude, r.public_longitude, hp.latitude, hp.longitude)
  from public.help_requests r
  join public.helper_preferences hp on hp.active and hp.user_id <> r.requester_id and hp.state = r.state
  join public.profiles p on p.id = hp.user_id and p.status = 'ACTIVE'
  left join public.notification_preferences np on np.user_id = hp.user_id
  where r.id = p_request
    and coalesce(np.in_app_enabled, true) and coalesce(np.pref_matches, true)
    and not public.is_blocked_between(r.requester_id, hp.user_id)
    and (lower(hp.city) = lower(r.city)
         or public.haversine_km(r.public_latitude, r.public_longitude, hp.latitude, hp.longitude) <= hp.max_distance_km)
  order by public.haversine_km(r.public_latitude, r.public_longitude, hp.latitude, hp.longitude) asc nulls last
  limit least(greatest(p_limit, 1), 1000);
$$;
revoke execute on function public.helper_candidates(uuid, integer) from public, anon, authenticated;
grant execute on function public.helper_candidates(uuid, integer) to service_role;

-- ---------- 4) MENSAGENS: aviso agrupado por conversa ----------
-- Inclui o id da conversa no aviso (o push agrupa por conversa em vez de empilhar uma notificação por mensagem).
create or replace function public.messages_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare p record;
begin
  update public.conversations set updated_at = now() where id = new.conversation_id;
  if new.message_type = 'TEXT' then
    for p in select user_id from public.conversation_participants
             where conversation_id = new.conversation_id and user_id <> new.sender_id loop
      perform public.create_notification(p.user_id, 'NEW_MESSAGE', 'Nova mensagem',
        'Você recebeu uma mensagem de ' || public._display_name(new.sender_id) || '.', '/conversa/' || new.conversation_id,
        jsonb_build_object('conversation_id', new.conversation_id));
    end loop;
  end if;
  return new;
end $$;
