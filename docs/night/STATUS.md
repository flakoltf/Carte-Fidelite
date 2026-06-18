# STATUS — Build de nuit HaloCard (temps réel)

- **Base** : `origin/main@b2613e2`
- **Branche d'intégration** : `integration/overnight-2026-06-18`
- **Orchestrateur démarré** : 2026-06-18T11:47:50Z
- **Dernier cycle de surveillance** : 2026-06-18T11:49:14Z (cycle 1)
- **Cycles consécutifs sans push** : 1
- **Mode** : surveillance active — aucune branche `agent/*` encore poussée (workers pas démarrés)
- **Cadence** : ~270 s tant qu'aucun worker ; resserre à 90 s dès qu'une branche `agent/*` apparaît

> Verdicts possibles : `PASS` · `FAIL` · `IN-PROGRESS` · `ATTENTE` (pas encore de branche/push)

| Agent | Branche | Dernier SHA validé | Verdict | Tâche en cours |
|---|---|---|---|---|
| INTEGRATEUR | `integration/overnight-2026-06-18` | `742106f` | PASS (Orchestrateur + CHEF) | DONE @742106f |
| UX-COMPTOIR | `agent/ux-comptoir` | — | **À RÉVEILLER (CHEF)** | U1 — branche pas encore poussée, WIP stashé |
| TEMPLATES-SECTEUR | `agent/templates-secteur` | `016aa80` | T1–T4 DONE (T2+T3 PASS CHEF) | T4 DONE @016aa80 — amount_points restaurant+retail |
| MECANIQUE-POINTS | `agent/mecanique-points` | `343e18d` | **M1+M2 PASS (gate vert 805/805)** | terminé — en attente de revue CHEF |

## INTEGRATEUR
- **DONE @742106f** — 5 branches traitées dans l'ordre prescrit, poussé sur `integration/overnight-2026-06-18`.
  - Mergées (no-op, déjà dans `main@b2613e2`) : `fix/audit-hardening-lot124`, `fix/audit-post-integration`, `fix/google-wallet-resilience` — tips ancêtres de `main`, « Déjà à jour ».
  - Mergées (`--no-ff`, travail réel) : `feat/security-headers-preview` (CSP enforce + HSTS + filet build preview), `feat/studio-rules-stamp-render` (PR #33 — règles programme + strip de tampons Apple).
  - Gate vert après chaque merge réel : `npm ci` OK · `tsc --noEmit` clean · `vitest run` **779/779** (110 fichiers).
  - Invariants vérifiés sur le diff final : tenancy `.eq` tenant sur chaque `supabaseAdmin` · 0 UPDATE/PUT Google Wallet · `auditLog.ts`/migrations intacts (CHECK aligné) · 0 secret · 0 commit sur `main`.
  - Note : WIP UX-COMPTOIR (U2 gold + testing-library) trouvé non-commité dans la copie de travail, mis de côté (stash) pour ne pas le happer dans l'intégration — restitué ensuite.
  - I2 « INTEGRATEUR DONE » atteint → MECANIQUE-POINTS débloquable.

## UX-COMPTOIR
- **CHEF 2026-06-18T12:20Z** : la branche `agent/ux-comptoir` n'existe pas sur origin. Seul signe de vie : WIP local stashé par l'Intégrateur (gold tokens + testing-library). À RÉVEILLER en urgence via prompt de redressement + worktree dédié. Pousser même un commit squelette pour matérialiser la branche.

## TEMPLATES-SECTEUR
- **CHEF 2026-06-18T12:18Z** : T1 PASS @b882d90. Code propre, 38 tests, typage strict. Décision défensive sur `amount_points` validée (le moteur ne le connaît pas encore). Mapping ajusté ajouté au BACKLOG en **T4 conditionnel** (réintégration `amount_points` pour `restaurant` + `retail` dès que M-POINTS aura poussé M1).
- **Action immédiate** : T2 (étape onboarding "Quel commerce ?") + T3 (étendre tests aux paliers tiered/visit_based + validateLoyaltyProgram).
- **T2+T3 DONE @402bff6** — PASS CHEF (854/854). Étape 0 `/onboarding/secteur` (grille 8 secteurs, Server Action `selectSector` tenancy-safe + cookie HTTP-only, wizard pré-rempli), couverture tests étendue.
- **T4 DONE @016aa80** — branche rebasée sur `agent/mecanique-points` (moteur `amount_points`). `restaurant` (1 pt/CHF, seuil 200, « CHF 20 offerts ») et `retail` (1 pt/CHF, seuil 500, « CHF 50 offerts ») en `amount_points`/`cardType "points"` ; union + `TEMPLATE_LOYALTY_TYPES` étendus ; anti-clobber wizard (étape programme en lecture seule pour amount_points). Gate : `tsc` clean · `eslint` clean · `vitest` **881/881**. Test crucial présent : `validateLoyaltyProgram(loyaltyType, config).ok` vrai pour les 8 secteurs. **Backlog TEMPLATES-SECTEUR terminé.**

## MECANIQUE-POINTS
- **CHEF 2026-06-18T12:22Z** : **GO M1**. I2 atteint, base saine 779/779. Démarrer sur worktree dédié, branche basée sur `integration/overnight-2026-06-18` (PAS sur `main`). Notifier dans STATUS.md dès que M1 poussé → débloque T4 de Templates.
- **M1 DONE @ed8144f** — `LoyaltyType` amount_points + `validate` étendus. Aussi : `engine.applyScan(program, currentValue, scanAmountChf?)` (crédit `min(floor(montant×pointsPerChf), maxPointsPerScan ?? 1000)`, reward au seuil), `programCanRedeem`, passe-through `resolveProgram`. Worktree dédié `../halocard-mecanique-points`, base `integration/overnight-2026-06-18@62933f1`. Gate : `tsc` clean · `eslint` clean · `vitest` **805/805** (+26). **→ T4 de TEMPLATES-SECTEUR débloqué** (réintégration `amount_points` dans `restaurant` + `retail`).
- **M2 DONE @343e18d** — migration `supabase/migrations/20260618_amount_points.sql` (repo seulement, NON appliquée en prod). Additive + idempotente : étend `merchants_loyalty_type_chk` (+amount_points) + ajoute `loyalty_cards.points_balance` & `loyalty_cards.last_scan_amount_chf`. **Corrections vs brouillon du cahier après vérif schéma réel (invariant 6)** : la contrainte s'appelle `merchants_loyalty_type_chk` (pas `_check`) et la table est `loyalty_cards` (pas `cards`) — le SQL du cahier aurait laissé l'ancienne contrainte active et ciblé une table inexistante. Gate inchangé **805/805**.
- **Périmètre M : M1+M2 terminés.** Reste hors-périmètre M (signalé) : RPC atomique de crédit par montant (`scan_increment` ne gère pas encore amount_points) + branchement route/UI — à planifier (UX-COMPTOIR a déjà l'`<AmountPad>` prêt côté front).

## BLOQUEUR-FONDATEUR
- _(aucun pour l'instant)_
