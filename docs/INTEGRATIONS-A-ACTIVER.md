# Intégrations à activer (nécessitent tes clés)

Statut au 2026-06-04. Ces deux chantiers sont **préparés mais inertes** tant que les
variables d'environnement ne sont pas fournies. Une fois que tu me donnes les clés,
l'activation est rapide.

## 1. Email transactionnel (Resend) — ✅ code prêt, inerte

- **Code en place** : `src/lib/email/send.ts` (`sendEmail()` + `isEmailConfigured()`).
  Aucune dépendance npm (appel direct à l'API REST Resend via `fetch`). Sans clé,
  `sendEmail()` ne fait **rien** et n'échoue jamais (no-op). Testé (`src/lib/email/__tests__`).
- **À fournir** (dans Vercel → Settings → Environment Variables, + `.env.local` en local) :
  - `RESEND_API_KEY` — créer sur https://resend.com/api-keys
  - `EMAIL_FROM` — expéditeur **sur un domaine vérifié** dans Resend, ex. `HALO <bonjour@tondomaine.ch>`
  - (Resend exige de **vérifier ton domaine** d'envoi : ajout d'enregistrements DNS.)
- **Reste à décider avec toi (produit)** : QUELS emails envoyer ?
  Candidats naturels : (a) email de bienvenue au client à l'enrôlement ; (b) reçu après
  un encaissement de récompense ; (c) identifiants au marchand à la création (aujourd'hui
  affichés à l'écran). Dis-moi le(s)quel(s) et je câble `sendEmail()` au bon endroit.

## 2. Surveillance des erreurs (Sentry) — ⏳ à installer avec toi

Contrairement à l'email, Sentry pour Next.js nécessite **le SDK `@sentry/nextjs`** (ajout
de dépendance + fichiers de config `instrumentation.ts` / `sentry.*.config.ts` + wrap de
`next.config`). C'est pourquoi je préfère le faire **quand tu as le compte**, pour vérifier
le build de bout en bout plutôt que de laisser un demi-branchement fragile.

- **À fournir** :
  - `NEXT_PUBLIC_SENTRY_DSN` (et/ou `SENTRY_DSN`) — depuis ton projet Sentry (https://sentry.io)
  - `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` — pour l'upload des source maps au build
    (optionnel mais recommandé pour des stack traces lisibles).
- **Ce que je ferai à ce moment** : `npm i @sentry/nextjs`, config init garde par env
  (inerte si DSN absent → ne casse ni le dev ni la CI), capture serveur + client, puis build
  vert vérifié. ~30 min.

## Rappel — autres points qui dépendent de toi
- **Déploiement prod** : voir reco séparée (la prod est gelée sur un vieux déploiement manuel ;
  décision à prendre sur la branche de production).
- **Test Wallet sur iPhone réel** : nécessite ton téléphone.
- **Compte admin démo temporaire** : à supprimer (laissé exprès pour tes tests).
