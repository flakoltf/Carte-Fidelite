# Icône, splash, favicon

Source unique : `public/halo-logo.png` (racine du dépôt, 1024 × 1024) — l'anneau
HALO avec le mot-symbole, sur fond `#0C0B0E`.

Recadrage **identique au favicon web** (`src/app/icon.png`) : carré centré
`(222, 222) → (802, 802)` soit 580 px, remis à 1024 px (Lanczos).

| Fichier | Contenu |
|---|---|
| `icon.png` | le recadrage plein cadre (iOS) |
| `splash-icon.png` | le recadrage à 820 px centré sur fond `#0C0B0E` (`resizeMode: contain`) |
| `android-icon-foreground.png` | le recadrage à 640 px centré (zone sûre adaptive = 66 %) |
| `android-icon-background.png` | fond uni `#0C0B0E` |
| `android-icon-monochrome.png` | anneau seul (`icon-monochrome.svg`, inchangé) |
| `favicon.png` | `icon.png` en 48 px |

Le fond `#0C0B0E` est la couleur réelle des pixels du logo (et non l'onyx
`#0E0F11` des jetons) : sur le splash, aucun liseré autour de l'image.
