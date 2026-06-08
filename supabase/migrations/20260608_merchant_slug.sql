-- Slug public lisible pour les URLs d'enrôlement /c/[slug].
-- Jusqu'ici le commerçant était identifié dans l'URL par enrollment_token (UUID,
-- peu lisible, mauvais pour le SEO/partage). On ajoute un `slug` stable dérivé du
-- shop_name. enrollment_token RESTE l'identifiant soumis au backend (rate-limiting
-- et logique d'enrôlement inchangés) ; le slug ne sert qu'à l'URL publique.

ALTER TABLE merchants ADD COLUMN IF NOT EXISTS slug TEXT;

-- Slugification + garantie d'unicité (suffixe numérique en cas de collision).
CREATE OR REPLACE FUNCTION merchant_slugify(p_shop_name TEXT, p_id UUID)
RETURNS TEXT AS $$
DECLARE
  base TEXT;
  candidate TEXT;
  n INT := 0;
BEGIN
  base := trim(both '-' from regexp_replace(lower(coalesce(p_shop_name, '')), '[^a-z0-9]+', '-', 'g'));
  IF base = '' THEN
    base := 'm-' || left(replace(p_id::text, '-', ''), 8);
  END IF;
  candidate := base;
  WHILE EXISTS (SELECT 1 FROM merchants WHERE slug = candidate AND id <> p_id) LOOP
    n := n + 1;
    candidate := base || '-' || n;
  END LOOP;
  RETURN candidate;
END;
$$ LANGUAGE plpgsql;

-- Backfill des commerçants existants.
UPDATE merchants SET slug = merchant_slugify(shop_name, id) WHERE slug IS NULL OR slug = '';

-- Génération automatique à l'insertion si non fourni (les chemins de création
-- de commerçant n'ont pas besoin d'être modifiés).
CREATE OR REPLACE FUNCTION set_merchant_slug() RETURNS trigger AS $$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := merchant_slugify(NEW.shop_name, NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_merchant_slug ON merchants;
CREATE TRIGGER trg_set_merchant_slug
  BEFORE INSERT ON merchants
  FOR EACH ROW EXECUTE FUNCTION set_merchant_slug();

-- Unicité + présence garanties désormais.
CREATE UNIQUE INDEX IF NOT EXISTS idx_merchants_slug ON merchants(slug);
ALTER TABLE merchants ALTER COLUMN slug SET NOT NULL;
