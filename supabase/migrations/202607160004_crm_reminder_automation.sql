-- IMMO-DREAMS83 V3 phase 3
-- Reminder automation preparation: recurrence, weekly planning and email reminder intent.
-- Non destructive: no existing task, lead or activity is removed.

alter table tasks add column if not exists recurrence_rule text not null default 'NONE';
alter table tasks add column if not exists reminder_channel text not null default 'NONE';
alter table tasks add column if not exists email_reminder_enabled boolean not null default false;
alter table tasks add column if not exists email_reminder_status text not null default 'NOT_SCHEDULED';
alter table tasks add column if not exists email_reminder_scheduled_at timestamptz;
alter table tasks add column if not exists email_reminder_sent_at timestamptz;
alter table tasks add column if not exists email_reminder_last_error text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'tasks_recurrence_rule_check') then
    alter table tasks
      add constraint tasks_recurrence_rule_check
      check (recurrence_rule in ('NONE', 'WEEKLY', 'MONTHLY')) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'tasks_reminder_channel_check') then
    alter table tasks
      add constraint tasks_reminder_channel_check
      check (reminder_channel in ('NONE', 'EMAIL')) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'tasks_email_reminder_status_check') then
    alter table tasks
      add constraint tasks_email_reminder_status_check
      check (email_reminder_status in ('NOT_SCHEDULED', 'PENDING', 'SENT', 'FAILED')) not valid;
  end if;
end
$$;

create index if not exists tasks_recurrence_rule_idx on tasks(recurrence_rule);
create index if not exists tasks_email_reminder_status_idx on tasks(email_reminder_status);
create index if not exists tasks_email_reminder_scheduled_at_idx on tasks(email_reminder_scheduled_at);
