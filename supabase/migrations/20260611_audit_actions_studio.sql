-- supabase/migrations/20260611_audit_actions_studio.sql
-- (Agent A — studio de design marchand)
--
-- Migration jumelle de audit_logs_action_check (invariant 1 de CLAUDE.md) :
-- trois nouvelles actions émises par les endpoints marchands du studio.
-- La liste reprend INTÉGRALEMENT 20260610_audit_actions_card_design.sql
-- (y compris les actions billing réservées) + les 3 nouvelles actions.

ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_check
  CHECK (action = ANY (ARRAY[
    'CARD_GENERATED','CARD_SCANNED','POINTS_INCREMENTED',
    'LOGIN_SUCCESS','LOGIN_FAILED','MERCHANT_CREATED','CUSTOMER_DELETED',
    'MERCHANT_UPDATED','MERCHANT_TOKEN_ROTATED','REWARD_REDEEMED',
    'CUSTOMER_UPDATED','MFA_ENROLLED','MFA_DISABLED',
    'ADMIN_IMPERSONATION_START','ADMIN_IMPERSONATION_STOP',
    'CARD_DESIGN_UPDATED','CARD_CLASS_SYNCED',
    'SUBSCRIPTION_CREATED','SUBSCRIPTION_UPDATED','SUBSCRIPTION_CANCELED',
    'PAYMENT_SUCCEEDED','PAYMENT_FAILED',
    'CARD_DESIGN_DRAFT_SAVED','CARD_DESIGN_PUBLISHED','CARD_ASSET_UPLOADED'
  ]));
