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

  const orgName = branding?.shopName || "HALO";
  const backgroundColor = hexToRgb(branding?.primaryColor) || "rgb(23, 23, 23)";
  // Fallbacks = valeurs réelles du certificat Apple (UID + OU de certs/signerCert.pem) ;
  // l'env doit les surcharger en prod, mais ces défauts garantissent une signature valide.
  const passTypeIdentifier = process.env.APPLE_PASS_TYPE_ID || "pass.com.walletcard.fidelite";
  const teamIdentifier = process.env.APPLE_TEAM_ID || "XD83DMP848";

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
  // Valeurs effectivement transmises à buildPassJson (jeton {points} = solde/max) :
  // par défaut les tampons/objectif classiques ; écrasées ci-dessous pour les
  // programmes à POINTS, où `stamps` (compteur générique reçu de l'appelant, en
  // pratique stamps_count) n'a aucun sens — le solde réel vit dans points_balance.
  let passStamps = stamps;
  let passStampGoal = stampGoal;
  let locations;
  let merchantId: string | undefined;
  let palier: string | undefined;
  let identity: import("@/lib/wallet/passJson").PassIdentity | undefined;
  const { data: cardRow } = await supabaseAdmin
    .from("loyalty_cards")
    .select("merchant_id, points_balance, redeemed_tiers")
    .eq("id", cardId)
    .single();
  if (cardRow?.merchant_id) {
    merchantId = cardRow.merchant_id;
    const { data: mRow } = await supabaseAdmin
      .from("merchants")
      .select("stamp_goal, latitude, longitude, loyalty_type, loyalty_config, reward_label, address, phone, business_hours, google_place_id")
      .eq("id", merchantId)
      .single();
    stampGoal = mRow?.stamp_goal ?? 10;
    passStampGoal = stampGoal;
    // Résout le programme réel du marchand AVANT l'identité (Important 3, revue
    // finale) : pilote le solde affiché ({points} = solde / max) et {palier} pour
    // les cartes à POINTS ; comportement inchangé pour tous les autres types
    // (dont "tiered" ci-dessous). rewardReady (F2, lien avis Google) EN DÉPEND —
    // calculer rewardReady avant de résoudre program donnait un état faux pour
    // les cartes à points (canRedeem tournait sur `stamps`, sans rapport avec
    // points_balance, voire faussement "prêt" via un stamps_count résiduel).
    const { resolveLoyaltyProgram } = await import("@/lib/loyalty/resolveProgram");
    const program = resolveLoyaltyProgram(mRow);
    const pointsBalance = cardRow.points_balance ?? 0;

    // Couche identité commerce (F1) + lien avis Google si reward-ready (F2),
    // calculés ICI pour que TOUT chemin d'émission (enrôlement + régénération
    // web-service après scan) les porte.
    const { identityFromMerchant } = await import("@/lib/wallet/identityFromMerchant");
    const { rewardReadyForIdentity, parseRedeemedTiers } = await import("@/lib/loyalty/points");
    const rewardReady = rewardReadyForIdentity(program, {
      stamps,
      stampGoal,
      pointsBalance,
      redeemedTiers: parseRedeemedTiers(cardRow.redeemed_tiers),
    });
    identity = identityFromMerchant(mRow, new Date(), { rewardReady });
    if (mRow?.latitude != null && mRow?.longitude != null) {
      const { proximityText } = await import("@/lib/geo/geocode");
      locations = [{ latitude: mRow.latitude, longitude: mRow.longitude, relevantText: proximityText(orgName) }];
    }
    if (program.type === "points") {
      const { resolvePointsPassState } = await import("@/lib/loyalty/points");
      const state = resolvePointsPassState(program.config, pointsBalance);
      passStamps = state.stamps;
      passStampGoal = state.stampGoal;
      palier = state.palier;
    } else if (mRow?.loyalty_type === "tiered") {
      // Resolve the customer's current tier name for {palier} token substitution.
      // Only applies to tiered loyalty programs; for all other types the token stays literal.
      const rawTiers = (mRow.loyalty_config as Record<string, unknown> | null)?.tiers;
      if (Array.isArray(rawTiers) && rawTiers.length > 0) {
        const { currentTier } = await import("@/lib/loyalty/engine");
        palier = currentTier(rawTiers as { name: string; at: number }[], stamps)?.name;
      }
    }
    // Sinon (ni points ni tiered, ou données de palier indisponibles), palier reste
    // undefined → buildPassJson le transmet tel quel → resolveTokens garde {palier} littéral.
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
      ["strip1", "strip.png"], ["strip2", "strip@2x.png"], ["strip3", "strip@3x.png"],
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

  // RENDU DES TAMPONS SUR LE PASS (A + A.2) — strip dynamique généré par carte
  // selon l'état RÉEL (stamps / goal) : la carte « vit » et se remplit à chaque
  // scan (régénéré à chaque émission).
  //  - A.2 COMPOSITE (décision manager PR #33) : si le marchand a une PHOTO de
  //    commerce (strip uploadé), on ne masque PLUS les tampons — photo en fond +
  //    voile dégradé sombre (~40 % bas) + grille DANS cette bande (WCAG garanti).
  //  - Sans photo : grille sur fond couleur (comportement Priorité A).
  //  - Gaté sur un design PUBLIÉ de type tampons (pas de surprise pour les
  //    cartes legacy sans design).
  //  - FAIL-OPEN : toute erreur → on garde l'existant (photo brute ou aucun
  //    strip), pass valide quand même (« rien ne casse au comptoir »).
  const isStampsCard = !!design && (design.cardType ?? "stamps") === "stamps";
  if (isStampsCard) {
    try {
      const { chooseStripPlan } = await import("@/lib/cardDesign/stampStrip");
      const { compositeStampStrip, rasterStampStrip, STRIP_SIZES } = await import(
        "@/lib/cardDesign/stampStripRaster"
      );
      const { DEFAULT_STAMPS_CONFIG } = await import("@/lib/cardDesign/types");
      const cfg = design!.stamps ?? DEFAULT_STAMPS_CONFIG;
      const opts = {
        goal: cfg.goal ?? stampGoal,
        filledCount: stamps,
        shape: cfg.shape,
        colors: design!.colors,
      };
      // Photo = strip uploadé (déjà téléchargé plus haut dans designLogoBuffers).
      const bestPhoto =
        designLogoBuffers["strip@3x.png"] ??
        designLogoBuffers["strip@2x.png"] ??
        designLogoBuffers["strip.png"];
      const plan = chooseStripPlan({ hasDesign: true, isStampsCard: true, hasPhoto: !!bestPhoto });
      if (plan === "composite") {
        for (const [name, w, h] of STRIP_SIZES) {
          const photo = designLogoBuffers[name] ?? (bestPhoto as Buffer);
          designLogoBuffers[name] = await compositeStampStrip(photo, w, h, opts);
        }
      } else if (plan === "grid") {
        for (const [name, w, h] of STRIP_SIZES) {
          designLogoBuffers[name] = await rasterStampStrip(w, h, opts);
        }
      }
    } catch (e) {
      console.error("[applePass] génération strip tampons (fail-open):", e instanceof Error ? e.message : e);
    }
  }

  // {visites} : nombre total de scans de la carte (compteur à vie, indépendant
  // des resets de points) — COUNT bon marché sur idx_scan_history_card_id.
  // .gte("points_added", 0) exclut les lignes de COMPENSATION du revert
  // (points_added: -1, scan/revert/route.ts) — sans ce filtre, un scan annulé
  // comptait 2 passages (Minor 4, revue finale). PAS .gt : un scan amount_points
  // peut légitimement créditer 0 point (montant sous le seuil d'arrondi) et reste
  // un passage réel — seule une valeur strictement négative signale une compensation.
  // Best-effort : un échec ne doit jamais empêcher l'émission du pass.
  let visites: number | undefined;
  try {
    const { count } = await supabaseAdmin
      .from("scan_history")
      .select("id", { count: "exact", head: true })
      .eq("card_id", cardId)
      .gte("points_added", 0);
    visites = count ?? 0;
  } catch {
    visites = 0;
  }

  const passJson = buildPassJson({
    cardId,
    customerName,
    stamps: passStamps,
    stampGoal: passStampGoal,
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
    visites,
    identity,
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
