-- Extend the audit_logs CHECK constraint to include CUSTOMER_DELETED (RGPD erasure).

ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;

ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_check
  CHECK (action IN (
    'CARD_GENERATED',
    'CARD_SCANNED',
    'POINTS_INCREMENTED',
    'LOGIN_SUCCESS',
    'LOGIN_FAILED',
    'MERCHANT_CREATED',
    'CUSTOMER_DELETED'
  ));
