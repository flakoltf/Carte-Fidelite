# Spec — Mode concierge super-admin par impersonation (Phase 1)

**Date** : 2026-06-04
**Statut** : validé (brainstorming), à implémenter
**Branche** : `feat/admin-concierge`

## 1. Objectif

Donner au super-admin un **mode « concierge / gestion déléguée »** : il bascule dans le
contexte d'un commerçant et **réutilise les mêmes écrans de gestion** que le commerçant
(campagnes, clients, segments, notifications, sécurité, génération de carte), avec une
**bannière persistante** et une **traçabilité d'audit** complète.

Beaucoup de commerçants ne veulent rien gérer eux-mêmes : le super-admin doit pouvoir
tout faire **à leur place**, sans dupliquer les écrans de gestion.

## 2. Principe directeur

L'application détermine « quel commerçant suis-je » via **une seule fonction** :
`currentMerchantId()` (`src/lib/analytics/merchant.ts`), qui mappe `auth.user.id →
merchants.user_id`. Presque tous les écrans et toutes les API passent par elle, et les
requêtes filtrent déjà par `merchant_id` **explicite**.

→ **On détourne ce point unique** : quand un super-admin impersonne, `currentMerchantId()`
renvoie le marchand ciblé. Tout le reste suit automatiquement. **Zéro duplication d'écran.**

## 3. Périmètre

### Dans la Phase 1
- Drapeau « mode de gestion » par commerçant (étiquette : *géré par lui* / *géré par nous*).
- Bascule d'impersonation (start/stop) via cookie sécurisé.
- Bannière persistante « Tu agis en tant que X — Quitter ».
- Audit de l'impersonation (start/stop + marquage des actions).
- Garde-fous sécurité (cookie signé, double vérrou rôle admin, correctif RLS campaigns).
- Adaptation des 2 écrans qui s'authentifient côté navigateur (`/settings`, `/generate`).

### Hors Phase 1 (phases suivantes)
- Dashboard global plateforme (KPIs cross-marchands).
- Modèles de campagnes réutilisables + actions groupées.
- Nouvelle UI d'édition des règles de fidélité (n'existe nulle part aujourd'hui).

## 4. Décision produit (validée)
Le drapeau « géré par nous » est **une simple étiquette** : le commerçant **garde son accès
complet** ; le drapeau sert à l'organisation côté admin (filtre/recherche) et n'empêche
jamais le commerçant d'agir. Le super-admin peut impersonner quand il veut, indépendamment.

## 5. Architecture & composants

### 5.1 Drapeau « mode de gestion »
- **Migration SQL** : `ALTER TABLE merchants ADD COLUMN managed_by_concierge BOOLEAN NOT NULL DEFAULT false;`
- **UI admin** : badge « ● géré par nous » + interrupteur + filtre dans la liste marchands
  (`src/app/admin/merchants/page.tsx` + composant client pour le toggle).
- **API** : `PATCH /api/admin/merchants/[id]` (route existante) étendue, ou
  `POST /api/admin/merchants/[id]/management-mode` — vérifie `requireAdminApi()`, met à jour
  la colonne, log `MERCHANT_UPDATED`.

### 5.2 Contexte d'impersonation (cookie sécurisé)
- **Nouveau module** `src/lib/admin/impersonation.ts` :
  - `signImpersonationToken(merchantId): string` et `verifyImpersonationToken(token): string | null`
    — HMAC avec un secret serveur (`IMPERSONATION_SECRET` ou réutilise un secret existant).
  - `readImpersonationCookie(): string | null` — lit + vérifie le cookie.
  - `resolveEffectiveMerchantId(args): string | null` — **fonction pure** décidant le marchand
    effectif à partir de `{ sessionUserId, sessionRole, ownMerchantId, impersonatedMerchantId,
    impersonatedExists }`. Règles :
    - admin + cookie valide + marchand existe → `impersonatedMerchantId`
    - sinon (non-admin, pas de cookie, marchand inexistant) → `ownMerchantId`
- **Cookie** : `imp_mid`, **HttpOnly + Secure + SameSite=Lax + signé**.
- **Modif de `currentMerchantId()`** : après avoir résolu la session, appelle
  `resolveEffectiveMerchantId(...)` pour renvoyer le marchand effectif. Idem pour les rares
  endroits qui re-mappent `user_id → merchant` directement (à recenser et faire passer par
  un helper commun `effectiveMerchantId()`).

### 5.3 Bascule start/stop
- `POST /api/admin/impersonate/start` (body `{ merchantId }`) : `requireAdminApi()` →
  vérifie que le marchand existe (service-role) → pose le cookie signé → log
  `ADMIN_IMPERSONATION_START` → renvoie OK (le client redirige vers `/dashboard`).
- `POST /api/admin/impersonate/stop` : efface le cookie → log `ADMIN_IMPERSONATION_STOP` →
  OK (redirection `/admin`).
- **Bouton** « Gérer en tant que [X] » sur la liste/fiche marchand admin.

### 5.4 Ouverture du dashboard aux admins impersonnant
- `src/app/dashboard/layout.tsx` redirige aujourd'hui les admins vers `/admin`. → Modifié :
  un admin **avec impersonation active** est autorisé sur `/dashboard`. Un admin sans
  impersonation reste redirigé vers `/admin`.

### 5.5 Bannière persistante
- Composant serveur `ImpersonationBanner` rendu dans le shell dashboard : si impersonation
  active, affiche « ⚠️ Tu agis en tant que **{shop_name}** — [Quitter] » (le bouton appelle
  `/api/admin/impersonate/stop`). Toujours visible, en haut.

### 5.6 Audit
- **Migration** : ajouter `ADMIN_IMPERSONATION_START`, `ADMIN_IMPERSONATION_STOP` à la
  contrainte CHECK de `audit_logs.action`, et au type `AuditAction` (`src/lib/auditLog.ts`).
- Comme `currentMerchantId()` renvoie le marchand ciblé mais que `user_id` loggé reste celui
  de l'admin, **chaque action en impersonation est déjà attribuée « admin → marchand Y »**.
  On ajoute un marqueur `details.impersonation = true` aux écritures faites en contexte
  impersonné (via un petit helper qui enrichit `logAuditEvent`).

### 5.7 Sécurité / garde-fous
- Cookie **signé (HMAC)** → infalsifiable ; **HttpOnly** → inaccessible au JS client.
- **Double vérrou** : `resolveEffectiveMerchantId` n'honore le cookie **que si la session est
  admin**. Un commerçant qui forgerait le cookie n'obtient rien.
- Le start exige `requireAdminApi()` (403 sinon).
- **Correctif RLS** : migration ajoutant `OR is_admin()` à la policy SELECT de `campaigns`
  (trou identifié dans `20260603_campaigns.sql`).
- Pas de changement aux confirmations d'actions sensibles en Phase 1 (la bannière assure la
  conscience permanente du contexte).

### 5.8 Écrans côté navigateur à adapter
- `/dashboard/settings` et `/dashboard/generate` chargent le marchand via le client Supabase
  navigateur (`auth.getUser() → merchants.user_id`), ce qui prendrait le compte admin.
- **Correctif** : nouvelle API serveur `GET /api/merchant/me` qui renvoie le marchand
  **effectif** (via `currentMerchantId()`, donc respecte l'impersonation). Ces 2 écrans
  lisent leur marchand via cette API au lieu du client Supabase. **Aucun changement visuel.**

## 6. Flux de données (résumé)

```
Admin (liste marchands) ──"Gérer en tant que X"──▶ POST /impersonate/start
   → cookie imp_mid signé posé + audit START
   → redirige /dashboard
Toute page/API du dashboard ──▶ currentMerchantId()
   → resolveEffectiveMerchantId(admin + cookie) = X
   → écrans existants affichent les données de X
   → écritures (campagne, redeem…) scopées à X via les chemins service-role existants
   → audit : user_id=admin, merchant_id=X, details.impersonation=true
Bannière "Tu agis en tant que X — Quitter" visible en permanence
   "Quitter" ──▶ POST /impersonate/stop → cookie effacé + audit STOP → /admin
```

## 7. Tests (TDD Vitest)
- `resolveEffectiveMerchantId` : table de cas (admin+cookie+existe → X ; non-admin+cookie →
  soi ; admin sans cookie → soi ; cookie marchand inexistant → soi).
- `signImpersonationToken` / `verifyImpersonationToken` : round-trip OK ; token trafiqué →
  null ; mauvais secret → null.
- API `start`/`stop` : refus non-admin (403), pose/efface le cookie, log les events.
- API `management-mode` : refus non-admin, met à jour le drapeau, log.

## 8. Gestion d'erreurs
- Marchand ciblé inexistant à `start` → 404, pas de cookie posé.
- Cookie présent mais invalide/expiré → ignoré silencieusement (retour au marchand propre).
- `logAuditEvent` qui échoue → ne casse jamais l'action principale (déjà le comportement).

## 9. Conventions
- Suivre les patterns existants : `requireAdminApi`/`requireAdminPage`, `supabaseAdmin` pour
  les écritures, `currentMerchantId()` comme point d'entrée, `logAuditEvent` pour l'audit.
- Réutiliser les composants commerçant tels quels ; **ne pas toucher leur style** (le design
  agent travaille en parallèle sur l'apparence).
