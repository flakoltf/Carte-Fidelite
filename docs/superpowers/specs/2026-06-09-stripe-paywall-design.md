# Page de paiement Stripe — abonnement self-service (prête, débranchée)

- **Date** : 2026-06-09
- **Branche** : `feat/stripe-paywall`
- **Statut** : conçu, en attente d'implémentation
- **Approche retenue** : Stripe Checkout (page hébergée) + webhook, derrière un flag d'environnement

## 1. Contexte & objectif

HaloCard est un SaaS d'abonnement, mais la facturation n'est pas intégrée et l'inscription
commerçant est manuelle (admin). On prépare **toute la chaîne d'achat self-service en ligne**,
**construite et testable dès maintenant mais débranchée de Stripe** : le compte Stripe sera
créé après la validation au registre du commerce. Le jour J = ajouter des variables d'env, zéro
changement de code.

## 2. Plans tarifaires (source de vérité)

| Plan | Prix | Cartes actives | Au-delà |
|---|---|---|---|
| **Starter** | 69 CHF/mois | jusqu'à 250 | bascule vers Pro (reporté) |
| **Pro** | 129 CHF/mois | jusqu'à 1 000 | bascule vers Business (reporté) |
| **Business** | 199 CHF/mois | jusqu'à 3 000 | sur devis (reporté) |

Toutes les fonctionnalités sont incluses dans chaque palier ; seule la limite de cartes change.
La section `#tarifs` de la vitrine (qui affiche encore l'ancien barème Essentiel/Croissance/Premium)
sera mise à jour vers ces plans.

## 3. Parcours utilisateur (self-service, mot de passe jamais transmis)

```
Vitrine #tarifs → "Choisir" (plan) → POST /api/checkout
   → Stripe Checkout Session → redirection vers la page de paiement Stripe
   → succès → redirection vers /abonnement/merci ("vérifie ta boîte mail")
   → en parallèle : Stripe → POST /api/webhooks/stripe (checkout.session.completed)
        → provisioning : utilisateur Supabase Auth + fiche merchant
          (plan, card_limit, stripe_customer_id, stripe_subscription_id, subscription_status)
        → génération d'un lien sécurisé Supabase (invite/recovery)
        → envoi de l'email d'invitation brandé HaloCard via Resend
   → le commerçant clique le lien → /definir-mot-de-passe
        → l'email est validé (preuve de possession) + il choisit son mot de passe
        → connecté → /dashboard
   → il peut re-changer son mot de passe à tout moment (Réglages > Sécurité)
```

## 4. Architecture (fichiers / routes — suit les conventions du repo)

- `src/lib/billing/plans.ts` — config des 3 plans : `{ key, label, priceChf, cardLimit, stripePriceIdEnv }`. Source de vérité unique (utilisée par la vitrine, le checkout, le provisioning).
- `src/lib/billing/stripe.ts` — instanciation paresseuse du client Stripe + `isStripeEnabled()` (vrai seulement si `STRIPE_SECRET_KEY` et les 3 `STRIPE_PRICE_*` sont présents).
- `src/lib/billing/provision.ts` — `provisionMerchantFromCheckout(...)` : logique pure/testable, **idempotente**, qui crée ou rattache l'utilisateur + la fiche merchant et déclenche l'email d'invitation.
- `src/app/api/checkout/route.ts` — `POST { plan }` → crée la Checkout Session et renvoie l'URL de redirection. Renvoie **503** si `isStripeEnabled()` est faux.
- `src/app/api/webhooks/stripe/route.ts` — vérifie la signature (`STRIPE_WEBHOOK_SECRET`), traite `checkout.session.completed` (et ignore le reste pour la v1). Appelé par les serveurs Stripe.
- `src/app/(app)/definir-mot-de-passe/page.tsx` — page où le commerçant définit son mot de passe via le lien sécurisé (session de récupération Supabase), puis redirige vers `/dashboard`.
- `src/app/(marketing)/abonnement/merci/page.tsx` — confirmation post-paiement (« vérifie ta boîte mail »).
- Mise à jour de la section `#tarifs` dans `src/app/(marketing)/page.tsx` : nouveaux plans + boutons « Choisir » câblés sur `/api/checkout` (ou état « Bientôt disponible » si débranché).

## 5. Modèle de données — migration `merchants` (additive, non destructive)

Ajout de colonnes (toutes nullable / avec défaut, comme la migration `slug`) :
- `plan TEXT` — `starter` | `pro` | `business`
- `card_limit INT` — dérivé du plan (250 / 1000 / 3000)
- `stripe_customer_id TEXT`
- `stripe_subscription_id TEXT`
- `subscription_status TEXT` — ex. `active`, `past_due`, `canceled`
- Index unique partiel sur `stripe_customer_id` (quand non nul) pour l'idempotence.

Migration appliquée par l'utilisateur (SQL Editor / script), jamais en direct par l'agent
(cf. règle « jamais en direct sur la prod »).

## 6. Stratégie « débranché » (cœur de la demande)

`isStripeEnabled()` gouverne tout :
- **Faux (état actuel, sans compte Stripe)** : les boutons « Choisir » affichent **« Bientôt disponible »** (désactivés) ; `/api/checkout` renvoie 503 ; le webhook ne reçoit rien. Le reste du code (provisioning, page de mot de passe) est présent et **testé avec des événements Stripe simulés**.
- **Vrai (jour J, post-registre)** : créer le compte Stripe, créer les 3 produits/prix, configurer le endpoint webhook, puis ajouter sur Vercel : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_PRO`, `STRIPE_PRICE_BUSINESS`. **Aucun changement de code.**

## 7. Emails & sécurité

- Lien sécurisé via **Supabase Admin `generateLink`** (type invite/recovery) → envoyé par **Resend** avec le branding HaloCard (réutilise `src/lib/email/`). **Aucun mot de passe en clair n'est jamais transmis.**
- `/api/webhooks/stripe` est **exclu du proxy de sous-domaine** (comme `/api/wallet/*`) et **vérifie la signature Stripe** (rejet 400 si invalide).
- Clés Stripe **côté serveur uniquement** (jamais `NEXT_PUBLIC_*`). Service role utilisé uniquement côté serveur pour le provisioning.
- Aucun compte n'est créé sans paiement confirmé.

## 8. Robustesse / gestion d'erreurs

- **Idempotence** : un webhook peut être reçu plusieurs fois → provisioning par *upsert* (clé = `stripe_customer_id` ou email normalisé). Jamais de doublon de compte.
- **Paiement échoué** : Stripe gère les relances ; aucun provisioning tant que le paiement n'est pas confirmé.
- **Échec d'envoi d'email** : journalisé (Sentry) ; le commerçant peut récupérer un lien via « mot de passe oublié ».
- **Email déjà existant** (commerçant déjà connu) : on rattache l'abonnement à la fiche existante au lieu d'échouer.
- **Signature webhook invalide** : 400, aucun traitement.

## 9. Tests (vitest, sans Stripe réel)

- `plans.ts` : intégrité de la config (clés, limites, mapping prix↔limite).
- `provision.ts` : idempotence (double appel = un seul compte), mapping plan→card_limit, rattachement d'un email existant.
- Traitement du webhook : événement `checkout.session.completed` **simulé** → provisioning appelé avec les bons paramètres ; signature invalide → rejet ; événement non géré → ignoré proprement.
- État « débranché » : `isStripeEnabled()` faux → `/api/checkout` renvoie 503, bouton en mode « Bientôt disponible ».

## 10. Hors périmètre (reporté, YAGNI pour la v1)

- Bascule automatique de palier au dépassement de la limite de cartes (« au-delà → passe en Pro/Business »).
- Annulation / changement de plan en self-service (s'ajoutera facilement via le **Stripe Customer Portal**).
- Facturation au prorata, factures PDF, codes promo, TVA multi-pays.
- Tarif « sur devis » au-delà de 3 000 cartes (prise de contact manuelle pour l'instant).

## 11. Variables d'environnement requises pour la mise en service (jour J)

```
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_STARTER=
STRIPE_PRICE_PRO=
STRIPE_PRICE_BUSINESS=
```
(À documenter aussi dans `.env.example`, section Stripe, en les décommentant.)
