-- supabase/migrations/20260619_fix_google_place_check.sql
-- (Fix du CHECK google_place_id — bug latent de F2)
--
-- La migration 20260617_merchant_google_place.sql posait
--   CHECK (google_place_id ~ '^ChIJ[A-Za-z0-9_-]{10,256}$')
-- Or Postgres plafonne les répétitions d'une regex à 255 : {10,256} lève
-- « invalid regular expression: invalid repetition count(s) » sur TOUTE écriture
-- d'un google_place_id non-null (resté latent jusqu'au 1er usage — compte démo).
-- On rabaisse la borne à 255 (les Place IDs Google font ~27 caractères).
-- Appliqué en prod en hotfix le 2026-06-15.
ALTER TABLE merchants DROP CONSTRAINT IF EXISTS merchants_google_place_id_check;
ALTER TABLE merchants ADD CONSTRAINT merchants_google_place_id_check
  CHECK (google_place_id IS NULL OR google_place_id ~ '^ChIJ[A-Za-z0-9_-]{10,255}$');
