-- Phase 2C : nouvelles actions d'audit pour l'administration des marchands
-- (édition du branding et rotation du jeton d'enrôlement).

ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;

ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_check
  CHECK (action = ANY (ARRAY[
    'CARD_GENERATED', 'CARD_SCANNED', 'POINTS_INCREMENTED',
    'LOGIN_SUCCESS', 'LOGIN_FAILED', 'MERCHANT_CREATED', 'CUSTOMER_DELETED',
    'MERCHANT_UPDATED', 'MERCHANT_TOKEN_ROTATED'
  ]));
