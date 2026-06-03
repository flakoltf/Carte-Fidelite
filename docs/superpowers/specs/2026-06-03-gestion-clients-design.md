# Gestion clients complète — Design

**Date :** 2026-06-03
**Statut :** Validé (brainstorming)
**Brique suivante :** plan d'implémentation (`writing-plans`)
**Contexte :** l'onglet Clients est à moitié fait. La barre de recherche et le bouton Filtre sont décoratifs (aucune logique), l'édition d'un client n'existe pas (ni UI ni endpoint), et la suppression a son API RGPD (`DELETE /api/customers/[id]`, avec audit) mais aucun bouton. On câble le tout pour en faire un vrai écran de gestion.

## Objectif

Donner au marchand une gestion clients fonctionnelle dans l'onglet existant : **rechercher/filtrer** sa base, **modifier** les coordonnées d'un client (nom, email, téléphone), et **supprimer** un client (droit à l'oubli) — sans quitter la page.

## Décisions validées (brainstorming)

1. **Recherche** instantanée côté client (nom + email + téléphone), sur la liste déjà chargée.
2. **Filtre statut** simple : Tous / Carte pleine / Sans carte (on garde le bouton Filtre).
3. **Édition** des champs **nom, email, téléphone** uniquement (pas les tampons — ça passe par scan/encaissement), via une **modale**.
4. **Suppression** : réutilise l'API RGPD existante + **confirmation**.
5. Logique de validation **pure et testée** ; nouvelle action d'audit `CUSTOMER_UPDATED`.

## Périmètre

**Inclus** : refonte de la table Clients en composant client (recherche + filtre), modale d'édition, endpoint `PATCH /api/customers/[id]`, validation pure `validateCustomerUpdate`, bouton Supprimer (réutilise le DELETE existant), action d'audit `CUSTOMER_UPDATED`, tests.

**Hors périmètre (YAGNI)** : actions groupées, import CSV, page fiche-client détaillée, édition directe des tampons/cartes, export (déjà couvert ailleurs), pagination/recherche serveur (la base d'un marchand tient en mémoire).

## 1. Architecture

- **`src/app/dashboard/customers/page.tsx`** (reste serveur) : récupère marchand + `stampGoal` + clients (avec `id, stamps_count` de carte), puis rend `<CustomersTable customers={...} stampGoal={...} />`. Plus de markup de table inline.
- **`src/app/dashboard/customers/CustomersTable.tsx`** (NEW, client) : reçoit la liste en props ; tient l'état `query` (recherche) et `statusFilter` (`all`|`full`|`nocard`) ; filtre la liste en mémoire ; rend l'en-tête (recherche + menu filtre) et les lignes. Chaque ligne → actions : **Modifier** (ouvre la modale), **`RedeemCell`** (existant, si carte pleine), **Supprimer** (confirmation → `DELETE`). Après édition/suppression → `router.refresh()`.
- **`src/app/dashboard/customers/EditCustomerModal.tsx`** (NEW, client) : formulaire (nom, email, téléphone) pré-rempli ; `PATCH /api/customers/[id]` ; gère les erreurs (400 validation, 409 email déjà pris).
- **`src/lib/customers/validate.ts`** (NEW, pur, testé) : `validateCustomerUpdate`.
- **`src/app/api/customers/[id]/route.ts`** (MODIFY) : ajoute `PATCH`. Le `DELETE` reste inchangé.
- **`src/lib/auditLog.ts`** (MODIFY) : ajoute `'CUSTOMER_UPDATED'` à `AuditAction`.

## 2. Recherche & filtre (pur côté client)

- **Recherche** : `query` minusculée comparée à `full_name`, `email`, `phone` (insensible à la casse). Vide → tout.
- **Filtre statut** : `all` (tout) ; `full` (carte dont `stamps_count >= stampGoal`) ; `nocard` (aucune `loyalty_cards`).
- Les deux se combinent (ET). Aucun appel réseau — filtrage en mémoire sur la liste fournie.
- Une fonction pure `filterCustomers(customers, query, statusFilter, stampGoal)` peut porter cette logique (optionnel ; si triviale, inline dans le composant). **Choix : extraire et tester** la règle (utile et peu coûteux).

## 3. Édition — `PATCH /api/customers/[id]`

Corps `{ fullName?, email?, phone? }` (mise à jour partielle) :
- Auth marchand (`getSession` → 401) ; `id` UUID valide (400) ; rate-limit `customer-update:<userId>` (ex. 30/h).
- Propriété : le client doit appartenir au marchand (404 sinon).
- `validateCustomerUpdate(body)` → 400 avec message si invalide.
- `update` des seuls champs fournis. **Unicité email** `(merchant_id, email)` : en cas de violation (code Postgres `23505`), renvoyer `409 { error: "Email déjà utilisé par un autre client" }`.
- Audit `CUSTOMER_UPDATED` (`merchant_id`, `user_id`, `details: { customer_id, fields }`).
- Réponse `{ success: true }`.

## 4. Validation pure — `validateCustomerUpdate`

`validateCustomerUpdate(input)` → `{ ok: true, value } | { ok: false, error }` :
- Au moins un champ présent, sinon `"Aucune modification"`.
- `fullName` si présent : string, trim, 2–100 caractères, lettres (accents inclus) / espaces / `'` / `-` → sinon `"Nom invalide"`. (`/^[\p{L}\s'-]{2,100}$/u`)
- `email` si présent : string, trim, minuscule, `EMAIL_RE` (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`), ≤ 254 → sinon `"Email invalide"`.
- `phone` si présent : string, trim ; vide → `null` (efface) ; sinon chiffres/`+`/espaces/`-`/`()`, longueur 4–30 → sinon `"Téléphone invalide"`. (`/^[0-9+()\s-]{4,30}$/`)
- `value` ne contient que les champs fournis (normalisés).

## 5. Suppression

Réutilise `DELETE /api/customers/[id]` (existant : auth, propriété, rate-limit 20/h, audit `CUSTOMER_DELETED` RGPD, CASCADE). L'UI ajoute un bouton **Supprimer** avec `window.confirm("Supprimer définitivement {nom} et toutes ses données ?")`. Après succès → `router.refresh()`.

## 6. Validation & sécurité

- PATCH et DELETE : auth marchand + propriété vérifiées côté serveur (pas d'accès croisé). `supabaseAdmin` côté serveur.
- Validation stricte (`validateCustomerUpdate`) ; unicité email → 409 propre.
- Audit `CUSTOMER_UPDATED` (édition) et `CUSTOMER_DELETED` (suppression, existant).

## 7. Tests (TDD)

Logique pure (`src/lib/customers/__tests__/`) :
- `validateCustomerUpdate` : aucun champ (→ erreur) ; nom trop court / invalide / valide (accents) ; email invalide / valide ; téléphone vide (→ null) / invalide / valide ; mise à jour partielle (un seul champ).
- `filterCustomers` : recherche par nom/email/téléphone (casse) ; filtre `full` (selon `stampGoal`) ; filtre `nocard` ; combinaison recherche+filtre ; liste vide.

UI + endpoint : vérifiés par `npm run build` + fumée sur le compte démo (rechercher, filtrer « Carte pleine », modifier un client, tenter un email déjà pris → 409, supprimer avec confirmation).

## Réutilisation / cohérence

Réutilise `RedeemCell` (encaissement), le `DELETE` RGPD existant, `EMAIL_RE` (même règle que l'enrôlement), `logAuditEvent`, `rateLimit`, `currentMerchantId`/scoping marchand. La table devient un composant client unique et focalisé ; la page serveur ne fait plus que charger les données. Aucune migration BDD (colonnes `full_name`, `email`, `phone` déjà présentes depuis `20240417_init.sql`).
