import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { clientIp } from "@/lib/clientIp";

// Endpoint de log appelé par les appareils Apple Wallet. PUBLIC (PassKit n'authentifie pas).
// Durci : rate-limit par IP + on ne journalise PAS le corps brut (anti injection de logs /
// PII / spam de logs) — seulement un compteur d'entrées.
export async function POST(req: Request) {
  const rl = await rateLimit(`wallet-log:${clientIp(req.headers)}`, 30, 60_000); // 30/min/IP
  if (!rl.success) return new NextResponse(null, { status: 429 });

  try {
    const body = await req.json();
    const count = Array.isArray((body as { logs?: unknown[] })?.logs) ? (body as { logs: unknown[] }).logs.length : 0;
    console.warn(`[ApplePass log] ${count} entrée(s) reçue(s)`);
  } catch {
    // corps absent/illisible — sans importance pour un endpoint de log
  }
  return new NextResponse(null, { status: 200 });
}
