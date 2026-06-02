-- Correctif sécurité : active RLS sur les tables wallet, oubliées lors de leur
-- création (20260531_push_wallet.sql). Les routes API y accèdent via le
-- service-role (qui bypasse RLS) ; ces policies protègent contre tout accès
-- direct via la clé anon/authenticated. Même pattern que 20240527_rls_policies.sql.

-- wallet_device_registrations -------------------------------------------
-- Accès exclusivement service-role (enregistrement d'appareil PassKit,
-- channel de push, lecture par la segmentation). Aucun accès anon/authenticated.
ALTER TABLE wallet_device_registrations ENABLE ROW LEVEL SECURITY;
-- Aucune policy : deny par défaut pour anon/authenticated ; le service-role bypasse.

-- wallet_notifications --------------------------------------------------
-- Le marchand lit son propre historique via le client RLS
-- (page /dashboard/notifications). Les écritures passent par le service-role
-- (route /api/notifications/send) uniquement.
ALTER TABLE wallet_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wallet notifications scoped to merchant" ON wallet_notifications;
CREATE POLICY "wallet notifications scoped to merchant" ON wallet_notifications
  FOR SELECT USING (
    merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
  );
