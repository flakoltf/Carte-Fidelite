-- Alerte de dépassement de palier (cron billing-snapshot).
--
-- 1) Mémoriser le niveau d'alerte déjà notifié pour la période, afin de ne pas
--    ré-alerter tant que la sévérité n'a pas monté (idempotence côté données).
-- 2) Permettre une note « système » dans admin_notes : l'alerte n'a pas d'auteur
--    humain. On rend author_user_id nullable et on trace l'origine via `source`.
--
-- Aucune donnée détruite ; colonnes additives, valeurs par défaut sûres.

-- 1) Niveau d'alerte figé sur le snapshot mensuel ('near' | 'over' | NULL).
ALTER TABLE billing_snapshots
  ADD COLUMN IF NOT EXISTS alert_level TEXT;

ALTER TABLE billing_snapshots
  DROP CONSTRAINT IF EXISTS billing_snapshots_alert_level_check;
ALTER TABLE billing_snapshots
  ADD CONSTRAINT billing_snapshots_alert_level_check
  CHECK (alert_level IS NULL OR alert_level IN ('near', 'over'));

-- 2) Notes système : auteur facultatif + provenance.
ALTER TABLE admin_notes
  ALTER COLUMN author_user_id DROP NOT NULL;

ALTER TABLE admin_notes
  ADD COLUMN IF NOT EXISTS source TEXT;

-- Intégrité : une note a soit un auteur humain, soit une provenance système.
ALTER TABLE admin_notes
  DROP CONSTRAINT IF EXISTS admin_notes_author_or_source_check;
ALTER TABLE admin_notes
  ADD CONSTRAINT admin_notes_author_or_source_check
  CHECK (author_user_id IS NOT NULL OR source IS NOT NULL);
