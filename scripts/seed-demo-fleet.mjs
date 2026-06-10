// Seed d'une FLOTTE de marchands de démo pour peupler le dashboard super-admin :
// santé verte/orange/rouge, paliers variés, un marchand proche de son plafond
// (déclenche le bloc « Opportunités d'upgrade »).
//
// Usage :
//   node scripts/seed-demo-fleet.mjs --dry-run        # montre le plan, n'écrit RIEN
//   DEMO_PASSWORD='...' node scripts/seed-demo-fleet.mjs
//
// ⚠️ Écrit dans la base pointée par .env.local (PROD) : accord explicite requis.
// Ré-exécutable : purge puis re-sème les données de CES marchands uniquement.
// Garde-fous identiques à seed-demo-merchant.mjs : emails @example.com (aucun
// envoi réel possible), insertion directe (pas d'email de bienvenue), badge
// « démo » automatique dans la table santé (détection @example.com).

import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const DRY_RUN = process.argv.includes("--dry-run");
const DAY = 86400000;
const now = Date.now();
const rand = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));

// ── La flotte : 4 profils business contrastés ───────────────────────────────
const FLEET = [
  {
    email: "demo-boulangerie@example.com",
    shop_name: "Boulangerie des Pâquis",
    business_type: "boulangerie",
    primary_color: "#A3552B",
    stamp_goal: 10,
    plan: "essentiel",
    address: "Rue de Berne 17, 1201 Genève",
    profile: "vert",
    customers: 45,
    tenureDays: [10, 150],
    stamps: [1, 9],
    // scans massifs et récents → score élevé
    scansPerCustomer: [4, 12],
    lastScanDays: [0, 10],
    scanSpreadDays: 30,
  },
  {
    email: "demo-salon@example.com",
    shop_name: "Salon Lumière",
    business_type: "coiffeur",
    primary_color: "#7C5CBF",
    stamp_goal: 8,
    plan: "croissance",
    address: "Boulevard Carl-Vogt 42, 1205 Genève",
    profile: "orange",
    customers: 30,
    tenureDays: [40, 200],
    stamps: [1, 6],
    // tendance en chute : peu de scans récents, beaucoup le mois précédent
    scansPerCustomer: [1, 2],
    lastScanDays: [5, 28],
    scanSpreadDays: 12,
    previousMonthScans: [2, 4], // scans additionnels à J-31..J-58 (chute > 50 %)
  },
  {
    email: "demo-pizzeria@example.com",
    shop_name: "Pizzeria Molino",
    business_type: "restaurant",
    primary_color: "#B33A3A",
    stamp_goal: 9,
    plan: "essentiel",
    address: "Rue de Carouge 71, 1205 Genève",
    profile: "rouge",
    customers: 25,
    tenureDays: [90, 250],
    stamps: [2, 7],
    // plus aucun scan depuis 45+ jours → rouge, à appeler
    scansPerCustomer: [2, 5],
    lastScanDays: [45, 90],
    scanSpreadDays: 60,
  },
  {
    email: "demo-institut@example.com",
    shop_name: "Institut Belle Rive",
    business_type: "beaute",
    primary_color: "#2E6E8E",
    stamp_goal: 6,
    plan: "essentiel",
    address: "Quai Gustave-Ador 30, 1207 Genève",
    profile: "near-cap (172/200 → upsell)",
    customers: 172,
    tenureDays: [5, 85], // tous < 90 j → tous actifs au sens billing
    stamps: [0, 5],
    scansPerCustomer: [1, 3],
    lastScanDays: [0, 20],
    scanSpreadDays: 30,
  },
];

const FIRST = ["Marie", "Luca", "Sofia", "Karim", "Elena", "David", "Aïcha", "Mateo", "Nina", "Pierre",
  "Fatou", "Diego", "Clara", "Omar", "Julie", "Andrea", "Leïla", "Marc", "Ana", "Pablo"];
const LAST_INITIALS = "ABCDEFGHJKLMNPRSTVZ";

console.log("── Plan du seed flotte ─────────────────────────────────────");
for (const m of FLEET) {
  console.log(`  ${m.shop_name.padEnd(24)} ${String(m.customers).padStart(3)} clients · palier ${m.plan} · profil ${m.profile}`);
}
console.log(`  Total : ${FLEET.reduce((n, m) => n + m.customers, 0)} clients — emails @example.com, purge limitée à ces marchands`);
console.log("────────────────────────────────────────────────────────────");
if (DRY_RUN) {
  console.log("--dry-run : aucune écriture effectuée.");
  process.exit(0);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("env Supabase manquant dans .env.local"); process.exit(1); }
const PASSWORD = process.env.DEMO_PASSWORD;
if (!PASSWORD) {
  console.error("DEMO_PASSWORD manquant. Usage : DEMO_PASSWORD='...' node scripts/seed-demo-fleet.mjs");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

async function findUserByEmail(target) {
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const u = data.users.find((x) => x.email?.toLowerCase() === target);
    if (u) return u;
    if (data.users.length < 1000) return null;
  }
}

async function chunkInsert(table, rows, chunk = 200) {
  for (let i = 0; i < rows.length; i += chunk) {
    const { error } = await admin.from(table).insert(rows.slice(i, i + chunk));
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}

for (const shop of FLEET) {
  // 1. Auth user (créé ou réutilisé)
  let userId;
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: shop.email, password: PASSWORD, email_confirm: true,
  });
  if (createErr) {
    const existing = await findUserByEmail(shop.email);
    if (!existing) { console.error(`${shop.shop_name} — auth :`, createErr.message); continue; }
    userId = existing.id;
  } else {
    userId = created.user.id;
  }

  // 2. Marchand (upsert par user_id)
  const fields = {
    shop_name: shop.shop_name,
    business_type: shop.business_type,
    primary_color: shop.primary_color,
    stamp_goal: shop.stamp_goal,
    plan: shop.plan,
    address: shop.address,
    role: "merchant",
  };
  let merchantId;
  const { data: existingM } = await admin.from("merchants").select("id").eq("user_id", userId).maybeSingle();
  if (existingM) {
    merchantId = existingM.id;
    const { error } = await admin.from("merchants").update(fields).eq("id", merchantId);
    if (error) { console.error(`${shop.shop_name} — update :`, error.message); continue; }
  } else {
    const { data: m, error } = await admin.from("merchants")
      .insert({ user_id: userId, email: shop.email, ...fields })
      .select("id").single();
    if (error) { console.error(`${shop.shop_name} — insert :`, error.message); continue; }
    merchantId = m.id;
  }

  // 3. Purge des données de CE marchand
  await admin.from("scan_history").delete().eq("merchant_id", merchantId);
  await admin.from("loyalty_cards").delete().eq("merchant_id", merchantId);
  await admin.from("customers").delete().eq("merchant_id", merchantId);

  // 4. Clients + cartes + scans (bulk)
  const customers = Array.from({ length: shop.customers }, (_, i) => {
    const tenure = rand(shop.tenureDays[0], shop.tenureDays[1]);
    return {
      merchant_id: merchantId,
      full_name: `${FIRST[i % FIRST.length]} ${LAST_INITIALS[i % LAST_INITIALS.length]}.`,
      email: `${shop.email.split("@")[0]}_c${i}@example.com`,
      created_at: new Date(now - tenure * DAY).toISOString(),
      _tenure: tenure,
    };
  });
  const { data: insertedCustomers, error: custErr } = await admin
    .from("customers")
    .insert(customers.map(({ _tenure, ...c }) => c))
    .select("id, created_at");
  if (custErr) { console.error(`${shop.shop_name} — customers :`, custErr.message); continue; }

  const cards = insertedCustomers.map((c, i) => {
    const lastScanDays = rand(shop.lastScanDays[0], shop.lastScanDays[1]);
    return {
      customer_id: c.id,
      merchant_id: merchantId,
      stamps_count: Math.min(rand(shop.stamps[0], shop.stamps[1]), shop.stamp_goal - 1),
      pass_type: Math.random() < 0.6 ? "apple" : "google",
      last_scan: new Date(now - lastScanDays * DAY).toISOString(),
      created_at: c.created_at,
      _lastScanDays: lastScanDays,
      _idx: i,
    };
  });
  const { data: insertedCards, error: cardErr } = await admin
    .from("loyalty_cards")
    .insert(cards.map(({ _lastScanDays, _idx, ...c }) => c))
    .select("id, last_scan");
  if (cardErr) { console.error(`${shop.shop_name} — cards :`, cardErr.message); continue; }

  const scans = [];
  for (let i = 0; i < insertedCards.length; i++) {
    const card = insertedCards[i];
    const lastScanDays = Math.floor((now - new Date(card.last_scan).getTime()) / DAY);
    const n = rand(shop.scansPerCustomer[0], shop.scansPerCustomer[1]);
    for (let s = 0; s < n; s++) {
      const d = new Date(now - (lastScanDays + rand(0, shop.scanSpreadDays)) * DAY);
      d.setHours(rand(8, 18), rand(0, 59), 0, 0);
      scans.push({ card_id: card.id, merchant_id: merchantId, points_added: 1, scanned_at: d.toISOString() });
    }
    // Profil « tendance en chute » : volume supplémentaire le mois PRÉCÉDENT
    if (shop.previousMonthScans) {
      const p = rand(shop.previousMonthScans[0], shop.previousMonthScans[1]);
      for (let s = 0; s < p; s++) {
        const d = new Date(now - rand(31, 58) * DAY);
        d.setHours(rand(8, 18), rand(0, 59), 0, 0);
        scans.push({ card_id: card.id, merchant_id: merchantId, points_added: 1, scanned_at: d.toISOString() });
      }
    }
  }
  await chunkInsert("scan_history", scans);

  console.log(`✓ ${shop.shop_name} : ${insertedCustomers.length} clients, ${scans.length} scans (${shop.profile})`);
}

console.log("\n================ FLOTTE DÉMO SEMÉE ====================");
console.log("Dashboard admin : app.halocard.ch/admin (compte admin)");
console.log("Logins flotte   :", FLEET.map((m) => m.email).join(", "));
console.log("Mot de passe    :", PASSWORD);
console.log("=======================================================\n");
