-- supabase/migrations/20260611_audit_actions_marketing_consent.sql
--
-- FORMALISATION D'UNE MIGRATION PROD ORPHELINE (appliquée hors-repo).
-- Reproduite À L'IDENTIQUE depuis supabase_migrations.schema_migrations
-- (version 20260611223654, name « audit_actions_marketing_consent ») — appliquée
-- en prod le 2026-06-11 22:36:54 mais jamais committée. C'est CETTE migration qui
-- a introduit MARKETING_CONSENT_UPDATED dans le CHECK live (l'orphelin signalé
-- BLOC 2.6 de l'audit du 16/06). NON ré-appliquée ici (idempotente).
--
-- Note d'ordonnancement : les migrations audit ultérieures (20260613/14/15/18)
-- réécrivent l'intégralité du CHECK ; la pérennité de MARKETING_CONSENT_UPDATED
-- est assurée par 20260618_audit_actions_demo.sql, qui repart de la liste LIVE
-- (corrigé dans cette même PR pour matcher le statement réellement appliqué en
-- prod). Ce fichier-ci documente l'historique fidèle de la prod.

-- CHECK audit : 48 -> 49 actions (ajout MARKETING_CONSENT_UPDATED), idempotente
ALTER TABLE public.audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;
ALTER TABLE public.audit_logs ADD CONSTRAINT audit_logs_action_check CHECK (action = ANY (ARRAY[
  'CARD_GENERATED','CARD_SCANNED','POINTS_INCREMENTED','LOGIN_SUCCESS','LOGIN_FAILED',
  'MERCHANT_CREATED','CUSTOMER_DELETED','MERCHANT_UPDATED','MERCHANT_TOKEN_ROTATED','REWARD_REDEEMED',
  'CUSTOMER_UPDATED','MFA_ENROLLED','MFA_DISABLED','ADMIN_IMPERSONATION_START','ADMIN_IMPERSONATION_STOP',
  'CARD_DESIGN_UPDATED','CARD_CLASS_SYNCED','SUBSCRIPTION_CREATED','SUBSCRIPTION_UPDATED','SUBSCRIPTION_CANCELED',
  'PAYMENT_SUCCEEDED','PAYMENT_FAILED','CARD_DESIGN_DRAFT_SAVED','CARD_DESIGN_PUBLISHED','CARD_ASSET_UPLOADED',
  'MERCHANT_SUSPENDED','MERCHANT_REACTIVATED','MERCHANT_PLAN_CHANGED','MERCHANT_LIMIT_ADJUSTED','MERCHANT_BILLING_UPDATED',
  'MERCHANT_PASSWORD_RESET','ADMIN_NOTE_ADDED','ADMIN_NOTE_DELETED','LEAD_CREATED','LEAD_UPDATED',
  'LEAD_DELETED','ADMIN_CUSTOMER_DATA_ACCESSED','DATA_EXPORTED','FEATURE_FLAG_UPDATED','PLATFORM_SETTING_UPDATED',
  'SIGNUP_STARTED','SIGNUP_EMAIL_VERIFIED','MERCHANT_SELF_PROVISIONED','ONBOARDING_COMPLETED','ONBOARDING_MODE_SELECTED',
  'CONCIERGE_CARD_PROVISIONED','CONCIERGE_DESIGN_DELIVERED','SCAN_REVERTED','MARKETING_CONSENT_UPDATED'
]));
