-- supabase/migrations/20260610_loyalty_cards_unique.sql

-- Le find-or-create de api/enroll/route.ts a une fenêtre de course : deux
-- soumissions simultanées créent deux cartes pour le même couple client/marchand,
-- ce qui fausse le comptage « cartes actives » (l'unité de facturation).
-- 1) Dédoublonnage préalable : on garde la carte la plus avancée (max tampons,
--    puis la plus ancienne) ; ses doublons sont supprimés (CASCADE sur scan_history).
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY customer_id, merchant_id
           ORDER BY stamps_count DESC NULLS LAST, created_at ASC, id
         ) AS rn
  FROM loyalty_cards
  WHERE customer_id IS NOT NULL AND merchant_id IS NOT NULL
)
DELETE FROM loyalty_cards
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- 2) Plus jamais de doublon : la contrainte tranche les courses (code 23505,
--    géré dans api/enroll/route.ts comme pour customers).
ALTER TABLE loyalty_cards
  ADD CONSTRAINT loyalty_cards_customer_merchant_unique
  UNIQUE (customer_id, merchant_id);
