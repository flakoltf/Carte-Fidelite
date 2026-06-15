-- supabase/migrations/20260615_backfill_concierge_markers.sql
-- (Correctif BUG #2 — marchands concierge antérieurs au fix, marqueurs NULL)
--
-- Avant le correctif de POST /api/admin/merchants, un marchand créé par l'admin
-- recevait setup_mode = NULL, onboarding_completed_at = NULL,
-- managed_by_concierge = false → il était traité comme un compte self-service
-- inachevé (file concierge, filtres admin, surfaces self-service trompeuses).
--
-- Ce backfill répare l'EXISTANT. Le code n'en a plus besoin pour les NOUVEAUX
-- comptes (marqueurs posés à l'insertion).
--
-- ⚠️ NON appliqué automatiquement — l'utilisateur l'applique en prod après go
-- explicite (invariant 6). Idempotent (re-exécutable sans effet supplémentaire).
--
-- CIBLAGE (corrigé vs brouillon initial) :
--  - signup_source = 'concierge' : les valeurs réelles de la colonne sont
--    ('concierge','self_service') — il n'existe pas de valeur 'self'. Un compte
--    self-service réellement en cours d'onboarding (signup_source='self_service',
--    onboarding_completed_at NULL) ne doit PAS être marqué « terminé » de force.
--  - role = 'merchant' : EXCLUT la ligne merchants de l'admin lui-même
--    (role='admin', signup_source par défaut 'concierge', onboarding NULL) — sans
--    ce filtre, le backfill la marquerait à tort comme un marchand concierge en
--    ligne.
--  - onboarding_completed_at IS NULL : ne touche que les lignes non encore
--    finalisées (idempotence).

UPDATE public.merchants
SET
  setup_mode = 'concierge',
  managed_by_concierge = true,
  onboarding_step = 'done',
  -- Horodatage cohérent avec l'âge réel du compte (essai/ancienneté préservés).
  onboarding_completed_at = COALESCE(onboarding_completed_at, created_at)
WHERE role = 'merchant'
  AND signup_source = 'concierge'
  AND onboarding_completed_at IS NULL;
