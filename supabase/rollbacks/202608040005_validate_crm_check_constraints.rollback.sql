-- Rollback for 202608040005.
-- PostgreSQL has no direct "unvalidate constraint" command. This rollback
-- recreates the same CHECK constraints as NOT VALID without changing data.

begin;

alter table public.contacts drop constraint if exists contacts_contact_role_check;
alter table public.contacts
  add constraint contacts_contact_role_check
  check (contact_role in ('UNKNOWN', 'BUYER', 'SELLER', 'BOTH', 'OTHER')) not valid;

alter table public.contacts drop constraint if exists contacts_qualification_status_check;
alter table public.contacts
  add constraint contacts_qualification_status_check
  check (qualification_status in ('TO_REVIEW', 'QUALIFIED', 'DUPLICATE', 'NO_CONTACT', 'INACTIVE')) not valid;

alter table public.contacts drop constraint if exists contacts_qualification_source_check;
alter table public.contacts
  add constraint contacts_qualification_source_check
  check (qualification_source in ('AUTO', 'MANUAL')) not valid;

alter table public.leads drop constraint if exists leads_priority_check;
alter table public.leads
  add constraint leads_priority_check
  check (priority in ('low', 'normal', 'high', 'urgent')) not valid;

alter table public.tasks drop constraint if exists tasks_priority_check;
alter table public.tasks
  add constraint tasks_priority_check
  check (priority in ('low', 'normal', 'high', 'urgent')) not valid;

alter table public.tasks drop constraint if exists tasks_task_type_check;
alter table public.tasks
  add constraint tasks_task_type_check
  check (task_type in ('FOLLOW_UP', 'CALL', 'EMAIL', 'APPOINTMENT', 'ADMIN')) not valid;

alter table public.tasks drop constraint if exists tasks_recurrence_rule_check;
alter table public.tasks
  add constraint tasks_recurrence_rule_check
  check (recurrence_rule in ('NONE', 'WEEKLY', 'MONTHLY')) not valid;

alter table public.tasks drop constraint if exists tasks_reminder_channel_check;
alter table public.tasks
  add constraint tasks_reminder_channel_check
  check (reminder_channel in ('NONE', 'EMAIL')) not valid;

alter table public.tasks drop constraint if exists tasks_email_reminder_status_check;
alter table public.tasks
  add constraint tasks_email_reminder_status_check
  check (email_reminder_status in ('NOT_SCHEDULED', 'PENDING', 'SENT', 'FAILED')) not valid;

commit;
