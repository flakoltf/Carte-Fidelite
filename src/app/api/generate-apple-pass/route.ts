// @ts-expect-error PKPass type definitions incomplete
import { PKPass } from "passkit-generator";
import fs from "fs/promises";
import path from "path";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { rateLimit } from "@/lib/rateLimit";
import { signQRCode } from "@/lib/qrSignature";

export async function POST(req: NextRequest) {
  try {
    // --- SÉCURITÉ : Rate limiting ---
    const { createClient } = await import("@/utils/supabase/server");
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;

    if (!user) {
      return NextResponse.json({ error: "Session expirée ou non trouvée. Veuillez vous reconnecter." }, { status: 401 });
    }

    const rateLimitResult = rateLimit(`generate-apple-pass:${user.id}`, 30, 3600000); // 30/hour
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

    // --- SÉCURITÉ : Récupérer le marchand lié à cet utilisateur ---
    const { data: merchant, error: merchError } = await supabaseAdmin
      .from("merchants")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (merchError || !merchant) {
      return NextResponse.json({ error: "Profil marchand manquant pour cet utilisateur" }, { status: 400 });
    }

    const { data: customer, error: custError } = await supabaseAdmin
      .from("customers")
      .upsert({
        merchant_id: merchant.id,
        full_name: customerName,
        email: `${customerName.toLowerCase().replace(/\s+/g, '.')}_${merchant.id}_${Date.now()}@walletcard.local`
      }, { onConflict: 'email' })
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

    // --- LOGIQUE APPLE WALLET ---
    const wwdrPath = process.env.WWDR_PEM_PATH || "certs/wwdr.pem";
    const signerCertPath = process.env.SIGNER_CERT_PATH || "certs/signerCert.pem";
    const signerKeyPath = process.env.SIGNER_KEY_PATH || "certs/signerKey.pem";
    const signerKeyPassphrase = process.env.SIGNER_KEY_PASSPHRASE || "";

    let wwdr, signerCert, signerKey;
    try {
        [wwdr, signerCert, signerKey] = await Promise.all([
        fs.readFile(path.join(process.cwd(), wwdrPath)),
        fs.readFile(path.join(process.cwd(), signerCertPath)),
        fs.readFile(path.join(process.cwd(), signerKeyPath))
        ]);
    } catch (e) {
        throw new Error("Certificats Apple manquants dans /certs. (wwdr.pem, signerCert.pem, signerKey.pem)");
    }

    const pass = new PKPass({
      "passTypeIdentifier": process.env.APPLE_PASS_TYPE_ID || "pass.com.tamarque.fidelite",
      "teamIdentifier": process.env.APPLE_TEAM_ID || "ABCDE12345",
      "serialNumber": card.id, // ID unique de la base de données
      "organizationName": "Ma Super Marque",
      "logoText": "Fidélité",
      "description": "Carte de fidélité numérique",
      "backgroundColor": "rgb(23, 23, 23)", 
      "foregroundColor": "rgb(255, 255, 255)", 
      "labelColor": "rgb(156, 163, 175)", 
    }, {
      wwdr,
      signerCert,
      signerKey,
      signerKeyPassphrase,
    });

    pass.type = "storeCard";

    pass.primaryFields.push({
      key: "stamps",
      label: "TAMPONS",
      value: `${card.stamps_count} / 10`,
      textAlignment: "PKTextAlignmentRight"
    });

    pass.secondaryFields.push({
      key: "customerName",
      label: "CLIENT",
      value: customerName
    });

    pass.setBarcodes({
      message: signQRCode(card.id),
      format: "PKBarcodeFormatQR",
      messageEncoding: "iso-8859-1",
      altText: "Scannez pour valider vos tampons"
    });

    const assetsPath = path.join(process.cwd(), "public", "pass-assets");
    try {
        pass.addBuffer("icon.png", await fs.readFile(path.join(assetsPath, "icon.png")));
        pass.addBuffer("icon@2x.png", await fs.readFile(path.join(assetsPath, "icon@2x.png")));
        pass.addBuffer("logo.png", await fs.readFile(path.join(assetsPath, "logo.png")));
        pass.addBuffer("strip.png", await fs.readFile(path.join(assetsPath, "strip.png"))); 
    } catch (e) {
        console.warn("Certaines images manquantes dans public/pass-assets.");
    }
    
    const passBuffer = pass.getAsBuffer();

    return new NextResponse(passBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="carte-fidelite.pkpass"`,
      },
    });

  } catch (error: any) {
    console.error("Apple Pass generation error:", error.message);
    return NextResponse.json({ error: "Erreur lors de la génération de la carte" }, { status: 500 });
  }
}
