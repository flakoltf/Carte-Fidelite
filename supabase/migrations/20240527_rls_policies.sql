-- Row Level Security on all business tables.
-- API routes use the service role (bypasses RLS); these policies protect
-- direct access via the anon key (signup, settings page, any future client query).

-- merchants -------------------------------------------------------------
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "merchant owns row" ON merchants;
CREATE POLICY "merchant owns row" ON merchants
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "merchant inserts own row" ON merchants;
CREATE POLICY "merchant inserts own row" ON merchants
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "merchant updates own row" ON merchants;
CREATE POLICY "merchant updates own row" ON merchants
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- customers -------------------------------------------------------------
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "customers scoped to merchant" ON customers;
CREATE POLICY "customers scoped to merchant" ON customers
  FOR SELECT USING (
    merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
  );

-- INSERT/UPDATE/DELETE on customers must go through the service role
-- (API routes) so we deliberately do not expose write policies to anon.

-- loyalty_cards ---------------------------------------------------------
ALTER TABLE loyalty_cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cards scoped to merchant" ON loyalty_cards;
CREATE POLICY "cards scoped to merchant" ON loyalty_cards
  FOR SELECT USING (
    merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
  );

-- scan_history ----------------------------------------------------------
ALTER TABLE scan_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scans scoped to merchant" ON scan_history;
CREATE POLICY "scans scoped to merchant" ON scan_history
  FOR SELECT USING (
    merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
  );

-- audit_logs ------------------------------------------------------------
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit scoped to merchant" ON audit_logs;
CREATE POLICY "audit scoped to merchant" ON audit_logs
  FOR SELECT USING (
    merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
  );

-- INSERTs into audit_logs are done by the service role only.
-- The append-only triggers from 20240508_audit_logs.sql remain in effect.
