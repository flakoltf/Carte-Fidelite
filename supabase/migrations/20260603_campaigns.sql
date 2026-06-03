-- Sous-projet 4b — campagnes self-service (programmées & récurrentes).
CREATE TABLE IF NOT EXISTS campaigns (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id   uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  audience      text NOT NULL DEFAULT 'all',
  title         text NOT NULL,
  body          text NOT NULL,
  mode          text NOT NULL CHECK (mode IN ('once','recurring')),
  run_on        date,
  active        boolean NOT NULL DEFAULT true,
  cooldown_days int NOT NULL DEFAULT 30,
  last_run_on   date,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_campaigns_merchant ON campaigns (merchant_id);

CREATE TABLE IF NOT EXISTS campaign_sends (
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  card_id     text NOT NULL,
  sent_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, card_id, sent_at)
);
CREATE INDEX IF NOT EXISTS idx_campaign_sends_lookup ON campaign_sends (campaign_id, sent_at);

-- RLS : le marchand lit ses propres campagnes via le client RLS (page dashboard).
-- Les écritures passent par le service-role (routes API). Même pattern que wallet_notifications.
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "campaigns scoped to merchant" ON campaigns;
CREATE POLICY "campaigns scoped to merchant" ON campaigns
  FOR SELECT USING (
    merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
  );

-- campaign_sends : service-role uniquement (cron). Deny par défaut anon/authenticated.
ALTER TABLE campaign_sends ENABLE ROW LEVEL SECURITY;
