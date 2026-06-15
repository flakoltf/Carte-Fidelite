import jwt from "jsonwebtoken";
import fs from "fs/promises";
import path from "path";
import { signQRCode } from "@/lib/qrSignature";
import { classIdFor, ensureLoyaltyClass } from "@/lib/wallet/googleClass";
import { loadDesign } from "@/lib/cardDesign/repository";
import { mapToGoogleObjectExtras } from "@/lib/cardDesign/mapGoogle";
import { DEFAULT_CARD_DESIGN } from "@/lib/cardDesign/types";

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

  const issuerId = process.env.GOOGLE_ISSUER_ID;
  if (!issuerId) throw new Error("GOOGLE_ISSUER_ID is required.");
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
  let shopName: string | undefined;
  let geoLocations: { latitude: number; longitude: number }[] | undefined;
  let identityModules: import("@/lib/wallet/googleIdentity").GoogleIdentityModules = {};
  const { data: cardRow } = await supabaseAdmin
    .from("loyalty_cards").select("merchant_id").eq("id", cardId).single();
  if (cardRow?.merchant_id) {
    merchantId = cardRow.merchant_id as string;
    const { data: mRow } = await supabaseAdmin
      .from("merchants")
      .select("shop_name, latitude, longitude, reward_label, address, phone, business_hours, google_place_id, stamp_goal")
      .eq("id", merchantId).single();
    if (mRow?.shop_name) shopName = mRow.shop_name as string;
    if (mRow?.latitude != null && mRow?.longitude != null) {
      geoLocations = [{ latitude: mRow.latitude as number, longitude: mRow.longitude as number }];
    }
    // Couche identité commerce (F1) + lien avis Google si reward-ready (F2) :
    // récompense + horaires (textModules), itinéraire + appel + avis (linksModule).
    const { identityFromMerchant } = await import("@/lib/wallet/identityFromMerchant");
    const { googleIdentityModules } = await import("@/lib/wallet/googleIdentity");
    const { canRedeem } = await import("@/lib/loyalty/stamp");
    const rewardReady = canRedeem(stamps, (mRow?.stamp_goal as number) ?? 10);
    identityModules = googleIdentityModules(identityFromMerchant(mRow, new Date(), { rewardReady }));
  }

  // Garantit la classe Google à l'émission (GET -> PATCH / 404 -> INSERT, jamais
  // de PUT) : un marchand fraîchement onboardé sans design sauvegardé obtient une
  // classe valide au premier enrôlement, au lieu d'un bouton qui échoue en caisse.
  // En cas d'échec API, on retombe sur la classe partagée : carte non brandée
  // plutôt qu'un échec devant le client final.
  let classId = fallbackClassId;
  let pointsLabel = "Tampons";
  let barcodeType = "QR_CODE";
  let barcodeAltText = "";
  if (merchantId) {
    classId = classIdFor(merchantId);
    try {
      const design = await loadDesign(supabaseAdmin, merchantId);
      // Design par défaut (aucune ligne en base) : on personnalise au moins le
      // nom de programme avec celui de la boutique.
      if (design.programName === DEFAULT_CARD_DESIGN.programName && shopName) {
        design.programName = shopName;
      }
      const extras = mapToGoogleObjectExtras(design);
      pointsLabel = extras.pointsLabel;
      barcodeType = extras.barcodeType;
      barcodeAltText = extras.barcodeAltText;
      classId = await ensureLoyaltyClass(merchantId, design);
    } catch (e) {
      console.error(
        "ensureLoyaltyClass à l'émission a échoué — fallback classe partagée:",
        e instanceof Error ? e.message : e,
      );
      classId = fallbackClassId;
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
    ...identityModules,
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
