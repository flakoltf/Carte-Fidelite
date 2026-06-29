// SEED DU KIT DÉMO — script CLI local (déclenché par le FONDATEUR / le CHEF).
//
// Applique src/lib/demo/seedKit.ts (DEMO_KIT) à la flotte de prospection en
// PROD : design publié + assets card-assets + clientèle d'exemple, pour les 6
// comptes démo @example.com de l'allowlist. Idempotent.
//
// ⚠️ ÉCRIT EN PROD. À déclencher SCIEMMENT, avec le service-role key. La garde
// assertDemoKitMerchant refuse tout marchand hors allowlist (jamais un vrai).
//
// Pré-requis (dans app/.env.local, gitignoré — secrets jamais commités) :
//   NEXT_PUBLIC_SUPABASE_URL=...
//   SUPABASE_SERVICE_ROLE_KEY=...
//   DEMO_KIT_ACTOR_USER_ID=<uuid auth d'un admin>   (sinon résolu auto)
//
// Usage :
//   node scripts/seed-demo-kit.mjs            # tout le kit
//   node scripts/seed-demo-kit.mjs demo       # un seul marchand (slug)

import { createServer } from "vite";
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BUCKET = "card-assets";

// Charge app/.env.local (KEY=VALUE) sans dépendance externe.
async function loadEnv() {
  try {
    const raw = await readFile(path.join(ROOT, ".env.local"), "utf-8");
    for (const line of raw.split("\n")) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // pas de .env.local → on s'appuie sur l'environnement courant
  }
}

async function main() {
  await loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("✗ NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis (app/.env.local).");
    process.exit(1);
  }

  const slug = process.argv[2];
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // Auteur des publications (FK card_designs.updated_by) : env ou 1er admin.
  let actorUserId = process.env.DEMO_KIT_ACTOR_USER_ID;
  if (!actorUserId) {
    const { data } = await supabase.from("merchants").select("user_id").eq("role", "admin").limit(1).maybeSingle();
    actorUserId = data?.user_id;
  }
  if (!actorUserId) {
    console.error("✗ Aucun actorUserId : définissez DEMO_KIT_ACTOR_USER_ID (uuid auth d'un admin).");
    process.exit(1);
  }

  const vite = await createServer({
    configFile: path.join(ROOT, "vitest.config.ts"),
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "error",
  });

  try {
    const { applyKitEntry, seedDemoKit } = await vite.ssrLoadModule("/src/lib/demo/seedKit.ts");
    const { getKitEntry } = await vite.ssrLoadModule("/src/lib/demo/kit.ts");

    const deps = {
      db: supabase,
      // PNG committés (rendus localement par render-demo-assets.mjs avec polices).
      readAsset: (slug, file) => readFile(path.join(ROOT, "assets", "demo-kit", slug, file)),
      upload: async (p, body) => {
        const { error } = await supabase.storage.from(BUCKET).upload(p, body, { contentType: "image/png", upsert: true });
        if (error) throw new Error(`upload ${p}: ${error.message}`);
      },
      actorUserId,
    };

    console.log(`→ Seed kit démo${slug ? ` (slug=${slug})` : " (6 marchands)"} sur ${url}\n`);
    let results;
    if (slug) {
      const entry = getKitEntry(slug);
      if (!entry) throw new Error(`Slug démo inconnu : ${slug}`);
      results = [await applyKitEntry(deps, entry)];
    } else {
      results = await seedDemoKit(deps);
    }

    for (const r of results) {
      console.log(`✓ ${r.slug.padEnd(24)} → ${r.assets} assets, ${r.cards} cartes  (/c/${r.slug})`);
    }
    console.log(`\nKit appliqué : ${results.length} marchand(s), ${results.reduce((n, r) => n + r.cards, 0)} cartes.`);
  } finally {
    await vite.close();
  }
}

main().catch((e) => {
  console.error("✗", e instanceof Error ? e.message : e);
  process.exit(1);
});
