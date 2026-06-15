# 📍 État du projet HALO — passation (pour reprendre sur iPhone ou ailleurs)

> Dernière mise à jour : 2026-06-15. Ce fichier est la **source de vérité portable** :
> il voyage avec le dépôt git (la mémoire de l'assistant, elle, reste sur le Mac).
> Quand tu reprends depuis un autre appareil, **fais lire ce fichier en premier**.

## Le produit
**HALO / HaloCard** — SaaS suisse (Genève, fondateur solo) de **cartes de fidélité
numériques** natives Apple Wallet & Google Wallet, vendues en abonnement par
établissement. Multi-tenant. Site public + dashboards marchand & super-admin.

- Repo : `flakoltf/Carte-Fidelite` (dossier `app/`, Next.js App Router).
- Prod : Vercel projet `carte-fidelite`, domaine **halocard.ch** (apex sert le site,
  `app.halocard.ch` = l'app, `www` → 308 apex). `main` = production.
- Base : Supabase (Postgres + Auth + RLS), région EU.
- Grille tarifaire canonique : **Essentiel 69 / Croissance 129 / Premium 199 CHF**
  (plafonds 200/750/2000 cartes actives 90 j). NE JAMAIS réintroduire d'autres prix.

## ✅ Ce qui est FAIT et EN PRODUCTION
- Audit 360° soldé : prix unifiés, hygiène sécu, Google Wallet résilient, funnel
  `/demarrer` + SEO, billing (paliers, vue `billing_active_cards`, snapshots + cron).
- **Dashboard super-admin** (`/admin`) : KPIs, table santé marchands (rituel lundi),
  upsell, leads/pipeline, billing, wallet ops, audit, settings — 8 pages, 16 API.
- **Dashboard marchand** (`/dashboard`) : KPIs, jauge palier, segments, activité,
  fiche client, abonnement.
- **Studio de design** (`/dashboard/studio`) : aperçus Apple+Google live, templates,
  images recadrées, tampons, brouillon→publier versionné.
- **Self-service + onboarding dual-track** (inscription → wizard → carte, ou fork
  « HALO crée ma carte » concierge) — **PRÊT mais derrière le flag `self_service_signup`
  ÉTEINT**. Pour l'activer : `/admin/settings` (kill switch env `SELF_SERVICE_SIGNUP=off`).
- **Expérience comptoir** : annulation de scan (RPC `scan_revert`), essai 14 j à
  expiration douce, checklist de démarrage, vocabulaire simplifié.
- **Couture Stripe** prête (port `BillingProvider`, `StripeBillingProvider` stubé) —
  Stripe PAS branché (décision : lancement gratuit/concierge).
- **Tests RLS couche 1** (garde structurel des migrations, `src/lib/__tests__/rlsPolicyGuard.test.ts`).
- ~630 tests, dépôt nettoyé. Advisors Supabase : 4 `search_path` corrigés.

## ⏳ Ce qui MANQUE
### Actions QUI NE DÉPENDENT QUE DU FONDATEUR (hors code)
1. Sentry (DSN) + UptimeRobot (monitoring, code prêt).
2. Google Wallet **publishing access** (dossier `wallet/`), puis `NEXT_PUBLIC_GOOGLE_WALLET_READY=true`.
3. **IDE** depuis zefix.ch → `src/content/legal/company.ts` (débloque légal + Google).
4. Google Search Console + soumettre le sitemap.
5. **Activer « leaked password protection »** : Supabase → Authentication → Sign In/Providers → Password.
6. Imprimer le QR démo plastifié + décider le téléphone pro.
7. Le jour J : allumer le flag self-service.

### Code — phase NEXT (par priorité)
1. **Séquences email B2B** : seul l'email de bienvenue est branché ; A2/A3/activation/
   pré-churn sont rédigés dans `crm/Sequences_Email_Marchands.md`, pas automatisés (cron).
2. **Mise à jour des objets Google Wallet après scan** (tampon n'avance pas sur Android ;
   dépend de l'approbation ; GET-then-merge obligatoire — jamais d'UPDATE qui efface).
3. **Tests RLS couche 2** (comportementale « Alice-vs-Bob » sur vraie base Postgres ;
   introduit Docker/Postgres en CI). Permettra aussi de durcir `is_admin()` (révoquer anon).
4. Témoignages réels sur la landing (les 3 actuels sont fictifs).
5. Centre d'aide `/aide` (3 articles déjà rédigés dans `_audit-360/17-…`).
6. Refonte business plan (le PDF porte encore les vieux prix 49/89/149).

## ⚠️ INVARIANTS & PIÈGES (lire avant de coder)
1. Tout nouvel `AuditAction` (`src/lib/auditLog.ts`) exige une **migration jumelle** du
   CHECK `audit_logs_action_check` (repartir de la liste à 48 actions). Test :
   `auditActionsSync`. Sinon les inserts d'audit sont rejetés silencieusement.
2. **Google Wallet** : jamais d'UPDATE/PUT (efface les champs omis) → GET-then-merge/PATCH.
3. **Tenancy** : résoudre le marchand via `@/lib/auth/currentMerchant` (`currentMerchantContext`).
   Tout accès `supabaseAdmin` (service-role) DOIT filtrer `.eq("merchant_id", …)`.
4. **Nouvelle table** = la déclarer dans `TABLE_REGISTRY` du garde RLS (sinon test rouge)
   + activer la RLS + policy du bon type.
5. **Lockfile** : `npm install` sur macOS élague les binaires wasm32 → CI Linux casse.
   Après tout install, regreffer `@emnapi/runtime`+`core` dans `package-lock.json`
   (cf. commits `fix(ci)`), valider `npm ci`.
6. **Migrations prod** : préparées en fichier, appliquées seulement avec accord explicite
   du fondateur. Vérifier l'état réel avant (la prod a reçu des patchs).

## 🔧 Workflow & vérification
- Brancher depuis `main` (jamais committer sur main), Conventional Commits FR, PR, CI verte, merge.
- Vérif locale : `npx vitest run` · `npx tsc --noEmit` · `npm run lint` (lire le résumé
  COMPLET) · `NODE_OPTIONS="--max-old-space-size=6144" npm run build`.
- Comptes de démo : voir `docs/COMPTES-DEMO.md` (sans mots de passe — ceux-ci sont
  hors git, fournis par le fondateur).
