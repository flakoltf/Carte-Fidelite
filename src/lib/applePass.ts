/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck — passkit-generator v3 .d.ts declare a constructor signature
// (buffers, certs, props) that doesn't match the runtime usage (props, certs).
// On confine ce @ts-nocheck à ce module dédié pour que le reste du code reste typé.
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
// Renvoie null si l'entrée est absente/invalide, pour laisser l'appelant choisir un fallback.
export function hexToRgb(hex?: string | null): string | null {
  if (!hex) return null;
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const int = parseInt(m[1], 16);
  return `rgb(${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255})`;
}

// Génère le buffer .pkpass d'une carte de fidélité. Logique extraite de
// generate-apple-pass/route.ts pour être partagée avec l'enrôlement public.
export async function buildApplePassBuffer({
  cardId,
  customerName,
  stamps,
  branding,
}: ApplePassInput): Promise<Buffer> {
  const wwdrPath = process.env.WWDR_PEM_PATH || "certs/wwdr.pem";
  const signerCertPath = process.env.SIGNER_CERT_PATH || "certs/signerCert.pem";
  const signerKeyPath = process.env.SIGNER_KEY_PATH || "certs/signerKey.pem";
  const signerKeyPassphrase = process.env.SIGNER_KEY_PASSPHRASE || "";

  let wwdr: Buffer, signerCert: Buffer, signerKey: Buffer;
  try {
    [wwdr, signerCert, signerKey] = await Promise.all([
      fs.readFile(path.join(process.cwd(), wwdrPath)),
      fs.readFile(path.join(process.cwd(), signerCertPath)),
      fs.readFile(path.join(process.cwd(), signerKeyPath)),
    ]);
  } catch {
    throw new Error(
      "Certificats Apple manquants dans /certs. (wwdr.pem, signerCert.pem, signerKey.pem)"
    );
  }

  const orgName = branding?.shopName || "Ma Super Marque";
  const backgroundColor = hexToRgb(branding?.primaryColor) || "rgb(23, 23, 23)";

  const pass = new PKPass(
    {
      passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID || "pass.com.tamarque.fidelite",
      teamIdentifier: process.env.APPLE_TEAM_ID || "ABCDE12345",
      serialNumber: cardId,
      organizationName: orgName,
      logoText: orgName,
      description: "Carte de fidélité numérique",
      backgroundColor,
      foregroundColor: "rgb(255, 255, 255)",
      labelColor: "rgb(255, 255, 255)",
    },
    {
      wwdr,
      signerCert,
      signerKey,
      signerKeyPassphrase,
    }
  );

  pass.type = "storeCard";

  pass.primaryFields.push({
    key: "stamps",
    label: "TAMPONS",
    value: `${stamps} / 10`,
    textAlignment: "PKTextAlignmentRight",
  });

  pass.secondaryFields.push({
    key: "customerName",
    label: "CLIENT",
    value: customerName,
  });

  pass.setBarcodes({
    message: signQRCode(cardId),
    format: "PKBarcodeFormatQR",
    messageEncoding: "iso-8859-1",
    altText: "Scannez pour valider vos tampons",
  });

  const assetsPath = path.join(process.cwd(), "public", "pass-assets");
  try {
    pass.addBuffer("icon.png", await fs.readFile(path.join(assetsPath, "icon.png")));
    pass.addBuffer("icon@2x.png", await fs.readFile(path.join(assetsPath, "icon@2x.png")));
    pass.addBuffer("logo.png", await fs.readFile(path.join(assetsPath, "logo.png")));
    pass.addBuffer("strip.png", await fs.readFile(path.join(assetsPath, "strip.png")));
  } catch {
    console.warn("Certaines images manquantes dans public/pass-assets.");
  }

  return pass.getAsBuffer();
}
