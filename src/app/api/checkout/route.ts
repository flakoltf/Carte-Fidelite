import { NextResponse } from "next/server";
import { getStripe, isStripeEnabled, priceIdForPlan } from "@/lib/billing/stripe";
import { getPlan } from "@/lib/billing/plans";

export const runtime = "nodejs";
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://app.halocard.ch";

export async function POST(req: Request) {
  if (!isStripeEnabled()) {
    return NextResponse.json({ error: "Paiement bientôt disponible" }, { status: 503 });
  }
  const body = await req.json().catch(() => ({}));
  const plan = getPlan(typeof body.plan === "string" ? body.plan : "");
  if (!plan) return NextResponse.json({ error: "Plan invalide" }, { status: 400 });

  const price = priceIdForPlan(plan.key);
  if (!price) return NextResponse.json({ error: "Prix non configuré" }, { status: 503 });

  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price, quantity: 1 }],
    metadata: { plan: plan.key },
    subscription_data: { metadata: { plan: plan.key } },
    success_url: `${BASE_URL}/abonnement/merci?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `https://halocard.ch/#tarifs`,
  });
  return NextResponse.json({ url: session.url });
}
