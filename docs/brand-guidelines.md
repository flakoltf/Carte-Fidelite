# HALO — Brand Guidelines v1.0

> Last updated: 2026-05-29
> Status: Validé (identité de base)
> Produit : Plateforme de cartes de fidélité numériques (white-label) — Genève

## Quick Reference

| Element | Value |
|---------|-------|
| Primary Color | #0D6B5E (Emerald) |
| Secondary Color | #0E0F11 (Onyx) |
| Accent Color | #1FB89A (Emerald Glow) |
| Primary Font | Canela |
| Body Font | Söhne |
| Voice | Clair, Élégant, Vibrant |
| Tagline (B2B) | Une plateforme. Toutes les fidélités. |
| Tagline (client final) | Entrez dans le cercle. |

---

## 0. Essence de marque

**HALO** est une plateforme qui permet à n'importe quel commerçant — du café de quartier à la boutique du centre — de lancer sa **carte de fidélité numérique**, à son image, dans Apple & Google Wallet, sans application à télécharger.

Le nom porte le symbole : le **halo**, le cercle de lumière. Il évoque l'appartenance (le cercle), la valeur (l'éclat), et le rayonnement de l'enseigne qui fidélise sa clientèle.

### Positionnement (la promesse)

> HALO donne à chaque commerce les outils de fidélisation des grandes enseignes — avec l'élégance suisse en plus. Une carte numérique soignée, à votre image, prête en quelques minutes : sans appli, sans matériel, sans complexité. À Genève comme ailleurs, HALO transforme un client de passage en habitué.

### Les 3 mots-clés directeurs

- **CLAIR** — Un commerçant comprend l'intérêt en 30 secondes. Zéro jargon, zéro friction. La simplicité est un produit.
- **ÉLÉGANT** — L'outil est beau et soigné ; il valorise le commerçant et flatte son client. Héritage du design suisse : chaque détail est intentionnel.
- **VIBRANT** — Moderne, vivant, énergique. La lumière qui bouge (holographie, motion, accent émeraude). On évite le luxe poussiéreux et le SaaS froid.

---

## 1. Color Palette

Une base presque monochrome — sobre, premium, intemporelle — électrisée par un seul accent jewel-tone : l'émeraude. Le calme rend l'accent désirable.

### Primary Colors

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| **Emerald** | #0D6B5E | rgb(13,107,94) | Couleur de marque & d'action : CTA, liens, sélection, accent émeraude. |
| **Emerald Dark** | #08544A | rgb(8,84,74) | États hover, emphase, profondeur. |
| **Emerald Light** | #1FB89A | rgb(31,184,154) | Lueur, glint du logo, surbrillance, halos lumineux. |

### Secondary Colors

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| **Onyx** | #0E0F11 | rgb(14,15,17) | Base sombre : fonds, texte sur clair, surfaces premium, la carte. |
| **Onyx Dark** | #060709 | rgb(6,7,9) | Ombres profondes, dégradés. |
| **Onyx Light** | #2A2C30 | rgb(42,44,48) | Surfaces sombres surélevées, cartes, séparateurs sur fond noir. |

### Accent Colors

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| **Emerald Glow** | #1FB89A | rgb(31,184,154) | Accent lumineux (le « halo ») : highlights, états actifs, lueur de progression. |

### Neutral Palette

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| Blanc Calcaire | #F3F0E9 | rgb(243,240,233) | Off-white chaud, sensation papier/pierre. Fonds clairs, respiration. |
| Gris Galet | #9B9DA0 | rgb(155,157,160) | Gris minéral. Textes secondaires, lignes fines, légendes. |
| Pure White | #FFFFFF | rgb(255,255,255) | Fonds purs, zone du QR code. |

### Semantic Colors

| State | Hex | Usage |
|-------|-----|-------|
| Success | #1FB89A | Carte ajoutée, points crédités, récompense débloquée. |
| Warning | #E8B964 | Offre bientôt expirée, palier presque atteint. |
| Error | #E2513A | Erreur, action destructive. |
| Info | #4FA3E0 | Messages informatifs. |

### Accessibility

- Texte Calcaire sur Onyx : contraste élevé (AAA).
- Emerald sur Calcaire : conforme WCAG 2.1 AA pour le texte et les éléments interactifs.
- Sur fond émeraude, le texte d'action est blanc (#FFFFFF) pour garantir le contraste.

---

## 2. Typography

Le contraste **serif fin × grotesque suisse** : l'émotion d'une serif éditoriale, la rigueur d'une grotesque. Ce contraste *est* la marque.

### Font Stack

```css
--font-heading: 'Canela', 'Fraunces', Georgia, serif;   /* sub. libre : Fraunces / Cormorant */
--font-body: 'Söhne', 'Inter', system-ui, -apple-system, sans-serif; /* sub. libre : Inter */
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
```

> Polices premium (sous licence) : **Canela** (Commercial Type) pour les titres, **Söhne** (Klim) pour le courant.
> Substituts libres (Google Fonts) pour prototypes et web : **Fraunces** (titres) et **Inter** (courant).

### Type Scale

| Element | Size (Desktop) | Size (Mobile) | Font | Weight | Line Height |
|---------|----------------|---------------|------|--------|-------------|
| H1 | 64px | 38px | Canela | 300 | 1.05 |
| H2 | 44px | 30px | Canela | 300 | 1.1 |
| H3 | 30px | 24px | Canela | 300 | 1.2 |
| Body | 17px | 16px | Söhne | 300/400 | 1.6 |
| Body Large | 19px | 18px | Söhne | 300 | 1.6 |
| Label / Eyebrow | 11px | 11px | Söhne | 500 | 1.4 |
| Caption | 13px | 13px | Söhne | 400 | 1.5 |

- Titres en italique pour l'emphase (la serif chante).
- Eyebrows / labels en CAPITALES, letter-spacing ≈ 0.2–0.34em.

---

## 3. Logo

### Le symbole — « Le Halo »

Un **cercle fin et parfait**, traversé d'un seul **arc de lumière** (le *glint*, en Emerald Glow, ~en haut à droite). Le nom est le logo : dans le wordmark **HALO**, le **O** devient le halo.

### Variants

| Variant | Usage |
|---------|-------|
| Symbole seul (le cercle + glint) | Favicon, icône d'app, marque sur carte, petits espaces. |
| Wordmark à O vivant (HALO) | Signature institutionnelle, en-têtes, documents. |
| Monochrome | Sur fonds chargés ou contextes une couleur. |

### Clear space & taille minimale

- Espace de protection minimum = le diamètre du cercle du symbole.
- Taille min. symbole : 16px (digital). Wordmark : 90px de large (digital).

### Don'ts

- Ne pas déformer, incliner ou changer les proportions du cercle.
- Ne pas remplir le cercle ni épaissir exagérément le trait.
- Ne pas colorer le glint hors palette (toujours Emerald Glow).
- Ne pas ajouter d'ombres lourdes ou d'effets 3D.

---

## 4. Système de cartes de fidélité (le produit)

HALO est **white-label** : la carte du client final porte l'identité du commerçant (ses couleurs, son logo, son nom). La mention « HALO » est discrète et **masquable**.

### Les 5 mécaniques

| Mécanique | Principe | Métiers types |
|-----------|----------|---------------|
| **Tampons** | X achats = 1 offert | Café, boulangerie, coiffeur, pizzeria, lavage auto |
| **Points cumulés** | N points par franc → récompense | Restaurant, fleuriste, retail |
| **Paliers VIP** | Bronze → Argent → Or, avantages croissants | Boutique mode, concept-store |
| **Cashback** | % de la dépense rendu en cagnotte | Institut beauté, spa, prestations |
| **Carte de passages** | Suivi d'assiduité / abonnement | Salle de sport, studio |

### Principes de design de carte

- **Le vide est le luxe** : ~70–80% de respiration. Hiérarchie claire : enseigne → mécanique → récompense → QR.
- **QR code** présent sur chaque carte (zone blanche, coins arrondis) : c'est le code scanné en caisse.
- **Holographie discrète** : un reflet arc-en-ciel subtil + un éclat lumineux qui balaie la carte (le « Vibrant »). À doser bas (effet premium, jamais clinquant).
- **Carte digitale = Wallet** : pass Apple / Google Wallet, ratio carte bancaire (1.586:1), pas d'appli à télécharger côté client.

### Motion & lumière

- Sur la carte digitale, un reflet balaie lentement le halo / la surface.
- À chaque gain (tampon, points), micro-animation + retour haptique : le halo s'intensifie.
- Holographie : opacité basse (~0.30), animation lente et continue, décalée d'une carte à l'autre.

---

## 5. Messaging (B2B — parler au commerçant)

**Accroches :**
- « Une plateforme. Toutes les fidélités. »
- « La fidélité des grandes enseignes, à votre image. »
- « Sans appli. Sans matériel. Prête en quelques minutes. »

**Arguments clés :**
1. **Zéro appli** — la carte vit dans le Wallet du téléphone.
2. **À votre image** — vos couleurs, votre logo, white-label complet.
3. **5 mécaniques** — tampons, points, paliers, cashback, passages.
4. **Notifications push** — relancez un client inactif, gratuitement.
5. **Stats & dashboard** — comprenez et pilotez votre fidélisation.

**Ton :** clair et direct (on s'adresse à un commerçant occupé), chaleureux mais premium, jamais condescendant ni jargonneux. Le bénéfice avant la fonctionnalité.
