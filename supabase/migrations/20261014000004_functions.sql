-- AJUDA AQUI — funções transacionais (RPC). Toda escrita crítica passa por aqui.
-- Erros de negócio são `raise exception 'CODIGO'`; a aplicação traduz para mensagens humanas.

-- ---------- AUXILIARES ----------
create or replace function public._require_active()
returns uuid language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;
  if not public.is_active_user(auth.uid()) then
    raise exception 'ACCOUNT_RESTRICTED';
  end if;
  return auth.uid();
end $$;

create or replace function public._require_admin()
returns uuid language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN';
  end if;
  return auth.uid();
end $$;

-- Máquina de estados do pedido (espelhada em lib/requests/state-machine.ts)
create or replace function public.request_transition_allowed(p_from public.request_status, p_to public.request_status)
returns boolean language sql immutable as $$
  select case p_from
    when 'DRAFT' then p_to in ('PUBLISHED', 'OPEN', 'CANCELLED')
    when 'PUBLISHED' then p_to in ('OPEN', 'CANCELLED')
    when 'OPEN' then p_to in ('ASSIGNED', 'CANCELLED', 'EXPIRED')
    when 'ASSIGNED' then p_to in ('AWAITING_CONFIRMATION', 'OPEN', 'CANCELLED')
    when 'AWAITING_CONFIRMATION' then p_to in ('IN_PROGRESS', 'OPEN', 'CANCELLED')
    when 'IN_PROGRESS' then p_to in ('COMPLETION_PENDING', 'DISPUTED', 'CANCELLED')
    when 'COMPLETION_PENDING' then p_to in ('COMPLETED', 'DISPUTED')
    when 'DISPUTED' then p_to in ('COMPLETED', 'CANCELLED')
    else false
  end;
$$;

create or replace function public.request_starts_at(r public.help_requests)
returns timestamptz language sql immutable as $$
  select ((r.scheduled_date + r.scheduled_time) at time zone r.timezone);
$$;

-- Muda status validando a transição. O chamador DEVE ter travado a linha (FOR UPDATE).
create or replace function public._set_request_status(p_id uuid, p_to public.request_status)
returns void language plpgsql security definer set search_path = public as $$
declare cur public.request_status;
begin
  select status into cur from public.help_requests where id = p_id;
  if cur is null then
    raise exception 'NOT_FOUND';
  end if;
  if not public.request_transition_allowed(cur, p_to) then
    raise exception 'INVALID_TRANSITION';
  end if;
  update public.help_requests set
    status = p_to,
    published_at = case when p_to = 'PUBLISHED' then now() else published_at end,
    completed_at = case when p_to = 'COMPLETED' then now() else completed_at end,
    cancelled_at = case when p_to = 'CANCELLED' then now() else cancelled_at end,
    expired_at = case when p_to = 'EXPIRED' then now() else expired_at end
  where id = p_id;
end $$;

create or replace function public._system_message(p_request uuid, p_text text)
returns void language sql security definer set search_path = public as $$
  insert into public.messages (conversation_id, sender_id, message_type, content)
  select c.id, null, 'SYSTEM', p_text from public.conversations c where c.request_id = p_request;
$$;

create or replace function public._display_name(uid uuid)
returns text language sql stable security definer set search_path = public as $$
  select split_part(full_name, ' ', 1) from public.profiles where id = uid;
$$;

-- ---------- PEDIDOS: rascunho / publicação ----------
-- Arredonda a coordenada pública (~1,1 km) e limita criação de rascunhos.
create or replace function public.help_requests_before_write()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.public_latitude is not null then new.public_latitude := round(new.public_latitude::numeric, 2); end if;
  if new.public_longitude is not null then new.public_longitude := round(new.public_longitude::numeric, 2); end if;
  if tg_op = 'INSERT' and auth.uid() is not null then
    perform public.enforce_rate_limit('create_request', 30, 86400);
  end if;
  return new;
end $$;
create trigger help_requests_before_write before insert or update on public.help_requests
  for each row execute function public.help_requests_before_write();

create or replace function public.publish_request(p_request_id uuid)
returns public.help_requests language plpgsql security definer set search_path = public as $$
declare
  me uuid := public._require_active();
  r public.help_requests%rowtype;
begin
  select * into r from public.help_requests where id = p_request_id for update;
  if not found or r.requester_id <> me then raise exception 'NOT_FOUND'; end if;
  if r.status <> 'DRAFT' then raise exception 'INVALID_STATE'; end if;
  if not exists (select 1 from public.categories where id = r.category_id and active) then
    raise exception 'CATEGORY_INACTIVE';
  end if;
  if public.request_starts_at(r) <= now() then raise exception 'DATE_IN_PAST'; end if;
  perform public.enforce_rate_limit('publish_request', 10, 86400);

  perform public._set_request_status(r.id, 'PUBLISHED');
  perform public._set_request_status(r.id, 'OPEN');
  perform public.track_event(me, 'REQUEST_CREATED', jsonb_build_object('request_id', r.id));
  select * into r from public.help_requests where id = p_request_id;
  return r;
end $$;

-- ---------- CANCELAMENTO / DESISTÊNCIA ----------
create or replace function public.cancel_request(p_request_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := public._require_active();
  r public.help_requests%rowtype;
  o record;
begin
  select * into r from public.help_requests where id = p_request_id for update;
  if not found or r.requester_id <> me then raise exception 'NOT_FOUND'; end if;
  if r.status not in ('DRAFT', 'PUBLISHED', 'OPEN', 'ASSIGNED', 'AWAITING_CONFIRMATION', 'IN_PROGRESS') then
    raise exception 'INVALID_STATE';
  end if;

  perform public._set_request_status(r.id, 'CANCELLED');
  update public.help_request_offers set status = 'EXPIRED'
   where request_id = r.id and status = 'PENDING';
  update public.conversations set status = 'CLOSED' where request_id = r.id;
  perform public._system_message(r.id, 'Este pedido foi cancelado pelo solicitante.');

  if r.selected_helper_id is not null then
    perform public.create_notification(r.selected_helper_id, 'REQUEST_CANCELLED',
      'Pedido cancelado', 'O pedido "' || left(r.title, 60) || '" foi cancelado.', '/pedido/' || r.id);
  end if;
  for o in select helper_id from public.help_request_offers where request_id = r.id and status = 'EXPIRED' loop
    perform public.create_notification(o.helper_id, 'REQUEST_CANCELLED',
      'Pedido cancelado', 'O pedido "' || left(r.title, 60) || '" foi cancelado.', '/pedido/' || r.id);
  end loop;
end $$;

-- Ajudante desiste antes de começar: o pedido volta a ficar aberto.
create or replace function public.helper_withdraw(p_request_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := public._require_active();
  r public.help_requests%rowtype;
begin
  select * into r from public.help_requests where id = p_request_id for update;
  if not found or r.selected_helper_id is distinct from me then raise exception 'NOT_FOUND'; end if;
  if r.status not in ('ASSIGNED', 'AWAITING_CONFIRMATION') then raise exception 'INVALID_STATE'; end if;

  update public.help_request_offers set status = 'WITHDRAWN'
   where request_id = r.id and helper_id = me and status = 'ACCEPTED';
  delete from public.conversations where request_id = r.id;
  -- status primeiro: ASSIGNED exige ajudante (CHECK); OPEN com ajudante ainda é válido
  perform public._set_request_status(r.id, 'OPEN');
  update public.help_requests set
    selected_helper_id = null,
    requester_confirmed_start = false, helper_confirmed_start = false
  where id = r.id;
  perform public.create_notification(r.requester_id, 'REQUEST_CANCELLED',
    'Ajudante desistiu', 'O pedido "' || left(r.title, 60) || '" voltou a ficar aberto.', '/pedido/' || r.id);
end $$;

-- ---------- PROPOSTAS ----------
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

create or replace function public.withdraw_offer(p_offer_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare me uuid := public._require_active();
begin
  update public.help_request_offers set status = 'WITHDRAWN'
   where id = p_offer_id and helper_id = me and status = 'PENDING';
  if not found then raise exception 'NOT_FOUND'; end if;
end $$;

create or replace function public.reject_offer(p_offer_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := public._require_active();
  o public.help_request_offers%rowtype;
  r public.help_requests%rowtype;
begin
  select * into o from public.help_request_offers where id = p_offer_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  select * into r from public.help_requests where id = o.request_id;
  if r.requester_id <> me then raise exception 'NOT_FOUND'; end if;
  if o.status <> 'PENDING' then raise exception 'INVALID_STATE'; end if;
  update public.help_request_offers set status = 'REJECTED' where id = o.id;
  perform public.create_notification(o.helper_id, 'OFFER_REJECTED', 'Proposta não selecionada',
    'Sua proposta para "' || left(r.title, 60) || '" não foi selecionada desta vez.', '/pedido/' || r.id);
end $$;

-- Aceitar ajudante — TUDO em uma transação, com travas contra concorrência.
create or replace function public.accept_offer(p_offer_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := public._require_active();
  o public.help_request_offers%rowtype;
  r public.help_requests%rowtype;
  conv uuid;
  other record;
begin
  select * into o from public.help_request_offers where id = p_offer_id;
  if not found then raise exception 'NOT_FOUND'; end if;
  -- trava o pedido primeiro (ordem consistente evita deadlock)
  select * into r from public.help_requests where id = o.request_id for update;
  if r.requester_id <> me then raise exception 'NOT_FOUND'; end if;
  if r.status <> 'OPEN' then raise exception 'REQUEST_NOT_OPEN'; end if;
  select * into o from public.help_request_offers where id = p_offer_id for update;
  if o.status <> 'PENDING' then raise exception 'INVALID_STATE'; end if;
  if not public.is_active_user(o.helper_id) then raise exception 'HELPER_UNAVAILABLE'; end if;
  if public.is_blocked_between(me, o.helper_id) then raise exception 'BLOCKED'; end if;

  update public.help_request_offers set status = 'ACCEPTED' where id = o.id;
  for other in
    update public.help_request_offers set status = 'REJECTED'
     where request_id = r.id and id <> o.id and status = 'PENDING'
     returning helper_id
  loop
    perform public.create_notification(other.helper_id, 'OFFER_REJECTED', 'Proposta não selecionada',
      'Outra pessoa foi escolhida para "' || left(r.title, 60) || '".', '/pedido/' || r.id);
  end loop;

  update public.help_requests set selected_helper_id = o.helper_id,
    requester_confirmed_start = false, helper_confirmed_start = false,
    requester_confirmed_done = false, helper_confirmed_done = false
   where id = r.id;
  perform public._set_request_status(r.id, 'ASSIGNED');

  insert into public.conversations (request_id) values (r.id) returning id into conv;
  insert into public.conversation_participants (conversation_id, user_id)
  values (conv, me), (conv, o.helper_id);
  insert into public.messages (conversation_id, sender_id, message_type, content)
  values (conv, null, 'SYSTEM', public._display_name(o.helper_id) || ' foi selecionado(a) para realizar esta ajuda.');

  perform public.create_notification(o.helper_id, 'OFFER_ACCEPTED', 'Sua proposta foi aceita!',
    public._display_name(me) || ' escolheu você para "' || left(r.title, 60) || '". Confirme para começar.',
    '/conversa/' || conv, jsonb_build_object('request_id', r.id, 'conversation_id', conv));
  perform public.track_event(me, 'OFFER_ACCEPTED', jsonb_build_object('request_id', r.id));
  perform public.track_event(me, 'CHAT_STARTED', jsonb_build_object('request_id', r.id));
  return conv;
end $$;

-- ---------- CONFIRMAÇÃO / EXECUÇÃO / CONCLUSÃO ----------
create or replace function public.confirm_start(p_request_id uuid)
returns public.request_status language plpgsql security definer set search_path = public as $$
declare
  me uuid := public._require_active();
  r public.help_requests%rowtype;
  other uuid;
begin
  select * into r from public.help_requests where id = p_request_id for update;
  if not found or (r.requester_id <> me and r.selected_helper_id is distinct from me) then raise exception 'NOT_FOUND'; end if;
  if r.status not in ('ASSIGNED', 'AWAITING_CONFIRMATION') then raise exception 'INVALID_STATE'; end if;
  other := case when r.requester_id = me then r.selected_helper_id else r.requester_id end;

  if r.requester_id = me then
    update public.help_requests set requester_confirmed_start = true where id = r.id;
  else
    update public.help_requests set helper_confirmed_start = true where id = r.id;
  end if;
  select * into r from public.help_requests where id = r.id;

  if r.requester_confirmed_start and r.helper_confirmed_start then
    if r.status = 'ASSIGNED' then perform public._set_request_status(r.id, 'AWAITING_CONFIRMATION'); end if;
    perform public._set_request_status(r.id, 'IN_PROGRESS');
    perform public._system_message(r.id, 'Os dois confirmaram. A ajuda está em andamento!');
    perform public.create_notification(other, 'REQUEST_STARTED', 'Ajuda em andamento',
      'Os dois confirmaram "' || left(r.title, 60) || '".', '/conversa/' || (select id from public.conversations where request_id = r.id));
    return 'IN_PROGRESS';
  end if;

  if r.status = 'ASSIGNED' then perform public._set_request_status(r.id, 'AWAITING_CONFIRMATION'); end if;
  perform public._system_message(r.id, public._display_name(me) || ' confirmou. Aguardando a outra pessoa.');
  perform public.create_notification(other, 'REQUEST_ASSIGNED', 'Confirmação pendente',
    public._display_name(me) || ' confirmou a ajuda. Falta você confirmar.', '/pedido/' || r.id);
  return 'AWAITING_CONFIRMATION';
end $$;

create or replace function public.mark_done(p_request_id uuid)
returns public.request_status language plpgsql security definer set search_path = public as $$
declare
  me uuid := public._require_active();
  r public.help_requests%rowtype;
  other uuid;
begin
  select * into r from public.help_requests where id = p_request_id for update;
  if not found or (r.requester_id <> me and r.selected_helper_id is distinct from me) then raise exception 'NOT_FOUND'; end if;
  if r.status not in ('IN_PROGRESS', 'COMPLETION_PENDING') then raise exception 'INVALID_STATE'; end if;
  other := case when r.requester_id = me then r.selected_helper_id else r.requester_id end;

  if r.requester_id = me then
    update public.help_requests set requester_confirmed_done = true where id = r.id;
  else
    update public.help_requests set helper_confirmed_done = true where id = r.id;
  end if;
  select * into r from public.help_requests where id = r.id;

  if r.requester_confirmed_done and r.helper_confirmed_done then
    if r.status = 'IN_PROGRESS' then perform public._set_request_status(r.id, 'COMPLETION_PENDING'); end if;
    perform public._set_request_status(r.id, 'COMPLETED');
    perform public._system_message(r.id, 'Esta ajuda foi marcada como concluída.');
    update public.conversations set status = 'CLOSED' where request_id = r.id;
    perform public.create_notification(r.requester_id, 'REQUEST_COMPLETED', 'Ajuda concluída',
      'Que tal avaliar? Sua opinião ajuda a comunidade.', '/pedido/' || r.id || '#avaliar');
    perform public.create_notification(r.selected_helper_id, 'REQUEST_COMPLETED', 'Ajuda concluída',
      'Que tal avaliar? Sua opinião ajuda a comunidade.', '/pedido/' || r.id || '#avaliar');
    perform public.track_event(me, 'REQUEST_COMPLETED', jsonb_build_object('request_id', r.id));
    return 'COMPLETED';
  end if;

  if r.status = 'IN_PROGRESS' then perform public._set_request_status(r.id, 'COMPLETION_PENDING'); end if;
  perform public._system_message(r.id, public._display_name(me) || ' marcou como concluída. Aguardando a outra pessoa.');
  perform public.create_notification(other, 'REQUEST_COMPLETION_PENDING', 'Conclusão pendente',
    public._display_name(me) || ' marcou "' || left(r.title, 60) || '" como concluída. Confirme se deu tudo certo.',
    '/pedido/' || r.id);
  return 'COMPLETION_PENDING';
end $$;

create or replace function public.report_problem(
  p_request_id uuid, p_reason text, p_description text, p_evidence text[] default '{}'
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := public._require_active();
  r public.help_requests%rowtype;
  did uuid;
  other uuid;
begin
  select * into r from public.help_requests where id = p_request_id for update;
  if not found or (r.requester_id <> me and r.selected_helper_id is distinct from me) then raise exception 'NOT_FOUND'; end if;
  if r.status not in ('IN_PROGRESS', 'COMPLETION_PENDING') then raise exception 'INVALID_STATE'; end if;
  perform public.enforce_rate_limit('report_problem', 5, 86400);
  other := case when r.requester_id = me then r.selected_helper_id else r.requester_id end;

  perform public._set_request_status(r.id, 'DISPUTED');
  insert into public.disputes (request_id, opened_by, reason, description, evidence_urls)
  values (r.id, me, p_reason, p_description, coalesce(p_evidence, '{}')) returning id into did;
  perform public._system_message(r.id, 'Um problema foi relatado. Nossa equipe vai analisar.');
  perform public.create_notification(other, 'DISPUTE_OPENED', 'Problema relatado',
    'Um problema foi relatado em "' || left(r.title, 60) || '". Nossa equipe vai analisar.', '/pedido/' || r.id);
  perform public.notify_admins('DISPUTE_OPENED', 'Nova disputa', 'Disputa aberta em "' || left(r.title, 60) || '".', '/admin/disputas');
  return did;
end $$;

-- ---------- AVALIAÇÕES ----------
create or replace function public.submit_review(
  p_request_id uuid, p_rating integer, p_comment text default null,
  p_punctuality integer default null, p_respect integer default null,
  p_communication integer default null, p_fulfillment integer default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := public._require_active();
  r public.help_requests%rowtype;
  other uuid;
  rid uuid;
begin
  select * into r from public.help_requests where id = p_request_id;
  if not found or (r.requester_id <> me and r.selected_helper_id is distinct from me) then raise exception 'NOT_FOUND'; end if;
  if r.status <> 'COMPLETED' then raise exception 'INVALID_STATE'; end if;
  other := case when r.requester_id = me then r.selected_helper_id else r.requester_id end;
  begin
    insert into public.reviews (request_id, reviewer_id, reviewee_id, rating, comment,
                                punctuality, respect, communication, fulfillment)
    values (p_request_id, me, other, p_rating, nullif(trim(p_comment), ''),
            p_punctuality, p_respect, p_communication, p_fulfillment)
    returning id into rid;
  exception when unique_violation then
    raise exception 'ALREADY_REVIEWED';
  end;
  perform public.create_notification(other, 'NEW_REVIEW', 'Você recebeu uma avaliação',
    'Veja o que ' || public._display_name(me) || ' disse sobre a ajuda.', '/perfil');
  perform public.track_event(me, 'REVIEW_CREATED', jsonb_build_object('request_id', p_request_id));
  return rid;
end $$;

-- ---------- DENÚNCIAS ----------
create or replace function public.submit_report(
  p_reported uuid, p_reason text, p_description text,
  p_request_id uuid default null, p_conversation_id uuid default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := public._require_active();
  rid uuid;
  prio smallint;
begin
  if p_reported = me then raise exception 'INVALID_INPUT'; end if;
  if not exists (select 1 from public.profiles where id = p_reported) then raise exception 'NOT_FOUND'; end if;
  perform public.enforce_rate_limit('submit_report', 10, 86400);
  prio := case when p_reason in ('THREAT', 'ILLEGAL_ACTIVITY', 'SCAM_ATTEMPT', 'HARASSMENT') then 1
               when p_reason = 'OTHER' then 3 else 2 end;
  insert into public.reports (reporter_id, reported_user_id, request_id, conversation_id, reason, description, priority)
  values (me, p_reported, p_request_id, p_conversation_id, p_reason, p_description, prio)
  returning id into rid;
  perform public.notify_admins('REPORT_CREATED', 'Nova denúncia', 'Uma denúncia aguarda análise.', '/admin/denuncias');
  perform public.track_event(me, 'REPORT_CREATED', jsonb_build_object('report_id', rid));
  return rid;
end $$;

-- ---------- MENSAGENS ----------
create or replace function public.can_send_message(conv uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
    and public.is_active_user(auth.uid())
    and exists (select 1 from public.conversations c where c.id = conv and c.status = 'OPEN')
    and public.is_conversation_participant(conv, auth.uid())
    and not exists (
      select 1 from public.conversation_participants p
      where p.conversation_id = conv and p.user_id <> auth.uid()
        and public.is_blocked_between(auth.uid(), p.user_id)
    );
$$;

create or replace function public.messages_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.message_type = 'TEXT' and auth.uid() is not null then
    perform public.enforce_rate_limit('send_message', 40, 60);
  end if;
  return new;
end $$;
create trigger messages_before_insert before insert on public.messages
  for each row execute function public.messages_before_insert();

create or replace function public.messages_after_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare p record;
begin
  update public.conversations set updated_at = now() where id = new.conversation_id;
  if new.message_type = 'TEXT' then
    for p in select user_id from public.conversation_participants
             where conversation_id = new.conversation_id and user_id <> new.sender_id loop
      perform public.create_notification(p.user_id, 'NEW_MESSAGE', 'Nova mensagem',
        'Você recebeu uma mensagem de ' || public._display_name(new.sender_id) || '.', '/conversa/' || new.conversation_id);
    end loop;
  end if;
  return new;
end $$;
create trigger messages_after_insert after insert on public.messages
  for each row execute function public.messages_after_insert();

-- ---------- PUSH ----------
create or replace function public.upsert_push_subscription(
  p_endpoint text, p_p256dh text, p_auth text,
  p_user_agent text default null, p_device_type text default 'unknown', p_browser text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := public._require_active();
  sid uuid;
  n integer;
begin
  perform public.enforce_rate_limit('push_subscribe', 20, 3600);
  select count(*) into n from public.push_subscriptions where user_id = me and is_active and endpoint <> p_endpoint;
  if n >= 10 then raise exception 'TOO_MANY_DEVICES'; end if;
  -- o mesmo endpoint (mesmo navegador) passa para quem fez login por último
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, device_type, browser, is_active, last_used_at)
  values (me, p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300), coalesce(p_device_type, 'unknown'), left(p_browser, 60), true, now())
  on conflict (endpoint) do update set
    user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
    user_agent = excluded.user_agent, device_type = excluded.device_type, browser = excluded.browser,
    is_active = true, last_used_at = now()
  returning id into sid;
  return sid;
end $$;



-- ---------- EXCLUSÃO DE CONTA (LGPD) ----------
-- Antes de apagar um perfil, resolve ajudas em que ele era o ajudante e avisa os solicitantes.
create or replace function public.profiles_before_delete()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  -- ainda não começou: o pedido volta a ficar aberto (a conversa é removida)
  for r in
    update public.help_requests set
      status = 'OPEN', selected_helper_id = null,
      requester_confirmed_start = false, helper_confirmed_start = false
     where selected_helper_id = old.id and status in ('ASSIGNED', 'AWAITING_CONFIRMATION')
     returning id, requester_id, title
  loop
    delete from public.conversations where request_id = r.id;
    perform public.create_notification(r.requester_id, 'REQUEST_CANCELLED', 'Ajudante desistiu',
      'O pedido "' || left(r.title, 60) || '" voltou a ficar aberto.', '/pedido/' || r.id);
  end loop;
  -- já em andamento ou em disputa: cancelado
  for r in
    update public.help_requests set status = 'CANCELLED', cancelled_at = now()
     where selected_helper_id = old.id and status in ('IN_PROGRESS', 'COMPLETION_PENDING', 'DISPUTED')
     returning id, requester_id, title
  loop
    update public.conversations set status = 'CLOSED' where request_id = r.id;
    perform public.create_notification(r.requester_id, 'REQUEST_CANCELLED', 'Pedido cancelado',
      'O ajudante saiu da plataforma. O pedido "' || left(r.title, 60) || '" foi cancelado.', '/pedido/' || r.id);
  end loop;
  return old;
end $$;
create trigger profiles_before_delete before delete on public.profiles
  for each row execute function public.profiles_before_delete();

-- ---------- PUSH: fila de envio (somente service_role) ----------
-- Reivindica atomicamente notificações PENDING; evita envio duplicado entre workers.
create or replace function public.claim_pending_push(p_limit integer default 50)
returns setof public.notifications language plpgsql security definer set search_path = public as $$
begin
  -- libera "presas" (processo caiu durante o envio)
  update public.notifications set push_status = 'PENDING'
   where push_status = 'SENDING' and created_at < now() - interval '5 minutes';
  return query
  update public.notifications n set push_status = 'SENDING'
   where n.id in (
     select id from public.notifications
      where push_status = 'PENDING'
      order by created_at
      limit least(greatest(p_limit, 1), 200)
      for update skip locked
   )
  returning n.*;
end $$;


-- Lista de quem EU bloqueei (a RLS de profiles esconde perfis bloqueados nos dois sentidos).
create or replace function public.list_my_blocks()
returns table (blocked_id uuid, full_name text) language sql stable security definer set search_path = public as $$
  select b.blocked_id, p.full_name
    from public.blocks b join public.profiles p on p.id = b.blocked_id
   where b.blocker_id = auth.uid()
   order by b.created_at desc;
$$;

-- ---------- BUSCA / FEED (SECURITY INVOKER: a RLS decide o que é visível) ----------
create or replace function public.haversine_km(lat1 double precision, lon1 double precision, lat2 double precision, lon2 double precision)
returns double precision language sql immutable as $$
  select case when lat1 is null or lon1 is null or lat2 is null or lon2 is null then null
  else 2 * 6371 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lon2 - lon1) / 2), 2))) end;
$$;

create or replace function public.search_requests(
  p_state text default null,
  p_city text default null,
  p_neighborhood text default null,
  p_category uuid default null,
  p_help_type public.help_type default null,
  p_day text default null,            -- 'today' | 'tomorrow'
  p_lat double precision default null,
  p_lng double precision default null,
  p_max_km double precision default null,
  p_query text default null,
  p_sort text default 'recent',       -- 'recent' | 'nearest' | 'time' | 'category'
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
    and r.requester_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000')
    and (p_state is null or r.state = p_state)
    and (p_city is null or r.city = p_city)
    and (p_neighborhood is null or r.neighborhood = p_neighborhood)
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

-- ---------- EXPIRAÇÃO (chamada por cron/servidor) ----------
create or replace function public.expire_requests()
returns integer language plpgsql security definer set search_path = public as $$
declare r record; n integer := 0;
begin
  for r in
    select * from public.help_requests
     where status = 'OPEN' and public.request_starts_at(help_requests) < now()
     for update skip locked
  loop
    perform public._set_request_status(r.id, 'EXPIRED');
    update public.help_request_offers set status = 'EXPIRED' where request_id = r.id and status = 'PENDING';
    n := n + 1;
  end loop;
  return n;
end $$;

-- ---------- ADMIN ----------
create or replace function public.admin_set_user_status(p_user uuid, p_status public.user_status, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := public._require_admin();
  old_row public.profiles%rowtype;
begin
  if p_user = me then raise exception 'INVALID_INPUT'; end if;
  select * into old_row from public.profiles where id = p_user for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if old_row.role in ('ADMIN', 'SUPER_ADMIN') then raise exception 'FORBIDDEN'; end if;
  update public.profiles set status = p_status where id = p_user;
  perform public.write_audit('user.status_changed', 'user', p_user::text,
    jsonb_build_object('status', old_row.status), jsonb_build_object('status', p_status),
    jsonb_build_object('reason', p_reason));
end $$;

create or replace function public.admin_set_request_status(p_request uuid, p_status public.request_status, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := public._require_admin();
  r public.help_requests%rowtype;
begin
  select * into r from public.help_requests where id = p_request for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if p_status = 'CANCELLED' and r.status not in ('COMPLETED', 'CANCELLED', 'EXPIRED') then
    -- admin pode cancelar qualquer pedido não terminal (remoção de conteúdo)
    update public.help_requests set status = 'CANCELLED', cancelled_at = now() where id = r.id;
    update public.help_request_offers set status = 'EXPIRED' where request_id = r.id and status = 'PENDING';
    update public.conversations set status = 'CLOSED' where request_id = r.id;
  else
    perform public._set_request_status(r.id, p_status);
  end if;
  perform public.write_audit('request.status_changed', 'help_request', r.id::text,
    jsonb_build_object('status', r.status), jsonb_build_object('status', p_status),
    jsonb_build_object('reason', p_reason));
  perform public.create_notification(r.requester_id, 'SYSTEM_ALERT', 'Seu pedido foi atualizado',
    'A moderação atualizou o pedido "' || left(r.title, 60) || '".', '/pedido/' || r.id);
end $$;

create or replace function public.admin_resolve_report(
  p_report uuid, p_status public.report_status, p_notes text default null, p_suspend_reported boolean default false
) returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := public._require_admin();
  rp public.reports%rowtype;
begin
  if p_status = 'OPEN' then raise exception 'INVALID_INPUT'; end if;
  select * into rp from public.reports where id = p_report for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  update public.reports set
    status = p_status, admin_notes = p_notes,
    resolved_by = case when p_status in ('RESOLVED', 'DISMISSED') then me else resolved_by end,
    resolved_at = case when p_status in ('RESOLVED', 'DISMISSED') then now() else resolved_at end
  where id = rp.id;
  if p_suspend_reported then
    perform public.admin_set_user_status(rp.reported_user_id, 'SUSPENDED', 'Denúncia ' || rp.id);
  end if;
  perform public.write_audit('report.' || lower(p_status::text), 'report', rp.id::text,
    jsonb_build_object('status', rp.status), jsonb_build_object('status', p_status),
    jsonb_build_object('suspended_reported', p_suspend_reported));
  perform public.create_notification(rp.reporter_id, 'REPORT_UPDATED', 'Denúncia atualizada',
    'Sua denúncia foi analisada pela nossa equipe.', '/seguranca');
end $$;

create or replace function public.admin_resolve_dispute(
  p_dispute uuid, p_status public.dispute_status, p_resolution text default null, p_outcome public.request_status default null
) returns void language plpgsql security definer set search_path = public as $$
declare
  me uuid := public._require_admin();
  d public.disputes%rowtype;
  r public.help_requests%rowtype;
begin
  if p_status = 'OPEN' then raise exception 'INVALID_INPUT'; end if;
  select * into d from public.disputes where id = p_dispute for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  select * into r from public.help_requests where id = d.request_id for update;
  if p_outcome is not null then
    if p_outcome not in ('COMPLETED', 'CANCELLED') then raise exception 'INVALID_INPUT'; end if;
    perform public._set_request_status(r.id, p_outcome);
    update public.conversations set status = 'CLOSED' where request_id = r.id;
  end if;
  update public.disputes set
    status = p_status, resolution = p_resolution,
    resolved_by = case when p_status in ('RESOLVED', 'DISMISSED') then me else resolved_by end,
    resolved_at = case when p_status in ('RESOLVED', 'DISMISSED') then now() else resolved_at end
  where id = d.id;
  perform public.write_audit('dispute.' || lower(p_status::text), 'dispute', d.id::text,
    jsonb_build_object('status', d.status), jsonb_build_object('status', p_status),
    jsonb_build_object('outcome', p_outcome, 'request_id', r.id));
  if p_status in ('RESOLVED', 'DISMISSED') then
    perform public.create_notification(r.requester_id, 'SYSTEM_ALERT', 'Disputa analisada',
      'A disputa de "' || left(r.title, 60) || '" foi analisada.', '/pedido/' || r.id);
    if r.selected_helper_id is not null then
      perform public.create_notification(r.selected_helper_id, 'SYSTEM_ALERT', 'Disputa analisada',
        'A disputa de "' || left(r.title, 60) || '" foi analisada.', '/pedido/' || r.id);
    end if;
  end if;
end $$;

create or replace function public.admin_dashboard_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._require_admin();
  return jsonb_build_object(
    'users_total', (select count(*) from public.profiles),
    'users_active', (select count(*) from public.profiles where status = 'ACTIVE'),
    'users_blocked', (select count(*) from public.profiles where status in ('BLOCKED', 'SUSPENDED')),
    'requests_total', (select count(*) from public.help_requests where status <> 'DRAFT'),
    'requests_open', (select count(*) from public.help_requests where status = 'OPEN'),
    'requests_completed', (select count(*) from public.help_requests where status = 'COMPLETED'),
    'requests_cancelled', (select count(*) from public.help_requests where status = 'CANCELLED'),
    'helps_in_progress', (select count(*) from public.help_requests where status in ('ASSIGNED', 'AWAITING_CONFIRMATION', 'IN_PROGRESS', 'COMPLETION_PENDING')),
    'reports_open', (select count(*) from public.reports where status in ('OPEN', 'UNDER_REVIEW')),
    'disputes_open', (select count(*) from public.disputes where status in ('OPEN', 'UNDER_REVIEW'))
  );
end $$;

-- ---------- ESTATÍSTICAS DE REPUTAÇÃO ----------
-- Somente agregados; respeita show_rating / show_help_count e visibilidade do perfil.
create or replace view public.profile_stats as
select
  p.id as user_id,
  case when p.show_rating or p.id = auth.uid() or public.is_admin() then rv.avg_rating end as avg_rating,
  case when p.show_rating or p.id = auth.uid() or public.is_admin() then rv.review_count else 0 end as review_count,
  case when p.show_help_count or p.id = auth.uid() or public.is_admin() then hs.helps_completed else 0 end as helps_completed,
  rq.requests_completed,
  rq.requests_total,
  case when rq.requests_total > 0 then round(rq.requests_completed::numeric / rq.requests_total, 2) end as completion_rate
from public.profiles p
left join lateral (
  select round(avg(rating)::numeric, 2) as avg_rating, count(*)::int as review_count
  from public.reviews where reviewee_id = p.id
) rv on true
left join lateral (
  select count(*)::int as helps_completed from public.help_requests
  where selected_helper_id = p.id and status = 'COMPLETED'
) hs on true
left join lateral (
  select count(*) filter (where status = 'COMPLETED')::int as requests_completed,
         count(*) filter (where status not in ('DRAFT'))::int as requests_total
  from public.help_requests where requester_id = p.id
) rq on true
where public.can_view_profile(p.id);

-- ---------- PERMISSÕES DE EXECUÇÃO ----------
revoke execute on all functions in schema public from public, anon, authenticated;

-- RPCs chamáveis por usuários autenticados
grant execute on function
  public.publish_request(uuid), public.cancel_request(uuid, text), public.helper_withdraw(uuid),
  public.submit_offer(uuid, text), public.withdraw_offer(uuid), public.reject_offer(uuid), public.accept_offer(uuid),
  public.confirm_start(uuid), public.mark_done(uuid), public.report_problem(uuid, text, text, text[]),
  public.submit_review(uuid, integer, text, integer, integer, integer, integer),
  public.submit_report(uuid, text, text, uuid, uuid),
  public.upsert_push_subscription(text, text, text, text, text, text),
  public.search_requests(text, text, text, uuid, public.help_type, text, double precision, double precision, double precision, text, text, integer, integer),
  public.admin_set_user_status(uuid, public.user_status, text),
  public.admin_set_request_status(uuid, public.request_status, text),
  public.admin_resolve_report(uuid, public.report_status, text, boolean),
  public.admin_resolve_dispute(uuid, public.dispute_status, text, public.request_status),
  public.admin_dashboard_stats(), public.list_my_blocks(),
  public.enforce_rate_limit(text, integer, integer),
  -- usadas dentro de políticas RLS / views (avaliadas como o usuário que consulta)
  public.is_admin(), public.is_active_user(uuid), public.is_blocked_between(uuid, uuid),
  public.is_conversation_participant(uuid, uuid), public.shares_context(uuid),
  public.can_view_profile(uuid), public.can_see_contact(uuid), public.is_request_party(uuid, uuid),
  public.can_send_message(uuid), public.haversine_km(double precision, double precision, double precision, double precision),
  public.request_transition_allowed(public.request_status, public.request_status),
  public.request_starts_at(public.help_requests)
to authenticated;

grant execute on function public.is_admin(), public.haversine_km(double precision, double precision, double precision, double precision) to anon;
grant execute on all functions in schema public to service_role;
