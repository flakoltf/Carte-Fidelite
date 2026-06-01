# Module 2 — Segmentation auto des clients — Design

**Date :** 2026-06-01
**Statut :** Validé (brainstorming)
**Brique suivante :** plan d'implémentation (`writing-plans`)

## Objectif

Donner au marchand une vue qui **classe automatiquement ses clients en groupes parlants** (cycle de vie) à partir de leur comportement, sans aucune configuration. Chaque groupe est exploitable d'un coup d'œil et servira de **cible aux campagnes (Module 4)**.

## Décisions validées (brainstorming)

1. **Segments automatiques prédéfinis** (pas de constructeur de règles custom).
2. **1 stade de cycle de vie exclusif par client + étiquettes transverses cumulables.**
3. **Livrable : un onglet « Segments » dédié** (vue d'ensemble + drill-down + export CSV).
4. **Approche « à la volée »** : calcul à la lecture, fonctions pures testées, **aucune migration**, aucun stockage de segment. Toujours exact. Calque l'architecture du module analytique livré.

## Données disponibles (rappel)

- `customers` : `id`, `merchant_id`, `full_name`, `email` (nullable), `phone` (nullable), `created_at`.
- `loyalty_cards` : `id`, `customer_id`, `merchant_id`, `stamps_count`, `pass_type`, `last_scan`, `auth_token`, `created_at`.
- `scan_history` : `card_id`, `merchant_id`, `scanned_at`.
- `wallet_device_registrations` : `serial_number` (= id de carte), `push_token` — présence = carte joignable en push.

**Pas de montant d'achat** (système à tampons → pas de « M » monétaire) ni **de date de naissance** (les offres anniversaire du Module 4 viseront `created_at`).

## Modèle de données (agrégation par client)

La segmentation raisonne **par client** (le marchand pense en clients, pas en cartes). Pour chaque client, on agrège ses cartes :

| Statistique | Calcul |
|---|---|
| `visits` | Nombre total de scans (`scan_history`) sur les cartes du client |
| `lastScan` | `max(loyalty_cards.last_scan)` parmi ses cartes (peut être nul) |
| `tenureDays` | Jours depuis `customers.created_at` |
| `recencyDays` | Jours depuis `lastScan` ; **si jamais scanné**, jours depuis `created_at` (silencieux depuis l'inscription) |
| `maxStamps` | `max(loyalty_cards.stamps_count)` parmi ses cartes |
| `reachablePush` | Vrai si **au moins une** carte du client a une ligne dans `wallet_device_registrations` |

## Les 5 groupes de cycle de vie (exclusifs — 1 seul par client)

Évalués **dans cet ordre** (premier match gagne) :

| Ordre | Groupe | Règle |
|---|---|---|
| 1 | **Inactif** | `recencyDays > 90` |
| 2 | **En train de partir** | `30 < recencyDays ≤ 90` |
| 3 | **VIP** | actif (`recencyDays ≤ 30`) **et** `visits ≥ 10` |
| 4 | **Nouveau** | actif **et** `tenureDays ≤ 30` **et** `visits ≤ 2` |
| 5 | **Régulier** | actif, tout le reste (`3 ≤ visits ≤ 9`, ou ancien avec visites modérées) |

> Note : un client inscrit récemment qui n'a jamais été scanné a `recencyDays = tenureDays ≤ 30` → tombe en **Nouveau**. Un client inscrit il y a longtemps et jamais revenu → **Inactif**.

## Les 2 étiquettes transverses (cumulables avec n'importe quel groupe)

Booléens indépendants du cycle de vie, utiles pour le ciblage :

| Étiquette | Règle | Usage |
|---|---|---|
| **Récompense prête** | `maxStamps ≥ 10` | Faire revenir le client récupérer son cadeau |
| **Joignable en push** | `reachablePush = vrai` | Peut recevoir une notification Wallet gratuite (canal Module 3 livré) |

## Seuils (constantes, fixes pour cette version)

```
ACTIVE_DAYS       = 30   // vu ≤ 30j = actif/récent (aligné sur le dashboard)
AT_RISK_DAYS      = 90   // 30 < r ≤ 90 = en train de partir ; > 90 = inactif
NEW_TENURE_DAYS   = 30   // inscrit ≤ 30j
NEW_MAX_VISITS    = 2    // ≤ 2 visites = encore « nouveau »
VIP_MIN_VISITS    = 10   // ≥ 10 visites = VIP
REGULAR_MIN_VISITS = 3   // référence « régulier »
REWARD_THRESHOLD  = 10   // tampons (aligné sur la carte « X / 10 »)
```

Fixes (pas de réglage par marchand → YAGNI). Pourront devenir configurables plus tard.

## UI / UX — onglet « Segments »

- Nouvel onglet **« Segments »** dans la barre du dashboard (après « Clients »).
- **Vue d'ensemble** : cartes regroupées en deux familles —
  - *Cœur de clientèle* : Réguliers, VIP, Nouveaux
  - *À reconquérir* : En train de partir, Inactifs
  - chaque carte affiche **nom + effectif + % de la base**.
- Ligne **Étiquettes** : « Récompense prête : N » et « Joignable en push : N ».
- **Clic sur une carte de groupe** → liste des clients du groupe (nom, dernière visite, nb visites, tampons) + **export CSV** du groupe.
- **Lecture seule**, toujours à jour (recalcul à la volée). Pas de polling temps réel nécessaire (état courant, pas une série temporelle).

## Architecture (calquée sur `src/lib/analytics/`)

```
src/lib/segments/
  types.ts        # clés de segments, libellés, constantes/seuils
  classify.ts     # PUR : classifyCustomer(stats) -> { stage, flags } + agrégation pure
  fetch.ts        # fetchSegmentCounts(merchantId) ; fetchSegmentMembers(merchantId, segment)
  csv.ts          # PUR : sérialisation CSV des membres d'un groupe
  __tests__/*.test.ts

src/app/api/segments/route.ts              # GET -> compteurs + % par groupe + étiquettes
src/app/api/segments/[segment]/route.ts    # GET -> membres d'un groupe (scopé marchand)
src/app/api/segments/export/csv/route.ts   # GET ?segment= -> CSV

src/app/dashboard/segments/page.tsx        # vue d'ensemble (server) + drill-down
src/app/dashboard/segments/...             # composants client (cartes, liste)
src/app/dashboard/DashboardShell.tsx       # modifié : onglet « Segments »

src/lib/analytics/merchant.ts              # réutilisé : currentMerchantId()
```

- **Scoping marchand** obligatoire sur toutes les requêtes (RLS + `currentMerchantId()`), comme l'analytique.
- **Aucune migration** : on ne lit que des tables existantes.

## Stratégie de test (TDD, Vitest)

Logique **pure** testée d'abord :
- `classifyCustomer` : table de cas couvrant chaque groupe + bornes exactes (recency 29/30/31/90/91, visits 2/3/9/10, jamais scanné, inscrit ancien jamais revenu).
- Agrégation par client (plusieurs cartes : somme visites, max lastScan, max stamps, OR des registrations).
- Étiquettes (`maxStamps` 9/10, `reachablePush` vrai/faux).
- `csv.ts` : entêtes + échappement.

Les routes API et l'UI sont vérifiées par `npm run build` + fumée en dev (comme les modules livrés).

## Réutilisation par le Module 4 (Campagnes)

`classifyCustomer` et `fetchSegmentMembers(merchantId, segment)` sont le **moteur** que les campagnes appelleront pour résoudre « tous les clients du segment X » au moment de l'envoi (push Wallet déjà livré). Aucune duplication.

## Hors périmètre (YAGNI)

- Constructeur de règles personnalisées.
- Seuils réglables par marchand.
- Matérialisation / stockage des segments (colonne ou table) + job de refresh.
- Canaux email/SMS (les campagnes utiliseront le push Wallet livré).
- Segment / déclencheur « anniversaire » (relève du Module 4).
