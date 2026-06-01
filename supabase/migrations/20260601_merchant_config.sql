ALTER TABLE merchants ADD COLUMN IF NOT EXISTS stamp_goal INT NOT NULL DEFAULT 10;
-- DROP puis ADD : ADD CONSTRAINT ne supporte pas IF NOT EXISTS → idempotent pour ré-exécution sûre.
ALTER TABLE merchants DROP CONSTRAINT IF EXISTS merchants_stamp_goal_range;
ALTER TABLE merchants ADD CONSTRAINT merchants_stamp_goal_range CHECK (stamp_goal BETWEEN 1 AND 50);
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS segment_config JSONB;
