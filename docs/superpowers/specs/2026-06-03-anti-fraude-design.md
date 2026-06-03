# Idempotence + anti-spam + anti-fraude (scans) — Design

**Date :** 2026-06-03
**Statut :** Validé (brainstorming)
**Brique suivante :** plan d'implémentation (`writing-plans`)
**Contexte :** l'idempotence du scan a un effet de bord — une même carte ne peut gagner qu'1 tampon / 24 h (clé `user:card:` à TTL 24 h), ce qui **bloque un vrai 2ᵉ achat** le même jour. On corrige ça, on ajoute un anti-spam court réglable, puis une détection d'anomalies (le « 24 h » n'étant plus le garde-fou).

## Objectif

(1) **Corriger** l'idempotence pour qu'un achat répété légitime soit tamponné. (2) Ajouter un **délai minimum réglable** entre deux tampons sur la même carte (anti-spam léger). (3) **Détecter et signaler** les schémas d'activité anormaux, côté marchand (sa boutique) et côté admin (tous les marchands). On **alerte, on ne bloque pas** (sauf le délai minimum).

## Décisions validées (brainstorming)

1. **Idempotence** : le scanner envoie une **clé unique par scan** → chaque scan réel compte ; seul un renvoi du même scan est ignoré. TTL global inchangé (les autres usages — pass — gardent leur idempotence).
2. **Délai minimum par carte** : défaut **30 s**, `0` = désactivé. Réglé par l'**ADMIN** par marchand (config fidélité admin-contrôlée ; surface marchand minimale — principe utilisateur « l'admin peut tout, le marchand n'a que le nécessaire »).
3. **Détection** : 4 règles à **constantes centralisées** (calibrées sur demande), analyse 7 j, **lecture seule** (signalement). Surfaces **marchand** (`/dashboard/security`) **et** **admin** (`/admin`).
4. Logique de décision **pure et testée**. **Aucune migration BDD** (cooldown rangé dans `merchants.segment_config`).

## Périmètre

**Inclus** : clé d'idempotence unique côté scanner ; `scanCooldownSeconds` dans la config marchand (resolve/validate + champ admin) ; garde de cooldown dans la route scan ; moteur de détection pur (`maxInWindow`, `evaluateSignals`) ; couche fetch des signaux ; page marchand `/dashboard/security` + entrée nav ; section admin ; tests.

**Hors périmètre (YAGNI)** : alertes email (→ chantier email), blocage automatique au-delà du cooldown, ML, géoloc IP par pays, persistance des flags (calcul à la volée), réglage des seuils de détection par marchand (constantes globales), cooldown réglable par le marchand lui-même (option future — toggle de délégation).

## 1. Partie 1 — Idempotence corrigée

- **Scanner** (`src/app/scan/page.tsx`) : génère `crypto.randomUUID()` à chaque scan et l'envoie en en-tête `idempotency-key` du POST `/api/scan`.
- **Route scan** : déjà `idempotencyKey = ${user}:${card}:${header||''}` → avec une clé unique, plus de collision entre deux scans distincts ; un renvoi du même scan (même clé) reste dédoublonné. Aucune autre modif d'idempotence.
- Résultat : 2 achats à 2 min d'intervalle = 2 scans = **2 tampons**.

## 2. Partie 2 — Délai minimum par carte (cooldown), réglable admin

- **Config** : ajouter `scanCooldownSeconds` à la config marchand, stocké dans `segment_config.scan_cooldown_seconds` (défaut **30**).
  - `src/lib/merchant-config/types.ts` : `DEFAULT_SCAN_COOLDOWN_SECONDS = 30` ; champ `scanCooldownSeconds` dans `ResolvedMerchantConfig` + `DEFAULT_MERCHANT_CONFIG`.
  - `resolve.ts` : `scanCooldownSeconds: num(sc.scan_cooldown_seconds, DEFAULT_SCAN_COOLDOWN_SECONDS)`.
  - `validate.ts` : entrée `scanCooldownSeconds` optionnelle → défaut 30 si absente ; sinon entier **0–600** (sinon erreur « Délai mini invalide (0 à 600 s) ») ; inclus dans `segmentConfig.scan_cooldown_seconds`.
- **UI admin** : champ « Délai mini entre 2 tampons (s) » dans le formulaire de config marchand (`/admin/merchants/[id]`, `EditMerchantForm`), envoyé avec les autres champs (la route admin PATCH appelle déjà `validateMerchantConfig`).
- **Pur, testé** : `withinCooldown(lastScan, now, cooldownSeconds)` → `boolean` :
  - `cooldownSeconds <= 0` → `false` (désactivé) ; `lastScan` nul → `false` ;
  - sinon `now - lastScan < cooldownSeconds*1000` → `true`.
- **Route scan** : après chargement de la carte (on a `last_scan`) et résolution de la config, si `withinCooldown(card.last_scan, now, cfg.scanCooldownSeconds)` → réponse **429** `{ error: "Carte déjà scannée à l'instant. Patientez quelques secondes.", cooldown: true }` (avant `applyStamp`). Le scanner affiche ce message.

## 3. Partie 3 — Détection anti-fraude

### 3.1 Moteur pur (`src/lib/antifraud/`)
- `maxInWindow(timestamps: number[], windowMs: number)` → nombre max d'évènements dans une fenêtre glissante (timestamps triés en interne).
- `evaluateSignals(input, now)` où `input = { scans: {cardId, at}[], redemptions: {at}[], enrollments: {at}[] }` → `Flag[]`, `Flag = { kind, label, count, threshold, windowLabel, cardId? }`. Règles (constantes dans `config.ts`) :
  1. `scan_burst` — scans (marchand) : `maxInWindow(scanTimes, 5min) > 20`.
  2. `redeem_burst` — encaissements : `maxInWindow(redeemTimes, 10min) > 5`.
  3. `enroll_burst` — inscriptions : `maxInWindow(enrollTimes, 5min) > 15`.
  4. `card_farming` — par carte : pour chaque carte, `maxInWindow(itsScanTimes, 30min) > 4` → un flag par carte concernée.

### 3.2 Couche fetch (`src/lib/antifraud/fetch.ts`, serveur)
- `fetchMerchantFlags(merchantId)` (scopé marchand, via `supabaseAdmin`) : charge 7 j de `scan_history` (`card_id, scanned_at`), `audit_logs` `REWARD_REDEEMED` (`created_at`), `customers` (`created_at`) → `evaluateSignals` → `Flag[]`.
- `fetchAllMerchantsWithFlags()` (admin) : parcourt `merchants`, renvoie `{ merchantId, shopName, flags }[]` filtré sur `flags.length > 0`.

### 3.3 Surface marchand
- **`/dashboard/security`** (server component, scopé marchand) + entrée de nav `Sécurité` (`DashboardShell`) : panneau « Activité inhabituelle (7 derniers jours) » listant les flags (libellé + détail). Vide → « Aucune activité suspecte détectée ✅ ».

### 3.4 Surface admin
- Section dans la page `/admin` : liste des marchands avec ≥ 1 flag (nom + résumé des flags). Vide → « Aucune alerte ✅ ». Lecture seule.

## 4. Validation & sécurité

- Cooldown et config validés par `validateMerchantConfig` (déjà pure/testée) ; modification réservée à l'admin (route `/api/admin/merchants/[id]`, `requireAdminApi`).
- Détection en **lecture seule** ; fetch marchand scopé `merchant_id` (pas de fuite inter-marchand) ; fetch admin via service-role derrière `requireAdminPage`/`requireAdminApi`.
- Le scan reste protégé (auth, rate-limit, signature QR, propriété) ; le cooldown s'ajoute après la propriété, avant l'incrément.

## 5. Tests (TDD)

Pur (`src/lib/**/__tests__/`) :
- `withinCooldown` : `cooldown 0 → false` ; `lastScan null → false` ; scan il y a 10 s avec 30 s → `true` ; il y a 40 s avec 30 s → `false`.
- `maxInWindow` : fenêtre vide → 0 ; tous dans la fenêtre → n ; étalés hors fenêtre → 1 ; rafale au milieu → le pic.
- `evaluateSignals` : chaque règle franchie / non franchie ; `card_farming` ne flague que les cartes au-delà du seuil ; aucun signal → `[]`.
- `validateMerchantConfig` : `scanCooldownSeconds` absent → 30 ; `-1`/`601`/non entier → erreur ; `0` et `45` → OK.
- `resolveMerchantConfig` : lit `scan_cooldown_seconds`, défaut 30.

Routes/UI : `npm run build` + fumée compte démo (régler le délai en admin ; re-scanner une carte < délai → refus ; > délai → tampon ; page Sécurité marchand ; section admin).

## Réutilisation / cohérence

Réutilise la config marchand (`resolve`/`validate`, `segment_config`), `fetchMerchantConfig`, `scan_history`/`audit_logs`/`customers`, le `RedeemCell`/audit existant, `requireAdminApi`/`requireAdminPage`. La règle « faut-il compter / est-ce anormal » devient des fonctions pures testées. Aucune migration BDD (cooldown dans `segment_config`). ⚠️ L'utilisateur retravaille en parallèle le dashboard (refonte « HALO Light ») → privilégier des **fichiers neufs** (lib antifraud, page `/dashboard/security`) et limiter les edits aux points d'ancrage (nav, page admin, formulaire admin).
