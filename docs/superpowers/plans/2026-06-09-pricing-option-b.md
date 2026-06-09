# Vitrine — grille Option B — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mettre la section `#tarifs` de la vitrine à la grille Option B (Essentiel/Pro/Business 99/179/299) avec un découpage de fonctionnalités par palier, boutons vers `/contact`, découplé de Stripe.

**Architecture:** Modification d'un seul fichier — `src/app/(marketing)/page.tsx` : remplacer les données `PRICING`/`PLAN_FEATURES`, ajuster 2 lignes de copie (sous-titre + note de bas de section). Pas de logique → pas de test unitaire ; vérification par `tsc`/`lint`/`build` + contrôle visuel.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind. Composant `Link` (next/link) et icône `Check` déjà importés dans le fichier.

> ⚠️ **Node 22 obligatoire** pour npm/npx (`export NVM_DIR="$HOME/.nvm"; source "$NVM_DIR/nvm.sh"; nvm use 22 >/dev/null;`). Pour `npm run build`, ajouter `NODE_OPTIONS=--max-old-space-size=4096`. Base : branche `feat/pricing-option-b` (déjà créée depuis `origin/main`).

---

## Structure des fichiers
**À modifier (uniquement) :** `src/app/(marketing)/page.tsx`
- bloc données `PLAN_FEATURES` + `PRICING` (lignes ~76-116)
- sous-titre de la section `#tarifs` (ligne ~362)
- note de bas de section (lignes ~408-412)

Le rendu (la `.map` sur `PRICING`) n'a **pas** besoin de changer : il consomme déjà `name`, `tagline`, `price`, `unit`, `features[]`, `featured`, `href`, `cta`. On ne change que les **données** et **2 phrases**.

---

## Task 1 : Données de prix + fonctionnalités par palier

**Files:** Modify `src/app/(marketing)/page.tsx` (lignes ~76-116)

- [ ] **Step 1 : Remplacer le bloc `PLAN_FEATURES` + `PRICING`**

Remplacer EXACTEMENT ce bloc (la constante partagée `PLAN_FEATURES` et le tableau `PRICING`) :
```tsx
const PLAN_FEATURES = [
  "Toutes les fonctionnalités incluses",
  "Carte 100% à votre image",
  "Apple & Google Wallet (sans appli)",
  "Notifications push & de proximité",
  "Base clients & statistiques",
  "Mise en service offerte",
];

const PRICING = [
  {
    name: "Essentiel",
    price: "49",
    unit: "CHF / mois",
    tagline: "Jusqu'à 100 cartes actives",
    featured: false,
    cta: "Choisir",
    href: "/signup",
    features: PLAN_FEATURES,
  },
  {
    name: "Croissance",
    price: "89",
    unit: "CHF / mois",
    tagline: "Jusqu'à 500 cartes actives",
    featured: true,
    cta: "Choisir",
    href: "/signup",
    features: PLAN_FEATURES,
  },
  {
    name: "Premium",
    price: "149",
    unit: "CHF / mois",
    tagline: "Cartes actives illimitées",
    featured: false,
    cta: "Choisir",
    href: "/signup",
    features: PLAN_FEATURES,
  },
];
```

PAR ce bloc (la constante partagée disparaît ; chaque palier a ses propres features) :
```tsx
const PRICING = [
  {
    name: "Essentiel",
    price: "99",
    unit: "CHF / mois",
    tagline: "Jusqu'à 300 cartes actives",
    featured: false,
    cta: "Choisir",
    href: "/contact",
    features: [
      "Apple & Google Wallet (sans appli)",
      "Mises à jour illimitées",
      "Carte de fidélité à tampons",
      "Branding de base (logo + couleurs)",
      "2 campagnes push / mois",
      "Statistiques de base",
      "Support e-mail",
    ],
  },
  {
    name: "Pro",
    price: "179",
    unit: "CHF / mois",
    tagline: "Jusqu'à 1 200 cartes actives",
    featured: true,
    cta: "Choisir",
    href: "/contact",
    features: [
      "Tout l'Essentiel, plus :",
      "Toutes les mécaniques + multi-programmes",
      "Branding complet (visuels avancés)",
      "Notifications push illimitées + ciblage",
      "Statistiques avancées",
      "Support prioritaire",
    ],
  },
  {
    name: "Business",
    price: "299",
    unit: "CHF / mois",
    tagline: "Jusqu'à 4 000 cartes actives",
    featured: false,
    cta: "Choisir",
    href: "/contact",
    features: [
      "Tout le Pro, plus :",
      "Export des données",
      "White-label",
      "Support dédié + onboarding",
    ],
  },
];
```

- [ ] **Step 2 : Vérifier qu'aucune autre référence à `PLAN_FEATURES` ne subsiste**

Run: `grep -n "PLAN_FEATURES" "src/app/(marketing)/page.tsx"`
Expected: **aucun résultat** (la constante a été supprimée et n'était utilisée que dans `PRICING`). S'il en reste, corriger.

- [ ] **Step 3 : Typecheck**

Run: `export NVM_DIR="$HOME/.nvm"; source "$NVM_DIR/nvm.sh"; nvm use 22 >/dev/null; npx tsc --noEmit`
Expected: 0 erreur.

- [ ] **Step 4 : Commit**

```bash
git add "src/app/(marketing)/page.tsx"
git commit -m "feat(vitrine): grille Option B + fonctionnalités par palier

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2 : Copie de la section (sous-titre + note de bas)

**Files:** Modify `src/app/(marketing)/page.tsx` (sous-titre ~ligne 362, note ~lignes 408-412)

- [ ] **Step 1 : Mettre à jour le sous-titre** (il affirme à tort que tout est dans chaque palier)

Remplacer :
```tsx
            <p className="mt-4 text-galet-ink">Sans matériel. Toutes les fonctionnalités dans chaque palier — le prix évolue simplement avec votre nombre de cartes actives.</p>
```
Par :
```tsx
            <p className="mt-4 text-galet-ink">Sans matériel. Le palier évolue avec votre nombre de cartes actives et les fonctionnalités dont vous avez besoin.</p>
```

- [ ] **Step 2 : Mettre à jour la note de bas de section** (ajout setup + multi dégressif)

Remplacer :
```tsx
            <p className="mt-8 text-center text-sm text-galet-ink">
              Engagement annuel : <span className="text-onyx">2 mois offerts</span>.
              <br />
              Plusieurs commerces ? <span className="text-onyx">Tarif sur demande</span>, établi selon votre réseau de points de vente.
            </p>
```
Par :
```tsx
            <p className="mt-8 text-center text-sm text-galet-ink">
              Engagement annuel : <span className="text-onyx">2 mois offerts</span>. Mise en service <span className="text-onyx">250 CHF</span> — offerte en annuel et pour les partenaires de lancement.
              <br />
              Plusieurs commerces ? <span className="text-onyx">Tarif dégressif sur devis</span>, dès +99 CHF / établissement.
            </p>
```

- [ ] **Step 3 : Typecheck**

Run: `export NVM_DIR="$HOME/.nvm"; source "$NVM_DIR/nvm.sh"; nvm use 22 >/dev/null; npx tsc --noEmit`
Expected: 0 erreur.

- [ ] **Step 4 : Commit**

```bash
git add "src/app/(marketing)/page.tsx"
git commit -m "feat(vitrine): copie tarifs — setup 250 CHF + multi dégressif + sous-titre

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3 : Vérification complète + push

**Files:** aucun (vérification)

- [ ] **Step 1 : Lint + typecheck + build (comme le CI, Node 22)**

```bash
export NVM_DIR="$HOME/.nvm"; source "$NVM_DIR/nvm.sh"; nvm use 22 >/dev/null
npm run lint && npx tsc --noEmit && NODE_OPTIONS=--max-old-space-size=4096 npm run build
```
Expected : lint 0 erreur (warnings préexistants OK), tsc 0 erreur, build réussi, la page `/` (marketing) compile.

- [ ] **Step 2 : Contrôle visuel des libellés** (pas de test unitaire pour du contenu)

Run: `grep -nE "99|179|299|300 cartes|1 200|4 000|/contact|250 CHF|\\+99" "src/app/(marketing)/page.tsx" | head`
Expected : on retrouve les 3 prix, les 3 plafonds, `/contact` (×3), `250 CHF`, `+99`. Confirme qu'aucune ancienne valeur (49/89/149, /signup) ne subsiste : `grep -nE "\"49\"|\"89\"|\"149\"|/signup" "src/app/(marketing)/page.tsx"` → **aucun résultat**.

- [ ] **Step 3 : Pousser la branche**

```bash
git push -u origin feat/pricing-option-b
```
Expected : branche poussée. (Un build preview Vercel peut se déclencher ; sans incidence sur la prod.)

---

## Mise en ligne (hors de ce plan)
Pour que la nouvelle grille soit **live**, la branche doit atteindre `main` (cible prod) : ouvrir une PR `feat/pricing-option-b` → `main`, vérifier le CI vert, merger. (Le déploiement prod se fait depuis `main`.)

## Réconciliation future (Stripe)
Quand `feat/stripe-paywall` s'activera : aligner sa `src/lib/billing/plans.ts` sur 99/179/299 + caps 300/1200/4000 + libellés Essentiel/Pro/Business, et remplacer le bouton `/contact` par le `ChoosePlanButton`. Conflit attendu sur la section `#tarifs` (les deux branches l'éditent) — résoudre en gardant l'Option B + le bouton checkout.
