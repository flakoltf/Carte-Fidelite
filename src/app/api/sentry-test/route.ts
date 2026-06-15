// TEMPORAIRE — diagnostic Sentry. À RETIRER après vérification.
// - sans token : rapporte si le DSN est présent dans le runtime (sans le révéler).
// - avec token : capture EXPLICITE + flush(3s) → teste directement le tuyau
//   app→Sentry, sans dépendre du flush serverless de onRequestError (suspect n°1).
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { SENTRY_DSN } from "@/lib/monitoring/sentryOptions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  const dsnPresent = Boolean(SENTRY_DSN);
  if (token !== "halo-sentry-2026") {
    return NextResponse.json({ ok: true, dsnPresent });
  }
  const eventId = Sentry.captureException(
    new Error("HaloCard Sentry smoke test (capture explicite)")
  );
  const flushed = await Sentry.flush(3000);
  return NextResponse.json({ dsnPresent, eventId, flushed });
}
