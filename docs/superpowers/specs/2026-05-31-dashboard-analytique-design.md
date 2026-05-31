# Spec — Module 1 : Dashboard analytique & rapports (marchand)

**Date** : 2026-05-31
**Statut** : Validé en brainstorming, à relire avant plan d'implémentation
**Périmètre** : Premier module de la future suite marketing du dashboard marchand.

---

## Contexte

Le dashboard marchand actuel est minimal (Vue d'ensemble, liste Clients, Scanner,
Paramètres). L'utilisateur veut en faire une **suite marketing/CRM complète**. Cette
suite a été découpée en 5 modules construits un par un (analytique → segmentation →
push wallet → campagnes → IA). **Ce document ne couvre que le Module 1 : Analytique &
Rapports**, choisi en premier car il apporte une valeur visible immédiate, ne dépend
d'aucun autre module, et valide la structure du dashboard avant d'empiler le marketing.

Objectif : donner au marchand un **dashboard analytique lisible et personnalisable**
pour piloter sa fidélisation (activité, rétention, clients à risque, adoption wallet),
avec des **exports** (PDF de synthèse + CSV de données).

## Décisions de cadrage (issues du brainstorming)

- **8 widgets**, tous livrés (détaillés plus bas).
- **Adaptation par marchand** : preset selon le **type de commerce** + **personnalisable**
  (le marchand affiche/masque/réordonne ses widgets).
- **« Temps réel »** = **rafraîchissement auto léger** (polling ~45 s), pas de websocket.
- **Exports** : **PDF** (synthèse) **et CSV** (données brutes).
- **Approche technique** : **calcul à la demande** (agrégations SQL exposées via API,
  consommées par des widgets client en polling). Pas de tables pré-agrégées pour l'instant.

## Hors périmètre (autres modules / plus tard)

- Segmentation, notifications push wallet, campagnes, offres anniversaire, rappels
  inactifs, suggestions IA → modules 2 à 5.
- Suivi fin des **récompenses échangées** et seuil de fidélité **par marchand**
  → arrivera avec le module « config fidélité » (le widget Récompenses utilise pour
  l'instant une approximation, voir plus bas).
- Tables de rollups pré-agrégées (optimisation future si le volume explose).

---

## Modèle de données

Tout se calcule sur les tables existantes (`customers`, `loyalty_cards`,
`scan_history`). Deux ajouts à `merchants` + des index.

**Migration `merchants` :**
- `business_type TEXT` — valeurs : `cafe | restaurant | boulangerie | boutique | salon | sport | autre`. Défaut `autre`.
- `dashboard_config JSONB` — config de personnalisation par marchand. Forme :
  ```json
  { "widgets": [ { "key": "kpis", "visible": true, "order": 0 }, ... ] }
  ```
  Initialisée selon `business_type` (preset) à la création / au premier accès.

**Index (performance des agrégations) :**
- `scan_history (merchant_id, scanned_at)`
- `customers (merchant_id, created_at)`
- `loyalty_cards (merchant_id)`

**Presets par métier** (ordre/visibilité par défaut des widgets) — table de mapping
en code (`src/lib/analytics/presets.ts`), p.ex. :
- `cafe | restaurant | boulangerie` → met l'**Affluence** et les **Visites** en avant.
- `boutique | salon` → met **Top clients** et **Acquisition** en avant.
- `sport` → **Actifs/inactifs** (assiduité) en avant.
- `autre` → ordre par défaut générique.

Tous les marchands démarrent avec **les 8 widgets visibles** ; le preset change juste
l'**ordre** (et pourra masquer par défaut un widget peu pertinent selon le métier).

---

## Les 8 widgets

Chaque widget = une fonction d'agrégation (`src/lib/analytics/<widget>.ts`) prenant
`merchantId` + `range` (`7j | 30j | 12m`), renvoyant un type dédié.

| # | Widget | Affiche | Source / calcul |
|---|--------|---------|-----------------|
| 1 | **KPIs clés** | Clients totaux (+ nouveaux période), visites/scans, % actifs, récompenses | `customers`, `scan_history`, `loyalty_cards` |
| 2 | **Visites dans le temps** | Courbe scans/jour (ou /mois en 12m) | `scan_history.scanned_at` groupé par jour |
| 3 | **Acquisition** | Nouveaux clients par période + courbe | `customers.created_at` |
| 4 | **Actifs vs inactifs** | Donut + taux de retour ; inactif = pas de scan depuis N jours (défaut 30) | `scan_history` / `loyalty_cards.last_scan` |
| 5 | **Top clients** | Classement par visites (ou points) | `scan_history` agrégé par customer |
| 6 | **Affluence** | Heatmap jours × heures des passages | `scan_history.scanned_at` (jour de semaine × heure) |
| 7 | **Adoption Wallet** | Répartition Apple / Google | `loyalty_cards.pass_type` |
| 8 | **Récompenses / cartes complétées** | Nb de cartes ayant atteint le seuil | `loyalty_cards.stamps_count >= seuil` |

**Limite connue (widget 8)** : le seuil de carte est aujourd'hui codé en dur (`/10`) et
les récompenses *échangées* ne sont pas tracées. Le widget compte les **cartes ayant
atteint le seuil** (seuil = 10 par défaut, paramétrable par marchand quand le module
config fidélité arrivera). Le suivi des échanges viendra avec ce module.

---

## Architecture & flux

```
Supabase/Postgres  →  src/lib/analytics/*  →  /api/analytics/*  →  widgets client (polling 45s, Recharts)
 (tables existantes)   (1 fn par métrique)     (JSON, RLS)          (dans /dashboard)
```

- **`src/lib/analytics/`** : une fonction par métrique, pure, scoping marchand via le
  client serveur Supabase (RLS existante). Petites, testables isolément.
- **`src/app/api/analytics/[widget]/route.ts`** (ou une route paramétrée
  `?widget=&range=`) : renvoie le JSON de la métrique. Auth marchand (session).
- **Dashboard `/dashboard`** : Server Component lit `dashboard_config` du marchand,
  rend la grille selon visibilité/ordre. Chaque widget est un **Client Component** qui
  fetch sa métrique et **poll toutes les ~45 s** (hook `useAnalytics(widget, range)`,
  ex. SWR avec `refreshInterval`).
- **Graphiques** : **Recharts** (nouvelle dépendance). Courbes, barres, donut, heatmap.
- **Sélecteur de période** global (7j / 30j / 12 mois) propagé aux widgets.
- **Personnalisation** : panneau « Personnaliser » → coche/décoche + réordonne
  (haut/bas, pas de drag-drop au départ — YAGNI) → écrit `dashboard_config`. Server
  Action ou route dédiée.

## Exports

- **CSV** : `GET /api/analytics/export/csv?type=clients|visites&range=` → streame les
  données brutes (RLS marchand). Simple et robuste. **Livré en premier.**
- **PDF** : rapport de synthèse (KPIs + graphes principaux d'une période) généré côté
  serveur avec **`@react-pdf/renderer`** (compatible serverless/Vercel, pas de
  navigateur headless). Pièce la plus lourde → **livré juste après le CSV**.

## Robustesse, perfs, erreurs

- **Index** ci-dessus pour garder les agrégations rapides.
- **Isolation des widgets** : chaque widget fetch indépendamment ; un échec affiche un
  état d'erreur local sans casser le reste du dashboard.
- **États vides** : nouveau marchand sans données → messages clairs (« pas encore de
  visites »), pas de graphes cassés.
- **Sécurité** : tout passe par la session marchand + RLS existante (un marchand ne voit
  que ses données). Les endpoints analytics refusent l'accès anonyme.

## Tests

- **Unitaires** sur chaque fonction `lib/analytics/*` : jeu de données semé → agrégats
  attendus (incl. bornes de période, fuseau, jours sans données).
- **Presets** : `business_type` → `dashboard_config` par défaut correct.
- **Exports** : CSV (entêtes + lignes), PDF (génère un binaire non vide pour une période).
- **Endpoints** : refus anonyme, scoping marchand.

## Plan de livraison suggéré (à détailler dans le plan d'implémentation)

1. Migration (`business_type`, `dashboard_config`, index) + presets.
2. `lib/analytics/*` (les 8 fonctions) + tests.
3. Endpoints `/api/analytics/*`.
4. Widgets client + grille dashboard + sélecteur période + polling (Recharts).
5. Panneau « Personnaliser » (config par marchand).
6. Export **CSV**.
7. Export **PDF** (`@react-pdf/renderer`).

## Points ouverts

- Confirmer le **seuil d'inactivité** (défaut 30 j) et le **seuil de carte** (défaut 10).
- Confirmer la liste exacte des **types de commerce** et leurs presets.
- Lib de graphes : **Recharts** par défaut (alternative : Chart.js) — à confirmer si
  préférence.
