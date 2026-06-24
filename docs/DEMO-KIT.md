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
