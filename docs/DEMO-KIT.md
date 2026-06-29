# Kit de démonstration HaloCard — prospection terrain (Genève)

Outil de terrain du fondateur : **6 cartes de fidélité démo**, une par type de
mécanique, pleinement configurées (design premium Apple/Google Wallet + comptoir
fonctionnel). À dégainer sur iPhone devant un commerçant.

- **Source de vérité** : [`src/lib/demo/kit.ts`](../src/lib/demo/kit.ts) (`DEMO_KIT`).
- **Garde** : seuls les 6 comptes `@example.com` de l'allowlist
  ([`src/lib/demo/allowlist.ts`](../src/lib/demo/allowlist.ts)) sont touchés —
  jamais un vrai marchand.
- **Aperçus** : [planche-contact](./DEMO-KIT-contact-sheet.md) ·
  `assets/demo-kit/preview/<slug>.png` · QR par marchand `assets/demo-kit/<slug>/qr.png`.

## Les 6 cartes

| Commerce | Secteur | Mécanique | Ce que ça démontre | Carte (Apple Wallet) — code-barres | URL d'enrôlement (iPhone) |
|---|---|---|---|---|---|
| **Café du Rhône** | Café | `stamp_card` (10, +bienvenue, palier 5) | Carte à tampons complète + avis Google | QR | https://halocard.ch/c/demo |
| **Boulangerie des Pâquis** | Boulangerie | `stamp_card` (8) | Tampons artisanaux, palette chaude | **AZTEC** | https://halocard.ch/c/boulangerie-des-p-quis |
| **Pizzeria Molino** | Restaurant | `amount_points` (1 pt/CHF, 200) | Points par franc + saisie montant comptoir | QR | https://halocard.ch/c/pizzeria-molino |
| **Salon Lumière** | Coiffure | `visit_based` ([5,10,15]) | Récompenses par paliers de visites | **PDF417** | https://halocard.ch/c/salon-lumi-re |
| **Institut Belle Rive** | Beauté | `tiered` (Bronze/Argent/Or) | Statut à niveaux (palier sur la carte) | QR | https://halocard.ch/c/institut-belle-rive |
| **Boulangerie Démo** | Café | `stamp_card` (10, +bienvenue) | Compte de secours du fondateur | **CODE128** | https://halocard.ch/c/boulangerie-demo |

> Les 4 mécaniques du moteur sont toutes couvertes (`stamp_card`, `visit_based`,
> `tiered`, `amount_points`) et les 4 formats de code-barres aussi
> (QR×3, AZTEC, PDF417, CODE128).

## Démonstration terrain (le bon ordre)

1. **Côté client** — ouvrir `https://halocard.ch/c/<slug>` sur l'iPhone du
   commerçant → « Ajouter à Apple Wallet ». La carte s'installe, soignée
   (bannière, couleurs premium, code-barres). (Scanner le QR de la planche-contact
   ouvre directement la bonne URL.)
2. **Côté marchand** — se connecter à l'app comme le marchand démo (identifiants
   ci-dessous) → écran **comptoir** : scanner, créditer, **OFFRIR**. Chaque
   marchand a une carte **reward-ready** déjà semée pour montrer « OFFRIR » en
   live, et une carte « juste offerte » (compteur à 0).

## Identifiants marchands

- Emails : voir le tableau (`<slug>@…` de l'allowlist, tous `@example.com`).
- **Mots de passe : jamais en clair dans le repo.** Source de vérité hors git :
  `~/Projects/HALO/COMPTES-DEMO.md`. Le seed du kit **ne touche pas** l'auth
  (mots de passe existants conservés). Pour (re)définir un mot de passe, passer
  par l'admin Supabase ou une variable d'env de rotation — jamais committé.

## Régénérer le kit (design + cartes d'exemple)

Le kit est **idempotent**. Il (re)publie le design, (ré)upload les assets dans le
bucket `card-assets` et resème une clientèle d'exemple variée. Il **n'applique
aucune migration** et ne crée aucun compte (les 6 existent déjà).

> ⚠️ **À déclencher par le fondateur (ou le CHEF avec son accord).** L'agent ne
> l'exécute pas. Écrit en prod, mais strictement borné à l'allowlist `@example.com`.

**Option A — route admin** (un clic) :

```
POST /api/admin/demo/seed-kit          # tout le kit
POST /api/admin/demo/seed-kit {"slug":"demo"}   # un seul marchand
GET  /api/admin/demo/seed-kit          # liste (lecture seule)
```

**Option B — script CLI local** (service-role, `app/.env.local`) :

```bash
node scripts/seed-demo-kit.mjs          # tout le kit
node scripts/seed-demo-kit.mjs demo     # un seul marchand
```

## (Re)générer les assets visuels (design / planche-contact)

```bash
node scripts/render-demo-assets.mjs         # SVG sources + PNG Apple/Google
node scripts/render-demo-contact-sheet.mjs  # cartes d'aperçu + QR
```

Sources SVG versionnées : `assets/demo-kit/<slug>/src/`. PNG : `assets/demo-kit/<slug>/`.

## Cartes « showcase » (v4 — densité d'agence)

Chaque carte remplit **tous les champs natifs** du pass (≈12-14 champs), au niveau
de la carte de référence du site (`src/components/landing/LoyaltyCard.tsx`) :

- **Bannière image** : photo réelle (Café `cafe.jpg`, Pizzeria `pizza.jpg`) ou
  **hero illustré riche** pour les 4 autres (devanture de boulangerie à l'aube,
  fauteuil de salon + rais de lumière, galets + eau + vapeur de spa, champ de blé).
  Un **scrim** (voile sombre gauche→centre) est composé par-dessus toute bannière
  pour que le grand nombre blanc natif reste lisible.
- **Champs natifs** (`kitDesignFields` dans `seedKit.ts`, données dans `kit.ts`) :
  header `STATUT` + `DEPUIS` · primary (le grand nombre/statut : `{points}` =
  « X / objectif », ou `{palier}` pour tiered) · secondary `PROGRESSION` /
  `PROCHAIN PALIER` / `CE MOIS-CI` (+ `RÉCOMPENSE` ajoutée par `applyIdentity`) ·
  auxiliary `MEMBRE DEPUIS` / `VISITES` / `DERNIÈRE VISITE` / `PARRAINAGES` ·
  back `N° DE MEMBRE` / `COMMENT ÇA MARCHE` / `CONDITIONS` (+ horaires/adresse/
  itinéraire/téléphone/avis Google injectés par `applyIdentity` — non dupliqués).
- `cardType: "points"` partout : la bannière est la surface image (pas de grille
  de tampons auto), la progression est portée par le champ primary.
- amount_points : `stamps_count` est **mirroité** sur `points_balance` au seed
  pour que `{points}` affiche « X / seuil » (le comptoir lit toujours `points_balance`).

## Design des cartes (architecture v3 — conservée)

**Règle d'or : un strip ne porte JAMAIS de texte** (Apple superpose ses champs
natifs par-dessus — logoText en haut, gros nombre du champ *primary* centré-gauche
SUR le strip). L'architecture :

- **Le nom → dans le LOGO** (wordmark serif italique, 1-2 lignes), pas dans le strip.
- **Le strip = fond pur** : zone gauche/centre (~65%) propre et sombre (le nombre
  natif blanc d'Apple y est parfaitement lisible) ; **métaphore éditoriale confinée
  au tiers droit** (~35%) — grain de café + vapeur, pizza vue de dessus + part,
  mèche en S + étincelle, croissant feuilleté, vagues + pierre, épi de blé.
  Profondeur : halo radial sur la métaphore, ombre portée, grain papier (feTurbulence).
- **Le texte = champs natifs** (configurés dans `kit.ts` / `seedKit.ts`) :
  `programName` (logoText, court) ; champ *primary* = valeur + libellé par mécanique
  (`TAMPONS`/`POINTS`/`VISITES` valeur `{points}`, `tiered` → `STATUT` `{palier}`) ;
  la **récompense** arrive en *secondary* automatiquement (via `applyIdentity` /
  `merchants.reward_label`).
- **Harmonie** : le fond du strip à gauche reprend le `background` de la carte
  → pas de rupture entre le strip et le reste.

Le wordmark dépend des **polices système** → assets **rendus localement**
(`scripts/render-demo-assets.mjs`) puis **versionnés**, et le seed les **upload
tels quels** (jamais de rendu de texte serveur ; la route admin les inclut au
bundle via `outputFileTracingIncludes`).

**Auto-contrôle** : `scripts/render-demo-contact-sheet.mjs` génère, par carte, une
**maquette ASSEMBLÉE** (logo + logoText + gros nombre natif SUR le strip +
récompense + QR) dans `assets/demo-kit/preview/<slug>.png` — vérifiée à l'œil :
aucun chevauchement, le nombre et la métaphore ne se touchent jamais.

## Notes / caveats

- **CODE128 (Boulangerie Démo)** : le jeton de carte signé fait ~101 caractères.
  CODE128 est un format **1D** → le code rendu est large et dense ; il scanne mais
  reste moins confortable à l'écran que les formats 2D. Conservé tel quel pour
  **démontrer le 4ᵉ format** (demande CHEF). Pour un usage réel, préférer un 2D
  (QR/AZTEC/PDF417). AZTEC, PDF417 et QR encodent ce jeton sans souci.
- Apple **et** Google Wallet supportent les 4 formats (mapping vérifié :
  `src/lib/cardDesign/mapApple.ts`, `mapGoogle.ts`) ; `altText` câblé des deux côtés.
- Le **Place ID Google** des cartes est un exemple (format `ChIJ…` valide, lieu
  non réel) : il sert à montrer le bouton « Laisser un avis » en démo.
- Migrations `amount_points` déjà appliquées en prod (mécanique points active).
