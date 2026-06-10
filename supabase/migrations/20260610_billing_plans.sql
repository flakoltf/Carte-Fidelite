-- supabase/migrations/20260610_billing_plans.sql

-- Fondation billing : palier d'abonnement + comptage contractuel « carte
-- active 90 jours » (CGV §1/§6 — grille canonique 69/129/199, plafonds
-- 200/750/2000). NB : aucune nouvelle valeur d'AuditAction ici ; les actions
-- SUBSCRIPTION_*/PAYMENT_* sont déjà couvertes par
-- 20260610_audit_actions_card_design.sql.

ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'essentiel'
    CHECK (plan IN ('essentiel', 'croissance', 'premium', 'custom')),
  ADD COLUMN IF NOT EXISTS billing_cycle TEXT NOT NULL DEFAULT 'monthly'
    CHECK (billing_cycle IN ('monthly', 'annual')),
  ADD COLUMN IF NOT EXISTS launch_partner BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS plan_started_at TIMESTAMPTZ DEFAULT NOW();

-- Index de comptage : cartes actives par marchand sur la fenêtre 90 j.
CREATE INDEX IF NOT EXISTS idx_loyalty_cards_merchant_lastscan
  ON loyalty_cards (merchant_id, last_scan DESC NULLS LAST);

-- Comptage temps réel : activité = installation (created_at) OU scan (last_scan) < 90 j.
CREATE OR REPLACE VIEW billing_active_cards AS
SELECT
  m.id   AS merchant_id,
  m.plan,
  COUNT(c.id) FILTER (
    WHERE GREATEST(COALESCE(c.last_scan, c.created_at), c.created_at)
          >= NOW() - INTERVAL '90 days'
  ) AS active_cards_90d,
  CASE m.plan
    WHEN 'essentiel'  THEN 200
    WHEN 'croissance' THEN 750
    WHEN 'premium'    THEN 2000
    ELSE NULL
  END AS plan_cap
FROM merchants m
LEFT JOIN loyalty_cards c ON c.merchant_id = m.id
GROUP BY m.id, m.plan;

-- Snapshot mensuel : le chiffre opposable au commerçant (CGV §6 — calculé le
-- 1er jour de chaque mois). À exécuter le 1er du mois (cron Vercel) :
--   INSERT INTO billing_snapshots (merchant_id, period, active_cards_90d, plan)
--   SELECT merchant_id, date_trunc('month', NOW())::date, active_cards_90d, plan
--   FROM billing_active_cards
--   ON CONFLICT (merchant_id, period) DO NOTHING;
CREATE TABLE IF NOT EXISTS billing_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  period DATE NOT NULL,
  active_cards_90d INT NOT NULL,
  plan TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (merchant_id, period)
);

ALTER TABLE billing_snapshots ENABLE ROW LEVEL SECURITY;

-- Même prédicat tenant que les autres tables (cf. 20240527_rls_policies.sql) + admin.
CREATE POLICY "billing snapshots scoped to merchant" ON billing_snapshots
  FOR SELECT USING (
    merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
    OR is_admin()
  );
