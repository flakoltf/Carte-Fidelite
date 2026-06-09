# Vitrine — grille tarifaire Option B (en ligne, découplée de Stripe)

- **Date** : 2026-06-09
- **Branche** : `feat/pricing-option-b` (depuis `origin/main` = vitrine live + cible prod)
- **Statut** : conçu, validé, en attente d'implémentation
- **Périmètre** : mise à jour **marketing** de la section `#tarifs` de la vitrine. Aucun lien avec le checkout Stripe (qui reste sur `feat/stripe-paywall`, débranché).

## 1. Objectif
Remplacer l'ancienne grille (Essentiel 49 / Croissance 89 / Premium 149) par la grille **Option B** validée, et **afficher le découpage de fonctionnalités par palier** (aujourd'hui la vitrine montre la même liste pour les 3 paliers). But : permettre la vente porte-à-porte avec la bonne offre, immédiatement, sans attendre Stripe.

## 2. État actuel (base `main`)
`src/app/(marketing)/page.tsx` contient un tableau `PRICING` (champs `name`, `price`, `tagline`, `featured`, `cta`, `href: "/signup"`, `features`) et une constante `PLAN_FEATURES` **partagée par les 3 paliers** (donc aucun gating affiché). Le rendu mappe `PRICING` dans la section `#tarifs`. Une ligne « Plusieurs commerces ? Tarif sur demande » existe déjà.

## 3. Grille cible (Option B)
| Palier | Prix | Cartes actives |
|---|---|---|
| Essentiel | 99 CHF/mois | jusqu'à 300 |
| **Pro** *(featured)* | 179 CHF/mois | jusqu'à 1 200 |
| Business | 299 CHF/mois | jusqu'à 4 000 |
| Multi-établissements | sur devis — dès +99 CHF/établ. | — |

Mentions : **« Mise en service 250 CHF — offerte en annuel et pour les partenaires de lancement »** ; **annuel : 2 mois offerts** ; sans engagement.

## 4. Tableau de fonctionnalités par palier (gating corrigé — affichage)
| Fonctionnalité | Essentiel | Pro | Business |
|---|---|---|---|
| Apple + Google Wallet | ✅ | ✅ | ✅ |
| Mises à jour illimitées | ✅ | ✅ | ✅ |
| Mécanique de fidélité | Tampons (1 programme) | Toutes + multi-programmes | Toutes + multi-programmes |
| Branding | De base (logo + couleurs) | Complet (visuels avancés) | White-label |
| Notifications push | Limité (2/mois) | Illimité + ciblage | Illimité + ciblage |
| Statistiques | De base | Avancées | Avancées + export |
| Support | E-mail | Prioritaire | Dédié + onboarding |

**Défauts retenus** : mécanique Essentiel = tampons ; push Essentiel = 2/mois ; setup = 250 CHF.

## 5. Approche d'implémentation
- Remplacer les **valeurs** du tableau `PRICING` (noms, prix, taglines, `featured` sur Pro).
- Remplacer la liste `PLAN_FEATURES` partagée par une **structure par palier** : chaque palier porte sa propre liste de lignes « ✅/—/texte » selon le tableau §4 (soit un sous-tableau de features par plan, soit une matrice de comparaison sous les cartes). Choix d'implémentation : **liste de features propre à chaque carte** (la plus simple, cohérente avec le rendu actuel en cartes), chaque ligne formulée pour communiquer le niveau (ex. « Push : 2 campagnes/mois » sur Essentiel, « Push illimité + ciblage » sur Pro/Business).
- Ajouter le **bandeau setup + annuel** dans l'en-tête de la section `#tarifs`.
- Mettre à jour la ligne **multi-établissements** : « dès +99 CHF/établissement ».
- Boutons : `href: "/signup"` → **`href: "/contact"`** (page existante), libellé « Choisir » conservé. (Pas de checkout : c'est volontaire, découplé de Stripe.)
- Ne **rien** changer d'autre (hero, features produit, témoignages, footer, métadonnées).

## 6. Hors périmètre
- Le **checkout Stripe** (branche `feat/stripe-paywall`). Quand il s'activera : aligner sa `plans.ts` sur 99/179/299 + caps 300/1200/4000 + libellés Essentiel/Pro/Business, et remplacer le bouton `/contact` par le `ChoosePlanButton`. (Réconciliation triviale, documentée ici.)
- Le **gating réel côté produit** (dashboard/app qui active/désactive les fonctionnalités selon le palier payé) : chantier backend séparé, non couvert. Ici on ne change que **l'affichage** de l'offre sur la vitrine.

## 7. Vérification
`tsc --noEmit` + `npm run lint` (0 erreur) + `npm run build`, sous **Node 22** (avec `NODE_OPTIONS=--max-old-space-size=4096` pour le build). Vérif visuelle : la section `#tarifs` affiche 3 paliers Essentiel/Pro/Business aux nouveaux prix + le tableau de fonctionnalités différencié + le bandeau setup ; boutons → `/contact`.
