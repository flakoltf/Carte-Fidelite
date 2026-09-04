-- supabase/migrations/20260904_leads_formulaire_enrichi.sql

-- Formulaire /demarrer enrichi : nom du contact, téléphone et message libre.
-- Colonnes ADDITIVES et nullables uniquement — les leads existants restent valides.
-- Le secteur d'activité réutilise la colonne `trade` existante ; l'email du
-- prospect vit dans la colonne `contact` existante (NOT NULL préservé).
-- Aucun changement de policy : écriture service-role uniquement, lecture admin.
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS contact_name TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS message TEXT;
