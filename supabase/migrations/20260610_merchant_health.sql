-- supabase/migrations/20260610_merchant_health.sql

-- Vue santé marchand : score 0-100 + statut vert/orange/rouge. Outil interne
-- du rituel « lundi matin : trier par score croissant, appeler les rouges ».
-- Lecture service-role/admin uniquement (REVOKE ci-dessous) : la vue agrège
-- TOUS les marchands, elle ne doit pas être visible des comptes marchands.

CREATE OR REPLACE VIEW merchant_health AS
WITH base AS (
  SELECT
    m.id          AS merchant_id,
    m.shop_name,
    m.created_at  AS merchant_since,
    (SELECT count(*) FROM loyalty_cards c
      WHERE c.merchant_id = m.id)                                          AS cartes_total,
    -- ★ Métrique pricing : carte utilisée/mise à jour dans les 90 derniers jours
    (SELECT count(*) FROM loyalty_cards c
      WHERE c.merchant_id = m.id
        AND c.last_scan >= now() - interval '90 days')                     AS cartes_actives_90j,
    (SELECT count(DISTINCT w.serial_number) FROM wallet_device_registrations w
      WHERE w.merchant_id = m.id)                                          AS cartes_wallet,
    (SELECT count(*) FROM scan_history s
      WHERE s.merchant_id = m.id
        AND s.scanned_at >= now() - interval '30 days')                    AS scans_30j,
    (SELECT count(*) FROM scan_history s
      WHERE s.merchant_id = m.id
        AND s.scanned_at >= now() - interval '60 days'
        AND s.scanned_at <  now() - interval '30 days')                    AS scans_30j_prec,
    (SELECT max(s.scanned_at) FROM scan_history s
      WHERE s.merchant_id = m.id)                                          AS dernier_scan,
    (SELECT count(*) FROM customers c
      WHERE c.merchant_id = m.id
        AND c.created_at >= now() - interval '30 days')                    AS nouveaux_clients_30j,
    (SELECT count(*) FROM campaigns k
      WHERE k.merchant_id = m.id AND k.active)                             AS campagnes_actives,
    (SELECT max(n.created_at) FROM wallet_notifications n
      WHERE n.merchant_id = m.id)                                          AS derniere_notif
  FROM merchants m
),
scored AS (
  SELECT *,
    -- 1) Usage comptoir (40 pts) : le scan est LE signe de vie du produit
    CASE WHEN scans_30j >= 22 THEN 40        -- ~1/jour ouvré
         WHEN scans_30j >= 8  THEN 25
         WHEN scans_30j >= 1  THEN 10
         ELSE 0 END                                            AS pts_usage,
    -- 2) Tendance (20 pts) : la chute = signal churn avant même le silence
    CASE WHEN scans_30j_prec = 0 AND scans_30j > 0 THEN 20     -- démarrage
         WHEN scans_30j >= scans_30j_prec THEN 20
         WHEN scans_30j >= scans_30j_prec * 0.5 THEN 10
         ELSE 0 END                                            AS pts_tendance,
    -- 3) Croissance de la base client (20 pts)
    CASE WHEN nouveaux_clients_30j >= 10 THEN 20
         WHEN nouveaux_clients_30j >= 3  THEN 12
         WHEN nouveaux_clients_30j >= 1  THEN 5
         ELSE 0 END                                            AS pts_croissance,
    -- 4) Adoption marketing (10 pts) : campagne active ou notification récente
    CASE WHEN campagnes_actives > 0
           OR derniere_notif >= now() - interval '30 days'
         THEN 10 ELSE 0 END                                    AS pts_marketing,
    -- 5) Taux d'installation wallet (10 pts) : qualité de l'enrôlement
    CASE WHEN cartes_total = 0 THEN 0
         WHEN cartes_wallet::numeric / cartes_total >= 0.5  THEN 10
         WHEN cartes_wallet::numeric / cartes_total >= 0.25 THEN 5
         ELSE 0 END                                            AS pts_wallet
  FROM base
)
SELECT *,
  (pts_usage + pts_tendance + pts_croissance + pts_marketing + pts_wallet) AS health_score,
  CASE
    WHEN (pts_usage + pts_tendance + pts_croissance + pts_marketing + pts_wallet) >= 70 THEN 'vert'
    WHEN (pts_usage + pts_tendance + pts_croissance + pts_marketing + pts_wallet) >= 40 THEN 'orange'
    ELSE 'rouge'
  END AS statut
FROM scored;

-- Agrégat cross-tenant : invisible pour anon/authenticated (service-role only).
REVOKE ALL ON merchant_health FROM anon, authenticated;
