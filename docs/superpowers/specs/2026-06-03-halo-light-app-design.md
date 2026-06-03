# HALO Light — refonte design de l'app (Lot 1 : login + dashboard)

> Date : 2026-06-03
> Statut : Validé (design) — prêt pour le plan d'implémentation
> Branche : `feat/public-enrollment`

## 1. Contexte & problème

Le produit a aujourd'hui **deux identités** :

- **La landing (vitrine)** est en pleine identité **HALO** : fond sombre Onyx, accent émeraude, titres serif (Fraunces), ton élégant et vibrant.
- **L'intérieur du produit** (login, dashboard, admin, scan, enrôlement) est resté en **« WalletCard »** : palette sombre générique (classes `zinc-*` codées en dur), icône portefeuille verte, aucune trace de la marque HALO.

Cette incohérence casse la promesse premium de HALO dès que le commerçant se connecte. On veut **unifier l'identité HALO sur tout le produit**, de façon **progressive** (décision : objectif global, déploiement par lots), en **commençant par les écrans les plus vus**.

## 2. Objectif & périmètre

**Objectif global :** porter l'identité HALO sur l'ensemble de l'app, en mode **clair (« day mode »)** — distinct de la vitrine sombre, pensé pour l'usage en boutique en journée.

**Périmètre de CE lot (Lot 1) :**

1. **Page de connexion** — `src/app/login/page.tsx`
2. **Shell du dashboard** — `src/app/dashboard/DashboardShell.tsx` (barre latérale, logo, navigation) + `src/app/dashboard/layout.tsx`
3. **Page Vue d'ensemble** — `src/app/dashboard/page.tsx` et ses widgets analytics (KPIs, courbe des visites, donut actifs/inactifs, acquisition…)

**Hors périmètre (lots suivants, même système) :** Clients, Segments, Campagnes, Notifications, Scanner, Paramètres, espace Admin, pages publiques d'enrôlement. La **landing reste inchangée** (sombre).

## 3. Décisions de design

### 3.1 Identité

- Le composant **`HaloMark`** (cercle + glint émeraude, déjà existant dans `src/components/halo/`) **remplace** l'icône portefeuille + le mot « WalletCard » partout dans l'app (sidebar, login).
- Wordmark « HALO » en Fraunces, lettres espacées.

### 3.2 Palette HALO Light

| Rôle | Couleur | Hex |
|------|---------|-----|
| Fond application | Calcaire (token existant) | `#F3F0E9` |
| Surfaces (cartes, panneaux) | Blanc | `#FFFFFF` |
| Texte principal | Onyx | `#0E0F11` |
| Texte secondaire | Galet encre | `#6E7073` |
| Action / CTA / liens / sélection | Émeraude | `#0D6B5E` |
| Hover action | Émeraude foncé | `#0A574C` |
| Accent / surbrillance / data viz | Émeraude glow | `#1FB89A` |
| Bordures & séparateurs | Ligne chaude | `#E6E1D5` |
| Succès | Émeraude | `#0D6B5E` |
| Avertissement | `#E8B964` |
| Danger / destructif | `#E2513A` |

Esprit : base claire et chaude (calcaire/blanc), électrisée par le **seul accent émeraude**. Ombres très douces (`0 1px 2px rgba(14,15,17,.04)`), rayons généreux (cartes `rounded-xl`/`2xl`).

### 3.3 Typographie — *déjà en place*

- **Fraunces** (`--font-display`) : **uniquement** les grands titres de page (ex. « Bonjour, Café Démo », « Bon retour parmi nous »).
- **Inter** (`--font-sans`) : toute l'UI, les libellés, les données, les chiffres des KPIs.
- Aucune police à ajouter : `layout.tsx` charge déjà Fraunces + Inter via `next/font/google`.

## 4. Approche technique

### 4.1 Tokens

Ajouter au bloc `@theme` de `src/app/globals.css` les tokens light manquants (les autres existent déjà : `onyx`, `calcaire`, `halo`, `halo-glow`) :

```css
--color-surface: #FFFFFF;       /* cartes / panneaux */
--color-line-warm: #E6E1D5;     /* bordures sur fond clair */
--color-galet-ink: #6E7073;     /* texte secondaire lisible sur clair */
```

`--color-calcaire` (`#F3F0E9`) est **conservé tel quel** : il sert aussi de texte clair sur la landing sombre, le modifier risquerait une régression. On l'utilise comme fond d'app.

### 4.2 Application du thème (ne pas casser la landing)

- Le thème clair est appliqué **au conteneur des routes app** (login + `dashboard/layout.tsx`), via des classes explicites `bg-calcaire text-onyx`, **pas** via `prefers-color-scheme`.
- ⚠️ `globals.css` contient une règle `@media (prefers-color-scheme: dark)` qui bascule `--background`/`--foreground` du `body`. Pour éviter qu'un OS en mode sombre ne « tache » l'app claire, **chaque conteneur d'app pose un fond explicite** (`bg-calcaire`) plutôt que de s'appuyer sur le `body`.
- La landing continue de poser explicitement son fond sombre (`bg-onyx`) → **inchangée**.

### 4.3 Travail par écran

**Login (`login/page.tsx`)** : remplacer la carte sombre par une carte blanche sur fond calcaire ; `HaloMark` + wordmark « HALO » ; titre « Bon retour parmi nous » en Fraunces avec « parmi nous » en émeraude ; champs doux (`bg` crème, bordure chaude, focus émeraude) ; bouton « Se connecter » émeraude plein. Conserver le texte « Les comptes marchands sont créés par l'administrateur ». États : focus visibles (ring émeraude), erreur sous le champ, bouton en chargement.

**Shell dashboard (`DashboardShell.tsx` + `layout.tsx`)** : sidebar claire (`#EFEBE1`, bordure chaude) ; `HaloMark` + « HALO » en tête ; items de nav en galet encre, item actif en pill émeraude plein (texte blanc) ; lien Déconnexion en bas. Fond de page calcaire.

**Vue d'ensemble (`dashboard/page.tsx` + widgets)** : grand titre Fraunces ; cartes KPI blanches (libellé en petites capitales galet, valeur en Inter bold onyx, delta en émeraude) ; restyler les widgets Recharts (courbe/aires en émeraude `#0D6B5E`/glow, grille très claire, donut actifs en émeraude / inactifs en galet clair) ; boutons de période et export (CSV/PDF/Personnaliser) en style clair.

## 5. Composants & cohérence

Définir un petit langage réutilisable (classes utilitaires Tailwind ou composants légers) pour : **carte** (`bg-surface border-line-warm rounded-xl shadow-sm`), **KPI**, **bouton primaire** (émeraude) / **secondaire** (bordure chaude), **pill de nav active**. Ces primitives serviront aux lots suivants → la cohérence est posée dès le Lot 1.

## 6. Tests / validation

- **Pas de nouvelle logique pure** → pas de tests Vitest pour ce lot (refonte purement visuelle/CSS).
- Validation :
  1. **Build propre** (`next build`) sans erreur TS/ESLint.
  2. **Captures Playwright avant/après** du login et du dashboard (vérif visuelle), comme pour le pricing.
  3. Contrôle **contraste WCAG** sur fond clair : texte onyx sur calcaire/blanc, émeraude sur blanc pour les CTA (≥ 4.5:1).
  4. Vérifier le rendu en **OS dark mode** (le fond explicite doit tenir).

## 7. Risques & points d'attention

- **Recharts** : les couleurs sont passées en props/CSS — repérer où elles sont définies pour les widgets et basculer en émeraude/glow sur fond clair.
- **Régression landing** : ne toucher ni `app/page.tsx` ni les composants `landing/*` ; vérifier que la landing reste sombre après ajout des tokens.
- **WIP encaissement en cours** (`RedeemCell.tsx`, `customers/page.tsx`) : hors périmètre Lot 1, ne pas y toucher.
- **`/login` et le CTA landing** : l'inscription publique est fermée (`/signup` redirige) — non bloquant pour ce lot, mais à garder en tête pour les lots suivants.

## 8. Lots suivants (vision)

Lot 2 : Clients + Segments. Lot 3 : Campagnes + Notifications + Scanner. Lot 4 : Paramètres + Admin. Chaque lot réutilise les primitives posées au Lot 1.
