-- Phase 2B (pré-requis) : unicité du client scopée au marchand, pas globale.
--
-- Avant : customers.unique_customer_email = UNIQUE(email) sur toute la plateforme.
-- Problème : sur une plateforme multi-marchands, un même client (même email) ne
-- pouvait pas s'enrôler chez deux marchands différents — le 2e enrôlement échouait
-- sur violation d'unicité. On scope donc l'unicité au couple (merchant_id, email).
--
-- Les emails NULL restent autorisés en multiples (cartes historiques créées sans
-- email par les anciennes routes de génération). Migration sûre : l'ancienne
-- contrainte globale garantit qu'aucun doublon (merchant_id, email) n'existe.

ALTER TABLE customers DROP CONSTRAINT IF EXISTS unique_customer_email;

ALTER TABLE customers
  ADD CONSTRAINT customers_merchant_email_unique UNIQUE (merchant_id, email);
