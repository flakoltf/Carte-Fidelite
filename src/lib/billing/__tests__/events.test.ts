import { describe, it, expect, vi } from "vitest";
import { handleStripeEvent } from "@/lib/billing/events";

describe("handleStripeEvent", () => {
  it("provisionne sur checkout.session.completed", async () => {
    const provision = vi.fn(async () => {});
    const event = {
      type: "checkout.session.completed",
      data: { object: {
        customer: "cus_1", subscription: "sub_1",
        customer_details: { email: "m@shop.ch" },
        metadata: { plan: "pro" },
      } },
    };
    await handleStripeEvent(event as never, provision);
    expect(provision).toHaveBeenCalledWith({
      email: "m@shop.ch", plan: "pro", stripeCustomerId: "cus_1", stripeSubscriptionId: "sub_1",
    });
  });

  it("ignore les autres types d'événements", async () => {
    const provision = vi.fn(async () => {});
    await handleStripeEvent({ type: "invoice.paid", data: { object: {} } } as never, provision);
    expect(provision).not.toHaveBeenCalled();
  });
});
