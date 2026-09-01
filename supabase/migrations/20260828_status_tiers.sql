-- Statut client (Bronze/Argent/Or…) par cumul de points À VIE — spec 2026-08-27.
-- 100 % ADDITIF et idempotent. Aucune nouvelle table → registre RLS inchangé
-- (les colonnes héritent des policies de loyalty_cards). Aucune nouvelle
-- AuditAction (le changement de statut vit dans les details de CARD_SCANNED).
-- Config des seuils : merchants.loyalty_config.statusTiers (jsonb, validée par
-- validateLoyaltyProgram). Application prod MANUELLE avec accord explicite,
-- AVANT le déploiement du code : applePass lit les nouvelles colonnes
-- (SELECT échouerait sans elles) ; la route scan, elle, tolère l'ancienne RPC.

-- 1) Cumul de points à VIE (jamais remis à zéro : points_redeem_tier, le cron
--    d'expiration et scan_revert ne touchent que points_balance/stamps_count)
--    + statut atteint. current_status_tier stocke le SEUIL du palier (pas le
--    libellé, renommable en config) ; null = aucun statut. Mise à jour MONOTONE
--    par la route scan (jamais décrémenté) : le statut ne redescend jamais,
--    même si le marchand remonte ses seuils.
alter table loyalty_cards add column if not exists lifetime_points integer not null default 0;
alter table loyalty_cards add column if not exists current_status_tier integer;

-- 2) Backfill best-effort des cartes à points déjà scannées depuis la mise en
--    prod du programme points : somme des crédits réels de scan_history
--    (points_added > 0 ; les compensations de revert sont négatives, un scan
--    à 0 point n'apporte rien au cumul). Idempotent : ne touche que les cartes
--    encore à 0. current_status_tier reste null → posé au prochain scan.
update loyalty_cards c
  set lifetime_points = s.total
  from (
    select card_id, sum(points_added) as total
    from scan_history
    where points_added > 0
    group by card_id
  ) s
  where s.card_id = c.id
    and c.lifetime_points = 0
    and c.merchant_id in (select id from merchants where loyalty_type = 'points');

-- 3) scan_increment_points : lifetime_points crédité dans le MÊME update sous
--    verrou (invariant n°4 — jamais de read-modify-write) et new_lifetime
--    retourné pour le recalcul de statut par la route. Le type de retour
--    change → DROP obligatoire avant re-création (CREATE OR REPLACE refuse).
drop function if exists scan_increment_points(uuid, integer, integer, integer);
create function scan_increment_points(
  p_card_id uuid,
  p_points integer,
  p_cap integer,
  p_cooldown_seconds integer
)
returns table(new_count integer, points_added integer, new_lifetime integer, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_add integer;
  r loyalty_cards%rowtype;
begin
  select * into r from loyalty_cards where id = p_card_id for update;
  if not found then
    new_count := 0; points_added := 0; new_lifetime := 0; status := 'notfound';
    return next; return;
  end if;

  if r.points_balance >= p_cap then
    new_count := r.points_balance; points_added := 0; new_lifetime := r.lifetime_points; status := 'full';
  elsif p_cooldown_seconds > 0
        and r.last_scan is not null
        and r.last_scan > v_now - make_interval(secs => p_cooldown_seconds) then
    new_count := r.points_balance; points_added := 0; new_lifetime := r.lifetime_points; status := 'cooldown';
  else
    v_add := least(p_points, p_cap - r.points_balance);
    update loyalty_cards
      set points_balance = points_balance + v_add,
          lifetime_points = lifetime_points + v_add,
          last_scan = v_now,
          points_cycle_started_at = coalesce(points_cycle_started_at, v_now)
      where id = p_card_id;
    new_count := r.points_balance + v_add; points_added := v_add;
    new_lifetime := r.lifetime_points + v_add; status := 'incremented';
  end if;
  return next;
end $$;

revoke execute on function scan_increment_points(uuid, integer, integer, integer) from public, anon, authenticated;
