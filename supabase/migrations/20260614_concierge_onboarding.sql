-- supabase/migrations/20260614_concierge_onboarding.sql
-- (Onboarding double parcours — fork « Je crée ma carte » / « HALO crée ma carte »)
--
-- 100 % ADDITIF : colonnes nouvelles + une fonction transactionnelle.
-- Aucune colonne/contrainte existante modifiée — le wizard self actuel
-- (onboarding_step, signup_source…) reste strictement intact.

-- ── 1. Colonnes additives sur merchants ─────────────────────────────────────
ALTER TABLE merchants
  -- Mode choisi au fork de l'onboarding. NULL = pas encore choisi (ou compte
  -- antérieur au fork). Distinct de signup_source (provenance du COMPTE).
  ADD COLUMN IF NOT EXISTS setup_mode TEXT
    CHECK (setup_mode IS NULL OR setup_mode IN ('self', 'concierge')),
  -- File « cartes à personnaliser » : demandé à la mise en ligne concierge,
  -- soldé quand l'équipe a livré le design sur-mesure.
  ADD COLUMN IF NOT EXISTS concierge_design_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS concierge_design_done_at TIMESTAMPTZ;

-- Index partiel pour la file admin (lignes en attente uniquement).
CREATE INDEX IF NOT EXISTS idx_merchants_concierge_pending
  ON merchants (concierge_design_requested_at)
  WHERE concierge_design_requested_at IS NOT NULL
    AND concierge_design_done_at IS NULL;

-- ── 2. Mise en ligne concierge — ATOMIQUE ───────────────────────────────────
-- UNE transaction : profil (nom/secteur/adresse) + slug public recalculé
-- (merchant_slugify, collisions gérées) + programme par défaut du secteur
-- (stamp_card, objectif borné 2–30) + onboarding terminé + entrée dans la
-- file de personnalisation. Le QR est donc actif dès le retour de l'appel —
-- la carte provisoire utilise le design par défaut, l'équipe affine ensuite.
-- Idempotent : re-appel après complétion → renvoie le slug sans rien toucher
-- (l'URL publique d'un QR potentiellement déjà imprimé ne bouge JAMAIS).
CREATE OR REPLACE FUNCTION concierge_launch_merchant(
  p_merchant_id UUID,
  p_shop_name TEXT,
  p_business_type TEXT,
  p_address TEXT,
  p_stamp_goal INT DEFAULT 10
) RETURNS TEXT AS $$
DECLARE
  v_slug TEXT;
  v_done TIMESTAMPTZ;
BEGIN
  IF p_merchant_id IS NULL OR length(trim(coalesce(p_shop_name, ''))) NOT BETWEEN 2 AND 100 THEN
    RAISE EXCEPTION 'concierge_launch_merchant: paramètres invalides';
  END IF;

  SELECT onboarding_completed_at INTO v_done FROM merchants WHERE id = p_merchant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'concierge_launch_merchant: marchand introuvable';
  END IF;

  -- Déjà en ligne : ne rien recalculer (slug figé), renvoyer l'existant.
  IF v_done IS NOT NULL THEN
    SELECT slug INTO v_slug FROM merchants WHERE id = p_merchant_id;
    RETURN v_slug;
  END IF;

  UPDATE merchants SET
    shop_name = trim(p_shop_name),
    business_type = COALESCE(NULLIF(trim(coalesce(p_business_type, '')), ''), business_type),
    address = NULLIF(trim(coalesce(p_address, '')), ''),
    slug = merchant_slugify(trim(p_shop_name), id),
    loyalty_type = 'stamp_card',
    stamp_goal = LEAST(30, GREATEST(2, COALESCE(p_stamp_goal, 10))),
    setup_mode = 'concierge',
    onboarding_step = 'done',
    onboarding_completed_at = now(),
    concierge_design_requested_at = COALESCE(concierge_design_requested_at, now())
  WHERE id = p_merchant_id
  RETURNING slug INTO v_slug;

  RETURN v_slug;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Service-role uniquement (même posture que provision_self_service_merchant).
REVOKE ALL ON FUNCTION concierge_launch_merchant(UUID, TEXT, TEXT, TEXT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION concierge_launch_merchant(UUID, TEXT, TEXT, TEXT, INT) FROM anon;
REVOKE ALL ON FUNCTION concierge_launch_merchant(UUID, TEXT, TEXT, TEXT, INT) FROM authenticated;
