// Temporaire : réinitialise le mot de passe du compte admin de démo à une valeur connue.
// Usage : node scripts/reset-demo-admin-password.mjs
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant dans .env.local");
  process.exit(1);
}

const EMAIL = "admin-demo@walletcard.app";
const PASSWORD = process.env.DEMO_ADMIN_PASSWORD || "admin-demo-walletcard-2026";

const admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

async function findUserByEmail(target) {
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const u = data.users.find((x) => x.email?.toLowerCase() === target.toLowerCase());
    if (u) return u;
    if (data.users.length < 1000) return null;
  }
}

const user = await findUserByEmail(EMAIL);
if (!user) {
  console.error("Utilisateur introuvable :", EMAIL);
  process.exit(1);
}

const { error } = await admin.auth.admin.updateUserById(user.id, {
  password: PASSWORD,
  email_confirm: true,
});
if (error) {
  console.error("Réinitialisation échouée :", error.message);
  process.exit(1);
}

console.log("\n========== COMPTE ADMIN DÉMO ==========");
console.log("Email        :", EMAIL);
console.log("Mot de passe :", PASSWORD);
console.log("=======================================\n");
