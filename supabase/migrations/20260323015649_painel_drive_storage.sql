insert into storage.buckets (id, name, public, file_size_limit)
values ('painel-drive', 'painel-drive', false, 52428800)
on conflict (id) do update set file_size_limit = excluded.file_size_limit;

drop policy if exists "painel_drive_anon_select" on storage.objects;
drop policy if exists "painel_drive_anon_insert" on storage.objects;
drop policy if exists "painel_drive_anon_update" on storage.objects;
drop policy if exists "painel_drive_anon_delete" on storage.objects;

create policy "painel_drive_anon_select"
on storage.objects for select
to anon
using (bucket_id = 'painel-drive');

create policy "painel_drive_anon_insert"
on storage.objects for insert
to anon
with check (bucket_id = 'painel-drive');

create policy "painel_drive_anon_update"
on storage.objects for update
to anon
using (bucket_id = 'painel-drive')
with check (bucket_id = 'painel-drive');

create policy "painel_drive_anon_delete"
on storage.objects for delete
to anon
using (bucket_id = 'painel-drive');
