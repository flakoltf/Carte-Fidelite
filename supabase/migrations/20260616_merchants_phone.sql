-- supabase/migrations/20260616_merchants_phone.sql
-- (Réconciliation hotfix — Feature 1, carte wallet vivante)
--
-- merchants.phone est LU par le code (applePass.ts, googlePass.ts,
-- /api/merchant/me) pour l'afficher au dos du pass, mais aucune migration ne le
-- créait : la migration jumelle 20260616_merchant_card_identity.sql supposait à
-- tort que la colonne « existe déjà sur merchants » (elle confondait avec
-- customers.phone). La colonne a été ajoutée à la main en prod en hotfix ce jour ;
-- ce fichier rend l'ajout permanent pour staging / CI / local, sinon le bug
-- (colonne manquante) réapparaît hors prod.
--
-- Idempotent (IF NOT EXISTS) : sûr même là où le hotfix est déjà appliqué.
-- 100 % additif ; RLS inchangé (couvert par les policies merchants existantes).

ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS phone text;
