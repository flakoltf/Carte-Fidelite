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
| UX-COMPTOIR | `agent/ux-comptoir` | `712dd08` | **PASS (CHEF)** U1+U2+U3+U4 | **GO U5** — intégration finale + extension `rewardsDue` amount_points |
| TEMPLATES-SECTEUR | `agent/templates-secteur` | `402bff6` | **PASS (CHEF)** T1+T2+T3 | **GO T4** — M-POINTS M1 poussé, réintégrer `amount_points` (restaurant + retail) |
| MECANIQUE-POINTS | `agent/mecanique-points` | `f68ec9a` | **PASS (CHEF)** M1+M2 — corrections SQL validées en prod | **GO M3-M6** — RPC + route /api/scan + flag + tests |

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
- **CHEF 2026-06-18T13:02Z** : ✅ **U1+U2+U3+U4 PASS @712dd08**. Réveil réussi, 4 tâches livrées en bloc. Tenancy nickel (`getComptoirStats` filtre `.eq("merchant_id", merchantId)` partout via la façade `CountClient` testable). Vérif colonnes prod OK (`loyalty_cards.last_scan/created_at/stamps_count`, `scan_history.scanned_at`).
- **GO U5** — intégration finale : (a) brancher le bouton "OFFRIR" de `<RedeemFullScreen>` sur la vraie route `/api/scan/redeem` (créer/étendre si manquante), (b) étendre `rewardsDue` dans `queryComptoirStats` pour compter aussi `points_balance >= rewardThreshold` quand le programme est `amount_points`, (c) attendre M-POINTS M4 pour brancher l'`<AmountPad>` sur `/api/scan` avec `body.amountChf`.

## TEMPLATES-SECTEUR
- **CHEF 2026-06-18T12:18Z** : T1 PASS @b882d90. Code propre, 38 tests, typage strict. Décision défensive sur `amount_points` validée (le moteur ne le connaît pas encore). Mapping ajusté ajouté au BACKLOG en **T4 conditionnel** (réintégration `amount_points` pour `restaurant` + `retail` dès que M-POINTS aura poussé M1).
- **Action immédiate** : T2 (étape onboarding "Quel commerce ?") + T3 (étendre tests aux paliers tiered/visit_based + validateLoyaltyProgram).
- **CHEF 2026-06-18T13:00Z** : ✅ **T2+T3 PASS @402bff6**. 854/854 verts. Étape `secteur` non destructive ajoutée. **GO T4** — M-POINTS M1 est poussé (@ed8144f), `amount_points` est désormais accepté par `validate.ts`. Réintégrer `amount_points` : `restaurant` (1 pt/CHF, seuil 200, "CHF 20 offerts"), `retail` (1 pt/CHF, seuil 500, "CHF 50 offerts").

## MECANIQUE-POINTS
- **CHEF 2026-06-18T12:22Z** : **GO M1**. I2 atteint, base saine 779/779. Démarrer sur worktree dédié, branche basée sur `integration/overnight-2026-06-18` (PAS sur `main`). Notifier dans STATUS.md dès que M1 poussé → débloque T4 de Templates.
- **CHEF 2026-06-18T13:05Z** : ✅ **M1+M2 PASS @f68ec9a** — qualité remarquable. 805/805 verts. **Diagnostic SQL validé en prod via Supabase MCP** : contrainte réelle = `merchants_loyalty_type_chk` (le brouillon du cahier était faux : `_check` aurait laissé l'ancienne CHECK active) ; table = `loyalty_cards` (pas `cards`). Migration M2 NON appliquée à la prod (correct).
- **GO M3+M4+M5+M6** : RPC `scan_increment_amount` (calquer sur `scan_increment` existante, lire son SQL), branchement `/api/scan` (si `program.type==='amount_points'` exiger `body.amountChf`), feature flag `NEXT_PUBLIC_POINTS_BETA` côté UI, tests d'intégration route. **NE PAS appliquer la migration à la prod sans accord explicite du fondateur.**

## BLOQUEUR-FONDATEUR
- _(aucun pour l'instant)_
