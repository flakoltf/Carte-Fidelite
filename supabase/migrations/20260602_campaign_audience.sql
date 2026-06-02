ALTER TABLE wallet_notifications ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'all';
