# Moteur de fidélité multi-types — Spec de conception

**Date :** 2026-06-04
**Branche cible :** `feature/loyalty-engine` (worktree isolé, depuis `feat/public-enrollment`)
**Méthode :** brainstorming ✅ → writing-plans (ce doc + plan) → subagent-driven-development

## Problème

Aujourd'hui la carte est **implicitement une carte à tampons** : `applyStamp(currentStamps, goal)`
incrémente `loyalty_cards.stamps_count` jusqu'à `merchants.stamp_goal`, et `/api/redeem` remet à 0.
Il n'existe **aucune notion de « type de carte »**. On veut que l'admin choisisse, par marchand,
la **mécanique de fidélité**, sans casser l'existant.

## Objectif (v1)

Un **programme de fidélité par marchand** = `{ type, config }`, et une fonction **pure**
`applyScan(program, currentCount, now)` qui dispatche vers la règle du type. Trois types « cœur » :

| Type          | config                          | Comportement                                                              | Encaissement (`/api/redeem`) |
|---------------|---------------------------------|---------------------------------------------------------------------------|------------------------------|
| `stamp_card`  | `{ goal: N }`                   | **Cyclique** : scan → +1 jusqu'à `goal`, carte « prête » à `goal`         | Oui → remet `stamps_count` à 0 |
| `visit_based` | `{ milestones: [5,20,50] }`     | **Cumulatif, jamais reset** : récompense ponctuelle quand un palier est atteint | Non (récompense donnée sur-le-champ) |
| `tiered`      | `{ tiers: [{name, at}] }`       | **Cumulatif** : niveau = plus haut palier dont `at` ≤ count ; statut permanent | Non |

> Cashback / abonnement = **hors v1**. L'archi (dispatch par type) permet de les brancher plus tard
> sans tout refaire.

## Modèle de données

`loyalty_cards.stamps_count` est **réutilisé** comme compteur (cyclique pour `stamp_card`,
cumulatif pour `visit_based`/`tiered`). **Aucune nouvelle colonne carte.**

Deux colonnes ajoutées sur `merchants` :

```sql
alter table merchants
  add column if not exists loyalty_type text not null default 'stamp_card',
  add column if not exists loyalty_config jsonb not null default '{}'::jsonb;
alter table merchants
  add constraint merchants_loyalty_type_chk
  check (loyalty_type in ('stamp_card','visit_based','tiered'));
```

⚠️ **Base PROD partagée et à jour** : la migration est **écrite dans le repo mais appliquée par
l'utilisateur** (feu vert explicite). Tant qu'elle n'est pas appliquée, le code reste compatible :
`stamp_card` est le défaut et le goal retombe sur la colonne existante `merchants.stamp_goal`.
**Zéro backfill** (les marchands existants → `stamp_card`, goal = `stamp_goal` actuel).

## Architecture du code (pur, testé Vitest)

```
src/lib/loyalty/
  stamp.ts                 # EXISTANT — applyStamp / canRedeem (conservés tels quels)
  types.ts                 # NOUVEAU — LoyaltyProgram, configs, ScanResult, ScanEvent
  engine.ts                # NOUVEAU — applyScan(program, count, now) + programCanRedeem
  validate.ts              # NOUVEAU — validateLoyaltyProgram(type, rawConfig)
  resolveProgram.ts        # NOUVEAU — resolveLoyaltyProgram(row) depuis les colonnes merchants
  __tests__/engine.test.ts
  __tests__/validate.test.ts
  __tests__/resolveProgram.test.ts
```

### Types

```ts
export type LoyaltyType = "stamp_card" | "visit_based" | "tiered";
export type StampCardConfig = { goal: number };
export type VisitBasedConfig = { milestones: number[] };          // triés croissants, distincts
export type Tier = { name: string; at: number };
export type TieredConfig = { tiers: Tier[] };                     // triés par `at` croissant, distincts

export type LoyaltyProgram =
  | { type: "stamp_card"; config: StampCardConfig }
  | { type: "visit_based"; config: VisitBasedConfig }
  | { type: "tiered"; config: TieredConfig };

export type ScanEvent =
  | { kind: "reward_ready" }                  // stamp_card : carte pleine ce scan
  | { kind: "milestone_reached"; at: number } // visit_based : palier franchi ce scan
  | { kind: "tier_changed"; name: string };   // tiered : montée de niveau ce scan

export type ScanResult = {
  newCount: number;
  added: boolean;       // false uniquement si stamp_card déjà pleine
  rewardReady: boolean; // stamp_card : carte pleine ; visit_based : palier atteint ce scan ; tiered : false
  events: ScanEvent[];  // ce qui vient de se produire (pour push/analytics)
};
```

### Règles (`applyScan`)

- **stamp_card** : délègue à `applyStamp`. `added=false` si déjà pleine. `events=[{reward_ready}]`
  seulement au scan qui atteint le goal (`added && rewardReady`).
- **visit_based** : `next = count+1`, toujours `added=true`, jamais de reset.
  `rewardReady = milestones.includes(next)` ; `events=[{milestone_reached, at: next}]` si franchi.
- **tiered** : `next = count+1`, toujours `added=true`. `rewardReady=false`.
  Si le niveau au `next` diffère du niveau au `count` → `events=[{tier_changed, name}]`.

### Encaissement

`programCanRedeem(program, count)` = `true` **seulement** pour `stamp_card` (et carte pleine).
`/api/redeem` refuse (409) pour `visit_based`/`tiered` (la récompense y est donnée sur-le-champ).

### Résolution depuis la BDD

```ts
resolveLoyaltyProgram(row: { loyalty_type, loyalty_config, stamp_goal }): LoyaltyProgram
```
- `loyalty_type` absent / inconnu → `stamp_card`.
- `stamp_card` : `goal = config.goal ?? stamp_goal ?? DEFAULT_STAMP_GOAL`.
- `visit_based` : `milestones = config.milestones` (déjà validé en écriture ; sinon défaut `[stamp_goal]`).
- `tiered` : `tiers = config.tiers` (déjà validé ; sinon `[]`).
- **Tolérant en lecture** (colonnes peut-être absentes pré-migration) : un `select` qui échoue
  sur les nouvelles colonnes → retomber sur `stamp_card` + `stamp_goal`.

## Validation (écriture admin)

`validateLoyaltyProgram(type, rawConfig)` → `{ ok, program } | { ok:false, error }` :
- `stamp_card` : `goal` entier 1..50.
- `visit_based` : `milestones` tableau non vide d'entiers > 0, **distincts**, **strictement croissants**, ≤ 10 éléments.
- `tiered` : `tiers` tableau non vide ≤ 6, chaque `{ name: 1..40 car., at: entier > 0 }`, `at` distincts **strictement croissants**.

## Intégrations runtime

1. **`/api/scan`** : remplacer `applyStamp(card.stamps_count, cfg.stampGoal)` par
   `applyScan(resolveLoyaltyProgram(merchantRow), card.stamps_count)`. Garder le contrat de réponse
   (`rewardReady`, `added`, `stampGoal`) + exposer `events` et `loyaltyType` pour l'UI scanner.
2. **`/api/redeem`** : utiliser `programCanRedeem` ; ne reset que `stamp_card`.
3. **Admin `/admin/merchants/[id]`** (`EditMerchantForm`) : sélecteur « Type de programme » +
   champs dynamiques (goal / milestones / tiers). PATCH `/api/admin/merchants/[id]` valide via
   `validateLoyaltyProgram` et persiste `loyalty_type` + `loyalty_config`.
4. **Admin création** (`NewMerchantForm`) : laisser le défaut `stamp_card` (le type se règle à l'édition). Hors v1 : choix à la création.

## Hors périmètre v1

- UI scanner/dashboard adaptée par type (affichage paliers/niveaux) au-delà du minimum.
- Skin HALO Light des nouveaux champs admin (admin reste en thème zinc actuel).
- Cashback, abonnement, API publique / OpenAPI.

## Découpage de livraison

- **Lot A (pur, sans BDD, livrable tout de suite)** : types, `engine`, `validate`, `resolveProgram`, tests Vitest.
- **Lot B (après migration appliquée par l'utilisateur)** : migration, câblage `/api/scan` + `/api/redeem`, admin UI + route PATCH.
```

