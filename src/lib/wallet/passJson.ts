import type { CardDesign } from '@/lib/cardDesign/types';
import { APPLE_ZONE_LIMITS } from '@/lib/cardDesign/types';
import { mapToAppleFields, appleBarcodeFormat } from '@/lib/cardDesign/mapApple';

export interface PassJsonInput {
  cardId: string; customerName: string; stamps: number; stampGoal?: number;
  orgName: string; backgroundColor: string;
  passTypeIdentifier: string; teamIdentifier: string; barcodeMessage: string;
  webServiceURL?: string; authToken?: string; message?: string;
  locations?: { latitude: number; longitude: number; relevantText: string }[];
  /** When present, overrides colors + fields from the merchant's saved card design. */
  design?: CardDesign;
  /** Optional tier label for {palier} token substitution. */
  palier?: string;
  /** Nombre total de scans de la carte (compteur à vie) — jeton {visites}. */
  visites?: number;
  /**
   * Données d'IDENTITÉ commerce (Feature 1 — carte vivante). Appliquées aux deux
   * chemins (legacy ET design) : infos du commerce, indépendantes du créatif de
   * la carte. Valeurs déjà calculées/normalisées par l'appelant.
   */
  identity?: PassIdentity;
}

export interface PassIdentity {
  rewardLabel?: string | null;
  address?: string | null;
  phone?: string | null;
  /** Libellé « horaires du jour » déjà calculé (module merchant-config/hours). */
  todaysHours?: string | null;
  /** Lien d'itinéraire (Maps) déjà construit. */
  mapsUrl?: string | null;
  /**
   * Lien « Laisser un avis Google » (Feature 2) — présent UNIQUEMENT quand la
   * carte est reward-ready ET un place id est configuré. Recalculé à chaque
   * émission → disparaît à la récompense suivante.
   */
  reviewUrl?: string | null;
}

type PassField = { key: string; value: string; label?: string; changeMessage?: string; textAlignment?: string };
type StoreCardShape = {
  headerFields: PassField[];
  primaryFields: PassField[];
  secondaryFields: PassField[];
  auxiliaryFields: PassField[];
  backFields: PassField[];
};
export type PassJson = Record<string, unknown> & { storeCard: StoreCardShape };

const MAX_BACK_FIELDS = 10; // garde-fou Apple (qualité) : backFields ≤ 10.

// Applique la couche identité au storeCard, quel que soit le chemin de rendu.
// Apple détecte automatiquement téléphone/adresse/URL dans les backFields
// (PKDataDetectorType) → champs tappables sans config supplémentaire.
export function applyIdentity(store: StoreCardShape, identity?: PassIdentity): void {
  if (!identity) return;
  const v = (s?: string | null) => (typeof s === "string" && s.trim() ? s.trim() : null);
  const reward = v(identity.rewardLabel);
  const hours = v(identity.todaysHours);
  const address = v(identity.address);
  const maps = v(identity.mapsUrl);
  const phone = v(identity.phone);

  const review = v(identity.reviewUrl);

  if (reward) store.secondaryFields.push({ key: "reward", label: "RÉCOMPENSE", value: reward });
  // Avis Google en TÊTE des backFields (moment magique : récompense débloquée).
  if (review) store.backFields.push({ key: "review", label: "★ LAISSER UN AVIS GOOGLE", value: review });
  if (hours) store.backFields.push({ key: "hours", label: "AUJOURD'HUI", value: hours });
  if (address) store.backFields.push({ key: "address", label: "ADRESSE", value: address });
  if (maps) store.backFields.push({ key: "maps", label: "ITINÉRAIRE", value: maps });
  if (phone) store.backFields.push({ key: "phone", label: "TÉLÉPHONE", value: phone });

  if (store.backFields.length > MAX_BACK_FIELDS) {
    store.backFields = store.backFields.slice(0, MAX_BACK_FIELDS);
  }
}

/**
 * Message commerçant → champ AVANT (auxiliary) porteur de la BANNIÈRE iOS.
 *
 * POURQUOI un champ à l'AVANT et pas le backField « INFO » : sur device réel, un
 * `changeMessage` posé sur un champ du DOS ne produit PAS de bannière sur l'écran
 * verrouillé (confirmé 07/2026 : APNs 200 + valeur du champ réellement changée +
 * pass reconstruit, mais AUCUNE bannière). Apple ne fiabilise la bannière que pour
 * un champ VISIBLE À L'AVANT (header/primary/secondary/auxiliary) dont la valeur
 * change. Doc + sources : docs/NOTIFICATIONS-WALLET.md.
 *
 * POURQUOI AUXILIARY (et pas les autres zones avant) :
 *  - header  : ZÉRO champ voulu (collision device-prouvée avec le wordmark + la
 *    devise sur la ligne du haut — cf. seedKit.ts). Exclu.
 *  - primary : plein (compteur unique, limite Apple = 1).
 *  - secondary : la « RÉCOMPENSE » (applyIdentity) y vit au moment magique ;
 *    y ajouter le message risquerait une collision 3 colonnes pile quand ça compte.
 *  - auxiliary : ligne basse, labels courts, place libre (kit : 2/4 ; legacy : 0/4).
 *
 * Présent UNIQUEMENT quand un message est actif → aucun champ vide permanent : le
 * recto « sobre » (#54/#49) reste intact hors message. Le texte complet reste au
 * DOS (champ « INFO », sans changeMessage) pour consultation. Placé EN TÊTE des
 * auxiliaires (le plus visible) ; borné à la limite Apple (≤ 4) pour ne jamais
 * créer une ligne surchargée — au pire un design custom déjà à 4 auxiliaires voit
 * son dernier champ cédé au message LE TEMPS de l'alerte (compromis assumé : la
 * bannière prime quand le commerçant vient d'agir).
 */
export function applyMerchantMessage(store: StoreCardShape, message?: string): void {
  const msg = typeof message === "string" ? message.trim() : "";
  if (!msg) return;
  store.auxiliaryFields.unshift({ key: "passmsg", label: "MESSAGE", value: msg, changeMessage: "%@" });
  if (store.auxiliaryFields.length > APPLE_ZONE_LIMITS.auxiliary) {
    store.auxiliaryFields = store.auxiliaryFields.slice(0, APPLE_ZONE_LIMITS.auxiliary);
  }
}

/**
 * Substitutes {token} placeholders in a string using the supplied context.
 * Unknown tokens are left verbatim (no crash).
 */
export function resolveTokens(value: string, ctx: Record<string, string | undefined>): string {
  return value.replace(/\{(\w+)\}/g, (_match, key: string) => ctx[key] ?? `{${key}}`);
}

export function buildPassJson(i: PassJsonInput): PassJson {
  const pass = {
    formatVersion: 1,
    passTypeIdentifier: i.passTypeIdentifier,
    teamIdentifier: i.teamIdentifier,
    serialNumber: i.cardId,
    organizationName: i.orgName,
    description: "Carte de fidélité numérique",
    logoText: i.orgName,
    backgroundColor: i.backgroundColor,
    foregroundColor: "rgb(255, 255, 255)",
    labelColor: "rgb(255, 255, 255)",
    storeCard: {
      headerFields: [] as unknown[],
      primaryFields: [{ key: "stamps", label: "TAMPONS", value: `${i.stamps} / ${i.stampGoal ?? 10}`, textAlignment: "PKTextAlignmentRight" }],
      secondaryFields: [{ key: "customerName", label: "CLIENT", value: i.customerName }],
      auxiliaryFields: [] as unknown[],
      // Le message au DOS est purement CONSULTABLE (pas de changeMessage) : la
      // bannière est portée par le champ AVANT posé par applyMerchantMessage.
      backFields: [{ key: "message", label: "INFO", value: i.message ?? "" }],
    },
    barcodes: [{ message: i.barcodeMessage, format: "PKBarcodeFormatQR", messageEncoding: "iso-8859-1", altText: "Scannez pour valider vos tampons" }],
  } as unknown as PassJson;

  if (i.webServiceURL && i.authToken) {
    pass.webServiceURL = i.webServiceURL;
    pass.authenticationToken = i.authToken;
  }
  if (i.locations && i.locations.length > 0) {
    pass.locations = i.locations;
  }

  // When a merchant design is present, override colors + fields from the design.
  // The base fields built above are fully replaced; backward-compat is preserved
  // by the caller never passing `design` when none exists in the DB.
  if (i.design) {
    const ctx: Record<string, string | undefined> = {
      points: `${i.stamps} / ${i.stampGoal ?? 10}`,
      nom: i.customerName,
      palier: i.palier,
      visites: i.visites !== undefined ? String(i.visites) : undefined,
    };
    // Deep-copy fields with resolved token values before mapping.
    const resolvedDesign: CardDesign = {
      ...i.design,
      fields: i.design.fields.map(f => ({ ...f, value: resolveTokens(f.value, ctx) })),
    };
    const m = mapToAppleFields(resolvedDesign);
    pass.backgroundColor = m.backgroundColor;
    pass.foregroundColor = m.foregroundColor;
    pass.labelColor = m.labelColor;
    pass.organizationName = m.organizationName;
    pass.logoText = m.logoText;
    // Filet de sécurité : un design (legacy ou contournant la validation studio)
    // peut ne plus contenir le jeton {points} — le pass perdrait son compteur de
    // tampons. On réinjecte le champ par défaut plutôt que d'émettre une carte morte.
    const primaryFields = [...m.primaryFields];
    const auxiliaryFields = [...m.auxiliaryFields];
    if (!i.design.fields.some((f) => f.value.includes('{points}'))) {
      const fallback = {
        key: 'stamps',
        label: 'TAMPONS',
        value: `${i.stamps} / ${i.stampGoal ?? 10}`,
      };
      if (primaryFields.length === 0) primaryFields.push(fallback);
      else auxiliaryFields.unshift(fallback);
    }
    // Replace the entire storeCard with design-driven field buckets.
    // Le message commerçant est réinjecté EN TÊTE des backFields — mais SANS
    // changeMessage : c'est un champ CONSULTABLE (le texte complet reste au dos).
    // La BANNIÈRE est portée par le champ AVANT posé par applyMerchantMessage.
    // En tête pour survivre au garde-fou backFields ≤ 10 appliqué par applyIdentity.
    (pass as Record<string, unknown>).storeCard = {
      headerFields: m.headerFields,
      primaryFields,
      secondaryFields: m.secondaryFields,
      auxiliaryFields,
      backFields: [
        { key: "message", label: "INFO", value: i.message ?? "" },
        ...m.backFields,
      ],
    };
    // Code-barres piloté par le design : format + valeur (jeton ou custom) + texte alternatif.
    const bc = i.design.barcode;
    const message = bc?.source === 'custom' && bc.value ? bc.value : i.barcodeMessage;
    (pass as Record<string, unknown>).barcodes = [{
      message,
      format: appleBarcodeFormat(bc?.type ?? 'QR'),
      messageEncoding: 'iso-8859-1',
      ...(bc?.altText ? { altText: bc.altText } : {}),
    }];
  }

  // Couche identité commerce — appliquée APRÈS les deux chemins (legacy/design)
  // pour que l'adresse, le téléphone, les horaires et la récompense apparaissent
  // toujours, quel que soit le design choisi au studio.
  applyIdentity(pass.storeCard, i.identity);

  // Message commerçant → champ AVANT (auxiliary) qui déclenche la bannière iOS.
  // Appliqué APRÈS les deux chemins ET après l'identité, sur le storeCard final,
  // pour que la bannière fonctionne quel que soit le design (legacy ou studio).
  applyMerchantMessage(pass.storeCard, i.message);

  return pass;
}
