# Card Design Studio — modèle, règles et sources

> Document vivant. Décrit le modèle canonique de carte, les adapters vers Apple
> Wallet et Google Wallet, les règles de validation, et **la source officielle
> de chaque constante**. Objectif : le preview du studio et le pass réellement
> émis lisent la **même source de vérité** ; toute constante Apple/Google est
> vérifiée contre la doc officielle, jamais écrite de mémoire.

## 1. Modèle canonique : `CardDesign`

Décision (2026-07-14, fondateur) : on **réutilise `CardDesign`** (`src/lib/cardDesign/types.ts`)
comme source de vérité unique, plutôt que d'introduire un second modèle
`CardTemplate` (qui recréerait la divergence à corriger). On lui ajoute
progressivement un schéma Zod (`src/lib/cardDesign/schema.ts`), et on branche le
preview sur la **sortie des adapters** (`buildPassJson`, `mapToGoogleClass`),
pas sur le modèle brut.

Champs (voir `src/lib/cardDesign/types.ts`) :
- `colors { background, foreground, label }` — hex `#rrggbb`
- `programName`
- `logo { originalPath?, assets? }`
- `fields: CardField[]` — `{ id, zone, label, value, order }`, zones
  `header | primary | secondary | auxiliary | back`
- `barcode { type, source, value?, altText? }`
- `cardType?`, `stamps?`

### Adapters purs (dérivent le rendu réel du modèle)
- Apple : `mapToAppleFields` (`src/lib/cardDesign/mapApple.ts`) → `buildPassJson`
  (`src/lib/wallet/passJson.ts`) → `pass.json`.
- Google : `mapToGoogleClass` / `mapToGoogleObjectExtras`
  (`src/lib/cardDesign/mapGoogle.ts`) → LoyaltyClass / LoyaltyObject.

## 2. Constantes officielles (`src/lib/wallet/constants.ts`)

Chaque constante porte un `// source:` dans le fichier. Résumé :

### Apple Wallet (storeCard)
| Élément | Valeur | Source |
|---|---|---|
| header / primary / secondary / auxiliary | 3 / 1 / 4 / 4 | [Pass Design](https://developer.apple.com/library/archive/documentation/UserExperience/Conceptual/PassKit_PG/Creating.html) |
| **storeCard : secondary + auxiliary COMBINÉS** | **≤ 4** | idem (« a total of up to four secondary and auxiliary fields, combined ») |
| back fields | illimité (cap qualité HaloCard = 10) | idem |
| icon | 29×29 pt | idem |
| logo | 160×50 pt (souvent + étroit) | idem |
| strip (storeCard) | 375×123 pt | idem |
| background | 180×220 pt | idem |
| thumbnail | 90×90 pt (ratio 2:3–3:2) | idem |
| footer | 286×15 pt | idem |
| densités | @1x/@2x/@3x | idem |
| barcode | QR / PDF417 / Aztec / Code128 | [Barcodes](https://developer.apple.com/documentation/walletpasses/pass/barcodes) |
| barcode rendu | **noir sur encart blanc**, quelle que soit la couleur de fond | comportement PassKit |
| couleurs | `rgb(r,g,b)`, pas de dégradé/alpha | [Pass](https://developer.apple.com/documentation/walletpasses/pass) |

### Google Wallet (LoyaltyClass / LoyaltyObject)
| Élément | Valeur | Source |
|---|---|---|
| programName | ellipsis après ~20 car. | [LoyaltyClass](https://developers.google.com/wallet/retail/loyalty-cards/rest/v1/loyaltyclass) |
| textModulesData | 10 (objet) + 10 (classe) | idem |
| programLogo | ≥ 660×660, 1:1, PNG, masque cercle (safe 840×840) | [Brand guidelines](https://developers.google.com/wallet/retail/loyalty-cards/resources/brand-guidelines) |
| heroImage | 1032×812 (~5:4), PNG | idem |
| wideProgramLogo | 1280×400, 16:5, PNG transparent | idem |
| hexBackgroundColor | `#rrggbb`, éviter forte saturation | idem |

## 3. Règles de validation (`src/lib/cardDesign/validateTemplate.ts`)

`validateTemplate(design) → Issue[]` ; `hasBlockingError(issues)`. Sévérités :
`error` (bloque la publication) / `warning` / `info`. Chaque `Issue` porte un
`message` FR actionnable et, si pertinent, le `fieldId` fautif. Le contrat
historique `validateStudioDesign → {errors, warnings}` délègue à ce moteur (donc
studio ET route publish deviennent plus stricts).

| Règle | Sévérité |
|---|---|
| Zone avant qui déborde (header>3, primary>1) — le champ ne s'affichera pas | **error** |
| storeCard + code-barres carré : secondary+auxiliary > 4 combinés | **error** |
| secondary>4 / auxiliary>4 (code-barres non carré) | **error** |
| carte tampons sans jeton `{points}` | **error** |
| objectif de tampons hors 2–30 / icône absente | **error** |
| champ vide (label+valeur) | **error** |
| contraste < 3:1 (illisible) | **error** |
| contraste 3:1–4.5:1 (sous WCAG AA) | warning |
| valeur longue (>30 car., zone avant) → troncature | warning |
| nom de programme long (>24) | warning |
| champ avec libellé mais sans valeur | warning |
| strip Apple sans hero Google | warning |
| nom > 20 car. (abréviation Google) | info |
| police/casse imposées par le système | info |
| code-barres toujours noir sur blanc | info |

**Publication bloquée tant qu'il reste une `error`** (UI : bouton désactivé ;
serveur : `POST publish` → 422).

## 4. Fidélité imparfaite — points connus (honnêteté)

- **secondary+auxiliary combinés (storeCard)** : le code actuel
  (`APPLE_ZONE_LIMITS`) traite secondary et auxiliary comme deux quotas de 4
  indépendants ; la règle Apple réelle est **4 combinés**. Corrigé au Lot 2 (le
  preview et la validation appliqueront la règle combinée).
- **Dimensions d'images Google** : la référence REST n'expose pas de dimensions ;
  les valeurs viennent des *brand guidelines* officielles (page distincte).
- **Rendu exact iOS** (ajustements de contraste automatiques, compression de
  texte) : approximé dans le preview ; seul un test sur device réel fait foi.

## 5. Journal des lots
- **Lot 0** ✅ : constantes officielles sourcées (`constants.ts`) + ce document.
- **Lot 1** ✅ : le preview rend la SORTIE DES ADAPTERS (`src/lib/wallet/previewModel.ts`
  → `buildPreviewApplePass` via `buildPassJson`, `buildPreviewGoogle` via
  `mapToGoogleClass`). `WalletPreviews.tsx` reconstruit : débordement de zones
  visible, filet {points}, bascule recto/verso, code-barres noir sur blanc,
  sous-titre Google = `programName` (fin du libellé codé en dur). Tests golden
  (`previewModel.test.ts`) + composant (`WalletPreviews.test.tsx`).
- **Lot 2** ✅ : moteur `validateTemplate → Issue[]` (sévérités, fieldId).
  Applique la règle combinée storeCard (secondary+auxiliary ≤ 4), escalade le
  débordement de zone avant et le contraste illisible en **erreurs bloquantes**.
  `validateStudioDesign` délègue → studio + route publish plus stricts.
  ⚠️ Changement de comportement : des designs qui débordaient (et basculaient au
  verso) ne sont plus publiables tels quels — le générateur garde toutefois son
  filet de débordement pour les cartes déjà en circulation.
- Lots 3-6 : fixes persistance/push, complétude UI (panneau de validation,
  onglets, crop), versionnement, récap final.
