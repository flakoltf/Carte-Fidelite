@AGENTS.md

# Carte-Fidélité — Guide Claude

> Ce fichier complète AGENTS.md. Toujours lire les deux avant tout changement de code.

## 1. Vision produit

**Carte-Fidélité** est un SaaS B2B qui permet à des **petits commerces** (boulangeries, salons, restaurants, cafés, etc.) de proposer à leurs clients une **carte de fidélité 100% numérique** qui s'ajoute directement aux portefeuilles mobiles : Apple Wallet, Google Wallet, et idéalement Samsung Wallet.

### Promesse produit
- Plus de cartes en carton oubliées ou perdues
- Le commerçant suit l'engagement de ses clients en temps réel
- Communication marketing directe via les push notifications wallet
- Hébergement et données en Europe (cible : Infomaniak / Suisse) — argument RGPD fort

### Acteurs
- Client payant = le commerçant. S'inscrit, configure son programme, paie un abonnement.
- Utilisateur final = le client du commerçant. Scanne un QR ou clique un lien, reçoit sa carte dans son wallet, accumule des récompenses.

### Différenciateur clé
La mécanique de fidélité est configurable par commerçant : tampons, points, paliers/tiers, cashback, ou modèles custom. La plupart des concurrents imposent un seul modèle.

## 2. État actuel du code

### Implémenté
- Next.js 16 + App Router + Tailwind 4 + TypeScript strict
- POC génération Google Wallet (route src/app/api/generate-google-pass/route.ts)
- POC génération Apple Wallet (route src/app/api/generate-apple-pass/route.ts)
- Page de test (src/app/page.tsx) : génère une carte Google Wallet pour un client de test, affiche le QR
- Script scripts/bootstrap_class.js : crée la loyaltyclass Google (template du programme)
- Script scripts/generate_qr.js : génère un JWT signé + QR dans le terminal pour test rapide
- Authentification Google API via service account (certs/credentials.json)

### À construire
- Base de données multi-tenant (merchants, customers, loyalty_programs, loyalty_cards, transactions)
- Authentification merchant (NextAuth / Clerk / Supabase Auth — à arbitrer)
- Dashboard merchant : création de programme, vue clients, statistiques
- Onboarding merchant complet
- Mise à jour live des passes (Apple Push Notification + Google Wallet API update)
- Vraie mécanique multi-modèles (le code actuel hardcode "tampons")
- Apple Wallet : certificats merchant-specific (actuellement non finalisé)
- Billing / abonnements (Stripe pressenti)
- Tests automatisés (Vitest + Playwright)
- CI/CD (GitHub Actions)

## 3. Stack technique

| Couche | Choix actuel | Notes |
|---|---|---|
| Framework | Next.js 16.2.x (App Router) | Breaking changes, voir AGENTS.md |
| UI | React 19, Tailwind CSS 4, TypeScript strict | |
| Apple Wallet | passkit-generator ^3.5 | génère .pkpass |
| Google Wallet | googleapis (scope wallet_object.issuer) | |
| Signature | jsonwebtoken (RS256) | save-to-wallet URLs |
| Hébergement cible | Infomaniak (Suisse) | à confirmer |
| Base de données | NON CHOISIE — recommandation : PostgreSQL | non intégré |
| ORM | NON CHOISI — recommandation : Drizzle ou Prisma | non intégré |
| Auth | NON CHOISIE | non intégré |

## 4. Architecture cible (multi-tenant SaaS)

### Modèle de données prévisionnel

merchants
- id, slug, name, owner_email, plan, created_at
- apple_pass_type_id, apple_team_id (clés/certs hors DB)
- google_issuer_id, google_class_id_prefix

loyalty_programs
- id, merchant_id, name
- mechanic (enum : stamps | points | tiers | cashback | custom)
- config (jsonb : règles spécifiques à la mécanique)
- created_at, archived_at

customers
- id, merchant_id, email, phone, first_name, last_name
- consent_marketing_at, created_at

loyalty_cards
- id, customer_id, program_id, status (active | archived)
- apple_serial_number, google_object_id
- current_value (jsonb — ex : {stamps: 8} ou {points: 1240})
- issued_at, last_updated_at

transactions
- id, card_id, type (earn | redeem | adjust)
- amount (jsonb), performed_by, note, created_at

### Routing prévu

- `/` — landing page commerciale
- `/login`, `/signup` — auth merchant
- `/dashboard` — espace merchant connecté
  - `/programs` — CRUD programmes de fidélité
  - `/customers` — liste & détail clients
  - `/transactions` — historique
  - `/settings` — branding, certificats wallet
- `/c/[merchant-slug]` — page publique d'un commerçant (récup de carte)
- `/api/auth/*` — auth merchant
- `/api/cards/[id]/issue` — génération wallet pass
- `/api/cards/[id]/update` — push update aux wallets
- `/api/webhooks/stripe` — billing

## 5. Mécaniques de fidélité supportées

Chaque programme = UNE mécanique. Stockée dans loyalty_programs.config (jsonb).

| Mécanique | Config typique |
|---|---|
| stamps | { required: 10, reward: "Café offert" } |
| points | { points_per_euro: 1, redemptions: [...] } |
| tiers | { tiers: [{ name, min }, ...] } |
| cashback | { percent: 5, payout: "monthly" } |
| custom | format ouvert, validé par schéma applicatif |

## 6. Variables d'environnement

À documenter dans .env.example. Liste cible :

- GOOGLE_ISSUER_ID
- GOOGLE_CREDENTIALS_PATH
- APPLE_PASS_TYPE_ID
- APPLE_TEAM_ID
- APPLE_CERT_PATH
- APPLE_KEY_PATH
- APPLE_KEY_PASSPHRASE
- APPLE_WWDR_PATH
- DATABASE_URL
- NEXTAUTH_SECRET (>= 32 chars)
- NEXTAUTH_URL
- JWT_SECRET (>= 32 chars)
- NEXT_PUBLIC_APP_URL

`.env.local` est gitignored. `certs/` est gitignored. Aucun secret n'est jamais committé.

## 7. Conventions

### Code
- TypeScript strict — pas de `any` sans justification commentée
- Tailwind utility-first — globals.css réservé aux bases
- Composants : src/components/<nom>.tsx, default export, "use client" uniquement si état/effet
- Server Actions privilégiées sur le client fetch pour les mutations
- Naming : dossiers kebab-case, composants PascalCase, variables/fonctions camelCase, constantes UPPER_SNAKE

### Git
- Branche par défaut : main (à protéger une fois la CI en place)
- Branches de travail : feat/..., fix/..., chore/..., refactor/..., docs/...
- Conventional Commits : `feat: add merchant signup`, `fix(api): handle expired pass`, etc.
- 1 PR = 1 sujet cohérent

### Sécurité
- Aucun secret dans le code, ni dans Git
- certs/ (clés Apple, credentials Google) : gitignored
- Secrets >= 32 chars random
- HTTPS obligatoire en prod, redirection forcée
- RGPD : consentement explicite, droit à l'effacement, données EU/CH

## 8. Pièges connus

### Next.js 16
- Breaking changes par rapport aux versions précédentes — voir AGENTS.md
- Toujours consulter node_modules/next/dist/docs/ AVANT d'écrire du code Next.js
- Les patterns trouvés sur les blogs/StackOverflow peuvent être obsolètes

### Wallets
- Apple Wallet — la clé privée (signerKey.pem) ne sort JAMAIS du serveur
- Google Wallet — les classes reviewStatus DRAFT ne sont visibles que par l'issuer
- Mise à jour des passes — il faut un push (APN pour Apple, API call pour Google)
- Signature — toute modification du payload casse la signature

### Multi-tenancy à venir
- Le code actuel hardcode "Letaief Solution" (issuerName Google) et "BCR2DN5T43NMPIAR" (issuerId)
- Lors de la migration, ces valeurs doivent venir de merchants.google_issuer_id et merchants.name
- Chaque merchant aura sa propre loyaltyclass Google par programme

## 9. Checklist avant tout commit

1. AGENTS.md relu (rappel Next.js 16)
2. Aucun `any` non justifié
3. Aucun secret hardcodé
4. Server Component par défaut — "use client" seulement si état/effet
5. Conventional Commits pour le message suggéré

## 10. Roadmap (priorités court terme)

1. Choisir DB + ORM (recommandation : PostgreSQL + Drizzle)
2. Schéma initial : merchants, loyalty_programs, customers, loyalty_cards, transactions
3. Authentification merchant
4. Refactor des API routes existantes pour s'appuyer sur la DB
5. Dashboard merchant minimal
6. Mise à jour live des passes (push APN + Google Wallet API)
7. Stripe / billing
8. Tests automatisés + CI GitHub Actions
9. Déploiement Infomaniak
10. Onboarding merchant + landing page commerciale

## 11. Mémoire & travail multi-machine

> Objectif : repartir instantanément sur n'importe quelle machine (Mac, Windows) sans tout réexpliquer à l'agent.

**Principe :** tout ce que l'agent doit « se rappeler » vit **dans le dépôt git** (synchronisé entre machines via `pull`/`push`). Les réglages locaux (`~/.claude/`, auth MCP) ne suivent PAS d'une machine à l'autre.

**Les 3 supports de mémoire :**
1. **`CLAUDE.md`** (ce fichier) — savoir durable : vision, archi, conventions, décisions.
2. **`docs/JOURNAL.md`** — journal de bord : ce qui a été fait + prochaines étapes, une entrée par session (la plus récente en haut).
3. **Hook `SessionStart`** (`.claude/hooks/session-context.mjs`, déclaré dans `.claude/settings.json`) — au démarrage de chaque session, injecte automatiquement dans le contexte : branche, 8 derniers commits, fin du journal. Cross-platform (Node pur → Mac/Windows/Linux).

**Routine à chaque session :**
- **Début :** `git pull` (le hook affiche ensuite « où on en est »).
- **Fin :** mettre à jour `docs/JOURNAL.md` (fait + TODO) → `commit` → `push`.

**Ne se synchronise pas (à refaire par machine) :** authentification des serveurs MCP (`/mcp`), réglages perso `~/.claude/`. Aucun secret ne va jamais dans git.

**Note :** la 1ʳᵉ fois sur une machine, Claude Code demande d'autoriser le hook du projet — c'est normal, accepte-le.