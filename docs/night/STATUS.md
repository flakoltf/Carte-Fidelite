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
| MECANIQUE-POINTS | `agent/mecanique-points` | `f139716` | **M1→M6 DONE — amount_points complet (gate vert 820/820 ; PASS CHEF M1+M2)** | terminé |

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
- **M1 DONE @ed8144f** — `LoyaltyType` amount_points + `validate` étendus. Aussi : `engine.applyScan(program, currentValue, scanAmountChf?)` (crédit `min(floor(montant×pointsPerChf), maxPointsPerScan ?? 1000)`, reward au seuil), `programCanRedeem`, passe-through `resolveProgram`. Worktree dédié `../halocard-mecanique-points`, base `integration/overnight-2026-06-18@62933f1`. Gate : `tsc` clean · `eslint` clean · `vitest` **805/805** (+26). **→ T4 de TEMPLATES-SECTEUR débloqué** (réintégration `amount_points` dans `restaurant` + `retail`).
- **M2 DONE @343e18d** — migration `supabase/migrations/20260618_amount_points.sql` (repo seulement, NON appliquée en prod). Additive + idempotente : étend `merchants_loyalty_type_chk` (+amount_points) + ajoute `loyalty_cards.points_balance` & `loyalty_cards.last_scan_amount_chf`. **Corrections vs brouillon du cahier après vérif schéma réel (invariant 6)** : la contrainte s'appelle `merchants_loyalty_type_chk` (pas `_check`) et la table est `loyalty_cards` (pas `cards`) — le SQL du cahier aurait laissé l'ancienne contrainte active et ciblé une table inexistante. Gate inchangé **805/805**.
- **M3 DONE @4c37aa5** — RPC `public.scan_increment_amount` (migration `20260618_scan_increment_amount.sql`, repo seulement, NON appliquée en prod). Calquée sur `scan_increment` (FOR UPDATE, cooldown `make_interval`, SECURITY DEFINER, `search_path=public`, REVOKE execute). Crédit `min(floor(montant×pointsPerChf), p_max_points)` = miroir exact de `engine.applyScan` ; retour jsonb `{ok, currentValue, pointsEarned, rewardReady}`. **Déviations assumées vs brouillon (à valider CHEF)** : pas de `p_signature` (QR vérifié côté app via `verifyQRCode`, comme `scan_increment`), pas de check suspension (route lit `merchants.suspended_at`), garde `bad_amount`, REVEXEC ajouté. Gate **805/805**.
- **M4 DONE @72275d1** — `/api/scan/route.ts` branché : quand `program.type === "amount_points"`, valide `amountChf` (number, >0, ≤10000, ≤2 déc.) puis crédite via la RPC atomique `scan_increment_amount`. Réponse `{ success, currentValue, pointsEarned, rewardReady, rewardLabel }`. Erreurs mappées (cooldown→429, card_not_found→404, bad_amount→400). Audit `CARD_SCANNED` (existante). Flot stamp/visit/tiered intact. **→ UX-COMPTOIR : l'endpoint `POST /api/scan` accepte désormais `{ cardId, amountChf }` pour les cartes amount_points — l'`<AmountPad>` peut s'y brancher.** Gate **805/805**.
- **M5 DONE @d8235b8** — `EditMerchantForm` : 4e option « Points par CHF dépensés (BETA) » gated `NEXT_PUBLIC_POINTS_BETA === "1"` (ou si le compte est déjà amount_points). Mini-form pointsPerChf/rewardThreshold/rewardLabel (défauts 1 / 200 / « CHF 20 offerts »), prérempli depuis la config existante. Serveur amount_points fonctionne indépendamment du flag (validate/route/RPC). Persistance via la route admin PATCH (validate déjà amount_points-aware).
- **M6 DONE @f139716** — `route.amountPoints.test.ts` (+15 tests) : 400 (montant absent/≤0/>10000/>2 déc./non-numérique), 200 + câblage RPC + réponse, mappage cooldown→429/card_not_found→404/err→500, gardes 401/403 tenant/403 suspendu. **Gate final : tsc clean · eslint clean · vitest 820/820 (112 fichiers).**
- **amount_points COMPLET (M1→M6).** Reste optionnel hors-périmètre : branchement final de l'`<AmountPad>` UX-COMPTOIR sur `POST /api/scan` (l'endpoint est prêt) + application prod de 2 migrations (`20260618_amount_points.sql`, `20260618_scan_increment_amount.sql`) — repo seulement, à appliquer via Supabase MCP avec accord CHEF.

## BLOQUEUR-FONDATEUR
- _(aucun pour l'instant)_
