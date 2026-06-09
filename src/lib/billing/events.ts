import type Stripe from "stripe";
import type { ProvisionInput } from "./provision";

type Provisioner = (input: ProvisionInput) => Promise<void>;

export async function handleStripeEvent(event: Stripe.Event, provision: Provisioner): Promise<void> {
  if (event.type !== "checkout.session.completed") return;
  const s = event.data.object as Stripe.Checkout.Session;
  const email = s.customer_details?.email;
  const plan = s.metadata?.plan;
  if (!email || !plan) throw new Error("Session sans email ou plan");
  await provision({
    email,
    plan,
    stripeCustomerId: String(s.customer),
    stripeSubscriptionId: String(s.subscription),
  });
}
