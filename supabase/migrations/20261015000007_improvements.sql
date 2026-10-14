-- AJUDA AQUI — melhorias pós-lançamento
-- 1) Feed não mostra pedidos cujo horário já passou (antes, só sumiam no cron diário).
-- 2) Não aceita proposta para pedido cujo horário já passou.
-- 3) Lembrete "ajuda próxima" (item 51 do prompt mestre): job diário avisa as duas partes.
-- 4) Higiene de permissões: funções novas e auxiliares de política fechados para anon.

-- ---------- 1) FEED ----------
create or replace function public.search_requests(
  p_state text default null,
  p_city text default null,
  p_neighborhood text default null,
  p_category uuid default null,
  p_help_type public.help_type default null,
  p_day text default null,
  p_lat double precision default null,
  p_lng double precision default null,
  p_max_km double precision default null,
  p_query text default null,
  p_sort text default 'recent',
  p_limit integer default 20,
  p_offset integer default 0
) returns table (
  id uuid, requester_id uuid, category_id uuid, title text, description text, help_type public.help_type,
  amount_cents integer, exchange_description text, state text, city text, neighborhood text,
  public_latitude double precision, public_longitude double precision,
  scheduled_date date, scheduled_time time, duration_minutes integer, timezone text,
  status public.request_status, created_at timestamptz, distance_km double precision
) language sql stable security invoker set search_path = public as $$
  select r.id, r.requester_id, r.category_id, r.title, r.description, r.help_type, r.amount_cents,
         r.exchange_description, r.state, r.city, r.neighborhood, r.public_latitude, r.public_longitude,
         r.scheduled_date, r.scheduled_time, r.duration_minutes, r.timezone, r.status, r.created_at,
         public.haversine_km(p_lat, p_lng, r.public_latitude, r.public_longitude) as distance_km
  from public.help_requests r
  where r.status = 'OPEN'
    and public.request_starts_at(r) > now()
    and r.requester_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000')
    and (p_state is null or r.state = p_state)
    and (p_city is null or lower(r.city) = lower(p_city))
    and (p_neighborhood is null or lower(r.neighborhood) = lower(p_neighborhood))
    and (p_category is null or r.category_id = p_category)
    and (p_help_type is null or r.help_type = p_help_type)
    and (p_day is null
         or (p_day = 'today' and r.scheduled_date = (now() at time zone r.timezone)::date)
         or (p_day = 'tomorrow' and r.scheduled_date = (now() at time zone r.timezone)::date + 1))
    and (p_max_km is null or p_lat is null
         or public.haversine_km(p_lat, p_lng, r.public_latitude, r.public_longitude) <= p_max_km)
    and (p_query is null or r.title ilike '%' || replace(replace(p_query, '%', ''), '_', '') || '%'
         or r.description ilike '%' || replace(replace(p_query, '%', ''), '_', '') || '%')
  order by
    case when p_sort = 'nearest' then public.haversine_km(p_lat, p_lng, r.public_latitude, r.public_longitude) end asc nulls last,
    case when p_sort = 'time' then r.scheduled_date end asc,
    case when p_sort = 'time' then r.scheduled_time end asc,
    case when p_sort = 'category' then r.category_id end asc,
    r.created_at desc
  limit least(greatest(p_limit, 1), 50) offset greatest(p_offset, 0);
$$;

-- ---------- 2) PROPOSTA EM PEDIDO VENCIDO ----------
create or replace function public.submit_offer(p_request_id uuid, p_message text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := public._require_active();
  r public.help_requests%rowtype;
  existing public.help_request_offers%rowtype;
  oid uuid;
begin
  select * into r from public.help_requests where id = p_request_id;
  if not found or r.status <> 'OPEN' then raise exception 'REQUEST_NOT_OPEN'; end if;
  if public.request_starts_at(r) <= now() then raise exception 'REQUEST_NOT_OPEN'; end if;
  if r.requester_id = me then raise exception 'OWN_REQUEST'; end if;
  if public.is_blocked_between(me, r.requester_id) then raise exception 'BLOCKED'; end if;
  if not public.is_active_user(r.requester_id) then raise exception 'REQUEST_NOT_OPEN'; end if;
  if char_length(trim(p_message)) < 5 then raise exception 'INVALID_INPUT'; end if;
  perform public.enforce_rate_limit('submit_offer', 20, 86400);

  select * into existing from public.help_request_offers
   where request_id = p_request_id and helper_id = me for update;
  if found then
    if existing.status <> 'WITHDRAWN' then raise exception 'ALREADY_OFFERED'; end if;
    update public.help_request_offers set status = 'PENDING', message = trim(p_message)
     where id = existing.id returning id into oid;
  else
    insert into public.help_request_offers (request_id, helper_id, message)
    values (p_request_id, me, trim(p_message)) returning id into oid;
  end if;

  perform public.create_notification(r.requester_id, 'NEW_OFFER', 'Nova proposta',
    public._display_name(me) || ' quer ajudar com "' || left(r.title, 60) || '".', '/pedido/' || r.id,
    jsonb_build_object('request_id', r.id, 'offer_id', oid));
  perform public.track_event(me, 'OFFER_SENT', jsonb_build_object('request_id', r.id));
  return oid;
end $$;

-- ---------- 3) LEMBRETE "AJUDA PRÓXIMA" ----------
alter table public.help_requests add column if not exists reminder_sent_at timestamptz;

alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications add constraint notifications_type_check check (type in (
  'NEW_MATCH', 'NEW_HELP_REQUEST', 'NEW_OFFER', 'OFFER_ACCEPTED', 'OFFER_REJECTED',
  'NEW_MESSAGE', 'REQUEST_ASSIGNED', 'REQUEST_STARTED', 'REQUEST_COMPLETION_PENDING',
  'REQUEST_COMPLETED', 'REQUEST_CANCELLED', 'REQUEST_REMINDER', 'NEW_REVIEW', 'REPORT_CREATED',
  'REPORT_UPDATED', 'DISPUTE_OPENED', 'SYSTEM_ALERT'));

-- Avisa solicitante e ajudante das ajudas combinadas que começam nas próximas 36 h (uma vez por pedido).
create or replace function public.send_upcoming_reminders()
returns integer language plpgsql security definer set search_path = public as $$
declare r record; n integer := 0; quando text;
begin
  for r in
    select h.* from public.help_requests h
     where h.status in ('ASSIGNED', 'AWAITING_CONFIRMATION', 'IN_PROGRESS')
       and h.reminder_sent_at is null
       and h.selected_helper_id is not null
       and public.request_starts_at(h) between now() and now() + interval '36 hours'
     for update skip locked
  loop
    quando := case when r.scheduled_date = (now() at time zone r.timezone)::date then 'hoje' else 'amanhã' end
              || ' às ' || to_char(r.scheduled_time, 'HH24:MI');
    perform public.create_notification(r.requester_id, 'REQUEST_REMINDER', 'Ajuda próxima',
      '"' || left(r.title, 60) || '" é ' || quando || '.', '/pedido/' || r.id, jsonb_build_object('request_id', r.id));
    perform public.create_notification(r.selected_helper_id, 'REQUEST_REMINDER', 'Ajuda próxima',
      '"' || left(r.title, 60) || '" é ' || quando || '.', '/pedido/' || r.id, jsonb_build_object('request_id', r.id));
    update public.help_requests set reminder_sent_at = now() where id = r.id;
    n := n + 1;
  end loop;
  return n;
end $$;

-- ---------- 4) PERMISSÕES ----------
revoke execute on function public.send_upcoming_reminders() from public, anon, authenticated;
grant execute on function public.send_upcoming_reminders() to service_role;

-- reaplica grants das funções recriadas (CREATE OR REPLACE preserva, mas deixamos explícito)
grant execute on function public.submit_offer(uuid, text) to authenticated;
grant execute on function public.search_requests(text, text, text, uuid, public.help_type, text, double precision, double precision, double precision, text, text, integer, integer) to authenticated;
revoke execute on function public.submit_offer(uuid, text) from anon;
revoke execute on function public.search_requests(text, text, text, uuid, public.help_type, text, double precision, double precision, double precision, text, text, integer, integer) from anon;

-- auxiliares de política: só usuários autenticados precisam deles
revoke execute on function public.owns_request(uuid), public.has_offer_on(uuid),
  public.can_see_private_location(uuid), public.admin_can_read_conversation(uuid) from public, anon;
