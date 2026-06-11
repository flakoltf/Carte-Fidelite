# AGENT-C-MANIFESTE — Parcours self-service (inscription → carte en ligne)

> Branche : `feat/agent-c-self-service` (depuis `main` @ 658a8d6, qui inclut
> déjà les agents A et B). Statut : **livré, tests verts, non mergé, RIEN
> appliqué en prod, flag ÉTEINT par défaut.**
> Dernière mise à jour : 2026-06-11.

## 1. Ce qui est livré

Un commerçant s'inscrit et met sa carte en ligne **seul, en quelques minutes,
sans carte bancaire** — le tout derrière le feature flag `self_service_signup`
(éteint : `/signup` garde exactement son comportement actuel, redirection
`/login`).

### Le parcours
1. **`/signup`** — création de compte (email + mot de passe ≥ 10 caractères),
   formulaire brandé HALO mobile-first, validation inline, captcha Turnstile
   optionnel. Écran « vérifiez votre boîte mail » **identique que l'adresse
   existe déjà ou non** (anti-énumération).
2. **Vérification d'email OBLIGATOIRE** — compte Auth créé NON confirmé ;
   lien de confirmation = jeton Supabase haché à usage unique (24 h), envoyé
   par NOTRE email Resend (`signupVerificationEmail`), URL jamais dérivée du
   header Host en prod (anti-forgerie). Adresse déjà utilisée → le titulaire
   reçoit « vous avez déjà un compte » avec connexion en un clic.
3. **`GET /signup/confirm`** — consomme le jeton (`verifyOtp`, cookies de
   session) puis **provisionne le tenant atomiquement** : UNE fonction SQL
   transactionnelle (`provision_self_service_merchant`) crée la ligne
   merchants complète — rôle `'merchant'` fixé **en SQL**, jamais côté client
   — avec programme par défaut, slug, abonnement de lancement (essai 30 j
   par défaut, `SELF_SERVICE_TRIAL_DAYS=0` → directement `active`).
   Idempotente (index unique partiel `user_id` + ON CONFLICT) : double clic ou
   retry ne crée jamais de doublon. Échec → `/onboarding` **self-heal**
   (re-tente le provisioning ; aucun utilisateur vérifié orphelin).
4. **`/onboarding`** — wizard 5 étapes, barre de progression,
   **sauvegarde-et-reprise** (chaque étape persiste ; `onboarding_step` en
   base), états vides/chargement/erreur, copy FR suisse :
   - **Profil** : nom, secteur (7 métiers, défauts intelligents), adresse
     facultative. Le slug public est recalculé transactionnellement
     (`self_service_apply_profile`) — uniquement tant que l'onboarding n'est
     pas terminé (après, l'URL du QR ne bouge plus).
   - **Programme** : tampons (objectif 2–30, stepper) ou paliers de visites,
     exemples par secteur, validation par le moteur loyalty existant.
   - **Design** : handoff **RÉEL** vers `/dashboard/studio` (Agent A) — les
     templates y sont déjà triés par `business_type` posé à l'étape profil ;
     bouton « Vérifier » détecte le design publié ; étape sautable (design
     par défaut prêt). Param `?from=onboarding` posé (voir §6.4).
   - **Palier** : grille canonique 69/129/199 (plafonds 200/750/2000), toggle
     mensuel/annuel (2 mois offerts), « **aucune carte bancaire requise
     pendant le lancement** », palier sur mesure → contact.
   - **Mise en ligne** : récap, « Mettre ma carte en ligne 🎉 » → QR
     d'enrôlement (composant `EnrollmentQR` réutilisé : PNG + copie du lien),
     prochaines actions, CTA tableau de bord, email « votre programme est en
     ligne ».

### La couture de facturation (sans Stripe, prête pour Stripe)
- **Modèle** : `merchants.billing_status` (`trial|active|pending`) +
  `billing_provider` + `billing_customer_ref`/`billing_subscription_ref`
  (réfs opaques Stripe futures). **La suspension n'est PAS dupliquée** :
  `suspended_at` (Agent B) reste l'unique source — statut effectif **dérivé**
  par `deriveSubscriptionStatus()` (`trial` expiré → `pending`, jamais
  d'interruption de service).
- **Port `BillingProvider`** (`src/lib/billing/provider/`) :
  `ManualBillingProvider` (réel : activation immédiate, pas de portail, pas de
  webhook) ; `StripeBillingProvider` **stubé** (chaque méthode documente son
  implémentation : checkout, proration, portail, webhooks signés → mapping
  vers les actions d'audit `SUBSCRIPTION_*`/`PAYMENT_*` déjà dans le CHECK).
  Sélection par env `BILLING_PROVIDER` (défaut `manual`, fail-safe).
  **Brancher Stripe = remplir `stripe.ts` + poser les env — aucun appelant ne
  change** (la route plan suit déjà le résultat `redirect`).
- **Limites sans paiement** : `evaluatePlanChange()` — downgrade sous l'usage
  (vue `billing_active_cards`) refusé doucement (message actionnable, aucune
  carte désactivée) ; proche du plafond → avertissement. La jauge
  `UsageGauge`/`computeUsage` existante reste le levier d'upgrade au quotidien.

## 2. Fichiers créés / modifiés

### Migrations (CRÉÉES, **NON APPLIQUÉES** — fichiers seulement)
| Fichier | Contenu |
|---|---|
| `supabase/migrations/20260613_self_service_signup.sql` | merchants : + `signup_source`, `onboarding_step`, `onboarding_completed_at`, `billing_status`, `billing_provider`, `billing_customer_ref`, `billing_subscription_ref` (CHECKs inclus) · index **unique partiel** `merchants(user_id)` · fonctions SECURITY DEFINER `provision_self_service_merchant` + `self_service_apply_profile` (REVOKE anon/authenticated : service-role only) · seed du flag `self_service_signup` **désactivé** |
| `supabase/migrations/20260613_audit_actions_self_service.sql` | CHECK audit recréé : les 40 actions de `20260612_audit_actions_merged.sql` + `SIGNUP_STARTED`, `SIGNUP_EMAIL_VERIFIED`, `MERCHANT_SELF_PROVISIONED`, `ONBOARDING_COMPLETED` (invariant n°1, à appliquer EN DERNIER) |

### Lib (nouveaux modules — territoire C)
- `src/lib/signup/` : `flag.ts` (gate fail-closed), `validation.ts`,
  `captcha.ts`, `provision.ts`, `urls.ts`, `onboarding.ts` (étapes,
  validateurs, défauts par secteur), `state.ts` (lecture défensive
  pré-migration) + 8 fichiers de tests dans `__tests__/`.
- `src/lib/billing/subscription.ts` (statut dérivé + garde de palier) ;
  `src/lib/billing/provider/{types,manual,stripe,index}.ts` + tests.
  (`usage.ts` **non touché**.)

### Fichiers partagés (extension ADDITIVE uniquement)
- `src/lib/auditLog.ts` : +6 actions (`SUBSCRIPTION_CREATED`/`UPDATED` —
  déjà dans le CHECK depuis 20260610 — + les 4 nouvelles).
- `src/lib/routing/host.ts` : `"/onboarding"` ajouté à `APP_PREFIXES`
  (`host.test.ts` inchangé et vert ; tests additifs dans
  `onboardingRouting.test.ts`).
- `src/proxy.ts` : `/onboarding` ajouté aux routes protégées (additif).
- `src/lib/email/templates.ts` : + `signupVerificationEmail`,
  `signupExistingAccountEmail`, `programLiveEmail` (échappement HTML testé).

### App (territoire C)
- `src/app/(app)/signup/page.tsx` (gate flag ; éteint = redirect `/login`
  historique), `SignupClient.tsx`, `confirm/route.ts`.
- `src/app/(app)/onboarding/{layout,page}.tsx`, `OnboardingClient.tsx`.
- `src/app/api/signup/route.ts` ; `src/app/api/onboarding/{route,profile/route,program/route,plan/route,complete/route}.ts`.

### Territoires A/B : **AUCUN fichier modifié.** Imports seulement
(`EnrollmentQR`, `readImpersonationCookie`, `currentMerchantId`, moteur
loyalty, `BILLING_PLANS`) et redirection vers `/dashboard/studio`.

## 3. Sécurité (surface publique)

- **Flag fail-closed** : flag DB absent/illisible = fermé ; kill switch env.
  POST `/api/signup` flag éteint → **404 indistinct**, zéro effet de bord
  (vérifié en runtime contre la base réelle).
- **Anti-énumération** : réponse 200 strictement identique (test d'égalité
  profonde) que l'adresse existe ou non ; le titulaire est informé par email.
- **Anti-abus** : double rate-limit Upstash (5/h/IP de confiance via
  `clientIp`, 3/h/email normalisé) ; captcha Turnstile en config
  (`TURNSTILE_SECRET_KEY` + `NEXT_PUBLIC_TURNSTILE_SITE_KEY`) — si configuré,
  **jamais contourné** (jeton absent/invalide/panne → rejet).
- **Vérification email obligatoire** : compte non confirmé = pas de login ;
  jeton haché usage unique ; type whitelisté à `magiclink` côté confirm.
- **Isolation tenant** : toutes les routes `/api/onboarding/*` résolvent le
  tenant via `currentMerchantId()` (impersonation gérée) et filtrent le
  service-role (`.eq` / `p_merchant_id`) — invariant n°3. Gardes STATIQUES
  `selfServiceGuards.test.ts` (toute future route oubliant flag, rate-limit,
  tenant ou exposant le token d'enrôlement casse la CI). `enrollment_token`
  absent de tout le parcours (le public passe par le slug).
- **Rôle côté serveur** : `'merchant'` fixé dans la fonction SQL ; garde
  statique : la surface d'inscription n'écrit jamais de rôle.
- **Audit** : `SIGNUP_STARTED` → `SIGNUP_EMAIL_VERIFIED` →
  `MERCHANT_SELF_PROVISIONED` + `SUBSCRIPTION_CREATED` →
  `MERCHANT_UPDATED` (étapes) → `SUBSCRIPTION_UPDATED` (palier) →
  `ONBOARDING_COMPLETED` — IP/UA inclus, migration jumelle fournie.

## 4. 🕹️ Comment allumer le flag

**Prérequis (dans cet ordre) :**
1. Merger la branche, déployer.
2. Appliquer les 2 migrations `20260613_*` (vérifier avant l'état réel de la
   prod — invariant n°6 ; pré-check fourni en tête de la migration :
   aucun `user_id` dupliqué dans merchants).
3. Vérifier `RESEND_API_KEY` + `EMAIL_FROM` actifs (sinon : aucune
   vérification d'email ne part → personne ne peut s'inscrire ; `sendEmail`
   no-op). Upstash (`rateLimit`) déjà actif.
4. Optionnel : `SELF_SERVICE_TRIAL_DAYS` (défaut 30 ; `0` = compte `active`
   sans essai), `APP_BASE_URL` (previews), captcha (`TURNSTILE_SECRET_KEY` +
   `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, les deux ensemble).

**Activation : `/admin/settings` → feature flags → `self_service_signup` → ON**
(la migration a créé la ligne, désactivée). Aucun redéploiement nécessaire.
Pourquoi ce choix : le gate est PUBLIC donc lu server-side via service-role
(la RLS de `feature_flags` est admin-only) ; la DB permet d'ouvrir/fermer en
direct depuis le panneau B. La variable `SELF_SERVICE_SIGNUP` est un override
opérationnel : `off` = kill switch immédiat qui prime sur la DB ; `on` =
forçage (dev/preview). Fail-closed dans tous les autres cas.

**Désactivation** : flag OFF (ou env `off`). `/signup` redirige à nouveau vers
`/login` ; les marchands déjà provisionnés gardent l'accès à `/onboarding`
(on ne strande personne en cours de wizard) et au dashboard.

## 5. Vérification étape par étape

```bash
cd /Users/letaief/Projects/HALO/app/.claude/worktrees/agent-c
npx vitest run      # 84 fichiers / 535 tests verts (438 existants + 97 Agent C)
npx tsc --noEmit    # propre
npm run lint        # 0 erreur, 0 warning (sortie complète vide)
NODE_OPTIONS="--max-old-space-size=6144" npm run build   # vert
# (worktree : node_modules réel via npm ci + copie certs — Turbopack refuse
#  les symlinks sortants, correctif local Agent A reproduit, rien committé)
```

Runtime (dev `npx next dev -p 3002`) — fait le 2026-06-11, lecture seule :
1. Flag éteint (DB prod sans flag) : `/signup` → 307 `/login` ;
   `POST /api/signup` → 404. ✅ fail-closed prouvé contre la base réelle.
2. `SELF_SERVICE_SIGNUP=on` : `/signup` rend le formulaire (« Créer mon
   compte », « Aucune carte bancaire »). ✅ (AUCUNE soumission effectuée —
   Resend actif et base = prod.)
3. `/onboarding` sans session → 307 `/login` ; `/api/onboarding` → 401 ;
   `/signup/confirm?type=evil` → 307 `/signup?erreur=lien`. ✅
4. Login démo (lecture seule) : `GET /api/onboarding` renvoie l'état réel du
   Café du Rhône avec fallbacks pré-migration (`step:"profile"`,
   `signupSource:"concierge"`, `subscriptionStatus:"active"`,
   `designPublished:true`, `activeCards:31`) ; `/onboarding` rend le wizard
   pré-rempli ; `/signup` avec session → 307 `/dashboard`. ✅
5. AUCUNE écriture (pas d'inscription, pas d'étape enregistrée, aucun email).

Parcours complet à rejouer sur un environnement de test APRÈS migrations :
inscription → email reçu → confirmation → wizard 5 étapes → QR → audit
(`/admin/audit` : la chaîne complète §3) → flag OFF → `/signup` redirige.

## 6. Dépendances / décisions pour le fondateur

1. **Migrations 20260613_*** à appliquer avant d'allumer le flag (le wizard
   lit défensivement pré-migration, mais l'inscription échouerait au
   provisioning : RPC inexistante → self-heal en boucle d'erreur propre).
2. **Supabase Auth** : le flux n'utilise PAS le SMTP Supabase (liens générés
   en admin + envoi Resend) — aucun réglage de template Supabase requis.
   `signInWithPassword` refuse déjà les comptes non confirmés (défaut).
3. **Reprise après interruption** : la reprise passe par l'URL `/onboarding`
   (lien dans les emails). Un marchand self-service qui se reconnecte via
   `/login` atterrit sur `/dashboard` : ajouter une bannière « finissez votre
   mise en ligne » dans `DashboardShell` serait un patch d'une ligne **côté
   territoire A** — non fait ici (anti-collision), recommandé à l'intégration.
4. **Studio `?from=onboarding`** : le wizard ouvre
   `/dashboard/studio?from=onboarding` (nouvel onglet). Le studio ignore ce
   paramètre aujourd'hui ; s'il veut afficher « revenir à la mise en ligne »,
   c'est un ajout côté A. Le handoff fonctionne sans (templates déjà triés
   par secteur, bouton « Vérifier » côté wizard).
5. **Email de bienvenue concierge inchangé** : la séquence A1 reste celle du
   flux admin ; le self-service a ses propres emails (vérification, programme
   en ligne). Harmonisation CRM possible plus tard.
6. **`SUBSCRIPTION_CREATED`/`UPDATED`** ajoutés à `AUDIT_ACTIONS` (ils
   figuraient déjà dans le CHECK depuis 20260610 — aucun risque de rejet).

## 7. Ce que j'ai choisi de NE PAS faire (et pourquoi)

- **Pas d'intégration Stripe** (mandat) : aucun SDK, aucune clé, aucune route
  webhook. La route webhook sera créée en même temps que `stripe.ts` (un stub
  public sans vérification de signature serait une surface morte risquée).
- **Pas d'upload de logo à l'étape profil** : l'asset pipeline (recadrage,
  resize serveur, bucket tenant) appartient au studio (A) — le wizard y envoie
  le marchand plutôt que de dupliquer une chaîne sensible.
- **Pas de magic-link comme mode de connexion général** : le jeton magiclink
  ne sert qu'à la vérification d'inscription et au « déjà un compte » ;
  changer le login est hors périmètre.
- **Pas de modification de `/api/auth/login` ni du dashboard** (anti-collision
  — voir §6.3).
- **Pas de résiliation self-service** : `ManualBillingProvider.cancelSubscription`
  renvoie un refus doux (contact direct) — décision produit du lancement,
  Stripe l'activera via le portail.
- **Pas de widget captcha « à fond »** : option en config (serveur fail-closed
  + widget client conditionnel) sans tuning UX avancé, conformément au brief.
- **Pas de blocage dur au plafond** : principe produit existant (« rien ne
  casse au comptoir ») respecté — nudges + refus de downgrade uniquement.

## 8. Commits de la branche

`git log main..feat/agent-c-self-service --oneline` — 4 commits conventionnels
FR : couture billing + migration → fondations signup (flag/validation/
anti-abus/emails/audit) → routes + pages (signup, confirm, wizard) →
manifeste.
