# BACKLOG — Build de nuit HaloCard (2026-06-18)

> Base : `origin/main@b2613e2`. Branche d'intégration : `integration/overnight-2026-06-18`.
> Géré par l'ORCHESTRATEUR-QA. Cocher = fait & validé (PASS). Ne rien merger sur `main`.

## P1 — Consolidation (INTEGRATEUR) — branche `agent/integrateur` — **DONE @742106f**
- [x] **I1.** Rebase + intégrer dans `integration/overnight-2026-06-18` : #33 (Studio rules + stamp render), `security-headers-preview`, `google-wallet-resilience`, `audit-hardening-lot124`, `audit-post-integration`. Résoudre conflits. Tests verts. ✅ (CHEF @742106f — 779/779)
- [x] **I2.** Imprimer « INTEGRATEUR DONE » dans STATUS.md (débloque M-Points). ✅ (CHEF @742106f)

## P1 — UX comptoir (UX-COMPTOIR) — branche `agent/ux-comptoir` — **U1-U4 DONE @712dd08**
- [x] **U1.** Refonte `/dashboard` → `ComptoirHome` (badge marchand + StatTrio + gros bouton SCANNER + engrenage `/dashboard/full`). ✅ (CHEF @712dd08)
- [x] **U2.** Écran « Offrir la récompense » 1-tap (`<RedeemFullScreen>`). ✅ (CHEF @712dd08)
- [x] **U3.** `<StatTrio>` + Server Action `getComptoirStats` (tenancy nickel, colonnes prod vérifiées). ✅ (CHEF @712dd08)
- [x] **U4.** `<AmountPad>` clavier numérique CHF (UI seule, prop `onConfirm`). ✅ (CHEF @712dd08)
- [ ] **U5.** Intégration finale : (a) brancher "OFFRIR" sur `/api/scan/redeem`, (b) étendre `rewardsDue` à `amount_points` (`points_balance >= rewardThreshold`), (c) câbler `<AmountPad>` sur `/api/scan` (attendre M-POINTS M4).

## P1 — Templates secteur (TEMPLATES-SECTEUR) — branche `agent/templates-secteur`
- [x] **T1.** `src/lib/loyalty/templates.ts` : `BusinessSector -> LoyaltyTemplate`. 8 secteurs `cafe|boulangerie|restaurant|salon|barbier|sport|retail|pressing`. Chaque template : type, defaultConfig, palette, icône. ✅ (CHEF @b882d90 — PASS avec coordination ; voir FEEDBACK 2026-06-18T12:18:00Z. `amount_points` écarté défensivement — sera réintégré en T4 quand M-POINTS aura poussé M1.)
- [x] **T2.** Étape onboarding « Quel commerce ? » + `SectorPicker` + Server Action `selectSector`. ✅ (CHEF @402bff6)
- [x] **T3.** Couverture étendue `templates.test.ts` + `sectorSelection.test.ts`, 854/854 verts. ✅ (CHEF @402bff6)
- [ ] **T4.** **DÉBLOQUÉ** (M-POINTS M1 poussé @ed8144f). Réintégrer `amount_points` dans 2 templates : `restaurant` (1 pt/CHF, seuil 200, « CHF 20 offerts »), `retail` (1 pt/CHF, seuil 500, « CHF 50 offerts »). Mettre à jour `templates.test.ts` (test `toLoyaltyProgram` passe `validateLoyaltyProgram` pour les 8 secteurs).

## P2 — Mécanique points (MECANIQUE-POINTS) — branche `agent/mecanique-points` — **M1+M2 DONE @f68ec9a**
- [x] **M1.** `LoyaltyType` += `amount_points` + `AmountPointsConfig` + extension `engine`/`validate`/`resolveProgram`. ✅ (CHEF @ed8144f)
- [x] **M2.** Migration `20260618_amount_points.sql` : étend `merchants_loyalty_type_chk` (nom réel vérifié prod), ajoute `loyalty_cards.points_balance` + `last_scan_amount_chf`. Additive + idempotente. NON appliquée à prod. ✅ (CHEF @343e18d — corrections SQL validées Supabase MCP)
- [ ] **M3.** RPC `scan_increment_amount(card_id uuid, amount_chf numeric, signature text, ...)` : crédite `floor(amount * pointsPerChf)`, atomique (`FOR UPDATE`), cooldown identique à `scan_increment`, plafond `maxPointsPerScan ?? 1000`. Lire `scan_increment` existante (dans `supabase/migrations/`) pour calquer la forme exacte (retour jsonb, suspension check).
- [ ] **M4.** API `/api/scan` : si `program.type==='amount_points'`, exiger `body.amountChf` (number > 0, ≤ 10000, 2 décimales), `.eq('merchant_id', merchantId)` AVANT la RPC, appeler `scan_increment_amount`. Retour ajoute `pointsBalance`, `pointsEarned`.
- [ ] **M5.** Feature flag `NEXT_PUBLIC_POINTS_BETA` : UI de sélection de mécanique cache "Points par CHF (BETA)" sauf si flag === "1". Côté serveur la mécanique fonctionne toujours (un compte beta-configuré ne casse pas si flag coupé).
- [ ] **M6.** Tests d'intégration : `route.amountPoints.test.ts` (400 si amountChf absent/≤0/>10000, RPC bien appelée, suspension refusée). Vérif que `templates.test.ts` reste vert après T4.

---
### Légende
- `[ ]` à faire · `[x]` DONE (PASS, SHA validateur noté) · `[~]` IN-PROGRESS
- Toute violation d'invariant 1→7 = FAIL immédiat (voir FEEDBACK.md).
