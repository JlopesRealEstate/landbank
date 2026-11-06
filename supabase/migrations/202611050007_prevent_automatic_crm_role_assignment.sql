-- New Supabase Auth users must not receive CRM access automatically.
-- Only the administrator invitation endpoint may insert/update public.user_roles.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.email)
  on conflict (id) do nothing;

  -- Intentionally do not create a user_roles row here.
  -- A CRM role is granted only by the authenticated administrator invitation workflow.
  return new;
end;
$function$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
