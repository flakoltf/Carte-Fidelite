# A2 — Recherche / filtre / tri / pagination de la liste marchands — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à l'admin de retrouver vite un marchand dans la liste (recherche nom/email, filtres mode concierge / type de commerce / carte configurée, tri récent ou nom, pagination).

**Architecture:** On mirror le pattern existant de la page clients (`src/lib/customers/filter.ts` + `CustomersTable.tsx`) : la page serveur charge les marchands + données dérivées et les passe à un composant client qui filtre/trie/pagine **en mémoire** via une fonction **pure et testée** (`useState` + `useMemo`). Pas de `searchParams` (aucune page n'en utilise dans ce projet). Échelle modeste assumée.

**Tech Stack:** Next.js (version modifiée — lire `node_modules/next/dist/docs/` avant d'écrire), React (client component `"use client"`), Supabase (`@/utils/supabase/server`), Vitest (tests des fonctions pures, convention `__tests__/*.test.ts`), Tailwind (tokens HALO).

**Périmètre (A2 « mince », validé)** : filtres basés sur les données EXISTANTES uniquement. Les filtres par état du cycle de vie (Essai/Actif/Impayé/Suspendu) sont **hors A2** (dépendent d'un champ `status` introduit en vague 2).

**Exécution** : dans un **worktree isolé** créé via `superpowers:using-git-worktrees`, branche `feat/admin-merchants-search` **basée sur `feat/admin-card-editor`** (code admin le plus à jour ; l'autre agent est sur l'éditeur de carte, pas sur la liste → aucune collision). NE PAS travailler sur `feat/wallet-config`.

---

## File Structure

- **Create** `src/lib/admin/merchantsFilter.ts` — fonction pure `filterMerchants` + `paginate` + types `MerchantListItem`/`MerchantFilters`/`MerchantSort` + constantes. Une seule responsabilité : filtrer/trier/paginer une liste en mémoire. Aucune dépendance React/Supabase.
- **Create** `src/lib/admin/__tests__/merchantsFilter.test.ts` — tests unitaires de la fonction pure.
- **Create** `src/app/admin/merchants/MerchantsGrid.tsx` — composant client : barre de recherche/filtres/tri, grille des cartes marchand (déplacée depuis `page.tsx`), pagination, états vides. Consomme `filterMerchants`/`paginate`.
- **Modify** `src/app/admin/merchants/page.tsx` — la page serveur charge les marchands (+ `business_type`), l'ensemble des `card_designs.merchant_id` (pour « carte configurée »), les comptes clients/scans, construit `MerchantListItem[]` et rend `<MerchantsGrid>`. Garde l'en-tête + le bouton « Nouveau marchand ».

---

## Task 1 : Fonction pure de filtrage + tests

**Files:**
- Create: `src/lib/admin/merchantsFilter.ts`
- Test: `src/lib/admin/__tests__/merchantsFilter.test.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

`src/lib/admin/__tests__/merchantsFilter.test.ts` :

```ts
import { describe, it, expect } from "vitest";
import {
  filterMerchants,
  paginate,
  type MerchantListItem,
  type MerchantFilters,
} from "../merchantsFilter";

const mk = (over: Partial<MerchantListItem>): MerchantListItem => ({
  id: "1",
  shop_name: "Café Lumen",
  email: "lumen@ex.ch",
  primary_color: "#0D6B5E",
  enrollment_token: "tok-1",
  business_type: "cafe",
  managed_by_concierge: false,
  created_at: "2026-01-01T00:00:00.000Z",
  has_card: true,
  customer_count: 0,
  scan_count: 0,
  ...over,
});

const ALL: MerchantFilters = { businessType: "all", concierge: "all", hasCard: "all" };

const list: MerchantListItem[] = [
  mk({ id: "1", shop_name: "Café Lumen", email: "lumen@ex.ch", business_type: "cafe", managed_by_concierge: true, has_card: true, created_at: "2026-01-03T00:00:00.000Z" }),
  mk({ id: "2", shop_name: "Boulangerie Aube", email: "aube@ex.ch", business_type: "boulangerie", managed_by_concierge: false, has_card: false, created_at: "2026-01-02T00:00:00.000Z" }),
  mk({ id: "3", shop_name: "Atelier Zed", email: null, business_type: "boutique", managed_by_concierge: false, has_card: true, created_at: "2026-01-01T00:00:00.000Z" }),
];

describe("filterMerchants", () => {
  it("renvoie tout (trié récent par défaut) sans recherche ni filtre", () => {
    expect(filterMerchants(list, "", ALL, "recent").map((m) => m.id)).toEqual(["1", "2", "3"]);
  });

  it("recherche par nom, insensible à la casse", () => {
    expect(filterMerchants(list, "aube", ALL, "recent").map((m) => m.id)).toEqual(["2"]);
  });

  it("recherche par email", () => {
    expect(filterMerchants(list, "lumen@", ALL, "recent").map((m) => m.id)).toEqual(["1"]);
  });

  it("tolère un email null à la recherche", () => {
    expect(filterMerchants(list, "zed", ALL, "recent").map((m) => m.id)).toEqual(["3"]);
  });

  it("filtre par type de commerce", () => {
    expect(filterMerchants(list, "", { ...ALL, businessType: "cafe" }, "recent").map((m) => m.id)).toEqual(["1"]);
  });

  it("filtre mode concierge = oui", () => {
    expect(filterMerchants(list, "", { ...ALL, concierge: "yes" }, "recent").map((m) => m.id)).toEqual(["1"]);
  });

  it("filtre carte configurée = non", () => {
    expect(filterMerchants(list, "", { ...ALL, hasCard: "no" }, "recent").map((m) => m.id)).toEqual(["2"]);
  });

  it("trie par nom (A→Z)", () => {
    expect(filterMerchants(list, "", ALL, "name").map((m) => m.shop_name)).toEqual([
      "Atelier Zed",
      "Boulangerie Aube",
      "Café Lumen",
    ]);
  });

  it("trie par plus récent", () => {
    expect(filterMerchants(list, "", ALL, "recent").map((m) => m.id)).toEqual(["1", "2", "3"]);
  });

  it("combine recherche + filtre + tri", () => {
    expect(
      filterMerchants(list, "e", { ...ALL, hasCard: "yes" }, "name").map((m) => m.id),
    ).toEqual(["3", "1"]); // "Atelier Zed" et "Café Lumen" contiennent "e", has_card, triés par nom
  });
});

describe("paginate", () => {
  const nums = [1, 2, 3, 4, 5];
  it("renvoie la 1re page", () => {
    expect(paginate(nums, 1, 2)).toEqual([1, 2]);
  });
  it("renvoie une page du milieu", () => {
    expect(paginate(nums, 2, 2)).toEqual([3, 4]);
  });
  it("borne page < 1 à la 1re page", () => {
    expect(paginate(nums, 0, 2)).toEqual([1, 2]);
  });
  it("renvoie un tableau vide au-delà de la fin", () => {
    expect(paginate(nums, 9, 2)).toEqual([]);
  });
});
```

- [ ] **Step 2: Lancer les tests pour vérifier qu'ils échouent**

Run: `npx vitest run src/lib/admin/__tests__/merchantsFilter.test.ts`
Expected: FAIL — `Cannot find module '../merchantsFilter'`.

- [ ] **Step 3: Écrire l'implémentation minimale**

`src/lib/admin/merchantsFilter.ts` :

```ts
export type MerchantListItem = {
  id: string;
  shop_name: string;
  email: string | null;
  primary_color: string | null;
  enrollment_token: string;
  business_type: string | null;
  managed_by_concierge: boolean;
  created_at: string; // ISO
  has_card: boolean;
  customer_count: number;
  scan_count: number;
};

export type TriState = "all" | "yes" | "no";
export type MerchantSort = "recent" | "name";
export const MERCHANT_SORTS: MerchantSort[] = ["recent", "name"];
export const MERCHANTS_PAGE_SIZE = 12;

export type MerchantFilters = {
  businessType: string; // "all" ou une valeur de BUSINESS_TYPES
  concierge: TriState;
  hasCard: TriState;
};

function triMatch(state: TriState, value: boolean): boolean {
  return state === "all" || (state === "yes") === value;
}

export function filterMerchants(
  list: MerchantListItem[],
  query: string,
  filters: MerchantFilters,
  sort: MerchantSort,
): MerchantListItem[] {
  const q = query.trim().toLowerCase();

  const filtered = list.filter((m) => {
    const matchesQuery =
      !q ||
      m.shop_name.toLowerCase().includes(q) ||
      (m.email ?? "").toLowerCase().includes(q);
    if (!matchesQuery) return false;
    if (filters.businessType !== "all" && m.business_type !== filters.businessType) return false;
    if (!triMatch(filters.concierge, m.managed_by_concierge)) return false;
    if (!triMatch(filters.hasCard, m.has_card)) return false;
    return true;
  });

  // ISO strings → comparaison lexicographique = chronologique.
  return [...filtered].sort((a, b) =>
    sort === "name"
      ? a.shop_name.localeCompare(b.shop_name, "fr")
      : b.created_at.localeCompare(a.created_at),
  );
}

export function paginate<T>(list: T[], page: number, pageSize: number): T[] {
  const start = (Math.max(1, page) - 1) * pageSize;
  return list.slice(start, start + pageSize);
}
```

- [ ] **Step 4: Lancer les tests pour vérifier qu'ils passent**

Run: `npx vitest run src/lib/admin/__tests__/merchantsFilter.test.ts`
Expected: PASS (14 tests : 10 `filterMerchants` + 4 `paginate`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/merchantsFilter.ts src/lib/admin/__tests__/merchantsFilter.test.ts
git commit -m "feat(admin): fonction pure filterMerchants + paginate (testée)"
```

---

## Task 2 : Composant client `MerchantsGrid`

**Files:**
- Create: `src/app/admin/merchants/MerchantsGrid.tsx`

> Pas de test unitaire (UI/interaction) ; vérifié au build + lint en Task 3. Réutilise `EnrollmentQR`, `ManageAsButton`, `ManagementModeToggle` (déjà dans ce dossier) et `BUSINESS_TYPES` (`@/lib/merchant-config/types`). La grille des cartes est **déplacée** depuis `page.tsx` (Task 3 retire l'ancienne).

- [ ] **Step 1: Créer le composant**

`src/app/admin/merchants/MerchantsGrid.tsx` :

```tsx
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Pencil, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { BUSINESS_TYPES } from "@/lib/merchant-config/types";
import EnrollmentQR from "../EnrollmentQR";
import ManageAsButton from "./ManageAsButton";
import ManagementModeToggle from "./ManagementModeToggle";
import {
  filterMerchants,
  paginate,
  MERCHANTS_PAGE_SIZE,
  type MerchantListItem,
  type MerchantFilters,
  type MerchantSort,
  type TriState,
} from "@/lib/admin/merchantsFilter";

const selectCls =
  "bg-surface border border-line-warm rounded-xl px-3 py-2 text-sm text-onyx focus:border-halo outline-none transition-colors";

export default function MerchantsGrid({
  items,
  origin,
}: {
  items: MerchantListItem[];
  origin: string;
}) {
  const [query, setQuery] = useState("");
  const [businessType, setBusinessType] = useState("all");
  const [concierge, setConcierge] = useState<TriState>("all");
  const [hasCard, setHasCard] = useState<TriState>("all");
  const [sort, setSort] = useState<MerchantSort>("recent");
  const [page, setPage] = useState(1);

  const filters: MerchantFilters = { businessType, concierge, hasCard };

  const filtered = useMemo(
    () => filterMerchants(items, query, filters, sort),
    [items, query, businessType, concierge, hasCard, sort],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / MERCHANTS_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = paginate(filtered, safePage, MERCHANTS_PAGE_SIZE);

  // Revenir page 1 quand un critère change.
  const onCriteriaChange = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(1);
  };

  // Aucun marchand du tout (≠ aucun résultat de filtre).
  if (items.length === 0) {
    return (
      <div className="text-center py-16 text-galet border-2 border-dashed border-line-warm rounded-3xl">
        Aucun marchand. Créez-en un avec « Nouveau marchand ».
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Barre de recherche + filtres + tri */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-galet absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => onCriteriaChange(setQuery)(e.target.value)}
            placeholder="Rechercher un marchand (nom, email)…"
            className="w-full bg-surface border border-line-warm rounded-xl pl-9 pr-3 py-2 text-sm text-onyx focus:border-halo outline-none transition-colors placeholder:text-galet"
          />
        </div>

        <select
          value={businessType}
          onChange={(e) => onCriteriaChange(setBusinessType)(e.target.value)}
          className={selectCls}
          aria-label="Type de commerce"
        >
          <option value="all">Tous les types</option>
          {BUSINESS_TYPES.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>

        <select
          value={concierge}
          onChange={(e) => onCriteriaChange(setConcierge)(e.target.value as TriState)}
          className={selectCls}
          aria-label="Mode concierge"
        >
          <option value="all">Concierge : tous</option>
          <option value="yes">Géré par nous</option>
          <option value="no">Géré par lui</option>
        </select>

        <select
          value={hasCard}
          onChange={(e) => onCriteriaChange(setHasCard)(e.target.value as TriState)}
          className={selectCls}
          aria-label="Carte configurée"
        >
          <option value="all">Carte : toutes</option>
          <option value="yes">Carte configurée</option>
          <option value="no">Sans carte</option>
        </select>

        <select
          value={sort}
          onChange={(e) => onCriteriaChange(setSort)(e.target.value as MerchantSort)}
          className={selectCls}
          aria-label="Tri"
        >
          <option value="recent">Plus récents</option>
          <option value="name">Nom (A→Z)</option>
        </select>
      </div>

      <p className="text-xs text-galet-ink">
        {filtered.length} marchand{filtered.length > 1 ? "s" : ""}
        {filtered.length !== items.length ? ` sur ${items.length}` : ""}
      </p>

      {/* Aucun résultat pour le filtre courant */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-galet border-2 border-dashed border-line-warm rounded-3xl">
          Aucun marchand ne correspond à ces critères.
        </div>
      ) : (
        <>
          <div className="grid gap-6 md:grid-cols-2">
            {pageItems.map((m) => (
              <div key={m.id} className="bg-surface border border-line-warm rounded-3xl p-6 shadow-sm">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white"
                      style={{ backgroundColor: m.primary_color || "#0D6B5E" }}
                    >
                      {(m.shop_name || "?")[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-onyx">{m.shop_name}</div>
                      <div className="text-xs text-galet-ink">{m.email || "—"}</div>
                    </div>
                  </div>
                  <Link
                    href={`/admin/merchants/${m.id}`}
                    className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-xl bg-surface border border-line-warm hover:bg-calcaire text-galet-ink transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Éditer
                  </Link>
                </div>

                {!m.has_card && (
                  <span className="inline-block mb-4 text-[11px] font-semibold rounded-full px-2.5 py-1 bg-amber-500/10 text-amber-700 border border-amber-500/30">
                    Carte à configurer
                  </span>
                )}

                <div className="flex gap-6 text-sm mb-6">
                  <div>
                    <span className="text-2xl font-bold text-onyx">{m.customer_count}</span>
                    <span className="text-galet-ink ml-1.5">clients</span>
                  </div>
                  <div>
                    <span className="text-2xl font-bold text-onyx">{m.scan_count}</span>
                    <span className="text-galet-ink ml-1.5">scans</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-6">
                  <ManagementModeToggle merchantId={m.id} initial={m.managed_by_concierge} />
                  <ManageAsButton merchantId={m.id} />
                </div>

                <div className="border-t border-line-warm pt-6">
                  <EnrollmentQR
                    url={`${origin}/enroll/${m.enrollment_token}`}
                    fileName={`qr-${m.shop_name?.toLowerCase().replace(/\s+/g, "-") || "marchand"}`}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 pt-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="flex items-center gap-1 text-sm px-3 py-2 rounded-xl border border-line-warm text-galet-ink hover:bg-calcaire disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" /> Précédent
              </button>
              <span className="text-sm text-galet-ink">Page {safePage} / {totalPages}</span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="flex items-center gap-1 text-sm px-3 py-2 rounded-xl border border-line-warm text-galet-ink hover:bg-calcaire disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Suivant <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/merchants/MerchantsGrid.tsx
git commit -m "feat(admin): composant client MerchantsGrid (recherche/filtres/tri/pagination)"
```

---

## Task 3 : Brancher la page serveur

**Files:**
- Modify: `src/app/admin/merchants/page.tsx`

- [ ] **Step 1: Remplacer le contenu de la page**

Contenu complet de `src/app/admin/merchants/page.tsx` :

```tsx
import { createClient } from "@/utils/supabase/server";
import { headers } from "next/headers";
import Link from "next/link";
import { Plus } from "lucide-react";
import MerchantsGrid from "./MerchantsGrid";
import type { MerchantListItem } from "@/lib/admin/merchantsFilter";

export const dynamic = "force-dynamic";

export default async function AdminMerchants() {
  const supabase = await createClient();

  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const origin = `${proto}://${host}`;

  const { data: merchants } = await supabase
    .from("merchants")
    .select("id, shop_name, email, enrollment_token, primary_color, created_at, managed_by_concierge, business_type")
    .eq("role", "merchant")
    .order("created_at", { ascending: false });

  // Données dérivées (échelle modeste — comptage en mémoire, comme la liste actuelle).
  const { data: customers } = await supabase.from("customers").select("merchant_id");
  const { data: scans } = await supabase.from("scan_history").select("merchant_id");
  const { data: designs } = await supabase.from("card_designs").select("merchant_id");

  const countBy = (rows: { merchant_id: string | null }[] | null, id: string) =>
    (rows || []).filter((r) => r.merchant_id === id).length;
  const withCard = new Set((designs || []).map((d) => d.merchant_id));

  const items: MerchantListItem[] = (merchants || []).map((m) => ({
    id: m.id,
    shop_name: m.shop_name,
    email: m.email,
    primary_color: m.primary_color,
    enrollment_token: m.enrollment_token,
    business_type: m.business_type ?? null,
    managed_by_concierge: m.managed_by_concierge ?? false,
    created_at: m.created_at,
    has_card: withCard.has(m.id),
    customer_count: countBy(customers, m.id),
    scan_count: countBy(scans, m.id),
  }));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl text-onyx tracking-tight mb-2">Marchands</h1>
          <p className="text-galet-ink">Gérez les boutiques et leurs liens d&apos;enrôlement.</p>
        </div>
        <Link
          href="/admin/merchants/new"
          className="flex items-center gap-2 bg-halo text-white font-bold px-5 py-3 rounded-2xl hover:bg-halo-600 transition-all"
        >
          <Plus className="w-4 h-4" />
          Nouveau marchand
        </Link>
      </div>

      <MerchantsGrid items={items} origin={origin} />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint "src/app/admin/merchants/MerchantsGrid.tsx" "src/app/admin/merchants/page.tsx" src/lib/admin/merchantsFilter.ts`
Expected: tsc exit 0 ; eslint sans erreur.

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: « Compiled successfully » ; la route `/admin/merchants` est présente.

- [ ] **Step 4: Vérification rendu (authentifiée)**

Démarrer le serveur dev si besoin (`npm run dev`), puis :

```bash
JAR=/tmp/halo_a2.txt; rm -f "$JAR"
curl -s -c "$JAR" -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin-demo@walletcard.app","password":"HaloDemo2026!"}' -o /dev/null
curl -s -b "$JAR" -o /tmp/a2.html -w "HTTP %{http_code}\n" "http://localhost:3000/admin/merchants"
for s in "Rechercher un marchand" "Tous les types" "Plus récents" "Géré par nous"; do
  grep -qF "$s" /tmp/a2.html && echo "  ✓ $s" || echo "  ✗ MANQUANT: $s";
done
```

Expected: HTTP 200 et les 4 marqueurs présents (la barre de filtres est rendue côté serveur). Vérifier ensuite manuellement l'interactivité dans le navigateur (taper une recherche, changer un filtre, paginer).

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/merchants/page.tsx
git commit -m "feat(admin): liste marchands branchée sur MerchantsGrid (recherche/filtre/tri/pagination)"
```

---

## Self-Review (effectuée)

- **Couverture spec** : recherche nom/email ✅ (Task 1+2), filtres concierge/type/carte ✅, tri récent/nom ✅, pagination ✅, 2 états vides (aucun marchand vs aucun résultat) ✅, comptage borné à l'existant ✅. Filtres d'état du cycle de vie **volontairement exclus** (hors périmètre A2).
- **Placeholders** : aucun — tout le code est fourni (fonction pure, tests, composant, page).
- **Cohérence des types** : `MerchantListItem`/`MerchantFilters`/`MerchantSort`/`TriState`/`paginate`/`MERCHANTS_PAGE_SIZE` définis en Task 1 et consommés tels quels en Task 2/3. `BUSINESS_TYPES` importé depuis `@/lib/merchant-config/types`. Champs DB (`business_type`, `managed_by_concierge`, `created_at`) ajoutés au `select` en Task 3 et mappés vers `MerchantListItem`.
- **Hypothèse vérifiée à l'exécution** : la colonne `card_designs.merchant_id` existe (cf. `src/lib/cardDesign/repository.ts`). Si la table `card_designs` est absente en base de l'environnement de test, `designs` sera `null` → `has_card` partout `false` (dégradation propre, pas d'erreur).
