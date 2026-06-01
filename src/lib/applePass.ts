/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck — passkit-generator v3 typings imparfaits sur Buffer<ArrayBufferLike>.
import { PKPass } from "passkit-generator";
import fs from "fs/promises";
import path from "path";
import { signQRCode } from "@/lib/qrSignature";

export interface MerchantBranding {
  shopName?: string | null;
  primaryColor?: string | null; // hex "#rrggbb"
}

export interface ApplePassInput {
  cardId: string;
  customerName: string;
  stamps: number;
  branding?: MerchantBranding;
}

// Convertit un hex "#rrggbb" en "rgb(r, g, b)" (format attendu par Apple Wallet).
export function hexToRgb(hex?: string | null): string | null {
  if (!hex) return null;
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const int = parseInt(m[1], 16);
  return `rgb(${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255})`;
}

// Génère le buffer .pkpass d'une carte de fidélité.
//
// IMPORTANT : la signature correcte de passkit-generator v3 est
//   new PKPass(buffers, certificates, props?)
// où `buffers` est une map { "pass.json": Buffer, "icon.png": Buffer, … }.
// L'ancienne version de ce fichier appelait `new PKPass(props, certs)` (sous @ts-nocheck),
// ce qui produisait un zip où chaque prop devenait un fichier — iOS refusait alors le pass
// (« impossible d'ajouter la carte ou le billet »). On construit donc pass.json explicitement.
export async function buildApplePassBuffer({
  cardId,
  customerName,
  stamps,
  branding,
}: ApplePassInput): Promise<Buffer> {
  // En prod : certificats fournis en base64 via env (WWDR_PEM_BASE64, SIGNER_CERT_BASE64,
  // SIGNER_KEY_BASE64) — les fichiers PEM sont gitignorés et n'arrivent pas sur Vercel.
  // En local : fallback sur les fichiers dans certs/.
  const signerKeyPassphrase = process.env.SIGNER_KEY_PASSPHRASE || "";
  const loadPem = async (envB64: string | undefined, fileRelPath: string): Promise<Buffer> => {
    if (envB64 && envB64.trim().length > 0) return Buffer.from(envB64, "base64");
    return fs.readFile(path.join(process.cwd(), fileRelPath));
  };

  let wwdr: Buffer, signerCert: Buffer, signerKey: Buffer;
  try {
    [wwdr, signerCert, signerKey] = await Promise.all([
      loadPem(process.env.WWDR_PEM_BASE64, process.env.WWDR_PEM_PATH || "certs/wwdr.pem"),
      loadPem(process.env.SIGNER_CERT_BASE64, process.env.SIGNER_CERT_PATH || "certs/signerCert.pem"),
      loadPem(process.env.SIGNER_KEY_BASE64, process.env.SIGNER_KEY_PATH || "certs/signerKey.pem"),
    ]);
  } catch {
    throw new Error(
      "Certificats Apple manquants : ni les variables d'env (WWDR_PEM_BASE64, SIGNER_CERT_BASE64, SIGNER_KEY_BASE64), ni les fichiers dans certs/."
    );
  }

  const orgName = branding?.shopName || "WalletCard";
  const backgroundColor = hexToRgb(branding?.primaryColor) || "rgb(23, 23, 23)";
  const passTypeIdentifier = process.env.APPLE_PASS_TYPE_ID || "pass.com.tamarque.fidelite";
  const teamIdentifier = process.env.APPLE_TEAM_ID || "ABCDE12345";

  // pass.json push-ready (webServiceURL + authenticationToken + champ message),
  // construit par le builder pur partagé.
  const { buildPassJson } = await import("@/lib/wallet/passJson");
  const { ensureAuthToken, getCardMessage } = await import("@/lib/wallet/authToken");

  const authToken = await ensureAuthToken(cardId);
  const message = await getCardMessage(cardId);
  const webServiceURL =
    process.env.APPLE_WEB_SERVICE_URL ||
    `${process.env.NEXT_PUBLIC_BASE_URL || "https://carte-fidelite-nu.vercel.app"}/api/wallet/apple`;

  const { supabaseAdmin } = await import("@/lib/supabaseAdmin");
  let stampGoal = 10;
  const { data: cardRow } = await supabaseAdmin
    .from("loyalty_cards")
    .select("merchant_id")
    .eq("id", cardId)
    .single();
  if (cardRow?.merchant_id) {
    const { data: mRow } = await supabaseAdmin
      .from("merchants")
      .select("stamp_goal")
      .eq("id", cardRow.merchant_id)
      .single();
    stampGoal = mRow?.stamp_goal ?? 10;
  }

  const passJson = buildPassJson({
    cardId,
    customerName,
    stamps,
    stampGoal,
    orgName,
    backgroundColor,
    passTypeIdentifier,
    teamIdentifier,
    barcodeMessage: signQRCode(cardId),
    webServiceURL,
    authToken,
    message,
  });

  // Buffer map initial pour PKPass : pass.json + icônes/logo.
  // icon.png et icon@2x.png sont les seuls vraiment requis par iOS.
  const buffers: Record<string, Buffer> = {
    "pass.json": Buffer.from(JSON.stringify(passJson), "utf-8"),
  };

  const assetsPath = path.join(process.cwd(), "public", "pass-assets");
  for (const name of ["icon.png", "icon@2x.png", "icon@3x.png", "logo.png", "logo@2x.png"]) {
    try {
      buffers[name] = await fs.readFile(path.join(assetsPath, name));
    } catch {
      // Asset optionnel absent — on continue (icon.png + icon@2x.png suffisent au minimum).
    }
  }

  // Construction correcte : (buffers, certificates).
  const pass = new PKPass(buffers, {
    wwdr,
    signerCert,
    signerKey,
    signerKeyPassphrase,
  });

  return pass.getAsBuffer();
}
