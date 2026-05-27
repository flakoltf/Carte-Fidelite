-- Phase 2A : rôle admin/marchand + token d'enrôlement public + RLS admin override.
--
-- Architecture cible :
--   - Le prestataire (role='admin') configure tout depuis /admin/*
--   - Les marchands (role='merchant') scannent les QR et voient leurs stats
--   - Chaque marchand a un enrollment_token UUID stable utilisé sur son QR
--     physique en boutique. Les clients finaux scannent ce QR, remplissent
--     le formulaire d'enrôlement et reçoivent leur carte Wallet.

-- 1. Colonne role -------------------------------------------------------
ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'merchant';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'merchants_role_check'
      AND table_name = 'merchants'
  ) THEN
    ALTER TABLE merchants
      ADD CONSTRAINT merchants_role_check CHECK (role IN ('admin','merchant'));
  END IF;
END$$;

-- 2. Token d'enrôlement public -----------------------------------------
ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS enrollment_token UUID NOT NULL DEFAULT uuid_generate_v4();

CREATE UNIQUE INDEX IF NOT EXISTS idx_merchants_enrollment_token
  ON merchants(enrollment_token);

-- 3. Helper is_admin() : utilisé dans les policies RLS pour donner accès
--    global au prestataire sans recoder la même clause OR partout.
--    SECURITY DEFINER évite les soucis de récursion avec la policy merchants.
CREATE OR REPLACE FUNCTION is_admin() RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM merchants WHERE user_id = auth.uid() AND role = 'admin'
  )
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public;

-- 4. RLS — réécriture avec OR is_admin() ------------------------------
-- merchants
DROP POLICY IF EXISTS "merchant owns row" ON merchants;
CREATE POLICY "merchant owns row" ON merchants
  FOR SELECT USING (auth.uid() = user_id OR is_admin());

DROP POLICY IF EXISTS "merchant inserts own row" ON merchants;
CREATE POLICY "merchant inserts own row" ON merchants
  FOR INSERT WITH CHECK (auth.uid() = user_id OR is_admin());

DROP POLICY IF EXISTS "merchant updates own row" ON merchants;
CREATE POLICY "merchant updates own row" ON merchants
  FOR UPDATE USING (auth.uid() = user_id OR is_admin())
  WITH CHECK (auth.uid() = user_id OR is_admin());

DROP POLICY IF EXISTS "admin deletes merchants" ON merchants;
CREATE POLICY "admin deletes merchants" ON merchants
  FOR DELETE USING (is_admin());

-- customers
DROP POLICY IF EXISTS "customers scoped to merchant" ON customers;
CREATE POLICY "customers scoped to merchant" ON customers
  FOR SELECT USING (
    merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
    OR is_admin()
  );

-- loyalty_cards
DROP POLICY IF EXISTS "cards scoped to merchant" ON loyalty_cards;
CREATE POLICY "cards scoped to merchant" ON loyalty_cards
  FOR SELECT USING (
    merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
    OR is_admin()
  );

-- scan_history
DROP POLICY IF EXISTS "scans scoped to merchant" ON scan_history;
CREATE POLICY "scans scoped to merchant" ON scan_history
  FOR SELECT USING (
    merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
    OR is_admin()
  );

-- audit_logs
DROP POLICY IF EXISTS "audit scoped to merchant" ON audit_logs;
CREATE POLICY "audit scoped to merchant" ON audit_logs
  FOR SELECT USING (
    merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
    OR is_admin()
  );
