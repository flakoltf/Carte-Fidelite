# AGENT-B-MANIFESTE — Panneau de contrôle super-admin

> Branche : `feat/agent-b-panneau-admin` (depuis `main` @ 312c970).
> Statut : **livré, tests verts, non mergé, rien appliqué en prod.**
> Dernière mise à jour : 2026-06-11.

## 1. Périmètre (contrat anti-collision)

**Territoire exclusif de cette branche :**
- Route group admin : `src/app/(app)/admin/**` (sauf `merchants/[id]/card/**` — studio de design, jamais touché).
- API admin : `src/app/api/admin/**`.
- Couche données cross-tenant : `src/lib/admin/**` (extensions additives), `src/lib/cron/recordRun.ts` (nouveau module).
- Données propres : leads/pipeline, `admin_notes`, `cron_runs`, `feature_flags`, `platform_settings`, snapshots billing (lecture), audit (lecture + nouvelles actions).

**Jamais touché (territoire agent marchand / partagé) :**
- `(app)/dashboard/**`, `(marketing)/**`, studio de design (`admin/merchants/[id]/card/**` + `src/lib/cardDesign/**`), `EditMerchantForm.tsx` (réutilisé tel quel), `MerchantsGrid.tsx` (remplacé dans la page mais **laissé en place** pour éviter tout conflit avec les branches `feat/admin-merchants-search` / agent A).
- Primitives partagées (`adminAuth.ts`, `auditLog.ts`, `supabaseAdmin.ts`, design tokens) : **étendues de façon additive uniquement** (voir §3), jamais réécrites.

**Seules modifications hors admin (additives, 3 lignes chacune) :**
- `src/app/api/cron/billing-snapshot/route.ts` et `src/app/api/cron/campaigns/route.ts` : appel `recordCronRun()` best-effort (ne casse jamais le job) pour alimenter la page Santé technique.

## 2. Migrations (3 fichiers, 100 % additifs — AUCUNE appliquée en prod)

| Fichier | Contenu |
|---|---|
| `supabase/migrations/20260611_admin_panel_audit_actions.sql` | CHECK `audit_logs_action_check` recréé avec les 22 actions existantes + 15 nouvelles (invariant n°1 — migration jumelle de `AUDIT_ACTIONS`) |
| `supabase/migrations/20260611_admin_merchant_controls.sql` | `merchants` : + `suspended_at`, `suspended_reason`, `plan_cap_override` · `leads` : + `status`, `next_followup_at`, `lost_reason`, `converted_merchant_id`, `updated_at` + 2 index |
| `supabase/migrations/20260611_admin_panel_tables.sql` | Tables `admin_notes`, `cron_runs`, `feature_flags`, `platform_settings` (RLS `is_admin()` en lecture, service-role en écriture) + 3 réglages initiaux (échéance certs Apple 2027-06-28, publishing Google `en_attente`, backup `null`) |

Aucune colonne/table/policy existante modifiée, renommée ou supprimée. Ordre d'application : les 3 fichiers dans l'ordre alphabétique (aucune dépendance croisée avec d'éventuelles migrations agent A).

## 3. Fichiers partagés étendus (additif strict)

- `src/lib/auditLog.ts` : 15 actions ajoutées à `AUDIT_ACTIONS` (aucune modifiée) — couvertes par la migration jumelle, test `auditActionsSync` vert.
- `AdminShell.tsx` : navigation refaite en 5 groupes (Pilotage / Marchands / Croissance / Facturation / Système) — fichier du territoire admin.

## 4. Ce qui a été construit

### Pages (toutes derrière `requireAdminPage` via le layout)
| URL | Contenu |
|---|---|
| `/admin` | God-view existante (PR #6) — conservée telle quelle |
| `/admin/merchants` | Table riche : recherche plein-texte, filtres (statut admin, santé rouge, à relancer, palier), tri 7 colonnes, jauges conso/limite |
| `/admin/merchants/[id]` | Centre de contrôle : vitals, jauge usage vs palier (plafond effectif avec override), **contrôles facturation** (palier/limite/essai/partenaire/cycle, confirmés), **zone de contrôle** (suspendre avec motif + re-saisie du nom, réactiver, reset mot de passe), notes CRM épinglables, timeline (audit + scans/jour), **clients nLPD gatés** (affichage explicite audité + export CSV confirmé), profil existant (EditMerchantForm) + QR |
| `/admin/leads` | Mini-CRM : KPIs funnel, relances dues, pipeline 5 colonnes (nouveau→contacté→démo→gagné/perdu), saisie terrain, motif de perte, lien vers marchand converti |
| `/admin/billing` | MRR estimé (placeholder honnête), répartition par palier, dépassements/upsell, table complète des abonnements, historique snapshots |
| `/admin/wallet` | Alerte expiration certificats Apple, état canaux Apple/Google, publishing Google, parc passes/appareils, mises à jour 7 j, notifications, échecs d'émission = non trackés (dit honnêtement, instrumentation proposée) |
| `/admin/system` | Crons avec historique réel (`cron_runs`) + vérification croisée snapshots, intégrations (présence env, jamais les valeurs), santé audit log, attestation backups, garde-fous CI |
| `/admin/audit` | Journal complet filtrable (action/marchand/période/sensibles), paginé (50/p), compteurs sécurité (logins échoués, impersonations, sensibles, exports), limites connues (rate-limit et MFA non journalisés) |
| `/admin/templates` | Designs du parc + défauts + répartition secteur — **référence** le studio (liens), ne l'édite pas |
| `/admin/settings` | Grille canonique 69/129/199 (lecture seule, source = code), feature flags DB (CRUD confirmé/audité) + gates env (lecture seule), réglages opérationnels (certs/publishing/backup), comptes super-admin (lecture seule — promotion volontairement hors UI) |

### Routes API (toutes : `requireAdminApi` + validation pure + filtre tenant + `logAuditEvent`)
| Route | Méthodes | Audit |
|---|---|---|
| `/api/admin/merchants/[id]/suspension` | POST | MERCHANT_SUSPENDED / MERCHANT_REACTIVATED |
| `/api/admin/merchants/[id]/billing` | PATCH | MERCHANT_PLAN_CHANGED / MERCHANT_LIMIT_ADJUSTED / MERCHANT_BILLING_UPDATED (avant/après) |
| `/api/admin/merchants/[id]/reset-password` | POST | MERCHANT_PASSWORD_RESET |
| `/api/admin/merchants/[id]/customers` | GET (paginé 25) | ADMIN_CUSTOMER_DATA_ACCESSED |
| `/api/admin/merchants/[id]/export` | GET (CSV, anti-injection tableur, BOM) | DATA_EXPORTED |
| `/api/admin/notes` + `/api/admin/notes/[noteId]` | POST / PATCH / DELETE | ADMIN_NOTE_ADDED / ADMIN_NOTE_DELETED |
| `/api/admin/leads` + `/api/admin/leads/[id]` | POST / PATCH / DELETE | LEAD_CREATED / LEAD_UPDATED / LEAD_DELETED |
| `/api/admin/flags` | PUT | FEATURE_FLAG_UPDATED |
| `/api/admin/settings` | PUT (liste fermée de clés) | PLATFORM_SETTING_UPDATED |

### Couche `src/lib/admin/` (fetchers ≠ calculs purs testés, pattern overviewCompute)
`merchantControls`, `merchantsList(+Compute)`, `merchantDetail`, `leads(+Compute)`, `billingOverview`, `walletOps`, `systemHealth`, `auditQuery`, `platform`, `csv` — et `src/lib/cron/recordRun.ts`.

### Seed
`scripts/seed-admin-demo.mjs` (`--dry-run` dispo) : 7 leads à toutes les étapes + notes (1 épinglée), purge idempotente limitée à `source_path='seed:admin-demo'`. Prérequis : migrations 20260611 appliquées. Complète `seed-demo-fleet.mjs`.

## 5. Sécurité & traçabilité (colonne vertébrale)

- Gate fail-closed prouvé : `surfaceGuards.test.ts` (statique, couvre automatiquement toute nouvelle route) + **`adminAuth.test.ts`** (runtime : 401 anonyme, 403 marchand, accès admin).
- Invariant n°3 respecté : tout `supabaseAdmin` est filtré `.eq("merchant_id"|"id", …)` ; les vues cross-tenant (merchant_health) restent service-role.
- Actions irréversibles/à impact : ConfirmDialog systématique (motif obligatoire pour suspension + re-saisie du nom ; résumé avant/après pour la facturation ; confirmation pour exports, suppressions, flags, attestation backup).
- nLPD : pages = agrégats ; l'accès nominatif est un clic explicite, paginé, audité ; l'export CSV est confirmé, audité, échappé (RFC 4180 + neutralisation formules).

## 6. Dépendances / décisions pour le fondateur (à l'intégration)

0. **⚠️ FUSION AVEC L'AGENT A — migration jumelle unique du CHECK.** Les deux branches recréent `audit_logs_action_check` (`20260611_audit_actions_studio.sql` côté A : +3 actions studio ; `20260611_admin_panel_audit_actions.sql` côté B : +15 actions admin). Chacune écraserait les actions de l'autre, et le test `auditActionsSync` (qui lit la migration lexicalement la plus récente) échouera après merge. Correctif : APRÈS la fusion des deux branches, ajouter cette migration (et l'appliquer en dernier en prod) :

   ```sql
   -- supabase/migrations/20260612_audit_actions_merged.sql
   -- Union des actions agent A (studio) + agent B (panneau admin).
   ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;
   ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_check
     CHECK (action = ANY (ARRAY[
       'CARD_GENERATED','CARD_SCANNED','POINTS_INCREMENTED',
       'LOGIN_SUCCESS','LOGIN_FAILED','MERCHANT_CREATED','CUSTOMER_DELETED',
       'MERCHANT_UPDATED','MERCHANT_TOKEN_ROTATED','REWARD_REDEEMED',
       'CUSTOMER_UPDATED','MFA_ENROLLED','MFA_DISABLED',
       'ADMIN_IMPERSONATION_START','ADMIN_IMPERSONATION_STOP',
       'CARD_DESIGN_UPDATED','CARD_CLASS_SYNCED',
       'SUBSCRIPTION_CREATED','SUBSCRIPTION_UPDATED','SUBSCRIPTION_CANCELED',
       'PAYMENT_SUCCEEDED','PAYMENT_FAILED',
       -- Agent A (studio marchand)
       'CARD_DESIGN_DRAFT_SAVED','CARD_DESIGN_PUBLISHED','CARD_ASSET_UPLOADED',
       -- Agent B (panneau super-admin)
       'MERCHANT_SUSPENDED','MERCHANT_REACTIVATED',
       'MERCHANT_PLAN_CHANGED','MERCHANT_LIMIT_ADJUSTED','MERCHANT_BILLING_UPDATED',
       'MERCHANT_PASSWORD_RESET',
       'ADMIN_NOTE_ADDED','ADMIN_NOTE_DELETED',
       'LEAD_CREATED','LEAD_UPDATED','LEAD_DELETED',
       'ADMIN_CUSTOMER_DATA_ACCESSED','DATA_EXPORTED',
       'FEATURE_FLAG_UPDATED','PLATFORM_SETTING_UPDATED'
     ]));
   ```

   (La fusion de `src/lib/auditLog.ts` est un simple merge additif des deux listes — aucun conflit de noms entre A et B, vérifié le 2026-06-11.)

1. **Appliquer les 3 migrations 20260611_*** en prod (avec ton accord explicite — invariant n°6 : vérifier l'état réel avant, la prod a déjà reçu des patchs hors-repo). Si fusion avec l'agent A : appliquer aussi ses migrations puis la `20260612_audit_actions_merged.sql` ci-dessus EN DERNIER.
2. **Blocage comptoir des suspendus** : la suspension est enregistrée/affichée/auditée, mais `/api/scan` et `/api/enroll` (fichiers partagés hors de mon territoire) ne la consultent pas encore. Patch d'une ligne à brancher à l'intégration : refuser si `merchants.suspended_at IS NOT NULL`.
3. **Échecs d'émission wallet** : non trackés — proposition : action `PASS_ISSUE_FAILED` (+ migration jumelle) émise par generate-apple-pass / generate-google-pass.
4. **Hits de rate-limit & échecs MFA** : non journalisés — même mécanisme proposé (`RATE_LIMITED`, `MFA_FAILED`).
5. **Templates sectoriels** : table `card_design_templates` à concevoir AVEC l'agent marchand (le studio est chez lui).
6. **Vue `billing_active_cards`** : non modifiée (objet partagé). Le `plan_cap_override` est appliqué en code (`effectiveCap`) — si un jour la vue doit le refléter, c'est une décision d'intégration.
7. **Build local** : la branche fait grossir le build → OOM avec le heap Node par défaut sur la machine locale. Utiliser `NODE_OPTIONS=--max-old-space-size=6144 npm run build` (Vercel non concerné). `.nvmrc` = Node 22.
8. **MerchantsGrid.tsx** : remplacé par `MerchantsTable.tsx` dans la page mais laissé sur le disque (anti-conflit avec `feat/admin-merchants-search`) — à supprimer après fusion des deux branches si plus utilisé.

## 7. Comment vérifier

```bash
cd app   # (worktree : .claude/worktrees/agent-b)
npx vitest run        # 67 fichiers / 403 tests verts (dont adminAuth + 5 suites agent B)
npm run lint          # 0 erreur (2 warnings préexistants côté dashboard marchand)
npx tsc --noEmit      # propre
NODE_OPTIONS=--max-old-space-size=6144 npm run build   # vert, 13 pages + 16 routes API admin
```

Parcours manuel (après application des migrations sur un environnement de test + `node scripts/seed-demo-fleet.mjs` + `node scripts/seed-admin-demo.mjs`) :
1. Connexion admin → sidebar en 5 groupes.
2. `/admin/merchants` : chercher « pizzeria », filtrer 🔴, trier par conso → ouvrir la fiche.
3. Fiche marchand : changer le palier (résumé + confirmation → audité), suspendre (motif + re-saisie du nom → bandeau rouge + statut partout), réactiver, reset mot de passe (lien affiché), épingler une note → le marchand apparaît dans « 🚩 À relancer », afficher les clients (audité) puis exporter le CSV (confirmé).
4. `/admin/leads` : pipeline plein (7 leads), déplacer un lead d'étape, poser une date de relance hier → bloc « relances dues ».
5. `/admin/billing` : Institut Belle Rive en upsell (~86 % du plafond essentiel).
6. `/admin/system` : intégrations rouges/vertes selon les env, backups « jamais vérifié ».
7. `/admin/audit` : filtrer « Sensibles uniquement » → retrouver chaque action des étapes 3–4 avec IP et détails avant/après.
8. `/admin/settings` : basculer un flag (confirmé), attester un backup → visible en Santé technique.
9. Anti-régression sécurité : en marchand, `/admin/*` redirige vers `/dashboard` ; `curl` sur une route `/api/admin/*` sans session → 401, avec session marchand → 403.

## 8. Commits de la branche

`git log main..feat/agent-b-panneau-admin --oneline` — 6 commits conventionnels FR : fondations data → couche data-access → routes API → UI (9 pages) → tests → seed + manifeste.
