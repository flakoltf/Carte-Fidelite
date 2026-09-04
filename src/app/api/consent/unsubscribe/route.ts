import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { extractRequestMeta } from "@/lib/auditLog";
import { verifyConsentToken } from "@/lib/consent/token";
import { revokeMarketingConsent } from "@/lib/consent/unsubscribe";
import { consentLandingUrl } from "@/lib/consent/landing";

// Désinscription en un clic depuis le pied de page « Se désinscrire » de tout
// email marketing (unsubscribeFooter). Public, sans session : jeton signé SANS
// expiration (un client doit pouvoir se désinscrire depuis un vieil email),
// lié à l'action « unsubscribe » — un lien de confirmation ne désinscrit pas.
// Toujours une redirection 303 vers la page sobre /consentement.
export async function GET(req: Request) {
  const meta = extractRequestMeta(req);

  // Rate-limit fail-OPEN : une panne Redis ne doit jamais empêcher une
  // désinscription (obligation légale de la rendre simple et immédiate).
  const limit = await rateLimit(`consent-unsub:${meta.ip_address}`, 30, 3600000).catch(() => ({ success: true }));
  if (!limit.success) {
    return NextResponse.json({ error: "Trop de tentatives. Réessayez plus tard." }, { status: 429 });
  }

  const token = (new URL(req.url).searchParams.get("t") || "").trim();
  const verdict = verifyConsentToken(token, "unsubscribe");
  if (!verdict.valid) {
    return NextResponse.redirect(consentLandingUrl(req, "invalide"), 303);
  }

  try {
    const { outcome } = await revokeMarketingConsent({
      customerId: verdict.customerId,
      merchantId: verdict.merchantId,
      ip: meta.ip_address,
      userAgent: meta.user_agent,
    });
    if (outcome === "revoked" || outcome === "already") {
      return NextResponse.redirect(consentLandingUrl(req, "desinscrit", verdict.merchantId), 303);
    }
    return NextResponse.redirect(consentLandingUrl(req, "invalide"), 303);
  } catch (e) {
    console.error("Consent unsubscribe error:", e instanceof Error ? e.message : e);
    return NextResponse.redirect(consentLandingUrl(req, "erreur"), 303);
  }
}
