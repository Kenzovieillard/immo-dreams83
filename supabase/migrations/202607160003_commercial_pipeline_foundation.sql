-- IMMO-DREAMS83 V3 phase 3
-- Commercial pipeline foundation: tasks, reminders, assignment and admin read policies.
-- Non destructive: no legacy data is removed or rewritten.

alter table tasks add column if not exists created_by uuid references profiles(id) on delete set null;
alter table tasks add column if not exists completed_by uuid references profiles(id) on delete set null;
alter table tasks add column if not exists task_type text not null default 'FOLLOW_UP';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'leads_priority_check') then
    alter table leads
      add constraint leads_priority_check
      check (priority in ('low', 'normal', 'high', 'urgent')) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'tasks_priority_check') then
    alter table tasks
      add constraint tasks_priority_check
      check (priority in ('low', 'normal', 'high', 'urgent')) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'tasks_task_type_check') then
    alter table tasks
      add constraint tasks_task_type_check
      check (task_type in ('FOLLOW_UP', 'CALL', 'EMAIL', 'APPOINTMENT', 'ADMIN')) not valid;
  end if;
end
$$;

create index if not exists leads_archived_status_idx on leads(archived, status);
create index if not exists leads_priority_idx on leads(priority);
create index if not exists tasks_lead_id_idx on tasks(lead_id);
create index if not exists tasks_completed_due_idx on tasks(completed_at, due_at);
create index if not exists tasks_assigned_to_idx on tasks(assigned_to);

drop policy if exists "Active admins can read leads" on leads;
create policy "Active admins can read leads"
  on leads for select to authenticated
  using (public.is_active_admin());

drop policy if exists "Active admins can read lead status history" on lead_status_history;
create policy "Active admins can read lead status history"
  on lead_status_history for select to authenticated
  using (public.is_active_admin());

drop policy if exists "Active admins can read tasks" on tasks;
create policy "Active admins can read tasks"
  on tasks for select to authenticated
  using (public.is_active_admin());

drop policy if exists "Active admins can read communications" on communications;
create policy "Active admins can read communications"
  on communications for select to authenticated
  using (public.is_active_admin());

drop policy if exists "Active admins can read appointments" on appointments;
create policy "Active admins can read appointments"
  on appointments for select to authenticated
  using (public.is_active_admin());
