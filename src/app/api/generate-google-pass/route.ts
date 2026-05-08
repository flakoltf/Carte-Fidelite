import { NextResponse } from "next/server";
import { google } from "googleapis";
import jwt from "jsonwebtoken";
import fs from "fs/promises";
import path from "path";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(req: Request) {
  try {
    // --- SÉCURITÉ : Authentification + Rate limiting ---
    const { createClient } = await import("@/utils/supabase/server");
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;

    if (!user) {
      return NextResponse.json({ error: "Session expirée ou non trouvée. Veuillez vous reconnecter." }, { status: 401 });
    }

    const rateLimitResult = rateLimit(`generate-google-pass:${user.id}`, 30, 3600000); // 30/hour
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

    // Récupérer le marchand lié à cet utilisateur
    const { data: merchant, error: merchError } = await supabaseAdmin
      .from("merchants")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (merchError || !merchant) {
      console.error("ERREUR MARCHAND :", merchError);
      return NextResponse.json({ error: "Profil marchand manquant pour cet utilisateur" }, { status: 400 });
    }

    // 2. Créer ou récupérer le client
    const { data: customer, error: custError } = await supabaseAdmin
      .from("customers")
      .upsert({ 
        merchant_id: merchant.id, 
        full_name: customerName,
        email: `test_${Date.now()}@example.com` // Temporaire
      }, { onConflict: 'email' })
      .select()
      .single();

    if (custError) throw custError;

    // 3. Créer la carte de fidélité
    const { data: card, error: cardError } = await supabaseAdmin
      .from("loyalty_cards")
      .insert({
        customer_id: customer.id,
        merchant_id: merchant.id,
        stamps_count: currentStamps,
        pass_type: 'google'
      })
      .select()
      .single();

    if (cardError) throw cardError;

    // --- LOGIQUE GOOGLE WALLET ---
    const credentialsPath = path.join(process.cwd(), "certs", "credentials.json");
    const credentialsRaw = await fs.readFile(credentialsPath, "utf-8");
    const credentials = JSON.parse(credentialsRaw);

    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/wallet_object.issuer"],
    });

    const issuerId = process.env.GOOGLE_ISSUER_ID || "REMPLACE_PAR_TON_ISSUER_ID";
    const classId = `${issuerId}.ma_classe_fidelite_template`;

    // Use environment variable for allowed origins, fallback to localhost
    const allowedOrigins = process.env.GOOGLE_WALLET_ORIGINS
      ? process.env.GOOGLE_WALLET_ORIGINS.split(',')
      : ["https://localhost:3000"];

    // On utilise l'ID de la base de données après avoir supprimé les tirets (requis par Google Wallet)
    const sanitizedCardId = card.id.replace(/-/g, "_");
    const objectId = `${issuerId}.${sanitizedCardId}`;

    const loyaltyObject = {
      id: objectId,
      classId: classId,
      state: "ACTIVE",
      accountId: card.id,
      accountName: customerName,
      loyaltyPoints: {
        balance: { int: card.stamps_count },
        label: "Tampons"
      },
      barcode: {
        type: "QR_CODE",
        value: card.id // Le QR code contiendra l'ID unique de la carte en base
      }
    };

    const claims = {
      iss: credentials.client_email,
      aud: "google",
      origins: allowedOrigins,
      typ: "savetowallet",
      payload: {
        loyaltyObjects: [loyaltyObject]
      }
    };

    const token = jwt.sign(claims, credentials.private_key, { algorithm: "RS256" });
    const saveUrl = `https://pay.google.com/gp/v/save/${token}`;

    // Mise à jour de la carte avec son external_id
    await supabaseAdmin
      .from("loyalty_cards")
      .update({ external_id: objectId })
      .eq("id", card.id);

    return NextResponse.json({ saveUrl, success: true, cardId: card.id });

  } catch (error: any) {
    console.error("Erreur Google Wallet:", error);
    return NextResponse.json({ error: error.message || "Erreur de génération du lien Google Wallet" }, { status: 500 });
  }
}
