// TEMPORAIRE — smoke test Sentry (preuve que l'app remonte ses erreurs).
// À RETIRER aussitôt la vérification faite. Protégé par token.
// NB : pas de préfixe « _ » (sinon Next.js traite le dossier comme privé,
// hors routage → 404). C'était le bug du premier essai.
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (token !== "halo-sentry-2026") {
    return NextResponse.json({ ok: true, hint: "ajoutez ?token=… pour déclencher le test Sentry" });
  }
  throw new Error("HaloCard Sentry smoke test — erreur volontaire (à ignorer)");
}
