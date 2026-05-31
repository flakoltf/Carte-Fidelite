# Dashboard Analytique & Rapports — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner au marchand un dashboard analytique personnalisable (8 widgets) avec rafraîchissement auto et exports PDF + CSV.

**Architecture:** Calcul à la demande. Pour chaque métrique : une fonction **pure** `compute*` (testée Vitest, sans DB) + une fonction `fetch*` (requête Supabase scoping marchand). Exposées par une route `/api/analytics`. Widgets client en polling (SWR, ~45 s) avec graphes Recharts. Config par marchand en JSONB (`merchants.dashboard_config`), preset selon `merchants.business_type`.

**Tech Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Supabase (@supabase/ssr) · Vitest · SWR · Recharts · @react-pdf/renderer · Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-05-31-dashboard-analytique-design.md`

---

## File Structure

```
src/lib/analytics/
  types.ts            # types partagés + WIDGETS registry (clé→label)
  range.ts            # resolveRange('7j'|'30j'|'12m') -> {from,to,bucket}
  presets.ts          # business_type -> ordre/visibilité par défaut
  config.ts           # resolveDashboardConfig(stored, businessType)
  kpis.ts             # computeKpis + fetchKpis
  visits.ts           # computeVisitsSeries + fetchVisits
  acquisition.ts      # computeAcquisition + fetchAcquisition
  retention.ts        # computeRetention + fetchRetention
  topCustomers.ts     # computeTopCustomers + fetchTopCustomers
  peakHours.ts        # computePeakHours + fetchPeakHours
  walletMix.ts        # computeWalletMix + fetchWalletMix
  rewards.ts          # computeRewards + fetchRewards
  index.ts            # dispatch widget->fetch
src/lib/analytics/__tests__/*.test.ts   # tests Vitest (pure)

src/app/api/analytics/route.ts                 # GET ?widget=&range=
src/app/api/analytics/export/csv/route.ts      # GET ?type=&range=
src/app/api/analytics/export/pdf/route.ts      # GET ?range=
src/app/api/dashboard-config/route.ts          # POST save config

src/app/dashboard/_analytics/
  useAnalytics.ts     # hook SWR polling
  AnalyticsGrid.tsx   # client : période + grille de widgets
  CustomizePanel.tsx  # client : toggle/réordonne
  widgets/KpisWidget.tsx, VisitsWidget.tsx, ... (8)
  charts/ (petits wrappers Recharts)

src/app/dashboard/page.tsx   # modifié : rend <AnalyticsGrid/>
supabase/migrations/20260531_analytics_dashboard.sql
vitest.config.ts
```

---

### Task 1: Mise en place de Vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/lib/analytics/__tests__/smoke.test.ts`

- [ ] **Step 1: Installer Vitest**

Run: `cd ~/Projects/Carte-Fidelite && npm i -D vitest`
Expected: ajout de `vitest` aux devDependencies.

- [ ] **Step 2: Config Vitest**

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { environment: "node", include: ["src/**/*.test.ts"] },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
```

- [ ] **Step 3: Script de test**

In `package.json` `"scripts"`, add: `"test": "vitest run"`, `"test:watch": "vitest"`.

- [ ] **Step 4: Smoke test (échoue d'abord)**

Create `src/lib/analytics/__tests__/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";
describe("vitest", () => { it("runs", () => { expect(1 + 1).toBe(2); }); });
```

- [ ] **Step 5: Lancer les tests**

Run: `npm test`
Expected: PASS (1 test).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/lib/analytics/__tests__/smoke.test.ts
git commit -m "chore(test): set up vitest"
```

---

### Task 2: Migration BDD (business_type, dashboard_config, index)

**Files:**
- Create: `supabase/migrations/20260531_analytics_dashboard.sql`

- [ ] **Step 1: Écrire la migration**

Create `supabase/migrations/20260531_analytics_dashboard.sql`:
```sql
-- Type de commerce (preset dashboard) + config perso (widgets visibles/ordre)
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS business_type TEXT NOT NULL DEFAULT 'autre';
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS dashboard_config JSONB;

-- Index pour les agrégations analytiques
CREATE INDEX IF NOT EXISTS idx_scan_history_merchant_time ON scan_history (merchant_id, scanned_at);
CREATE INDEX IF NOT EXISTS idx_customers_merchant_created ON customers (merchant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_loyalty_cards_merchant ON loyalty_cards (merchant_id);
```

- [ ] **Step 2: Appliquer la migration**

Appliquer sur le projet Supabase **WalletCard** (`oqcelbbozpykwkasjtqy`), via le MCP Supabase `apply_migration` (name: `analytics_dashboard`) ou la CLI/SQL editor. Vérifier ensuite que les colonnes existent : `select business_type, dashboard_config from merchants limit 1;`.
Expected: requête OK, colonnes présentes.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260531_analytics_dashboard.sql
git commit -m "feat(db): add business_type, dashboard_config + analytics indexes"
```

---

### Task 3: Types & registre des widgets

**Files:**
- Create: `src/lib/analytics/types.ts`
- Test: `src/lib/analytics/__tests__/types.test.ts`

- [ ] **Step 1: Test (échoue d'abord)**

Create `src/lib/analytics/__tests__/types.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { WIDGET_KEYS, WIDGETS } from "@/lib/analytics/types";

describe("widget registry", () => {
  it("a 8 widgets avec une clé et un label", () => {
    expect(WIDGET_KEYS).toHaveLength(8);
    for (const k of WIDGET_KEYS) expect(WIDGETS[k].label.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Vérifier l'échec**

Run: `npm test -- types`
Expected: FAIL (module introuvable).

- [ ] **Step 3: Implémenter**

Create `src/lib/analytics/types.ts`:
```ts
export const WIDGET_KEYS = [
  "kpis", "visits", "acquisition", "retention",
  "top_customers", "peak_hours", "wallet_mix", "rewards",
] as const;
export type WidgetKey = (typeof WIDGET_KEYS)[number];

export const WIDGETS: Record<WidgetKey, { label: string }> = {
  kpis: { label: "KPIs clés" },
  visits: { label: "Visites dans le temps" },
  acquisition: { label: "Acquisition de clients" },
  retention: { label: "Actifs vs inactifs" },
  top_customers: { label: "Top clients" },
  peak_hours: { label: "Affluence (jours × heures)" },
  wallet_mix: { label: "Adoption Wallet" },
  rewards: { label: "Récompenses / cartes complétées" },
};

export type RangeKey = "7j" | "30j" | "12m";
export const INACTIVE_DAYS = 30;
export const REWARD_THRESHOLD = 10;

export type WidgetConfigItem = { key: WidgetKey; visible: boolean; order: number };
export type DashboardConfig = { widgets: WidgetConfigItem[] };
```

- [ ] **Step 4: Vérifier le succès**

Run: `npm test -- types`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/analytics/types.ts src/lib/analytics/__tests__/types.test.ts
git commit -m "feat(analytics): widget registry and shared types"
```

---

### Task 4: Helper de période (resolveRange)

**Files:**
- Create: `src/lib/analytics/range.ts`
- Test: `src/lib/analytics/__tests__/range.test.ts`

- [ ] **Step 1: Test (échoue d'abord)**

Create `src/lib/analytics/__tests__/range.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { resolveRange } from "@/lib/analytics/range";

describe("resolveRange", () => {
  const now = new Date("2026-05-31T12:00:00Z");
  it("30j -> 30 jours, bucket day", () => {
    const r = resolveRange("30j", now);
    expect(r.bucket).toBe("day");
    expect(Math.round((r.to.getTime() - r.from.getTime()) / 86400000)).toBe(30);
  });
  it("7j -> 7 jours", () => {
    expect(Math.round((resolveRange("7j", now).to.getTime() - resolveRange("7j", now).from.getTime()) / 86400000)).toBe(7);
  });
  it("12m -> bucket month", () => {
    expect(resolveRange("12m", now).bucket).toBe("month");
  });
});
```

- [ ] **Step 2: Vérifier l'échec** — Run: `npm test -- range` → FAIL.

- [ ] **Step 3: Implémenter**

Create `src/lib/analytics/range.ts`:
```ts
import type { RangeKey } from "./types";

export type ResolvedRange = { from: Date; to: Date; bucket: "day" | "month" };

export function resolveRange(range: RangeKey, now: Date = new Date()): ResolvedRange {
  const to = new Date(now);
  const from = new Date(now);
  if (range === "7j") { from.setDate(from.getDate() - 7); return { from, to, bucket: "day" }; }
  if (range === "30j") { from.setDate(from.getDate() - 30); return { from, to, bucket: "day" }; }
  from.setMonth(from.getMonth() - 12); return { from, to, bucket: "month" };
}
```

- [ ] **Step 4: Vérifier le succès** — Run: `npm test -- range` → PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/analytics/range.ts src/lib/analytics/__tests__/range.test.ts
git commit -m "feat(analytics): range resolver"
```

---

### Task 5: Presets par métier + résolveur de config

**Files:**
- Create: `src/lib/analytics/presets.ts`, `src/lib/analytics/config.ts`
- Test: `src/lib/analytics/__tests__/config.test.ts`

- [ ] **Step 1: Test (échoue d'abord)**

Create `src/lib/analytics/__tests__/config.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { resolveDashboardConfig } from "@/lib/analytics/config";
import { WIDGET_KEYS } from "@/lib/analytics/types";

describe("resolveDashboardConfig", () => {
  it("config nulle -> les 8 widgets visibles selon preset", () => {
    const c = resolveDashboardConfig(null, "cafe");
    expect(c.widgets).toHaveLength(8);
    expect(c.widgets.every((w) => w.visible)).toBe(true);
  });
  it("réintroduit un widget manquant du config stocké", () => {
    const stored = { widgets: [{ key: "kpis", visible: false, order: 0 }] };
    const c = resolveDashboardConfig(stored as any, "autre");
    expect(c.widgets).toHaveLength(WIDGET_KEYS.length);
    expect(c.widgets.find((w) => w.key === "kpis")!.visible).toBe(false);
  });
});
```

- [ ] **Step 2: Vérifier l'échec** — Run: `npm test -- config` → FAIL.

- [ ] **Step 3: Implémenter les presets**

Create `src/lib/analytics/presets.ts`:
```ts
import type { WidgetKey } from "./types";

// Ordre par défaut des widgets selon le métier. Tous visibles au départ.
const DEFAULT_ORDER: WidgetKey[] = [
  "kpis", "visits", "retention", "acquisition",
  "top_customers", "peak_hours", "wallet_mix", "rewards",
];

export const PRESETS: Record<string, WidgetKey[]> = {
  cafe: ["kpis", "peak_hours", "visits", "retention", "acquisition", "top_customers", "wallet_mix", "rewards"],
  restaurant: ["kpis", "peak_hours", "visits", "retention", "acquisition", "top_customers", "wallet_mix", "rewards"],
  boulangerie: ["kpis", "peak_hours", "visits", "retention", "acquisition", "top_customers", "wallet_mix", "rewards"],
  boutique: ["kpis", "top_customers", "acquisition", "retention", "visits", "rewards", "wallet_mix", "peak_hours"],
  salon: ["kpis", "top_customers", "retention", "acquisition", "visits", "rewards", "wallet_mix", "peak_hours"],
  sport: ["kpis", "retention", "visits", "acquisition", "top_customers", "peak_hours", "wallet_mix", "rewards"],
  autre: DEFAULT_ORDER,
};

export function presetOrder(businessType: string): WidgetKey[] {
  return PRESETS[businessType] ?? DEFAULT_ORDER;
}
```

- [ ] **Step 4: Implémenter le résolveur**

Create `src/lib/analytics/config.ts`:
```ts
import { WIDGET_KEYS, type DashboardConfig, type WidgetKey } from "./types";
import { presetOrder } from "./presets";

export function resolveDashboardConfig(stored: DashboardConfig | null, businessType: string): DashboardConfig {
  const order = presetOrder(businessType);
  const storedByKey = new Map((stored?.widgets ?? []).map((w) => [w.key, w]));
  const widgets = WIDGET_KEYS.map((key) => {
    const s = storedByKey.get(key);
    return {
      key: key as WidgetKey,
      visible: s ? s.visible : true,
      order: s ? s.order : order.indexOf(key),
    };
  }).sort((a, b) => a.order - b.order);
  return { widgets };
}
```

- [ ] **Step 5: Vérifier le succès** — Run: `npm test -- config` → PASS.

- [ ] **Step 6: Commit**
```bash
git add src/lib/analytics/presets.ts src/lib/analytics/config.ts src/lib/analytics/__tests__/config.test.ts
git commit -m "feat(analytics): business-type presets and config resolver"
```

---

### Task 6: Widget KPIs (compute + fetch)

**Files:**
- Create: `src/lib/analytics/kpis.ts`
- Test: `src/lib/analytics/__tests__/kpis.test.ts`

- [ ] **Step 1: Test compute (échoue d'abord)**

Create `src/lib/analytics/__tests__/kpis.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { computeKpis } from "@/lib/analytics/kpis";

describe("computeKpis", () => {
  it("compte clients, nouveaux, visites, actifs, récompenses", () => {
    const now = new Date("2026-05-31T12:00:00Z");
    const res = computeKpis({
      totalCustomers: 100,
      newCustomers: 8,
      visits: 240,
      activeCustomers: 61,
      completedCards: 12,
    });
    expect(res.totalCustomers).toBe(100);
    expect(res.newCustomers).toBe(8);
    expect(res.visits).toBe(240);
    expect(res.activeRate).toBe(61);
    expect(res.completedCards).toBe(12);
    void now;
  });
});
```

- [ ] **Step 2: Vérifier l'échec** — Run: `npm test -- kpis` → FAIL.

- [ ] **Step 3: Implémenter**

Create `src/lib/analytics/kpis.ts`:
```ts
import { createClient } from "@/utils/supabase/server";
import { resolveRange } from "./range";
import { INACTIVE_DAYS, REWARD_THRESHOLD, type RangeKey } from "./types";

export type KpisInput = {
  totalCustomers: number; newCustomers: number; visits: number;
  activeCustomers: number; completedCards: number;
};
export type KpisData = KpisInput & { activeRate: number };

export function computeKpis(i: KpisInput): KpisData {
  const activeRate = i.totalCustomers > 0 ? Math.round((i.activeCustomers / i.totalCustomers) * 100) : 0;
  return { ...i, activeRate };
}

export async function fetchKpis(merchantId: string, range: RangeKey): Promise<KpisData> {
  const supabase = await createClient();
  const { from } = resolveRange(range);
  const activeSince = new Date(Date.now() - INACTIVE_DAYS * 86400000).toISOString();

  const [total, fresh, visits, active, completed] = await Promise.all([
    supabase.from("customers").select("*", { count: "exact", head: true }).eq("merchant_id", merchantId),
    supabase.from("customers").select("*", { count: "exact", head: true }).eq("merchant_id", merchantId).gte("created_at", from.toISOString()),
    supabase.from("scan_history").select("*", { count: "exact", head: true }).eq("merchant_id", merchantId).gte("scanned_at", from.toISOString()),
    supabase.from("loyalty_cards").select("*", { count: "exact", head: true }).eq("merchant_id", merchantId).gte("last_scan", activeSince),
    supabase.from("loyalty_cards").select("*", { count: "exact", head: true }).eq("merchant_id", merchantId).gte("stamps_count", REWARD_THRESHOLD),
  ]);

  return computeKpis({
    totalCustomers: total.count ?? 0,
    newCustomers: fresh.count ?? 0,
    visits: visits.count ?? 0,
    activeCustomers: active.count ?? 0,
    completedCards: completed.count ?? 0,
  });
}
```

- [ ] **Step 4: Vérifier le succès** — Run: `npm test -- kpis` → PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/analytics/kpis.ts src/lib/analytics/__tests__/kpis.test.ts
git commit -m "feat(analytics): KPIs widget"
```

---

### Task 7: Widget Visites (série temporelle)

**Files:**
- Create: `src/lib/analytics/visits.ts`
- Test: `src/lib/analytics/__tests__/visits.test.ts`

- [ ] **Step 1: Test compute (échoue d'abord)**

Create `src/lib/analytics/__tests__/visits.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { computeVisitsSeries } from "@/lib/analytics/visits";

describe("computeVisitsSeries", () => {
  it("regroupe les scans par jour, jours vides à 0", () => {
    const from = new Date("2026-05-29T00:00:00Z");
    const to = new Date("2026-05-31T00:00:00Z");
    const rows = [
      { scanned_at: "2026-05-29T10:00:00Z" },
      { scanned_at: "2026-05-29T18:00:00Z" },
      { scanned_at: "2026-05-31T09:00:00Z" },
    ];
    const series = computeVisitsSeries(rows, from, to, "day");
    expect(series).toEqual([
      { label: "2026-05-29", value: 2 },
      { label: "2026-05-30", value: 0 },
      { label: "2026-05-31", value: 1 },
    ]);
  });
});
```

- [ ] **Step 2: Vérifier l'échec** — Run: `npm test -- visits` → FAIL.

- [ ] **Step 3: Implémenter**

Create `src/lib/analytics/visits.ts`:
```ts
import { createClient } from "@/utils/supabase/server";
import { resolveRange } from "./range";
import type { RangeKey } from "./types";

export type Point = { label: string; value: number };

function keyOf(d: Date, bucket: "day" | "month"): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  if (bucket === "month") return `${y}-${m}`;
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function computeVisitsSeries(rows: { scanned_at: string }[], from: Date, to: Date, bucket: "day" | "month"): Point[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const k = keyOf(new Date(r.scanned_at), bucket);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const out: Point[] = [];
  const cur = new Date(from);
  while (cur <= to) {
    const k = keyOf(cur, bucket);
    out.push({ label: k, value: counts.get(k) ?? 0 });
    if (bucket === "month") cur.setUTCMonth(cur.getUTCMonth() + 1);
    else cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

export async function fetchVisits(merchantId: string, range: RangeKey): Promise<Point[]> {
  const supabase = await createClient();
  const { from, to, bucket } = resolveRange(range);
  const { data } = await supabase
    .from("scan_history").select("scanned_at")
    .eq("merchant_id", merchantId)
    .gte("scanned_at", from.toISOString());
  return computeVisitsSeries(data ?? [], from, to, bucket);
}
```

- [ ] **Step 4: Vérifier le succès** — Run: `npm test -- visits` → PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/analytics/visits.ts src/lib/analytics/__tests__/visits.test.ts
git commit -m "feat(analytics): visits time series widget"
```

---

### Task 8: Widget Acquisition

**Files:** Create `src/lib/analytics/acquisition.ts`; Test `src/lib/analytics/__tests__/acquisition.test.ts`

- [ ] **Step 1: Test (échoue)**
```ts
import { describe, it, expect } from "vitest";
import { computeAcquisitionSeries } from "@/lib/analytics/acquisition";
describe("computeAcquisitionSeries", () => {
  it("regroupe les nouveaux clients par jour", () => {
    const from = new Date("2026-05-30T00:00:00Z");
    const to = new Date("2026-05-31T00:00:00Z");
    const rows = [{ created_at: "2026-05-31T08:00:00Z" }, { created_at: "2026-05-31T09:00:00Z" }];
    expect(computeAcquisitionSeries(rows, from, to, "day")).toEqual([
      { label: "2026-05-30", value: 0 }, { label: "2026-05-31", value: 2 },
    ]);
  });
});
```
- [ ] **Step 2: Échec** — Run: `npm test -- acquisition` → FAIL.
- [ ] **Step 3: Implémenter**
```ts
import { createClient } from "@/utils/supabase/server";
import { resolveRange } from "./range";
import { computeVisitsSeries, type Point } from "./visits";
import type { RangeKey } from "./types";

export function computeAcquisitionSeries(rows: { created_at: string }[], from: Date, to: Date, bucket: "day" | "month"): Point[] {
  // réutilise le bucketing des visites en mappant created_at -> scanned_at
  return computeVisitsSeries(rows.map((r) => ({ scanned_at: r.created_at })), from, to, bucket);
}

export async function fetchAcquisition(merchantId: string, range: RangeKey): Promise<Point[]> {
  const supabase = await createClient();
  const { from, to, bucket } = resolveRange(range);
  const { data } = await supabase.from("customers").select("created_at")
    .eq("merchant_id", merchantId).gte("created_at", from.toISOString());
  return computeAcquisitionSeries(data ?? [], from, to, bucket);
}
```
- [ ] **Step 4: Succès** — Run: `npm test -- acquisition` → PASS.
- [ ] **Step 5: Commit**
```bash
git add src/lib/analytics/acquisition.ts src/lib/analytics/__tests__/acquisition.test.ts
git commit -m "feat(analytics): acquisition widget"
```

---

### Task 9: Widget Rétention (actifs/inactifs)

**Files:** Create `src/lib/analytics/retention.ts`; Test `src/lib/analytics/__tests__/retention.test.ts`

- [ ] **Step 1: Test (échoue)**
```ts
import { describe, it, expect } from "vitest";
import { computeRetention } from "@/lib/analytics/retention";
describe("computeRetention", () => {
  it("classe actifs/inactifs selon le seuil", () => {
    const now = new Date("2026-05-31T00:00:00Z");
    const cards = [
      { last_scan: "2026-05-20T00:00:00Z" }, // actif
      { last_scan: "2026-03-01T00:00:00Z" }, // inactif
      { last_scan: null },                    // inactif
    ];
    const r = computeRetention(cards, 30, now);
    expect(r.active).toBe(1);
    expect(r.inactive).toBe(2);
    expect(r.activeRate).toBe(33);
  });
});
```
- [ ] **Step 2: Échec** — Run: `npm test -- retention` → FAIL.
- [ ] **Step 3: Implémenter**
```ts
import { createClient } from "@/utils/supabase/server";
import { INACTIVE_DAYS, type RangeKey } from "./types";

export type Retention = { active: number; inactive: number; activeRate: number };

export function computeRetention(cards: { last_scan: string | null }[], inactiveDays: number, now: Date = new Date()): Retention {
  const threshold = now.getTime() - inactiveDays * 86400000;
  let active = 0;
  for (const c of cards) if (c.last_scan && new Date(c.last_scan).getTime() >= threshold) active++;
  const total = cards.length;
  const inactive = total - active;
  const activeRate = total > 0 ? Math.round((active / total) * 100) : 0;
  return { active, inactive, activeRate };
}

export async function fetchRetention(merchantId: string, _range: RangeKey): Promise<Retention> {
  const supabase = await createClient();
  const { data } = await supabase.from("loyalty_cards").select("last_scan").eq("merchant_id", merchantId);
  return computeRetention(data ?? [], INACTIVE_DAYS);
}
```
- [ ] **Step 4: Succès** — Run: `npm test -- retention` → PASS.
- [ ] **Step 5: Commit**
```bash
git add src/lib/analytics/retention.ts src/lib/analytics/__tests__/retention.test.ts
git commit -m "feat(analytics): retention (active/inactive) widget"
```

---

### Task 10: Widget Top clients

**Files:** Create `src/lib/analytics/topCustomers.ts`; Test `src/lib/analytics/__tests__/topCustomers.test.ts`

- [ ] **Step 1: Test (échoue)**
```ts
import { describe, it, expect } from "vitest";
import { computeTopCustomers } from "@/lib/analytics/topCustomers";
describe("computeTopCustomers", () => {
  it("classe par nombre de visites desc, top N", () => {
    const rows = [
      { customer_id: "a", full_name: "Alice" }, { customer_id: "a", full_name: "Alice" },
      { customer_id: "b", full_name: "Bob" },
    ];
    const top = computeTopCustomers(rows, 5);
    expect(top[0]).toEqual({ customerId: "a", name: "Alice", visits: 2 });
    expect(top[1]).toEqual({ customerId: "b", name: "Bob", visits: 1 });
  });
});
```
- [ ] **Step 2: Échec** — Run: `npm test -- topCustomers` → FAIL.
- [ ] **Step 3: Implémenter**
```ts
import { createClient } from "@/utils/supabase/server";
import type { RangeKey } from "./types";
import { resolveRange } from "./range";

export type TopCustomer = { customerId: string; name: string; visits: number };
type Row = { customer_id: string; full_name: string };

export function computeTopCustomers(rows: Row[], limit: number): TopCustomer[] {
  const map = new Map<string, TopCustomer>();
  for (const r of rows) {
    const cur = map.get(r.customer_id);
    if (cur) cur.visits++;
    else map.set(r.customer_id, { customerId: r.customer_id, name: r.full_name, visits: 1 });
  }
  return [...map.values()].sort((a, b) => b.visits - a.visits).slice(0, limit);
}

export async function fetchTopCustomers(merchantId: string, range: RangeKey): Promise<TopCustomer[]> {
  const supabase = await createClient();
  const { from } = resolveRange(range);
  const { data } = await supabase
    .from("scan_history")
    .select("loyalty_cards(customer_id, customers(full_name))")
    .eq("merchant_id", merchantId).gte("scanned_at", from.toISOString());
  const rows: Row[] = (data ?? []).map((d: any) => ({
    customer_id: d.loyalty_cards?.customer_id ?? "?",
    full_name: d.loyalty_cards?.customers?.full_name ?? "Client",
  })).filter((r: Row) => r.customer_id !== "?");
  return computeTopCustomers(rows, 5);
}
```
- [ ] **Step 4: Succès** — Run: `npm test -- topCustomers` → PASS.
- [ ] **Step 5: Commit**
```bash
git add src/lib/analytics/topCustomers.ts src/lib/analytics/__tests__/topCustomers.test.ts
git commit -m "feat(analytics): top customers widget"
```

---

### Task 11: Widget Affluence (heatmap jours × heures)

**Files:** Create `src/lib/analytics/peakHours.ts`; Test `src/lib/analytics/__tests__/peakHours.test.ts`

- [ ] **Step 1: Test (échoue)**
```ts
import { describe, it, expect } from "vitest";
import { computePeakHours } from "@/lib/analytics/peakHours";
describe("computePeakHours", () => {
  it("grille 7x24, incrémente la bonne case (UTC)", () => {
    const grid = computePeakHours([{ scanned_at: "2026-05-31T09:00:00Z" }]); // dimanche 09h UTC
    expect(grid[0][9]).toBe(1);
    expect(grid.length).toBe(7);
    expect(grid[0].length).toBe(24);
  });
});
```
- [ ] **Step 2: Échec** — Run: `npm test -- peakHours` → FAIL.
- [ ] **Step 3: Implémenter**
```ts
import { createClient } from "@/utils/supabase/server";
import { resolveRange } from "./range";
import type { RangeKey } from "./types";

export type Heatmap = number[][]; // [jour 0-6][heure 0-23]

export function computePeakHours(rows: { scanned_at: string }[]): Heatmap {
  const grid: Heatmap = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const r of rows) {
    const d = new Date(r.scanned_at);
    grid[d.getUTCDay()][d.getUTCHours()]++;
  }
  return grid;
}

export async function fetchPeakHours(merchantId: string, range: RangeKey): Promise<Heatmap> {
  const supabase = await createClient();
  const { from } = resolveRange(range);
  const { data } = await supabase.from("scan_history").select("scanned_at")
    .eq("merchant_id", merchantId).gte("scanned_at", from.toISOString());
  return computePeakHours(data ?? []);
}
```
- [ ] **Step 4: Succès** — Run: `npm test -- peakHours` → PASS.
- [ ] **Step 5: Commit**
```bash
git add src/lib/analytics/peakHours.ts src/lib/analytics/__tests__/peakHours.test.ts
git commit -m "feat(analytics): peak hours heatmap widget"
```

---

### Task 12: Widget Adoption Wallet

**Files:** Create `src/lib/analytics/walletMix.ts`; Test `src/lib/analytics/__tests__/walletMix.test.ts`

- [ ] **Step 1: Test (échoue)**
```ts
import { describe, it, expect } from "vitest";
import { computeWalletMix } from "@/lib/analytics/walletMix";
describe("computeWalletMix", () => {
  it("compte apple/google et %", () => {
    const r = computeWalletMix([{ pass_type: "apple" }, { pass_type: "apple" }, { pass_type: "google" }]);
    expect(r.apple).toBe(2); expect(r.google).toBe(1);
    expect(r.applePct).toBe(67); expect(r.googlePct).toBe(33);
  });
});
```
- [ ] **Step 2: Échec** — Run: `npm test -- walletMix` → FAIL.
- [ ] **Step 3: Implémenter**
```ts
import { createClient } from "@/utils/supabase/server";
import type { RangeKey } from "./types";

export type WalletMix = { apple: number; google: number; applePct: number; googlePct: number };

export function computeWalletMix(rows: { pass_type: string | null }[]): WalletMix {
  let apple = 0, google = 0;
  for (const r of rows) { if (r.pass_type === "apple") apple++; else if (r.pass_type === "google") google++; }
  const total = apple + google;
  return {
    apple, google,
    applePct: total ? Math.round((apple / total) * 100) : 0,
    googlePct: total ? Math.round((google / total) * 100) : 0,
  };
}

export async function fetchWalletMix(merchantId: string, _range: RangeKey): Promise<WalletMix> {
  const supabase = await createClient();
  const { data } = await supabase.from("loyalty_cards").select("pass_type").eq("merchant_id", merchantId);
  return computeWalletMix(data ?? []);
}
```
- [ ] **Step 4: Succès** — Run: `npm test -- walletMix` → PASS.
- [ ] **Step 5: Commit**
```bash
git add src/lib/analytics/walletMix.ts src/lib/analytics/__tests__/walletMix.test.ts
git commit -m "feat(analytics): wallet adoption widget"
```

---

### Task 13: Widget Récompenses + dispatch index

**Files:** Create `src/lib/analytics/rewards.ts`, `src/lib/analytics/index.ts`; Test `src/lib/analytics/__tests__/rewards.test.ts`

- [ ] **Step 1: Test (échoue)**
```ts
import { describe, it, expect } from "vitest";
import { computeRewards } from "@/lib/analytics/rewards";
describe("computeRewards", () => {
  it("compte cartes >= seuil et taux de complétion", () => {
    const r = computeRewards([{ stamps_count: 10 }, { stamps_count: 11 }, { stamps_count: 3 }], 10);
    expect(r.completedCards).toBe(2);
    expect(r.totalCards).toBe(3);
    expect(r.completionRate).toBe(67);
  });
});
```
- [ ] **Step 2: Échec** — Run: `npm test -- rewards` → FAIL.
- [ ] **Step 3: Implémenter rewards**
```ts
import { createClient } from "@/utils/supabase/server";
import { REWARD_THRESHOLD, type RangeKey } from "./types";

export type Rewards = { completedCards: number; totalCards: number; completionRate: number };

export function computeRewards(cards: { stamps_count: number }[], threshold: number): Rewards {
  const completedCards = cards.filter((c) => c.stamps_count >= threshold).length;
  const totalCards = cards.length;
  return { completedCards, totalCards, completionRate: totalCards ? Math.round((completedCards / totalCards) * 100) : 0 };
}

export async function fetchRewards(merchantId: string, _range: RangeKey): Promise<Rewards> {
  const supabase = await createClient();
  const { data } = await supabase.from("loyalty_cards").select("stamps_count").eq("merchant_id", merchantId);
  return computeRewards(data ?? [], REWARD_THRESHOLD);
}
```
- [ ] **Step 4: Implémenter le dispatch**

Create `src/lib/analytics/index.ts`:
```ts
import type { RangeKey, WidgetKey } from "./types";
import { fetchKpis } from "./kpis";
import { fetchVisits } from "./visits";
import { fetchAcquisition } from "./acquisition";
import { fetchRetention } from "./retention";
import { fetchTopCustomers } from "./topCustomers";
import { fetchPeakHours } from "./peakHours";
import { fetchWalletMix } from "./walletMix";
import { fetchRewards } from "./rewards";

const FETCHERS: Record<WidgetKey, (m: string, r: RangeKey) => Promise<unknown>> = {
  kpis: fetchKpis, visits: fetchVisits, acquisition: fetchAcquisition, retention: fetchRetention,
  top_customers: fetchTopCustomers, peak_hours: fetchPeakHours, wallet_mix: fetchWalletMix, rewards: fetchRewards,
};

export function fetchWidget(widget: WidgetKey, merchantId: string, range: RangeKey) {
  return FETCHERS[widget](merchantId, range);
}
```
- [ ] **Step 5: Succès** — Run: `npm test -- rewards` → PASS. Puis `npm test` (toute la suite) → PASS.
- [ ] **Step 6: Commit**
```bash
git add src/lib/analytics/rewards.ts src/lib/analytics/index.ts src/lib/analytics/__tests__/rewards.test.ts
git commit -m "feat(analytics): rewards widget + fetch dispatch"
```

---

### Task 14: Route API analytics

**Files:** Create `src/app/api/analytics/route.ts`. Helper: `src/lib/analytics/merchant.ts`

- [ ] **Step 1: Helper « marchand courant »**

Create `src/lib/analytics/merchant.ts`:
```ts
import { createClient } from "@/utils/supabase/server";

export async function currentMerchantId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("merchants").select("id").eq("user_id", user.id).single();
  return data?.id ?? null;
}
```

- [ ] **Step 2: Route**

Create `src/app/api/analytics/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { WIDGET_KEYS, type RangeKey, type WidgetKey } from "@/lib/analytics/types";
import { fetchWidget } from "@/lib/analytics";
import { currentMerchantId } from "@/lib/analytics/merchant";

const RANGES: RangeKey[] = ["7j", "30j", "12m"];

export async function GET(req: NextRequest) {
  const merchantId = await currentMerchantId();
  if (!merchantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const widget = req.nextUrl.searchParams.get("widget") as WidgetKey | null;
  const range = (req.nextUrl.searchParams.get("range") ?? "30j") as RangeKey;
  if (!widget || !WIDGET_KEYS.includes(widget)) return NextResponse.json({ error: "bad widget" }, { status: 400 });
  if (!RANGES.includes(range)) return NextResponse.json({ error: "bad range" }, { status: 400 });

  try {
    const data = await fetchWidget(widget, merchantId, range);
    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ error: "compute failed" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Vérifier manuellement**

Run: `npm run dev` puis (connecté) `curl -s "http://localhost:3000/api/analytics?widget=kpis&range=30j"` (avec cookie de session) — ou tester via l'UI à la Task 18.
Expected: 401 sans session ; JSON `{data:{...}}` avec session marchand.

- [ ] **Step 4: Commit**
```bash
git add src/lib/analytics/merchant.ts src/app/api/analytics/route.ts
git commit -m "feat(api): analytics endpoint with merchant scoping"
```

---

### Task 15: Sauvegarde de la config + endpoint

**Files:** Create `src/app/api/dashboard-config/route.ts`

- [ ] **Step 1: Route POST**

Create `src/app/api/dashboard-config/route.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { WIDGET_KEYS, type DashboardConfig } from "@/lib/analytics/types";
import { currentMerchantId } from "@/lib/analytics/merchant";

export async function POST(req: NextRequest) {
  const merchantId = await currentMerchantId();
  if (!merchantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json()) as DashboardConfig;
  const valid = Array.isArray(body?.widgets) &&
    body.widgets.every((w) => WIDGET_KEYS.includes(w.key) && typeof w.visible === "boolean" && typeof w.order === "number");
  if (!valid) return NextResponse.json({ error: "bad config" }, { status: 400 });

  const supabase = await createClient();
  const { error } = await supabase.from("merchants").update({ dashboard_config: body }).eq("id", merchantId);
  if (error) return NextResponse.json({ error: "save failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Vérifier** — `npm run build` passe (typecheck).
- [ ] **Step 3: Commit**
```bash
git add src/app/api/dashboard-config/route.ts
git commit -m "feat(api): save merchant dashboard config"
```

---

### Task 16: Dépendances UI (SWR, Recharts, react-pdf) + hook

**Files:** Modify `package.json`; Create `src/app/dashboard/_analytics/useAnalytics.ts`

- [ ] **Step 1: Installer**

Run: `npm i swr recharts @react-pdf/renderer`
Expected: ajout aux dependencies.

- [ ] **Step 2: Hook de polling**

Create `src/app/dashboard/_analytics/useAnalytics.ts`:
```ts
"use client";
import useSWR from "swr";
import type { RangeKey, WidgetKey } from "@/lib/analytics/types";

const fetcher = (url: string) => fetch(url).then((r) => {
  if (!r.ok) throw new Error("fetch failed");
  return r.json();
});

export function useAnalytics<T>(widget: WidgetKey, range: RangeKey) {
  const { data, error, isLoading } = useSWR<{ data: T }>(
    `/api/analytics?widget=${widget}&range=${range}`,
    fetcher,
    { refreshInterval: 45000, revalidateOnFocus: true }
  );
  return { data: data?.data, error, isLoading };
}
```

- [ ] **Step 3: Vérifier** — `npm run build` passe.
- [ ] **Step 4: Commit**
```bash
git add package.json package-lock.json src/app/dashboard/_analytics/useAnalytics.ts
git commit -m "feat(analytics): polling hook + UI deps"
```

---

### Task 17: Composants widgets (client + Recharts)

**Files:** Create `src/app/dashboard/_analytics/widgets/*.tsx` (8 fichiers) + `src/app/dashboard/_analytics/Card.tsx`

> Chaque widget : `"use client"`, appelle `useAnalytics<TypeData>(key, range)`, gère `isLoading` (skeleton), `error` (message local), vide (état vide). Conteneur commun `Card`.

- [ ] **Step 1: Carte conteneur**

Create `src/app/dashboard/_analytics/Card.tsx`:
```tsx
export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-6">
      <h3 className="text-sm font-bold text-zinc-300 mb-4">{title}</h3>
      {children}
    </div>
  );
}
export function WidgetState({ loading, error, empty }: { loading?: boolean; error?: unknown; empty?: boolean }) {
  if (loading) return <div className="h-24 animate-pulse bg-zinc-800/40 rounded-xl" />;
  if (error) return <div className="text-sm text-red-400">Erreur de chargement</div>;
  if (empty) return <div className="text-sm text-zinc-600">Pas encore de données</div>;
  return null;
}
```

- [ ] **Step 2: KpisWidget**

Create `src/app/dashboard/_analytics/widgets/KpisWidget.tsx`:
```tsx
"use client";
import { useAnalytics } from "../useAnalytics";
import { WidgetState } from "../Card";
import type { KpisData } from "@/lib/analytics/kpis";
import type { RangeKey } from "@/lib/analytics/types";

export function KpisWidget({ range }: { range: RangeKey }) {
  const { data, error, isLoading } = useAnalytics<KpisData>("kpis", range);
  if (isLoading || error) return <WidgetState loading={isLoading} error={error} />;
  const tiles = [
    { label: "Clients", value: data!.totalCustomers, sub: `+${data!.newCustomers} ce mois` },
    { label: "Visites", value: data!.visits, sub: "sur la période" },
    { label: "Actifs", value: `${data!.activeRate}%`, sub: "des clients" },
    { label: "Récompenses", value: data!.completedCards, sub: "cartes complétées" },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {tiles.map((t) => (
        <div key={t.label} className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-5">
          <div className="text-xs uppercase tracking-wide text-zinc-500">{t.label}</div>
          <div className="text-2xl font-bold">{t.value}</div>
          <div className="text-xs text-emerald-400">{t.sub}</div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: VisitsWidget + AcquisitionWidget (Recharts line/bar)**

Create `src/app/dashboard/_analytics/widgets/VisitsWidget.tsx`:
```tsx
"use client";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { useAnalytics } from "../useAnalytics";
import { Card, WidgetState } from "../Card";
import type { Point } from "@/lib/analytics/visits";
import type { RangeKey } from "@/lib/analytics/types";

export function VisitsWidget({ range }: { range: RangeKey }) {
  const { data, error, isLoading } = useAnalytics<Point[]>("visits", range);
  return (
    <Card title="Visites dans le temps">
      {(isLoading || error || !data?.length)
        ? <WidgetState loading={isLoading} error={error} empty={!data?.length} />
        : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={data}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#71717a" }} hide={data.length > 14} />
              <YAxis tick={{ fontSize: 10, fill: "#71717a" }} width={28} />
              <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 12 }} />
              <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
    </Card>
  );
}
```

Create `src/app/dashboard/_analytics/widgets/AcquisitionWidget.tsx` (même structure, `BarChart`/`Bar`, `useAnalytics<Point[]>("acquisition", range)`, titre « Acquisition de clients », couleur `#3b82f6`):
```tsx
"use client";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import { useAnalytics } from "../useAnalytics";
import { Card, WidgetState } from "../Card";
import type { Point } from "@/lib/analytics/visits";
import type { RangeKey } from "@/lib/analytics/types";

export function AcquisitionWidget({ range }: { range: RangeKey }) {
  const { data, error, isLoading } = useAnalytics<Point[]>("acquisition", range);
  return (
    <Card title="Acquisition de clients">
      {(isLoading || error || !data?.length)
        ? <WidgetState loading={isLoading} error={error} empty={!data?.length} />
        : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#71717a" }} hide={data.length > 14} />
              <YAxis tick={{ fontSize: 10, fill: "#71717a" }} width={28} />
              <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 12 }} />
              <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
    </Card>
  );
}
```

- [ ] **Step 4: RetentionWidget (donut) + WalletMixWidget (barres)**

Create `src/app/dashboard/_analytics/widgets/RetentionWidget.tsx`:
```tsx
"use client";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { useAnalytics } from "../useAnalytics";
import { Card, WidgetState } from "../Card";
import type { Retention } from "@/lib/analytics/retention";
import type { RangeKey } from "@/lib/analytics/types";

export function RetentionWidget({ range }: { range: RangeKey }) {
  const { data, error, isLoading } = useAnalytics<Retention>("retention", range);
  return (
    <Card title="Actifs vs inactifs">
      {(isLoading || error || !data)
        ? <WidgetState loading={isLoading} error={error} />
        : (
          <div className="flex items-center gap-4">
            <ResponsiveContainer width={120} height={120}>
              <PieChart>
                <Pie data={[{ v: data.active }, { v: data.inactive }]} dataKey="v" innerRadius={36} outerRadius={56}>
                  <Cell fill="#10b981" /><Cell fill="#3f3f46" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="text-sm">
              <div className="text-emerald-400 font-bold">{data.activeRate}% actifs</div>
              <div className="text-zinc-500">{data.active} actifs · {data.inactive} inactifs</div>
            </div>
          </div>
        )}
    </Card>
  );
}
```

Create `src/app/dashboard/_analytics/widgets/WalletMixWidget.tsx`:
```tsx
"use client";
import { useAnalytics } from "../useAnalytics";
import { Card, WidgetState } from "../Card";
import type { WalletMix } from "@/lib/analytics/walletMix";
import type { RangeKey } from "@/lib/analytics/types";

function Bar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs mb-1"><span>{label}</span><span>{pct}%</span></div>
      <div className="h-2 bg-zinc-800 rounded-full"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} /></div>
    </div>
  );
}
export function WalletMixWidget({ range }: { range: RangeKey }) {
  const { data, error, isLoading } = useAnalytics<WalletMix>("wallet_mix", range);
  return (
    <Card title="Adoption Wallet">
      {(isLoading || error || !data)
        ? <WidgetState loading={isLoading} error={error} />
        : (<div><Bar label="Apple" pct={data.applePct} color="#e4e4e7" /><Bar label="Google" pct={data.googlePct} color="#10b981" /></div>)}
    </Card>
  );
}
```

- [ ] **Step 5: TopCustomersWidget (liste) + PeakHoursWidget (grille) + RewardsWidget**

Create `src/app/dashboard/_analytics/widgets/TopCustomersWidget.tsx`:
```tsx
"use client";
import { useAnalytics } from "../useAnalytics";
import { Card, WidgetState } from "../Card";
import type { TopCustomer } from "@/lib/analytics/topCustomers";
import type { RangeKey } from "@/lib/analytics/types";

export function TopCustomersWidget({ range }: { range: RangeKey }) {
  const { data, error, isLoading } = useAnalytics<TopCustomer[]>("top_customers", range);
  return (
    <Card title="Top clients">
      {(isLoading || error || !data?.length)
        ? <WidgetState loading={isLoading} error={error} empty={!data?.length} />
        : (<ol className="space-y-2 text-sm">{data.map((c, i) => (
            <li key={c.customerId} className="flex justify-between"><span>{i + 1}. {c.name}</span><span className="text-emerald-400">{c.visits} visites</span></li>
          ))}</ol>)}
    </Card>
  );
}
```

Create `src/app/dashboard/_analytics/widgets/PeakHoursWidget.tsx`:
```tsx
"use client";
import { useAnalytics } from "../useAnalytics";
import { Card, WidgetState } from "../Card";
import type { Heatmap } from "@/lib/analytics/peakHours";
import type { RangeKey } from "@/lib/analytics/types";

const DAYS = ["D", "L", "M", "M", "J", "V", "S"];
export function PeakHoursWidget({ range }: { range: RangeKey }) {
  const { data, error, isLoading } = useAnalytics<Heatmap>("peak_hours", range);
  if (isLoading || error || !data) return <Card title="Affluence (jours × heures)"><WidgetState loading={isLoading} error={error} /></Card>;
  const max = Math.max(1, ...data.flat());
  return (
    <Card title="Affluence (jours × heures)">
      <div className="space-y-1">
        {data.map((row, d) => (
          <div key={d} className="flex items-center gap-1">
            <span className="w-3 text-[10px] text-zinc-500">{DAYS[d]}</span>
            <div className="grid grid-cols-24 gap-[2px] flex-1" style={{ gridTemplateColumns: "repeat(24,1fr)" }}>
              {row.map((v, h) => <div key={h} title={`${v}`} className="aspect-square rounded-[2px]" style={{ background: `rgba(16,185,129,${v / max})` }} />)}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
```

Create `src/app/dashboard/_analytics/widgets/RewardsWidget.tsx`:
```tsx
"use client";
import { useAnalytics } from "../useAnalytics";
import { Card, WidgetState } from "../Card";
import type { Rewards } from "@/lib/analytics/rewards";
import type { RangeKey } from "@/lib/analytics/types";

export function RewardsWidget({ range }: { range: RangeKey }) {
  const { data, error, isLoading } = useAnalytics<Rewards>("rewards", range);
  return (
    <Card title="Récompenses / cartes complétées">
      {(isLoading || error || !data)
        ? <WidgetState loading={isLoading} error={error} />
        : (<div><div className="text-3xl font-bold">{data.completedCards}</div>
            <div className="text-sm text-zinc-500">{data.completionRate}% des cartes ({data.totalCards})</div></div>)}
    </Card>
  );
}
```

- [ ] **Step 6: Vérifier** — `npm run build` passe (tous les widgets typés).
- [ ] **Step 7: Commit**
```bash
git add src/app/dashboard/_analytics/
git commit -m "feat(analytics): widget components (recharts)"
```

---

### Task 18: Grille + sélecteur de période, branchée sur /dashboard

**Files:** Create `src/app/dashboard/_analytics/AnalyticsGrid.tsx`; Modify `src/app/dashboard/page.tsx`

- [ ] **Step 1: Grille client**

Create `src/app/dashboard/_analytics/AnalyticsGrid.tsx`:
```tsx
"use client";
import { useState } from "react";
import type { DashboardConfig, RangeKey, WidgetKey } from "@/lib/analytics/types";
import { KpisWidget } from "./widgets/KpisWidget";
import { VisitsWidget } from "./widgets/VisitsWidget";
import { AcquisitionWidget } from "./widgets/AcquisitionWidget";
import { RetentionWidget } from "./widgets/RetentionWidget";
import { TopCustomersWidget } from "./widgets/TopCustomersWidget";
import { PeakHoursWidget } from "./widgets/PeakHoursWidget";
import { WalletMixWidget } from "./widgets/WalletMixWidget";
import { RewardsWidget } from "./widgets/RewardsWidget";

const COMP: Record<WidgetKey, (p: { range: RangeKey }) => React.ReactNode> = {
  kpis: KpisWidget, visits: VisitsWidget, acquisition: AcquisitionWidget, retention: RetentionWidget,
  top_customers: TopCustomersWidget, peak_hours: PeakHoursWidget, wallet_mix: WalletMixWidget, rewards: RewardsWidget,
};
const RANGES: RangeKey[] = ["7j", "30j", "12m"];

export function AnalyticsGrid({ config }: { config: DashboardConfig }) {
  const [range, setRange] = useState<RangeKey>("30j");
  const visible = config.widgets.filter((w) => w.visible);
  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        {RANGES.map((r) => (
          <button key={r} onClick={() => setRange(r)}
            className={`px-3 py-1.5 rounded-xl text-sm ${range === r ? "bg-emerald-500 text-black" : "bg-zinc-900 text-zinc-400"}`}>
            {r}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {visible.map((w) => {
          const C = COMP[w.key];
          const span = w.key === "kpis" || w.key === "visits" || w.key === "peak_hours" ? "lg:col-span-2" : "";
          return <div key={w.key} className={span}><C range={range} /></div>;
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Brancher dans la page dashboard**

Modify `src/app/dashboard/page.tsx` — remplacer le contenu par le chargement de la config + la grille (garder l'en-tête « Bonjour, … » existant) :
```tsx
import { createClient } from "@/utils/supabase/server";
import { resolveDashboardConfig } from "@/lib/analytics/config";
import { AnalyticsGrid } from "./_analytics/AnalyticsGrid";

export default async function DashboardHome() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: merchant } = await supabase.from("merchants").select("*").eq("user_id", user?.id).single();
  const config = resolveDashboardConfig(merchant?.dashboard_config ?? null, merchant?.business_type ?? "autre");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Bonjour, {merchant?.shop_name || "Commerçant"} 👋</h1>
        <p className="text-zinc-500">Voici l'activité de votre programme de fidélité.</p>
      </div>
      <AnalyticsGrid config={config} />
    </div>
  );
}
```

- [ ] **Step 3: Vérifier visuellement**

Run: `npm run dev`, se connecter en marchand, ouvrir `/dashboard`. Vérifier : les widgets visibles s'affichent, le sélecteur 7j/30j/12m change les données, le rafraîchissement se fait (~45 s). Capture possible via Playwright (cf. `/tmp/halo-pages.sh`).
Expected: dashboard analytique fonctionnel, pas d'erreur console.

- [ ] **Step 4: Commit**
```bash
git add src/app/dashboard/_analytics/AnalyticsGrid.tsx src/app/dashboard/page.tsx
git commit -m "feat(dashboard): analytics grid with period selector"
```

---

### Task 19: Panneau « Personnaliser »

**Files:** Create `src/app/dashboard/_analytics/CustomizePanel.tsx`; Modify `AnalyticsGrid.tsx` (bouton + état)

- [ ] **Step 1: Panneau**

Create `src/app/dashboard/_analytics/CustomizePanel.tsx`:
```tsx
"use client";
import { useState } from "react";
import { WIDGETS, type DashboardConfig, type WidgetConfigItem } from "@/lib/analytics/types";

export function CustomizePanel({ config, onClose, onSaved }: {
  config: DashboardConfig; onClose: () => void; onSaved: (c: DashboardConfig) => void;
}) {
  const [items, setItems] = useState<WidgetConfigItem[]>(config.widgets);
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir; if (j < 0 || j >= items.length) return;
    const copy = [...items]; [copy[i], copy[j]] = [copy[j], copy[i]];
    setItems(copy.map((w, idx) => ({ ...w, order: idx })));
  };
  const toggle = (i: number) => setItems(items.map((w, idx) => idx === i ? { ...w, visible: !w.visible } : w));
  const save = async () => {
    const next = { widgets: items };
    await fetch("/api/dashboard-config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) });
    onSaved(next); onClose();
  };
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex justify-end" onClick={onClose}>
      <div className="w-80 bg-zinc-950 border-l border-zinc-800 p-6 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-bold mb-4">Personnaliser</h3>
        <ul className="space-y-2">
          {items.map((w, i) => (
            <li key={w.key} className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={w.visible} onChange={() => toggle(i)} />
                {WIDGETS[w.key].label}
              </label>
              <span className="flex gap-1">
                <button onClick={() => move(i, -1)} className="text-zinc-500 hover:text-white">↑</button>
                <button onClick={() => move(i, 1)} className="text-zinc-500 hover:text-white">↓</button>
              </span>
            </li>
          ))}
        </ul>
        <button onClick={save} className="mt-4 w-full bg-emerald-500 text-black rounded-xl py-2 font-bold">Enregistrer</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Brancher le bouton dans AnalyticsGrid**

Remplacer **tout** le contenu de `src/app/dashboard/_analytics/AnalyticsGrid.tsx` par :
```tsx
"use client";
import { useState } from "react";
import type { DashboardConfig, RangeKey, WidgetKey } from "@/lib/analytics/types";
import { KpisWidget } from "./widgets/KpisWidget";
import { VisitsWidget } from "./widgets/VisitsWidget";
import { AcquisitionWidget } from "./widgets/AcquisitionWidget";
import { RetentionWidget } from "./widgets/RetentionWidget";
import { TopCustomersWidget } from "./widgets/TopCustomersWidget";
import { PeakHoursWidget } from "./widgets/PeakHoursWidget";
import { WalletMixWidget } from "./widgets/WalletMixWidget";
import { RewardsWidget } from "./widgets/RewardsWidget";
import { CustomizePanel } from "./CustomizePanel";

const COMP: Record<WidgetKey, (p: { range: RangeKey }) => React.ReactNode> = {
  kpis: KpisWidget, visits: VisitsWidget, acquisition: AcquisitionWidget, retention: RetentionWidget,
  top_customers: TopCustomersWidget, peak_hours: PeakHoursWidget, wallet_mix: WalletMixWidget, rewards: RewardsWidget,
};
const RANGES: RangeKey[] = ["7j", "30j", "12m"];

export function AnalyticsGrid({ config }: { config: DashboardConfig }) {
  const [range, setRange] = useState<RangeKey>("30j");
  const [cfg, setCfg] = useState<DashboardConfig>(config);
  const [open, setOpen] = useState(false);
  const visible = cfg.widgets.filter((w) => w.visible);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {RANGES.map((r) => (
            <button key={r} onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-xl text-sm ${range === r ? "bg-emerald-500 text-black" : "bg-zinc-900 text-zinc-400"}`}>
              {r}
            </button>
          ))}
        </div>
        <button onClick={() => setOpen(true)}
          className="px-3 py-1.5 rounded-xl text-sm bg-zinc-900 text-zinc-400 hover:text-white">⚙ Personnaliser</button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {visible.map((w) => {
          const C = COMP[w.key];
          const span = w.key === "kpis" || w.key === "visits" || w.key === "peak_hours" ? "lg:col-span-2" : "";
          return <div key={w.key} className={span}><C range={range} /></div>;
        })}
      </div>
      {open && <CustomizePanel config={cfg} onClose={() => setOpen(false)} onSaved={setCfg} />}
    </div>
  );
}
```

- [ ] **Step 3: Vérifier** — `npm run dev` : ouvrir « Personnaliser », masquer/réordonner, enregistrer, recharger → l'ordre/visibilité persistent.
- [ ] **Step 4: Commit**
```bash
git add src/app/dashboard/_analytics/CustomizePanel.tsx src/app/dashboard/_analytics/AnalyticsGrid.tsx
git commit -m "feat(dashboard): customize panel (toggle/reorder widgets)"
```

---

### Task 20: Export CSV

**Files:** Create `src/lib/analytics/csv.ts`; Create `src/app/api/analytics/export/csv/route.ts`; Test `src/lib/analytics/__tests__/csv.test.ts`

- [ ] **Step 1: Test du formateur CSV (échoue)**
```ts
import { describe, it, expect } from "vitest";
import { toCsv } from "@/lib/analytics/csv";
describe("toCsv", () => {
  it("entêtes + lignes, échappe les virgules/guillemets", () => {
    const csv = toCsv(["nom", "visites"], [["Café, Léman", 12], ['Say "hi"', 3]]);
    expect(csv).toBe('nom,visites\n"Café, Léman",12\n"Say ""hi""",3');
  });
});
```
- [ ] **Step 2: Échec** — Run: `npm test -- csv` → FAIL.
- [ ] **Step 3: Implémenter le formateur**

Create `src/lib/analytics/csv.ts`:
```ts
function cell(v: string | number): string {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export function toCsv(headers: string[], rows: (string | number)[][]): string {
  return [headers.map(cell).join(","), ...rows.map((r) => r.map(cell).join(","))].join("\n");
}
```
- [ ] **Step 4: Succès** — Run: `npm test -- csv` → PASS.

- [ ] **Step 5: Route CSV**

Create `src/app/api/analytics/export/csv/route.ts`:
```ts
import { type NextRequest } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { currentMerchantId } from "@/lib/analytics/merchant";
import { resolveRange } from "@/lib/analytics/range";
import { toCsv } from "@/lib/analytics/csv";
import type { RangeKey } from "@/lib/analytics/types";

export async function GET(req: NextRequest) {
  const merchantId = await currentMerchantId();
  if (!merchantId) return new Response("unauthorized", { status: 401 });
  const type = req.nextUrl.searchParams.get("type") ?? "clients";
  const range = (req.nextUrl.searchParams.get("range") ?? "30j") as RangeKey;
  const supabase = await createClient();
  const { from } = resolveRange(range);

  let csv = "";
  if (type === "visites") {
    const { data } = await supabase.from("scan_history").select("scanned_at, points_added")
      .eq("merchant_id", merchantId).gte("scanned_at", from.toISOString()).order("scanned_at");
    csv = toCsv(["date", "points"], (data ?? []).map((r) => [r.scanned_at, r.points_added]));
  } else {
    const { data } = await supabase.from("customers").select("full_name, email, phone, created_at")
      .eq("merchant_id", merchantId).order("created_at");
    csv = toCsv(["nom", "email", "telephone", "inscrit_le"], (data ?? []).map((r) => [r.full_name, r.email ?? "", r.phone ?? "", r.created_at]));
  }
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${type}-${range}.csv"` },
  });
}
```

- [ ] **Step 6: Vérifier** — connecté, ouvrir `/api/analytics/export/csv?type=clients&range=30j` → télécharge un CSV non vide. Ajouter un item « CSV » au bouton Exporter (lien `<a href=...>`).
- [ ] **Step 7: Commit**
```bash
git add src/lib/analytics/csv.ts src/app/api/analytics/export/csv/route.ts src/lib/analytics/__tests__/csv.test.ts
git commit -m "feat(export): CSV export endpoint"
```

---

### Task 21: Export PDF (rapport de synthèse)

**Files:** Create `src/app/api/analytics/export/pdf/route.ts`

- [ ] **Step 1: Route PDF**

Create `src/app/api/analytics/export/pdf/route.ts`:
```ts
import { type NextRequest } from "next/server";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import React from "react";
import { currentMerchantId } from "@/lib/analytics/merchant";
import { fetchKpis } from "@/lib/analytics/kpis";
import type { RangeKey } from "@/lib/analytics/types";

export async function GET(req: NextRequest) {
  const merchantId = await currentMerchantId();
  if (!merchantId) return new Response("unauthorized", { status: 401 });
  const range = (req.nextUrl.searchParams.get("range") ?? "30j") as RangeKey;
  const kpis = await fetchKpis(merchantId, range);

  const s = StyleSheet.create({
    page: { padding: 40, fontSize: 12 },
    h1: { fontSize: 20, marginBottom: 16 },
    row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  });
  const doc = React.createElement(Document, null,
    React.createElement(Page, { size: "A4", style: s.page },
      React.createElement(Text, { style: s.h1 }, `Rapport de performance (${range})`),
      React.createElement(View, { style: s.row }, React.createElement(Text, null, "Clients"), React.createElement(Text, null, String(kpis.totalCustomers))),
      React.createElement(View, { style: s.row }, React.createElement(Text, null, "Nouveaux"), React.createElement(Text, null, String(kpis.newCustomers))),
      React.createElement(View, { style: s.row }, React.createElement(Text, null, "Visites"), React.createElement(Text, null, String(kpis.visits))),
      React.createElement(View, { style: s.row }, React.createElement(Text, null, "Clients actifs"), React.createElement(Text, null, `${kpis.activeRate}%`)),
      React.createElement(View, { style: s.row }, React.createElement(Text, null, "Cartes complétées"), React.createElement(Text, null, String(kpis.completedCards))),
    )
  );
  const buffer = await renderToBuffer(doc);
  return new Response(buffer as unknown as BodyInit, {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="rapport-${range}.pdf"` },
  });
}
```

- [ ] **Step 2: Forcer le runtime Node**

En haut du fichier, ajouter `export const runtime = "nodejs";` (react-pdf nécessite Node, pas Edge).

- [ ] **Step 3: Vérifier** — connecté, ouvrir `/api/analytics/export/pdf?range=30j` → télécharge un PDF non vide avec les KPIs. Ajouter l'item « PDF » au bouton Exporter.
- [ ] **Step 4: Commit**
```bash
git add src/app/api/analytics/export/pdf/route.ts
git commit -m "feat(export): PDF performance report"
```

---

### Task 22: Vérification finale

- [ ] **Step 1: Tests** — Run: `npm test` → tous PASS.
- [ ] **Step 2: Build** — Run: `npm run build` → « Compiled successfully », toutes les routes (dont `/api/analytics*`).
- [ ] **Step 3: Lint** — Run: `npm run lint` → exit 0.
- [ ] **Step 4: Fumée UI** — `npm run dev`, marchand connecté : `/dashboard` affiche les widgets, période + rafraîchissement OK, Personnaliser persiste, exports CSV/PDF téléchargent.
- [ ] **Step 5: Commit final éventuel** (branchements boutons Exporter dans la barre).

---

## Notes de réalisation

- **TDD** : la logique d'agrégation (fonctions `compute*`) est testée sans DB. Les `fetch*`, routes et composants UI sont vérifiés par `build` + fumée manuelle.
- **Sécurité** : tout endpoint passe par `currentMerchantId()` (session) + RLS existante.
- **Perf** : index posés en Task 2 ; chaque widget fetch indépendamment (un échec n'affecte pas les autres).
- **Suite** : ce module pose `business_type` et la structure du dashboard — réutilisés par les modules Segmentation, Push, Campagnes, IA.
