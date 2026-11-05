-- Private file storage for Land Bank media (photos, KMZ and documents).
alter table public.media add column if not exists storage_path text;
create index if not exists media_storage_path_idx on public.media(storage_path);
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('landbank-files','landbank-files',false,9437184,array[
'image/jpeg','image/png','image/webp','application/pdf',
'application/vnd.google-earth.kmz','application/vnd.google-earth.kml+xml',
'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
'application/zip','text/plain'])
on conflict (id) do update set public=false,file_size_limit=9437184,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "landbank files authenticated read" on storage.objects;
create policy "landbank files authenticated read" on storage.objects for select to authenticated using(bucket_id='landbank-files');
drop policy if exists "landbank files authenticated upload" on storage.objects;
create policy "landbank files authenticated upload" on storage.objects for insert to authenticated with check(bucket_id='landbank-files' and not private.has_role('reader'));
drop policy if exists "landbank files authenticated update" on storage.objects;
create policy "landbank files authenticated update" on storage.objects for update to authenticated using(bucket_id='landbank-files' and not private.has_role('reader')) with check(bucket_id='landbank-files' and not private.has_role('reader'));
drop policy if exists "landbank files admin delete" on storage.objects;
create policy "landbank files admin delete" on storage.objects for delete to authenticated using(bucket_id='landbank-files' and private.is_admin());
