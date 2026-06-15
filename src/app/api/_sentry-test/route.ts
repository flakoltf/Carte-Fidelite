// TEMPORAIRE — smoke test Sentry (preuve que l'app remonte bien ses erreurs).
// À RETIRER aussitôt la vérification faite. Protégé par token : sans le bon
// token, renvoie 200 (aucune erreur publique exploitable le temps du test).
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (token !== "halo-sentry-2026") {
    return NextResponse.json({ ok: true, hint: "ajoutez ?token=… pour déclencher le test Sentry" });
  }
  // Erreur volontaire : capturée par onRequestError (Sentry.captureRequestError).
  throw new Error("HaloCard Sentry smoke test — erreur volontaire (à ignorer)");
}
