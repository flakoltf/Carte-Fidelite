# HALO Light — App Redesign Lot 2 (Clients + Segments) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Passer les écrans **Clients** et **Segments** en HALO Light, et coder un **code couleur de statut** (pastille colorée par segment) sur la liste Clients, en réutilisant le moteur de segmentation existant.

**Architecture:** Réutilise les tokens/primitives du Lot 1 (`bg-surface`, `border-line-warm`, `text-onyx`, `text-galet-ink`, `bg-halo`, `font-display`). Nouveau : un petit module pur `stageStyle.ts` (couleur + libellé par segment) et un export `fetchCustomerStages()` qui réutilise `loadClassified()` (déjà testé) pour donner à la page Clients une `Map<customerId → stage>`. La pastille (avatar) de chaque ligne est colorée via `style={{ backgroundColor }}` (couleur dynamique → pas de classe Tailwind dynamique). Branche `design/halo-light-app` (worktree `…-worktrees/design`).

**Tech Stack:** Next.js 16, React 19, Tailwind v4, Vitest (logique pure), Recharts (n/a ici), lucide-react.

**Cadrage validé (companion visuel) :** tableau Clients aéré, **pastille de statut colorée à gauche** (pas le nom), colonnes **Client · Dernière visite (gauche) · Fidélité (droite) · Actions**, email discret sous le nom, légende en haut. Code couleur **vif** :

| Segment (StageKey) | Libellé légende | Couleur |
|---|---|---|
| `vip` | VIP | `#D69220` (or) |
| `regulier` | Régulier | `#2E9E5B` (vert) |
| `nouveau` | Nouveau | `#2E7DD1` (bleu) |
| `en_train_de_partir` | À risque | `#DC3B3B` (rouge) |
| `inactif` | Inactif | `#98999C` (gris) |

---

## Task 1: Module pur `stageStyle` (couleur + libellé par segment)

**Files:**
- Create: `src/lib/segments/stageStyle.ts`
- Test: `src/lib/segments/__tests__/stageStyle.test.ts`

- [ ] **Step 1: Écrire le test (TDD)**

`src/lib/segments/__tests__/stageStyle.test.ts` :
```ts
import { describe, it, expect } from "vitest";
import { STAGE_KEYS } from "../types";
import { STAGE_STYLE, LEGEND_ORDER } from "../stageStyle";

describe("stageStyle", () => {
  it("définit une couleur et un libellé pour chaque StageKey", () => {
    for (const k of STAGE_KEYS) {
      expect(STAGE_STYLE[k].color).toMatch(/^#[0-9A-F]{6}$/i);
      expect(STAGE_STYLE[k].label.length).toBeGreaterThan(0);
    }
  });
  it("la légende couvre les 5 segments, sans doublon", () => {
    expect([...LEGEND_ORDER].sort()).toEqual([...STAGE_KEYS].sort());
  });
});
```

- [ ] **Step 2: Lancer le test → échec attendu**

Run: `npx vitest run src/lib/segments/__tests__/stageStyle.test.ts`
Expected: FAIL (module `stageStyle` introuvable).

- [ ] **Step 3: Implémenter `stageStyle.ts`**

```ts
import type { StageKey } from "./types";

// Couleur de statut (vive) + libellé court pour la pastille/légende de la liste Clients.
export const STAGE_STYLE: Record<StageKey, { color: string; label: string }> = {
  vip: { color: "#D69220", label: "VIP" },
  regulier: { color: "#2E9E5B", label: "Régulier" },
  nouveau: { color: "#2E7DD1", label: "Nouveau" },
  en_train_de_partir: { color: "#DC3B3B", label: "À risque" },
  inactif: { color: "#98999C", label: "Inactif" },
};

// Ordre d'affichage de la légende.
export const LEGEND_ORDER: StageKey[] = ["vip", "regulier", "nouveau", "en_train_de_partir", "inactif"];
```

- [ ] **Step 4: Test → vert**

Run: `npx vitest run src/lib/segments/__tests__/stageStyle.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/segments/stageStyle.ts src/lib/segments/__tests__/stageStyle.test.ts
git commit -m "feat(segments): pure stageStyle (color + label per segment)"
```

---

## Task 2: Exposer `fetchCustomerStages()` (réutilise loadClassified)

**Files:**
- Modify: `src/lib/segments/fetch.ts` (ajouter un export ; `loadClassified` existe déjà dans ce fichier)

- [ ] **Step 1: Ajouter la fonction**

Dans `src/lib/segments/fetch.ts`, après `fetchAudienceCardIds`, ajouter :
```ts
// Map customerId → stage, pour colorer la liste Clients par segment. Réutilise loadClassified.
export async function fetchCustomerStages(merchantId: string): Promise<Record<string, StageKey>> {
  const rows = await loadClassified(merchantId);
  const map: Record<string, StageKey> = {};
  for (const r of rows) map[r.stats.customerId] = r.cls.stage;
  return map;
}
```
(`StageKey` est déjà importé en tête de fichier ; `loadClassified` retourne `{ stats, cls, cardIds }` avec `stats.customerId` et `cls.stage`.)

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: PASS (vérifie le typage de l'export).

- [ ] **Step 3: Commit**

```bash
git add src/lib/segments/fetch.ts
git commit -m "feat(segments): fetchCustomerStages map for client list coloring"
```

---

## Task 3: Page Clients — câbler les stages + restyle HALO Light

**Files:**
- Modify: `src/app/dashboard/customers/page.tsx`
- Modify: `src/app/dashboard/customers/CustomersTable.tsx`

- [ ] **Step 1: Fournir `stageByCustomer` à la table (page.tsx)**

Dans `src/app/dashboard/customers/page.tsx`, ajouter l'import et l'appel, et passer la prop :
```tsx
import { fetchCustomerStages } from "@/lib/segments/fetch";
```
Après avoir résolu `merchant`, calculer (en parallèle du fetch clients existant ou après) :
```tsx
  const stageByCustomer = merchant ? await fetchCustomerStages(merchant.id) : {};
```
Et passer la prop :
```tsx
  return <CustomersTable customers={(customers ?? []) as CustomerListItem[]} stampGoal={stampGoal} stageByCustomer={stageByCustomer} />;
```

- [ ] **Step 2: Restyler CustomersTable (HALO Light + pastille colorée + colonnes réordonnées + légende)**

Dans `src/app/dashboard/customers/CustomersTable.tsx` :

1. Imports en tête : ajouter
```tsx
import { STAGE_STYLE, LEGEND_ORDER } from "@/lib/segments/stageStyle";
import type { StageKey } from "@/lib/segments/types";
```
2. Signature du composant → ajouter la prop :
```tsx
export function CustomersTable({ customers, stampGoal, stageByCustomer }: { customers: CustomerListItem[]; stampGoal: number; stageByCustomer: Record<string, StageKey> }) {
```
3. Remplacer tout le `return (...)` par (conserver la logique `del`, `filtered`, `editing`, le `RedeemCell` et `EditCustomerModal` tels quels) :
```tsx
  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-tight mb-2 text-onyx">Base Clients</h1>
          <p className="text-galet-ink">Gérez vos {customers.length} clients enregistrés.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-galet" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} type="text" placeholder="Rechercher..."
              className="bg-surface border border-line-warm rounded-xl py-2 pl-10 pr-4 text-sm text-onyx focus:border-halo outline-none transition-all w-full md:w-64" />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className="bg-surface border border-line-warm rounded-xl py-2 px-3 text-sm text-galet-ink">
            <option value="all">Tous</option>
            <option value="full">Carte pleine</option>
            <option value="nocard">Sans carte</option>
          </select>
        </div>
      </div>

      {/* Légende des statuts */}
      <div className="flex flex-wrap gap-4 text-xs text-galet-ink">
        {LEGEND_ORDER.map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STAGE_STYLE[k].color }} />
            {STAGE_STYLE[k].label}
          </span>
        ))}
      </div>

      <div className="bg-surface border border-line-warm rounded-[32px] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-line-warm text-xs font-bold text-galet uppercase tracking-widest bg-[#F7F5EF]">
                <th className="px-8 py-5">Client</th>
                <th className="px-8 py-5">Dernière visite</th>
                <th className="px-8 py-5">Fidélité</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F2EEE4]">
              {filtered.length > 0 ? filtered.map((customer) => {
                const card = customer.loyalty_cards?.[0];
                const stage = stageByCustomer[customer.id];
                const dot = stage ? STAGE_STYLE[stage].color : "#98999C";
                return (
                  <tr key={customer.id} className="hover:bg-[#FBFAF6] transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: dot }}
                          title={stage ? STAGE_STYLE[stage].label : undefined}>
                          {customer.full_name[0]}
                        </div>
                        <div>
                          <div className="font-bold text-onyx">{customer.full_name}</div>
                          <div className="text-xs text-galet">{customer.email || "Email non renseigné"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 text-sm text-galet-ink">
                        <Calendar className="w-4 h-4 text-galet" />
                        {card?.last_scan ? new Date(card.last_scan).toLocaleDateString() : "—"}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      {card ? (
                        <div className="flex items-center gap-3">
                          <div className="w-24 h-1.5 bg-[#ECE7DB] rounded-full overflow-hidden">
                            <div className="h-full bg-halo" style={{ width: `${Math.min(100, (card.stamps_count / stampGoal) * 100)}%` }} />
                          </div>
                          <span className="text-sm text-galet-ink whitespace-nowrap">{card.stamps_count}/{stampGoal}</span>
                        </div>
                      ) : (<span className="text-xs text-galet italic">Pas de carte active</span>)}
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center justify-end gap-2">
                        <RedeemCell cardId={card?.id ?? null} stampsCount={card?.stamps_count ?? null} goal={stampGoal} customerName={customer.full_name} />
                        <button onClick={() => setEditing({ id: customer.id, full_name: customer.full_name, email: customer.email, phone: customer.phone })}
                          title="Modifier" className="p-2 rounded-lg border border-line-warm hover:bg-calcaire">
                          <Pencil className="w-4 h-4 text-galet-ink" />
                        </button>
                        <button onClick={() => del(customer)} title="Supprimer"
                          className="p-2 rounded-lg border border-red-500/30 hover:bg-red-500/10">
                          <Trash2 className="w-4 h-4 text-red-600" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={4} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-4 text-galet">
                      <Users className="w-12 h-12 opacity-30" />
                      <p>Aucun client trouvé.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && <EditCustomerModal customer={editing} onClose={() => setEditing(null)} />}
    </div>
  );
```
Note : on supprime la colonne « Contact » (email passe sous le nom, téléphone reste dans la modale d'édition). Les icônes `Mail`/`Smartphone` ne sont plus utilisées → retirer ces deux entrées de l'import lucide (`Search, Calendar, Users, Pencil, Trash2` suffisent).

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: PASS (vérifier qu'aucun import inutilisé ne casse l'ESLint).

- [ ] **Step 4: Vérif visuelle**

Capturer `/dashboard/customers` (login démo) → pastilles colorées par segment, date à gauche, jauge à droite, légende, fond clair. Aucun `zinc-`/`text-emerald-400` résiduel (`grep -nE "zinc-|emerald-400" src/app/dashboard/customers/CustomersTable.tsx` → vide).

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/customers/page.tsx src/app/dashboard/customers/CustomersTable.tsx
git commit -m "feat(design): HALO Light Clients table + per-segment colored avatar"
```

---

## Task 4: Page Segments — restyle HALO Light

**Files:**
- Modify: `src/app/dashboard/segments/SegmentsView.tsx`

- [ ] **Step 1: Appliquer la substitution + accent couleur de statut**

Dans `SegmentsView.tsx`, importer le style de stage :
```tsx
import { STAGE_STYLE } from "@/lib/segments/stageStyle";
```
Puis appliquer la table de substitution HALO Light (identique au Lot 1) sur tout le composant :
- titres de famille `text-zinc-400` → `text-galet-ink`
- cartes de segment `bg-zinc-900/40 border-zinc-800` → `bg-surface border-line-warm shadow-sm` ; hover/actif `hover:border-emerald-500/50` / `border-emerald-500/70` → `hover:border-halo/50` / `border-halo`
- libellé carte `text-zinc-300` → `text-onyx` ; compteur `text-3xl font-bold` → ajouter `text-onyx` ; `text-emerald-400` (pct) → `text-halo`
- **Accent statut** : ajouter en haut de chaque carte de segment une pastille couleur du stage :
```tsx
<span className="inline-block w-2.5 h-2.5 rounded-full mb-2" style={{ backgroundColor: STAGE_STYLE[stage].color }} />
```
(placée avant le `STAGE_LABELS[stage]`).
- étiquettes (`bg-zinc-900/40 border-zinc-800`) → `bg-surface border-line-warm`
- panneau membres `bg-zinc-900/40 border-zinc-800` → `bg-surface border-line-warm shadow-sm` ; bouton « Exporter CSV » `bg-emerald-500 text-black` → `bg-halo text-white` ; skeleton `bg-zinc-800/40` → `bg-[#ECE7DB]` ; `text-zinc-600` → `text-galet` ; table membres : `text-zinc-500 border-zinc-800` → `text-galet border-line-warm`, lignes `border-zinc-900` → `border-[#F2EEE4]`, `text-zinc-400` → `text-galet-ink`.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Vérif**

`grep -nE "zinc-|bg-emerald-500 text-black|text-emerald-400" src/app/dashboard/segments/SegmentsView.tsx` → vide. Capturer `/dashboard/segments` → cartes claires avec pastille de couleur de statut.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/segments/SegmentsView.tsx
git commit -m "feat(design): HALO Light Segments view + status color accents"
```

---

## Task 5: Vérification finale Lot 2

- [ ] **Step 1: Tests + build**

Run: `npx vitest run src/lib/segments/ && npm run build`
Expected: tests verts, build OK.

- [ ] **Step 2: Grep résidus**

Run: `grep -rnE "zinc-|bg-white text-black|text-emerald-400|bg-emerald-500 text-black" src/app/dashboard/customers/CustomersTable.tsx src/app/dashboard/customers/page.tsx src/app/dashboard/segments/`
Expected: vide.

- [ ] **Step 3: Captures avant/après**

Capturer `/dashboard/customers` et `/dashboard/segments` en HALO Light. Vérifier le code couleur des pastilles (VIP or, Régulier vert, Nouveau bleu, À risque rouge, Inactif gris), contraste lisible, et que `RedeemCell` (feature encaissement) fonctionne toujours dans la colonne Actions.

- [ ] **Step 4: Commit final éventuel**

```bash
git add -A src/app/dashboard/customers src/app/dashboard/segments src/lib/segments
git commit -m "fix(design): HALO Light Lot 2 polish"
```

## Notes d'exécution
- Travailler dans le worktree `…-worktrees/design` sur la branche `design/halo-light-app`.
- **Ne pas modifier** `RedeemCell.tsx` (territoire feature encaissement/antifraude) — juste le garder dans la colonne Actions.
- Couleurs de statut = hex dynamiques → appliquées via `style={{ backgroundColor }}` (pas de classe Tailwind dynamique, sinon purge).
- Ne pas toucher la landing ni les écrans hors périmètre.
