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

## 4. Fidélité imparfaite — points connus (honnêteté, livrable #5)

Où la fidélité reste imparfaite, et pourquoi :

1. **Règle combinée storeCard côté générateur** : la *validation* (Lot 2) bloque
   désormais secondary+auxiliary > 4 combinés, mais le *mapper* `mapToAppleFields`
   applique encore deux quotas de 4 indépendants (débordement par zone). Donc,
   PENDANT l'édition, un design à 4 secondaires + 4 auxiliaires s'affiche 4+4 au
   recto dans le preview, alors qu'iOS n'en montrerait que 4. La publication est
   bloquée avant que ça n'atteigne une vraie carte. *Pourquoi non corrigé* : le
   brief interdit de réécrire le générateur ; la validation est le point
   d'application. Fermeture propre = porter la règle combinée dans `mapApple`.
2. **Couche identité/message absente du preview réel** : `previewModel` SAIT
   rendre la récompense/horaires/adresse/téléphone/bannière (paramètre
   `identity`/`message`), mais `StudioClient` ne lui passe pas encore l'identité
   RÉELLE du marchand. Le preview montre donc les champs du design + le filet
   {points}, pas encore les champs que le générateur injecte à l'émission.
   Fermeture = passer `previewContext.identity` depuis les données marchand.
3. **Preview light/dark & vue « liste des cartes »** : non implémentés (le preview
   rend le thème par défaut, carte ouverte). iOS varie le rendu selon le thème et
   la carte est vue compressée 90 % du temps — approximation assumée.
4. **Onglets d'édition recto/verso** : l'édition des `backFields` se fait via le
   sélecteur de zone (`zone = verso`) ; pas d'onglet dédié. Le *preview* a bien
   une bascule recto/verso (Lot 1).
5. **Affichage du diff** : `diffDesign` + l'historique versionné existent
   (données prêtes) mais le diff n'est pas encore rendu dans l'UI.
6. **Dimensions d'images Google** : absentes de la référence REST ; tirées des
   *brand guidelines* officielles (page distincte, citée).
7. **Rendu exact iOS** (ajustements de contraste automatiques, compression de
   texte, masque circulaire du logo Google) : approximé ; seul un test sur device
   réel fait foi (cf. brief : « si incertain, générer un .pkpass et constater »).

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
- **Lot 3** ✅ : fixes des deux bugs d'exploration.
  - `repository.designToRow` persiste désormais `card_type` + `stamps` (comme
    `designToPublishRow`) → un save admin/photo ne peut plus diverger du studio.
  - La route `publish` déclenche un `refreshMerchantPasses` (push APNs
    **silencieux**, best-effort) → les cartes déjà installées reçoivent le
    nouveau design. Choix assumé : pas de bannière (une refonte de design n'est
    pas un événement client ; une alerte de masse serait du spam).
- **Lot 4 (en partie)** ✅ : **panneau de validation** dédié
  (`_components/ValidationPanel.tsx`) — la « pièce maîtresse ». Consomme
  `validateTemplate` : erreurs/avertissements/info groupés, lien « Voir le champ »
  (ancre `field-anchor-<id>` dans FieldsSection), publication gatée par
  `hasBlockingError`. **Crop d'image** : déjà en place (`ImageUploadField` via
  `react-image-crop`, ratios imposés logo/strip/hero/tampons + resize serveur) —
  aucune lib ajoutée. Le preview recto/verso existe depuis le Lot 1.
  ⏳ Restent (honnêteté) : preview light/dark, vue « liste des cartes »
  compressée, onglets d'édition recto/verso côté éditeur — voir §4.
- **Lot 5** ✅ : versionnement historisé + diff.
  - Migration `20260714_card_design_versions.sql` (table immuable, RLS tenant,
    UNIQUE(merchant_id, version)) — **APPLIQUÉE en prod WalletCard** + déclarée
    au registre RLS (`rlsPolicyGuard`).
  - La route `publish` insère un snapshot du design à chaque publication
    (best-effort ; `card_designs.version` reste le compteur de vérité).
  - `src/lib/cardDesign/diff.ts` : `diffDesign(prev, next)` pur (couleurs, nom,
    type, barcode, objectif, champs ajoutés/modifiés/supprimés) + tests.
  - ⏳ Reste : brancher l'affichage du diff dans l'UI (données + fonction prêtes).
- **Lot 6** ✅ : récap final + section « fidélité imparfaite » (§4) complétée.

## 6. Critères d'acceptation — état
| # | Critère | État |
|---|---|---|
| 1 | Rendu iPhone identique au preview | ✅ preview = sortie `buildPassJson` ; résiduels §4.1/§4.2 |
| 2 | Idem Google, différences annoncées | ✅ preview = `mapToGoogleClass` ; avertissement cross-wallet |
| 3 | 5 champs dans une zone de 3 → dit lesquels + refuse | ✅ panneau + erreur bloquante |
| 4 | Fond clair + texte blanc → refuse | ✅ contraste < 3:1 = erreur |
| 5 | Modif récompense publiée → notification | ✅ redeem (changeMessage) ; publish → refresh silencieux |
| 6 | Tests golden : preview = sortie d'adapter | ✅ `previewModel.test.ts` + composant |
