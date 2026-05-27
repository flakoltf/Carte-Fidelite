import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { rateLimit } from "@/lib/rateLimit";
import { extractRequestMeta } from "@/lib/auditLog";
import { buildApplePassBuffer } from "@/lib/applePass";
import { buildGoogleSaveUrl } from "@/lib/googlePass";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Sert l'artefact Wallet d'une carte créée par l'enrôlement public.
// GET /api/enroll/[cardId]?t=<enrollment_token>&wallet=apple|google
//   - apple  -> renvoie le .pkpass (Safari iOS affiche "Ajouter à Apple Wallet")
//   - google -> redirige 302 vers l'URL signée "Enregistrer dans Google Wallet"
// Protégé par l'id de carte (UUID non devinable) + le token de la boutique.
export async function GET(req: Request, { params }: { params: Promise<{ cardId: string }> }) {
  try {
    const { cardId } = await params;
    const url = new URL(req.url);
    const token = (url.searchParams.get("t") || "").trim();
    const wallet = url.searchParams.get("wallet");

    if (!UUID_RE.test(cardId) || !UUID_RE.test(token)) {
      return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 });
    }
    if (wallet !== "apple" && wallet !== "google") {
      return NextResponse.json({ error: "Type de wallet invalide" }, { status: 400 });
    }

    const meta = extractRequestMeta(req);
    const limit = await rateLimit(`enroll-artifact:${meta.ip_address}`, 60, 3600000);
    if (!limit.success) {
      return NextResponse.json({ error: "Trop de requêtes" }, { status: 429 });
    }

    const { data: card } = await supabaseAdmin
      .from("loyalty_cards")
      .select("id, stamps_count, merchant_id, customer_id")
      .eq("id", cardId)
      .maybeSingle();
    if (!card) return NextResponse.json({ error: "Carte introuvable" }, { status: 404 });

    const { data: merchant } = await supabaseAdmin
      .from("merchants")
      .select("enrollment_token, shop_name, primary_color")
      .eq("id", card.merchant_id)
      .maybeSingle();
    if (!merchant || merchant.enrollment_token !== token) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }

    const { data: customer } = await supabaseAdmin
      .from("customers")
      .select("full_name")
      .eq("id", card.customer_id)
      .maybeSingle();
    const customerName = customer?.full_name || "Client";
    const stamps = card.stamps_count ?? 0;

    if (wallet === "apple") {
      // On génère d'abord le buffer (peut échouer si les certs manquent) ;
      // pass_type n'est mis à jour qu'en cas de succès, pour ne pas refléter un échec.
      const buffer = await buildApplePassBuffer({
        cardId: card.id,
        customerName,
        stamps,
        branding: { shopName: merchant.shop_name, primaryColor: merchant.primary_color },
      });
      await supabaseAdmin.from("loyalty_cards").update({ pass_type: "apple" }).eq("id", card.id);
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.apple.pkpass",
          "Content-Disposition": `attachment; filename="carte-fidelite.pkpass"`,
        },
      });
    }

    // google
    const { saveUrl, objectId } = await buildGoogleSaveUrl({
      cardId: card.id,
      customerName,
      stamps,
    });
    await supabaseAdmin
      .from("loyalty_cards")
      .update({ pass_type: "google", external_id: objectId })
      .eq("id", card.id);

    return NextResponse.redirect(saveUrl, 302);
  } catch (error) {
    console.error("Enroll artifact error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Erreur lors de la génération de la carte" }, { status: 500 });
  }
}
