# Éditeur de carte commerçant (A0 + A1) — Design

**Date :** 2026-06-06
**Branche :** `feat/admin-card-editor` (issue de `feat/public-enrollment`)
**Statut :** spec validée en brainstorming, en attente de revue utilisateur avant plan d'implémentation.

## 1. Contexte & objectif

HALO est une plateforme SaaS de cartes de fidélité digitales (Apple Wallet + Google Wallet), en mode *done-for-you* (l'admin/fondateur configure tout pour chaque commerçant). Aujourd'hui, la génération de pass utilise un **template figé** + `merchants.primary_color`, et l'admin ne peut éditer que des champs basiques (`shop_name`, `primary_color`, `logo_url` en URL externe). Il n'existe **aucun éditeur de carte** ni aperçu.

**Objectif de cette brique :** permettre à l'admin de concevoir la carte d'un commerçant (couleurs, logo, champs, QR) avec **aperçu live fidèle des deux rendus** (Apple + Google), et que la publication applique réellement le design (nouveaux `.pkpass` Apple ; création/mise à jour de la `LoyaltyClass` Google pour que les cartes installées se mettent à jour).

## 2. Périmètre

**Inclus (A0 + A1) :**
- Fondations : table `card_designs`, bucket Supabase Storage, redimensionnement serveur des images, création/PATCH de la `LoyaltyClass` Google.
- Éditeur structuré : couleurs (fond/texte/libellés), logo (upload + recadrage + génération multi-tailles), champs éditables (libellé/valeur) avec ajout / suppression / réordonnancement par glisser-déposer dans la limite des emplacements de chaque format, code-barres QR.
- Aperçu live Apple + Google (répliques HTML/CSS pilotées par un modèle unifié).
- Publication : application aux nouveaux pass Apple ; `ensure` + GET + PATCH de la classe Google.
- Validation légère (bloquante minimale + avertissements).

**Hors périmètre (briques ultérieures) :**
- **A2** — studio de bandeau WYSIWYG (canvas libre, calques, export strip @1x/@2x/@3x, bibliothèque de modèles).
- **A3** — historique de versions avec restauration, validation bloquante complète avant publication.
- **B** — dashboard (cockpit admin, vue commerçant).

## 3. Décisions validées (brainstorming)

- **Architecture : modèle unifié + mapping.** Un seul design par commerçant, traduit vers chaque format ; aperçus = répliques HTML/CSS.
- **Mode de travail :** branche dédiée `feat/admin-card-editor`, je ne touche pas aux fichiers en cours de l'autre terminal ; rebase si besoin avant push.
- **Mobile-friendly** requis (aperçu collant + bascule iPhone/Android, contrôles tactiles).
- Mutations via **route handlers** (pas de server actions), conformément à l'existant. Tout en français.

## 4. Specs officielles (à respecter, ne pas inventer)

| | Apple Wallet (storeCard) | Google Wallet (LoyaltyClass) |
|---|---|---|
| Logo | `logo.png` 160×50 / `@2x` 320×100 / `@3x` 480×150 px | `programLogo` 660×660 px, ratio 1:1, **masqué en cercle** |
| Bandeau (A2) | `strip.png` 375×123 / 750×246 / 1125×369 px | `heroImage` 1032×336 px (≥ 3:1) |
| Icône | `icon.png` 29×29 / `@2x` 58×58 / `@3x` 87×87 px — **à confirmer sur la réf. officielle Apple** | — |
| Couleurs | `backgroundColor` / `foregroundColor` / `labelColor` (format `rgb(r,g,b)`) | `hexBackgroundColor` (Google dérive la couleur de texte) |
| Format | PNG | PNG |

Sources : doc Apple PassKit (PassKit Package Format Reference) ; Google Wallet « Brand guidelines — Loyalty cards ». L'implémenteur **vérifiera la taille d'icône Apple** sur la réf. officielle avant de figer le pipeline.

Emplacements de champs Apple `storeCard` (limites à respecter dans le mapping) : `headerFields` (≤ 3, visibles repliés), `primaryFields` (≈ 1, mis en avant — points/tampons), `secondaryFields` (≤ 4), `auxiliaryFields` (≤ 4), `backFields` (illimités, au verso).

## 5. Modèle de données

### Table `card_designs`
| Colonne | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `merchant_id` | uuid FK merchants **UNIQUE** | 1 design actif / commerçant (versioning = A3) |
| `background_color` | text | hex `#rrggbb` |
| `foreground_color` | text | hex |
| `label_color` | text | hex |
| `program_name` | text | nom du programme affiché |
| `logo_original_path` | text | chemin Storage de l'original uploadé |
| `logo_assets` | jsonb | chemins générés : `{ apple:{x1,x2,x3,icon1,icon2,icon3}, google:{logo} }` |
| `fields` | jsonb | `[{ id, zone, label, value, order }]` (zone ∈ header/primary/secondary/auxiliary/back) |
| `barcode` | jsonb | `{ type:'QR', source:'card_token'|'custom', value? }` |
| `google_class_id` | text | `issuerId.merchant_<id>` |
| `google_class_synced_at` | timestamptz | dernière synchro PATCH |
| `created_at` / `updated_at` | timestamptz | |
| `updated_by` | uuid | admin auteur |

**RLS :** `SELECT` autorisé si `is_admin()` **ou** design du commerçant courant ; `INSERT`/`UPDATE`/`DELETE` réservés à `is_admin()`. Trigger `updated_at`.

### Storage
Bucket privé **`card-assets`**. Chemins : `{merchantId}/logo-original.<ext>`, `{merchantId}/apple/logo.png|logo@2x.png|logo@3x.png|icon*.png`, `{merchantId}/google/logo.png`. Lecture par les générateurs de pass via **service-role** ; upload via route admin. Policy Storage : accès restreint (pas public).

## 6. Modèle de design unifié

```ts
type CardField = { id: string; zone: 'header'|'primary'|'secondary'|'auxiliary'|'back'; label: string; value: string; order: number };
type CardDesign = {
  colors: { background: string; foreground: string; label: string };
  programName: string;
  logo: { originalPath?: string; assets?: LogoAssets };
  fields: CardField[];
  barcode: { type: 'QR'; source: 'card_token'|'custom'; value?: string };
};
```
Les valeurs de champs peuvent contenir des **jetons** (`{nom}`, `{points}`, `{palier}`) résolus à la génération du pass par client.

## 7. Mapping

**→ Apple (`buildPassJson`)** : `colors.background/foreground/label` → `backgroundColor/foregroundColor/labelColor` (conversion hex→`rgb()`) ; `programName` → `organizationName` + `logoText` ; `fields` répartis par `zone` dans `headerFields/primaryFields/secondaryFields/auxiliaryFields/backFields` en **respectant les limites** (surplus → `backFields` avec avertissement) ; `barcode` → `barcodes[]` (`PKBarcodeFormatQR`) ; logo Apple multi-tailles inséré dans le `.pkpass`.

**→ Google (`googleClass.ts` + `googlePass.ts`)** : `colors.background` → `hexBackgroundColor` ; `programName` → `class.programName` ; champ points/primary → `loyaltyPoints` (object) ; autres champs → `class.textModulesData` / object ; `barcode` → `barcode` ; `programLogo` = logo Google 660×660. Couleur de texte dérivée par Google (pas de champ dédié).

## 8. Pipeline image

1. Upload admin (PNG/JPG) → recadrage léger côté client (`react-image-crop`).
2. Original envoyé à `…/card-design/logo` (route **runtime nodejs**), stocké dans Storage.
3. Redimensionnement serveur via **`sharp`** aux tailles §4 (logo Apple ×3, icône ×3, `programLogo` Google 660×660 carré avec marge pour le masque circulaire), fond transparent.
4. Chemins écrits dans `card_designs.logo_assets`. Régénéré uniquement à l'upload (jamais à chaque pass).

## 9. UI éditeur

Route **`/admin/merchants/[id]/card`** (lien depuis la fiche commerçant).
- **Desktop** : 2 colonnes — contrôles à gauche (Couleurs, Logo, Champs, Code-barres, bouton *Enregistrer & publier*) ; aperçus Apple + Google à droite.
- **Mobile** : aperçu collant en haut avec bascule **iPhone / Android**, contrôles dessous.
- Composants : `CardEditor` (client, état du `CardDesign`), `ColorField` (`react-colorful` + saisie hex), `LogoUpload` (drop + crop), `FieldList` (dnd-kit, badges de zone, ajout/suppression/réordonnancement), `BarcodeField`, `ApplePassPreview`, `GooglePassPreview`.
- Style : tokens HALO (`design-tokens.css`), émeraude `#0D6B5E`.

## 10. Aperçus live

Deux composants répliquant fidèlement le chrome de chaque wallet en HTML/CSS, pilotés par le même `CardDesign` (mises à jour à chaque modif). Apple : fond coloré, logo+logoText, primary mis en avant, secondary/auxiliary, QR. Google : en-tête `hexBackgroundColor`, logo circulaire, `programName`, points, QR. Non destinés à être pixel-perfect avec l'OS, mais représentatifs.

## 11. Publication

- **Google** (mise à jour des cartes installées) : `ensureLoyaltyClass(merchant)` crée `issuerId.merchant_<id>` si absente ; publication = **GET de la classe puis PATCH fusionné** (`programName`, `hexBackgroundColor`, `programLogo`). Jamais d'update complet (pas d'effacement de champ). `googlePass.ts` référence désormais la classe du commerçant.
- **Apple** : le design s'applique aux **nouveaux** `.pkpass`. Les pass déjà installés reçoivent les **valeurs** mises à jour via le push APNs existant ; un changement de couleurs/structure n'est pas re-poussé aussi librement que côté Google (**limite de plateforme**, documentée).
- Pour le MVP, *Enregistrer & publier* = persister `card_designs` + synchroniser la classe Google. (Séparation brouillon/publié = A3.)

## 12. Validation (A1)

- **Bloquante :** `program_name` non vide ; au moins le champ points/primary présent ; logo présent.
- **Avertissements (non bloquants) :** contraste fond vs texte/libellés (ratio WCAG AA ≈ 4.5:1) ; ratio/taille de logo. Validation bloquante complète = A3.

## 13. Sécurité

- RLS `card_designs` : écriture `is_admin()` uniquement.
- Routes API protégées par `requireAdminApi()` ; upload : validation type/taille, admin only.
- Bucket Storage privé ; générateurs de pass via service-role.
- Journalisation audit : `CARD_DESIGN_UPDATED`, `CARD_CLASS_SYNCED`.

## 14. Performance

Redimensionnement à l'upload (pas par pass). Design lu une fois par génération. Pas de N+1. Aperçus 100 % client (aucune requête par frappe).

## 15. Tests (vitest)

- Mapping unifié → Apple (répartition par zone + limites de slots).
- Mapping unifié → Google (champs class/object).
- Util couleur (hex→rgb, ratio de contraste).
- Génération des tailles d'images (`sharp` mocké : bons formats/dimensions).
- Règles de validation (bloquantes + avertissements).

## 16. Fichiers & dépendances

**Migration :** `supabase/migrations/2026-06-06_card_designs.sql` (table + RLS + trigger + bucket/policy).
**lib :** `src/lib/cardDesign/{types,mapping,validation,images,storage}.ts`.
**wallet :** extension `src/lib/applePass.ts` + `src/lib/wallet/passJson.ts` ; nouveau `src/lib/wallet/googleClass.ts` ; `src/lib/googlePass.ts` (classe par commerçant).
**UI :** `src/app/admin/merchants/[id]/card/{page.tsx,CardEditor.tsx,ApplePassPreview.tsx,GooglePassPreview.tsx,FieldList.tsx,ColorField.tsx,LogoUpload.tsx,BarcodeField.tsx}` + lien depuis `…/[id]/page.tsx`.
**API :** `src/app/api/admin/merchants/[id]/card-design/route.ts` (GET/PUT, PUT déclenche la synchro Google) + `…/card-design/logo/route.ts` (upload + resize, runtime nodejs).
**Dépendances ajoutées :** `sharp`, `@dnd-kit/core`, `@dnd-kit/sortable`, `react-colorful`, `react-image-crop`.

## 17. Risques & points à vérifier

- **Taille d'icône Apple** : confirmer 29/58/87 sur la réf. officielle avant de figer `images.ts`.
- **`sharp` sur Vercel / Next 16 custom** : vérifier le runtime (nodejs) et lire `node_modules/next/dist/docs` (règle AGENTS.md) avant implémentation.
- **Google Android** : la mise à jour des cartes suppose la classe publiée ; le *publishing access* Android reste un prérequis projet (hors code).
- **Pass Apple installés** : limite de plateforme pour re-pousser un changement de design (documentée §11).

## 18. Étapes suivantes

A2 (studio bandeau) → A3 (versioning + validation bloquante) → B1 (cockpit admin) → B2 (vue commerçant). Chaque brique : spec → plan → implémentation validée.
