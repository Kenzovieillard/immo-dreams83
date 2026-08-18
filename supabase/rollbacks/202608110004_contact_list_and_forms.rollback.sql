drop index if exists public.contacts_list_filters_idx;
alter table public.contacts drop constraint if exists contacts_estimated_budget_check;
alter table public.contacts drop constraint if exists contacts_priority_check;
alter table public.contacts drop column if exists estimated_budget;
alter table public.contacts drop column if exists priority;
