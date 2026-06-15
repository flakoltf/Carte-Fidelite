-- supabase/migrations/20260616_merchants_phone.sql
--
-- Colonne « fantôme » régularisée : merchants.phone était lue par le code
-- (src/lib/applePass.ts, src/lib/googlePass.ts, src/lib/wallet/identityFromMerchant.ts,
-- src/app/api/merchant/me/route.ts — carte wallet vivante F1) et présente en
-- prod (ajoutée en hotfix le 2026-06-15), mais AUCUNE migration ne la créait :
-- l'init ne pose phone que sur customers, et 20260616_merchant_card_identity.sql
-- supposait à tort « phone existe déjà sur merchants ». Sans ce fichier, un
-- environnement neuf (staging/CI) reconstruit depuis les migrations n'a pas la
-- colonne → l'émission des passes échoue (« column merchants.phone does not exist »).
--
-- 100 % additif et IDEMPOTENT (IF NOT EXISTS) : no-op en prod, garantie partout
-- ailleurs. Aucune AuditAction, pas de migration jumelle du CHECK (invariant 1).

ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS phone text;
