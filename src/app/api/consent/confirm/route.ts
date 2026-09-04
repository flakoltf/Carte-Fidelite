import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { extractRequestMeta } from "@/lib/auditLog";
import { verifyConsentToken } from "@/lib/consent/token";
import { confirmMarketingConsent } from "@/lib/consent/confirm";
import { consentLandingUrl } from "@/lib/consent/landing";

// Clic sur le lien de double opt-in (email « Confirmez votre inscription aux
// offres de {commerce} »). Public, sans session : le jeton signé (HMAC, secret
// dédié, 7 jours) porte customer_id + merchant_id — jamais l'enrollment_token.
// Toujours une redirection 303 vers la page sobre /consentement : un client qui
// clique depuis son téléphone ne doit jamais voir du JSON.
export async function GET(req: Request) {
  const meta = extractRequestMeta(req);

  // Rate-limit fail-OPEN : une panne Redis ne doit pas bloquer un client qui
  // confirme son consentement (aucun effet destructeur possible ici).
  const limit = await rateLimit(`consent-confirm:${meta.ip_address}`, 30, 3600000).catch(() => ({ success: true }));
  if (!limit.success) {
    return NextResponse.json({ error: "Trop de tentatives. Réessayez plus tard." }, { status: 429 });
  }

  const token = (new URL(req.url).searchParams.get("t") || "").trim();
  const verdict = verifyConsentToken(token, "confirm");
  if (!verdict.valid) {
    return NextResponse.redirect(consentLandingUrl(req, verdict.reason === "expired" ? "expire" : "invalide"), 303);
  }

  try {
    const { outcome } = await confirmMarketingConsent({
      customerId: verdict.customerId,
      merchantId: verdict.merchantId,
      ip: meta.ip_address,
      userAgent: meta.user_agent,
    });
    if (outcome === "confirmed" || outcome === "already") {
      return NextResponse.redirect(consentLandingUrl(req, "confirme", verdict.merchantId), 303);
    }
    // not_found / not_requested : indistincts (on n'expose pas l'état d'un tiers)
    return NextResponse.redirect(consentLandingUrl(req, "invalide"), 303);
  } catch (e) {
    console.error("Consent confirm error:", e instanceof Error ? e.message : e);
    return NextResponse.redirect(consentLandingUrl(req, "erreur"), 303);
  }
}
