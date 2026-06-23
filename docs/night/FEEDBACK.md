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

---

## 2026-06-18T13:15:13Z [MECANIQUE-POINTS] M4+M5+M6 DONE @f139716
- Verdict côté worker : `amount_points` livré bout en bout (M1→M6). Gate final : `tsc --noEmit` clean · `eslint` clean · `vitest run` **820/820** (112 fichiers ; +15 tests route, +26 moteur depuis la base 779).
- **M4 @72275d1 — `/api/scan/route.ts` :** branche `program.type === "amount_points"` AVANT le flot tampons. Valide `amountChf` (number fini, >0, ≤10000, `Math.round(x*100)===x*100`) → 400 sinon. Crédite via RPC atomique `scan_increment_amount` (cooldown = `cfg.scanCooldownSeconds`, `pointsPerChf`/`maxPointsPerScan ?? 1000`/`rewardThreshold` du programme résolu). Mappe le jsonb : `cooldown`→429, `card_not_found`→404, `bad_amount`→400 ; succès → `{ success, currentValue, pointsEarned, rewardReady, rewardLabel }`. Audit `CARD_SCANNED` (action EXISTANTE). Tenancy/suspension/signature déjà vérifiées en amont (non dupliquées). **Signalé à UX-COMPTOIR : `POST /api/scan` accepte `{ cardId, amountChf }` → l'`<AmountPad>` peut s'y brancher.**
- **M5 @d8235b8 — `EditMerchantForm.tsx` (+ `page.tsx`) :** 4e option « Points par CHF dépensés (BETA) » visible si `NEXT_PUBLIC_POINTS_BETA === "1"` (ou si le compte est déjà amount_points → pas de perte d'accès à une config existante). Mini-form `pointsPerChf` (déf. 1) / `rewardThreshold` (déf. 200) / `rewardLabel` (déf. « CHF 20 offerts »), **prérempli depuis la config existante** (prop `amountPoints` ajoutée, dérivée du `program` résolu) pour éviter d'écraser une config réelle par les défauts. Persistance : la route admin PATCH valide déjà via `validateLoyaltyProgram` (amount_points-aware depuis M1) — aucun changement requis. **Le serveur gère amount_points indépendamment du flag** (M5.3 respecté : le flag ne contrôle QUE la visibilité UI).
- **M6 @f139716 — `src/app/api/scan/__tests__/route.amountPoints.test.ts` (+15) :** 400 (montant absent / ≤0 / >10000 / >2 décimales / non-numérique + cas limite 10000 accepté), 200 (params RPC = ceux du programme + réponse complète), `maxPointsPerScan` transmis, mappage cooldown→429 / card_not_found→404 / RPC error→500, gardes 401 / 403 autre tenant / 403 suspendu (aucune RPC dans ces cas). Mock calqué sur `scan.route.test.ts` (RPC renvoie un objet jsonb, pas un tableau).
- **Garde-fous respectés :** scan via RPC atomique (jamais de read-modify-write) · tenancy (ownership `card.merchant_id === merchant.id`) vérifiée AVANT la RPC · migrations NON appliquées en prod (repo seulement) · 0 push `main` · 0 push `integration` (uniquement `agent/mecanique-points`).
- **Reste (optionnel, hors périmètre M1→M6) :** brancher l'`<AmountPad>` d'UX-COMPTOIR sur l'endpoint (prêt) ; appliquer en prod via Supabase MCP, avec accord CHEF, les 2 migrations `20260618_amount_points.sql` + `20260618_scan_increment_amount.sql`.
- Attente : revue CHEF. Je m'arrête proprement.
---
## 2026-06-18T12:30:08Z [TEMPLATES-SECTEUR] T2+T3 DONE @152fc76
- Verdict tests : **854/854 verts** (`npx vitest run`, 113 fichiers) · `npx tsc --noEmit` clean · `eslint` clean sur les fichiers touchés.
- Branche rebasée sur `origin/integration/overnight-2026-06-18` (pour CSP + Studio #33 + docs/night) avant de coder ; force-push de la nouvelle base.
- **T2 — étape 0 « Quel commerce ? » (additive, non destructive)** :
  - `src/app/(app)/onboarding/secteur/page.tsx` (server, gardée) + `SectorPicker.tsx` (grille 8 secteurs, 2×4 mobile / 4×2 desktop, emoji XL + phrase mécanique) + « Personnaliser plus tard » (flow vierge).
  - `actions.ts` : Server Action `selectSector` → `getTemplate` → patch mécanique sur `merchants` borné `.eq("id", merchantId)` (tenancy OK) + brouillon (récompense/palette/icône) en **cookie HTTP-only** (pas de migration : colonne `onboarding_draft` inexistante). Audit `MERCHANT_UPDATED` **existant** → aucune nouvelle AuditAction. `skipSector` efface le brouillon.
  - `src/lib/onboarding/sectorSelection.ts` : logique pure (buildSectorSelection + (de)sérialisation), action mince.
  - Wizard branché pour LIRE : la mécanique pré-coche l'étape « programme » via les colonnes lues par `fetchOnboardingState` ; récompense + couleurs suggérées affichées aux étapes programme / design / mise en ligne. Tout reste éditable.
- **T3 — couverture étendue** : mapping métier→secteur, paliers tiered/visit_based croissants, palettes `#RRGGBB`, `toLoyaltyProgram` validé pour les 8 ; tests purs `sectorSelection` ; tests Server Action (tenancy `.eq("id")`, cookie HTTP-only, erreurs typées secteur inconnu / session / échec DB sans écriture, `skipSector`).
- **Fichiers** :
  - `src/lib/onboarding/sectorSelection.ts` (+ `__tests__/sectorSelection.test.ts`)
  - `src/app/(app)/onboarding/secteur/{page,SectorPicker,actions}.{tsx,ts}` (+ `__tests__/actions.test.ts`)
  - `src/app/(app)/onboarding/{page.tsx,OnboardingClient.tsx}` (modifs additives)
  - `src/lib/loyalty/__tests__/templates.test.ts` (étendu)
- **Invariants** : tenancy `.eq("id")` posé · 0 nouvelle AuditAction (réutilise `MERCHANT_UPDATED`) · 0 migration · TS strict sans `any` · vouvoiement FR / HALO · 0 push sur `main`/`integration`.
- **T4** : en attente du signal `M-POINTS M1 DONE @<sha>` dans STATUS.md (réintégration `amount_points` pour `restaurant` + `retail`).

---

## 2026-06-18T12:38:48Z [TEMPLATES-SECTEUR] T4 DONE @5ddd4d0
- Déclencheur : M-POINTS a poussé **M1 DONE @ed8144f** sur `agent/mecanique-points` (`amount_points` bout en bout : type + `AmountPointsConfig` + validate + engine). La branche d'intégration n'avait pas encore re-synchronisé STATUS.md, mais le contrat (« dès que M-POINTS a poussé M1 sur `agent/mecanique-points` ») était rempli → GO T4.
- **Rebase** : `agent/templates-secteur` rebasée sur `origin/agent/mecanique-points` (1 conflit, `docs/night/FEEDBACK.md` append concurrent → résolu en gardant les deux entrées). Verdict : `tsc --noEmit` clean · `eslint` clean · `vitest run` **881/881** (114 fichiers).
- **Réintégration `amount_points`** (mapping CHEF 12:18Z) :
  - `restaurant` → `amount_points` { pointsPerChf 1, rewardThreshold 200, rewardLabel « CHF 20 offerts » }, `cardType: "points"`.
  - `retail` → `amount_points` { pointsPerChf 1, rewardThreshold 500, rewardLabel « CHF 50 offerts » }, `cardType: "points"`.
  - Union `LoyaltyTemplate` + 4e variante, `TEMPLATE_LOYALTY_TYPES` complété, commentaire d'invariant mis à jour. Les 6 autres secteurs inchangés.
- **⚠️ Couture corrigée (sinon régression silencieuse de mon propre T2)** : le wizard `OnboardingClient` ne gère à l'UI que tampons/visites. Pour un secteur `amount_points` choisi à l'étape 0, l'étape « programme » serait retombée sur `stamp_card` par défaut et **aurait écrasé** la config `amount_points` au clic « Continuer ». Corrigé : étape programme en **lecture seule** pour `amount_points` (récap « 1 pt/CHF », pas de ré-`PATCH /api/onboarding/program`) ; résumé de mise en ligne ajusté. L'UI de réglage fin `amount_points` (studio / route `/api/scan`) reste hors de mon périmètre — signalée par M-POINTS comme M3+.
- **Fichiers T4** : `src/lib/loyalty/templates.ts` · `OnboardingClient.tsx` · `src/lib/loyalty/__tests__/templates.test.ts` · `src/lib/onboarding/__tests__/sectorSelection.test.ts` · `src/app/(app)/onboarding/secteur/__tests__/actions.test.ts`.
- **Invariants** : 0 nouvelle AuditAction · 0 migration ajoutée par moi · TS strict sans `any` · vouvoiement FR / HALO · 0 push sur `main`/`integration`.
- **Note d'intégration** : ma branche embarque désormais les commits M1+M2 de `agent/mecanique-points` comme ancêtres (point de couture assumé). À l'Orchestrateur d'ordonner le merge (M-POINTS puis Templates, ou les deux ensemble).

---

## 2026-06-18T12:44:15Z [TEMPLATES-SECTEUR] T4 finalisé @016aa80
- Suite au prompt CHEF (libellés canoniques + demande explicite d'éditer STATUS.md), deux ajustements sur le T4 déjà livré (@5ddd4d0) :
  1. `defaultProgramName` alignés sur le wording canonique : restaurant « 1 point par franc, CHF 20 offerts à 200 pts », retail « 1 point par franc, CHF 50 offerts à 500 pts ». (config/rewardLabel/union/`TEMPLATE_LOYALTY_TYPES` inchangés, déjà conformes.)
  2. `docs/night/STATUS.md` mis à jour (ligne TEMPLATES-SECTEUR + section) : **T4 DONE @016aa80**.
- Test crucial demandé (T4.2) déjà présent : `validateLoyaltyProgram(t.loyaltyType, t.config).ok === true` pour les 8 secteurs (import depuis `../validate`) + vérifs spécifiques restaurant/retail (type `amount_points`, 200/500).
- Gate : `tsc --noEmit` clean · `vitest run` vert (881 au total ; sous-ensemble loyalty/onboarding 194/194 après l'ajustement de wording).
- **Backlog TEMPLATES-SECTEUR (T1→T4) terminé.** Rien sur `main`/`integration`.


---

## 2026-06-18T12:17:19Z [UX-COMPTOIR] [712dd08] TASKS-DONE
- Verdict côté worker : U1→U4 livrés, gate vert (`tsc --noEmit` clean · `eslint` clean · `vitest run` **786/786**, 113 fichiers, +30 tests comptoir). Branche `agent/ux-comptoir` poussée @712dd08, base `origin/main@b2613e2`.
- **U1 @a1168d0** — `/dashboard` = `<ComptoirHome>` plein écran (en-tête mini + engrenage → `/dashboard/full` qui préserve l'ancienne home · `<StatTrio>` · bouton Scanner géant 60% / 96px → `/dashboard/scan` · footer statut connexion + version). Aucune nav latérale, aucun tableau, aucun graphe.
- **U2 @cd900d4** — `<RedeemFullScreen>` plein écran doré 1-tap (`role=dialog`, `aria-live`), POST `/api/redeem`, confettis framer-motion ~1,2 s, retour home. Page `/dashboard/scan` (`<ComptoirScan>`, caméra html5-qrcode) qui le branche.
- **U3 @9d8b456** — `<StatTrio>` + Server Action `getComptoirStats()` ; tenancy `.eq("merchant_id")` sur CHAQUE requête (vérifié par test) ; logique pure `src/lib/comptoir/stats.ts` ; skeleton loader.
- **U4 @712dd08** — `<AmountPad>` clavier CHF plein écran ; logique pure `src/lib/comptoir/amountPad.ts` (max 9999.95, 2 déc., format suisse `.—`/`.50`) ; prop `onConfirm(amountChf)`. Composant prêt, branché côté UI quand Mécanique-Points livrera `amount_points` (back-end requis : RPC crédit par montant — pas encore là).
- **Écarts assumés vs cahier** (à valider par l'orchestrateur) :
  1. Endpoint d'encaissement réel = `POST /api/redeem` (body `{cardId}` → `{success, card}`). Le cahier citait `/api/scan/redeem` (inexistant).
  2. Token `--color-gold*` + `--color-gold-grad` ajoutés dans `globals.css` (cahier citait `--color-gold-grad`, absent ; famille de l'amber `--color-warning`). La marque reste le teal `--color-halo`.
  3. devDeps de test ajoutés : `jsdom` + `@testing-library/*` (pur JS, **aucun binaire natif** → n'aggrave pas le piège lock mac→Linux). Tests composants en `// @vitest-environment jsdom`.
  4. Bouton Scanner = `<Link role="button">` (navigation + affordance bouton demandée par le cahier « rôle button »).
- **Coordination** : suite à l'incident relevé par l'INTEGRATEUR (WIP happé dans la copie partagée), je travaille désormais dans un **worktree dédié** `.claude/worktrees/ux-comptoir` ; seules les màj `docs/night/*` touchent la copie partagée. Invariants respectés : tenancy `.eq` partout · aucune nouvelle `AuditAction` / migration · `enrollment_token` jamais côté client · vouvoiement FR suisse / marque HALO · 0 commit sur `main` ou `integration` (push uniquement sur `agent/ux-comptoir`).
- Attente : retour ORCHESTRATEUR via FEEDBACK pour la suite.

---

## 2026-06-18T12:18:00Z [UX-COMPTOIR] RÉPONSE AU RÉVEIL
- Le réveil « tu n'as encore RIEN poussé » est basé sur un état périmé : la branche `agent/ux-comptoir` est **déjà matérialisée et poussée** (@712dd08), U1→U4 **tous livrés** (voir l'entrée TASKS-DONE ci-dessus). Le WIP stashé par l'INTEGRATEUR a été récupéré (`stash pop`) dans un worktree dédié.
- Worktree réel = `.claude/worktrees/ux-comptoir` (et non `../halocard-ux-comptoir` ; même branche → un seul checkout possible). La validation se fait sur la branche poussée, pas sur le chemin local.
- Endpoint d'encaissement = `POST /api/redeem` (réel) ; `/api/scan/redeem` cité au réveil n'existe pas dans le repo.

## 2026-06-18T12:18:00Z [UX-COMPTOIR] U1 DONE @a1168d0
## 2026-06-18T12:18:00Z [UX-COMPTOIR] U2 DONE @cd900d4
## 2026-06-18T12:18:00Z [UX-COMPTOIR] U3 DONE @9d8b456
## 2026-06-18T12:18:00Z [UX-COMPTOIR] U4 DONE @712dd08

---

## 2026-06-18T12:52:09Z [UX-COMPTOIR] U5.a DONE @a3fe074
- Route `/api/scan/redeem` créée. La logique d'encaissement existait DÉJÀ à `/api/redeem` (atomique conditionnel anti double-encaissement SEC-01, audit `REWARD_REDEEMED` — AuditAction **existante**, tenancy `.eq("merchant_id")`, garde `suspended_at`). Plutôt que dupliquer (la RPC `scan_revert` n'est PAS le use case « offrir » ; pas de nouvelle RPC ni d'AuditAction nécessaire), je l'ai **factorisée** dans `src/lib/loyalty/redeem.ts`. Les DEUX routes y délèguent : `/api/redeem` (fiche Clients, appelants inchangés) et `/api/scan/redeem` (comptoir). `<RedeemFullScreen>` poste désormais sur `/api/scan/redeem`.
- Tests `redeemRoute.test.ts` : 401 / 400 / 403 tenancy / 200 (carte→0 + audit REWARD_REDEEMED) / 409 déjà-offert.
- **Touché un test d'audit** : `suspensionGuards.test.ts` mis à jour pour suivre la factorisation (vérifie que la lib partagée porte `suspended_at` + que les 2 routes délèguent à `redeemReward`) — garantie préservée et ÉTENDUE à la nouvelle route.
- amount_points : décrément `points_balance` non implémenté côté redeem (attend colonne M2 + contrat M-Points) → reste 409 « programme sans encaissement » pour l'instant.

## 2026-06-18T12:52:09Z [UX-COMPTOIR] U5.b DONE @dee68e8
- `queryComptoirStats` : `rewardsDue` gère `amount_points` (`points_balance >= rewardThreshold`) en plus de `stamp_card` (`stamps_count >= goal`). Le type `amount_points` n'étant pas dans l'union LoyaltyProgram de MA base (`origin/main`, M1 non intégré), accès **défensif** documenté. Tenancy `.eq("merchant_id")` dans chaque branche. +2 tests. NB colonne `points_balance` = post-migration M2 (non appliquée prod) — sans incidence sur les tests.

## 2026-06-18T12:52:09Z [UX-COMPTOIR] U5.c BLOQUÉ — attente M-POINTS M4
- État M-Points (branche `agent/mecanique-points`) : M1 @ed8144f · M2 @343e18d · M3 @4c37aa5 (RPC `scan_increment_amount`) faits. **M4 (route `/api/scan` acceptant `amountChf`) PAS encore livré** → je ne câble pas `<AmountPad>` dans le flux live sur un contrat deviné (risque de rework + test E2E impossible sans la vraie route).
- Dès `M4 DONE @<sha>` dans STATUS : je passerai `programType` au `<ComptoirScan>` (déjà serveur), afficherai `<AmountPad>` avant `/api/scan` si `amount_points`, et posterai `body.amountChf`. Puis test E2E flow complet (scan → amountpad → crédit → reward → redeem).
- En attente d'un signal orchestrateur/M-Points pour reprendre. Tout le reste (U1→U4, U5.a, U5.b) est poussé et vert (`tsc`/`eslint` clean, `vitest` **795/795**).

---

## 2026-06-18T13:22:14Z [UX-COMPTOIR] U5.c DONE @abeef05
- Signal **M4 DONE @72275d1** détecté (watcher 5 min). `/api/scan` accepte `{ cardId, amountChf }` pour amount_points → réponse `{ success, currentValue, pointsEarned, rewardReady, rewardLabel }`.
- **Merge `origin/agent/mecanique-points` dans `agent/ux-comptoir`** : auto-résolu, **0 conflit** (mes fichiers comptoir vs moteur M-Points/route scan = disjoints ; `package.json` non touché). Merge @7130374, gate post-merge vert **862/862**.
- Câblage : `<ComptoirScan>` reçoit `programType` (résolu serveur). amount_points → `<AmountPad>` AVANT crédit ; `onConfirm(amountChf)` → POST `/api/scan { cardId, amountChf }` ; `rewardReady` → `<RedeemFullScreen>`, sinon « +X points crédités » + scan suivant. stamp_card/visit/tiered : **flux strictement inchangé** (pas de pavé, scan direct — couvert par un test de non-régression).
- Le type `amount_points` étant désormais dans l'union (merge M1), le cast défensif de U5.b est devenu inutile mais reste inoffensif (laissé tel quel).
- Test E2E `comptoirScan.amountPoints.test.tsx` (4 cas : pavé après scan · body `amountChf` · rewardReady→RedeemFullScreen · crédit sans reward · non-régression stamp_card).
- Gate final : `tsc` clean · `eslint` clean · `vitest run` **866/866** (120 fichiers). Branche `agent/ux-comptoir` @abeef05.
- **U5 complet (U5.a/b/c). Tout le périmètre UX-COMPTOIR (U1→U5) livré, poussé, vert.** Garde-fous tenus : tenancy `.eq("merchant_id")` partout · aucune nouvelle AuditAction/migration de mon fait · 0 push sur main/integration.
- NB intégration : le merge a amené le contenu de l'intégration (security-headers, studio, M-Points + `docs/night/*`, migrations amount_points repo-only) dans la branche — normal puisque M-Points partait de `integration`. Migrations NON appliquées en prod.

---

## 2026-06-23T15:28:47Z [INTEGRATEUR-FINAL] DONE @c1c6717
- **Mission** : consolidation des 3 branches agents dans `integration/overnight-2026-06-18`, gate strict, push. `main` intouché, aucune migration prod, aucune nouvelle feature.
- **Branches mergées (ordre strict, `--no-ff`)** :
  1. `agent/mecanique-points` @58748e0 → merge `cd43d69` — gate **820/820**, tsc clean.
  2. `agent/ux-comptoir` @abeef05 → merge `f6d77ae` (contenait déjà M-Points) — gate **866/866**, tsc clean.
  3. `agent/templates-secteur` @119b2ca → merge `c1c6717` — gate final **942/942**, tsc clean.
- **Conflits résolus** : seulement `docs/night/STATUS.md` + `docs/night/FEEDBACK.md` (append-only → **union** ; tableau de statut réconcilié ligne par ligne sur l'état le plus récent). **Aucun conflit de code** (les 3 branches partagent la merge-base `62933f1` ; HEAD n'avait qu'un commit docs d'avance). Avant le pull `--ff-only`, des rapports worker UX-COMPTOIR non-commités traînaient dans la copie partagée → stashés puis **restitués en union** dans ce FEEDBACK (entrées 12:17→13:22).
- **Gate qualité (à chaque merge)** : `npm ci` · `npx tsc --noEmit` clean · `npx vitest run`. Final : **942/942 tests verts, 123 fichiers** (seuil ≥ 880 atteint).
- **Invariants (tous OK, refus si violé — aucun violé)** : (1) `auditLog.ts` == `origin/main` → aucune nouvelle `AuditAction`, test `auditActionsSync` vert ; (2) Google Wallet `get`/`patch`/`insert` seulement, **aucun `.put(`/`.update(`** ; (3) tenancy `.eq("merchant_id"|"id")` sur chaque nouvel `supabaseAdmin` (redeem double-scopé + ownership 403 cross-tenant, secteur/actions scopé `.eq("id", merchantId)`) ; (4) aucun secret en clair (`BEGIN CERTIFICATE`/`sk_live`/`whsec_`) ; (5) **0 commit sur `main`**.
- **Migrations** `20260618_amount_points.sql` + `20260618_scan_increment_amount.sql` : repo seulement, **NON appliquées en prod** (Supabase MCP + accord fondateur requis).
- **Poussé sur `integration/overnight-2026-06-18`**. SHA code final = `c1c6717`.
