-- Mise à jour de la table merchants pour lier aux comptes utilisateurs Supabase Auth
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#10b981'; -- Emerald 500 par défaut

-- Index pour accélérer la recherche par utilisateur
CREATE INDEX IF NOT EXISTS idx_merchants_user_id ON merchants(user_id);
