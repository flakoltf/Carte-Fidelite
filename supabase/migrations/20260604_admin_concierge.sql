-- supabase/migrations/20260604_admin_concierge.sql

-- 1) Drapeau "mode de gestion" (étiquette : le commerçant garde son accès)
ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS managed_by_concierge BOOLEAN NOT NULL DEFAULT false;

-- 2) Nouveaux types d'action d'audit pour l'impersonation
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_check
  CHECK (action = ANY (ARRAY[
    'CARD_GENERATED','CARD_SCANNED','POINTS_INCREMENTED',
    'LOGIN_SUCCESS','LOGIN_FAILED','MERCHANT_CREATED','CUSTOMER_DELETED',
    'MERCHANT_UPDATED','MERCHANT_TOKEN_ROTATED','REWARD_REDEEMED',
    'CUSTOMER_UPDATED','MFA_ENROLLED','MFA_DISABLED',
    'ADMIN_IMPERSONATION_START','ADMIN_IMPERSONATION_STOP'
  ]));

-- 3) Correctif : la policy SELECT de campaigns oubliait l'override admin
DROP POLICY IF EXISTS "campaigns scoped to merchant" ON campaigns;
CREATE POLICY "campaigns scoped to merchant" ON campaigns
  FOR SELECT USING (
    merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
    OR is_admin()
  );
