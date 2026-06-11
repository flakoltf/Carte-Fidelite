-- supabase/migrations/20260611_admin_merchant_controls.sql
-- (Agent B — panneau super-admin)

-- Contrôles marchand côté admin — STRICTEMENT ADDITIF (contrat anti-collision :
-- aucune colonne/table/policy existante n'est modifiée).

-- Suspension administrative : trace QUI/QUAND/POURQUOI. Le blocage effectif
-- au comptoir (scan/enrôlement) est une dépendance d'intégration notée dans
-- AGENT-B-MANIFESTE.md — ce panneau enregistre et affiche l'état.
ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_reason TEXT,
  -- Limite ajustée manuellement (avantage partenaire, geste commercial).
  -- NULL = plafond du palier (BILLING_PLANS). S'applique à l'AFFICHAGE et aux
  -- alertes d'upsell côté admin ; le comptage contractuel reste celui des CGV.
  ADD COLUMN IF NOT EXISTS plan_cap_override INTEGER
    CHECK (plan_cap_override IS NULL OR plan_cap_override > 0);

-- Pipeline commercial sur les leads /demarrer (mini-CRM admin).
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'nouveau'
    CHECK (status IN ('nouveau', 'contacte', 'demo', 'gagne', 'perdu')),
  ADD COLUMN IF NOT EXISTS next_followup_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lost_reason TEXT,
  ADD COLUMN IF NOT EXISTS converted_merchant_id UUID REFERENCES merchants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_leads_status ON leads (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_followup ON leads (next_followup_at)
  WHERE next_followup_at IS NOT NULL;
