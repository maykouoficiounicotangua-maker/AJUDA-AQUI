-- AJUDA AQUI — buckets de Storage (apenas em projetos Supabase; ignorado em Postgres puro)
do $$
begin
  if to_regclass('storage.buckets') is null then
    return;
  end if;

  -- Avatares: leitura pública, escrita só na própria pasta (<user_id>/arquivo)
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do nothing;

  -- Evidências de disputa: privado
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('evidence', 'evidence', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
  on conflict (id) do nothing;

  execute $p$ create policy "avatars_insert_own" on storage.objects for insert to authenticated
    with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text) $p$;
  execute $p$ create policy "avatars_update_own" on storage.objects for update to authenticated
    using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text) $p$;
  execute $p$ create policy "avatars_delete_own" on storage.objects for delete to authenticated
    using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text) $p$;
  execute $p$ create policy "evidence_insert_own" on storage.objects for insert to authenticated
    with check (bucket_id = 'evidence' and (storage.foldername(name))[1] = auth.uid()::text) $p$;
  execute $p$ create policy "evidence_select_own" on storage.objects for select to authenticated
    using (bucket_id = 'evidence' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())) $p$;
end $$;
