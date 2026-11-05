-- Initial EldoradoCorp CRM schema. Applied to Supabase project bephigzcfsaltsexsimm.
create extension if not exists pgcrypto;
create table if not exists public.profiles (id uuid primary key references auth.users(id) on delete cascade, full_name text, email text, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.user_roles (user_id uuid primary key references auth.users(id) on delete cascade, role text not null default 'member' check (role in ('admin','member','reader')), created_at timestamptz not null default now());
create or replace function public.has_role(_role text) returns boolean language sql stable security definer set search_path = '' as $$ select exists (select 1 from public.user_roles where user_id = (select auth.uid()) and role = _role); $$;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path = '' as $$ select public.has_role('admin'); $$;
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$ begin insert into public.profiles(id,full_name,email) values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''),new.email) on conflict(id) do nothing; insert into public.user_roles(user_id,role) values(new.id,'member') on conflict(user_id) do nothing; return new; end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create table if not exists public.companies (id uuid primary key default gen_random_uuid(), name text not null, company_type text, cnpj text, website text, city text, state text, notes text, owner_id uuid not null default auth.uid() references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.contacts (id uuid primary key default gen_random_uuid(), company_id uuid references public.companies(id) on delete set null, full_name text not null, email text, phone text, position text, notes text, owner_id uuid not null default auth.uid() references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.properties (id uuid primary key default gen_random_uuid(), title text not null, asset_type text not null default 'terreno' check(asset_type in ('terreno','galpao','bts','shell','laje','outro')), status text not null default 'disponivel' check(status in ('disponivel','em_estudo','em_negociacao','reservado','vendido','locado')), municipality text, subregion text, address text, land_area_m2 numeric, built_area_m2 numeric, asking_price numeric, asking_rent numeric, zoning text, latitude double precision, longitude double precision, owner_name text, data_quality text not null default 'a_validar' check(data_quality in ('oficial','observado','estimativa','simulacao','a_validar')), source text, notes text, owner_id uuid not null default auth.uid() references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), constraint properties_coordinates_pair check((latitude is null and longitude is null) or (latitude between -90 and 90 and longitude between -180 and 180)));
create table if not exists public.opportunities (id uuid primary key default gen_random_uuid(), title text not null, company_id uuid references public.companies(id) on delete set null, contact_id uuid references public.contacts(id) on delete set null, property_id uuid references public.properties(id) on delete set null, stage text not null default 'lead' check(stage in ('lead','qualificacao','visita','proposta','negociacao','fechado','perdido')), deal_value numeric, probability numeric check(probability between 0 and 100), expected_close_date date, notes text, owner_id uuid not null default auth.uid() references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.tasks (id uuid primary key default gen_random_uuid(), title text not null, description text, due_at timestamptz, priority text not null default 'media' check(priority in ('baixa','media','alta','urgente')), completed boolean not null default false, opportunity_id uuid references public.opportunities(id) on delete set null, property_id uuid references public.properties(id) on delete set null, assigned_to uuid references auth.users(id) on delete set null, owner_id uuid not null default auth.uid() references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.viability_studies (id uuid primary key default gen_random_uuid(), property_id uuid references public.properties(id) on delete set null, title text not null, inputs jsonb not null default '{}'::jsonb, results jsonb not null default '{}'::jsonb, methodology text, score numeric, classification text not null default 'simulacao' check(classification in ('oficial','observado','estimativa','simulacao','a_validar')), owner_id uuid not null default auth.uid() references auth.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create table if not exists public.share_links (id uuid primary key default gen_random_uuid(), property_id uuid references public.properties(id) on delete cascade, opportunity_id uuid references public.opportunities(id) on delete cascade, token_hash text not null unique, expires_at timestamptz not null, revoked_at timestamptz, created_by uuid not null default auth.uid() references auth.users(id), created_at timestamptz not null default now(), constraint share_link_target check(num_nonnulls(property_id,opportunity_id)=1));
create table if not exists public.audit_log (id bigint generated always as identity primary key, actor_id uuid references auth.users(id) on delete set null, action text not null, table_name text not null, record_id text, details jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());

create index if not exists properties_owner_status_idx on public.properties(owner_id,status);
create index if not exists opportunities_owner_stage_idx on public.opportunities(owner_id,stage);
create index if not exists tasks_owner_due_idx on public.tasks(owner_id,due_at);
create index if not exists contacts_company_idx on public.contacts(company_id);

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.companies enable row level security;
alter table public.contacts enable row level security;
alter table public.properties enable row level security;
alter table public.opportunities enable row level security;
alter table public.tasks enable row level security;
alter table public.viability_studies enable row level security;
alter table public.share_links enable row level security;
alter table public.audit_log enable row level security;

drop policy if exists "profile read self or admin" on public.profiles;
create policy "profile read self or admin" on public.profiles for select to authenticated using(id=(select auth.uid()) or public.is_admin());
drop policy if exists "profile update self" on public.profiles;
create policy "profile update self" on public.profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
drop policy if exists "roles read self or admin" on public.user_roles;
create policy "roles read self or admin" on public.user_roles for select to authenticated using(user_id=(select auth.uid()) or public.is_admin());

do $$ declare t text; begin foreach t in array array['companies','contacts','properties','opportunities','tasks','viability_studies'] loop
 execute format('drop policy if exists %I on public.%I',t||'_select',t);
 execute format('create policy %I on public.%I for select to authenticated using(owner_id=(select auth.uid()) or public.is_admin())',t||'_select',t);
 execute format('drop policy if exists %I on public.%I',t||'_insert',t);
 execute format('create policy %I on public.%I for insert to authenticated with check((owner_id=(select auth.uid()) or public.is_admin()) and not public.has_role(''reader''))',t||'_insert',t);
 execute format('drop policy if exists %I on public.%I',t||'_update',t);
 execute format('create policy %I on public.%I for update to authenticated using((owner_id=(select auth.uid()) or public.is_admin()) and not public.has_role(''reader'')) with check((owner_id=(select auth.uid()) or public.is_admin()) and not public.has_role(''reader''))',t||'_update',t);
 execute format('drop policy if exists %I on public.%I',t||'_delete',t);
 execute format('create policy %I on public.%I for delete to authenticated using(public.is_admin())',t||'_delete',t);
end loop; end $$;

drop policy if exists "share links owner manage" on public.share_links;
create policy "share links owner manage" on public.share_links for all to authenticated using(created_by=(select auth.uid()) or public.is_admin()) with check((created_by=(select auth.uid()) or public.is_admin()) and expires_at>now());
drop policy if exists "audit admin read" on public.audit_log;
create policy "audit admin read" on public.audit_log for select to authenticated using(public.is_admin());
revoke all on public.user_roles from anon,authenticated;
grant select on public.user_roles to authenticated;
revoke all on public.audit_log from anon,authenticated;
grant select on public.audit_log to authenticated;
