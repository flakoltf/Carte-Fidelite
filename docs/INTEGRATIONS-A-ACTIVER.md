# Intégrations à activer (nécessitent tes clés)

Statut au 2026-06-04. Ces deux chantiers sont **préparés mais inertes** tant que les
variables d'environnement ne sont pas fournies. Une fois que tu me donnes les clés,
l'activation est rapide.

## 1. Email transactionnel (Resend) — ✅ code prêt ET branché, inerte sans clé

- **Transport** : `src/lib/email/send.ts` (`sendEmail()` + `isEmailConfigured()`).
  Aucune dépendance npm (appel direct à l'API REST Resend via `fetch`). Sans clé,
  `sendEmail()` ne fait **rien** et n'échoue jamais (no-op). Testé.
- **Branché** : `src/lib/email/channel.ts` (`EmailChannel`) implémente la même interface
  que le push Wallet et est ajouté dans `getChannels()`. Du coup **toutes** les notifications
  (envois manuels + cron campagnes) partent **aussi par email** aux clients qui ont un email —
  y compris ceux **sans** carte Apple/Google Wallet. Plus besoin de décider « quels emails » :
  le canal suit déjà le système de notifications existant.
- **Modèle d'expéditeur B** : l'email affiche le **nom de la boutique** (`shop_name`) ;
  l'adresse technique reste `EMAIL_FROM` ; le « Répondre à » = email du commerçant
  (`merchants.email`). Logique dans `src/lib/email/sender.ts` (`formatSender`, testé).
- **À fournir** (dans Vercel → Settings → Environment Variables, + `.env.local` en local) :
  - `RESEND_API_KEY` — créer sur https://resend.com/api-keys
  - `EMAIL_FROM` — adresse plateforme **sur un domaine vérifié** dans Resend, ex. `HALO <bonjour@tondomaine.ch>`
    (le nom affiché sera de toute façon remplacé par celui de chaque boutique).
  - (Resend exige de **vérifier ton domaine** d'envoi : ajout d'enregistrements DNS.)

## 2. Surveillance des erreurs (Sentry) — ✅ scaffoldé, build vérifié, inerte sans DSN

- **En place** : `@sentry/nextjs` v10 + `src/instrumentation.ts` / `instrumentation-client.ts`
  + `sentry.server.config.ts` / `sentry.edge.config.ts` + `next.config` enveloppé dans
  `withSentryConfig`. **Init gardée par env** : sans DSN, `enabled:false` → Sentry est un
  no-op complet (ne casse ni le dev, ni la CI, ni le build — **build de prod vérifié vert**).
- **Nettoyage PII** : toutes les erreurs passent par `src/lib/monitoring/scrub.ts` (`beforeSend`) :
  en-têtes `Authorization`/`Cookie` retirés, emails/noms masqués (réutilise `redactPII`). Testé.
- **À fournir** pour l'activer :
  - `NEXT_PUBLIC_SENTRY_DSN` (et/ou `SENTRY_DSN`) — depuis ton projet Sentry (https://sentry.io)
  - `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` — pour l'upload des source maps au build
    (optionnel mais recommandé pour des stack traces lisibles).

## Rappel — autres points qui dépendent de toi
- **Déploiement prod** : voir reco séparée (la prod est gelée sur un vieux déploiement manuel ;
  décision à prendre sur la branche de production).
- **Test Wallet sur iPhone réel** : nécessite ton téléphone.
- **Compte admin démo temporaire** : à supprimer (laissé exprès pour tes tests).
