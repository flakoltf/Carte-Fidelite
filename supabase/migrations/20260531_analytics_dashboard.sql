-- Type de commerce (preset dashboard) + config perso (widgets visibles/ordre)
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS business_type TEXT NOT NULL DEFAULT 'autre';
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS dashboard_config JSONB;

-- Index pour les agrégations analytiques
CREATE INDEX IF NOT EXISTS idx_scan_history_merchant_time ON scan_history (merchant_id, scanned_at);
CREATE INDEX IF NOT EXISTS idx_customers_merchant_created ON customers (merchant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_loyalty_cards_merchant ON loyalty_cards (merchant_id);
