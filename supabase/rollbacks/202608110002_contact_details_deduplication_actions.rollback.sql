-- Roll back the contact-detail fields and merge RPC introduced by 202608110002.
-- Historical merges cannot be reversed automatically; lead_merge_logs remains the audit source.

set lock_timeout = '5s';
set statement_timeout = '30s';

drop function if exists public.merge_crm_contacts(uuid, uuid, uuid, text, text);
drop index if exists public.contacts_duplicate_review_idx;
drop index if exists public.contacts_assigned_to_idx;

alter table contacts drop constraint if exists contacts_interest_score_check;
alter table contacts drop column if exists interest_score;
alter table contacts drop column if exists current_residence;
alter table contacts drop column if exists profession;
alter table contacts drop column if exists personal_situation;
alter table contacts drop column if exists contact_preference;
alter table contacts drop column if exists postal_code;
alter table contacts drop column if exists address;
alter table contacts drop column if exists assigned_to;
