# Blueprint de la partie Admin — HALO

> **Type** : document-index (blueprint). Il cartographie TOUTE la surface admin pour
> ne rien oublier. Il ne se construit pas d'un bloc : chaque module aura ensuite son
> propre spec → plan → implémentation.
> **Date** : 2026-06-07 · **Statut** : validé (brainstorming)

## Contexte — pourquoi ce document

HALO a un MVP admin fonctionnel (création/édition de marchands, éditeur de carte,
impersonation « mode concierge », alertes anti-fraude en lecture seule, journal
d'audit qui logge sans écran de consultation). Le fondateur démarche maintenant ses
premiers clients commerçants à Genève. Avant de construire la suite « au fil de
l'eau », on a besoin d'une **carte complète** de l'admin : tous les modules, toutes
les situations et cas limites, et une **frontière claire** avec un second agent qui
développe en parallèle l'éditeur de carte. Objectif : ne rien oublier et bâtir dans
le bon ordre (priorité go-to-market).

## Objectifs / Non-objectifs

**Objectifs**
- Lister exhaustivement les modules admin et, pour chacun, but / écrans / situations.
- Fixer l'architecture de navigation et le cycle de vie marchand (socle des situations).
- Délimiter le territoire de l'autre agent (anti-collision).
- Donner un ordre de construction priorisé go-to-market.

**Non-objectifs**
- Spécifier en détail chaque module (chacun aura son spec dédié).
- Concevoir l'éditeur de carte (territoire de l'autre agent).
- Intégrer Stripe maintenant (facturation manuelle au lancement, intégrable plus tard).
- RBAC / multi-utilisateurs (admin = fondateur seul pour l'instant).

## Hypothèses

- **Admin = super-admin unique** (le fondateur) au début.
- **Facturation manuelle** (modèle Excel + bon de commande) au lancement.
- **Contexte suisse / nLPD** : HALO est sous-traitant des données clients finaux.
- **Lancement imminent**, démarchage en cours → lentille de priorité = signer & livrer.

## Architecture de navigation (hybride)

Sections globales pour le transversal + fiche marchand riche à onglets pour le par-marchand.

```
ADMIN (super-admin)
├─ Tableau de bord
├─ Marchands (liste)
│   └─ Fiche marchand [id] (onglets) :
│        • Vue d'ensemble / Insights
│        • Carte                ⛔ AUTRE AGENT
│        • Abonnement & facturation
│        • Clients & cartes
│        • Support / Actions
│        • Journal (audit du marchand)
│        • Paramètres
├─ Facturation (transversal)
├─ Anti-fraude (transversal)
├─ Audit (transversal)
└─ Réglages
```

## Frontière avec l'autre agent (anti-collision)

- **À l'autre agent** : tout `src/app/admin/merchants/[id]/card/**`, `src/lib/cardDesign/**`,
  `src/lib/wallet/googleClass`, et l'API `api/admin/merchants/[id]/card-design/**`
  (éditeur, logo, strip/hero, aperçus Apple/Google, sync wallet).
- **À moi** : tout le reste de l'admin (liste, fiche & onglets hors « Carte »,
  facturation, fraude, audit, réglages) + `api/admin/**` hors `card-design`.
- L'onglet « Carte » est un simple **lien** vers son écran.
- **Point de synchro obligatoire** : le module *Enseignes* (B8) déplacera la clé du
  `card_design` de `merchant` → `enseigne`. À NE PAS faire unilatéralement — à
  coordonner avec lui (raison pour laquelle B8 est planifié après la vague 1).

## Cycle de vie d'un marchand (socle des situations)

Chaque module se décline selon l'état du marchand.

| État | Sens | Déclenche |
|---|---|---|
| Prospect | lead pas encore créé (reste dans le CRM Excel) | hors admin / « créer depuis lead » |
| Onboarding | compte créé, carte/enrôlement pas prêts | checklist d'activation |
| Essai | 2 mois offerts en cours | compte à rebours, relance avant fin |
| Actif | payant, à jour | nominal |
| Impayé | échéance dépassée | relance → suspension auto |
| Suspendu | bloqué (impayé / fraude / manuel) | enrôlement coupé, accès lecture seule |
| Résilié / Churn | a quitté | archivage, win-back |
| Supprimé (nLPD) | données effacées sur demande | anonymisation + preuve |

Orthogonal : flag **mode concierge** (géré par HALO vs par le marchand) — existe déjà.

## Catalogue des modules

Priorité : 🟢 maintenant · 🟡 bientôt · 🔵 plus tard.

### A. Modules globaux

**A1 · Tableau de bord** 🟢 *(existe — enrichir)*
But : savoir quoi faire aujourd'hui. Écrans : stats + bloc « À faire » (essais < 7 j,
impayés, onboarding incomplet, alertes fraude) + marchands récents. Situations : 0
marchand (vide + CTA), aucune alerte (sain), beaucoup d'alertes (tri), chargement,
erreur de requête (carte dégradée).

**A2 · Marchands — liste** 🟢 *(existe — enrichir)*
But : trouver/trier tous les marchands. Actions : recherche (nom/email/IDE), filtres
(état, palier, mode concierge, type, ville), tri, pagination, créer. Situations : 0
résultat, liste très longue (pagination), marchand sans carte (badge « à finir »),
suspendu (distinct), export CSV de la liste filtrée.

**A3 · Facturation (transversal)** 🟡
But : piloter le revenu sans Stripe. Écrans : tous les abonnements, impayés,
échéances, essais qui finissent. Actions : marquer payé/impayé, générer facture (lien
modèle), changer palier, relancer. Situations : essai → payant (J+60), impayé →
relances J+7/J+14 → suspension auto, changement de palier en cours de mois (prorata à
décider), TVA assujetti Oui/Non, multi-commerces « tarif sur demande », remboursement
(non par défaut, cf. CGV), litige.

**A4 · Anti-fraude (transversal)** 🟡 *(vue existe, actions à ajouter)*
But : voir ET agir. Actions : ouvrir alerte, suspendre / ignorer / liste blanche, voir
les scans incriminés. Situations : faux positif (ignorer + raison), récidiviste
(escalade), auto-suspension sur seuil, fort volume légitime (whitelist), config des
seuils (🔵 plus tard).

**A5 · Audit (transversal)** 🟡 *(logs existent, AUCUN écran)*
But : qui a fait quoi, quand. Écrans : journal filtrable (marchand, action, période,
acteur), détail. Situations : gros volume (pagination + index), actions sensibles mises
en évidence (impersonation, suppression), export pour preuve, immuabilité (lecture seule).

**A6 · Réglages** 🔵
But : régler sans redéployer. Écrans : défauts système (cooldown, seuils segments),
feature flags, modèles d'e-mails, intégrations (clés), gestion d'équipe & permissions
(🔵). Situations : flag qui casse une fonctionnalité (réversible), secret masqué, modif
tracée à l'audit.

### B. Modules de la fiche marchand

**B1 · Vue d'ensemble / Insights** 🟢
But : santé d'un marchand. Écrans : KPIs (clients, cartes actives, scans 30 j,
rétention, récompenses), checklist d'activation (carte ? QR affiché ? 1er client ? 1er
scan ?), mini-courbe d'activité. Situations : tout neuf (0 donnée → guide), activité
faible (à risque), churné (bandeau + win-back).

**B2 · Carte** ⛔ *(autre agent)* — onglet = lien vers son éditeur.

**B3 · Abonnement & facturation (du marchand)** 🟡
But : état financier d'un marchand. Écrans : palier, fin d'essai, factures, statut de
paiement. Actions : changer palier, prolonger l'essai, suspendre/réactiver. Situations :
impayé (bandeau + actions), upgrade/downgrade, essai prolongé (geste tracé).

**B4 · Clients & cartes (du marchand)** 🟢
But : voir la base client + support de 1er niveau. Écrans : liste clients/cartes,
recherche par e-mail/téléphone, détail d'une carte (tampons, dernier scan, état).
Situations : client mécontent (retrouver vite), carte perdue (réémettre), doublon,
demande nLPD d'un client final (export/suppression — marchand responsable, HALO
sous-traitant), client introuvable.

**B5 · Support / Actions** 🟢
But : intervenir manuellement proprement. Actions : ajuster points/tampons (avec
raison), réémettre carte, renvoyer identifiants, renvoyer QR, impersonation (existe),
prolonger essai. Situations : correction d'erreur (tracée à l'audit), geste commercial,
garde-fou anti-abus (limites + tout loggé), action sur marchand suspendu (autorisée ?).

**B6 · Journal (du marchand)** 🟡 — l'audit (A5) filtré sur ce marchand (réutilise A5).

**B7 · Paramètres marchand** 🟢 *(existe en partie)*
But : config + actions de cycle de vie. Actions : branding, programme de fidélité,
rotation de token (existe), suspendre, résilier, supprimer (nLPD), basculer mode
concierge. Situations : suspension (raison obligatoire + enrôlement coupé), suppression
(confirmation forte + anonymisation + preuve + sort des cartes clients existantes),
rotation de token (invalide les anciens QR — avertir).

**B8 · Enseignes & établissements (multi-établissements)** 🟡 *(changement structurel)*
But : gérer une enseigne multi-boutiques avec UNE carte de marque. Modèle : entité
**Enseigne** ; les marchands actuels deviennent des **établissements** rattachés
(`organisation_id`) ; un commerce indépendant = enseigne à 1 établissement (UI masque
la complexité). Carte & abonnement au niveau enseigne ; scan attribué à l'établissement.
Écrans : onglet « Établissements » (ajouter/retirer une boutique, QR par boutique,
stats par boutique + consolidées). Situations : fidélité cumulée entre boutiques (1
carte), ajout/fermeture d'une boutique, facture groupe (tarif sur demande), client qui
scanne dans 2 boutiques, migration indépendant → enseigne.
⚠️ Déplace la clé du `card_design` `merchant` → `enseigne` : coordination autre agent.

**B9 · Parrainage client → client** 🟡
But : fonctionnalité vendue au marchand (le client parraine un ami, les deux
récompensés). Côté admin : activer/configurer par enseigne (récompense parrain +
filleul, type, plafond), suivi (parrainages, taux), garde-fous. Situations :
auto-parrainage / faux comptes (anti-abus), filleul qui ne qualifie jamais (récompense
conditionnée au 1er scan), filleul déjà client, expiration, plafond atteint, marchand
qui désactive en cours.
Note : le déclencheur (lien/code à l'enrôlement) est côté parcours client → à coordonner
avec l'enrôlement ; l'admin n'en fait que la config + le suivi.

### C. Modules transverses « plateforme »

**C1 · Annonces aux marchands** 🔵 — bandeau in-app ciblé (tous / un palier / un
marchand), accusé de lecture, programmation.

**C2 · Export de données** 🟡 — export marchands/clients/factures en CSV, export nLPD
d'un sujet, gros volume (asynchrone).

**C3 · Recherche globale (palette ⌘K)** 🔵 — saut rapide vers marchand/client/facture.

## Préoccupations transverses (tous les modules)

- **Rôles** : admin binaire aujourd'hui ; RBAC/équipe = plus tard (placeholder).
- **États d'UI universels** : chargement, vide, erreur (carte dégradée, jamais page
  blanche), action interdite, confirmation pour actions destructrices, optimistic UI +
  rollback.
- **Conformité nLPD** : export & suppression/anonymisation d'un sujet, audit immuable,
  rétention compta 10 ans, statut sous-traitant (marchand responsable).
- **Sécurité** : ré-authentification pour actions sensibles (suppression, impersonation),
  rate-limits, tout tracé à l'audit.
- **Réutilisation existante** (ne pas réinventer) : `src/lib/adminAuth`, `src/lib/auditLog`,
  `src/lib/antifraud`, `src/lib/merchant-config`, `src/lib/loyalty`, `EnrollmentQR`.
- **i18n** : français (Suisse).

## Implications data-model (à confirmer au spec de chaque module)

- **Cycle de vie** : ajouter un champ `status` au marchand (enum des 8 états) + champs
  dérivés (`trial_ends_at`, `suspended_reason`, `suspended_at`).
- **Enseignes** (B8) : table `organisations` + `merchants.organisation_id` (nullable =
  indépendant) ; `card_design` et l'abonnement remontent au niveau enseigne ;
  `scan_history` garde l'attribution établissement.
- **Facturation** : table `subscriptions` (palier, statut, période, échéances) + table
  `invoices` (ou suivi léger) — minimal au début, compatible Stripe plus tard.
- **Parrainage** (B9) : table `referrals` (parrain, filleul, statut, récompense) + config
  par enseigne.
- **Audit** : la table existe ; A5 = uniquement la couche lecture/UI.

## Ordre de construction (lentille go-to-market)

| Vague | Modules | Pourquoi |
|---|---|---|
| **1 — Signer & livrer** 🟢 | A2 recherche/filtre · B1 insights · B4 clients&cartes · B5 support · A1 « à faire » | sert le démarchage + le suivi des 1ers clients |
| **2 — Gérer & sécuriser** 🟡 | B7 suspension/suppression+nLPD · A5 visionneuse audit · A4 actions fraude · A3/B3 facturation manuelle · C2 export | robustesse avec de vrais clients |
| **3 — Scaler & croître** 🔵 | B8 enseignes/établissements · B9 parrainage · C1 annonces · A6 réglages/flags · C3 ⌘K · RBAC | volume & équipe |

## Prochaines étapes

1. Le fondateur relit ce blueprint.
2. On choisit le premier module de la vague 1 (recommandé : **A2 recherche/filtre**, le
   plus rapide et immédiatement utile au démarchage).
3. Ce module passe en `writing-plans` → implémentation, sur une branche dédiée isolée du
   territoire de l'autre agent.
4. On répète module par module, en gardant ce blueprint comme index.
