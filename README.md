# HaloCard

SaaS suisse de **cartes de fidélité dématérialisées** (Apple Wallet + Google Wallet)
pour commerçants, en abonnement mensuel. Next.js 16 (App Router) + Supabase, déployé
sur Vercel.

> ⚠️ **Next.js 16** comporte des breaking changes. Lire `node_modules/next/dist/docs/`
> avant d'écrire du code Next.js (le middleware s'appelle désormais `proxy.ts`).

## Architecture

Un seul repo, un seul déploiement Vercel, **deux surfaces** séparées par sous-domaine.

| Surface | Domaine | Route group | Auth |
|---|---|---|---|
| Vitrine publique (SEO) | `halocard.ch` / `www.halocard.ch` | `src/app/(marketing)/` | non |
| Application commerçant | `app.halocard.ch` | `src/app/(app)/` | oui |
| Enrôlement client final | toutes (public) | `src/app/c/[slug]/` | non |

- Les **route groups** `(marketing)` / `(app)` organisent le code **sans changer les URLs**.
- Le routing par sous-domaine est dans **`src/proxy.ts`**, logique pure et testée dans
  **`src/lib/routing/host.ts`** (tests : `src/lib/routing/__tests__/host.test.ts`) :
  - `halocard.ch` + route d'app → redirige vers `app.halocard.ch`
  - `app.halocard.ch/` → redirige vers `/dashboard`
  - **`/api/*` n'est jamais redirigé** (webhooks Apple/Google), ni en dev/preview (`*.vercel.app`, `localhost`).

### Enrôlement client (`/c/[slug]`)
Page publique « Ajouter au Wallet » identifiée par le **slug** lisible du commerçant
(ex. `/c/boulangerie-martin`). L'ancienne URL `/enroll/[token]` (UUID du QR) redirige
en 308 vers `/c/[slug]`. L'`enrollment_token` reste l'identifiant soumis au backend
(rate-limiting et logique d'enrôlement inchangés).

### Wallet
- La `webServiceURL` des passes Apple est construite depuis **`NEXT_PUBLIC_BASE_URL`**
  (host permanent — `https://app.halocard.ch` en prod). **Ne pas la changer** une fois
  de vrais passes émis : elle est gravée dans chaque pass.
- Routes wallet sous `src/app/api/wallet/*`, appelées par les serveurs Apple/Google
  (exclues du proxy).

## Modèle de sécurité multi-tenant

- Chaque commerçant = un **tenant**. Les tables portent `merchant_id`.
- **RLS activée** sur toutes les tables ; bucket Storage `card-assets` **privé** + RLS.
- ⚠️ L'app accède aux données via **deux clients** :
  - `@/utils/supabase/server` (clé anon + session) → **respecte la RLS** (auth, rôle).
  - `@/lib/supabaseAdmin` (service role) → **bypass la RLS** (opérations serveur).
- Comme le service role bypass la RLS, **l'isolation primaire entre commerçants se fait
  par filtrage `merchant_id` en code**, via le helper centralisé
  **`currentMerchantId()`** (`@/lib/analytics/merchant`). La RLS est une défense en
  profondeur. **Toute requête `supabaseAdmin` sur des données tenant DOIT scoper par
  `merchant_id` (ou `id` du marchand courant).**
- Rôles `admin` / `merchant` (colonne `merchants.role`). L'espace admin est une route
  protégée **dans `(app)`** (`/admin`, `/api/admin/*`) via `requireAdminApi` /
  `requireAdminPage` (`@/lib/adminAuth`) — pas de sous-domaine séparé.

## Configuration

Toutes les variables sont documentées dans **`.env.example`**. Copier en `.env.local`
pour le dev ; définir sur **Vercel** pour les déploiements. `.env.local` et `certs/`
sont gitignored — **aucun secret n'est committé**.

## Développement

```bash
npm install
cp .env.example .env.local   # puis renseigner les valeurs
npm run dev                  # http://localhost:3000 (pas de filtrage sous-domaine en local)
npm test                     # Vitest
npm run build                # build de production
```

## Déploiement (Vercel)

```bash
vercel deploy --prod --yes   # build avec les variables d'env de production
```
Migrations DB dans `supabase/migrations/` (à appliquer sur le projet Supabase `WalletCard`).
