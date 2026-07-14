// Constantes officielles Apple Wallet & Google Wallet — SOURCE DE VÉRITÉ.
//
// Règle du projet (brief studio) : AUCUNE constante Apple/Google écrite de
// mémoire. Chaque valeur ci-dessous porte un commentaire `// source:` pointant
// la doc officielle. Toute valeur incertaine est signalée explicitement et
// documentée dans STUDIO.md (« fidélité imparfaite »).
//
// Ce module est la référence unique consommée par le studio, la validation et
// le générateur de pass. Les anciennes constantes dispersées (APPLE_ZONE_LIMITS
// dans cardDesign/types.ts, imageSizes.ts, bornes de cardStudio.ts) seront
// migrées vers ici au fil des lots suivants.

// ── APPLE WALLET ────────────────────────────────────────────────────────────

// Limites de champs par zone (en NOMBRE d'entrées affichées par iOS ; au-delà,
// iOS n'affiche simplement pas le champ).
// source: https://developer.apple.com/library/archive/documentation/UserExperience/Conceptual/PassKit_PG/Creating.html
//   « In general, a pass can have up to three header fields, a single primary
//     field, up to four secondary fields, and up to four auxiliary fields. »
export const APPLE_FIELD_LIMITS = {
  header: 3, // source: PassKit_PG/Creating.html — « up to three header fields »
  primary: 1, // source: PassKit_PG/Creating.html — « a single primary field »
  secondary: 4, // source: PassKit_PG/Creating.html — « up to four secondary fields »
  auxiliary: 4, // source: PassKit_PG/Creating.html — « up to four auxiliary fields »
} as const;

// ⚠️ RÈGLE PARTICULIÈRE storeCard (le type de pass de HaloCard) :
// source: https://developer.apple.com/library/archive/documentation/UserExperience/Conceptual/PassKit_PG/Creating.html
//   « Coupons, store cards, and generic passes with a square barcode can have a
//     total of up to four secondary and auxiliary fields, combined. »
// → Pour un storeCard à code-barres carré (QR/Aztec), secondary + auxiliary
//   sont plafonnés à 4 AU TOTAL, pas 4 + 4. C'est plus strict qu'APPLE_FIELD_LIMITS.
export const APPLE_STORECARD_SECONDARY_AUXILIARY_COMBINED_MAX = 4;

// Back fields : Apple ne documente PAS de maximum (« the back of the pass can
// have as many fields as needed »). Le plafond ci-dessous est un choix QUALITÉ
// de HaloCard (lisibilité), PAS une contrainte Apple.
// source: PassKit_PG/Creating.html (back = illimité) ; valeur = décision projet.
export const HALOCARD_BACK_FIELDS_SOFT_MAX = 10;

// Dimensions d'images en POINTS (source de vérité). Pixels = points × densité.
// source: https://developer.apple.com/library/archive/documentation/UserExperience/Conceptual/PassKit_PG/Creating.html
export const APPLE_IMAGE_POINTS = {
  icon: { w: 29, h: 29 }, // « The icon should measure 29 x 29 points. »
  logo: { w: 160, h: 50 }, // « The allotted space is 160 x 50 points; in most cases it should be narrower. »
  // strip storeCard « all other cases » sur iPhone 6/6+ : 375 x 123.
  // (event tickets 375x98 ; gift cards/coupons 375x144 — non utilisés ici.)
  strip: { w: 375, h: 123 },
  background: { w: 180, h: 220 }, // « The expected dimensions are 180 x 220 points. »
  thumbnail: { w: 90, h: 90 }, // « 90 x 90 points. The aspect ratio should be in the range of 2:3 to 3:2. »
  footer: { w: 286, h: 15 }, // « The allotted space is 286 x 15 points. »
} as const;

// Densités Retina à fournir (@1x/@2x/@3x).
// source: PassKit_PG/Creating.html — « provide the original, @2x, and @3x versions ».
export const APPLE_IMAGE_SCALES = [1, 2, 3] as const;

// Formats de code-barres supportés (valeurs de PKBarcodeFormat).
// source: https://developer.apple.com/documentation/walletpasses/pass/barcodes/format
export const APPLE_BARCODE_FORMATS = {
  QR: "PKBarcodeFormatQR",
  PDF417: "PKBarcodeFormatPDF417",
  AZTEC: "PKBarcodeFormatAztec",
  CODE128: "PKBarcodeFormatCode128",
} as const;

// Encodage recommandé du message de code-barres.
// source: https://developer.apple.com/documentation/walletpasses/pass/barcodes — messageEncoding (IANA), usuellement ISO-8859-1.
export const APPLE_BARCODE_MESSAGE_ENCODING = "iso-8859-1";

// Rendu du code-barres : iOS l'affiche TOUJOURS noir sur encart blanc, quelle
// que soit backgroundColor. Fait de rendu (non numérique) documenté pour le preview.
// source: comportement PassKit documenté (quiet zone blanche) — cf. STUDIO.md.
export const APPLE_BARCODE_RENDERED_ON_WHITE = true;

// Couleurs : format rgb(r,g,b) uniquement, pas de dégradé ni d'alpha ; iOS
// applique ses propres ajustements de contraste.
// source: https://developer.apple.com/documentation/walletpasses/pass — backgroundColor/foregroundColor/labelColor
export const APPLE_COLOR_FORMAT = "rgb" as const;

// ── GOOGLE WALLET (LoyaltyClass / LoyaltyObject) ────────────────────────────

// programName : iOS/Android peut tronquer après ~20 caractères sur petits écrans.
// source: https://developers.google.com/wallet/retail/loyalty-cards/rest/v1/loyaltyclass
//   « may display an ellipsis after the first 20 characters »
export const GOOGLE_PROGRAM_NAME_ELLIPSIS_AT = 20;

// Modules texte : max 10 au niveau OBJET + 10 au niveau CLASSE (combinés à l'affichage).
// source: https://developers.google.com/wallet/retail/loyalty-cards/rest/v1/loyaltyclass — textModulesData
export const GOOGLE_TEXT_MODULES_MAX_PER_LEVEL = 10;

// Images Google. source: https://developers.google.com/wallet/retail/loyalty-cards/resources/brand-guidelines
export const GOOGLE_IMAGE_SPEC = {
  // programLogo : masqué en CERCLE (marge de sécurité 15 %).
  programLogo: { minW: 660, minH: 660, ratio: "1:1", format: "PNG", circularSafeArea: { w: 840, h: 840 } },
  // heroImage : bandeau large, ~5:4.
  heroImage: { recW: 1032, recH: 812, ratio: "≈5:4", format: "PNG (transparence recommandée)" },
  // wideProgramLogo : logo large, remplace le logo carré.
  wideProgramLogo: { recW: 1280, recH: 400, minH: 400, ratio: "16:5", format: "PNG transparent" },
} as const;

// hexBackgroundColor : #rrggbb ; si absent, Google retombe sur la couleur
// dominante du hero/logo. Éviter les couleurs très saturées.
// source: https://developers.google.com/wallet/retail/loyalty-cards/rest/v1/loyaltyclass + brand-guidelines
export const GOOGLE_COLOR_FORMAT = "#rrggbb" as const;

// ── Catalogue des sources (pour STUDIO.md et audits) ────────────────────────
export const OFFICIAL_SOURCES = {
  applePassDesign:
    "https://developer.apple.com/library/archive/documentation/UserExperience/Conceptual/PassKit_PG/Creating.html",
  applePassFields: "https://developer.apple.com/documentation/walletpasses/passfields",
  appleBarcode: "https://developer.apple.com/documentation/walletpasses/pass/barcodes",
  googleLoyaltyClass: "https://developers.google.com/wallet/retail/loyalty-cards/rest/v1/loyaltyclass",
  googleBrandGuidelines: "https://developers.google.com/wallet/retail/loyalty-cards/resources/brand-guidelines",
} as const;
