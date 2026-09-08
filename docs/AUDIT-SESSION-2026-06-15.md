# Audit de session — HaloCard — 2026-06-15

> Rédigé par le manager (Claude) en fin de session. État réel vérifié (GitHub,
> Supabase, Vercel, logs). Objectif : prospection terrain Genève mi-juillet 2026.

---

## 1. Vue d'ensemble

Session longue et dense : passage d'un POC à un produit **démontrable en prod**.
Trois axes : (a) **features** F1/F2/F3, (b) **fiabilité** (bugs traqués via logs +
gardes anti-régression), (c) **outillage démo + observabilité** pour la prospection.

**Santé prod en fin de session : saine.** F1/F2/F3 en ligne, outil démo opérationnel,
Sentry actif, aucune PR cassée mergée.

---

## 2. Livré en production (PR mergées sur `main`)

| PR | Sujet | Note |
|----|-------|------|
| #17 | F1 — carte wallet vivante (récompense, horaires, adresse, tél) | base de la journée |
| #18 | F2 — lien « Avis Google » au déblocage | rebasé sur main, conflit `me/route` résolu |
| #20 | Fix `/dashboard/card` + migration `phone` + **garde anti-drift** | corrige le bug du jour |
| #21 | Fix création concierge (marqueurs d'onboarding à l'INSERT) | + backfill |
| #22 | F3 — tampon de bienvenue + récompense intermédiaire | jsonb, sans migration |
| #23 | Perf — index sur 4 clés étrangères (advisor 0001) | hotfix prod |
| #27 | Retrait de la route de smoke Sentry | nettoyage |
| #29 | Outil compte démo — seed + reset 1-clic (admin) | tenancy blindée |
| #30 | Onboarding guidé pas-à-pas (checklist étendue) | Agent C |
| #31 | Filet anti-régression de la démo (tests E2E) | reprise manager d'Agent A |
| #32 | Fix `CHECK google_place_id` `{10,256}→{10,255}` | bug latent F2 |

**Fermées (superseded, zéro perte)** : #19 (→ #21), #28 (→ #31).
**Temporaires (mergées puis retirées)** : #24, #25, #26 (routes de diagnostic Sentry).
**En cours (draft)** : **#33** — Studio : rendu des tampons sur le pass + règles éditables.

---

## 3. Changements base de données (Supabase prod — appliqués avec accord)

| Migration / action | Effet |
|---|---|
| `20260616_merchant_card_identity` | `reward_label` + `business_hours` (F1) |
| `20260616_merchants_phone` | **colonne `phone` manquante** (hotfix drift F1) |
| `20260615_function_search_path` | durcissement `search_path` de 4 fonctions (advisor sécu 0011) |
| `20260615_backfill_concierge` | marqueurs concierge des lignes legacy |
| `20260617_merchant_google_place` | colonne `google_place_id` (F2) |
| `20260617_fk_indexes` | 4 index de clés étrangères (perf) |
| `20260618_audit_actions_demo` | actions `DEMO_ACCOUNT_SEEDED/RESET` — **corrigée** pour préserver `MARKETING_CONSENT_UPDATED` |
| `20260619_fix_google_place_check` | regex `{10,256}→{10,255}` (limite Postgres 255) |
| Données démo | `Boulangerie Démo` : `phone` + `primary_color` posés |

---

## 4. Bugs traqués & corrigés (tous via diagnostic, pas à l'aveugle)

1. **`merchants.phone` absente** — la couche identité F1 lisait une colonne jamais
   créée (la migration supposait à tort `phone` existant). Symptôme : `/dashboard/card`
   « page pas prête ». **Diagnostic via logs Postgres** (`42703`). Fix + **garde
   anti-drift permanent** (`merchantsColumnsSync.test.ts`) qui échoue en CI si le code
   lit une colonne non migrée. *Ne pourra plus jamais repasser.*
2. **Création concierge incohérente** — `POST /api/admin/merchants` ne posait pas les
   marqueurs d'onboarding → marchand routé vers le self-service. Fix à l'INSERT + backfill.
3. **`/dashboard/card` faux « pas prête »** — le front confondait erreur réseau / 401 /
   marchand sans slug. Machine d'états + `me` route qui ne masque plus l'erreur PostgREST.
4. **`CHECK google_place_id` invalide** — `{10,256}` dépasse la limite de répétition
   regex de Postgres (255) → **toute** saisie de lien Google plantait. Latent jusqu'au
   seed démo. **Diagnostic via logs**. Fix `{10,255}` + regex JS aligné.
5. **Migration démo qui supprimait une action prod** — `MARKETING_CONSENT_UPDATED`
   (patch hors-repo) aurait été retiré du `CHECK`. **Attrapé en comparant la contrainte
   live** avant d'appliquer. Migration corrigée.

---

## 5. Observabilité — Sentry

- DSN posé en prod (variables Vercel), câblage vérifié (`onRequestError` +
  `instrumentation`, scrub PII actif).
- Le « rien dans Sentry » initial = **délai d'ingestion**, pas un bug. Prouvé end-to-end :
  erreur non gérée (auto) **et** capture explicite remontent bien.
- Routes de test temporaires créées puis **retirées** (#24/#25/#26/#27).
- **Résultat : monitoring d'erreurs live pour la prospection.**

---

## 6. Outil démo de prospection (#29)

- `POST /api/admin/demo/seed` : crée/reconfigure `Boulangerie Démo` pleinement
  configurée + clients de démo. `reset` : purge **scopée au seul compte démo**
  (triple garde `assertDemoMerchant` : slug + email réservés + role).
- **Validé en conditions réelles** (a révélé le bug #4 — un vrai service rendu).
- Assets de design fournis (bannière, logo, carte) + palette premium pour le Studio.

---

## 7. Gestion des agents (interventions manager)

| Agent | Tâche | Intervention |
|---|---|---|
| A | Filet de tests démo | **Base périmée + boucle** → repris en main : rebase + `todo` → vrais tests → #31 |
| B | Seed/reset démo | Propre d'emblée (#29) ; **sa migration aurait supprimé une action prod** → corrigée |
| C | Onboarding guidé | Base périmée → correction relayée → **a obéi et bien exécuté** (#30) |
| Studio | Rendu tampons + règles | Audit **exact** (colle au mien) → #33 ; décisions tranchées : **composite** + **B avant C** |

**Garde-fous déclenchés, tous justifiés** : blocage du **force-push** sur la branche
d'un autre agent (contourné par branche neuve) ; blocage des **migrations auto-choisies**
×3 (go obtenu à chaque fois). **La prod n'a jamais bougé sans accord explicite.**

---

## 8. En cours & non mergé

- **#33 (Studio)** — livré : rendu des tampons sur le pass Apple (formes vectorielles,
  fail-open, 762 verts). **À venir dans la même PR** : composite photo+tampons (décidé).
  **PR suivantes** : B (règles éditables dans le Studio) puis C (découvrabilité
  couleurs/images). *Aucune migration.*

---

## 9. Dettes & points ouverts (priorisés)

| Dette | Gravité | Action |
|---|---|---|
| `MARKETING_CONSENT_UPDATED` en prod mais pas dans le repo | 🟡 | Formaliser (ajout `AUDIT_ACTIONS` + migration) ou retirer |
| Builds **preview Vercel** échouent sur toutes les PR | 🟡 | Non bloquant (CI GitHub = juge) ; à réparer pour prévisualiser les PR |
| Studio : emojis/images de tampons non rendus sur le vrai pass | 🔵 | Itération ultérieure (formes en v1) |
| F4 (réveil dormants) / F5 (expiration) | 🔵 | Reportés sprint août |
| Publishing access Google Wallet | 🔵 | En attente (côté Google) |

---

## 10. État de santé final

- ✅ **Prod saine** — F1/F2/F3 en ligne, démo opérationnelle, Sentry actif.
- ✅ **Resend configuré** (clé + `EMAIL_FROM` en prod) → emails marchands fonctionnels.
- ✅ **Garde anti-drift schéma↔code** en CI.
- ✅ **8 migrations** alignées prod, **2 bugs prod** traqués via logs et corrigés.
- 🟡 1 dette d'historique (`MARKETING_CONSENT_UPDATED`) + previews Vercel.

**Conclusion** : socle solide et démontrable pour Genève. Le chantier restant immédiat
est #33 (tampons visibles sur la carte + règles éditables au même endroit), puis la
prospection. Rien ne touche la prod sans accord du fondateur.
