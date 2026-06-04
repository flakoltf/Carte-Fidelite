import { describe, it, expect } from "vitest";
import { isEmailConfigured, sendEmail } from "../send";

describe("email helper — inerte sans configuration", () => {
  it("isEmailConfigured() est faux sans RESEND_API_KEY/EMAIL_FROM", () => {
    // L'environnement de test ne fournit pas ces variables.
    expect(isEmailConfigured()).toBe(false);
  });

  it("sendEmail() ne fait rien et n'échoue pas quand non configuré", async () => {
    const r = await sendEmail({ to: "client@example.com", subject: "Test", html: "<p>hi</p>" });
    expect(r).toEqual({ sent: false, reason: "not_configured" });
  });
});
