-- Complete the contact list and manual forms without changing existing records.

alter table public.contacts
  add column if not exists estimated_budget numeric(12, 2),
  add column if not exists priority text not null default 'normal';

alter table public.contacts
  drop constraint if exists contacts_estimated_budget_check,
  add constraint contacts_estimated_budget_check
    check (estimated_budget is null or estimated_budget >= 0) not valid,
  drop constraint if exists contacts_priority_check,
  add constraint contacts_priority_check
    check (priority in ('low', 'normal', 'high', 'urgent')) not valid;

alter table public.contacts validate constraint contacts_estimated_budget_check;
alter table public.contacts validate constraint contacts_priority_check;

create index if not exists contacts_list_filters_idx
  on public.contacts (archived, assigned_to, contact_source, priority, updated_at desc);
