-- Destructive rollback: back up negotiation data before use.
do $$
declare scheduled_job_id bigint;
begin
  select jobid into scheduled_job_id from cron.job where jobname = 'refresh-negotiation-alerts-hourly-guard';
  if scheduled_job_id is not null then
    perform cron.unschedule(scheduled_job_id);
  end if;
end
$$;
drop view if exists public.v_negotiation_alerts;
drop view if exists public.v_negotiations_kpi;
drop trigger if exists negotiations_sync_offer on public.negotiations;
drop trigger if exists negotiation_steps_sync_parent on public.negotiation_steps;
drop trigger if exists offers_create_negotiation on public.offers;
drop trigger if exists negotiations_prepare_metrics on public.negotiations;
drop function if exists public.refresh_negotiation_alerts();
drop function if exists public.sync_offer_from_negotiation();
drop function if exists public.decide_negotiation(uuid, text, text, uuid, text);
drop function if exists public.add_negotiation_proposal(uuid, numeric, text, text, date, uuid, text);
drop function if exists public.sync_negotiation_from_step();
drop function if exists public.create_negotiation_from_offer();
drop function if exists public.prepare_negotiation_metrics();
drop table if exists public.negotiation_alert_events;
drop table if exists public.negotiation_documents;
drop table if exists public.negotiation_exchanges;
drop table if exists public.negotiation_steps;
drop table if exists public.negotiations;
delete from storage.buckets where id = 'negotiation-documents';
