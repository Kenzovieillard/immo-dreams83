-- IMMO-DREAMS83 V3 phase 3
-- Guardrails for the future legacy contacts/estimations import.
-- Non destructive: prevents duplicate leads for the same legacy source row.

create unique index if not exists leads_source_table_source_id_unique
  on leads(source_table, source_id)
  where source_table is not null and source_id is not null;

create index if not exists leads_source_table_source_id_idx
  on leads(source_table, source_id);
