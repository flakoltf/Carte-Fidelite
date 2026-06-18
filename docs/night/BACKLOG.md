# BACKLOG — Build de nuit HaloCard (2026-06-18)

> Base : `origin/main@b2613e2`. Branche d'intégration : `integration/overnight-2026-06-18`.
> Géré par l'ORCHESTRATEUR-QA. Cocher = fait & validé (PASS). Ne rien merger sur `main`.

## P1 — Consolidation (INTEGRATEUR) — branche `agent/integrateur` — **DONE @742106f**
- [x] **I1.** Rebase + intégrer dans `integration/overnight-2026-06-18` : #33 (Studio rules + stamp render), `security-headers-preview`, `google-wallet-resilience`, `audit-hardening-lot124`, `audit-post-integration`. Résoudre conflits. Tests verts. ✅ (CHEF @742106f — 779/779)
- [x] **I2.** Imprimer « INTEGRATEUR DONE » dans STATUS.md (débloque M-Points). ✅ (CHEF @742106f)

## P1 — UX comptoir (UX-COMPTOIR) — branche `agent/ux-comptoir`
- [ ] **U1.** Refonte `/dashboard` : viewport simple, badge marchand en haut, **gros bouton SCANNER bas-centre** (60% largeur, haptique au tap), 3 chiffres clés au milieu. Engrenage discret en haut-droite → ancien dashboard complet.
- [ ] **U2.** Écran « Offrir la récompense » 1-tap depuis scan reward-ready : bouton plein-écran « OFFRIR · [récompense] », confirmation halo doré 1 s, retour scanner.
- [ ] **U3.** Trois chiffres dashboard : Cartes actives (90 j), Scans aujourd'hui, Récompenses dues. Composant `<StatTile>` réutilisable.
- [ ] **U4.** Saisie montant CHF au scan (clavier numérique full-screen) — UI seulement, prop `onAmountConfirmed(amount: number)`. Conditionnelle si carte `type=amount_points`.

## P1 — Templates secteur (TEMPLATES-SECTEUR) — branche `agent/templates-secteur`
- [x] **T1.** `src/lib/loyalty/templates.ts` : `BusinessSector -> LoyaltyTemplate`. 8 secteurs `cafe|boulangerie|restaurant|salon|barbier|sport|retail|pressing`. Chaque template : type, defaultConfig, palette, icône. ✅ (CHEF @b882d90 — PASS avec coordination ; voir FEEDBACK 2026-06-18T12:18:00Z. `amount_points` écarté défensivement — sera réintégré en T4 quand M-POINTS aura poussé M1.)
- [ ] **T2.** Étape onboarding « Quel commerce ? » + grille cartes-secteurs ; au clic, pré-remplit (programme + design + récompense). AJOUT non destructif d'une étape 0.
- [ ] **T3.** Étendre `templates.test.ts` : couverture des paliers `tiered`/`visit_based`, du chemin `templateForBusinessType`, et test que `toLoyaltyProgram(template)` est accepté par `validateLoyaltyProgram` pour les 8 secteurs.
- [ ] **T4.** *(conditionnel — démarre quand `M-POINTS M1 DONE` apparaît dans STATUS.md)* Réintégrer `amount_points` dans 2 templates : `restaurant` (1 pt/CHF, seuil 200 pts, « CHF 20 offerts ») et `retail` (1 pt/CHF, seuil 500 pts, « CHF 50 offerts »). Mettre à jour `templates.test.ts` en conséquence.

## P2 — Mécanique points (MECANIQUE-POINTS) — branche `agent/mecanique-points` — **DÉMARRE APRÈS I2**
- [ ] **M1.** `LoyaltyType` `amount_points` dans `src/lib/loyalty/types.ts` : `{ pointsPerChf: number, rewardThreshold: number, rewardLabel: string }`.
- [ ] **M2.** Migration `supabase/migrations/20260618_amount_points.sql` : étend CHECK `loyalty_type` ; colonne `last_scan_amount_chf numeric` sur `cards`. **NE PAS appliquer à prod.**
- [ ] **M3.** RPC `scan_increment_amount(card_id uuid, amount_chf numeric, signature text)` : crédite `floor(amount * pointsPerChf)`, atomique, cooldown identique, plafond 1000 pts/scan.
- [ ] **M4.** API `/api/scan` : si `cardType==amount_points`, exiger `body.amountChf` (number > 0, ≤ 10000) → nouvelle RPC. Sinon inchangé.
- [ ] **M5.** Feature flag `NEXT_PUBLIC_POINTS_BETA` — UI cachée par défaut.
- [ ] **M6.** Tests engine + route : arrondis amount-points, cooldown, suspension.

---
### Légende
- `[ ]` à faire · `[x]` DONE (PASS, SHA validateur noté) · `[~]` IN-PROGRESS
- Toute violation d'invariant 1→7 = FAIL immédiat (voir FEEDBACK.md).
