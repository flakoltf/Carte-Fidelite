import jwt from "jsonwebtoken";
import fs from "fs/promises";
import path from "path";
import { signQRCode } from "@/lib/qrSignature";

export interface GooglePassInput {
  cardId: string;
  customerName: string;
  stamps: number;
}

export interface GooglePassResult {
  saveUrl: string;
  objectId: string;
}

// Construit l'objet Google Wallet, le signe en JWT (RS256) et renvoie l'URL
// "Enregistrer dans Google Wallet". Logique extraite de generate-google-pass/route.ts
// pour être partagée avec l'enrôlement public.
export async function buildGoogleSaveUrl({
  cardId,
  customerName,
  stamps,
}: GooglePassInput): Promise<GooglePassResult> {
  // En production, les identifiants viennent d'une variable d'env (JSON brut ou base64) ;
  // en local, on retombe sur le fichier certs/credentials.json (gitignoré).
  let credentialsRaw: string;
  const envCreds = process.env.GOOGLE_CREDENTIALS_JSON;
  if (envCreds && envCreds.trim().length > 0) {
    credentialsRaw = envCreds.trim().startsWith("{")
      ? envCreds
      : Buffer.from(envCreds, "base64").toString("utf-8");
  } else {
    credentialsRaw = await fs.readFile(path.join(process.cwd(), "certs", "credentials.json"), "utf-8");
  }
  const credentials = JSON.parse(credentialsRaw) as {
    client_email: string;
    private_key: string;
  };

  const issuerId = process.env.GOOGLE_ISSUER_ID || "REMPLACE_PAR_TON_ISSUER_ID";
  const classId = `${issuerId}.ma_classe_fidelite_template`;

  const allowedOrigins = process.env.GOOGLE_WALLET_ORIGINS
    ? process.env.GOOGLE_WALLET_ORIGINS.split(",")
    : ["https://localhost:3000"];

  // Google Wallet n'accepte pas les tirets dans l'id d'objet.
  const sanitizedCardId = cardId.replace(/-/g, "_");
  const objectId = `${issuerId}.${sanitizedCardId}`;

  const { supabaseAdmin } = await import("@/lib/supabaseAdmin");
  let geoLocations: { latitude: number; longitude: number }[] | undefined;
  const { data: cardRow } = await supabaseAdmin
    .from("loyalty_cards").select("merchant_id").eq("id", cardId).single();
  if (cardRow?.merchant_id) {
    const { data: mRow } = await supabaseAdmin
      .from("merchants").select("latitude, longitude").eq("id", cardRow.merchant_id).single();
    if (mRow?.latitude != null && mRow?.longitude != null) {
      geoLocations = [{ latitude: mRow.latitude as number, longitude: mRow.longitude as number }];
    }
  }

  const loyaltyObject = {
    id: objectId,
    classId,
    state: "ACTIVE",
    accountId: cardId,
    accountName: customerName,
    loyaltyPoints: {
      balance: { int: stamps },
      label: "Tampons",
    },
    barcode: {
      type: "QR_CODE",
      value: signQRCode(cardId),
    },
    ...(geoLocations ? { locations: geoLocations } : {}),
  };

  const claims = {
    iss: credentials.client_email,
    aud: "google",
    origins: allowedOrigins,
    typ: "savetowallet",
    payload: {
      loyaltyObjects: [loyaltyObject],
    },
  };

  const token = jwt.sign(claims, credentials.private_key, { algorithm: "RS256" });
  return { saveUrl: `https://pay.google.com/gp/v/save/${token}`, objectId };
}
