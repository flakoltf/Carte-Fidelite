-- supabase/migrations/20260611_card_design_studio.sql
-- (Agent A — studio de design marchand)
--
-- Studio de design côté marchand : brouillon → aperçu → publication, avec
-- versionnage simple (un entier incrémenté à chaque publication, pour ne
-- jamais casser une carte en circulation sans trace), type de carte
-- extensible (tampons / points / cashback / abonnement) et configuration
-- des tampons (visuels tamponné / non-tamponné, nombre requis).
--
-- Additif uniquement : aucune colonne existante modifiée, aucun défaut changé.
-- ⚠️ À appliquer AVANT le merge de feat/agent-a-experience-marchand : les
-- endpoints marchands /api/merchant/card-design* écrivent ces colonnes.

ALTER TABLE card_designs
  ADD COLUMN IF NOT EXISTS card_type TEXT NOT NULL DEFAULT 'stamps',
  ADD COLUMN IF NOT EXISTS stamps JSONB,
  ADD COLUMN IF NOT EXISTS draft JSONB,
  ADD COLUMN IF NOT EXISTS draft_saved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- DROP puis ADD : ADD CONSTRAINT ne supporte pas IF NOT EXISTS (même pattern
-- que merchants_stamp_goal_range). 'cashback' et 'subscription' sont réservés
-- pour l'extension future — l'UI ne les propose pas encore.
ALTER TABLE card_designs DROP CONSTRAINT IF EXISTS card_designs_card_type_chk;
ALTER TABLE card_designs ADD CONSTRAINT card_designs_card_type_chk
  CHECK (card_type IN ('stamps', 'points', 'cashback', 'subscription'));

-- NB : la policy d'écriture RLS de card_designs reste admin-only — les
-- écritures marchandes passent par les endpoints serveur (service-role +
-- filtre .eq('merchant_id', currentMerchantId()), invariant 3 de CLAUDE.md),
-- exactement comme les 18+ routes marchandes existantes.
