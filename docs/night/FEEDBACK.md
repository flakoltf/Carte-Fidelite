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

## 2026-06-18T12:30:03Z [MECANIQUE-POINTS] [343e18d] M1+M2 DONE
- Verdict côté worker : M1 et M2 livrés sur worktree dédié `../halocard-mecanique-points` (branche `agent/mecanique-points`, base `integration/overnight-2026-06-18@62933f1`). Gate à chaque push : `tsc --noEmit` clean · `eslint` clean · `vitest run` **805/805** (111 fichiers, +26 tests amount_points ; base 779).
- **M1 @ed8144f — type/config/validate/engine/resolve :**
  - `types.ts` : `LoyaltyType` += `amount_points` ; `AmountPointsConfig` ; union `LoyaltyProgram` étendue ; `LOYALTY_TYPES` complété.
  - `validate.ts` : `amount_points` accepté ssi `pointsPerChf > 0` (fraction OK), `rewardThreshold` entier ≥ 1, `rewardLabel` 1-80, `maxPointsPerScan` entier ≥ 1 si fourni.
  - `engine.ts` : `applyScan(program, currentValue, scanAmountChf?)` crédite `min(floor(montant×pointsPerChf), maxPointsPerScan ?? 1000)` ; `rewardReady = currentValue+earned ≥ rewardThreshold` ; event `reward_ready` au SEUL franchissement (pas de redéclenchement) ; **lève** si montant manquant/≤0 (bug d'appel à faire remonter). `programCanRedeem` : solde ≥ seuil. `initialStampsForEnroll` : 0 (déjà couvert pour non-stamp).
  - `resolveProgram.ts` : passe-through `amount_points` (fallback `stamp_card` si jsonb corrompu).
  - `EditMerchantForm.tsx` : pointe sur le `LoyaltyType` canonique (sinon le build cassait quand `program.type` est passé en prop). L'UI admin pour amount_points reste à faire (ressort de T4/Templates).
- **M2 @343e18d — migration `supabase/migrations/20260618_amount_points.sql` (REPO seulement, NON appliquée en prod) :** étend `merchants_loyalty_type_chk`, ajoute `loyalty_cards.points_balance` + `loyalty_cards.last_scan_amount_chf`. Additive + idempotente (rejouable).
- **⚠️ Corrections vs le brouillon SQL du cahier (invariant 6 « vérifier l'état réel ») — à valider par le CHEF :**
  1. La contrainte réelle est `merchants_loyalty_type_chk`, PAS `merchants_loyalty_type_check`. Le SQL du cahier aurait laissé l'ancienne contrainte (3 valeurs) ACTIVE → inserts `amount_points` rejetés. J'ai drop/re-add le bon nom (+ drop défensif de `_check`).
  2. La table des cartes est `loyalty_cards`, PAS `cards` (aucune table `cards` n'existe ; runtime `scan`/`redeem` lisent `loyalty_cards`). Colonnes ajoutées sur `loyalty_cards`.
- **Écart assumé (à valider) :** le cahier disait « Ajoute `currentValue` dans `ScanEvent` » — non fait tel quel : `ScanEvent` est une union discriminée d'événements (pas un porteur de valeur) et y ajouter un champ casserait les `toEqual` exacts du baseline. La valeur courante est déjà portée par `ScanResult.newCount` (= nouveau solde pour amount_points). Documenté en commentaire dans `types.ts`.
- **Invariants respectés :** aucune nouvelle `AuditAction` (donc pas de jumelle `audit_logs_action_check`) · pas de secret · 0 commit sur `main` ni sur `integration` (push uniquement sur `agent/mecanique-points`) · worktree dédié · migration NON appliquée en prod.
- **Reste hors-périmètre M (signalé, non démarré) :** RPC atomique de crédit par montant (`scan_increment` ne gère pas amount_points) + branchement route `/api/scan` + UI (l'`<AmountPad>` d'UX-COMPTOIR est déjà prêt côté front). À planifier par l'orchestrateur (M3 ?).
- Attente : revue CHEF. Je m'arrête proprement.

---

## 2026-06-18T12:46:02Z [MECANIQUE-POINTS] [4c37aa5] M3 DONE — RPC scan_increment_amount
- Verdict côté worker : RPC livrée. Migration `supabase/migrations/20260618_scan_increment_amount.sql` (REPO seulement, **NON appliquée en prod** — apply via Supabase MCP avec accord, comme M2). Gate inchangé : `tsc` clean · `vitest` **805/805** (la RPC SQL n'est pas couverte par vitest ; sa logique de crédit est le miroir exact de `engine.applyScan`, déjà testée en M1).
- **Préalable fait :** lu `20260604_scan_atomic_increment.sql` (la SEULE `scan_increment` ; `20260615_scan_revert.sql` à côté). Forme réelle relevée : retour **table** `(new_count, last_scan, status)`, `loyalty_cards%rowtype`, `FOR UPDATE`, cooldown `make_interval(secs=>…)` gardé par `>0`, `security definer`, `search_path=public`, **`revoke execute … from public, anon, authenticated`**. PAS de signature, PAS de suspension dans la RPC.
- **Vérif route `/api/scan/route.ts` :** la signature QR est vérifiée CÔTÉ APP (`verifyQRCode`, ligne 53) AVANT la RPC ; la suspension est vérifiée CÔTÉ APP (`merchants.suspended_at`, ligne 68). La RPC reçoit déjà l'id de carte résolu.
- **Déviations ASSUMÉES vs le brouillon SQL du cahier (à valider CHEF) :**
  1. **Pas de `p_signature`** : inutilisé même dans le brouillon ; la signature est une responsabilité app (cf. ci-dessus), comme pour `scan_increment`. L'ajouter = paramètre mort dans une fonction `SECURITY DEFINER`.
  2. **Pas de check suspension** : `scan_increment` n'en fait pas ; la suspension est gérée par la route. On reste fidèle à la forme existante.
  3. **`REVOKE EXECUTE` ajouté** (absent du brouillon) — aligné sur `scan_increment`, sécurité service-role.
  4. **Garde `bad_amount`** (`p_amount_chf` null/≤0 → `{ok:false, error:'bad_amount'}`) : miroir du `throw` de `engine.applyScan`.
  5. Retour **jsonb** `{ok, currentValue, pointsEarned, rewardReady}` (demandé par le cahier ; plus riche que le retour table de `scan_increment`). Statuts d'erreur : `card_not_found` | `cooldown` | `bad_amount`.
- **⚠️ Message d'assignation M3 TRONQUÉ** côté SQL (`$$;` non fermé) et après : je n'ai pas vu d'éventuelles étapes route/tests. J'ai livré la partie clairement spécifiée (le fichier RPC). **Reste à cadrer (M4 ?)** : brancher `/api/scan/route.ts` sur `scan_increment_amount` pour `program.type === "amount_points"` (lire le montant de la requête, passer `pointsPerChf`/`maxPointsPerScan`/`rewardThreshold` issus du programme résolu, mapper le jsonb vers la réponse `{success, rewardReady, …}`, audit `CARD_SCANNED`) + UI (`<AmountPad>` d'UX-COMPTOIR déjà prêt). Je NE l'ai pas fait spéculativement pour ne pas diverger de la portion tronquée.
- **Invariants respectés :** aucune nouvelle `AuditAction` · pas de secret · 0 commit `main`/`integration` (push uniquement `agent/mecanique-points`) · worktree dédié · migration NON appliquée en prod.
- Attente : revue CHEF + cadrage du branchement route. Je m'arrête proprement.

