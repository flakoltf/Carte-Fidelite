-- supabase/migrations/20260615_scan_revert.sql
-- (Expérience guidée — annulation d'un tampon en caisse)
--
-- Miroir atomique de scan_increment (SEC-01) : un doigt qui glisse ou un client
-- scanné deux fois doit pouvoir être corrigé AU COMPTOIR, dans une fenêtre
-- courte, sans jamais passer sous zéro ni « rembourser » une récompense déjà
-- encaissée (l'encaissement remet stamps_count à 0 → le garde-fou > 0 suffit).
--
--   p_window_seconds : fenêtre d'annulation depuis le dernier tampon (ex. 300).
--   statut renvoyé   : 'reverted' | 'expired' | 'empty' | 'notfound'
create or replace function scan_revert(
  p_card_id uuid,
  p_window_seconds integer
)
returns table(new_count integer, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  r loyalty_cards%rowtype;
begin
  select * into r from loyalty_cards where id = p_card_id for update; -- même verrou que scan_increment
  if not found then
    new_count := 0; status := 'notfound';
    return next; return;
  end if;

  if r.stamps_count <= 0 then
    -- Rien à annuler (ou récompense déjà encaissée : l'encaissement remet à 0).
    new_count := r.stamps_count; status := 'empty';
  elsif r.last_scan is null
        or r.last_scan < v_now - make_interval(secs => greatest(p_window_seconds, 0)) then
    new_count := r.stamps_count; status := 'expired';
  else
    -- last_scan est conservé : il trace la tentative annulée et le cooldown
    -- continue de protéger la carte contre les doubles scans immédiats.
    update loyalty_cards
      set stamps_count = stamps_count - 1
      where id = p_card_id;
    new_count := r.stamps_count - 1; status := 'reverted';
  end if;
  return next;
end $$;

-- L'app appelle cette fonction via le service-role uniquement.
revoke execute on function scan_revert(uuid, integer) from public, anon, authenticated;
