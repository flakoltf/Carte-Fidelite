-- Historique versionné des designs de carte (studio).
--
-- Aujourd'hui, card_designs.version est un simple compteur écrasé en place : les
-- versions publiées antérieures ne sont conservées nulle part. Cette table
-- immuable garde un instantané (snapshot) du design à CHAQUE publication, pour
-- ne jamais perdre une version déjà en circulation et permettre un diff.
--
-- Additif : ne touche pas card_designs. RLS identique aux autres tables (lecture
-- marchand-propriétaire OU admin ; écriture réservée au service-role, comme
-- card_designs — cf. 20260606_card_designs.sql / 20260611_card_design_studio.sql).

CREATE TABLE IF NOT EXISTS card_design_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  version INT NOT NULL,
  -- Instantané du CardDesign publié (payload jsonb complet, source de vérité
  -- de cette version). Immuable : une ligne par publication.
  snapshot JSONB NOT NULL,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Auteur de la publication (nullable : publication système/concierge possible).
  published_by UUID,
  UNIQUE (merchant_id, version)
);

ALTER TABLE card_design_versions ENABLE ROW LEVEL SECURITY;

-- Lecture : le marchand propriétaire OU l'admin (même prédicat que card_designs).
CREATE POLICY "card_design_versions select" ON card_design_versions
  FOR SELECT USING (
    is_admin() OR merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
  );

-- Pas de policy d'écriture : les insertions passent par le service-role
-- (route publish), qui bypass RLS — cohérent avec l'invariant tenancy.

CREATE INDEX IF NOT EXISTS idx_card_design_versions_merchant
  ON card_design_versions (merchant_id, version DESC);
