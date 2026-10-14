-- AJUDA AQUI — dados de DEMONSTRAÇÃO (somente desenvolvimento).
-- Aplicado por `supabase db reset`. Idempotente: apagar e recriar os dados demo = "resetar o seed".
-- NUNCA rodar em produção. Todos os registros são fictícios e marcados com is_demo = true.
-- Login de todos os usuários: e-mail abaixo + senha  Demo@12345   (admin: admin@demo.ajudaaqui.local)

create extension if not exists pgcrypto;

-- ---------- RESET dos dados demo (cascata limpa pedidos, propostas, conversas, avaliações…) ----------
delete from auth.users where email like '%@demo.ajudaaqui.local';

-- ---------- Função auxiliar temporária ----------
create or replace function pg_temp.demo_user(
  p_id uuid, p_email text, p_name text, p_phone text, p_state text, p_city text, p_hood text, p_role text default 'USER'
) returns void language plpgsql as $$
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change, email_change_token_new
  ) values (
    '00000000-0000-0000-0000-000000000000', p_id, 'authenticated', 'authenticated', p_email,
    crypt('Demo@12345', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('full_name', p_name, 'phone', p_phone, 'state', p_state, 'city', p_city, 'neighborhood', p_hood,
                       'terms_version', '2026-10-14', 'privacy_version', '2026-10-14', 'safety_version', '2026-10-14'),
    now(), now(), '', '', '', ''
  );
  insert into auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), p_id, jsonb_build_object('sub', p_id::text, 'email', p_email, 'email_verified', true),
          'email', p_id::text, now(), now(), now());
  -- o trigger handle_new_user criou profile/contatos/preferências/consentimento
  update public.profiles
     set is_demo = true, onboarding_completed = true, role = p_role::public.user_role,
         bio = case when p_role = 'ADMIN' then 'Conta de demonstração da moderação.' else 'Perfil de demonstração — pessoa fictícia.' end
   where id = p_id;
end $$;

-- ---------- Usuários fictícios ----------
select pg_temp.demo_user('11111111-0000-0000-0000-000000000001', 'maria@demo.ajudaaqui.local',    'Maria Silva',      '+55 21 98888-0001', 'RJ', 'Niterói',        'Icaraí');
select pg_temp.demo_user('11111111-0000-0000-0000-000000000002', 'joao@demo.ajudaaqui.local',     'João Souza',       '+55 21 98888-0002', 'RJ', 'Niterói',        'Centro');
select pg_temp.demo_user('11111111-0000-0000-0000-000000000003', 'ana@demo.ajudaaqui.local',      'Ana Costa',        '+55 21 98888-0003', 'RJ', 'Niterói',        'Santa Rosa');
select pg_temp.demo_user('11111111-0000-0000-0000-000000000004', 'carlos@demo.ajudaaqui.local',   'Carlos Lima',      '+55 21 98888-0004', 'RJ', 'Rio de Janeiro', 'Tijuca');
select pg_temp.demo_user('11111111-0000-0000-0000-000000000005', 'beatriz@demo.ajudaaqui.local',  'Beatriz Rocha',    '+55 11 98888-0005', 'SP', 'São Paulo',      'Pinheiros');
select pg_temp.demo_user('11111111-0000-0000-0000-000000000006', 'diego@demo.ajudaaqui.local',    'Diego Martins',    '+55 11 98888-0006', 'SP', 'São Paulo',      'Mooca');
select pg_temp.demo_user('11111111-0000-0000-0000-000000000007', 'fernanda@demo.ajudaaqui.local', 'Fernanda Alves',   '+55 41 98888-0007', 'PR', 'Curitiba',       'Batel');
select pg_temp.demo_user('11111111-0000-0000-0000-000000000008', 'gustavo@demo.ajudaaqui.local',  'Gustavo Pereira',  '+55 71 98888-0008', 'BA', 'Salvador',       'Pituba');
select pg_temp.demo_user('11111111-0000-0000-0000-000000000009', 'helena@demo.ajudaaqui.local',   'Helena Nunes',     '+55 21 98888-0009', 'RJ', 'Tanguá',         'Centro');
select pg_temp.demo_user('11111111-0000-0000-0000-000000000010', 'igor@demo.ajudaaqui.local',     'Igor Barbosa',     '+55 21 98888-0010', 'RJ', 'Niterói',        'Icaraí');
select pg_temp.demo_user('11111111-0000-0000-0000-000000000099', 'admin@demo.ajudaaqui.local',    'Admin Demo',       '+55 21 98888-0099', 'RJ', 'Niterói',        'Centro', 'ADMIN');

-- ---------- Categorias dos usuários + preferências de ajudante ----------
insert into public.user_categories (user_id, category_id)
select u.id, c.id
  from (values
    ('11111111-0000-0000-0000-000000000001'::uuid, 'compras'), ('11111111-0000-0000-0000-000000000001', 'casa'),
    ('11111111-0000-0000-0000-000000000002', 'entregas'), ('11111111-0000-0000-0000-000000000002', 'transporte'), ('11111111-0000-0000-0000-000000000002', 'tecnologia'),
    ('11111111-0000-0000-0000-000000000003', 'tecnologia'), ('11111111-0000-0000-0000-000000000003', 'celular'), ('11111111-0000-0000-0000-000000000003', 'estudos'),
    ('11111111-0000-0000-0000-000000000004', 'pequenos-reparos'), ('11111111-0000-0000-0000-000000000004', 'casa'),
    ('11111111-0000-0000-0000-000000000005', 'animais'), ('11111111-0000-0000-0000-000000000005', 'acompanhamento'),
    ('11111111-0000-0000-0000-000000000006', 'entregas'), ('11111111-0000-0000-0000-000000000006', 'compras'),
    ('11111111-0000-0000-0000-000000000007', 'documentos'), ('11111111-0000-0000-0000-000000000007', 'estudos'),
    ('11111111-0000-0000-0000-000000000008', 'tecnologia'), ('11111111-0000-0000-0000-000000000008', 'celular'),
    ('11111111-0000-0000-0000-000000000009', 'compras'), ('11111111-0000-0000-0000-000000000009', 'acompanhamento'), ('11111111-0000-0000-0000-000000000009', 'animais'),
    ('11111111-0000-0000-0000-000000000010', 'pequenos-reparos'), ('11111111-0000-0000-0000-000000000010', 'transporte')
  ) as u(id, slug)
  join public.categories c on c.slug = u.slug;

insert into public.helper_preferences (user_id, state, city, neighborhood, latitude, longitude, max_distance_km, available_days, availability_start, availability_end, description)
select p.id, p.state, p.city, p.neighborhood, x.lat, x.lng, x.km, x.days, x.s::time, x.e::time, 'Prefiro ajudar nos horários combinados pelo chat.'
  from public.profiles p
  join (values
    ('11111111-0000-0000-0000-000000000001'::uuid, -22.88, -43.10, 10, '{1,2,3,4,5}'::smallint[], '09:00', '19:00'),
    ('11111111-0000-0000-0000-000000000002',       -22.89, -43.12, 20, '{0,1,2,3,4,5,6}',        '08:00', '22:00'),
    ('11111111-0000-0000-0000-000000000003',       -22.90, -43.11, 15, '{1,2,3,4,5,6}',          '17:00', '21:00'),
    ('11111111-0000-0000-0000-000000000004',       -22.91, -43.17, 15, '{6,0}',                  '08:00', '18:00'),
    ('11111111-0000-0000-0000-000000000005',       -23.55, -46.63, 10, '{0,6}',                  '08:00', '20:00'),
    ('11111111-0000-0000-0000-000000000006',       -23.55, -46.63, 25, '{1,2,3,4,5}',            '07:00', '18:00'),
    ('11111111-0000-0000-0000-000000000007',       -25.43, -49.27, 10, '{1,2,3,4,5}',            '08:00', '17:00'),
    ('11111111-0000-0000-0000-000000000008',       -12.97, -38.51, 15, '{1,3,5}',                '18:00', '22:00'),
    ('11111111-0000-0000-0000-000000000009',       -22.73, -42.72, 15, '{1,2,3,4,5}',            '08:00', '16:00'),
    ('11111111-0000-0000-0000-000000000010',       -22.88, -43.10, 20, '{0,1,2,3,4,5,6}',        '08:00', '20:00')
  ) as x(id, lat, lng, km, days, s, e) on x.id = p.id;

-- ---------- Pedidos (15) ----------
-- id fixo facilita propostas/conversas abaixo. Datas relativas a hoje (America/Sao_Paulo).
create or replace function pg_temp.demo_request(
  p_n integer, p_requester integer, p_cat text, p_title text, p_desc text, p_type public.help_type, p_amount integer, p_exchange text,
  p_state text, p_city text, p_hood text, p_lat double precision, p_lng double precision,
  p_days integer, p_time time, p_dur integer, p_status public.request_status, p_helper integer default null
) returns void language plpgsql as $$
begin
  insert into public.help_requests (
    id, requester_id, category_id, title, description, help_type, amount_cents, exchange_description,
    state, city, neighborhood, public_latitude, public_longitude, scheduled_date, scheduled_time, duration_minutes,
    status, selected_helper_id, requester_confirmed_start, helper_confirmed_start, requester_confirmed_done, helper_confirmed_done,
    published_at, completed_at, cancelled_at, is_demo
  ) values (
    ('22222222-0000-0000-0000-' || lpad(p_n::text, 12, '0'))::uuid,
    ('11111111-0000-0000-0000-' || lpad(p_requester::text, 12, '0'))::uuid,
    (select id from public.categories where slug = p_cat),
    p_title, p_desc, p_type, p_amount, p_exchange, p_state, p_city, p_hood, p_lat, p_lng,
    (now() at time zone 'America/Sao_Paulo')::date + p_days, p_time, p_dur, p_status,
    case when p_helper is null then null else ('11111111-0000-0000-0000-' || lpad(p_helper::text, 12, '0'))::uuid end,
    p_status in ('AWAITING_CONFIRMATION', 'IN_PROGRESS', 'COMPLETION_PENDING', 'COMPLETED'),
    p_status in ('IN_PROGRESS', 'COMPLETION_PENDING', 'COMPLETED'),
    p_status = 'COMPLETED', p_status = 'COMPLETED',
    now() - interval '2 days', case when p_status = 'COMPLETED' then now() - interval '1 day' end,
    case when p_status = 'CANCELLED' then now() - interval '1 day' end, true
  );
end $$;

select pg_temp.demo_request(1,  1, 'entregas',         'Buscar uma encomenda',                   'Preciso buscar um pacote pequeno na agência dos Correios e levar até a portaria do meu prédio.', 'PAID', 2000, null, 'RJ', 'Niterói', 'Icaraí', -22.88, -43.10, 1, '18:00', 60, 'OPEN');
select pg_temp.demo_request(2,  1, 'casa',             'Ajuda para organizar o armário',          'Quero reorganizar o armário do quarto. Serve para quem tiver paciência e bom gosto!', 'FREE', null, null, 'RJ', 'Niterói', 'Icaraí', -22.88, -43.10, 2, '10:00', 120, 'OPEN');
select pg_temp.demo_request(3,  3, 'tecnologia',       'Configurar o Wi-Fi da minha mãe',         'O roteador novo chegou e precisamos configurar a rede e conectar os aparelhos.', 'FREE', null, null, 'RJ', 'Niterói', 'Santa Rosa', -22.90, -43.11, 1, '14:00', 60, 'OPEN');
select pg_temp.demo_request(4,  4, 'compras',          'Fazer compras no mercado',                'Lista pequena de compras de supermercado para uma pessoa idosa.', 'PAID', 3500, null, 'RJ', 'Rio de Janeiro', 'Tijuca', -22.91, -43.17, 1, '09:00', 90, 'OPEN');
select pg_temp.demo_request(5,  5, 'animais',          'Passear com cachorro no sábado',          'Cachorro dócil de porte médio precisa de um passeio de 40 minutos.', 'EXCHANGE', null, 'Bolo caseiro', 'SP', 'São Paulo', 'Pinheiros', -23.55, -46.63, 3, '08:00', 45, 'OPEN');
select pg_temp.demo_request(6,  6, 'transporte',       'Carona até a rodoviária',                 'Preciso chegar à rodoviária com uma mala. Pode ser de carro ou moto.', 'PAID', 4000, null, 'SP', 'São Paulo', 'Mooca', -23.55, -46.63, 2, '07:30', 40, 'OPEN');
select pg_temp.demo_request(7,  7, 'documentos',        'Ajuda com documentos do INSS',            'Preciso entender como agendar um atendimento e quais documentos levar.', 'FREE', null, null, 'PR', 'Curitiba', 'Batel', -25.43, -49.27, 4, '15:00', 60, 'OPEN');
select pg_temp.demo_request(8,  8, 'celular',          'Passar fotos do celular antigo para o novo', 'Tenho muitas fotos de família e não sei transferir sem perder nada.', 'PAID', 3000, null, 'BA', 'Salvador', 'Pituba', -12.97, -38.51, 1, '19:00', 60, 'OPEN');
select pg_temp.demo_request(9,  9, 'acompanhamento',   'Acompanhar ao posto de saúde',            'Preciso de companhia para uma consulta de rotina pela manhã.', 'FREE', null, null, 'RJ', 'Tanguá', 'Centro', -22.73, -42.72, 2, '09:30', 120, 'OPEN');
select pg_temp.demo_request(10, 10, 'pequenos-reparos', 'Trocar chuveiro elétrico',               'Já tenho o chuveiro novo. Preciso de alguém que saiba instalar com segurança.', 'PAID', 6000, null, 'RJ', 'Niterói', 'Icaraí', -22.88, -43.10, 3, '16:00', 60, 'OPEN');
select pg_temp.demo_request(11, 1, 'documentos',        'Levar documento ao cartório',             'Preciso entregar um envelope em um cartório do Centro.', 'PAID', 2500, null, 'RJ', 'Niterói', 'Icaraí', -22.88, -43.10, 1, '11:00', 60, 'AWAITING_CONFIRMATION', 2);
select pg_temp.demo_request(12, 3, 'pequenos-reparos', 'Instalar uma prateleira',                  'Furar a parede e fixar uma prateleira de 80 cm na sala.', 'FREE', null, null, 'RJ', 'Niterói', 'Santa Rosa', -22.90, -43.11, 0, '22:00', 90, 'IN_PROGRESS', 2);
select pg_temp.demo_request(13, 1, 'compras',          'Buscar remédio na farmácia',               'Preciso de um remédio da farmácia da esquina, com receita já paga.', 'PAID', 1500, null, 'RJ', 'Niterói', 'Icaraí', -22.88, -43.10, -5, '17:00', 30, 'COMPLETED', 2);
select pg_temp.demo_request(14, 6, 'entregas',         'Entregar um pacote',                       'Entregar um pacote para uma colega no bairro vizinho.', 'PAID', 2200, null, 'SP', 'São Paulo', 'Mooca', -23.55, -46.63, -3, '13:00', 60, 'COMPLETED', 5);
select pg_temp.demo_request(15, 7, 'estudos',           'Reforço de matemática (cancelado)',       'Pedido de exemplo que foi cancelado pela solicitante.', 'FREE', null, null, 'PR', 'Curitiba', 'Batel', -25.43, -49.27, -2, '16:00', 60, 'CANCELLED');

-- endereço PRIVADO (exemplo): só dono / ajudante confirmado enxergam
insert into public.help_request_private (request_id, address, notes)
select id, 'Rua Exemplo, 123 — apto 45 (dado fictício)', 'Interfone 45' from public.help_requests where is_demo and status in ('OPEN', 'AWAITING_CONFIRMATION', 'IN_PROGRESS');

-- ---------- Propostas ----------
insert into public.help_request_offers (request_id, helper_id, message, status) values
  ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000002', 'Posso realizar essa tarefa hoje às 18h.', 'PENDING'),
  ('22222222-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000010', 'Passo por perto nesse horário e posso buscar.', 'PENDING'),
  ('22222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000009', 'Adoro organizar! Tenho tempo nesse dia.', 'PENDING'),
  ('22222222-0000-0000-0000-000000000003', '11111111-0000-0000-0000-000000000002', 'Trabalho com tecnologia, resolvo rapidinho.', 'PENDING'),
  ('22222222-0000-0000-0000-000000000006', '11111111-0000-0000-0000-000000000005', 'Tenho carro e posso levar você.', 'PENDING'),
  ('22222222-0000-0000-0000-000000000011', '11111111-0000-0000-0000-000000000002', 'Moro perto do Centro, levo sem problemas.', 'ACCEPTED'),
  ('22222222-0000-0000-0000-000000000012', '11111111-0000-0000-0000-000000000002', 'Tenho furadeira e experiência.', 'ACCEPTED'),
  ('22222222-0000-0000-0000-000000000013', '11111111-0000-0000-0000-000000000002', 'Pego agora mesmo.', 'ACCEPTED'),
  ('22222222-0000-0000-0000-000000000014', '11111111-0000-0000-0000-000000000005', 'Consigo entregar nesse horário.', 'ACCEPTED');

-- ---------- Conversas + mensagens (somente pedidos com ajudante selecionado) ----------
insert into public.conversations (id, request_id, status)
select ('33333333-0000-0000-0000-' || right(r.id::text, 12))::uuid, r.id,
       case when r.status in ('COMPLETED', 'CANCELLED') then 'CLOSED' else 'OPEN' end
  from public.help_requests r where r.is_demo and r.selected_helper_id is not null;

insert into public.conversation_participants (conversation_id, user_id)
select c.id, p.uid
  from public.conversations c
  join public.help_requests r on r.id = c.request_id
  cross join lateral (values (r.requester_id), (r.selected_helper_id)) as p(uid)
 where r.is_demo;

insert into public.messages (conversation_id, sender_id, message_type, content, read_at, created_at)
select c.id, null, 'SYSTEM', 'Ajuda combinada! Conversem para acertar os detalhes.', now(), now() - interval '2 days'
  from public.conversations c join public.help_requests r on r.id = c.request_id where r.is_demo;

insert into public.messages (conversation_id, sender_id, message_type, content, read_at, created_at)
select c.id, r.requester_id, 'TEXT', 'Oi! Obrigado por se oferecer. Podemos confirmar o horário?', now(), now() - interval '47 hours'
  from public.conversations c join public.help_requests r on r.id = c.request_id where r.is_demo;
insert into public.messages (conversation_id, sender_id, message_type, content, read_at, created_at)
select c.id, r.selected_helper_id, 'TEXT', 'Claro! Pode ser no horário combinado, estarei lá.', case when r.status = 'AWAITING_CONFIRMATION' then null else now() end, now() - interval '46 hours'
  from public.conversations c join public.help_requests r on r.id = c.request_id where r.is_demo;

-- ---------- Avaliações (pedidos concluídos) ----------
insert into public.reviews (request_id, reviewer_id, reviewee_id, rating, comment, punctuality, respect, communication, fulfillment) values
  ('22222222-0000-0000-0000-000000000013', '11111111-0000-0000-0000-000000000001', '11111111-0000-0000-0000-000000000002', 5, 'Super atencioso e rápido. Recomendo!', 5, 5, 5, 5),
  ('22222222-0000-0000-0000-000000000013', '11111111-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000001', 5, 'Pessoa educada e clara no que precisava.', 5, 5, 5, 5),
  ('22222222-0000-0000-0000-000000000014', '11111111-0000-0000-0000-000000000006', '11111111-0000-0000-0000-000000000005', 4, 'Entregou direitinho, só atrasou um pouco.', 3, 5, 4, 5),
  ('22222222-0000-0000-0000-000000000014', '11111111-0000-0000-0000-000000000005', '11111111-0000-0000-0000-000000000006', 5, 'Tudo certo, muito gentil.', 5, 5, 5, 5);

-- ---------- Denúncia, notificações e analytics de exemplo ----------
insert into public.reports (reporter_id, reported_user_id, request_id, reason, description, priority)
values ('11111111-0000-0000-0000-000000000004', '11111111-0000-0000-0000-000000000006', null, 'FALSE_INFORMATION',
        'Denúncia de demonstração: informações do pedido não batiam com o combinado.', 2);

select public.create_notification('11111111-0000-0000-0000-000000000001', 'NEW_OFFER', 'Nova proposta', 'João quer ajudar com "Buscar uma encomenda".', '/pedido/22222222-0000-0000-0000-000000000001');
select public.create_notification('11111111-0000-0000-0000-000000000002', 'NEW_MATCH', 'Nova oportunidade de ajuda', 'Entregas perto de você — Niterói · Icaraí.', '/pedido/22222222-0000-0000-0000-000000000001');

insert into public.analytics_events (user_id, event, properties)
select requester_id, 'REQUEST_CREATED', jsonb_build_object('request_id', id) from public.help_requests where is_demo;

-- push_status das notificações demo não deve disparar envio real
update public.notifications set push_status = 'SKIPPED' where push_status = 'PENDING';
