-- supabase/migrations/20260612_audit_actions_merged.sql

-- Union des actions d'audit des deux branches d'agents fusionnées :
--   Agent A (studio marchand)   : 20260611_audit_actions_studio.sql (+3)
--   Agent B (panneau super-admin): 20260611_admin_panel_audit_actions.sql (+15)
-- Chacune recréait le CHECK sans connaître l'autre — cette migration, appliquée
-- EN DERNIER, rétablit l'union complète (40 actions). C'est elle que le test
-- auditActionsSync.test.ts lit comme référence (lexicalement la plus récente).

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
    'FEATURE_FLAG_UPDATED','PLATFORM_SETTING_UPDATED'
  ]));
