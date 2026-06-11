-- supabase/migrations/20260613_self_service_signup.sql
-- (Agent C — parcours self-service)
--
-- Fondation du parcours d'inscription autonome : provenance du compte,
-- progression d'onboarding, couture d'abonnement (sans Stripe) et
-- provisioning ATOMIQUE + IDEMPOTENT du tenant.
-- 100 % ADDITIF : aucune colonne/table/policy existante modifiée.
--
-- ⚠️ Pré-requis d'application : vérifier qu'aucun user_id n'est dupliqué dans
-- merchants (l'index unique partiel échouerait sinon) :
--   SELECT user_id, COUNT(*) FROM merchants
--   WHERE user_id IS NOT NULL GROUP BY user_id HAVING COUNT(*) > 1;

-- ── 1. Colonnes additives sur merchants ─────────────────────────────────────
ALTER TABLE merchants
  -- Provenance du compte : créé par l'admin (concierge) ou en self-service.
  ADD COLUMN IF NOT EXISTS signup_source TEXT NOT NULL DEFAULT 'concierge'
    CHECK (signup_source IN ('concierge', 'self_service')),
  -- Progression du wizard /onboarding (sauvegarde-et-reprise). NULL pour les
  -- comptes concierge : ils ne passent pas par le wizard.
  ADD COLUMN IF NOT EXISTS onboarding_step TEXT
    CHECK (onboarding_step IS NULL
           OR onboarding_step IN ('profile', 'program', 'design', 'plan', 'launch', 'done')),
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
  -- Couture d'abonnement. La sémantique « suspendu » N'EST PAS dupliquée ici :
  -- merchants.suspended_at (panneau admin) reste l'unique source — le statut
  -- effectif est dérivé en code (src/lib/billing/subscription.ts).
  ADD COLUMN IF NOT EXISTS billing_status TEXT NOT NULL DEFAULT 'active'
    CHECK (billing_status IN ('trial', 'active', 'pending')),
  ADD COLUMN IF NOT EXISTS billing_provider TEXT NOT NULL DEFAULT 'manual'
    CHECK (billing_provider IN ('manual', 'stripe')),
  -- Références opaques chez le prestataire de paiement (Stripe plus tard :
  -- customer id / subscription id). NULL tant que provider = 'manual'.
  ADD COLUMN IF NOT EXISTS billing_customer_ref TEXT,
  ADD COLUMN IF NOT EXISTS billing_subscription_ref TEXT;

-- ── 2. Unicité user_id ↔ merchant (provisioning idempotent) ─────────────────
-- Jusqu'ici simple index non-unique (20240422_add_auth.sql). L'unicité permet
-- l'ON CONFLICT du provisioning : un double clic sur le lien de confirmation
-- ne crée jamais deux tenants.
CREATE UNIQUE INDEX IF NOT EXISTS idx_merchants_user_id_unique
  ON merchants (user_id) WHERE user_id IS NOT NULL;

-- ── 3. Provisioning atomique du tenant self-service ────────────────────────
-- UNE transaction : ligne merchants complète (rôle 'merchant' fixé ICI, jamais
-- depuis une entrée client) + programme par défaut (stamp_card/objectif 10 via
-- les DEFAULT des colonnes) + abonnement de lancement (essai p_trial_days
-- jours, ou 'active' si 0). Le slug est généré par le trigger existant
-- trg_set_merchant_slug. Idempotent : re-appel → renvoie le tenant existant.
CREATE OR REPLACE FUNCTION provision_self_service_merchant(
  p_user_id UUID,
  p_email TEXT,
  p_trial_days INT DEFAULT 30
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_user_id IS NULL OR length(trim(coalesce(p_email, ''))) = 0 THEN
    RAISE EXCEPTION 'provision_self_service_merchant: paramètres invalides';
  END IF;

  INSERT INTO merchants (
    user_id, email, shop_name, role,
    signup_source, onboarding_step,
    plan, billing_cycle, billing_provider, billing_status,
    trial_ends_at, plan_started_at
  )
  VALUES (
    p_user_id, lower(trim(p_email)), 'Mon commerce', 'merchant',
    'self_service', 'profile',
    'essentiel', 'monthly', 'manual',
    CASE WHEN COALESCE(p_trial_days, 0) > 0 THEN 'trial' ELSE 'active' END,
    CASE WHEN COALESCE(p_trial_days, 0) > 0 THEN now() + make_interval(days => p_trial_days) ELSE NULL END,
    now()
  )
  ON CONFLICT (user_id) WHERE user_id IS NOT NULL DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM merchants WHERE user_id = p_user_id;
  END IF;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Service-role uniquement : jamais appelable par un client anon/authentifié.
REVOKE ALL ON FUNCTION provision_self_service_merchant(UUID, TEXT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION provision_self_service_merchant(UUID, TEXT, INT) FROM anon;
REVOKE ALL ON FUNCTION provision_self_service_merchant(UUID, TEXT, INT) FROM authenticated;

-- ── 4. Profil commerce du wizard (nom + slug recalculé, atomique) ──────────
-- Le tenant est provisionné avec un nom placeholder ; quand le commerçant
-- saisit son vrai nom (étape « profil »), le slug public est recalculé dans la
-- MÊME transaction via merchant_slugify (collisions gérées) — mais UNIQUEMENT
-- tant que l'onboarding n'est pas terminé (après, le QR peut être imprimé :
-- l'URL publique ne doit plus bouger).
CREATE OR REPLACE FUNCTION self_service_apply_profile(
  p_merchant_id UUID,
  p_shop_name TEXT,
  p_business_type TEXT,
  p_address TEXT
) RETURNS TEXT AS $$
DECLARE
  v_slug TEXT;
BEGIN
  IF p_merchant_id IS NULL OR length(trim(coalesce(p_shop_name, ''))) NOT BETWEEN 2 AND 100 THEN
    RAISE EXCEPTION 'self_service_apply_profile: paramètres invalides';
  END IF;

  UPDATE merchants SET
    shop_name = trim(p_shop_name),
    business_type = COALESCE(NULLIF(trim(coalesce(p_business_type, '')), ''), business_type),
    address = NULLIF(trim(coalesce(p_address, '')), ''),
    slug = CASE WHEN onboarding_completed_at IS NULL
                THEN merchant_slugify(trim(p_shop_name), id)
                ELSE slug END,
    onboarding_step = CASE WHEN onboarding_completed_at IS NULL THEN 'program' ELSE onboarding_step END
  WHERE id = p_merchant_id
  RETURNING slug INTO v_slug;

  IF v_slug IS NULL THEN
    RAISE EXCEPTION 'self_service_apply_profile: marchand introuvable';
  END IF;
  RETURN v_slug;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION self_service_apply_profile(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION self_service_apply_profile(UUID, TEXT, TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION self_service_apply_profile(UUID, TEXT, TEXT, TEXT) FROM authenticated;

-- ── 5. Feature flag (ÉTEINT par défaut) ────────────────────────────────────
-- Géré depuis /admin/settings (panneau Agent B). Tant qu'il est FALSE,
-- /signup garde son comportement actuel (redirection /login).
INSERT INTO feature_flags (key, enabled, description) VALUES
  ('self_service_signup', FALSE,
   'Inscription self-service publique (/signup → wizard /onboarding). OFF : /signup redirige vers /login (comportement concierge actuel).')
ON CONFLICT (key) DO NOTHING;
