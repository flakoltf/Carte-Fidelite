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
  let locations;
  let merchantId: string | undefined;
  let palier: string | undefined;
  const { data: cardRow } = await supabaseAdmin
    .from("loyalty_cards")
    .select("merchant_id")
    .eq("id", cardId)
    .single();
  if (cardRow?.merchant_id) {
    merchantId = cardRow.merchant_id;
    const { data: mRow } = await supabaseAdmin
      .from("merchants")
      .select("stamp_goal, latitude, longitude, loyalty_type, loyalty_config")
      .eq("id", merchantId)
      .single();
    stampGoal = mRow?.stamp_goal ?? 10;
    if (mRow?.latitude != null && mRow?.longitude != null) {
      const { proximityText } = await import("@/lib/geo/geocode");
      locations = [{ latitude: mRow.latitude, longitude: mRow.longitude, relevantText: proximityText(orgName) }];
    }
    // Resolve the customer's current tier name for {palier} token substitution.
    // Only applies to tiered loyalty programs; for all other types the token stays literal.
    if (mRow?.loyalty_type === "tiered") {
      const rawTiers = (mRow.loyalty_config as Record<string, unknown> | null)?.tiers;
      if (Array.isArray(rawTiers) && rawTiers.length > 0) {
        const { currentTier } = await import("@/lib/loyalty/engine");
        palier = currentTier(rawTiers as { name: string; at: number }[], stamps)?.name;
      }
    }
    // If not tiered or tier data unavailable, palier remains undefined →
    // buildPassJson passes it through as undefined → resolveTokens keeps {palier} literal.
  }

  // Load the merchant's saved card design (null = no design row → legacy behavior preserved).
  let design: import("@/lib/cardDesign/types").CardDesign | undefined;
  if (merchantId) {
    try {
      const { loadDesignOrNull } = await import("@/lib/cardDesign/repository");
      const d = await loadDesignOrNull(supabaseAdmin, merchantId);
      if (d) design = d;
    } catch {
      // Design load failed — keep undefined so legacy pass output is used.
    }
  }

  // Download design logo assets from Storage when available; fall back gracefully.
  const designLogoBuffers: Record<string, Buffer> = {};
  if (design?.logo?.assets?.apple) {
    const apple = design.logo.assets.apple;
    const assetMap: [string, string][] = [
      ["x1", "logo.png"], ["x2", "logo@2x.png"], ["x3", "logo@3x.png"],
      ["icon1", "icon.png"], ["icon2", "icon@2x.png"], ["icon3", "icon@3x.png"],
    ];
    try {
      const { downloadAsset } = await import("@/lib/cardDesign/storage");
      await Promise.all(
        assetMap.map(async ([assetKey, bufferName]) => {
          const storagePath = (apple as Record<string, string | undefined>)[assetKey];
          if (!storagePath) return;
          try {
            designLogoBuffers[bufferName] = await downloadAsset(storagePath);
          } catch {
            // Individual asset download failed — public fallback will be used for this file.
          }
        })
      );
    } catch {
      // storage module unavailable — all assets fall back to public defaults.
    }
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
    locations,
    design,
    palier,
  });

  // Buffer map for PKPass: pass.json + icon/logo assets.
  // Design Storage assets take priority; public/pass-assets are the fallback.
  const buffers: Record<string, Buffer> = {
    "pass.json": Buffer.from(JSON.stringify(passJson), "utf-8"),
  };

  const assetsPath = path.join(process.cwd(), "public", "pass-assets");
  const allAssets = new Set([
    "icon.png", "icon@2x.png", "icon@3x.png", "logo.png", "logo@2x.png",
    ...Object.keys(designLogoBuffers),
  ]);
  for (const name of allAssets) {
    if (designLogoBuffers[name]) {
      buffers[name] = designLogoBuffers[name];
    } else {
      try {
        buffers[name] = await fs.readFile(path.join(assetsPath, name));
      } catch {
        // Asset optionnel absent — on continue (icon.png + icon@2x.png suffisent au minimum).
      }
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
