@AGENTS.md

# HaloCard — Guide Claude

> Réécrit le 2026-06-10 (audit 360°). Ce fichier reflète l'état RÉEL du projet —
> ne pas re-scaffolder ce qui existe déjà. Toujours lire AGENTS.md (Next.js modifié :
> consulter `node_modules/next/dist/docs/` avant d'écrire du code Next).

## 1. Le produit

**HaloCard** (marque HALO) : SaaS B2B genevois de cartes de fidélité numériques
Apple Wallet / Google Wallet pour petits commerces. Le client final n'installe
aucune appli. Modèle « concierge » : l'admin (le fondateur) crée les comptes
marchands ; l'inscription publique est désactivée (`/signup` → `/login`).

- **Grille canonique : Essentiel 69 / Croissance 129 / Premium 199 CHF/mois**
  (200 / 750 / 2 000 cartes actives, toutes fonctionnalités incluses, sans setup,
  sans engagement). Ne JAMAIS réintroduire d'autres chiffres.
- **« Carte active » = activité (installation, scan, mise à jour) dans les 90 derniers
  jours** (CGV §1, `BILLING_ACTIVE_DAYS`). Distinct de l'engagement dashboard
  (`INACTIVE_DAYS = 30`).
- Prospection terrain à Genève dès mi-juillet 2026.

## 2. Stack réelle

| Couche | Choix | Notes |
|---|---|---|
| Framework | Next.js 16.2.x App Router (version modifiée — lire AGENTS.md) | route groups `(marketing)` / `(app)` |
| UI | React 19, Tailwind 4, TS strict, framer-motion, lucide | tokens de marque : `docs/brand-guidelines.md`, `assets/design-tokens.css` |
| DB / Auth | **Supabase** (Postgres + Auth + RLS) — ~30 migrations dans `supabase/migrations/` | projet prod « WalletCard » |
| Wallet Apple | `passkit-generator`, web service PassKit + APNs — **prod-ready**, certs valides 06/2027 | clés dans `certs/` (gitignoré) — ne jamais lire leur contenu |
| Wallet Google | émission OK ; **publishing access en attente** (vertical loyalty uniquement) | bouton client gaté par `NEXT_PUBLIC_GOOGLE_WALLET_READY` |
| Email | Resend via `src/lib/email/send.ts` (fetch direct, no-op sans `RESEND_API_KEY`) | |
| Rate-limit / idempotence | Upstash Redis (`src/lib/rateLimit.ts`) | |
| Monitoring | Sentry scaffoldé (`instrumentation*.ts`, scrub PII) — inerte sans DSN | |
| Déploiement | Vercel, projet `carte-fidelite` — **`main` = production** | domaine halocard.ch (DNS Infomaniak) |
| Tests | Vitest — 310 tests colocalisés (`__tests__/`) ; CI GitHub Actions (piège lock mac→Linux géré) | `npx vitest run` avant tout commit |

## 3. Architecture

- `src/proxy.ts` : middleware — routage par hôte (halocard.ch = vitrine,
  app.halocard.ch = app, www → apex en 308) + MFA fail-closed. Logique pure et
  testée dans `src/lib/routing/host.ts`.
- `src/lib/` : 17+ modules métier (wallet, auth, admin, loyalty, campaigns,
  segments, analytics, antifraud, notifications, email, customers, cardDesign,
  merchant-config, geo, routing, monitoring, cron, …).
- Parcours public d'enrôlement : `/c/[slug]` → `POST /api/enroll` (par slug) →
  `GET /api/enroll/[cardId]?s=slug&wallet=apple|google`. **L'`enrollment_token`
  (secret rotatif) ne doit JAMAIS atteindre le navigateur.**
- Funnel marketing : landing `(marketing)/HomeClient.tsx` (+ `page.tsx` server
  pour metadata/JSON-LD), leads via `/demarrer` (Server Action → table `leads`).
- Dashboard marchand : `(app)/dashboard/*` (« Ma carte » = QR d'enrôlement).
  Admin : `(app)/admin/*` (mode concierge, impersonation auditée).

## 4. Invariants — à respecter ABSOLUMENT

1. **Toute nouvelle `AuditAction` exige une migration jumelle de
   `audit_logs_action_check`** — sinon les inserts sont silencieusement rejetés.
   Le test `src/lib/__tests__/auditActionsSync.test.ts` le vérifie ; la liste
   canonique est `AUDIT_ACTIONS` dans `src/lib/auditLog.ts`.
2. **Google Wallet : jamais d'UPDATE/PUT** — un UPDATE efface les champs omis.
   Toujours GET-then-merge ou PATCH (`ensureLoyaltyClass` est le modèle).
3. **Tenancy : 18+ routes API utilisent `supabaseAdmin` (service-role, bypass
   RLS) avec filtre `.eq("merchant_id", …)` manuel.** Tout nouvel endpoint DOIT
   poser ce filtre (résoudre le tenant via `currentMerchantId()` qui gère
   l'impersonation). Un `.eq()` oublié = fuite cross-tenant.
4. **Le scan passe par la RPC atomique `scan_increment`** (FOR UPDATE, cooldown,
   plafond). Ne pas réintroduire de read-modify-write.
5. **Aucun secret en clair** : `certs/`, `.env.local` gitignorés ; référencer les
   chemins, jamais le contenu.
6. **Migrations** : fichiers dans `supabase/migrations/`, application en prod
   via Supabase (avec accord explicite de l'utilisateur). La prod a déjà reçu des
   patchs hors-repo — vérifier l'état réel avant d'affirmer qu'une migration manque.

## 5. Conventions

- TypeScript strict, pas de `any` non justifié ; Server Components par défaut,
  `"use client"` seulement si état/effet.
- Conventional Commits FR (`feat(scope): …`, `fix: …`) ; branches `feat/...`,
  `fix/...` ; ne jamais committer directement sur `main` (= prod Vercel).
- Tests Vitest colocalisés ; logique pure extraite dans `src/lib/` pour être
  testable sans réseau.
- Copy produit en français suisse (vouvoiement, ton direct artisan, pas de
  jargon SaaS) ; marque HALO/HaloCard, jamais « WalletCard » (ancien nom).

## 6. État & chantiers (2026-06-10)

- Audit 360° complet : `~/Projects/HALO/_audit-360/` (17 rapports + synthèse).
- Faits ce jour : grille 69/129/199 partout, hygiène sécu (CHECK audit, UNIQUE
  cartes, Next 16.2.9, token hors client), Google Wallet gaté + classe garantie,
  funnel `/demarrer` + SEO (robots/sitemap/canonical/308), fondation billing
  (`merchants.plan`, vue `billing_active_cards`, `billing_snapshots` + cron
  mensuel), page « Ma carte », email de bienvenue marchand branché.
- En attente : clés Resend/Sentry (codes prêts, inertes), publishing access
  Google, application des migrations 20260610_* en prod, jauge « cartes
  actives / palier » dans le dashboard, app mobile marchande (après le reste).
