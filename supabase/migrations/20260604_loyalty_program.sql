-- Moteur de fidélité multi-types : type + config par marchand.
-- Rétro-compatible : défaut stamp_card, goal reste lu sur merchants.stamp_goal.
alter table merchants
  add column if not exists loyalty_type text not null default 'stamp_card',
  add column if not exists loyalty_config jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'merchants_loyalty_type_chk') then
    alter table merchants
      add constraint merchants_loyalty_type_chk
      check (loyalty_type in ('stamp_card','visit_based','tiered'));
  end if;
end $$;
