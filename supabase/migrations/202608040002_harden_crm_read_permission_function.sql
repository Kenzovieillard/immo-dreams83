-- Harden the CRM read permission helper while keeping existing RLS policies compatible.
-- The historical name is_active_admin() is preserved because current policies call it.

create or replace function public.can_read_crm()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_active = true
      and role in (
        'ADMIN'::public.admin_role,
        'DIRECTOR'::public.admin_role,
        'AGENT'::public.admin_role,
        'ASSISTANT'::public.admin_role,
        'MARKETING'::public.admin_role,
        'READ_ONLY'::public.admin_role
      )
  );
$$;

comment on function public.can_read_crm() is
  'Returns true when the current JWT belongs to an active CRM profile with crm.read capability.';

create or replace function public.is_active_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_read_crm();
$$;

comment on function public.is_active_admin() is
  'Backward-compatible RLS helper. Historical name only; use can_read_crm() for new policies.';

revoke all on function public.can_read_crm() from public;
revoke all on function public.can_read_crm() from anon;
revoke all on function public.can_read_crm() from authenticated;
revoke all on function public.can_read_crm() from service_role;

revoke all on function public.is_active_admin() from public;
revoke all on function public.is_active_admin() from anon;
revoke all on function public.is_active_admin() from authenticated;
revoke all on function public.is_active_admin() from service_role;

grant execute on function public.can_read_crm() to authenticated, service_role;
grant execute on function public.is_active_admin() to authenticated, service_role;
