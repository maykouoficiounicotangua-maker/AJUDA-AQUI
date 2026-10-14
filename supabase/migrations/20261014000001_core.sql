-- AJUDA AQUI — núcleo: enums, perfis, categorias, preferências de ajudante
-- Convenções: UUID, timestamptz (UTC), dinheiro em centavos, RLS em tudo (ver 0005).

-- ---------- ENUMS ----------
create type public.user_role as enum ('USER', 'ADMIN', 'MODERATOR', 'SUPER_ADMIN');
create type public.user_status as enum ('ACTIVE', 'SUSPENDED', 'BLOCKED', 'DELETED');
create type public.help_type as enum ('FREE', 'PAID', 'EXCHANGE');
create type public.request_status as enum (
  'DRAFT', 'PUBLISHED', 'OPEN', 'ASSIGNED', 'AWAITING_CONFIRMATION',
  'IN_PROGRESS', 'COMPLETION_PENDING', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'DISPUTED'
);
create type public.offer_status as enum ('PENDING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN', 'EXPIRED');
create type public.report_status as enum ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED');
create type public.dispute_status as enum ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED');

-- ---------- UTIL ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- PROFILES ----------
-- Senha NUNCA aqui (Supabase Auth). Telefone fica em profile_contacts (privado).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(full_name) between 2 and 120),
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 500),
  country_code char(2) not null default 'BR',
  state text check (state is null or char_length(state) between 2 and 60),
  city text check (city is null or char_length(city) between 2 and 120),
  neighborhood text check (neighborhood is null or char_length(neighborhood) <= 120),
  bio text check (bio is null or char_length(bio) <= 500),
  status public.user_status not null default 'ACTIVE',
  role public.user_role not null default 'USER',
  profile_visibility text not null default 'PUBLIC' check (profile_visibility in ('PUBLIC', 'PRIVATE')),
  show_rating boolean not null default true,
  show_help_count boolean not null default true,
  onboarding_completed boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_city_state_idx on public.profiles (state, city);
create index profiles_status_idx on public.profiles (status);
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

create table public.profile_contacts (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  phone text check (phone is null or phone ~ '^\+?[0-9 ()\-]{8,20}$'),
  updated_at timestamptz not null default now()
);
create trigger profile_contacts_touch before update on public.profile_contacts
  for each row execute function public.touch_updated_at();

-- ---------- HELPERS DE AUTORIZAÇÃO ----------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and status = 'ACTIVE' and role in ('ADMIN', 'SUPER_ADMIN')
  );
$$;

create or replace function public.is_active_user(uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = uid and status = 'ACTIVE');
$$;

-- ---------- CATEGORIAS ----------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 2 and 60),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  icon text not null default 'HandHelping',
  description text check (description is null or char_length(description) <= 300),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger categories_touch before update on public.categories
  for each row execute function public.touch_updated_at();

insert into public.categories (name, slug, icon, description) values
  ('Compras', 'compras', 'ShoppingBasket', 'Ajuda para fazer compras'),
  ('Entregas', 'entregas', 'PackageCheck', 'Buscar ou levar encomendas'),
  ('Animais', 'animais', 'PawPrint', 'Cuidados com pets'),
  ('Tecnologia', 'tecnologia', 'Laptop', 'Computador, internet e aplicativos'),
  ('Estudos', 'estudos', 'GraduationCap', 'Reforço e orientação nos estudos'),
  ('Casa', 'casa', 'Home', 'Organização e tarefas da casa'),
  ('Pequenos reparos', 'pequenos-reparos', 'Wrench', 'Consertos simples'),
  ('Acompanhamento', 'acompanhamento', 'Users', 'Companhia e acompanhamento'),
  ('Transporte', 'transporte', 'Car', 'Caronas e deslocamentos'),
  ('Documentos', 'documentos', 'FileText', 'Ajuda com papelada e documentos'),
  ('Celular', 'celular', 'Smartphone', 'Configuração e uso do celular'),
  ('Outros', 'outros', 'MoreHorizontal', 'Outras ajudas');

create table public.user_categories (
  user_id uuid not null references public.profiles (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, category_id)
);
create index user_categories_category_idx on public.user_categories (category_id);

-- ---------- PREFERÊNCIAS DE QUEM QUER AJUDAR ----------
create table public.helper_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  description text check (description is null or char_length(description) <= 500),
  country_code char(2) not null default 'BR',
  state text,
  city text,
  neighborhood text,
  latitude double precision check (latitude is null or latitude between -90 and 90),
  longitude double precision check (longitude is null or longitude between -180 and 180),
  max_distance_km integer not null default 15 check (max_distance_km between 1 and 500),
  accepts_paid boolean not null default true,
  accepts_free boolean not null default true,
  accepts_exchange boolean not null default true,
  -- 0 = domingo ... 6 = sábado
  available_days smallint[] not null default '{0,1,2,3,4,5,6}',
  availability_start time not null default '08:00',
  availability_end time not null default '20:00',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (available_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  check (availability_end > availability_start)
);
create index helper_preferences_city_idx on public.helper_preferences (state, city) where active;
create trigger helper_preferences_touch before update on public.helper_preferences
  for each row execute function public.touch_updated_at();

-- ---------- CONSENTIMENTOS (LGPD, versionados) ----------
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  terms_version text not null,
  privacy_version text not null,
  safety_version text not null,
  accepted_at timestamptz not null default now(),
  unique (user_id, terms_version, privacy_version, safety_version)
);
create index consents_user_idx on public.consents (user_id, accepted_at desc);
