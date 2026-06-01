ALTER TABLE merchants ADD COLUMN IF NOT EXISTS stamp_goal INT NOT NULL DEFAULT 10;
ALTER TABLE merchants ADD CONSTRAINT merchants_stamp_goal_range CHECK (stamp_goal BETWEEN 1 AND 50);
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS segment_config JSONB;
