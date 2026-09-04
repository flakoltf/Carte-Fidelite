# Audit — règles du programme : moteur vs Studio vs admin

> Relevé le 2026-09-04 (branche `feat/studio-regles-completes`), avant/après la
> mise à disposition de toutes les règles dans le Studio marchand. Source de
> vérité moteur : `src/lib/loyalty/types.ts` + `validate.ts` ; Studio :
> `src/app/(app)/dashboard/studio/*` ; admin : `src/app/(app)/admin/merchants/[id]/EditMerchantForm.tsx`.

Légende : ✅ configurable · ❌ absent · ⚠️ dégradé (voir note).

## 1. Choix de la mécanique

| Surface | Mécaniques proposées | Note |
|---|---|---|
| Moteur (`LOYALTY_TYPES`) | `stamp_card`, `visit_based`, `tiered`, `amount_points`, `points` | 5 mécaniques, toutes validées par `validateLoyaltyProgram`, toutes servies par `/api/scan`. |
| Studio **avant** | visuel « tampons » ou « points » seulement | La mécanique n'était pas choisie explicitement : un design tampons publié n'écrivait que `merchants.stamp_goal` ; « points » écrivait un programme `points`. `visit_based`, `tiered`, `amount_points` étaient invisibles (et intouchables) dans le Studio. |
| Studio **après** | les 5 | Sélecteur « Mécanique du programme » ; le visuel (tampons / points) est dérivé de la mécanique avec le même mapping que les templates secteur. |
| Admin | 4 (`points` absent du select) | ⚠️ Sauvegarder la fiche admin d'un marchand `points` envoie `{ goal }` → 400 « Points par scan… » (bruyant, pas silencieux). |
| Onboarding | `stamp_card`, `visit_based` | `validateProgramInput` (`lib/signup/onboarding.ts`). |
| Templates secteur | `stamp_card`, `visit_based`, `amount_points` | `lib/loyalty/templates.ts`. |

## 2. Options par mécanique

| Mécanique | Option (`loyalty_config`) | Moteur | Studio avant | Studio après | Admin |
|---|---|---|---|---|---|
| stamp_card | `goal` (1–50) | ✅ cap du scan, `resolveLoyaltyProgram` lit **`loyalty_config.goal` avant `stamp_goal`** | ⚠️ la grille (2–30) n'écrivait que `stamp_goal` : dès que `loyalty_config.goal` existait (onboarding, admin, template), **l'objectif Studio était ignoré par le moteur** | ✅ publié dans `loyalty_config.goal` **et** `stamp_goal` (même valeur) | ✅ (écrit les deux) |
| stamp_card | `welcome_stamps` (0/1) | ✅ tampon offert à l'enrôlement | ❌ | ✅ case « Tampon de bienvenue » | ❌ et **effacé** à chaque sauvegarde admin (config reconstruite `{ goal }`) |
| stamp_card | `intermediate_milestone` (1 < n < goal) | ✅ événement `intermediate_reward_ready` | ❌ | ✅ liste « Récompense intermédiaire » bornée par l'objectif | ❌ et **effacé** à la sauvegarde admin |
| stamp_card | expiration | ❌ | — | — (mention « sans échéance ») | — |
| visit_based | `milestones` (1–10, croissants) | ✅ `milestone_reached` | ❌ | ✅ éditeur de paliers | ✅ (chaîne « 5, 20, 50 ») |
| visit_based | expiration | ❌ | — | — | — |
| tiered | `tiers[{name, at}]` (1–6, croissants) | ✅ `tier_changed`, `{palier}` sur le pass | ❌ | ✅ éditeur de niveaux (même pattern que les paliers points) | ✅ |
| tiered | expiration | ❌ | — | — | — |
| amount_points | `pointsPerChf` (> 0), `rewardThreshold` (≥ 1), `rewardLabel` (1–80) | ✅ | ❌ | ✅ | ✅ sous flag `NEXT_PUBLIC_POINTS_BETA` (ou si déjà sur ce type) |
| amount_points | `maxPointsPerScan` (≥ 1, défaut moteur 1000) | ✅ plafond anti-saisie | ❌ | ✅ champ optionnel (vide = défaut) | ❌ et **effacé** à la sauvegarde admin |
| amount_points | expiration | ❌ | — | — | — |
| points | `pointsPerScan` (1–1000) | ✅ | ✅ | ✅ | ❌ |
| points | `tiers[{threshold, reward}]` (1–6) | ✅ | ✅ | ✅ | ❌ |
| points | `expiration` : `none` / `fixed_date` (jour+mois) / `rolling` (1–60 mois) | ✅ cron quotidien `/api/cron/points-expiry` (remise à zéro du cycle) | ✅ | ✅ (copy clarifiée) | ❌ |
| points | `statusTiers` (≤ 5, `threshold` ≥ 0, `label`, `benefit`) | ✅ statut à vie, `{statut}` | ✅ | ✅ | ❌ |
| toutes | `merchants.reward_label` (1–80) | affiché sur le pass | ✅ Studio express, Paramètres | idem (renvoyé tel quel à la publication, jamais effacé) | ✅ (amount_points seulement) |

## 3. Round-trip (une clé perdue = effacement silencieux)

Le Studio recharge `loyalty_config` dans un état typé (`lib/loyalty/studioProgramState.ts`)
et le republie **intégralement** via `buildLoyaltyUpdate` → `validateLoyaltyProgram`
(aucune règle dupliquée côté client : l'erreur affichée en direct est celle du
moteur). Le test `studioProgramState.test.ts` round-trippe chaque mécanique avec
toutes ses clés ; `StudioProgramRules.test.tsx` fait de même au niveau du composant
(`welcome_stamps`, `intermediate_milestone`, `milestones`, `tiers`, `maxPointsPerScan`,
`statusTiers`, objectif d'un kit démo à visuel « points »).

## 4. Reste à faire (décision superviseur — moteur non modifié ici)

1. **Échéance avant la prochaine visite pour `stamp_card` / `visit_based` / `tiered` / `amount_points`** :
   le moteur ne connaît l'expiration que pour `points` (ancre `points_cycle_started_at`
   + cron). L'étendre exigerait : une ancre de cycle par carte pour ces types (colonne
   ou réutilisation de `last_scan_at`), la règle de remise à zéro dans la RPC
   `scan_increment` ou dans le cron, un `AuditAction` (migration jumelle du CHECK),
   et la sémantique produit (remise à zéro des tampons ? perte d'un niveau acquis ?).
2. **Admin** : ajouter `points` au select, ne plus reconstruire `loyalty_config` à
   partir de zéro (conserver `welcome_stamps`, `intermediate_milestone`,
   `maxPointsPerScan`) — aujourd'hui une sauvegarde admin efface ces clés.
3. **Coque admin** (`AdminShell`) : même patron `h-screen` + `main` non positionné
   que le dashboard avant correctif (détail dans la PR `feat/studio-regles-completes`) — à aligner si le symptôme
   est observé côté admin.
