# AGENT A — Manifeste de livraison

> Expérience marchand & studio de design de cartes.
> Branche : `feat/agent-a-experience-marchand` (depuis `main` @ 312c970).
> Dernière mise à jour : 2026-06-10.

## 1. Périmètre déclaré (territoire Agent A)

- `src/app/(app)/dashboard/**` (surface marchande)
- `src/app/api/merchant/**` (API marchandes)
- `src/lib/merchant/**` (nouveau module marchand)
- `src/lib/cardDesign/**` — **extensions additives uniquement**
- `supabase/migrations/20260611_*.sql` (nouvelles, jamais appliquées par l'agent)
- `src/lib/auditLog.ts` — ajout additif de 3 actions (procédure de l'invariant 1)

Territoire NON touché : `src/app/(app)/admin/**`, `src/app/api/admin/**`,
`src/lib/admin/**`, `src/lib/wallet/**`, `src/proxy.ts`, `globals.css`, tokens.

## 2. Ce qui est livré

### Studio de design de carte — `/dashboard/studio`
- Éditeur WYSIWYG complet : aperçus **Apple Wallet et Google Wallet côte à côte**,
  mis à jour en temps réel, fidèles aux passes (zones de champs, limites Apple,
  bandeau Google, strip/hero, code-barres par format).
- **Templates de départ par métier** (café, boulangerie, salon, restaurant,
  boutique, HALO signature) — triés selon `merchants.business_type`, jamais de
  page blanche ; appliquer un template préserve images + nom personnalisé.
- **Couleurs** : 8 palettes harmonisées 1-clic, pickers hex (react-colorful),
  jauge de contraste WCAG AA en direct (texte/fond et libellés/fond).
- **Images** : upload glisser-déposer + recadrage au ratio cible
  (react-image-crop), redimensionnement serveur exact (sharp) — logo Apple
  160×50→480×150 + icônes 29→87, Google 660×660 ; strip 375×123→1125×369,
  hero 1032×336 ; dimensions affichées dans l'UI. Bucket `card-assets`.
- **Tampons personnalisables** : objectif (2–30, stepper), bibliothèque
  d'icônes par univers + emoji libre, 3 formes d'alvéoles, visuels
  tamponné/non-tamponné uploadés (240×240, fond transparent), grille rendue
  dans le studio (+ simulateur « client fictif »).
- **Types de carte** : tampons / points actifs ; cashback & abonnement
  réservés (`card_designs_card_type_chk`), affichés « bientôt ».
- **Validation live AVANT publication** : règles socle (`validation.ts`)
  + studio (`studioValidation.ts`) — champs vides, débordement de zones Apple,
  bornes tampons, icône requise, contraste < 2:1 bloquant, nom trop long.
- **Brouillon → aperçu → publier** : brouillon séparé du design publié
  (colonne `draft`), versionnage simple (`version`, `published_at`),
  bouton « retour à la version publiée ». La publication synchronise
  `merchants.stamp_goal` et la classe Google (GET-then-merge, invariant 2).

### Dashboard marchand
- **Fiche client** `/dashboard/customers/[id]` : identité + champs collectés,
  segment (classification existante), tampons en cours, passages, récompenses,
  chronologie complète des visites, cartes Wallet installées. Noms cliquables
  dans la liste clients.
- **Activité** `/dashboard/activity` : chronologie groupée par jour
  (scans + nouvelles cartes + récompenses encaissées via audit_logs),
  filtres 7/30/90 j, compteurs de période, état vide pédagogique.
- **Abonnement** `/dashboard/subscription` : palier courant, jauge cartes
  actives 90 j (réutilise `UsageGauge`/`computeUsage`), grille canonique
  69/129/199, relevés mensuels (`billing_snapshots`).
- **Navigation** : Studio de carte, Activité, Abonnement ajoutés ; CTA studio
  sur « Ma carte » ; nettoyage lint de `settings/page.tsx` (var morte).

### API marchandes (toutes : `currentMerchantId()` + `.eq('merchant_id', …)`)
- `GET/PUT /api/merchant/card-design` — design publié + brouillon + URLs
  signées ; sauvegarde de brouillon.
- `POST /api/merchant/card-design/publish` — validation 422, upsert versionné,
  sync stamp_goal, sync classe Google best-effort (207 si échec), audit.
- `POST/GET /api/merchant/card-design/assets` — upload redimensionné
  (logo/strip/tampons) + bibliothèque d'assets du tenant (URLs signées).

### Sécurité / étanchéité
- Parsing défensif du design (`parseCardDesign`) : whitelist de clés, bornes,
  zones/formats/types contraints — rien d'inconnu ne survit au jsonb.
- `enforceAssetOwnership` : tout chemin d'asset hors du préfixe Storage du
  tenant est supprimé avant persistance/signature (anti-fuite cross-tenant).
- Gardes statiques `src/lib/merchant/__tests__/studioGuards.test.ts` (6 tests) :
  toutes les routes `/api/merchant/**` résolvent le tenant, filtrent le
  service-role, scopen les chemins Storage ; aucune page dashboard n'importe
  la couche admin cross-tenant ni `merchant_health`.

## 3. Fichiers créés / modifiés

### Migrations (CRÉÉES, NON APPLIQUÉES — fichiers seulement)
- `supabase/migrations/20260611_card_design_studio.sql` — colonnes additives
  `card_designs` : card_type, stamps, draft, draft_saved_at, version,
  published_at + CHECK card_type.
- `supabase/migrations/20260611_audit_actions_studio.sql` — migration jumelle
  du CHECK audit (liste 20260610 + CARD_DESIGN_DRAFT_SAVED /
  CARD_DESIGN_PUBLISHED / CARD_ASSET_UPLOADED).

### Lib (extensions additives partagées)
- `src/lib/auditLog.ts` — +3 actions (additif).
- `src/lib/cardDesign/types.ts` — +CardTypeKey, StampsConfig, StampShape,
  champs OPTIONNELS `cardType`/`stamps` sur CardDesign (rien d'existant changé).
- `src/lib/cardDesign/repository.ts` — `rowToDesign` lit les colonnes studio
  si présentes (rétro-compatible pré-migration) ; `designToRow` INCHANGÉ
  (les écritures admin restent compatibles avec la prod actuelle).
- NOUVEAUX : `src/lib/cardDesign/templates.ts`, `stampLibrary.ts`,
  `studioValidation.ts` (+ tests colocalisés).

### Module marchand (nouveau)
- `src/lib/merchant/cardStudio.ts`, `studioImages.ts`, `activity.ts`
- `src/lib/merchant/__tests__/` : cardStudio (12), activity (6),
  studioGuards (6).

### App
- `src/app/api/merchant/card-design/{route.ts, publish/route.ts, assets/route.ts}`
- `src/app/(app)/dashboard/studio/{page.tsx, StudioClient.tsx}` +
  `_components/{WalletPreviews, StampGrid, BarcodeVisual, TemplateGallery,
  ColorsSection, StampsSection, FieldsSection, BarcodeSection,
  ImageUploadField}.tsx`
- `src/app/(app)/dashboard/activity/page.tsx`
- `src/app/(app)/dashboard/subscription/page.tsx`
- `src/app/(app)/dashboard/customers/[id]/page.tsx`
- Modifiés : `DashboardShell.tsx` (nav), `card/page.tsx` (CTA studio),
  `customers/CustomersTable.tsx` (lien fiche client), `settings/page.tsx`
  (nettoyage lint uniquement).

## 4. Dépendances pour le fondateur (AVANT merge / mise en prod)

1. **Appliquer les 2 migrations `20260611_*`** dans Supabase AVANT de merger :
   sans elles, l'enregistrement de brouillon et la publication marchande
   échouent (colonnes manquantes) et les 3 nouveaux audits sont rejetés par le
   CHECK. La LECTURE du studio fonctionne sans migration (fallbacks en place).
2. **Conflit attendu avec Agent B** : si l'agent B ajoute aussi des
   AuditAction, fusionner les listes dans UNE migration jumelle finale du
   CHECK (le test `auditActionsSync` prend la DERNIÈRE migration par ordre de
   nom de fichier).
3. **Rendu des tampons sur les passes** (choisi de NE PAS faire ici) : la
   grille de tampons s'affiche dans le studio ; sur le pass, le compteur reste
   numérique (`{points}`). Le rendu d'un strip dynamique par carte exige de
   modifier `src/lib/applePass.ts` / la chaîne PassKit (hors territoire,
   prod-critique). La config (`card_designs.stamps`) est prête à être branchée.
4. **Sous-utilisateurs (réglages)** : non fait — exige un modèle de données
   auth (table memberships + politique RLS) qui appartient à une décision
   produit/admin. À planifier séparément.
5. La policy RLS d'écriture de `card_designs` reste admin-only : les écritures
   marchandes passent par les endpoints serveur (service-role + filtre tenant),
   pattern standard du projet. Aucune policy modifiée.

## 5. Comment vérifier

```bash
cd /Users/letaief/Projects/HALO/app/.claude/worktrees/agent-a
npx vitest run          # 379 tests verts (344 existants + 35 Agent A)
npx tsc --noEmit        # propre
npm run lint            # 0 erreur, 0 warning
NODE_OPTIONS="--max-old-space-size=4096" npm run build
npx next dev -p 3001    # puis login demo@example.com (lecture seule !)
```

Parcours de vérification (compte démo Café du Rhône — NE RIEN PUBLIER en
prod tant que les migrations ne sont pas appliquées ; la lecture est sûre) :
1. `/dashboard` → nav : Studio de carte, Activité, Abonnement.
2. `/dashboard/studio` → templates triés métier, aperçus Apple/Google côte à
   côte, palettes + contraste live, tampons (objectif, icônes, formes),
   simulateur client fictif, validation live, barre brouillon/publier.
3. `/dashboard/customers` → cliquer un nom → fiche client (KPIs, chronologie,
   carte, champs collectés, segment).
4. `/dashboard/activity` → compteurs + chronologie par jour, filtres 7/30/90 j.
5. `/dashboard/subscription` → palier Essentiel, jauge, grille 69/129/199,
   relevés mensuels.
6. `/dashboard/card` → CTA « Ouvrir le studio de carte ».

## 6. État des vérifications (2026-06-10)

- `npx vitest run` : **379/379 verts** (66 fichiers ; 344 existants + 35 Agent A).
- `npx tsc --noEmit` : propre.
- `npm run lint` : **0 erreur, 0 warning** (résumé complet lu).
- `npm run build` : **OK** — routes émises : `/dashboard/studio`, `/dashboard/activity`,
  `/dashboard/subscription`, `/dashboard/customers/[id]`,
  `/api/merchant/card-design{,/publish,/assets}`.
- Vérification runtime (dev server port 3001, compte démo, lecture seule) :
  login marchand OK ; `/dashboard`, `/dashboard/studio`, `/dashboard/activity`
  (avec stats réelles 7/30/90 j), `/dashboard/subscription` (palier Essentiel,
  grille 69/129/199, relevés), `/dashboard/card`, fiche client réelle
  (`/dashboard/customers/4e051e51-…`) → tous 200 avec contenu attendu ;
  `GET /api/merchant/card-design` renvoie le design publié du Café du Rhône +
  fallbacks pré-migration (`version: 0`, `draft: null`) comme prévu.
  AUCUNE écriture effectuée (pas de brouillon/publication/upload en prod).

## 7. Notes d'environnement worktree (pour les prochains agents)

- **Turbopack refuse les symlinks sortant du projet** : `node_modules` et
  `certs` liés en symlink font paniquer `next build`. Correctif local appliqué
  dans CE worktree : `npm ci` (vrai node_modules) + copie réelle de `certs/`
  (gitignorée). Rien de committé, lockfile intact.
- **Piège git réel rencontré** : `certs/` dans .gitignore n'ignore PAS un
  symlink nommé `certs` → `git add -A` l'avait committé (un chemin relatif,
  aucun secret). Historique de branche réécrit (filter-branch) pour le
  retirer + règle `certs` (sans slash) ajoutée au .gitignore.
