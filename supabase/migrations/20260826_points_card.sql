-- Carte à points (points FIXES par scan, paliers cumulatifs) — spec 2026-08-26.
-- 100 % ADDITIF et idempotent. PRÉ-REQUIS PROD : 20260618_amount_points.sql
-- (points_balance) — la colonne est ré-ajoutée défensivement ci-dessous pour
-- lever tout risque d'ordre. Application prod MANUELLE avec accord explicite.
-- Aucune nouvelle table → registre RLS inchangé. Nouvelle AuditAction
-- POINTS_EXPIRED : jumelle dans 20260826_audit_actions_points.sql (invariant 1).

-- 1) loyalty_type : autoriser 'points' (ancien set ⊂ nouveau set, rejouable).
alter table merchants drop constraint if exists merchants_loyalty_type_chk;
alter table merchants drop constraint if exists merchants_loyalty_type_check;
alter table merchants
  add constraint merchants_loyalty_type_chk
  check (loyalty_type in ('stamp_card', 'visit_based', 'tiered', 'amount_points', 'points'));

-- 2) État par carte. points_balance : défensif (déjà posé par 20260618 si appliquée).
alter table loyalty_cards add column if not exists points_balance integer not null default 0;
-- Paliers intermédiaires déjà validés dans le CYCLE courant (vidé au reset).
alter table loyalty_cards add column if not exists redeemed_tiers jsonb not null default '[]'::jsonb;
-- Ancre d'expiration : posée au 1er scan du cycle, remise à null au reset.
alter table loyalty_cards add column if not exists points_cycle_started_at timestamptz;

-- 3) Incrément ATOMIQUE (miroir de scan_increment, sur points_balance).
--    p_cap = seuil du palier max (>0 toujours) : crédite au plus jusqu'au cap
--    (pas de surplus — spec), statut 'full' si déjà plein.
create or replace function scan_increment_points(
  p_card_id uuid,
  p_points integer,
  p_cap integer,
  p_cooldown_seconds integer
)
returns table(new_count integer, points_added integer, status text)
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
    new_count := 0; points_added := 0; status := 'notfound';
    return next; return;
  end if;

  if r.points_balance >= p_cap then
    new_count := r.points_balance; points_added := 0; status := 'full';
  elsif p_cooldown_seconds > 0
        and r.last_scan is not null
        and r.last_scan > v_now - make_interval(secs => p_cooldown_seconds) then
    new_count := r.points_balance; points_added := 0; status := 'cooldown';
  else
    v_add := least(p_points, p_cap - r.points_balance);
    update loyalty_cards
      set points_balance = points_balance + v_add,
          last_scan = v_now,
          points_cycle_started_at = coalesce(points_cycle_started_at, v_now)
      where id = p_card_id;
    new_count := r.points_balance + v_add; points_added := v_add; status := 'incremented';
  end if;
  return next;
end $$;

revoke execute on function scan_increment_points(uuid, integer, integer, integer) from public, anon, authenticated;

-- 4) Validation staff ATOMIQUE d'un palier (SEC-01 : jamais de double validation).
--    Palier max → reset complet du cycle ; intermédiaire → marqué dans redeemed_tiers.
create or replace function points_redeem_tier(
  p_card_id uuid,
  p_merchant_id uuid,
  p_threshold integer,
  p_max_threshold integer
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  r loyalty_cards%rowtype;
begin
  select * into r from loyalty_cards where id = p_card_id and merchant_id = p_merchant_id for update;
  if not found then return 'notfound'; end if;
  if r.points_balance < p_threshold then return 'not_reached'; end if;

  if p_threshold >= p_max_threshold then
    update loyalty_cards
      set points_balance = 0, redeemed_tiers = '[]'::jsonb, points_cycle_started_at = null
      where id = p_card_id;
    return 'reset';
  end if;

  if r.redeemed_tiers @> jsonb_build_array(p_threshold) then return 'already'; end if;
  update loyalty_cards
    set redeemed_tiers = r.redeemed_tiers || jsonb_build_array(p_threshold)
    where id = p_card_id;
  return 'redeemed';
end $$;

revoke execute on function points_redeem_tier(uuid, uuid, integer, integer) from public, anon, authenticated;
