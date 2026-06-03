# Encaissement de la récompense (reward redemption) — Design

**Date :** 2026-06-03
**Statut :** Validé (brainstorming)
**Brique suivante :** plan d'implémentation (`writing-plans`)
**Contexte :** comble le principal trou fonctionnel de l'app. Aujourd'hui les tampons s'accumulent et le flag « Récompense prête » s'allume, mais **aucun mécanisme ne permet d'utiliser/encaisser la récompense** (pas d'endpoint, pas d'UI, pas de suivi ; le seul reset est implicite via un `> 10` codé en dur dans le scan). Sans ça, le produit est un traqueur de tampons, pas un programme de fidélité complet.

## Objectif

Permettre au **commerçant** (jamais le client) d'**encaisser** la récompense d'une carte pleine : la carte repart à zéro, l'évènement est tracé, la carte Wallet se met à jour, et un compteur « récompenses offertes » apparaît dans l'analytique. Le tout en réutilisant l'outil Scanner existant et l'audit trail existant.

## Décisions validées (brainstorming)

1. **Encaissement = action marchand uniquement.** Le client présente sa carte ; le marchand, en face de lui, valide la remise. Pas d'auto-encaissement côté client.
2. **Deux points d'accès :** le **Scanner** (bouton qui apparaît quand la carte scannée est pleine) **et** la **fiche Clients** (bouton sur la ligne d'un client dont la carte est pleine).
3. **Plafonnement à l'objectif.** Une fois `stampGoal` atteint, le scan n'ajoute plus de tampon ; il propose d'encaisser. L'encaissement remet à **0** (pas de cumul/surplus).
4. **Correction du bug du seuil `10` en dur** : le scan respecte le `stampGoal` configurable (1–50).
5. **Traçage via l'`audit_logs` existant** (action `REWARD_REDEEMED`) → **aucune migration BDD**.
6. **Stat simple** « X récompenses offertes » ajoutée au widget Récompenses de l'analytique.
7. Message **« Merci 🎉 »** poussé sur le Wallet à l'encaissement (best-effort, n'échoue pas l'opération).

## Périmètre

**Inclus** : logique pure `applyStamp` + `canRedeem` (testées), endpoint `POST /api/redeem`, refonte de la règle de comptage du scan (respect de `stampGoal`, plafonnement, `rewardReady` dans la réponse), bouton d'encaissement dans le Scanner et dans la fiche Clients, correction des `/10` en dur, compteur « récompenses offertes » dans l'analytique, audit `REWARD_REDEEMED`, push Wallet best-effort, tests.

**Hors périmètre (YAGNI)** : récompenses à paliers / multi-récompenses, catalogue de récompenses, expiration de récompense, historique détaillé d'encaissements par client dans l'UI (seul le compteur global est exposé), encaissement côté client, demi-récompense / report de surplus, email de confirmation.

## 1. Logique pure (testée, sans DB)

Dans `src/lib/loyalty/` :

- `applyStamp(currentStamps, goal)` → `{ newStamps: number; rewardReady: boolean; added: boolean }` :
  - `currentStamps >= goal` (carte déjà pleine) → `{ newStamps: currentStamps, rewardReady: true, added: false }` (aucun tampon ajouté).
  - sinon → `next = currentStamps + 1` ; `{ newStamps: next, rewardReady: next >= goal, added: true }`.
  - Remplace le `if (newStamps > 10)` codé en dur dans le scan.
- `canRedeem(stamps, goal)` → `boolean` : `stamps >= goal && goal > 0`.

→ Découpage pur/DB identique au reste du repo (testé sur les fonctions, pas sur les routes/`fetch*`).

## 2. Scan API (modifiée, rétro-compatible)

`POST /api/scan` (`src/app/api/scan/route.ts`) :
- Charge `stampGoal` via `fetchMerchantConfig(merchantId)` (déjà utilisé par l'analytique).
- Remplace le bloc `> 10` par `applyStamp(card.stamps_count, stampGoal)`.
- Si `added === false` (carte déjà pleine) : **ne touche pas** `stamps_count`, **n'insère pas** dans `scan_history`, et renvoie `{ success: true, card, rewardReady: true, added: false, stampGoal }`. Le push Wallet et l'audit `CARD_SCANNED` ne sont pas déclenchés (rien n'a changé).
- Si `added === true` : met à jour `stamps_count = newStamps`, insère `scan_history` (comme aujourd'hui), push Wallet best-effort, audit `CARD_SCANNED` (détails inchangés + `reward_ready`). Réponse : `{ success: true, card: updatedCard, rewardReady, added: true, stampGoal }`.
- `rewardUnlocked` (champ historique) est conservé en alias de `rewardReady` pour ne rien casser.

## 3. Endpoint d'encaissement (nouveau)

`POST /api/redeem` (`runtime = "nodejs"`), corps `{ cardId }` (id de carte **signé**, même format que le scan) :
- Auth marchand : `supabase.auth.getSession()` → `401` sinon. Rate-limit `redeem:<userId>` (ex. 60/min).
- Vérifie la signature du QR (`verifyQRCode`) **si** `cardId` est un payload signé ; depuis la fiche Clients on passe l'`id` brut de carte → accepter aussi un UUID brut validé (`UUID_RE`). Résout `actualCardId`.
- Charge la carte (`*, customers(*)`), vérifie `merchant_id === merchant.id` (`403` sinon), récupère `stampGoal`.
- `canRedeem(card.stamps_count, stampGoal)` faux → `409 { error: "Carte non complète" }`.
- Remet `stamps_count = 0`. **`last_scan` reste inchangé** (l'encaissement n'est pas une visite gagnant un tampon ; la récence/segmentation reste pilotée par les scans).
- Audit `REWARD_REDEEMED` (`merchant_id`, `user_id`, `card_id`, `details: { goal: stampGoal }`).
- Push Wallet best-effort : `getChannels().notify([actualCardId], { title: "Récompense utilisée", body: "Merci 🎉 Votre carte repart à zéro." })` dans un `try/catch`.
- Réponse : `{ success: true, card: updatedCard }`.

Idempotence : best-effort via la garde `canRedeem` (une 2ᵉ tentative sur une carte déjà remise à 0 renvoie `409`), suffisant ici.

## 4. UI — Scanner

`src/app/scan/page.tsx` :
- La réponse du scan porte désormais `rewardReady`, `added`, `stampGoal`.
- Affichage du solde : remplacer `/ 10` en dur par `/ {stampGoal}` (et la largeur de barre par `stamps_count / stampGoal`).
- État succès :
  - `added === false && rewardReady` → message « 🎁 Récompense prête » + bouton **« Remettre la récompense »**.
  - `added === true && rewardReady` → « Point ajouté — 🎁 carte complète ! » + bouton **« Remettre la récompense »**.
  - sinon → « Point ajouté » (comme aujourd'hui).
- Le bouton appelle `POST /api/redeem` avec le `cardId` scanné ; succès → écran « Récompense remise ✅ » + bouton « Scan suivant ». Échec → message d'erreur, bouton réessayer.

## 5. UI — Fiche Clients

`src/app/dashboard/customers/page.tsx` (server) + nouveau composant client `RedeemCell.tsx` :
- La requête sélectionne aussi l'**`id`** de la carte (`loyalty_cards(id, stamps_count, last_scan)`), et la page charge `stampGoal` via `fetchMerchantConfig`.
- Colonne Fidélité : `/ 10` → `/ {stampGoal}` (solde + barre).
- Colonne Actions : remplacer le `MoreVertical` inerte par `<RedeemCell cardId stampsCount goal customerName />` (client) — si `canRedeem` est vrai, affiche un bouton **« Récompense remise »** ; sinon rien (ou désactivé). Le bouton poste vers `/api/redeem` (id de carte brut) puis `router.refresh()`.

## 6. Analytique — compteur « récompenses offertes »

`src/lib/analytics/rewards.ts` :
- Étendre `Rewards` avec `redeemedCount: number`.
- `fetchRewards(merchantId, range)` ajoute un comptage des évènements d'encaissement sur la période : via `supabaseAdmin` (scopé `merchant_id`), `audit_logs` `action = 'REWARD_REDEEMED'`, `created_at >= rangeStart` (réutiliser le helper de plage existant des analytics). `computeRewards` reste pur ; le comptage des redemptions est fait côté `fetch` (DB) et passé au type.
- Le widget Récompenses (UI analytique existante) affiche « X récompenses offertes » à côté du taux de complétion.

## 7. Validation & sécurité

- `POST /api/redeem` : auth marchand obligatoire (`401`), propriété carte vérifiée (`403`), carte complète requise (`409`), rate-limit. Lecture/écriture via `supabaseAdmin` côté serveur, scopé au marchand.
- L'encaissement depuis le Scanner utilise le `cardId` signé (anti-forge, comme le scan) ; depuis la fiche Clients, l'`id` brut est validé (`UUID_RE`) et la propriété marchand revérifiée côté serveur → pas d'accès croisé.
- Audit `REWARD_REDEEMED` immuable (table append-only existante).

## 8. Tests (TDD)

Logique pure (`src/lib/loyalty/__tests__/`) :
- `applyStamp` : sous l'objectif (ajoute, pas prête), atteint pile l'objectif (ajoute, prête), déjà pleine (n'ajoute pas, prête), objectif custom (ex. 8).
- `canRedeem` : `stamps < goal` → faux ; `stamps === goal` → vrai ; `stamps > goal` → vrai ; `goal = 0` → faux.

Routes + UI : vérifiées par `npm run build` + fumée sur le compte démo (scanner une carte presque pleine jusqu'à complétion → bouton encaisser → carte à 0 ; depuis la fiche Clients, encaisser une carte pleine ; le compteur « récompenses offertes » augmente).

## Réutilisation / cohérence

Réutilise `fetchMerchantConfig` (objectif), `verifyQRCode` (anti-forge), `getChannels` (push Wallet), `logAuditEvent` (trace), le helper de plage de l'analytique et le widget Récompenses existant. `applyStamp` devient la **source unique** de la règle de comptage (scan), supprimant le `10` en dur dispersé. Aucune migration BDD.
