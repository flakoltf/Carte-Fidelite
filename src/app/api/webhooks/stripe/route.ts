import { NextResponse } from "next/server";
import { getStripe, isStripeEnabled } from "@/lib/billing/stripe";
import { handleStripeEvent } from "@/lib/billing/events";
import { provisionMerchant, prodDeps } from "@/lib/billing/provision";

export const runtime = "nodejs";

export async function POST(req: Request) {
  if (!isStripeEnabled()) return new NextResponse("Stripe désactivé", { status: 503 });

  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!sig || !secret) return new NextResponse("Signature manquante", { status: 400 });

  const body = await req.text(); // corps brut requis pour la vérification
  let event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, secret);
  } catch {
    return new NextResponse("Signature invalide", { status: 400 });
  }

  try {
    await handleStripeEvent(event, (input) => provisionMerchant(input, prodDeps()));
  } catch (err) {
    console.error("Webhook provisioning échoué:", err);
    return new NextResponse("Erreur de traitement", { status: 500 }); // Stripe relancera
  }
  return NextResponse.json({ received: true });
}
