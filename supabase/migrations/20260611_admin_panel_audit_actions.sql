-- supabase/migrations/20260611_admin_panel_audit_actions.sql
-- (Agent B — panneau super-admin)

-- Migration jumelle de AUDIT_ACTIONS (src/lib/auditLog.ts) — invariant n°1 :
-- toute nouvelle action absente du CHECK est silencieusement rejetée.
-- Ajouts panneau admin : contrôle marchand (suspension, palier, limites,
-- facturation, reset mot de passe), CRM (notes, leads), accès aux données
-- personnelles (nLPD), exports, et réglages plateforme (flags, settings).

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
    -- Panneau super-admin (2026-06-11)
    'MERCHANT_SUSPENDED','MERCHANT_REACTIVATED',
    'MERCHANT_PLAN_CHANGED','MERCHANT_LIMIT_ADJUSTED','MERCHANT_BILLING_UPDATED',
    'MERCHANT_PASSWORD_RESET',
    'ADMIN_NOTE_ADDED','ADMIN_NOTE_DELETED',
    'LEAD_CREATED','LEAD_UPDATED','LEAD_DELETED',
    'ADMIN_CUSTOMER_DATA_ACCESSED','DATA_EXPORTED',
    'FEATURE_FLAG_UPDATED','PLATFORM_SETTING_UPDATED'
  ]));
