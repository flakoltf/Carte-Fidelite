import jwt from "jsonwebtoken";
import fs from "fs/promises";
import path from "path";
import { signQRCode } from "@/lib/qrSignature";
import { classIdFor } from "@/lib/wallet/googleClass";
import { loadDesign } from "@/lib/cardDesign/repository";
import { mapToGoogleObjectExtras } from "@/lib/cardDesign/mapGoogle";

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
  // Fallback class kept for the rare case where merchant lookup fails.
  const fallbackClassId = `${issuerId}.ma_classe_fidelite_template`;

  const allowedOrigins = process.env.GOOGLE_WALLET_ORIGINS
    ? process.env.GOOGLE_WALLET_ORIGINS.split(",")
    : ["https://localhost:3000"];

  // Google Wallet n'accepte pas les tirets dans l'id d'objet.
  const sanitizedCardId = cardId.replace(/-/g, "_");
  const objectId = `${issuerId}.${sanitizedCardId}`;

  const { supabaseAdmin } = await import("@/lib/supabaseAdmin");

  // Resolve merchantId from the card row.
  let merchantId: string | undefined;
  let geoLocations: { latitude: number; longitude: number }[] | undefined;
  const { data: cardRow } = await supabaseAdmin
    .from("loyalty_cards").select("merchant_id").eq("id", cardId).single();
  if (cardRow?.merchant_id) {
    merchantId = cardRow.merchant_id as string;
    const { data: mRow } = await supabaseAdmin
      .from("merchants").select("latitude, longitude").eq("id", merchantId).single();
    if (mRow?.latitude != null && mRow?.longitude != null) {
      geoLocations = [{ latitude: mRow.latitude as number, longitude: mRow.longitude as number }];
    }
  }

  // NOTE: The LoyaltyClass identified by classId must be ensured/published via
  // ensureLoyaltyClass (Task 14, API card-design route) before objects can be
  // created against it. This function only references the class id.
  const classId = merchantId ? classIdFor(merchantId) : fallbackClassId;

  // Load the merchant's card design for the points label + barcode settings.
  // Falls back to legacy defaults if the design cannot be loaded.
  let pointsLabel = "Tampons";
  let barcodeType = "QR_CODE";
  let barcodeAltText = "";
  if (merchantId) {
    try {
      const design = await loadDesign(supabaseAdmin, merchantId);
      const extras = mapToGoogleObjectExtras(design);
      pointsLabel = extras.pointsLabel;
      barcodeType = extras.barcodeType;
      barcodeAltText = extras.barcodeAltText;
    } catch {
      // loadDesign failed — keep the defaults.
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
      label: pointsLabel,
    },
    barcode: {
      type: barcodeType,
      value: signQRCode(cardId),
      ...(barcodeAltText ? { alternateText: barcodeAltText } : {}),
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
