-- Rollback explicite de la migration Commercial Figma.
-- A utiliser uniquement apres sauvegarde: les colonnes ci-dessous peuvent contenir des donnees metier.

drop view if exists public.v_commercial_visit_week_stats;
drop view if exists public.v_commercial_estimation_stats;
drop view if exists public.v_commercial_pipeline_stats;

drop table if exists public.offer_exchanges;
drop table if exists public.offer_negotiation_steps;

alter table public.offers
  drop column if exists estimated_interest_rate,
  drop column if exists loan_duration_years,
  drop column if exists asking_price;

alter table public.appointments
  drop column if exists satisfaction_rating,
  drop column if exists report_submitted_at,
  drop column if exists report_next_action,
  drop column if exists additional_comments,
  drop column if exists interest_level,
  drop column if exists blocking_points,
  drop column if exists positive_points,
  drop column if exists general_impression,
  drop column if exists visit_status,
  drop column if exists contact_id;

alter table public.estimations
  drop column if exists assigned_to,
  drop column if exists listing_price,
  drop column if exists selected_mandate_type,
  drop column if exists converted_to_property,
  drop column if exists converted_property_id,
  drop column if exists report_generated_at,
  drop column if exists report_storage_path,
  drop column if exists market_comparables,
  drop column if exists estimate_high,
  drop column if exists estimate_low,
  drop column if exists estimated_value,
  drop column if exists commercial_status,
  drop column if exists appointment_location,
  drop column if exists duration_minutes,
  drop column if exists time_slot,
  drop column if exists appointment_at,
  drop column if exists requested_at,
  drop column if exists property_condition,
  drop column if exists construction_year,
  drop column if exists property_address,
  drop column if exists contact_id,
  drop column if exists commercial_reference;

alter table public.leads
  drop column if exists commercial_alert,
  drop column if exists expected_signature_date,
  drop column if exists financing_approved,
  drop column if exists estimated_budget,
  drop column if exists blocking_reason,
  drop column if exists is_blocked,
  drop column if exists stage_entered_at,
  drop column if exists pipeline_stage,
  drop column if exists pipeline_type;
