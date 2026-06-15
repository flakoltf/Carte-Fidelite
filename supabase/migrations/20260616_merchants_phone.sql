-- supabase/migrations/20260616_merchants_phone.sql
-- (Hotfix F1 — colonne merchants.phone manquante)
--
-- La couche identité F1 (carte vivante) SELECT merchants.phone à trois endroits
-- (/api/merchant/me, applePass.ts, googlePass.ts), mais la migration F1
-- (20260616_merchant_card_identity) n'a ajouté que reward_label + business_hours :
-- elle supposait à tort que `phone` existait déjà. Résultat en prod : la requête
-- échouait (SQLSTATE 42703 « column merchants.phone does not exist »), le SELECT
-- renvoyait error → data=null, et /api/merchant/me répondait { merchant: null }
-- → /dashboard/card affichait « page d'inscription pas prête » (erreur masquée
-- par un front qui avalait l'erreur).
--
-- 100 % ADDITIF, idempotent. Déjà appliqué en prod en hotfix le 15.06 ; ce
-- fichier aligne l'historique de migrations sur la prod.
ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS phone TEXT;
