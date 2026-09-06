@AGENTS.md

# HaloCard — Guide Claude

> Mis à jour le 2026-09-06. Ce fichier reflète l'état RÉEL du projet —
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
| DB / Auth | **Supabase** (Postgres + Auth + RLS) — ~58 migrations dans `supabase/migrations/` | projet prod « WalletCard » |
| Wallet Apple | `passkit-generator`, web service PassKit + APNs — **prod-ready**, certs valides 06/2027 | clés dans `certs/` (gitignoré) — ne jamais lire leur contenu |
| Wallet Google | émission OK ; **publishing access demandé le 2026-09-05** (dossier en examen, vertical loyalty) | bouton client gaté par `NEXT_PUBLIC_GOOGLE_WALLET_READY` (encore false) |
| Email | Resend **ACTIF en prod** via `src/lib/email/send.ts` (`RESEND_API_KEY` + `EMAIL_FROM` posées) — tout envoi part réellement | consentement client : double opt-in + `consentedRecipients` (seul chemin marketing) |
| App mobile | **`mobile/`** : Expo + React Native (commerçant : Comptoir scan caméra, Clients, Messages, Menu) | auth par jeton Bearer (opt-in par route via `currentAuthSession`), MFA fail-closed ; CI dédiée `mobile-ci.yml` (tsc+eslint+jest) |
| Rate-limit / idempotence | Upstash Redis (`src/lib/rateLimit.ts`) | |
| Monitoring | Sentry scaffoldé (`instrumentation*.ts`, scrub PII) — inerte sans DSN | |
| Déploiement | Vercel, projet `carte-fidelite` — **`main` = production** | domaine halocard.ch (DNS Infomaniak) |
| Tests | Vitest — ~1640 tests colocalisés (`__tests__/`) + ~193 tests jest dans `mobile/` ; e2e Playwright (`e2e/`) ; CI GitHub Actions (piège lock mac→Linux géré, aussi pour `mobile/package-lock.json`) | `npx tsc --noEmit && npm run lint && npx vitest run` avant tout commit (dans `mobile/` : typecheck+lint+jest) |

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
   **Routes ouvertes au jeton Bearer (mobile)** : leurs lectures ne doivent
   JAMAIS passer par `createClient()` (cookie) — sans cookie la RLS rend une
   base vide. Utiliser `currentAuthSession().supabase` (client porteur) ou
   `supabaseAdmin` + `.eq("merchant_id")`.
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

## 6. État & chantiers (2026-09-06)

- **Fait et en prod** : 5 mécaniques de fidélité entièrement configurables au
  Studio (tampons avec bienvenue/intermédiaire, visites, niveaux, points/CHF,
  points fixes + statuts Bronze/Argent/Or à vie + expiration de cycle par cron) ;
  jetons de carte `{points|nom|palier|visites|derniere_visite|progression|statut}`
  avec repli « jamais d'accolades » (registre `KNOWN_TOKENS`) ; chaîne de
  consentement email LPD/RGPD (double opt-in, désinscription, garde-fou
  `consentedRecipients`) ; formulaire `/demarrer` enrichi + email de confirmation ;
  fiche admin GET-then-merge (n'efface plus `loyalty_config`) ; SEO logo/favicon/
  og-image/Search Console ; pages légales complètes (IDE CHE-242.720.495) ;
  app mobile commerçant M1-M4 (voir tableau stack).
- **En attente** : réponse Google publishing access (dossier 05598252) →
  ensuite `NEXT_PUBLIC_GOOGLE_WALLET_READY=true` + redeploy + test Android ;
  polish mobile M5 (PR #87 draft) ; publication App Store (EAS/TestFlight) ;
  Sentry (DSN absent, code prêt) ; vieilles PRs #34-#60 à trier (périmées
  probables).
- **BLOQUANT mobile (hérité de M1, à corriger avant tout usage réel des onglets
  Clients/Messages)** : `loadClassified()` dans `src/lib/segments/fetch.ts` lit
  `customers` et `scan_history` via le client cookie → sous Bearer,
  `GET /api/segments*` renvoie une base VIDE et `POST /api/notifications/send`
  ne joint personne (`pushed: 0`). Preuve : Café du Rhône = 7 clients en base,
  smoke M1 sous Bearer = `total: 0`. Détail dans la PR #85.
- **Limitation documentée** : bannière de notification Apple sur écran
  verrouillé = couche d'affichage Apple, capricieuse (docs/NOTIFICATIONS-WALLET.md)
  — ne jamais promettre sa fiabilité.
