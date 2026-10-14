-- AJUDA AQUI — Row Level Security + grants por coluna
-- Princípio: negar tudo por padrão; liberar o mínimo. Escritas críticas só via RPC (ver 0004).
-- Funções auxiliares são SECURITY DEFINER para evitar recursão entre políticas.

-- ---------- AUXILIARES DE POLÍTICA ----------
create or replace function public.owns_request(req uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.help_requests where id = req and requester_id = auth.uid());
$$;

create or replace function public.has_offer_on(req uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.help_request_offers where request_id = req and helper_id = auth.uid());
$$;

-- Endereço/coordenada exata: dono do pedido; ajudante só depois de CONFIRMAR sua participação.
create or replace function public.can_see_private_location(req uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.help_requests r
    where r.id = req and (
      r.requester_id = auth.uid()
      or (r.selected_helper_id = auth.uid()
          and r.helper_confirmed_start
          and r.status in ('AWAITING_CONFIRMATION', 'IN_PROGRESS', 'COMPLETION_PENDING'))
    )
  );
$$;

-- Admin só lê conversa vinculada a denúncia ou disputa.
create or replace function public.admin_can_read_conversation(conv uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() and exists (
    select 1 from public.conversations c
    where c.id = conv and (
      exists (select 1 from public.reports rp where rp.conversation_id = c.id or rp.request_id = c.request_id)
      or exists (select 1 from public.disputes d where d.request_id = c.request_id)
    )
  );
$$;

grant execute on function
  public.owns_request(uuid), public.has_offer_on(uuid), public.can_see_private_location(uuid),
  public.admin_can_read_conversation(uuid)
to authenticated;

-- ---------- GRANTS: começa fechado ----------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

-- ---------- ENABLE RLS ----------
alter table public.profiles enable row level security;
alter table public.profile_contacts enable row level security;
alter table public.categories enable row level security;
alter table public.user_categories enable row level security;
alter table public.helper_preferences enable row level security;
alter table public.consents enable row level security;
alter table public.help_requests enable row level security;
alter table public.help_request_private enable row level security;
alter table public.help_request_offers enable row level security;
alter table public.blocks enable row level security;
alter table public.favorites enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;
alter table public.reviews enable row level security;
alter table public.reports enable row level security;
alter table public.disputes enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.audit_logs enable row level security;
alter table public.analytics_events enable row level security;
alter table public.rate_limit_events enable row level security; -- sem políticas: só funções SECURITY DEFINER

-- ---------- PROFILES ----------
grant select on public.profiles to authenticated;
grant update (full_name, avatar_url, country_code, state, city, neighborhood, bio,
              profile_visibility, show_rating, show_help_count, onboarding_completed)
  on public.profiles to authenticated;      -- role/status/is_demo NÃO são editáveis pelo usuário
create policy profiles_select on public.profiles for select to authenticated
  using (public.can_view_profile(id));
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid() and status = 'ACTIVE') with check (id = auth.uid());

-- ---------- PROFILE CONTACTS (telefone) ----------
grant select on public.profile_contacts to authenticated;
grant update (phone) on public.profile_contacts to authenticated;
create policy contacts_select on public.profile_contacts for select to authenticated
  using (public.can_see_contact(user_id));
create policy contacts_update_own on public.profile_contacts for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- CATEGORIES ----------
grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;
create policy categories_select on public.categories for select to anon, authenticated
  using (active or public.is_admin());
create policy categories_admin_insert on public.categories for insert to authenticated
  with check (public.is_admin());
create policy categories_admin_update on public.categories for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy categories_admin_delete on public.categories for delete to authenticated
  using (public.is_admin());

-- ---------- USER CATEGORIES ----------
grant select, insert, delete on public.user_categories to authenticated;
create policy user_categories_select on public.user_categories for select to authenticated
  using (user_id = auth.uid() or public.can_view_profile(user_id));
create policy user_categories_insert on public.user_categories for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_user());
create policy user_categories_delete on public.user_categories for delete to authenticated
  using (user_id = auth.uid());

-- ---------- HELPER PREFERENCES ----------
grant select, insert, update, delete on public.helper_preferences to authenticated;
create policy helper_prefs_select on public.helper_preferences for select to authenticated
  using (user_id = auth.uid() or (active and public.can_view_profile(user_id)));
create policy helper_prefs_insert on public.helper_preferences for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_user());
create policy helper_prefs_update on public.helper_preferences for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy helper_prefs_delete on public.helper_preferences for delete to authenticated
  using (user_id = auth.uid());

-- ---------- CONSENTS ----------
grant select, insert on public.consents to authenticated;
create policy consents_select on public.consents for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy consents_insert on public.consents for insert to authenticated
  with check (user_id = auth.uid());

-- ---------- HELP REQUESTS ----------
grant select, delete on public.help_requests to authenticated;
grant insert (requester_id, category_id, title, description, help_type, amount_cents, exchange_description,
              country_code, state, city, neighborhood, public_latitude, public_longitude,
              scheduled_date, scheduled_time, duration_minutes, timezone)
  on public.help_requests to authenticated;
grant update (category_id, title, description, help_type, amount_cents, exchange_description,
              country_code, state, city, neighborhood, public_latitude, public_longitude,
              scheduled_date, scheduled_time, duration_minutes, timezone)
  on public.help_requests to authenticated;     -- status e selected_helper_id só via RPC
create policy requests_select on public.help_requests for select to authenticated
  using (
    requester_id = auth.uid()
    or selected_helper_id = auth.uid()
    or public.is_admin()
    or public.has_offer_on(id)
    or (status = 'OPEN'
        and public.is_active_user(requester_id)
        and not public.is_blocked_between(auth.uid(), requester_id))
  );
create policy requests_insert on public.help_requests for insert to authenticated
  with check (requester_id = auth.uid() and status = 'DRAFT' and public.is_active_user());
create policy requests_update on public.help_requests for update to authenticated
  using (requester_id = auth.uid() and status in ('DRAFT', 'OPEN') and public.is_active_user())
  with check (requester_id = auth.uid() and status in ('DRAFT', 'OPEN'));
create policy requests_delete_draft on public.help_requests for delete to authenticated
  using (requester_id = auth.uid() and status = 'DRAFT');

-- ---------- HELP REQUEST PRIVATE (endereço) ----------
grant select, insert, update on public.help_request_private to authenticated;
create policy request_private_select on public.help_request_private for select to authenticated
  using (public.can_see_private_location(request_id));
create policy request_private_insert on public.help_request_private for insert to authenticated
  with check (public.owns_request(request_id));
create policy request_private_update on public.help_request_private for update to authenticated
  using (public.owns_request(request_id)) with check (public.owns_request(request_id));

-- ---------- OFFERS (escrita só via RPC) ----------
grant select on public.help_request_offers to authenticated;
create policy offers_select on public.help_request_offers for select to authenticated
  using (helper_id = auth.uid() or public.owns_request(request_id) or public.is_admin());

-- ---------- BLOCKS ----------
grant select, insert, delete on public.blocks to authenticated;
create policy blocks_select on public.blocks for select to authenticated
  using (blocker_id = auth.uid() or public.is_admin());
create policy blocks_insert on public.blocks for insert to authenticated
  with check (blocker_id = auth.uid() and public.is_active_user());
create policy blocks_delete on public.blocks for delete to authenticated
  using (blocker_id = auth.uid());

-- ---------- FAVORITES ----------
grant select, insert, delete on public.favorites to authenticated;
create policy favorites_select on public.favorites for select to authenticated using (user_id = auth.uid());
create policy favorites_insert on public.favorites for insert to authenticated
  with check (user_id = auth.uid() and public.is_active_user());
create policy favorites_delete on public.favorites for delete to authenticated using (user_id = auth.uid());

-- ---------- CHAT ----------
grant select on public.conversations, public.conversation_participants to authenticated;
create policy conversations_select on public.conversations for select to authenticated
  using (public.is_conversation_participant(id) or public.admin_can_read_conversation(id));
create policy participants_select on public.conversation_participants for select to authenticated
  using (user_id = auth.uid() or public.is_conversation_participant(conversation_id)
         or public.admin_can_read_conversation(conversation_id));

grant select on public.messages to authenticated;
grant insert (conversation_id, sender_id, message_type, content) on public.messages to authenticated;
grant update (read_at) on public.messages to authenticated;
create policy messages_select on public.messages for select to authenticated
  using (public.is_conversation_participant(conversation_id) or public.admin_can_read_conversation(conversation_id));
create policy messages_insert on public.messages for insert to authenticated
  with check (sender_id = auth.uid() and message_type = 'TEXT' and public.can_send_message(conversation_id));
create policy messages_mark_read on public.messages for update to authenticated
  using (public.is_conversation_participant(conversation_id) and sender_id is distinct from auth.uid())
  with check (public.is_conversation_participant(conversation_id) and sender_id is distinct from auth.uid());

-- ---------- REVIEWS (escrita só via RPC) ----------
grant select on public.reviews to authenticated;
create policy reviews_select on public.reviews for select to authenticated
  using (
    reviewer_id = auth.uid() or reviewee_id = auth.uid() or public.is_admin()
    or (public.can_view_profile(reviewee_id)
        and exists (select 1 from public.profiles p where p.id = reviewee_id and p.show_rating))
  );

-- ---------- REPORTS / DISPUTES (escrita só via RPC) ----------
grant select on public.reports, public.disputes to authenticated;
create policy reports_select on public.reports for select to authenticated
  using (reporter_id = auth.uid() or public.is_admin());
create policy disputes_select on public.disputes for select to authenticated
  using (opened_by = auth.uid() or public.is_request_party(request_id) or public.is_admin());

-- ---------- NOTIFICATIONS ----------
grant select, delete on public.notifications to authenticated;
grant update (read, read_at) on public.notifications to authenticated;
create policy notifications_select on public.notifications for select to authenticated using (user_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete on public.notifications for delete to authenticated using (user_id = auth.uid());

grant select on public.notification_preferences to authenticated;
grant update (in_app_enabled, push_enabled, pref_matches, pref_messages, pref_offers,
              pref_requests, pref_reviews, pref_system)
  on public.notification_preferences to authenticated;
create policy notif_prefs_select on public.notification_preferences for select to authenticated using (user_id = auth.uid());
create policy notif_prefs_update on public.notification_preferences for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------- PUSH SUBSCRIPTIONS (criação via RPC upsert_push_subscription) ----------
grant select, delete on public.push_subscriptions to authenticated;
grant update (is_active) on public.push_subscriptions to authenticated;
create policy push_select on public.push_subscriptions for select to authenticated using (user_id = auth.uid());
create policy push_update on public.push_subscriptions for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy push_delete on public.push_subscriptions for delete to authenticated using (user_id = auth.uid());

-- ---------- AUDIT / ANALYTICS ----------
grant select on public.audit_logs to authenticated;
create policy audit_select on public.audit_logs for select to authenticated using (public.is_admin());

grant select on public.analytics_events to authenticated;
grant insert (user_id, event, properties) on public.analytics_events to authenticated;
create policy analytics_select on public.analytics_events for select to authenticated using (public.is_admin());
create policy analytics_insert on public.analytics_events for insert to authenticated
  with check (user_id = auth.uid() and event in ('REQUEST_VIEWED', 'LOGIN'));

-- ---------- VIEWS ----------
grant select on public.profile_stats to authenticated;

-- ---------- REALTIME ----------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.messages, public.notifications, public.conversations;
  end if;
end $$;
