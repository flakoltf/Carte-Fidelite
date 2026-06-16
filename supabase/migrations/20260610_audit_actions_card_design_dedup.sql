-- supabase/migrations/20260610_audit_actions_card_design_dedup.sql
--
-- CONSOLIDATION D'UNE DOUBLE-MIGRATION PROD (no-op idempotent).
--
-- La prod porte DEUX lignes schema_migrations nommées « audit_actions_card_design » :
--   • 20260609112659 — version intermédiaire (17 actions, jusqu'à CARD_CLASS_SYNCED) ;
--   • 20260610180823 — version finale (22 actions, + SUBSCRIPTION_*/PAYMENT_*).
-- Le repo ne porte qu'UN fichier (20260610_audit_actions_card_design.sql = la
-- version finale 22 actions). Un fresh-db converge donc déjà sur l'état prod ;
-- aucune correction de données n'est requise.
--
-- Ce fichier ne fait que RÉ-AFFIRMER l'état consolidé (DROP IF EXISTS + ADD),
-- pour tracer explicitement la déduplication dans l'historique du repo. Il est
-- idempotent et sûr (réécrit par les migrations audit 2026061x ultérieures).
-- NON ré-appliqué en prod.

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
