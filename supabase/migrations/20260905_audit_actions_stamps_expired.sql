-- supabase/migrations/20260905_audit_actions_stamps_expired.sql
-- (Échéance glissante des cartes à tampons — cron quotidien points-expiry)
--
-- Migration jumelle du CHECK audit (invariant n°1) : repart de la liste de
-- 20260826_audit_actions_points.sql et ajoute STAMPS_EXPIRED (amount_points
-- réutilise POINTS_EXPIRED, aucune autre valeur nouvelle). À appliquer EN
-- DERNIER (le test auditActionsSync lit la migration lexicalement la plus
-- récente contenant le CHECK ; ce fichier 20260905_* trie après toutes les
-- migrations existantes).

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
    'CARD_DESIGN_DRAFT_SAVED','CARD_DESIGN_PUBLISHED','CARD_ASSET_UPLOADED',
    'MERCHANT_SUSPENDED','MERCHANT_REACTIVATED',
    'MERCHANT_PLAN_CHANGED','MERCHANT_LIMIT_ADJUSTED','MERCHANT_BILLING_UPDATED',
    'MERCHANT_PASSWORD_RESET',
    'ADMIN_NOTE_ADDED','ADMIN_NOTE_DELETED',
    'LEAD_CREATED','LEAD_UPDATED','LEAD_DELETED',
    'ADMIN_CUSTOMER_DATA_ACCESSED','DATA_EXPORTED',
    'FEATURE_FLAG_UPDATED','PLATFORM_SETTING_UPDATED',
    'SIGNUP_STARTED','SIGNUP_EMAIL_VERIFIED',
    'MERCHANT_SELF_PROVISIONED','ONBOARDING_COMPLETED',
    'ONBOARDING_MODE_SELECTED','CONCIERGE_CARD_PROVISIONED',
    'CONCIERGE_DESIGN_DELIVERED',
    'SCAN_REVERTED',
    -- Patch prod HORS REPO découvert à l'application (2026-08-27) : préservé,
    -- sinon les logs de consentement marketing seraient silencieusement rejetés.
    'MARKETING_CONSENT_UPDATED',
    'DEMO_ACCOUNT_SEEDED','DEMO_ACCOUNT_RESET',
    -- Carte à points (2026-08-26)
    'POINTS_EXPIRED',
    -- Échéance glissante des cartes à tampons (2026-09-05)
    'STAMPS_EXPIRED'
  ]));
