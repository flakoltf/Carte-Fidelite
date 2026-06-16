# Méta-surveillance HaloCard — 4 agents en parallèle — 2026-06-16

> **Rôle** : Independent Audit Reviewer. READ-ONLY strict. Aucun code applicatif
> modifié, aucune écriture prod, aucune migration, aucune PR. J'écris uniquement
> ce fichier, sur la branche `docs/meta-watch-2026-06-16` (worktree isolé
> `…/Carte-Fidelite-worktrees/meta-watch`, **hors** de l'arbre de travail partagé
> par les agents — pour ne jamais entrer en collision avec eux).
>
> **Référentiels** : `CLAUDE.md` (6 invariants), `AGENTS.md`,
> `docs/AUDIT-VERIF-2026-06-16-2212.md`, `docs/META-AUDIT-2026-06-16-2220.md`,
> descriptions de PR des agents.
>
> **Branches surveillées :**
> | Agent | Branche | Périmètre déclaré |
> |---|---|---|
> | Studio | `feat/studio-rules-stamp-render` (PR #33) | rendu tampons pass / `studio/`, `applePass.ts`, `cardDesign/` |
> | Hygiène DB | `chore/db-hygiene-and-guards` | gardes anti-drift DB, `auditLog.ts` |
> | Sécurité | `feat/security-headers-preview` | CSP/headers, `next.config.ts` (racine) |
> | Outil démo | `feat/demo-rotate-pass-and-email-smoke` | rotation mdp démo + smoke email, `auditLog.ts` |
>
> **Codes de dérive** (méta-audit d'hier) : D01 hors-périmètre · D02 PR sans accord
> (toutes doivent rester DRAFT) · D03 migration appliquée en prod · D04 secret en
> clair · D05 force-push réécrivant l'historique d'autrui · D11 fait contredit ·
> D12 sur/sous-évaluation · D14 scope creep · D17 viol invariant CLAUDE.md.

---

# Méta-surveillance — vague 0 (BASELINE) — 2026-06-16 ~ ligne de départ

## ⚠️ OBSERVATION STRUCTURELLE (non-dérive, mais à signaler)

**Les 4 agents partagent UN SEUL arbre de travail Git** (`~/Projects/Carte-Fidelite`)
et y basculent de branche en temps réel. En 3 lectures successives au démarrage,
le `HEAD` du tronc est passé de `chore/db-hygiene-and-guards` →
`feat/studio-rules-stamp-render` → `feat/security-headers-preview`.

- **Risque** : un `git checkout` par un agent pendant qu'un autre a des
  modifications non-committées peut écraser/emporter du travail, ou contaminer un
  commit avec les fichiers d'un autre lot. Le seul fichier non-committé observé au
  démarrage est `package-lock.json` (M) — inoffensif mais **flottant** : il peut
  être ramassé par le prochain `git add -A` de n'importe quel agent.
- **Ce n'est pas (encore) une dérive Dxx**, mais une fragilité de setup. À
  surveiller : si deux branches finissent par contenir le **même** changement
  `package-lock.json` ou des fichiers d'un autre lot → bascule en **D14** (scope
  creep par contamination d'arbre partagé).
- **Ma parade** : je travaille dans un worktree **séparé**, je ne `checkout`
  jamais dans le tronc, et je lis tout via les refs `origin/*` et l'index local.

## Verdict instantané : 🟢 VERT (rien à signaler)

Aucune dérive critique. 3 agents sur 4 n'ont encore produit aucun commit. Le seul
travail réel poussé (Studio #33) est conforme et déjà audité.

## Diff par agent (vs `origin/main` @ `b2613e2`)

| Agent | Branche | Sur remote ? | HEAD | Commits devant main | Fichiers | +/- |
|---|---|---|---|---|---|---|
| Studio | `feat/studio-rules-stamp-render` | ✅ oui | `77f4554` (flakoltf, 16/06 00:32) | **1** | `applePass.ts`, `cardDesign/stampStrip.ts`, `…/__tests__/stampStrip.test.ts` | +222 / -0 |
| Hygiène DB | `chore/db-hygiene-and-guards` | ❌ local seul | `b2613e2` | **0** | — | — |
| Sécurité | `feat/security-headers-preview` | ❌ local seul | `b2613e2` | **0** (travail en cours non-committé : tronc sur cette branche) | — | — |
| Outil démo | `feat/demo-rotate-pass-and-email-smoke` | ❌ **branche inexistante** (ni remote ni local) | — | — | — | — |

> **Note** : la branche `feat/demo-rotate-pass-and-email-smoke` n'existe nulle part
> encore (ni `refs/heads`, ni `refs/remotes`). L'agent Outil démo n'a pas démarré,
> ou travaille sous un autre nom. À confirmer au prochain tour.

## Dérives capturées (par code D)

**Aucune.** Détail des contrôles passés au crible :

| Code | Statut | Preuve |
|---|---|---|
| D01 (hors-périmètre) | ✅ RAS | Studio : 3 fichiers, tous dans son périmètre (`applePass.ts` + `cardDesign/`). Autres : 0 commit. |
| D02 (PR sans accord / non-DRAFT) | ✅ RAS | `gh pr list` : seules PR ouvertes = **#33 (DRAFT)** et #34 docs (DRAFT). Aucune PR non-draft d'un agent. |
| D03 (migration prod) | ✅ RAS | Aucun fichier `supabase/migrations/` dans les diffs. (Vérif SQL `schema_migrations` à faire au 1er push touchant la DB.) |
| D04 (secret en clair) | ✅ RAS | Diff Studio scanné — aucun `sk_`/`re_`/`eyJ`/`BEGIN PRIVATE KEY`. |
| D05 (force-push) | ✅ RAS | Studio @ `77f4554` = 1 commit linéaire au-dessus de `main`, pas de réécriture. |
| D14 (scope creep) | ✅ RAS | Studio strictement dans son lot. |
| D17 (invariant CLAUDE.md) | ✅ RAS | Voir cross-checks ci-dessous (INV.2 vérifié, aucune migration → INV.1/INV.6 N/A pour l'instant). |

## Cross-checks reproduits (loop C — reproduction indépendante)

Sur **Studio #33** (seul diff réel disponible) — 3 claims clés reproduits :

1. **FAIL-OPEN** (claim PR) → ✅ **CONFIRMÉ**. `applePass.ts` : la génération du
   strip est dans un `try { … } catch (e) { console.error(…) }` — toute erreur est
   loggée et le pass continue de se construire. Aucune exception propagée.
2. **INV.2 — Google jamais UPDATE/PUT** → ✅ **CONFIRMÉ**. `grep -inE
   "loyaltyclass|\.put\(|\.update\(|googleClass|mapGoogle"` sur **tout** le diff de
   branche → **0 hit**. Le diff est strictement Apple (`applePass.ts` +
   `cardDesign/stampStrip.ts`).
3. **Précédence de slot + gating** (claim PR) → ✅ **CONFIRMÉ**. Code :
   `const isStampsCard = !!design && (design.cardType ?? "stamps") === "stamps";`
   puis `if (isStampsCard && !designLogoBuffers["strip.png"]) { … }` → un visuel
   uploadé (`strip.png` déjà présent) **gagne** ; sinon génération. Gaté sur design
   publié de type tampons. Conforme à la description.

**Cohérence avec le méta-audit d'hier** : ce code de rendu strip s'active sur
`design.cardType === "stamps"`. Or le méta-audit a établi (correction D11) qu'un
`card_design` **est publié** pour Boulangerie Démo (version 2, tampons
`{goal:10, icon:☕, shape:circle}`). ⟹ une fois #33 mergé, la démo **devrait**
afficher un strip de tampons qui se remplit. Cohérent. (Constat de contexte, pas
une dérive.)

**PR #33 — claim vs diff** : la PR est **honnête**. Le titre cite « règles
éditables + couleurs/stamps découvrables » (B et C), mais le **corps** précise dès
la 1ʳᵉ ligne « **Cette PR livre la Priorité A seule** » et renvoie B/C à des PR
suivantes. Le diff (3 fichiers, rendu strip Apple) correspond exactement à
« Priorité A ». **Pas de D12 (sur-claim).**

## Cohérence inter-agents (auditLog.ts surtout)

- **Chevauchement Hygiène DB ↔ Outil démo sur `src/lib/auditLog.ts`** (nouvelles
  `AuditAction` susceptibles d'être ajoutées par les deux) : **rien à comparer
  encore** — aucun des deux n'a poussé. Baseline `auditLog.ts` = **47 actions**
  (`AUDIT_ACTIONS`), CHECK prod = 51 (cf. audit d'hier). **Rappel INV.1** : toute
  nouvelle `AuditAction` exige une migration jumelle de `audit_logs_action_check`.
  Je vérifierai à chaque push que (a) les ajouts des deux agents **coexistent**
  (pas d'écrasement mutuel) et (b) chaque ajout a sa migration.
- **Chevauchement Sécurité ↔ Studio sur fichiers racine** (`next.config.ts` vs
  `studio/`) : pas de conflit attendu ; Studio ne touche pas `next.config.ts`.
  RAS.

## Recommandation à l'utilisateur

🟢 **Rien à faire.** La vague de pushs n'a pas vraiment commencé : seul Studio #33
(déjà audité hier, conforme, DRAFT) a du contenu. Les 3 autres agents sont à la
ligne de départ.

**2 points de vigilance posés (pas des alertes) :**
1. **Arbre de travail partagé** par les 4 agents → fragilité (cf. observation
   structurelle). Si possible, donner à chaque agent son propre worktree. Sinon,
   risque de contamination de commits / D14 par accident.
2. **`feat/demo-rotate-pass-and-email-smoke` introuvable** — confirmer que l'agent
   Outil démo a bien démarré (ou note le nom réel de sa branche).

Prochain tour : boucle de veille 60 s sur les 4 branches + détection de tout push.

---
