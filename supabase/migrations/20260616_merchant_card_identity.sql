-- supabase/migrations/20260616_merchant_card_identity.sql
-- (Feature 1 — carte wallet vivante)
--
-- Champs d'IDENTITÉ commerce poussés sur la carte wallet. Ce ne sont pas des
-- choix créatifs de design (qui vivent dans card_designs / le studio) mais des
-- données du commerce affichées sur tout pass, quel que soit le design.
-- 100 % additif ; RLS inchangé (couverts par les policies merchants existantes).
-- address, phone, latitude, longitude, logo_url existent déjà sur merchants.

ALTER TABLE merchants
  -- Libellé de récompense personnalisé (« Un café offert », « -10% »…), affiché
  -- en clair sur la carte. Borné 1-80 ; NULL = champ omis du pass.
  ADD COLUMN IF NOT EXISTS reward_label TEXT
    CHECK (reward_label IS NULL OR char_length(reward_label) BETWEEN 1 AND 80),
  -- Horaires d'ouverture : { mon:{open,close}|null, …, sun:… } (HH:MM 24h).
  -- L'« horaire du jour » est calculé serveur (Europe/Zurich) à l'émission.
  ADD COLUMN IF NOT EXISTS business_hours JSONB NOT NULL DEFAULT '{}'::jsonb;
