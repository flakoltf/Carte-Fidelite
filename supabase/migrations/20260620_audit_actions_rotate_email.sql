-- supabase/migrations/20260620_audit_actions_rotate_email.sql
-- (Outillage de prospection — rotation mot de passe démo + smoke email Resend)
--
-- Migration jumelle du CHECK audit (invariant n°1) : repart de la liste de
-- 20260618_audit_actions_demo.sql et ajoute :
--   • DEMO_ACCOUNT_ROTATED  — rotation 1-clic du mot de passe du compte démo
--   • EMAIL_SMOKE_SENT      — envoi d'un email test Resend (diagnostic 1-clic)
--   • MARKETING_CONSENT_UPDATED — orphelin de prod formalisé (présent en base,
--       absent du CHECK et du code avant ce jour — cf. audit 2026-06-16). Le
--       ré-ajouter ici est aussi nécessaire pour que DROP+ADD valide sans échec
--       contre les lignes existantes.
--
-- À appliquer EN DERNIER (le test auditActionsSync lit la migration lexicalement
-- la plus récente contenant le CHECK ; ce fichier 20260620_* trie après tous les
-- 2026061x existants, y compris 20260618_audit_actions_demo.sql).

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
    'DEMO_ACCOUNT_SEEDED','DEMO_ACCOUNT_RESET',
    -- Outillage de prospection (2026-06-20)
    'DEMO_ACCOUNT_ROTATED','EMAIL_SMOKE_SENT',
    -- Orphelin de prod formalisé (2026-06-20)
    'MARKETING_CONSENT_UPDATED'
  ]));
