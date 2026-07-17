-- IMMO-DREAMS83 Lesty catalogue import support.
-- Non destructive: extends accepted property types for source stock parity.

alter table properties
  drop constraint if exists properties_type_check;

alter table properties
  add constraint properties_type_check
  check (type in ('apartment', 'house', 'land', 'commercial', 'parking', 'other'));
