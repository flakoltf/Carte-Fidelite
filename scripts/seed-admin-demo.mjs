// Seed des données DÉMO du panneau super-admin (agent B) : leads à toutes les
// étapes du pipeline, notes CRM, relances — pour que /admin/leads et les vues
// CRM soient visibles pleines. Complète seed-demo-fleet.mjs (marchands).
//
// Usage :
//   node scripts/seed-admin-demo.mjs --dry-run        # montre le plan, n'écrit RIEN
//   node scripts/seed-admin-demo.mjs
//
// ⚠️ Écrit dans la base pointée par .env.local (PROD) : accord explicite requis.
// Ré-exécutable : purge puis re-sème UNIQUEMENT les leads marqués
// source_path 'seed:admin-demo' (et leurs notes, en cascade).
// Prérequis : migrations 20260611_* appliquées (colonnes pipeline + admin_notes).

import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: ".env.local" });

const DRY_RUN = process.argv.includes("--dry-run");
const DAY = 86400000;
const now = Date.now();
const iso = (daysAgo) => new Date(now - daysAgo * DAY).toISOString();

const SEED_SOURCE = "seed:admin-demo";

// ── Leads de démo : un pipeline genevois crédible ───────────────────────────
const LEADS = [
  { business_name: "Brasserie du Lac", trade: "restaurant", contact: "demo-brasserie@example.com", plan: "croissance", status: "nouveau", createdDays: 1 },
  { business_name: "Fleurs de Plainpalais", trade: "fleuriste", contact: "079 555 01 01", plan: "essentiel", status: "nouveau", createdDays: 2 },
  { business_name: "Barber Club Eaux-Vives", trade: "barbier", contact: "demo-barber@example.com", plan: "essentiel", status: "contacte", createdDays: 6, followupDays: -1, note: "Appelé mardi — intéressé, veut voir la carte démo en boutique." },
  { business_name: "Yoga Studio Carouge", trade: "studio", contact: "demo-yoga@example.com", plan: "croissance", status: "contacte", createdDays: 9, followupDays: 2, note: "Rappel prévu : la gérante compare avec une appli de réservation." },
  { business_name: "Chocolaterie Rive Gauche", trade: "chocolatier", contact: "022 555 02 02", plan: "premium", status: "demo", createdDays: 14, followupDays: 0, note: "Démo faite sur place — très chaud, attend l'accord de l'associé.", pinned: true },
  { business_name: "Café des Bastions", trade: "café", contact: "demo-bastions@example.com", plan: "essentiel", status: "gagne", createdDays: 30, note: "Signé après la démo terrain — onboarding fait dans la foulée." },
  { business_name: "Épicerie du Molard", trade: "épicerie", contact: "demo-molard@example.com", plan: "essentiel", status: "perdu", createdDays: 25, lostReason: "Budget gelé jusqu'à l'automne — à recontacter en septembre." },
];

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY manquants (.env.local)");
    process.exit(1);
  }

  console.log(`Cible : ${url}`);
  console.log(`Plan : ${LEADS.length} leads (${LEADS.filter((l) => l.note).length} notes, 1 épinglée), source '${SEED_SOURCE}'`);
  for (const l of LEADS) console.log(`  · [${l.status}] ${l.business_name} (${l.trade})`);
  if (DRY_RUN) {
    console.log("--dry-run : rien n'a été écrit.");
    return;
  }

  const db = createClient(url, key);

  // Auteur des notes : le premier compte admin (author_user_id NOT NULL).
  const { data: admin, error: adminErr } = await db
    .from("merchants")
    .select("user_id")
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();
  if (adminErr || !admin?.user_id) {
    console.error("Aucun compte admin trouvé — impossible d'attribuer les notes.", adminErr?.message ?? "");
    process.exit(1);
  }

  // Purge idempotente : UNIQUEMENT les leads de CE seed (notes en cascade).
  const { error: purgeErr } = await db.from("leads").delete().eq("source_path", SEED_SOURCE);
  if (purgeErr) {
    console.error("Purge échouée :", purgeErr.message);
    process.exit(1);
  }

  let notes = 0;
  for (const l of LEADS) {
    const { data: lead, error } = await db
      .from("leads")
      .insert({
        business_name: l.business_name,
        trade: l.trade,
        contact: l.contact,
        plan: l.plan,
        source_path: SEED_SOURCE,
        status: l.status,
        created_at: iso(l.createdDays),
        updated_at: iso(Math.max(0, l.createdDays - 1)),
        next_followup_at: l.followupDays !== undefined ? iso(l.followupDays) : null,
        lost_reason: l.lostReason ?? null,
      })
      .select("id")
      .single();
    if (error || !lead) {
      console.error(`Lead « ${l.business_name} » échoué :`, error?.message);
      process.exit(1);
    }
    if (l.note) {
      const { error: noteErr } = await db.from("admin_notes").insert({
        lead_id: lead.id,
        body: l.note,
        author_user_id: admin.user_id,
        pinned: Boolean(l.pinned),
        created_at: iso(Math.max(0, l.createdDays - 2)),
      });
      if (noteErr) {
        console.error(`Note « ${l.business_name} » échouée :`, noteErr.message);
        process.exit(1);
      }
      notes++;
    }
  }

  console.log(`OK : ${LEADS.length} leads + ${notes} notes semés. Voir /admin/leads.`);
}

main();
