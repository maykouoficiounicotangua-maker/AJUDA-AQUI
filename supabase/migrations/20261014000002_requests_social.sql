-- AJUDA AQUI — pedidos, propostas, bloqueios, favoritos, chat, avaliações, denúncias, disputas

-- ---------- PEDIDOS ----------
-- Só dados PÚBLICOS aqui. Endereço e coordenada exata ficam em help_request_private.
create table public.help_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  category_id uuid not null references public.categories (id),
  title text not null check (char_length(title) between 5 and 100),
  description text not null check (char_length(description) between 10 and 1000),
  help_type public.help_type not null default 'FREE',
  amount_cents integer check (amount_cents is null or amount_cents between 100 and 100000000),
  exchange_description text check (exchange_description is null or char_length(exchange_description) between 3 and 300),
  country_code char(2) not null default 'BR',
  state text not null check (char_length(state) between 2 and 60),
  city text not null check (char_length(city) between 2 and 120),
  neighborhood text check (neighborhood is null or char_length(neighborhood) <= 120),
  -- coordenada aproximada (arredondada ~1 km), segura para exibir/usar em matching
  public_latitude double precision check (public_latitude is null or public_latitude between -90 and 90),
  public_longitude double precision check (public_longitude is null or public_longitude between -180 and 180),
  scheduled_date date not null,
  scheduled_time time not null,
  duration_minutes integer not null default 60 check (duration_minutes between 5 and 1440),
  -- data/hora são locais ao pedido; o fuso permite validar no servidor (Brasil tem vários fusos)
  timezone text not null default 'America/Sao_Paulo' check (char_length(timezone) between 3 and 60),
  status public.request_status not null default 'DRAFT',
  -- se a conta do ajudante for excluída, vira NULL (o gatilho profiles_before_delete trata ajudas em andamento)
  selected_helper_id uuid references public.profiles (id) on delete set null,
  requester_confirmed_start boolean not null default false,
  helper_confirmed_start boolean not null default false,
  requester_confirmed_done boolean not null default false,
  helper_confirmed_done boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  expired_at timestamptz,
  -- consistência por tipo de ajuda
  check (
    (help_type = 'FREE' and amount_cents is null and exchange_description is null) or
    (help_type = 'PAID' and amount_cents is not null and exchange_description is null) or
    (help_type = 'EXCHANGE' and amount_cents is null and exchange_description is not null)
  ),
  check (selected_helper_id is null or selected_helper_id <> requester_id),
  -- estados em andamento exigem ajudante; COMPLETED pode ficar sem (histórico de conta excluída)
  check (
    selected_helper_id is not null or
    status in ('DRAFT', 'PUBLISHED', 'OPEN', 'CANCELLED', 'EXPIRED', 'COMPLETED')
  )
);
create index help_requests_status_idx on public.help_requests (status);
create index help_requests_category_idx on public.help_requests (category_id);
create index help_requests_requester_idx on public.help_requests (requester_id);
create index help_requests_helper_idx on public.help_requests (selected_helper_id);
create index help_requests_date_idx on public.help_requests (scheduled_date);
create index help_requests_city_idx on public.help_requests (state, city);
create index help_requests_created_idx on public.help_requests (created_at desc);
create index help_requests_open_feed_idx on public.help_requests (state, city, scheduled_date)
  where status = 'OPEN';
create trigger help_requests_touch before update on public.help_requests
  for each row execute function public.touch_updated_at();

create table public.help_request_private (
  request_id uuid primary key references public.help_requests (id) on delete cascade,
  address text check (address is null or char_length(address) <= 300),
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  notes text check (notes is null or char_length(notes) <= 500),
  updated_at timestamptz not null default now()
);
create trigger help_request_private_touch before update on public.help_request_private
  for each row execute function public.touch_updated_at();

-- ---------- PROPOSTAS ----------
create table public.help_request_offers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.help_requests (id) on delete cascade,
  helper_id uuid not null references public.profiles (id) on delete cascade,
  message text not null check (char_length(message) between 5 and 500),
  status public.offer_status not null default 'PENDING',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, helper_id)
);
create index offers_request_idx on public.help_request_offers (request_id);
create index offers_helper_idx on public.help_request_offers (helper_id);
create index offers_status_idx on public.help_request_offers (status);
-- No máximo UMA proposta aceita por pedido (concorrência).
create unique index offers_one_accepted_idx on public.help_request_offers (request_id) where status = 'ACCEPTED';
create trigger offers_touch before update on public.help_request_offers
  for each row execute function public.touch_updated_at();

-- ---------- BLOQUEIOS ----------
create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index blocks_blocked_idx on public.blocks (blocked_id);

create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

-- ---------- FAVORITOS ----------
create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  favorite_type text not null check (favorite_type in ('REQUEST', 'CATEGORY', 'USER')),
  request_id uuid references public.help_requests (id) on delete cascade,
  category_id uuid references public.categories (id) on delete cascade,
  target_user_id uuid references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (
    (favorite_type = 'REQUEST' and request_id is not null and category_id is null and target_user_id is null) or
    (favorite_type = 'CATEGORY' and category_id is not null and request_id is null and target_user_id is null) or
    (favorite_type = 'USER' and target_user_id is not null and request_id is null and category_id is null and target_user_id <> user_id)
  )
);
create unique index favorites_request_uq on public.favorites (user_id, request_id) where request_id is not null;
create unique index favorites_category_uq on public.favorites (user_id, category_id) where category_id is not null;
create unique index favorites_user_uq on public.favorites (user_id, target_user_id) where target_user_id is not null;

-- ---------- CHAT ----------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.help_requests (id) on delete cascade,
  status text not null default 'OPEN' check (status in ('OPEN', 'CLOSED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger conversations_touch before update on public.conversations
  for each row execute function public.touch_updated_at();

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index conversation_participants_user_idx on public.conversation_participants (user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  message_type text not null default 'TEXT' check (message_type in ('TEXT', 'SYSTEM')),
  content text not null check (char_length(content) between 1 and 2000),
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- SYSTEM nunca tem autor. TEXT pode ficar sem autor (sender_id vira NULL se a conta for excluída — LGPD);
  -- a RLS de INSERT já exige sender_id = auth.uid(), então ninguém cria TEXT anônimo.
  check (message_type = 'TEXT' or sender_id is null)
);
create index messages_conversation_created_idx on public.messages (conversation_id, created_at);
create index messages_unread_idx on public.messages (conversation_id) where read_at is null;

create or replace function public.is_conversation_participant(conv uuid, uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = conv and user_id = uid
  );
$$;

-- ---------- AVALIAÇÕES ----------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.help_requests (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete cascade,
  reviewee_id uuid not null references public.profiles (id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 500),
  punctuality smallint check (punctuality between 1 and 5),
  respect smallint check (respect between 1 and 5),
  communication smallint check (communication between 1 and 5),
  fulfillment smallint check (fulfillment between 1 and 5),
  created_at timestamptz not null default now(),
  unique (request_id, reviewer_id),
  check (reviewer_id <> reviewee_id)
);
create index reviews_reviewee_idx on public.reviews (reviewee_id, created_at desc);

-- ---------- DENÚNCIAS ----------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  reported_user_id uuid not null references public.profiles (id) on delete cascade,
  request_id uuid references public.help_requests (id) on delete set null,
  conversation_id uuid references public.conversations (id) on delete set null,
  reason text not null check (reason in (
    'INAPPROPRIATE_BEHAVIOR', 'SCAM_ATTEMPT', 'HARASSMENT', 'ILLEGAL_ACTIVITY',
    'FALSE_INFORMATION', 'THREAT', 'OTHER')),
  description text not null check (char_length(description) between 10 and 1000),
  status public.report_status not null default 'OPEN',
  priority smallint not null default 2 check (priority between 1 and 3), -- 1 alta, 3 baixa
  admin_notes text check (admin_notes is null or char_length(admin_notes) <= 1000),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (reporter_id <> reported_user_id)
);
create index reports_status_idx on public.reports (status, created_at desc);
create index reports_reported_idx on public.reports (reported_user_id);
create trigger reports_touch before update on public.reports
  for each row execute function public.touch_updated_at();

-- ---------- DISPUTAS ----------
create table public.disputes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.help_requests (id) on delete cascade,
  opened_by uuid not null references public.profiles (id) on delete cascade,
  reason text not null check (char_length(reason) between 3 and 100),
  description text not null check (char_length(description) between 10 and 1000),
  evidence_urls text[] not null default '{}' check (cardinality(evidence_urls) <= 5),
  status public.dispute_status not null default 'OPEN',
  resolution text check (resolution is null or char_length(resolution) <= 1000),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index disputes_status_idx on public.disputes (status, created_at desc);
create index disputes_request_idx on public.disputes (request_id);
create trigger disputes_touch before update on public.disputes
  for each row execute function public.touch_updated_at();

-- ---------- AUTORIZAÇÃO DE LEITURA CRUZADA ----------
-- O usuário e `uid` estão ligados por algum pedido/proposta?
create or replace function public.shares_context(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    exists (
      select 1 from public.help_request_offers o
      join public.help_requests r on r.id = o.request_id
      where (r.requester_id = auth.uid() and o.helper_id = uid)
         or (o.helper_id = auth.uid() and r.requester_id = uid)
    ) or exists (
      select 1 from public.help_requests r
      where (r.requester_id = auth.uid() and r.selected_helper_id = uid)
         or (r.selected_helper_id = auth.uid() and r.requester_id = uid)
    )
  );
$$;

create or replace function public.can_view_profile(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    uid = auth.uid()
    or public.is_admin()
    or (
      not public.is_blocked_between(auth.uid(), uid)
      and (
        exists (select 1 from public.profiles p
                where p.id = uid and p.status = 'ACTIVE' and p.profile_visibility = 'PUBLIC')
        or public.shares_context(uid)
      )
    )
  );
$$;

-- Telefone só para a contraparte de uma ajuda em andamento.
create or replace function public.can_see_contact(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    uid = auth.uid()
    or public.is_admin()
    or exists (
      select 1 from public.help_requests r
      where r.status in ('ASSIGNED', 'AWAITING_CONFIRMATION', 'IN_PROGRESS', 'COMPLETION_PENDING')
        and ((r.requester_id = auth.uid() and r.selected_helper_id = uid)
          or (r.selected_helper_id = auth.uid() and r.requester_id = uid))
    )
  );
$$;

-- O usuário participa deste pedido (solicitante ou ajudante selecionado)?
create or replace function public.is_request_party(req uuid, uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.help_requests
    where id = req and (requester_id = uid or selected_helper_id = uid)
  );
$$;
