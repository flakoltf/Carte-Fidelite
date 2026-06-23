-- Crédit de points par MONTANT, ATOMIQUE (amount_points) — pendant de
-- scan_increment (20260604_scan_atomic_increment.sql) pour le type amount_points.
-- Verrou de ligne (FOR UPDATE) → deux encaissements concurrents sur la même carte
-- sont sérialisés ; cooldown + plafond appliqués dans la même transaction, sans
-- read-modify-write côté application (invariant n°4 de CLAUDE.md).
--
-- CALQUÉ sur scan_increment (forme prouvée) : %rowtype, FOR UPDATE, cooldown par
-- paramètre via make_interval, security definer, search_path = public, REVOKE final.
--
-- Déviations ASSUMÉES vs le brouillon du cahier (à valider — cf. FEEDBACK) :
--   • PAS de p_signature : la signature du QR est vérifiée CÔTÉ APP (verifyQRCode)
--     AVANT l'appel RPC, exactement comme pour scan_increment (la RPC reçoit déjà
--     l'id de carte résolu). Un paramètre signature serait mort ici.
--   • PAS de contrôle de suspension : la suspension administrative est vérifiée
--     CÔTÉ APP (merchants.suspended_at) avant la RPC ; scan_increment n'en fait pas
--     non plus. On reste fidèle à la forme existante.
--   • Retour jsonb structuré (demandé par le cahier) — plus riche que le retour
--     table de scan_increment, adapté aux données amount_points.
--
-- Statuts renvoyés (champ "error" quand ok=false) :
--   'card_not_found' | 'cooldown' | 'bad_amount'
create or replace function public.scan_increment_amount(
  p_card_id uuid,
  p_amount_chf numeric,
  p_cooldown_seconds integer default 30,
  p_points_per_chf numeric default 1,
  p_max_points integer default 1000,
  p_reward_threshold integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  r loyalty_cards%rowtype;
  v_earned integer;
  v_new_balance integer;
  v_reward_ready boolean;
begin
  -- Montant invalide : on refuse (le moteur applyScan lève sur montant <= 0 ;
  -- même contrat ici). La route valide en amont, ceci est un garde-fou.
  if p_amount_chf is null or p_amount_chf <= 0 then
    return jsonb_build_object('ok', false, 'error', 'bad_amount');
  end if;

  -- Verrou : sérialise les encaissements concurrents sur la même carte.
  select * into r from loyalty_cards where id = p_card_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'card_not_found');
  end if;

  -- Cooldown (calqué sur scan_increment : guard > 0 + make_interval).
  if p_cooldown_seconds > 0
     and r.last_scan is not null
     and r.last_scan > v_now - make_interval(secs => p_cooldown_seconds) then
    return jsonb_build_object(
      'ok', false,
      'error', 'cooldown',
      'currentValue', coalesce(r.points_balance, 0)
    );
  end if;

  -- Crédit plafonné : min(floor(montant * points/CHF), plafond) — miroir exact
  -- de engine.applyScan (amount_points).
  v_earned := least(floor(p_amount_chf * p_points_per_chf)::integer, p_max_points);
  v_new_balance := coalesce(r.points_balance, 0) + v_earned;
  v_reward_ready := p_reward_threshold is not null and v_new_balance >= p_reward_threshold;

  update loyalty_cards
    set points_balance = v_new_balance,
        last_scan_amount_chf = p_amount_chf,
        last_scan = v_now
    where id = p_card_id;

  return jsonb_build_object(
    'ok', true,
    'currentValue', v_new_balance,
    'pointsEarned', v_earned,
    'rewardReady', v_reward_ready
  );
end $$;

-- L'app appelle cette fonction via le service-role uniquement (comme scan_increment).
revoke execute on function public.scan_increment_amount(uuid, numeric, integer, numeric, integer, integer) from public, anon, authenticated;
