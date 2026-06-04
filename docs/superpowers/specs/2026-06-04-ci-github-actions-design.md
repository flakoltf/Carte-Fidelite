# CI GitHub Actions — Spec de conception

**Date :** 2026-06-04
**Branche cible :** `feat/public-enrollment`
**Méthode :** brainstorming ✅ (design approuvé) → writing-plans → exécution

## Objectif

Mettre en place une **CI GitHub Actions** qui valide chaque PR et chaque push de `feat/public-enrollment`/`main` via **lint + typecheck + tests + build**, et amener le repo à un état **lint/type propre** pour que le gate soit **vert** dès le premier run.

## Décisions (validées avec l'utilisateur)

- Étapes : **Lint + Tests + Build** (+ typecheck strict).
- Déclencheurs : **PR + push sur `feat/public-enrollment` & `main`**.
- Les 2 erreurs `tsc` pré-existantes : **corrigées** + étape `tsc --noEmit` ajoutée.
- Les 17 erreurs lint pré-existantes : **toutes corrigées** (gate strict).

## Composant 1 — `.github/workflows/ci.yml`

Un seul job `ci` sur `ubuntu-latest` :

- **Déclencheurs** :
  - `push` : branches `feat/public-enrollment`, `main`.
  - `pull_request` (toutes).
- **`concurrency`** : groupe par workflow+ref, `cancel-in-progress: true` (annule les runs obsolètes).
- **Étapes** :
  1. `actions/checkout@v4`
  2. `actions/setup-node@v4` — `node-version: 22`, `cache: npm`.
  3. `npm ci`
  4. `npm run lint`
  5. `npx tsc --noEmit`
  6. `npm run test` (Vitest — 181 tests ; env factices via `vitest.config.ts`)
  7. `npm run build` — avec **bloc `env:` de valeurs factices** (cf. composant 2).

> Node 22 (Next 16 compatible). Pas de matrix, pas de déploiement, pas de couverture (hors scope).

## Composant 2 — Env factices pour le build

Les clients sont instanciés **au scope module** et **jettent si la var manque** (`supabaseAdmin`, `redis`, `qrSignature`). Le build ne fait que **construire** ces clients, il ne les **appelle** jamais → des valeurs factices **non-secrètes** suffisent et le build ne les utilise pas réellement :

```yaml
env:
  NEXT_PUBLIC_SUPABASE_URL: https://example.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ci-dummy-anon-key
  SUPABASE_SERVICE_ROLE_KEY: ci-dummy-service-key
  UPSTASH_REDIS_REST_URL: https://example.upstash.io
  UPSTASH_REDIS_REST_TOKEN: ci-dummy-token
  QR_SIGNATURE_SECRET: ci-dummy-qr-secret
```

> Aucune vraie clé en CI : le build n'exécute aucune requête réseau vers Supabase/Upstash. Les certs Apple/Google sont lus **lazy** (jamais au build) → non bloquants.

## Composant 3 — Mise au propre du repo (gate vert)

### 3a. Typecheck — `src/lib/wallet/passJson.ts`
Le type de retour de `buildPassJson` ne déclare que `storeCard.backFields`, alors que l'objet réel contient aussi `primaryFields`/`secondaryFields` (le test y accède → 2 erreurs `tsc`). **Fix** : compléter l'annotation de type pour inclure `primaryFields` et `secondaryFields`.

### 3b. ESLint config — ignorer les scripts Node
`scripts/bootstrap_class.js` + `scripts/generate_qr.js` utilisent `require()` (légitime pour des scripts Node) → **9 erreurs** `no-require-imports`. **Fix** : ajouter `scripts/**` aux `ignores` de la config ESLint. + `argsIgnorePattern`/`varsIgnorePattern: '^_'` pour les paramètres préfixés `_` (vars `_range`).

### 3c. Corrections de code app (erreurs)
- **6× `react/no-unescaped-entities`** (apostrophes) : `EditMerchantForm.tsx:189`, `dashboard/generate/page.tsx:50,76`, `dashboard/page.tsx:15`, `page.tsx:295,313` → échapper `'` en `&apos;` (ou `&rsquo;` pour les apostrophes typographiques).
- **2× `@typescript-eslint/no-explicit-any`** : `dashboard/generate/page.tsx:36`, `scan/page.tsx:11` → remplacer `any` par un type approprié (`unknown` + garde, ou type précis).

### 3d. Warnings (nettoyés aussi — « rien en suspens »)
- `dashboard/generate/page.tsx` : retirer l'import inutilisé `AnimatePresence` (l.5) et le param inutilisé `e` (l.36).
- `dashboard/settings/page.tsx:30` `exhaustive-deps` : stabiliser `fetchMerchant` (`useCallback`) et l'ajouter aux deps, OU `eslint-disable-next-line` justifié si risque de boucle.
- `dashboard/settings/page.tsx:228` `no-img-element` : remplacer `<img>` par `next/image`, OU `eslint-disable-next-line` justifié si l'URL est dynamique/externe non configurée.
- `_range` (retention.ts:16, walletMix.ts:17) : couverts par `argsIgnorePattern: '^_'` (3b).

## Vérification (avant push)
`npm run lint` (0 erreur, 0 warning), `npx tsc --noEmit` (0), `npm run test` (181 ✅), `npm run build` avec env factices (compile). Puis push → confirmer le run Actions **vert** (via `gh run watch`/`gh run list`).

## Hors scope
Matrix multi-OS/Node, étape de déploiement Vercel, upload de couverture, `.nvmrc`, badge README.
