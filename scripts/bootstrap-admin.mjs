// One-off : crée (ou promeut) le compte administrateur de la plateforme.
// Usage : node scripts/bootstrap-admin.mjs   (lit .env.local)
// ADMIN_EMAIL est REQUIS (email du compte admin à créer/promouvoir) — pas de valeur par défaut.
import dotenv from "dotenv";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant dans .env.local");
  process.exit(1);
}

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
if (!process.env.ADMIN_EMAIL) {
  console.error("ADMIN_EMAIL manquant. Usage : ADMIN_EMAIL='toi@exemple.com' node scripts/bootstrap-admin.mjs");
  process.exit(1);
}
const email = process.env.ADMIN_EMAIL.toLowerCase();
const tempPassword = crypto.randomBytes(12).toString("base64url");

async function findUserByEmail(target) {
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const u = data.users.find((x) => x.email?.toLowerCase() === target);
    if (u) return u;
    if (data.users.length < 1000) return null;
  }
}

let userId;
let createdNew = false;
const { data: created, error: createErr } = await admin.auth.admin.createUser({
  email,
  password: tempPassword,
  email_confirm: true,
});

if (createErr) {
  const existing = await findUserByEmail(email);
  if (!existing) {
    console.error("Création échouée et utilisateur introuvable :", createErr.message);
    process.exit(1);
  }
  userId = existing.id;
  console.log("Utilisateur Auth déjà existant, réutilisé :", userId);
} else {
  userId = created.user.id;
  createdNew = true;
  console.log("Utilisateur Auth créé :", userId);
}

const { data: existingMerchant } = await admin
  .from("merchants")
  .select("id, role")
  .eq("user_id", userId)
  .maybeSingle();

if (existingMerchant) {
  if (existingMerchant.role !== "admin") {
    const { error } = await admin.from("merchants").update({ role: "admin" }).eq("id", existingMerchant.id);
    if (error) {
      console.error("Promotion en admin échouée :", error.message);
      process.exit(1);
    }
  }
  console.log("Ligne merchants promue/confirmée admin :", existingMerchant.id);
} else {
  const { data: m, error } = await admin
    .from("merchants")
    .insert({ user_id: userId, shop_name: "Administration", email, role: "admin" })
    .select("id")
    .single();
  if (error) {
    console.error("Création de la ligne merchants admin échouée :", error.message);
    process.exit(1);
  }
  console.log("Ligne merchants admin créée :", m.id);
}

console.log("\n================ COMPTE ADMIN ================");
console.log("Email                 :", email);
if (createdNew) console.log("Mot de passe TEMPORAIRE:", tempPassword, " (à changer après 1ère connexion)");
else console.log("Mot de passe          : inchangé (utilisateur préexistant)");
console.log("=============================================\n");
