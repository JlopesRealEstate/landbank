-- Enforce CRM role membership directly at the private Storage boundary.
drop policy if exists "landbank files authenticated read" on storage.objects;
drop policy if exists "landbank files authenticated upload" on storage.objects;
drop policy if exists "landbank files authenticated update" on storage.objects;
drop policy if exists "landbank files admin delete" on storage.objects;

create policy "landbank files authorized read"
on storage.objects for select to authenticated
using (
  bucket_id = 'landbank-files'
  and exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role in ('admin', 'member', 'reader')
  )
);

create policy "landbank files editor upload"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'landbank-files'
  and exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role in ('admin', 'member')
  )
);

create policy "landbank files editor update"
on storage.objects for update to authenticated
using (
  bucket_id = 'landbank-files'
  and exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role in ('admin', 'member')
  )
)
with check (
  bucket_id = 'landbank-files'
  and exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role in ('admin', 'member')
  )
);

create policy "landbank files admin delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'landbank-files'
  and exists (
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role = 'admin'
  )
);
