-- Safe rollback for 202608040002.
-- Restores the previous active-profile semantics while keeping anon RPC execution closed.

begin;

create or replace function public.is_active_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from profiles
    where id = auth.uid()
      and is_active = true
  );
$$;

comment on function public.is_active_admin() is
  'Backward-compatible RLS helper restored to the previous active-profile semantics.';

drop function if exists public.can_read_crm();

revoke all on function public.is_active_admin() from public;
revoke all on function public.is_active_admin() from anon;
revoke all on function public.is_active_admin() from authenticated;
revoke all on function public.is_active_admin() from service_role;
grant execute on function public.is_active_admin() to authenticated, service_role;

commit;
