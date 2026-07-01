-- Encaissement « Offrir la récompense » pour amount_points — pendant de
-- scan_increment_amount (20260618). Décrément ATOMIQUE et CONDITIONNEL du solde
-- de points sous verrou de ligne (FOR UPDATE) : sur deux encaissements
-- concurrents sur la même carte, un seul matche (le 2e voit points_balance <
-- threshold) → pas de double-encaissement (invariant n°4 — pas de read-modify-
-- write côté app ; miroir de la logique stamp_card qui remet stamps_count à 0
-- via un UPDATE conditionnel .gte côté app).
--
-- On SOUSTRAIT le seuil (au lieu de remettre à 0) pour préserver le surplus de
-- points accumulé au-delà du seuil (ex. 250 pts, seuil 100 → 150 restants).
-- La tenancy est posée dans le WHERE (merchant_id), comme côté app.
--
-- Statuts (champ "error" quand ok=false) : 'card_not_found' | 'not_ready'
create or replace function public.redeem_amount_points(
  p_card_id uuid,
  p_merchant_id uuid,
  p_threshold integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r loyalty_cards%rowtype;
  v_new_balance integer;
begin
  if p_threshold is null or p_threshold <= 0 then
    return jsonb_build_object('ok', false, 'error', 'not_ready');
  end if;

  -- Verrou : sérialise les encaissements concurrents sur la même carte.
  select * into r from loyalty_cards
    where id = p_card_id and merchant_id = p_merchant_id
    for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'card_not_found');
  end if;

  if coalesce(r.points_balance, 0) < p_threshold then
    return jsonb_build_object(
      'ok', false,
      'error', 'not_ready',
      'currentValue', coalesce(r.points_balance, 0)
    );
  end if;

  v_new_balance := coalesce(r.points_balance, 0) - p_threshold;

  update loyalty_cards
    set points_balance = v_new_balance
    where id = p_card_id;

  return jsonb_build_object('ok', true, 'currentValue', v_new_balance);
end $$;

-- L'app appelle cette fonction via le service-role uniquement (comme scan_increment).
revoke execute on function public.redeem_amount_points(uuid, uuid, integer) from public, anon, authenticated;
