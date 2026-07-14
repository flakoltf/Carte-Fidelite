// Modèle de preview du studio — DÉRIVÉ DE LA MÊME SOURCE QUE LE PASS RÉEL.
//
// Principe non négociable (brief studio) : le preview ne rend pas le CardDesign
// brut, il rend la SORTIE DES ADAPTERS. Apple → buildPassJson (exactement la
// fonction utilisée par buildApplePassBuffer à l'émission). Google →
// mapToGoogleClass + mapToGoogleObjectExtras (les fonctions utilisées par
// buildGoogleSaveUrl). Si un adapter perd, tronque ou déborde un champ, le
// preview le perd aussi — c'est le comportement recherché.
//
// Le test golden (previewModel.test.ts) verrouille ce contrat : toute
// réintroduction d'un moteur de rendu parallèle casse le build.

import type { CardDesign } from "@/lib/cardDesign/types";
import { buildPassJson, resolveTokens, type PassJson, type PassIdentity } from "./passJson";
import { mapToGoogleClass, mapToGoogleObjectExtras, googleBarcodeType } from "@/lib/cardDesign/mapGoogle";

export interface PreviewContext {
  customerName?: string;
  stamps?: number;
  stampGoal?: number;
  palier?: string;
  /** Message commerçant simulé (déclenche la bannière — champ auxiliary en tête). */
  message?: string;
  /** Couche identité commerce simulée (récompense/horaires/adresse/téléphone…). */
  identity?: PassIdentity;
  barcodeMessage?: string;
}

export const DEFAULT_PREVIEW_CONTEXT: Required<Pick<PreviewContext, "customerName" | "stamps" | "palier">> = {
  customerName: "Sarah M.",
  stamps: 7,
  palier: "Argent",
};

function ctxDefaults(design: CardDesign, ctx: PreviewContext) {
  return {
    customerName: ctx.customerName ?? DEFAULT_PREVIEW_CONTEXT.customerName,
    stamps: ctx.stamps ?? DEFAULT_PREVIEW_CONTEXT.stamps,
    stampGoal: ctx.stampGoal ?? design.stamps?.goal ?? 10,
    palier: ctx.palier ?? DEFAULT_PREVIEW_CONTEXT.palier,
    barcodeMessage: ctx.barcodeMessage ?? "HALO-PREVIEW-TOKEN",
  };
}

/**
 * Pass Apple du preview = `buildPassJson` avec des valeurs runtime neutres.
 * Rend le rendu créatif du design AVEC le débordement de zones, le filet
 * {points}, la couche identité et la bannière message — exactement comme iOS.
 */
export function buildPreviewApplePass(design: CardDesign, ctx: PreviewContext = {}): PassJson {
  const d = ctxDefaults(design, ctx);
  return buildPassJson({
    cardId: "preview",
    customerName: d.customerName,
    stamps: d.stamps,
    stampGoal: d.stampGoal,
    orgName: design.programName,
    backgroundColor: "", // remplacé par le chemin design
    passTypeIdentifier: "preview",
    teamIdentifier: "preview",
    barcodeMessage: d.barcodeMessage,
    palier: d.palier,
    message: ctx.message,
    identity: ctx.identity,
    design,
  });
}

export interface GooglePreviewModel {
  programName: string;
  hexBackgroundColor: string;
  /** Libellé du module « points » (issu du champ primary), déjà résolu. */
  pointsLabel: string;
  /** Valeur affichée en gros (jeton {points} résolu) issue du champ primary. */
  pointsValue: string;
  /** Modules texte tels que Google les affiche (tous les champs non-primary). */
  textModules: { id: string; header: string; body: string }[];
  barcodeType: string;
  barcodeAltText: string;
}

/**
 * Modèle Google du preview = sortie de mapToGoogleClass + mapToGoogleObjectExtras
 * (jetons résolus au préalable, comme buildGoogleSaveUrl le fait à l'émission).
 * Remarque de fidélité : Google N'A PAS de zones Apple — tous les champs
 * non-primary deviennent des textModules, et le primary devient le libellé points.
 */
export function buildPreviewGoogle(design: CardDesign, ctx: PreviewContext = {}): GooglePreviewModel {
  const d = ctxDefaults(design, ctx);
  const tokens: Record<string, string> = {
    points: `${d.stamps} / ${d.stampGoal}`,
    nom: d.customerName,
    palier: d.palier,
  };
  const resolved: CardDesign = {
    ...design,
    fields: design.fields.map((f) => ({ ...f, value: resolveTokens(f.value, tokens) })),
  };
  const cls = mapToGoogleClass(resolved);
  const extras = mapToGoogleObjectExtras(resolved);
  const primary = resolved.fields.find((f) => f.zone === "primary");
  return {
    programName: cls.programName,
    hexBackgroundColor: cls.hexBackgroundColor,
    pointsLabel: extras.pointsLabel,
    pointsValue: primary ? primary.value : `${d.stamps} / ${d.stampGoal}`,
    textModules: cls.textModulesData,
    barcodeType: googleBarcodeType(design.barcode?.type ?? "QR"),
    barcodeAltText: extras.barcodeAltText,
  };
}
