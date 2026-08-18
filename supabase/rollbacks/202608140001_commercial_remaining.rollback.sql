-- Rollback du socle Commercial restant.
-- Les buckets ne sont retires que s'ils ne contiennent aucun objet.

drop function if exists public.create_commercial_offer(uuid, uuid, uuid, uuid, uuid, numeric, date, date, text, numeric, numeric, text, text, text, text, uuid, text);
drop function if exists public.submit_commercial_visit_report(uuid, text, text[], text[], integer, text, text, timestamptz, uuid, text);
drop function if exists public.update_commercial_visit(uuid, text, text, timestamptz, timestamptz, uuid, text);
drop function if exists public.create_commercial_visit(uuid, uuid, uuid, uuid, timestamptz, timestamptz, text, text, uuid, text);
drop function if exists public.transform_commercial_estimation(uuid, numeric, text, uuid, text);
drop function if exists public.create_commercial_case(uuid, text, uuid, uuid, uuid, text, text, text, uuid, text);
drop function if exists public.move_commercial_pipeline(uuid, text, uuid, text);

drop index if exists public.offers_visit_idx;
drop index if exists public.appointments_assigned_visit_status_idx;
drop index if exists public.appointments_visit_relations_idx;
drop index if exists public.estimations_assigned_status_idx;
drop index if exists public.estimations_contact_created_idx;
drop index if exists public.activities_actor_created_idx;
drop index if exists public.activities_entity_created_idx;

alter table public.appointments drop constraint if exists appointments_report_next_action_check;
alter table public.offer_documents drop constraint if exists offer_documents_version_check;
alter table public.offer_documents drop constraint if exists offer_documents_confidentiality_check;
alter table public.offer_documents drop constraint if exists offer_documents_status_check;
alter table public.offer_documents drop constraint if exists offer_documents_file_size_check;

alter table public.offer_documents
  drop column if exists version,
  drop column if exists confidentiality,
  drop column if exists document_status,
  drop column if exists file_size;
alter table public.activities
  drop column if exists metadata,
  drop column if exists actor_id;

delete from storage.buckets b
where b.id in ('estimation-reports', 'offer-documents')
  and not exists (select 1 from storage.objects o where o.bucket_id = b.id);
