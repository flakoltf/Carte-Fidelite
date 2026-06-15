-- supabase/migrations/20260617_merchants_phone.sql
-- (Hotfix F1 — colonne merchants.phone manquante)
--
-- La migration 20260616_merchant_card_identity.sql supposait à tort que la
-- colonne `phone` existait déjà sur merchants (cf. son commentaire :
-- « address, phone, latitude, longitude, logo_url existent déjà »). En réalité
-- `phone` n'a JAMAIS été créé. Or le code F1 la lit
-- (src/app/api/merchant/me/route.ts, src/lib/wallet/identityFromMerchant.ts),
-- ce qui provoquait en prod « column merchants.phone does not exist » (42703) :
-- la requête /api/merchant/me échouait, renvoyait merchant=null, et
-- /dashboard/card affichait « page d'inscription pas prête » à tort.
--
-- 100 % additif ; RLS inchangé. Appliqué en hotfix prod le 2026-06-15, ce
-- fichier le rend permanent (staging / CI / resets). Idempotent.

ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS phone TEXT;
