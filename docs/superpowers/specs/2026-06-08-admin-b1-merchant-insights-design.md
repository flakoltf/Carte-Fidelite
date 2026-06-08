# B1 — Vue d'ensemble / Insights par marchand (admin) — Design

> Module B1 du [blueprint admin](2026-06-07-admin-blueprint-design.md). Vague 1 (go-to-market).
> **Date** : 2026-06-08 · **Statut** : validé (brainstorming) · **Périmètre** : « Santé en un écran ».

## Contexte — pourquoi

L'admin (super-admin) peut créer/éditer un marchand et personnaliser sa carte, mais n'a **aucune vue de la santé** d'un marchand : est-il réellement opérationnel (carte faite, clients inscrits, scans en caisse) ? son activité monte-t-elle ou décroche-t-elle ? Pour suivre les premiers clients pendant le démarchage, le fondateur a besoin d'un écran synthétique par marchand. ~95 % des métriques sont **déjà calculées** côté dashboard marchand (`src/lib/analytics/*`, `src/lib/segments/*`) ; B1 les réutilise pour une vue admin, et ajoute la seule chose manquante : un **statut d'activation**.

## Objectifs / Non-objectifs

**Objectifs**
- Un écran « santé d'un marchand » : KPIs clés, statut d'activation, répartition par segments, mini-tendance de visites, états (neuf / à risque).
- Réutiliser les libs analytics/segments existantes (DRY). Une seule brique métier nouvelle : le calcul d'activation (pur, testé).

**Non-objectifs**
- Pas de miroir complet des 8 widgets du dashboard (choix « mince » validé).
- Pas de sélecteur de période (fenêtre fixe 30 j ; extensible plus tard).
- Pas d'export, pas de comparaison période/période, pas de refonte de la fiche en onglets (la sous-page suffit pour le MVP).

## Placement & rendu

- Nouvelle **sous-page serveur** : `src/app/admin/merchants/[id]/insights/page.tsx` (`export const dynamic = "force-dynamic"`), protégée par la garde admin du layout (`requireAdminPage` via `admin/layout.tsx`).
- Garde-corps : id UUID valide + `role = "merchant"` → sinon `notFound()` (même pattern que `…/[id]/card/page.tsx`).
- **Lien d'accès** : ajouter un lien « Vue d'ensemble » dans l'en-tête de la fiche marchand `src/app/admin/merchants/[id]/page.tsx` (à côté du lien carte existant).
- **Permission données** : les `fetch*` appellent `createClient()` (session). La session admin passe la RLS `is_admin` (déjà le cas pour le dashboard admin global), donc lire les données d'un autre marchand fonctionne. B1 passe le `merchantId` de l'URL aux `fetch*` ; il **n'utilise pas** `currentMerchantId()` (donc indépendant de l'impersonation).

## Données — réutilisation (rendu serveur, fenêtre 30 j)

Appels directs, dans `page.tsx`, chacun en `try/catch` (dégradation propre → « — » si échec, jamais de page blanche) :
- `fetchKpis(id, "30j")` → `{ totalCustomers, newCustomers, visits, activeCustomers, completedCards, activeRate }`.
- `fetchSegmentCounts(id)` → `{ total, stages: { nouveau, regulier, vip, en_train_de_partir, inactif }, flags }`.
- `fetchVisits(id, "30j")` → `Point[]` = `{ label, value }[]` (visites par jour).

Inputs d'activation (3 comptes, **tout-temps**) — requêtes `count` directes dans la page :
- `card_designs` existe pour ce marchand → `hasCard`.
- `customers` count → `customerCount`.
- `scan_history` count → `scanCount`.

## Briques nouvelles

### `src/lib/admin/activation.ts` (pure, testée — TDD)
```ts
export type ActivationStep = { key: string; label: string; done: boolean };
export type ActivationStatus = { steps: ActivationStep[]; doneCount: number; isLive: boolean };

export function computeActivation(input: {
  hasCard: boolean;
  customerCount: number;
  scanCount: number;
}): ActivationStatus;
```
Étapes (les 3 **détectables** ; « QR affiché » écarté car non observable) :
1. `card` — « Carte configurée » → `hasCard`
2. `customer` — « Premier client inscrit » → `customerCount > 0`
3. `scan` — « Premier scan en caisse » → `scanCount > 0`

`doneCount` = nb d'étapes faites ; `isLive` = toutes faites (`doneCount === steps.length`).

### `src/app/admin/merchants/[id]/insights/MiniVisitsChart.tsx` (client)
Petit composant `"use client"` recharts (`LineChart`) recevant `points: { label: string; value: number }[]` en props, au style du dashboard (stroke `#0D6B5E`, axes discrets). Recharts impose un composant client.

### `src/app/admin/merchants/[id]/insights/page.tsx` (serveur)
Assemble : charge les données, calcule l'activation, rend la page.

## Mise en page

En-tête (← retour fiche, nom du marchand) →
1. **4 tuiles KPI** : Clients (`totalCustomers`), Visites 30 j (`visits`), % actifs (`activeRate`), Cartes complétées (`completedCards`).
2. **Checklist d'activation** : les 3 étapes avec ✓/✗ + libellé ; « X/3 ».
3. **Segments** : compte par stage avec les couleurs `STAGE_STYLE` (`src/lib/segments/stageStyle.ts`).
4. **Mini-courbe de visites 30 j** (`MiniVisitsChart`).

## États

- **Marchand pas encore live** (`customerCount === 0 && scanCount === 0`) : on met la **checklist d'activation en avant** (message « Ce marchand n'est pas encore opérationnel ») et on masque/placeholder les graphes (pas de courbe vide).
- **À risque** (a des clients mais `visits === 0` sur 30 j, **ou** part `inactif + en_train_de_partir` > 50 % du total) : bandeau discret « activité en baisse ».
- **Nominal** : tout s'affiche.

## Tests

- **TDD** sur `computeActivation` (pur) : toutes faites / aucune / partielles / `isLive` vrai-faux.
- Page + chart vérifiés par `tsc` + `eslint` + `npm run build` + **rendu authentifié** (login admin démo → GET `/admin/merchants/[id]/insights` → 200 + marqueurs présents), comme A2.

## Frontière (anti-collision)

100 % territoire admin. Fichiers nouveaux : `src/app/admin/merchants/[id]/insights/**` + `src/lib/admin/activation.ts`. Seule modification d'un fichier existant : **ajout d'un lien** dans `src/app/admin/merchants/[id]/page.tsx` (l'autre agent travaille sur `…/[id]/card/**`, pas sur la fiche elle-même — risque de conflit quasi nul ; à rebaser si besoin).

## Vérification end-to-end

1. `npx vitest run src/lib/admin/__tests__/activation.test.ts` → vert.
2. `tsc` + `eslint` propres ; `npm run build` compile la route `/admin/merchants/[id]/insights`.
3. Serveur dev (port alternatif) + login admin démo + `curl` authentifié sur `/admin/merchants/<id>/insights` → 200, marqueurs présents (« Activation », « Clients », un libellé de segment).
4. Vérif manuelle navigateur : marchand avec données vs marchand neuf (états).

## Suite

Module suivant de la vague 1 après B1 : **B4 (Clients & cartes du marchand)**, qui réutilisera la recherche d'A2 et les segments.
