# Carte-Fidélité

SaaS B2B de cartes de fidélité 100 % numériques (Apple Wallet, Google Wallet) pour les petits commerces.

Voir [`CLAUDE.md`](./CLAUDE.md) et [`AGENTS.md`](./AGENTS.md) pour la vision produit, l'architecture cible et les conventions.

## Prérequis

- Node.js >= 20 (testé sur Node 22)
- **pnpm** — le gestionnaire de paquets du projet

Active pnpm via Corepack (livré avec Node) :

```bash
corepack enable
```

## Installation

> ⚠️ Ce projet utilise **pnpm exclusivement**. N'utilise pas `npm` ni `yarn` : ils créeraient un second `node_modules` + un second lockfile, source de lenteurs et de bugs difficiles à diagnostiquer. Un garde-fou (`only-allow`) bloque automatiquement les autres gestionnaires.

```bash
pnpm install
```

## Lancer le serveur de développement

```bash
pnpm dev
```

Puis ouvre [http://localhost:3000](http://localhost:3000).

> Next.js 16 utilise **Turbopack par défaut** pour `next dev` et `next build` — inutile d'ajouter le flag `--turbopack` (conseil obsolète des anciens tutos). Pour repasser à Webpack : `pnpm dev --webpack`.

## Variables d'environnement

Crée un `.env.local` à partir de la liste des variables documentée dans [`CLAUDE.md` (§6)](./CLAUDE.md). `.env*` et `certs/` sont gitignored — **aucun secret n'est committé**.

## Performances locales (macOS)

Si le dev ou ton Mac rame, le coupable est presque toujours l'environnement, pas le code (`node_modules` ≈ 660 Mo / 23 000 fichiers) :

1. **Sors le projet des dossiers synchronisés** (iCloud Drive, Bureau, Documents, Dropbox). Un dossier synchronisé tente d'uploader les 23 000 fichiers de `node_modules` en continu → ventilo + lenteurs. Place le projet dans `~/dev/` par exemple.
2. **Autorise ton terminal en mode développeur** pour éviter que Gatekeeper rescanne les fichiers à chaque accès :
   ```bash
   sudo spctl developer-mode enable-terminal
   ```
   Puis : Réglages Système → Confidentialité et sécurité → Outils de développement → active ton terminal.
3. **Tue les processus Next/Node fantômes** restés en arrière-plan :
   ```bash
   pkill -f "next dev"
   ```
4. **Vérifie l'espace disque** (un disque presque plein ralentit tout macOS) :
   ```bash
   df -h /
   ```
5. **Ne lance pas le dev dans Docker** sur Mac : le HMR y est très lent.

Détails : doc Next.js locale `node_modules/next/dist/docs/01-app/02-guides/local-development.md`.
