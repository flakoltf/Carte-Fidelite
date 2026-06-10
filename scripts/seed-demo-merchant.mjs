// Seed du commerce de DÉMO public : « Café du Rhône » (Genève), slug fixe `demo`.
//
// Objectif : une démo qui vend en rendez-vous — /c/demo montre la page
// d'enrôlement brandée, le pass Wallet sort aux couleurs du café, et le
// dashboard raconte une activité réaliste (matins + midis, VIP, habitués,
// clients en train de partir).
//
// Usage :
//   node scripts/seed-demo-merchant.mjs --dry-run        # montre le plan, n'écrit RIEN
//   DEMO_PASSWORD='...' node scripts/seed-demo-merchant.mjs
//
// ⚠️ Écrit dans la base pointée par .env.local (PROD chez nous) : ne lancer
//    qu'avec accord explicite. Ré-exécutable : purge puis re-sème les données
//    de CE marchand uniquement.
//
// Garde-fous :
//   - emails clients en @example.com (RFC 2606) : aucun email réel ne peut
//     partir, même si une campagne est lancée sur ce marchand par erreur ;
//   - insertion directe en base : ne déclenche PAS l'email de bienvenue
//     (réservé à POST /api/admin/merchants).

import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const DRY_RUN = process.argv.includes("--dry-run");

// ── Identité du commerce de démo ────────────────────────────────────────────
const SHOP = {
  slug: "demo",
  shop_name: "Café du Rhône",
  business_type: "cafe",
  // Caramel doré : contraste AA avec le texte noir du bouton d'enrôlement.
  primary_color: "#C8862E",
  stamp_goal: 9, // « 9 cafés, le 10e offert »
  address: "Quai des Bergues 23, 1201 Genève",
  latitude: 46.209,
  longitude: 6.1455,
};

const CARD_DESIGN = {
  background_color: "#1F1B16", // espresso
  foreground_color: "#F6EFE4", // crème
  label_color: "#C8862E", // caramel
  program_name: "Café du Rhône",
  fields: [{ id: "points", zone: "primary", label: "CAFÉS", value: "{points}", order: 0 }],
  barcode: { type: "QR", source: "card_token" },
};

const EMAIL = (process.env.DEMO_EMAIL || "demo@example.com").toLowerCase();

// ── Clientèle : 4 profils qui rendent les segments du dashboard parlants ────
// (prénoms/initiales locaux ; emails @example.com, jamais délivrables)
const PROFILES = [
  // VIP : anciens, beaucoup de visites, scans récents
  { key: "vip", names: ["Camille R.", "Marco T.", "Sophie L.", "Yanis B.", "Léa M."], tenure: [90, 180], stamps: [6, 8], scans: [12, 22], lastScanDays: [0, 7] },
  // Habitués : réguliers, mi-parcours
  { key: "habitues", names: ["Hugo P.", "Inès K.", "Noah D.", "Jade F.", "Emma V.", "Lucas N.", "Chloé A.", "Adam S.", "Manon C.", "Nathan E.", "Sarah O.", "Théo W."], tenure: [30, 120], stamps: [2, 6], scans: [4, 10], lastScanDays: [2, 21] },
  // Nouveaux : récents, peu de tampons
  { key: "nouveaux", names: ["Louna H.", "Gabriel Z.", "Mila J.", "Raphaël Q.", "Zoé Y.", "Ethan U.", "Anna X.", "Tom I."], tenure: [1, 21], stamps: [0, 2], scans: [1, 3], lastScanDays: [0, 14] },
  // En train de partir / inactifs : la cible des campagnes de relance
  { key: "partants", names: ["Eva L.", "Sacha B.", "Lina M.", "Paul R.", "Nora G.", "Elio F."], tenure: [60, 200], stamps: [3, 7], scans: [3, 8], lastScanDays: [35, 80] },
];

const DAY = 86400000;
const now = Date.now();
const rand = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
// Affluence café : pics 8-9 h et 12-13 h, queue l'après-midi.
const CAFE_HOURS = [7, 8, 8, 8, 9, 9, 10, 12, 12, 12, 13, 13, 14, 16, 17];

const totalCustomers = PROFILES.reduce((n, p) => n + p.names.length, 0);
console.log("── Plan du seed ────────────────────────────────────────────");
for (const line of [
  `Boutique   : ${SHOP.shop_name} (${SHOP.address}) — slug /c/${SHOP.slug}`,
  `Carte      : ${CARD_DESIGN.program_name}, ${SHOP.stamp_goal} cafés = le 10e offert, design espresso/caramel`,
  `Compte     : ${EMAIL} (auth créé ou réutilisé, mot de passe = DEMO_PASSWORD)`,
  `Clients    : ${totalCustomers} (${PROFILES.map((p) => `${p.names.length} ${p.key}`).join(", ")})`,
  `Emails     : tous en @example.com — aucun envoi réel possible`,
  `Purge      : scan_history + loyalty_cards + customers de CE marchand uniquement, puis re-semis`,
  `Non touché : tous les autres marchands ; aucun email de bienvenue déclenché`,
]) console.log("  " + line);
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
  console.error("DEMO_PASSWORD manquant. Usage : DEMO_PASSWORD='...' node scripts/seed-demo-merchant.mjs");
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

// 1. Utilisateur Auth (créé, ou réutilisé + mot de passe réinitialisé)
let userId;
const { data: created, error: createErr } = await admin.auth.admin.createUser({
  email: EMAIL, password: PASSWORD, email_confirm: true,
});
if (createErr) {
  const existing = await findUserByEmail(EMAIL);
  if (!existing) { console.error("Création échouée :", createErr.message); process.exit(1); }
  userId = existing.id;
  await admin.auth.admin.updateUserById(userId, { password: PASSWORD, email_confirm: true });
  console.log("Utilisateur Auth réutilisé + mot de passe réinitialisé :", userId);
} else {
  userId = created.user.id;
  console.log("Utilisateur Auth créé :", userId);
}

// 2. Ligne merchants — slug `demo` posé explicitement (le trigger ne touche
//    pas un slug déjà fourni ; index unique → un seul commerce de démo).
const MERCHANT_FIELDS = {
  shop_name: SHOP.shop_name,
  business_type: SHOP.business_type,
  primary_color: SHOP.primary_color,
  stamp_goal: SHOP.stamp_goal,
  address: SHOP.address,
  latitude: SHOP.latitude,
  longitude: SHOP.longitude,
  role: "merchant",
};
let merchantId;
const { data: existingM } = await admin.from("merchants").select("id").eq("user_id", userId).maybeSingle();
if (existingM) {
  merchantId = existingM.id;
  const { error } = await admin.from("merchants").update({ ...MERCHANT_FIELDS, slug: SHOP.slug }).eq("id", merchantId);
  if (error) { console.error("merchants update :", error.message); process.exit(1); }
} else {
  const { data: m, error } = await admin.from("merchants")
    .insert({ user_id: userId, email: EMAIL, slug: SHOP.slug, ...MERCHANT_FIELDS })
    .select("id").single();
  if (error) { console.error("merchants insert :", error.message); process.exit(1); }
  merchantId = m.id;
}
console.log("Marchand :", merchantId, `→ /c/${SHOP.slug}`);

// 3. Design de carte (upsert : 1 design par marchand — contrainte unique merchant_id)
{
  const { error } = await admin.from("card_designs").upsert(
    { merchant_id: merchantId, ...CARD_DESIGN },
    { onConflict: "merchant_id" }
  );
  if (error) console.warn("card_designs (non bloquant) :", error.message);
  else console.log("Design de carte : espresso/caramel posé");
}

// 4. Purge des anciennes données de démo de CE marchand (réexécutable proprement)
await admin.from("scan_history").delete().eq("merchant_id", merchantId);
await admin.from("loyalty_cards").delete().eq("merchant_id", merchantId);
await admin.from("customers").delete().eq("merchant_id", merchantId);

// 5. Semis par profil
let i = 0, totalScans = 0;
const counts = {};

for (const prof of PROFILES) {
  counts[prof.key] = 0;
  for (const name of prof.names) {
    const tenureDays = rand(prof.tenure[0], prof.tenure[1]);
    const createdAt = new Date(now - tenureDays * DAY).toISOString();
    const { data: cust, error: custErr } = await admin.from("customers")
      .insert({ merchant_id: merchantId, full_name: name, email: `demo_cust_${i}@example.com`, created_at: createdAt })
      .select("id").single();
    i++;
    if (custErr || !cust) continue;

    const stamps = Math.min(rand(prof.stamps[0], prof.stamps[1]), SHOP.stamp_goal - 1);
    const lastScanDays = rand(prof.lastScanDays[0], prof.lastScanDays[1]);
    const lastScan = new Date(now - lastScanDays * DAY).toISOString();
    const passType = Math.random() < 0.6 ? "apple" : "google";

    const { data: card } = await admin.from("loyalty_cards")
      .insert({ customer_id: cust.id, merchant_id: merchantId, stamps_count: stamps, pass_type: passType, last_scan: lastScan, created_at: createdAt })
      .select("id").single();
    if (!card) continue;

    // Scans étalés entre l'inscription et le dernier scan, aux heures du café.
    const nScans = rand(prof.scans[0], prof.scans[1]);
    const span = Math.max(1, tenureDays - lastScanDays);
    const scans = [];
    for (let s = 0; s < nScans; s++) {
      const d = new Date(now - (lastScanDays + rand(0, span)) * DAY);
      d.setHours(CAFE_HOURS[rand(0, CAFE_HOURS.length - 1)], rand(0, 59), 0, 0);
      scans.push({ card_id: card.id, merchant_id: merchantId, points_added: 1, scanned_at: d.toISOString() });
    }
    if (scans.length) {
      await admin.from("scan_history").insert(scans);
      totalScans += scans.length;
    }
    counts[prof.key]++;
  }
}

console.log(`\nSemé : ${i} clients (${PROFILES.map((p) => `${counts[p.key]} ${p.key}`).join(", ")}), ${totalScans} scans.`);
console.log("\n================ DÉMO CAFÉ DU RHÔNE ==================");
console.log("Page publique : /c/demo  (QR du kit terrain → cette URL)");
console.log("Login démo    :", EMAIL);
console.log("Mot de passe  :", PASSWORD);
console.log("======================================================\n");
