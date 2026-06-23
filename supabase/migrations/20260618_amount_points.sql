-- amount_points — programme de fidélité « points par montant ».
-- Étend le set loyalty_type et ajoute, sur la carte, le solde de points et la
-- traçabilité du dernier montant encaissé. 100 % ADDITIF et idempotent (rejouable).
--
-- Conventions RÉELLES vérifiées dans le schéma (invariant 6 « vérifier l'état réel ») :
--   • la contrainte existante s'appelle « merchants_loyalty_type_chk » (et NON
--     « merchants_loyalty_type_check » — drop défensif des deux noms par sûreté) ;
--   • la table des cartes est « loyalty_cards » (il n'existe pas de table « cards »).
-- Aucune nouvelle AuditAction ici → pas de jumelle audit_logs_action_check (invariant 1).
-- À appliquer en prod via Supabase avec accord explicite (ce fichier = repo seulement).

-- 1) Étendre le CHECK loyalty_type pour autoriser amount_points.
--    Drop puis re-add sous le nom canonique : rejouable, et jamais en violation
--    (l'ancien set ⊂ nouveau set, donc les lignes existantes restent valides).
alter table merchants drop constraint if exists merchants_loyalty_type_chk;
alter table merchants drop constraint if exists merchants_loyalty_type_check;
alter table merchants
  add constraint merchants_loyalty_type_chk
  check (loyalty_type in ('stamp_card', 'visit_based', 'tiered', 'amount_points'));

-- 2) Traçabilité du dernier montant encaissé (audit + annulation au comptoir).
alter table loyalty_cards
  add column if not exists last_scan_amount_chf numeric(10,2);

-- 3) Solde de points de la carte (amount_points). Réutilisé tel quel s'il existe déjà.
alter table loyalty_cards
  add column if not exists points_balance integer not null default 0;
