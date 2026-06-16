-- supabase/migrations/20260618_audit_actions_demo.sql
-- (Compte démo de prospection — seed/reset 1-clic)
--
-- Migration jumelle du CHECK audit (invariant n°1). À appliquer EN DERNIER (le
-- test auditActionsSync lit la migration lexicalement la plus récente contenant
-- le CHECK ; ce fichier 20260618_* trie après tous les 2026061x existants).
--
-- CORRECTION DE FIDÉLITÉ (PR chore/db-hygiene) : ce fichier reproduit désormais
-- À L'IDENTIQUE le statement RÉELLEMENT appliqué en prod (schema_migrations
-- version 20260615213952), qui « repart de la liste LIVE en prod et préserve
-- MARKETING_CONSENT_UPDATED ». La copie repo précédente avait perdu cette action
-- (drift BLOC 2.6 de l'audit du 16/06) → un fresh-db divergeait de la prod.
-- On RAJOUTE donc MARKETING_CONSENT_UPDATED (entre SCAN_REVERTED et les actions
-- DEMO_*). La liste finale = 51 actions, identique au CHECK live.

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
    'SCAN_REVERTED','MARKETING_CONSENT_UPDATED',
    -- Compte démo de prospection (2026-06-18)
    'DEMO_ACCOUNT_SEEDED','DEMO_ACCOUNT_RESET'
  ]));
