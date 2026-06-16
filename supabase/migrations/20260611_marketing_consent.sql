-- supabase/migrations/20260611_marketing_consent.sql
--
-- FORMALISATION D'UNE MIGRATION PROD ORPHELINE (appliquée hors-repo).
-- Reproduite À L'IDENTIQUE depuis supabase_migrations.schema_migrations
-- (version 20260611223639, name « marketing_consent ») — appliquée en prod le
-- 2026-06-11 22:36:39, mais jamais committée dans le repo. Un fresh-db ne
-- créait donc PAS les colonnes customers.marketing_consent*, alors que la prod
-- les a. NON ré-appliquée ici (additive + idempotente : sûre sur la prod).

-- Consentement marketing nLPD/RGPD (additive, idempotente)
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS marketing_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS marketing_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS marketing_consent_source text;

COMMENT ON COLUMN public.customers.marketing_consent IS 'Opt-in explicite aux communications marketing (nLPD/RGPD). Jamais une condition d''accès à la carte.';
COMMENT ON COLUMN public.customers.marketing_consent_at IS 'Horodatage du dernier changement de consentement (preuve).';
COMMENT ON COLUMN public.customers.marketing_consent_source IS 'Origine du changement : enrollment, unsubscribe_link, etc.';
