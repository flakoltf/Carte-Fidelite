# Sous-projet 1 — Config marchand par l'admin — Design

**Date :** 2026-06-01
**Statut :** Validé (brainstorming)
**Brique suivante :** plan d'implémentation (`writing-plans`)

## Objectif

Permettre à l'**admin** de rendre chaque marchand flexible en réglant, par marchand : l'**objectif de la carte** (nb de tampons pour une récompense), les **seuils de segmentation**, le **métier/preset dashboard** et le **branding** (logo, couleur). Les valeurs figées en dur aujourd'hui (notamment l'objectif « 10 » présent dans le pass Wallet, l'analytique et la segmentation) deviennent paramétrables — sans rien casser pour les marchands non configurés.

## Décisions validées (brainstorming)

1. **Admin uniquement** : édition via `/admin/merchants/[id]`. Pas de self-service marchand ce cycle.
2. **Seuils de segmentation en valeurs fines** : 4 champs numériques avec garde-fous.
3. **Approche A** : `stamp_goal` en colonne + `segment_config` en JSONB ; réutilise `business_type`/`primary_color`/`logo_url` ; résolution par fonction pure avec défauts ; injection des valeurs résolues dans les consommateurs.
4. **Rétro-compatibilité totale** : défauts = comportement actuel.

## Périmètre

**Inclus** : objectif carte (`stamp_goal`), 4 seuils de segmentation, `business_type`, `logo_url`, `primary_color` ; UI admin ; validation serveur ; diffusion vers pass Wallet, analytique, segmentation ; 1 migration.

**Hors périmètre (YAGNI / autres sous-projets)** : types de programme points/paliers/cashback (sous-projet 5) ; branding carte avancé / image de fond Wallet / coordonnées (sous-projet 2) ; self-service marchand ; équipe/rôles ; multi-établissements ; gouvernance plateforme (plans, suspension, marque blanche). Le seuil « ≤ 2 visites = nouveau » (`NEW_MAX_VISITS`) reste **fixe**, non exposé.

## 1. Modèle de données (1 migration)

Migration `supabase/migrations/20260601_merchant_config.sql` — à appliquer sur le projet Supabase **WalletCard** (`oqcelbbozpykwkasjtqy`) par le contrôleur **avec le consentement utilisateur** (hors sous-agent).

```sql
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS stamp_goal INT NOT NULL DEFAULT 10;
ALTER TABLE merchants ADD CONSTRAINT merchants_stamp_goal_range CHECK (stamp_goal BETWEEN 1 AND 50);
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS segment_config JSONB;
```

`segment_config` (nullable) quand surchargé :
```json
{ "active_days": 30, "at_risk_days": 90, "vip_visits": 10, "new_tenure_days": 30 }
```
Réutilisés tels quels : `business_type TEXT DEFAULT 'autre'`, `primary_color TEXT DEFAULT '#10b981'`, `logo_url TEXT`.

Marchands existants : `stamp_goal=10`, `segment_config=null` ⇒ comportement identique à aujourd'hui.

## 2. Résolution de la config (logique pure)

Nouveau module `src/lib/merchant-config/` :

- `types.ts` — défauts centralisés + types :
  ```
  DEFAULT_STAMP_GOAL = 10
  DEFAULT_THRESHOLDS = { activeDays: 30, atRiskDays: 90, vipVisits: 10, newTenureDays: 30 }
  type ResolvedSegmentThresholds = { activeDays; atRiskDays; vipVisits; newTenureDays }
  type ResolvedMerchantConfig = { stampGoal: number; thresholds: ResolvedSegmentThresholds }
  ```
- `resolve.ts` — `resolveMerchantConfig(row: { stamp_goal: number | null; segment_config: unknown }) : ResolvedMerchantConfig` (pur) : remplit chaque champ manquant/nul par son défaut.
- `validate.ts` — `validateMerchantConfig(input) : { ok: true; value } | { ok: false; error: string }` (pur) — règles du §5.

Les défauts aujourd'hui dispersés (`REWARD_THRESHOLD` dans `analytics/types.ts` ET `segments/types.ts`, seuils dans `segments/types.ts`) sont **rapatriés** ici comme source unique ; les modules existants les ré-exportent ou les importent pour éviter la duplication.

## 3. Diffusion vers les consommateurs

Remplacement « lire la config au lieu de la constante » :

- **Segmentation** (`src/lib/segments/`) :
  - `classifyCustomer(stats, now, cfg: ResolvedMerchantConfig)` — utilise `cfg.thresholds.*` (au lieu de `ACTIVE_DAYS/AT_RISK_DAYS/VIP_MIN_VISITS/NEW_TENURE_DAYS`) et `cfg.stampGoal` (au lieu de `REWARD_THRESHOLD`) pour le flag `recompense_prete`.
  - `fetch.ts` charge la config du marchand (sélection `stamp_goal, segment_config` sur `merchants`, scopé), la résout **une fois**, et la passe à `classifyCustomer`.
- **Analytique** (`src/lib/analytics/`) :
  - `fetchKpis` et `fetchRewards` lisent `stamp_goal` du marchand et l'utilisent comme seuil de « carte complétée » (les `computeRewards`/`computeKpis` prennent déjà le seuil en paramètre → injection seulement).
- **Pass Wallet** (`src/lib/wallet/passJson.ts`, `src/lib/applePass.ts`) :
  - `buildPassJson` reçoit `stampGoal` et affiche `${stamps} / ${stampGoal}` (au lieu de `/ 10`).
  - `buildApplePassBuffer` (charge déjà le marchand pour le branding) lit `stamp_goal` et le transmet. Idem la génération Google si elle construit le même libellé.

## 4. UI admin

Section **« Programme & segmentation »** ajoutée au formulaire d'édition marchand existant (`src/app/admin/merchants/[id]/EditMerchantForm.tsx` + sa page serveur) :

- Objectif carte (`stamp_goal`) — input number.
- Métier (`business_type`) — select : café, restaurant, boulangerie, boutique, salon, sport, autre.
- Branding — `logo_url` (URL) + `primary_color` (color picker).
- Seuils — 4 inputs number : jours actif, jours à risque, visites VIP, ancienneté nouveau (placeholders = défauts).

Sauvegarde via la route **existante** `PATCH /api/admin/merchants/[id]` (étendue pour accepter ces champs), en **service-role + garde `is_admin`** (le trigger DB `enforce_merchant_role_guard` reste la dernière ligne de défense ; ces colonnes ne sont pas privilégiées).

## 5. Validation (serveur, dans la route admin)

`validateMerchantConfig` rejette en `400` si :
- `stamp_goal` non entier ou hors `[1, 50]` ;
- `active_days` < 1 ;
- `at_risk_days` ≤ `active_days` ;
- `vip_visits` < 1 ;
- `new_tenure_days` < 1 ;
- `business_type` hors liste connue ;
- `primary_color` ne matche pas `^#[0-9a-fA-F]{6}$` ;
- `logo_url` présent mais pas une URL http(s) valide.

Le client affiche des hints inline en doublon (UX), mais la validation **fait foi côté serveur**.

## 6. Flux de données

Admin édite → `PATCH /api/admin/merchants/[id]` (valide → écrit en service-role) → ligne `merchants` à jour. Lectures (segments/analytique/pass) → `resolveMerchantConfig(row)` (défauts si nul) → comportement reflète les valeurs du marchand. Marchands non configurés : inchangés.

## 7. Gestion des erreurs

- Entrée admin invalide → `400` + message, aucune écriture.
- `segment_config` nul/partiel → défauts via `resolveMerchantConfig`.
- `stamp_goal` absent → `DEFAULT` colonne (10).
- Échec d'écriture Supabase → `500` + message générique.

## 8. Tests (TDD)

Logique pure :
- `resolveMerchantConfig` : config nulle → défauts ; partielle → champs manquants comblés ; pleine → valeurs respectées.
- `validateMerchantConfig` : chaque règle + bornes (`stamp_goal` 0/1/50/51 ; `at_risk_days` ≤ `active_days` rejeté ; couleur invalide ; métier inconnu).
- `classifyCustomer` avec `cfg` custom : ex. `at_risk_days=60` reclasse un client à 70 j de récence en « inactif » ; objectif `8` ⇒ 8 tampons = `recompense_prete=true`.
- Adaptation des tests segments existants : passer un `cfg` par défaut (helper `defaultConfig()`).

Vérifié par build + fumée (compte démo) : le formulaire admin sauvegarde ; le pass affiche `X / <objectif>` ; analytique et segments reflètent le nouvel objectif.

## Réutilisation / cohérence

`resolveMerchantConfig` devient le point d'entrée unique de la config marchand : les sous-projets suivants (branding avancé, catalogue de récompenses, types de programme) l'étendront plutôt que de re-disperser des constantes.
