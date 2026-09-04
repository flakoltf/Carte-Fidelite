-- supabase/migrations/20260904_marketing_consent_double_optin.sql
-- Chaîne de consentement email du client final (LPD / RGPD) — double opt-in.
--
-- ⚠️ À appliquer en prod AVANT le merge de feat/consentement-email.
--
-- État prod CONSTATÉ le 2026-09-04 (information_schema, projet WalletCard) :
-- customers possède déjà, via un patch HORS REPO (aucune migration dans le
-- dépôt, aucun code ne les écrit) :
--   marketing_consent         boolean NOT NULL DEFAULT false
--   marketing_consent_at      timestamptz
--   marketing_consent_source  text
-- On les (re)déclare en IF NOT EXISTS pour remettre le dépôt en phase avec la
-- prod (no-op là où elles existent), puis on ajoute la preuve du double opt-in.
--
-- Colonnes ADDITIVES, nullables — aucune donnée existante n'est touchée.
--
-- Sémantique (source de vérité : src/lib/consent/state.ts) :
--   en attente  : marketing_consent_at posé (case cochée, horodatage + IP),
--                 marketing_consent = false, confirmed_at NULL
--   confirmé    : marketing_consent = true, marketing_consent_confirmed_at posé,
--                 marketing_consent_revoked_at NULL  ← SEUL état autorisant un envoi
--   révoqué     : marketing_consent = false, marketing_consent_revoked_at posé
-- L'historique complet (preuve) vit dans audit_logs (MARKETING_CONSENT_UPDATED,
-- déjà présent dans audit_logs_action_check depuis 20260826).

ALTER TABLE customers ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS marketing_consent_at TIMESTAMPTZ;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS marketing_consent_source TEXT;

-- Preuve du consentement (LPD art. 6 / RGPD art. 7 §1) : IP de la case cochée,
-- horodatage de la confirmation par email, horodatage de la révocation.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS marketing_consent_ip TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS marketing_consent_confirmed_at TIMESTAMPTZ;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS marketing_consent_revoked_at TIMESTAMPTZ;

COMMENT ON COLUMN customers.marketing_consent_ip IS 'IP au moment où la case « offres par email » a été cochée (preuve LPD/RGPD).';
COMMENT ON COLUMN customers.marketing_consent_confirmed_at IS 'Horodatage du clic sur le lien de double opt-in. NULL = jamais confirmé.';
COMMENT ON COLUMN customers.marketing_consent_revoked_at IS 'Horodatage de la désinscription. Non NULL = aucun envoi marketing autorisé.';
