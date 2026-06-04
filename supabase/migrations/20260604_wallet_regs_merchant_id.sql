-- SEC-21 : défense en profondeur sur wallet_device_registrations (push tokens).
-- La table n'avait pas de merchant_id → l'isolation tenant reposait à 100% sur le code.
-- On ajoute merchant_id (dénormalisé), on backfill, et une policy SELECT scopée
-- (l'app accède via service-role qui bypasse la RLS ; la policy protège tout accès anon/authenticated).
alter table wallet_device_registrations add column if not exists merchant_id uuid;

update wallet_device_registrations w
  set merchant_id = c.merchant_id
  from loyalty_cards c
  where c.id::text = w.serial_number and w.merchant_id is null;

create index if not exists idx_wdr_merchant on wallet_device_registrations(merchant_id);

drop policy if exists "merchant_reads_own_device_regs" on wallet_device_registrations;
create policy "merchant_reads_own_device_regs" on wallet_device_registrations
  for select using (
    merchant_id in (select id from merchants where user_id = auth.uid()) or is_admin()
  );
