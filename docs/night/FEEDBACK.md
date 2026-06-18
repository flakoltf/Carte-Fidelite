# FEEDBACK — journal append-only (build de nuit 2026-06-18)

> Une entrée par verdict / réassignation. Format :
> `## <ISO-8601 UTC> [AGENT] [SHA]` + verdict + reproche (FR direct) + action demandée.
> Ne JAMAIS éditer une entrée passée — uniquement append.

---

## 2026-06-18T11:47:50Z [ORCHESTRATEUR] [b2613e2] INIT
- Verdict : N/A (initialisation).
- Terrain prêt : branche `integration/overnight-2026-06-18` créée depuis `origin/main@b2613e2`, fichiers `docs/night/` initialisés.
- Surveillance active toutes les 90 s sur `agent/*` + branche d'intégration.
- Rappel invariants 1→7 : audit CHECK jumelle · Google PATCH-only · tenancy `.eq("merchant_id")` · scan_increment atomique · zéro secret · zéro migration prod · rien sur `main`.

---

## 2026-06-18T11:55:11Z [INTEGRATEUR] [742106f] DONE
- Verdict : PASS. Les 5 branches traitées dans l'ordre prescrit ; `integration/overnight-2026-06-18` poussée @742106f.
- **Branches mergées — no-op (déjà dans `main@b2613e2`, tips ancêtres de `main`, « Déjà à jour ») :**
  - `fix/audit-hardening-lot124`
  - `fix/audit-post-integration`
  - `fix/google-wallet-resilience`
- **Branches mergées — `--no-ff`, travail réel :**
  - `feat/security-headers-preview` — CSP Report-Only → enforcing (sans nonce, approche officielle Next), HSTS 2 ans + preload, filet de build pour previews Vercel (placeholders NON-secrets gated `VERCEL_ENV !== "production"`, jamais d'écrasement de vraie valeur).
  - `feat/studio-rules-stamp-render` (PR #33) — persistance règles programme à la publication (`.eq('id', merchantId)`, action d'audit existante `MERCHANT_UPDATED`, pas de migration) + strip de tampons Apple (composite sharp).
- **Branches skippées :** aucune.
- **Gate qualité :** après chaque merge réel — `npm ci` OK, `npx tsc --noEmit` clean, `npx vitest run` vert (753/753 après sec-headers, **779/779** après studio, 110 fichiers).
- **Invariants vérifiés sur le diff final vs `main` :** tenancy (chaque `supabaseAdmin` porte `.eq('merchant_id'|'id', merchantId)`) · 0 UPDATE/PUT Google Wallet · `src/lib/auditLog.ts` et `supabase/migrations/` NON touchés (AUDIT_ACTIONS ↔ audit_logs_action_check restent alignés) · aucun secret en clair · 0 commit / 0 push sur `main`.
- **Incident de coordination (non bloquant) :** WIP non-commité d'UX-COMPTOIR (U2 — couleurs gold dans `globals.css` + `@testing-library/*` & `jsdom` dans `package.json/-lock`) présent dans la copie de travail partagée `~/Projects/HALO/app`. Hors périmètre des 5 branches → mis en `stash -u` le temps de l'intégration pour ne pas le happer, puis restitué. Recommandation : faire travailler chaque worker dans son worktree dédié (cf. workflow worktree-per-agent).
- **Reconciliation :** remote avait avancé d'un heartbeat (cycle 1, STATUS.md) pendant le travail → rebase `--rebase-merges` de mes 2 merges par-dessus, sans conflit.
- Action : I2 atteint (« INTEGRATEUR DONE ») → MECANIQUE-POINTS peut démarrer M1.

---

## 2026-06-18T12:15:00Z [CHEF] [742106f] VERDICT INTEGRATEUR
- Verdict : **PASS confirmé**. Re-vérification indépendante du diff `origin/main..origin/integration/overnight-2026-06-18` :
  - Tenancy : tous les `supabaseAdmin` ajoutés/modifiés portent leur `.eq('merchant_id'|'id', merchantId)`.
  - Google Wallet : 0 occurrence de UPDATE/PUT sur `walletobjects.googleapis.com` dans le diff.
  - `AUDIT_ACTIONS` ↔ `audit_logs_action_check` toujours alignés (aucune des deux n'a bougé).
  - 0 secret en clair, 0 commit sur `main`, 0 application de migration en prod.
- Incident UX-COMPTOIR (stash) : noté. **Recommandation tenue** : la suite des agents bosse en worktrees séparés (`git worktree add ../halocard-<agent> agent/<agent>`), pas en repo partagé. À transmettre au lancement d'UX-COMPTOIR et de M-POINTS.

---

## 2026-06-18T12:18:00Z [CHEF] [b882d90] VERDICT TEMPLATES-SECTEUR T1
- Verdict : **PASS avec coordination**. Code propre, typage strict, union discriminée saine sur `LoyaltyType`, 8 secteurs cohérents avec le moteur existant, 38 tests verts.
- **Décision défensive validée** : l'agent a écarté `amount_points` de T1 parce que `validate.ts`/`engine.ts` ne le connaissent pas (cliquer un secteur "à points" sauvegarderait un `LoyaltyProgram` rejeté → casse silencieuse). Choix correct dans l'état actuel du moteur.
- **MAIS** : `amount_points` EST au programme — c'est M-POINTS qui l'ajoute en M1 (extension de `LoyaltyType` + config + validate). Donc on créé un **point de couture** : Templates a une tâche supplémentaire T4 (ré-intégration de `amount_points` dans 2-3 templates : `restaurant` + `retail`) qui démarre dès que M-POINTS a poussé M1 sur `agent/mecanique-points`.
- **Mapping ajusté pour T4 (à appliquer plus tard)** :
  - `restaurant` → `amount_points` (1 pt/CHF, seuil 200 pts, récompense « CHF 20 offerts »).
  - `retail` → `amount_points` (1 pt/CHF, seuil 500 pts, récompense « CHF 50 offerts »).
  - Les 6 autres secteurs gardent leur mécanique actuelle.
- **Action immédiate Templates-Secteur** : enchaîne T2 (étape onboarding "Quel commerce ?") + T3 (couverture tests par secteur, déjà partiellement faite — étendre aux paliers de tiered/visit_based). PAS de T4 avant signal `M-POINTS M1 DONE` dans STATUS.md.

---

## 2026-06-18T12:20:00Z [CHEF] [—] ALERTE UX-COMPTOIR
- Verdict : **À RÉVEILLER**. La branche `agent/ux-comptoir` n'existe pas sur origin ; le seul signe de vie est un WIP local stashé par l'Intégrateur (couleurs gold dans `globals.css` + `@testing-library/*` + `jsdom`). Risque : tout ce WIP est perdu si le worktree est nettoyé.
- **Action** : redémarrer UX-COMPTOIR dans son propre worktree, vérifier qu'il `git stash pop` du WIP s'il est encore là, ou repartir de U1 si stash perdu. Pousser au plus vite un commit même partiel (`feat(comptoir): U1 WIP — squelette ComptoirHome`) pour matérialiser la branche.

---

## 2026-06-18T12:22:00Z [CHEF] [—] AUTORISATION MECANIQUE-POINTS
- Verdict : **GO M1**. I2 est atteint (« INTEGRATEUR DONE @742106f »), la branche d'intégration est verte 779/779, la base est saine.
- **Démarre sur worktree dédié**, branche `agent/mecanique-points` basée sur `origin/integration/overnight-2026-06-18` (PAS sur `main` — pour avoir CSP + Studio).
- **Coordination Templates** : dès que M1 est poussé (extension `LoyaltyType` + validate), notifier dans STATUS.md → ça débloque T4 côté Templates.

---

## 2026-06-18T13:00:00Z [CHEF] [402bff6] VERDICT TEMPLATES T2+T3
- Verdict : **PASS**. Code propre, 854/854 tests verts (base 779 + 38 T1 + ~37 T2/T3). T1 rebasé proprement sur le verdict CHEF précédent (renommage SHA 56ba1a5).
- Étape onboarding `secteur` non destructive ajoutée : `actions.ts` (Server Action `selectSector`), `SectorPicker.tsx`, `page.tsx`, `OnboardingClient.tsx` mis à jour, plus la logique pure `src/lib/onboarding/sectorSelection.ts` et ses tests.
- Pas de modif `auditLog.ts` (invariant 1 OK).
- Pas de UPDATE/PUT Google Wallet (invariant 2 OK).
- **GO T4** : M-POINTS M1 est poussé (@ed8144f) → `amount_points` est désormais accepté par `validate.ts`. Templates peut maintenant réintégrer `amount_points` dans `restaurant` (1 pt/CHF, seuil 200, "CHF 20 offerts") et `retail` (1 pt/CHF, seuil 500, "CHF 50 offerts").

---

## 2026-06-18T13:02:00Z [CHEF] [712dd08] VERDICT UX-COMPTOIR U1+U2+U3+U4
- Verdict : **PASS**. Les 4 tâches livrées (réveil réussi malgré le démarrage chaotique). 21 fichiers ajoutés/modifiés, package-lock +757 lignes (jsdom + testing-library pour les tests JSX).
- **Tenancy nickel** : `getComptoirStats()` résout `currentMerchantId()` (gère l'impersonation), filtre `.eq("id", merchantId)` sur `merchants`, puis `queryComptoirStats` repose `.eq("merchant_id", merchantId)` sur `loyalty_cards` (active + reward-ready) et `scan_history`. Logique pure isolée derrière une façade `CountClient` pour tester sans réseau — **excellent design**.
- **Vérif prod (Supabase MCP)** : toutes les colonnes utilisées existent réellement (`loyalty_cards.last_scan/created_at/stamps_count/merchant_id`, `scan_history.scanned_at/merchant_id`, `merchants.loyalty_type/loyalty_config/stamp_goal`).
- Pas de modif `auditLog.ts` (invariant 1 OK).
- Pas de UPDATE/PUT Google Wallet (invariant 2 OK).
- **Petit point** : `rewardsDue` ne compte que les `stamp_card` (cf. `goal === null`). Une fois `amount_points` branché (M3/M4), il faudra étendre la requête pour compter aussi `points_balance >= rewardThreshold`. C'est mineur, à inclure dans U5 (intégration finale).

---

## 2026-06-18T13:05:00Z [CHEF] [f68ec9a] VERDICT MECANIQUE-POINTS M1+M2
- Verdict : **PASS — qualité remarquable**. 805/805 tests verts (base 779 + 26 amount_points). Type, validate, engine, resolveProgram étendus proprement.
- **Diagnostic SQL validé en prod via Supabase MCP :**
  1. La contrainte s'appelle bien `merchants_loyalty_type_chk` (vérifié : `CHECK ((loyalty_type = ANY (ARRAY['stamp_card','visit_based','tiered'])))`). Le brouillon du cahier (`merchants_loyalty_type_check`) aurait laissé l'ancienne contrainte active → inserts `amount_points` rejetés. **Correction de M-Points sauvée**.
  2. La table des cartes est bien `loyalty_cards`, aucune table `cards` n'existe. **Correction validée**.
  - Drop défensif des deux noms + re-add canonique = robuste et idempotent. La migration peut être appliquée en prod sans risque (avec le « go » du fondateur).
- **Écart sur `ScanEvent`** : décision défendue (ScanResult.newCount porte déjà le solde — éviter de casser les `toEqual` du baseline). Accepté.
- **Migration M2 NON appliquée à la prod** ✅ (`points_balance` et `last_scan_amount_chf` absents en prod, comme attendu).
- Pas de nouvelle `AuditAction` ✅.
- **GO M3+M4+M5+M6** : continuer la séquence. La RPC `scan_increment_amount`, le branchement `/api/scan`, le feature flag `NEXT_PUBLIC_POINTS_BETA` et les tests d'intégration restent à livrer. Ne pas appliquer la migration à la prod sans accord explicite du fondateur.

---

## 2026-06-18T13:08:00Z [CHEF] [—] U5 ASSIGNÉ À UX-COMPTOIR
- Mission supplémentaire : intégration finale comptoir (U5). Brancher le bouton "OFFRIR" du `<RedeemFullScreen>` sur la vraie route `/api/scan/redeem` si elle existe (sinon créer/étendre), étendre `rewardsDue` dans `queryComptoirStats` pour compter aussi `points_balance >= threshold` (amount_points), et préparer le câblage du `<AmountPad>` (attendre que M4 ait branché `/api/scan` pour amount_points avant le câblage final).
- Garde-fous habituels : tenancy, pas de main, pas de prod.

