-- Append-only audit log for compliance (RGPD registry, fraud forensics)

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action TEXT NOT NULL CHECK (action IN (
    'CARD_GENERATED',
    'CARD_SCANNED',
    'POINTS_INCREMENTED',
    'LOGIN_SUCCESS',
    'LOGIN_FAILED',
    'MERCHANT_CREATED'
  )),
  merchant_id UUID REFERENCES merchants(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  card_id UUID REFERENCES loyalty_cards(id) ON DELETE SET NULL,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_merchant_id ON audit_logs(merchant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_card_id ON audit_logs(card_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- Append-only: block UPDATE and DELETE at the row level via a trigger
CREATE OR REPLACE FUNCTION audit_logs_block_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only; % is not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_logs_no_update ON audit_logs;
CREATE TRIGGER audit_logs_no_update
  BEFORE UPDATE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_block_mutation();

DROP TRIGGER IF EXISTS audit_logs_no_delete ON audit_logs;
CREATE TRIGGER audit_logs_no_delete
  BEFORE DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_block_mutation();
