-- supabase/migrations/20260611_admin_panel_tables.sql
-- (Agent B — panneau super-admin)

-- Tables PROPRES au panneau admin (territoire agent B) : notes CRM,
-- historique des crons, feature flags, réglages plateforme.
-- Lecture : admins (is_admin()) ; écriture : service-role uniquement
-- (les routes /api/admin/* gardées par requireAdminApi + audit).

-- ── Notes CRM internes (marchand OU lead) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  author_user_id UUID NOT NULL,
  -- Épinglée = « à relancer » : remonte en haut des vues CRM.
  pinned BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (merchant_id IS NOT NULL OR lead_id IS NOT NULL)
);

ALTER TABLE admin_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_notes admin read" ON admin_notes
  FOR SELECT USING (is_admin());

CREATE INDEX IF NOT EXISTS idx_admin_notes_merchant ON admin_notes (merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_notes_lead ON admin_notes (lead_id, created_at DESC);

-- ── Historique d'exécution des crons (billing-snapshot, campaigns) ─────────
-- Alimenté par les routes /api/cron/* (service-role, best-effort) pour
-- répondre à « le cron a-t-il tourné ? » sans deviner depuis ses effets.
CREATE TABLE IF NOT EXISTS cron_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job TEXT NOT NULL CHECK (job IN ('billing-snapshot', 'campaigns')),
  status TEXT NOT NULL CHECK (status IN ('ok', 'error')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  details JSONB NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE cron_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cron_runs admin read" ON cron_runs
  FOR SELECT USING (is_admin());

CREATE INDEX IF NOT EXISTS idx_cron_runs_job ON cron_runs (job, started_at DESC);

-- ── Feature flags applicatifs ───────────────────────────────────────────────
-- Flags DB gérés depuis /admin/settings. Les gates par variable d'environnement
-- (NEXT_PUBLIC_GOOGLE_WALLET_READY…) restent affichés en lecture seule.
CREATE TABLE IF NOT EXISTS feature_flags (
  key TEXT PRIMARY KEY CHECK (key ~ '^[a-z0-9_.-]{2,64}$'),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  description TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID
);

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "feature_flags admin read" ON feature_flags
  FOR SELECT USING (is_admin());

-- ── Réglages plateforme (clé → valeur JSON, audités) ───────────────────────
CREATE TABLE IF NOT EXISTS platform_settings (
  key TEXT PRIMARY KEY CHECK (key ~ '^[a-z0-9_.-]{2,64}$'),
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID
);

ALTER TABLE platform_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform_settings admin read" ON platform_settings
  FOR SELECT USING (is_admin());

-- Réglages initiaux — faits réels documentés hors-repo, modifiables depuis
-- /admin/settings (chaque modification est auditée PLATFORM_SETTING_UPDATED) :
--  · apple_cert_expires_at : échéance des certificats Apple Wallet
--    (wallet/Google_Wallet_Dossier_Validation.md + CLAUDE.md : valides 06/2027)
--  · google_publishing_status : suivi manuel du publishing access Google
--  · db_backup : attestation manuelle du dernier dump vérifié (audit 360° :
--    aucun backup garanti à ce jour)
INSERT INTO platform_settings (key, value) VALUES
  ('apple_cert_expires_at', '{"date": "2027-06-28"}'::jsonb),
  ('google_publishing_status', '{"status": "en_attente", "note": "Demande déposée — vertical loyalty uniquement"}'::jsonb),
  ('db_backup', '{"last_verified_at": null, "note": "Aucun backup vérifié — voir audit 360° (DevOps)"}'::jsonb)
ON CONFLICT (key) DO NOTHING;
