# Journal de bord — Carte-Fidélité

> **Mémoire inter-session et multi-machine.** Ce fichier est lu automatiquement au
> démarrage de chaque session (hook `SessionStart`) et synchronisé entre tes
> ordinateurs via git. Voir `CLAUDE.md` §11.
>
> **Convention :** une entrée par session, la plus récente **en haut**. Chaque entrée
> note ce qui a été fait, les décisions prises, et surtout **les prochaines étapes**.
> En fin de session : mettre à jour ce fichier, puis `commit` + `push`.

---

<!-- Nouvelle entrée au-dessus de cette ligne -->

## 2026-06-06 — Mise au propre de l'environnement + système de mémoire

**Contexte :** Mac très lent, impossible d'avancer. Diagnostic complet demandé.

**Fait :**
- 🩺 Lenteur Mac diagnostiquée : le projet vit dans `~/Desktop` → **synchronisé par
  iCloud** (`node_modules` ≈ 660 Mo / 23 000 fichiers ré-uploadés en continu). Cause n°1.
- 🧰 Standardisé sur **pnpm** : suppression de `package-lock.json` (double lockfile
  npm + pnpm), ajout de `packageManager` + garde-fou `only-allow pnpm`.
- 📄 README réécrit (setup pnpm, note Turbopack-par-défaut, dépannage perf macOS).
- 🔁 Blocage « Retrying 9/10 » = **incident Opus 4.8** côté Anthropic (résolu 10:14 UTC),
  pas le code ni le Mac.
- 🔌 MCP : `context7` (timeout 30 s) et `vercel` (auth) à reconnecter via `/mcp`.
- 🧠 Mis en place ce **système de mémoire multi-machine** : ce journal + hook
  `SessionStart` cross-platform + section §11 dans `CLAUDE.md`.
- 🔀 Travail sur la branche `claude/serene-bell-BWIJn` → **PR #2** (brouillon).

**Décisions :**
- Gestionnaire de paquets = **pnpm** (définitif).
- La mémoire de travail vit **dans le dépôt git**, jamais dans `~/.claude/`.

**Prochaines étapes (TODO) :**
- [ ] Déplacer le projet hors du Bureau : `mkdir -p ~/dev && mv ~/Desktop/Independant/Carte-Fidelite ~/dev/`.
- [ ] Reconnecter les MCP (`/mcp`) ou les désactiver (`/plugin`) si inutiles.
- [ ] Relire puis sortir la PR #2 du mode brouillon.
- [ ] Reprendre la roadmap (`CLAUDE.md` §10) : choix DB + ORM (PostgreSQL + Drizzle).
