// Seed / reset du compte démo. Idempotent : si le marchand démo réservé existe
// déjà, on le reconfigure et on repart de clients propres (PAS de doublon de
// compte Auth) ; sinon on le crée de toutes pièces. La résolution passe par le
// slug réservé + la garde stricte assertDemoMerchant.

import crypto from "crypto";
import { assertDemoMerchant, buildDemoMerchantConfigUpdate, buildDemoMerchantPayload } from "./identity";
import { purgeDemoCustomerData } from "./purge";
import type { DemoDb } from "./db";
import { DEMO_CUSTOMERS, DEMO_MERCHANT, DEMO_SLUG, demoCustomerEmail } from "./constants";

const DAY = 86400000;

export interface SeedAuthAdmin {
  createUser(input: { email: string; password: string; email_confirm: boolean }): Promise<{
    data: { user: { id: string } | null };
    error: unknown;
  }>;
  deleteUser(id: string): Promise<unknown>;
}

export interface SeedResult {
  merchantId: string;
  mode: "created" | "reset";
  tempPassword?: string;
}

function genPassword(): string {
  return crypto.randomBytes(12).toString("base64url");
}

// Insère la clientèle de démo déterministe (client → carte → un scan daté).
async function seedDemoCustomers(db: DemoDb, merchantId: string, now: Date): Promise<void> {
  for (let i = 0; i < DEMO_CUSTOMERS.length; i++) {
    const spec = DEMO_CUSTOMERS[i];
    const lastScan = new Date(now.getTime() - spec.lastScanDaysAgo * DAY).toISOString();

    const { data: customer } = await db
      .from("customers")
      .insert({ merchant_id: merchantId, full_name: spec.fullName, email: demoCustomerEmail(i) })
      .select("id")
      .single();
    if (!customer) continue;

    const { data: card } = await db
      .from("loyalty_cards")
      .insert({
        merchant_id: merchantId,
        customer_id: customer.id,
        stamps_count: spec.stamps,
        last_scan: lastScan,
      })
      .select("id")
      .single();
    if (!card) continue;

    await db.from("scan_history").insert({
      merchant_id: merchantId,
      card_id: card.id,
      points_added: 1,
      scanned_at: lastScan,
    });
  }
}

export async function seedDemoMerchant(
  db: DemoDb,
  authAdmin: SeedAuthAdmin,
  now: Date = new Date()
): Promise<SeedResult> {
  const { data: existing } = await db
    .from("merchants")
    .select("id, slug, email, role")
    .eq("slug", DEMO_SLUG)
    .maybeSingle();

  // ── Déjà présent : reset propre, sans recréer le compte Auth ──────────────
  if (existing) {
    assertDemoMerchant(existing); // refuse un slug réservé squatté par autre chose
    await purgeDemoCustomerData(db, existing.id);
    await db.from("merchants").update(buildDemoMerchantConfigUpdate(now)).eq("id", existing.id);
    await seedDemoCustomers(db, existing.id, now);
    return { merchantId: existing.id, mode: "reset" };
  }

  // ── Création de zéro ──────────────────────────────────────────────────────
  const tempPassword = genPassword();
  const { data: created, error: authErr } = await authAdmin.createUser({
    email: DEMO_MERCHANT.email,
    password: tempPassword,
    email_confirm: true,
  });
  if (authErr || !created.user) {
    throw new Error("Création du compte démo échouée");
  }

  const { data: merchant, error: insErr } = await db
    .from("merchants")
    .insert(buildDemoMerchantPayload(created.user.id, now))
    .select("id")
    .single();
  if (insErr || !merchant) {
    await authAdmin.deleteUser(created.user.id); // anti-orphelin
    throw new Error("Création du profil démo échouée");
  }

  await seedDemoCustomers(db, merchant.id, now);
  return { merchantId: merchant.id, mode: "created", tempPassword };
}
