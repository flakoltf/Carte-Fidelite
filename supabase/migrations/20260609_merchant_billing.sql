-- Champs d'abonnement Stripe sur merchants (additif, non destructif).
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS plan TEXT;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS card_limit INT;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS subscription_status TEXT;

-- Idempotence du provisioning : un client Stripe = au plus une fiche.
CREATE UNIQUE INDEX IF NOT EXISTS idx_merchants_stripe_customer
  ON merchants(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
