-- Incrément de tampon ATOMIQUE (SEC-01) : verrou de ligne (FOR UPDATE) → deux scans
-- concurrents sur la même carte sont sérialisés. Applique cooldown + plafond dans la
-- même transaction, sans read-modify-write côté application.
--
--   p_cap              : plafond stamp_card (>0). <= 0 = illimité (visit_based / tiered).
--   p_cooldown_seconds : délai mini entre 2 tampons (0 = désactivé).
--   statut renvoyé     : 'incremented' | 'cooldown' | 'full' | 'notfound'
create or replace function scan_increment(
  p_card_id uuid,
  p_cap integer,
  p_cooldown_seconds integer
)
returns table(new_count integer, last_scan timestamptz, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  r loyalty_cards%rowtype;
begin
  select * into r from loyalty_cards where id = p_card_id for update; -- verrou : sérialise les scans concurrents
  if not found then
    new_count := 0; last_scan := null; status := 'notfound';
    return next; return;
  end if;

  if p_cap > 0 and r.stamps_count >= p_cap then
    new_count := r.stamps_count; last_scan := r.last_scan; status := 'full';
  elsif p_cooldown_seconds > 0
        and r.last_scan is not null
        and r.last_scan > v_now - make_interval(secs => p_cooldown_seconds) then
    new_count := r.stamps_count; last_scan := r.last_scan; status := 'cooldown';
  else
    update loyalty_cards
      set stamps_count = stamps_count + 1, last_scan = v_now
      where id = p_card_id;
    new_count := r.stamps_count + 1; last_scan := v_now; status := 'incremented';
  end if;
  return next;
end $$;

-- L'app appelle cette fonction via le service-role uniquement.
revoke execute on function scan_increment(uuid, integer, integer) from public, anon, authenticated;
