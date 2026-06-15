-- supabase/migrations/20260615_backfill_concierge.sql
--
-- Correctif permanent du défaut #2 (création admin) : avant le correctif du
-- handler POST /api/admin/merchants, les marchands concierge naissaient sans
-- marqueurs d'onboarding (setup_mode/onboarding_completed_at à NULL,
-- managed_by_concierge=false) alors que toutes les données métier étaient
-- remplies — état incohérent qui routait le marchand vers le wizard
-- self-service et l'écran « confirmez votre adresse ».
--
-- Backfill IDEMPOTENT : ne touche que les lignes encore incohérentes
-- (onboarding_completed_at IS NULL). Les colonnes existent depuis
-- 20260604/20260613/20260614 ; aucune nouvelle AuditAction, donc pas de
-- migration jumelle du CHECK (invariant 1 non concerné).
--
-- NB : la prod a déjà été backfillée à la main le 2026-06-15 (cette migration
-- y est alors un no-op) ; elle reste la garantie permanente pour tout autre
-- environnement et toute ligne legacy.

UPDATE public.merchants
SET setup_mode = 'concierge',
    managed_by_concierge = true,
    onboarding_completed_at = COALESCE(onboarding_completed_at, created_at),
    signup_source = COALESCE(signup_source, 'concierge')
WHERE role = 'merchant'
  AND onboarding_completed_at IS NULL;
