-- Restrictive role gate: authenticated accounts without an explicit CRM role see no public-schema CRM data.
-- Readers may select only; members and admins may insert/update; existing policies continue to define ownership and admin-only deletes.
drop policy if exists "crm_authorized_access_gate" on public.activities;
create policy "crm_authorized_access_gate" on public.activities
as restrictive for all to authenticated
using (private.has_role('admin') or private.has_role('member') or private.has_role('reader'))
with check (private.has_role('admin') or private.has_role('member'));

drop policy if exists "crm_authorized_access_gate" on public.area_restrictions;
create policy "crm_authorized_access_gate" on public.area_restrictions
as restrictive for all to authenticated
using (private.has_role('admin') or private.has_role('member') or private.has_role('reader'))
with check (private.has_role('admin') or private.has_role('member'));

drop policy if exists "crm_authorized_access_gate" on public.areas;
create policy "crm_authorized_access_gate" on public.areas
as restrictive for all to authenticated
using (private.has_role('admin') or private.has_role('member') or private.has_role('reader'))
with check (private.has_role('admin') or private.has_role('member'));

drop policy if exists "crm_authorized_access_gate" on public.audit_log;
create policy "crm_authorized_access_gate" on public.audit_log
as restrictive for all to authenticated
using (private.has_role('admin') or private.has_role('member') or private.has_role('reader'))
with check (private.has_role('admin') or private.has_role('member'));

drop policy if exists "crm_authorized_access_gate" on public.companies;
create policy "crm_authorized_access_gate" on public.companies
as restrictive for all to authenticated
using (private.has_role('admin') or private.has_role('member') or private.has_role('reader'))
with check (private.has_role('admin') or private.has_role('member'));

drop policy if exists "crm_authorized_access_gate" on public.contacts;
create policy "crm_authorized_access_gate" on public.contacts
as restrictive for all to authenticated
using (private.has_role('admin') or private.has_role('member') or private.has_role('reader'))
with check (private.has_role('admin') or private.has_role('member'));

drop policy if exists "crm_authorized_access_gate" on public.ibge_cities;
create policy "crm_authorized_access_gate" on public.ibge_cities
as restrictive for all to authenticated
using (private.has_role('admin') or private.has_role('member') or private.has_role('reader'))
with check (private.has_role('admin') or private.has_role('member'));

drop policy if exists "crm_authorized_access_gate" on public.market_news;
create policy "crm_authorized_access_gate" on public.market_news
as restrictive for all to authenticated
using (private.has_role('admin') or private.has_role('member') or private.has_role('reader'))
with check (private.has_role('admin') or private.has_role('member'));

drop policy if exists "crm_authorized_access_gate" on public.media;
create policy "crm_authorized_access_gate" on public.media
as restrictive for all to authenticated
using (private.has_role('admin') or private.has_role('member') or private.has_role('reader'))
with check (private.has_role('admin') or private.has_role('member'));

drop policy if exists "crm_authorized_access_gate" on public.opportunities;
create policy "crm_authorized_access_gate" on public.opportunities
as restrictive for all to authenticated
using (private.has_role('admin') or private.has_role('member') or private.has_role('reader'))
with check (private.has_role('admin') or private.has_role('member'));

drop policy if exists "crm_authorized_access_gate" on public.profiles;
create policy "crm_authorized_access_gate" on public.profiles
as restrictive for all to authenticated
using (private.has_role('admin') or private.has_role('member') or private.has_role('reader'))
with check (private.has_role('admin') or private.has_role('member'));

drop policy if exists "crm_authorized_access_gate" on public.properties;
create policy "crm_authorized_access_gate" on public.properties
as restrictive for all to authenticated
using (private.has_role('admin') or private.has_role('member') or private.has_role('reader'))
with check (private.has_role('admin') or private.has_role('member'));

drop policy if exists "crm_authorized_access_gate" on public.share_links;
create policy "crm_authorized_access_gate" on public.share_links
as restrictive for all to authenticated
using (private.has_role('admin') or private.has_role('member') or private.has_role('reader'))
with check (private.has_role('admin') or private.has_role('member'));

drop policy if exists "crm_authorized_access_gate" on public.tasks;
create policy "crm_authorized_access_gate" on public.tasks
as restrictive for all to authenticated
using (private.has_role('admin') or private.has_role('member') or private.has_role('reader'))
with check (private.has_role('admin') or private.has_role('member'));

drop policy if exists "crm_authorized_access_gate" on public.terrain_analyses;
create policy "crm_authorized_access_gate" on public.terrain_analyses
as restrictive for all to authenticated
using (private.has_role('admin') or private.has_role('member') or private.has_role('reader'))
with check (private.has_role('admin') or private.has_role('member'));

drop policy if exists "crm_authorized_access_gate" on public.user_roles;
create policy "crm_authorized_access_gate" on public.user_roles
as restrictive for all to authenticated
using (private.has_role('admin') or private.has_role('member') or private.has_role('reader'))
with check (private.has_role('admin') or private.has_role('member'));
