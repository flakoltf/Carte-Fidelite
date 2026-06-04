import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { currentMerchantId } from "@/lib/analytics/merchant";
import { rateLimit } from "@/lib/rateLimit";
import { logAuditEvent, extractRequestMeta } from "@/lib/auditLog";
import { checkIdempotency, setIdempotency } from "@/lib/idempotency";
import { buildApplePassBuffer } from "@/lib/applePass";

type CachedCard = { cardId: string; customerId: string; customerName: string; stamps: number };

export async function POST(req: NextRequest) {
  try {
    // --- SÉCURITÉ : Authentification + Rate limiting ---
    const { createClient } = await import("@/utils/supabase/server");
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Session expirée ou non trouvée. Veuillez vous reconnecter." }, { status: 401 });
    }

    const rateLimitResult = await rateLimit(`generate-apple-pass:${user.id}`, 30, 3600000); // 30/hour
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: "Limite de générations atteinte. Réessayez dans 1 heure." }, { status: 429 });
    }

    const { customerName, currentStamps } = await req.json();

    if (!customerName || currentStamps === undefined) {
      return NextResponse.json({ error: "Champs requis manquants" }, { status: 400 });
    }

    if (typeof currentStamps !== 'number' || currentStamps < 0 || currentStamps > 10) {
      return NextResponse.json({ error: "currentStamps doit être entre 0 et 10" }, { status: 400 });
    }

    if (typeof customerName !== 'string' || customerName.length < 2 || customerName.length > 100) {
      return NextResponse.json({ error: "customerName invalide (2-100 caractères)" }, { status: 400 });
    }

    // --- SÉCURITÉ : Récupérer le marchand effectif (respecte l'impersonation) + branding ---
    const merchantId = await currentMerchantId();

    if (!merchantId) {
      return NextResponse.json({ error: "Profil marchand manquant pour cet utilisateur" }, { status: 400 });
    }

    const { data: merchant, error: merchError } = await supabaseAdmin
      .from("merchants")
      .select("id, shop_name, primary_color")
      .eq("id", merchantId)
      .maybeSingle();

    if (merchError || !merchant) {
      return NextResponse.json({ error: "Profil marchand manquant pour cet utilisateur" }, { status: 400 });
    }

    // --- SÉCURITÉ : Idempotence (évite la double création BDD en cas de retry) ---
    // On cache uniquement l'ID de la carte, pas le buffer binaire ;
    // un même Idempotency-Key régénère le même pkpass pour la même carte BDD.
    const idempotencyHeader = req.headers.get("idempotency-key");
    const idempotencyKey = idempotencyHeader
      ? `generate-apple:${user.id}:${idempotencyHeader}`
      : null;

    let cardId: string;
    let resolvedCustomerName: string;
    let resolvedStamps: number;

    const cached = idempotencyKey ? (await checkIdempotency(idempotencyKey)) as CachedCard | null : null;
    if (cached) {
      cardId = cached.cardId;
      resolvedCustomerName = cached.customerName;
      resolvedStamps = cached.stamps;
    } else {
      const { data: customer, error: custError } = await supabaseAdmin
        .from("customers")
        .insert({
          merchant_id: merchant.id,
          full_name: customerName,
        })
        .select()
        .single();

      if (custError) throw custError;

      const { data: card, error: cardError } = await supabaseAdmin
        .from("loyalty_cards")
        .insert({
          customer_id: customer.id,
          merchant_id: merchant.id,
          stamps_count: currentStamps,
          pass_type: 'apple'
        })
        .select()
        .single();

      if (cardError) throw cardError;

      cardId = card.id;
      resolvedCustomerName = customerName;
      resolvedStamps = card.stamps_count;

      const meta = extractRequestMeta(req);
      await logAuditEvent({
        action: "CARD_GENERATED",
        merchant_id: merchant.id,
        user_id: user.id,
        card_id: card.id,
        details: { pass_type: "apple", initial_stamps: currentStamps },
        ...meta,
      });

      if (idempotencyKey) {
        await setIdempotency(idempotencyKey, {
          cardId,
          customerId: customer.id,
          customerName: resolvedCustomerName,
          stamps: resolvedStamps,
        } satisfies CachedCard);
      }
    }

    // --- LOGIQUE APPLE WALLET (extraite dans src/lib/applePass.ts) ---
    const passBuffer = await buildApplePassBuffer({
      cardId,
      customerName: resolvedCustomerName,
      stamps: resolvedStamps,
      branding: { shopName: merchant.shop_name, primaryColor: merchant.primary_color },
    });

    return new NextResponse(new Uint8Array(passBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="carte-fidelite.pkpass"`,
      },
    });

  } catch (error) {
    console.error("Apple Pass generation error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Erreur lors de la génération de la carte" }, { status: 500 });
  }
}
