-- CakeBoss · Fase 7 · Fotos no Storage e importação dos dados trazidos do navegador

-- Fotos públicas da vitrine (produtos, logo, banner). Caminho: <workspace_id>/<arquivo>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('store-media', 'store-media', true, 3 * 1024 * 1024, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "membros enviam fotos da própria confeitaria" on storage.objects for insert to authenticated
  with check (bucket_id = 'store-media' and private.is_member(((storage.foldername(name))[1])::uuid));
create policy "membros trocam fotos da própria confeitaria" on storage.objects for update to authenticated
  using (bucket_id = 'store-media' and private.is_member(((storage.foldername(name))[1])::uuid));
create policy "gestores apagam fotos da própria confeitaria" on storage.objects for delete to authenticated
  using (bucket_id = 'store-media' and private.is_manager(((storage.foldername(name))[1])::uuid));

-- O painel chama uma vez, logo após criar a conta com dados do navegador
create or replace function public.import_my_workspace_data(ws uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r jsonb;
begin
  if not private.is_manager(ws) then raise exception 'forbidden' using errcode = '42501'; end if;
  if exists (select 1 from public.workspace_data where workspace_id = ws and imported_at is not null) then return null; end if;
  r := private.import_workspace_blob(ws);
  update public.workspace_data set imported_at = now() where workspace_id = ws;
  return r;
end;
$$;
revoke all on function public.import_my_workspace_data(uuid) from public, anon;
grant execute on function public.import_my_workspace_data(uuid) to authenticated;
