# Sous-projet 4a — Campagnes manuelles ciblées — Design

**Date :** 2026-06-02
**Statut :** Validé (brainstorming)
**Brique suivante :** plan d'implémentation (`writing-plans`)
**Contexte :** premier volet du Module 4 (Campagnes). Le second volet — automatisation planifiée (anniversaire d'inscription, rappels inactifs récurrents) — est un sous-projet distinct (4b).

## Objectif

Permettre au marchand d'envoyer un message push Wallet à une **audience ciblée** (un segment, l'étiquette « Récompense prête », ou tous ses clients), au lieu du seul broadcast actuel. Réutilise le canal push livré (Module 3) et le moteur de segmentation (Module 2) comme **source unique** de la définition des audiences.

## Décisions validées (brainstorming)

1. **Envoi manuel immédiat** uniquement (pas d'automatisation/planificateur ce cycle).
2. **Audiences** : les 5 segments de cycle de vie + « Récompense prête » + « Tous mes clients ».
3. **Approche A** : étendre l'existant + réutiliser le moteur de segmentation (pas de sous-système ni de résolution SQL dupliquée).
4. **Rétro-compatible** : sans audience → broadcast « tous » comme aujourd'hui.

## Périmètre

**Inclus** : modèle d'audience, résolution d'audience (pure + DB), extension de `/api/notifications/send`, colonne d'historique `audience`, sélecteur d'audience + tailles dans l'UI, validation, tests.

**Hors périmètre (YAGNI / 4b ou plus tard)** : automatisation/planificateur (cron/edge), anniversaire d'inscription, rappels inactifs automatiques, modèles de message, combinaisons d'audiences (segment ET étiquette), table `campaigns` dédiée, canaux email/SMS.

## 1. Modèle d'audience

```
type AudienceKey = StageKey | "recompense_prete" | "all"
AUDIENCE_KEYS = [...STAGE_KEYS, "recompense_prete", "all"]
```
Libellés réutilisés : `STAGE_LABELS` (stades) + `FLAG_LABELS.recompense_prete` + `"Tous mes clients"` pour `"all"`. Pas de nouvelle table de libellés.

## 2. Résolution d'audience (réutilise le moteur de segmentation)

- **Pur, testé** — `selectAudienceCardIds(rows, audience)` :
  - `rows: { stage: StageKey; recompenseReady: boolean; cardIds: string[] }[]`
  - `audience === "all"` → union de tous les `cardIds`
  - `audience === "recompense_prete"` → `cardIds` des lignes où `recompenseReady`
  - sinon (un stade) → `cardIds` des lignes où `stage === audience`
- **DB** — `fetchAudienceCardIds(merchantId, audience): Promise<string[]>` : réutilise `loadClassified(merchantId)` (étendu pour exposer, par client, ses `cardIds` et son `cls`), puis appelle le sélecteur pur.

→ L'audience d'une campagne correspond **exactement** à ce qu'affiche l'onglet Segments (même classification, zéro divergence).

## 3. Route d'envoi (étendue, rétro-compatible)

`POST /api/notifications/send` accepte `{ title, body, audience? }` :
- `audience` défaut `"all"`.
- Si `audience` est fourni mais hors `AUDIENCE_KEYS` → `400`.
- Résout les cartes via `fetchAudienceCardIds(merchantId, audience)`.
- Puis flux **inchangé** : `reachable = wallet_device_registrations ∩ cardIds` → `getChannels().notify(reachable, { title, body })` → insert `wallet_notifications`.
- Anti-spam **10 envois/heure/marchand** conservé ; scoping marchand conservé (`supabaseAdmin` côté serveur).
- Audience vide / 0 joignable → réponse propre `{ pushed: 0, reachable: 0 }`.

## 4. Historique (migration légère)

```sql
ALTER TABLE wallet_notifications ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'all';
```
Appliquée en prod (`oqcelbbozpykwkasjtqy`) par le contrôleur **avec consentement**. L'insert d'historique enregistre l'audience ; la liste d'historique l'affiche (via le libellé).

## 5. UI (onglet Notifications existant)

- `SendForm` : ajout d'un **menu déroulant Audience** listant les audiences avec leur **taille**, ex. « VIP (8) », « Inactifs (30) », « Récompense prête (5) », « Tous (30) ».
  - Les tailles proviennent de l'endpoint **existant** `/api/segments` (résumé : `stages[].count`, `flags.recompense_prete`, `total`). Aucun nouvel endpoint.
- À l'envoi : POST `{ title, body, audience }` ; message de résultat inchangé (« Envoyé à N appareil(s) (M joignable(s)) »).
- La liste d'historique affiche l'audience de chaque envoi (libellé).

## 6. Validation & sécurité

- `audience` hors liste → `400` ; `title`/`body` vides → `400` (existant).
- Rate-limit `notify:<merchantId>` 10/h inchangé.
- Lecture des cartes/registrations en `supabaseAdmin` côté serveur, scopée au marchand (cartes résolues à partir de `merchant_id`).
- Aucune donnée d'un autre marchand : `loadClassified` filtre déjà par `merchant_id` (RLS + scoping).

## 7. Tests (TDD)

Logique pure :
- Registre `AUDIENCE_KEYS` : contient les 5 stades + `recompense_prete` + `all` ; chaque clé a un libellé résoluble.
- `selectAudienceCardIds` : `all` (union, dédoublonnée si besoin), un stade donné, `recompense_prete`, audience sans membre (→ `[]`).

Route + UI : vérifiées par `npm run build` + fumée sur le compte démo (choisir « Inactifs », envoyer, voir l'historique avec l'audience ; « Tous » = comportement d'avant).

## Réutilisation / cohérence

`fetchAudienceCardIds` et `selectAudienceCardIds` deviennent le point d'entrée d'audience que **4b (automatisation)** réutilisera pour ses déclencheurs (ex. cibler « Inactifs » sur planning). Le canal push (Module 3) et le moteur de segmentation (Module 2) restent les sources uniques — aucune logique dupliquée.
