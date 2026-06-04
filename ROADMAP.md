# 🗺️ Roadmap — Cartes de Fidélité

**Dernière mise à jour** : 2026-06-04
**Statut projet** : Beta — socle sécurité + fonctionnalités marchand en place ; refonte UI et derniers manques en cours

> Légende : ✅ fait · ⏳ en cours / partiel · ❌ à faire · 🔍 à vérifier (infra, hors code)

---

## 🔴 Bloquants Production (B1–B5)

| # | Sujet | Statut | Preuve / Note |
|---|-------|--------|---------------|
| B1 | Signature des QR (HMAC) | ✅ | `src/lib/qrSignature.ts`, vérifié au scan |
| B2 | Audit trail immuable | ✅ | migration `audit_logs`, `src/lib/auditLog.ts` |
| B3 | RLS Supabase (cloisonnement marchands) | ✅ | migrations `rls_policies`, `wallet_tables_rls`, `merchant_role_guard` |
| B4 | Chiffrement au repos | 🔍 | Config infra Supabase — **à confirmer dans le dashboard** (non vérifiable dans le code) |
| B5 | Rate limiting (login + envois) | ✅ | `src/lib/rateLimit.ts` + Upstash Redis |

---

## 🟠 Important — Lancement Commerçants (I1–I8)

| # | Sujet | Statut | Preuve / Note |
|---|-------|--------|---------------|
| I1 | Anti-fraude (détection patterns) | ✅ | `src/lib/antifraud/`, panel marchand + alertes admin |
| I2 | Monitoring erreurs (Sentry) | ⏳ | **Scaffold livré** : `@sentry/nextjs` v10 + `src/instrumentation*.ts` + configs server/edge/client, `next.config` enveloppé. No-op sans DSN. Nettoyeur PII (`src/lib/monitoring/scrub.ts`) branché sur `beforeSend`. ⚠️ Besoin du **DSN** (voir ci-dessous). |
| I3 | Masquage PII dans les logs | ⏳ | **Outil livré + testé** : `src/lib/log/mask.ts` (`maskEmail`/`maskName`/`redactPII`). Reste à l'adopter aux points de log existants. |
| I4 | Dashboard commerçants | ✅ | `src/app/dashboard/*` (clients, segments, analytics, campagnes…) |
| I5 | Notifications EMAIL clients | ✅ | **Ajouté** : `EmailChannel` via Resend (`src/lib/email/`), branché dans `getChannels()`. ⚠️ Nécessite `RESEND_API_KEY` + `EMAIL_FROM` (voir ci-dessous). |
| I6 | RGPD — droit à l'oubli | ✅ | `DELETE /api/customers/[id]` + audit `CUSTOMER_DELETED` |
| I7 | MFA marchand (TOTP) | ✅ | `src/app/login/mfa`, lib MFA, audit `MFA_ENROLLED`/`MFA_DISABLED` |
| I8 | Stats temps réel | ✅ | `src/lib/analytics/*`, `src/app/dashboard/_analytics` |

### ⚙️ Configuration email (I5) — à faire par toi
Pour activer l'envoi d'emails, définir deux variables d'environnement (Vercel + `.env.local`) :
```
RESEND_API_KEY=re_xxxxxxxxxxxx     # clé API depuis resend.com
EMAIL_FROM="Café Lumen <fidelite@ton-domaine.ch>"   # expéditeur (domaine vérifié sur Resend)
```
Sans ces variables, l'envoi est un **no-op sûr** (aucun plantage). Dès qu'elles sont présentes, **toutes** les notifications (envois manuels + cron campagnes) partent aussi par email aux clients qui ont un email — y compris ceux **sans** carte Apple/Google Wallet.

> Modèle d'expéditeur **B** : l'email affiche le **nom de la boutique** (`shop_name`) comme expéditeur ; l'adresse technique reste `EMAIL_FROM` (domaine Resend vérifié) ; le **« Répondre à »** est l'email du commerçant (`merchants.email`).

### ⚙️ Configuration Sentry (I2) — à faire par toi
```
NEXT_PUBLIC_SENTRY_DSN=https://xxxx@oyyyy.ingest.sentry.io/zzzz   # DSN du projet Sentry
# Pour l'upload des source maps au build (optionnel mais recommandé) :
SENTRY_ORG=ton-org
SENTRY_PROJECT=carte-fidelite
SENTRY_AUTH_TOKEN=sntrys_xxx
```
Sans `NEXT_PUBLIC_SENTRY_DSN`, Sentry est **désactivé** (`enabled:false`) : aucun envoi, aucun impact. Toutes les erreurs envoyées passent d'abord par le **nettoyeur PII** (en-têtes `Authorization`/`Cookie` retirés, emails/noms masqués).

---

## 🟢 Fonctionnalités livrées au-delà de la roadmap initiale

- ✅ **Segmentation clients** (`src/lib/segments/`, `dashboard/segments`)
- ✅ **Campagnes manuelles** + **automatisées** (cron `api/cron/campaigns`)
- ✅ **Config marchand par admin** (`merchant-config`, `admin/merchants`)
- ✅ **Proximité GPS** (`src/lib/geo/`, `merchant_location`)
- ✅ **Push Wallet** Apple/Google (`src/lib/wallet/`, `notifications`)
- ✅ **Moteur de fidélité multi-types** stamp / visit / tiered (`src/lib/loyalty/`)
- ⏳ **Refonte UI « HALO Light »** : Lots 1–2 faits (login, dashboard, table clients, vue segments). **Reste à porter** : campagnes, paramètres, sécurité, admin.

---

## 🟡 Nice-to-Have — V2+ (N1–N7)

| # | Sujet | Statut |
|---|-------|--------|
| N1 | API publique + webhooks | ❌ |
| N2 | Programme de récompenses avancé (tiers, événements) | ⏳ (base posée par le moteur multi-types) |
| N3 | Push Wallet sur changement de points | ✅ (push Wallet en place) |
| N4 | Intégrations POS (Shopify, Square…) | ❌ (dépend de N1) |
| N5 | App mobile native | ❌ |
| N6 | ML détection fraude | ❌ |
| N7 | Conversion points → récompenses | ⏳ (encaissement/redeem en place) |

---

## 🎯 Prochaines priorités (proposées)

1. **Brancher Resend** (`RESEND_API_KEY` + `EMAIL_FROM`) pour activer l'email — code déjà prêt.
2. **Brancher Sentry** (`NEXT_PUBLIC_SENTRY_DSN`) — scaffold déjà prêt, il ne manque que le DSN.
3. **I3 — adopter le masquage** aux points de log sensibles existants.
4. **B4 — confirmer le chiffrement au repos** côté Supabase.
5. **Finir la refonte HALO Light** (écrans restants).

---

## Métriques de succès (post-lancement)

- [ ] < 1 % de fraude points
- [ ] 99.9 % uptime
- [ ] < 500 ms réponse scan
- [ ] 0 violation RGPD
- [ ] 100 % audit trail
