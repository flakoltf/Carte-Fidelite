-- supabase/migrations/20260610_audit_actions_card_design.sql

-- Correctif : CARD_DESIGN_UPDATED et CARD_CLASS_SYNCED sont émis par
-- src/app/api/admin/merchants/[id]/card-design/route.ts mais absents du CHECK
-- (dernière mise à jour : 20260604_admin_concierge.sql) → inserts silencieusement
-- rejetés depuis le 06/06/2026, logAuditEvent étant best-effort.
-- On ajoute aussi les actions de facturation à venir (préparation billing).

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
    'PAYMENT_SUCCEEDED','PAYMENT_FAILED'
  ]));
