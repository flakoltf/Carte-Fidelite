-- supabase/migrations/20260610_leads.sql

-- Capture de leads du site vitrine (/demarrer). Insertion uniquement via la
-- Server Action (service role) ; lecture réservée aux admins.
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_name TEXT NOT NULL,
  trade TEXT,
  contact TEXT NOT NULL,
  plan TEXT,
  source_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Aucune policy anon/authenticated pour INSERT : seul le service role écrit.
CREATE POLICY "leads admin read" ON leads
  FOR SELECT USING (is_admin());

CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads (created_at DESC);
