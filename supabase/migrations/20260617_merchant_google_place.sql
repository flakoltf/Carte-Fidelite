-- supabase/migrations/20260617_merchant_google_place.sql
-- (Feature 2 — lien « Laisser un avis Google » au moment magique)
--
-- Place ID Google de l'établissement, pour construire le lien de dépôt d'avis
-- poussé sur la carte quand une récompense vient d'être débloquée. Additif ;
-- RLS inchangé. Le format est validé applicativement (préfixe ChIJ).
ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS google_place_id TEXT
    CHECK (google_place_id IS NULL OR google_place_id ~ '^ChIJ[A-Za-z0-9_-]{10,256}$');
