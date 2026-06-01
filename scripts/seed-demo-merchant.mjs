// Crée un marchand de démo (login connu) + données réalistes pour voir le dashboard.
// Usage : node scripts/seed-demo-merchant.mjs   (lit .env.local)
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("env Supabase manquant dans .env.local"); process.exit(1); }

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const EMAIL = (process.env.DEMO_EMAIL || "demo@walletcard.app").toLowerCase();
const PASSWORD = process.env.DEMO_PASSWORD || "demo-walletcard-2026";

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

// 2. Ligne merchants (café, push-ready, branding émeraude)
let merchantId;
const { data: existingM } = await admin.from("merchants").select("id").eq("user_id", userId).maybeSingle();
if (existingM) {
  merchantId = existingM.id;
  await admin.from("merchants").update({ shop_name: "Café Démo", business_type: "cafe", primary_color: "#0D6B5E", role: "merchant" }).eq("id", merchantId);
} else {
  const { data: m, error } = await admin.from("merchants")
    .insert({ user_id: userId, shop_name: "Café Démo", email: EMAIL, role: "merchant", business_type: "cafe", primary_color: "#0D6B5E" })
    .select("id").single();
  if (error) { console.error("merchants insert :", error.message); process.exit(1); }
  merchantId = m.id;
}
console.log("Marchand :", merchantId);

// 3. Purge des anciennes données de démo de CE marchand (réexécutable proprement)
const { data: oldCards } = await admin.from("loyalty_cards").select("id").eq("merchant_id", merchantId);
const oldCardIds = (oldCards ?? []).map((c) => c.id);
if (oldCardIds.length) await admin.from("scan_history").delete().eq("merchant_id", merchantId);
await admin.from("loyalty_cards").delete().eq("merchant_id", merchantId);
await admin.from("customers").delete().eq("merchant_id", merchantId);

// 4. Semis
const NAMES = ["Camille R.","Marco T.","Sophie L.","Yanis B.","Léa M.","Hugo P.","Inès K.","Noah D.","Jade F.","Liam G.",
  "Emma V.","Lucas N.","Chloé A.","Adam S.","Manon C.","Nathan E.","Sarah O.","Théo W.","Louna H.","Gabriel Z.",
  "Mila J.","Raphaël Q.","Zoé Y.","Ethan U.","Anna X.","Tom I.","Eva L.","Sacha B.","Lina M.","Paul R."];
const now = Date.now();
const DAY = 86400000;
const rand = (n) => Math.floor(Math.random() * n);

let totalScans = 0, completed = 0;
for (let i = 0; i < NAMES.length; i++) {
  const createdAt = new Date(now - rand(60) * DAY).toISOString();
  const { data: cust } = await admin.from("customers")
    .insert({ merchant_id: merchantId, full_name: NAMES[i], email: `demo_cust_${i}@walletcard.app`, created_at: createdAt })
    .select("id").single();
  if (!cust) continue;

  const stamps = rand(11); // 0..10
  if (stamps >= 10) completed++;
  // 70% actifs (scan récent < 30j), 30% inactifs (dernier scan ancien)
  const active = Math.random() < 0.7;
  const lastScanDays = active ? rand(28) : 30 + rand(40);
  const lastScan = new Date(now - lastScanDays * DAY).toISOString();
  const passType = Math.random() < 0.6 ? "apple" : "google";

  const { data: card } = await admin.from("loyalty_cards")
    .insert({ customer_id: cust.id, merchant_id: merchantId, stamps_count: stamps, pass_type: passType, last_scan: lastScan, created_at: createdAt })
    .select("id").single();
  if (!card) continue;

  // Scans répartis sur 30 jours, concentrés le midi (affluence café)
  const nScans = 1 + rand(14);
  const scans = [];
  for (let s = 0; s < nScans; s++) {
    const d = new Date(now - rand(30) * DAY);
    const hour = [8, 9, 12, 12, 13, 13, 16, 18][rand(8)];
    d.setHours(hour, rand(60), 0, 0);
    scans.push({ card_id: card.id, merchant_id: merchantId, points_added: 1, scanned_at: d.toISOString() });
  }
  await admin.from("scan_history").insert(scans);
  totalScans += scans.length;
}

console.log(`\nSemé : ${NAMES.length} clients, ${totalScans} scans, ${completed} cartes complétées.`);
console.log("\n================ COMPTE MARCHAND DÉMO ================");
console.log("Email        :", EMAIL);
console.log("Mot de passe :", PASSWORD);
console.log("Boutique     : Café Démo (type café)");
console.log("=====================================================\n");
