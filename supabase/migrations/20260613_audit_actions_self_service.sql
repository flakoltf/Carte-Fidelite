-- supabase/migrations/20260613_audit_actions_self_service.sql
-- (Agent C — parcours self-service)
--
-- Migration jumelle du CHECK audit (invariant n°1) : repart de la liste à
-- 40 actions de 20260612_audit_actions_merged.sql et ajoute les 4 actions du
-- parcours self-service. À appliquer EN DERNIER (le test auditActionsSync lit
-- la migration lexicalement la plus récente contenant le CHECK).

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
    -- Agent A (studio marchand)
    'CARD_DESIGN_DRAFT_SAVED','CARD_DESIGN_PUBLISHED','CARD_ASSET_UPLOADED',
    -- Agent B (panneau super-admin)
    'MERCHANT_SUSPENDED','MERCHANT_REACTIVATED',
    'MERCHANT_PLAN_CHANGED','MERCHANT_LIMIT_ADJUSTED','MERCHANT_BILLING_UPDATED',
    'MERCHANT_PASSWORD_RESET',
    'ADMIN_NOTE_ADDED','ADMIN_NOTE_DELETED',
    'LEAD_CREATED','LEAD_UPDATED','LEAD_DELETED',
    'ADMIN_CUSTOMER_DATA_ACCESSED','DATA_EXPORTED',
    'FEATURE_FLAG_UPDATED','PLATFORM_SETTING_UPDATED',
    -- Agent C (parcours self-service)
    'SIGNUP_STARTED','SIGNUP_EMAIL_VERIFIED',
    'MERCHANT_SELF_PROVISIONED','ONBOARDING_COMPLETED'
  ]));
