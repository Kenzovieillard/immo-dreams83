-- Validate existing CRM CHECK constraints that were introduced as NOT VALID.
-- No business data is modified by this migration.

set lock_timeout = '5s';
set statement_timeout = '30s';

alter table public.contacts validate constraint contacts_contact_role_check;
alter table public.contacts validate constraint contacts_qualification_status_check;
alter table public.contacts validate constraint contacts_qualification_source_check;

alter table public.leads validate constraint leads_priority_check;

alter table public.tasks validate constraint tasks_priority_check;
alter table public.tasks validate constraint tasks_task_type_check;
alter table public.tasks validate constraint tasks_recurrence_rule_check;
alter table public.tasks validate constraint tasks_reminder_channel_check;
alter table public.tasks validate constraint tasks_email_reminder_status_check;
