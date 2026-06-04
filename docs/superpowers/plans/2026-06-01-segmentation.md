# Module 2 — Segmentation auto des clients — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Classer automatiquement les clients d'un marchand en 5 stades de cycle de vie exclusifs + 2 étiquettes transverses, exposés dans un onglet « Segments » (vue d'ensemble + drill-down + export CSV).

**Architecture:** Calcul **à la volée** (aucune migration, aucun stockage). Logique **pure** testée en TDD (`tally → aggregate → classify → summarize`), puis une couche `fetch.ts` qui branche Supabase (scoping marchand via RLS) et appelle les fonctions pures. UI calquée sur le module analytique livré. Le moteur (`classifyCustomer`, `fetchSegmentMembers`) sera réutilisé par le Module 4.

**Tech Stack:** Next.js 16 (App Router, route handlers à `params` async) · React 19 · TypeScript · Supabase `@supabase/ssr` · Vitest · Tailwind v4 · lucide-react.

**Spec:** `docs/superpowers/specs/2026-06-01-segmentation-design.md`

---

## File Structure

```
src/lib/segments/
  types.ts        # clés/labels/familles de segments, constantes de seuils, types partagés
  scans.ts        # PUR : tallyScansByCard(rows) -> Map<cardId, count>
  stats.ts        # PUR : buildCustomerStats(customer, cards, scanCounts, reachableSet) -> CustomerStats
  classify.ts     # PUR : classifyCustomer(stats, now) -> Classification
  summary.ts      # PUR : summarizeSegments(classifications) -> SegmentSummary
  fetch.ts        # fetchSegmentCounts(merchantId), fetchSegmentMembers(merchantId, stage), isStageKey()
  __tests__/types.test.ts, scans.test.ts, stats.test.ts, classify.test.ts, summary.test.ts

src/app/api/segments/route.ts                 # GET -> compteurs + % + étiquettes
src/app/api/segments/[segment]/route.ts       # GET -> membres d'un stade
src/app/api/segments/export/csv/route.ts      # GET ?segment= -> CSV

src/app/dashboard/segments/page.tsx           # server : charge le résumé, rend <SegmentsView/>
src/app/dashboard/segments/SegmentsView.tsx   # client : cartes + drill-down + lien CSV
src/app/dashboard/DashboardShell.tsx          # modifié : onglet « Segments »
```

**Réutilisé tel quel (DRY) :** `currentMerchantId()` (`@/lib/analytics/merchant`), `createClient` (`@/utils/supabase/server`), `toCsv()` (`@/lib/analytics/csv`).

**Note de décomposition vs spec :** la spec citait un seul `classify.ts` + un `csv.ts` dédié. On scinde la logique pure en fichiers focalisés (`scans`/`stats`/`classify`/`summary`) — plus testable — et on **réutilise** `@/lib/analytics/csv` au lieu d'un nouveau fichier. Même comportement, meilleure isolation.

---

### Task 1: Types, constantes & registre

**Files:**
- Create: `src/lib/segments/types.ts`
- Test: `src/lib/segments/__tests__/types.test.ts`

- [ ] **Step 1: Écrire le test (échoue d'abord)**

```ts
import { describe, it, expect } from "vitest";
import { STAGE_KEYS, STAGE_LABELS, FLAG_KEYS, FLAG_LABELS, STAGE_FAMILIES } from "@/lib/segments/types";

describe("registre des segments", () => {
  it("5 stades, chacun avec un label", () => {
    expect(STAGE_KEYS).toHaveLength(5);
    for (const k of STAGE_KEYS) expect(STAGE_LABELS[k].length).toBeGreaterThan(0);
  });
  it("2 étiquettes, chacune avec un label", () => {
    expect(FLAG_KEYS).toHaveLength(2);
    for (const k of FLAG_KEYS) expect(FLAG_LABELS[k].length).toBeGreaterThan(0);
  });
  it("les familles couvrent les 5 stades, sans doublon", () => {
    const inFamilies = STAGE_FAMILIES.flatMap((f) => f.stages).sort();
    expect(inFamilies).toEqual([...STAGE_KEYS].sort());
  });
});
```

- [ ] **Step 2: Vérifier l'échec** — Run: `cd ~/Projects/Carte-Fidelite && npm test -- types` → FAIL (module introuvable).

- [ ] **Step 3: Implémenter**

```ts
export const STAGE_KEYS = ["nouveau", "regulier", "vip", "en_train_de_partir", "inactif"] as const;
export type StageKey = (typeof STAGE_KEYS)[number];

export const STAGE_LABELS: Record<StageKey, string> = {
  nouveau: "Nouveaux",
  regulier: "Réguliers",
  vip: "VIP",
  en_train_de_partir: "En train de partir",
  inactif: "Inactifs",
};

export const FLAG_KEYS = ["recompense_prete", "joignable_push"] as const;
export type FlagKey = (typeof FLAG_KEYS)[number];

export const FLAG_LABELS: Record<FlagKey, string> = {
  recompense_prete: "Récompense prête",
  joignable_push: "Joignable en push",
};

// Regroupement d'affichage de l'onglet Segments.
export const STAGE_FAMILIES: { title: string; stages: StageKey[] }[] = [
  { title: "Cœur de clientèle", stages: ["regulier", "vip", "nouveau"] },
  { title: "À reconquérir", stages: ["en_train_de_partir", "inactif"] },
];

// Seuils (fixes — voir spec). DAY_MS pour les calculs de jours.
export const ACTIVE_DAYS = 30;
export const AT_RISK_DAYS = 90;
export const NEW_TENURE_DAYS = 30;
export const NEW_MAX_VISITS = 2;
export const VIP_MIN_VISITS = 10;
export const REWARD_THRESHOLD = 10;
export const DAY_MS = 86_400_000;

export type CustomerStats = {
  customerId: string;
  name: string;
  visits: number;
  lastScan: Date | null;
  createdAt: Date;
  maxStamps: number;
  reachablePush: boolean;
};

export type Classification = {
  stage: StageKey;
  flags: { recompense_prete: boolean; joignable_push: boolean };
};
```

- [ ] **Step 4: Vérifier le succès** — Run: `npm test -- types` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/segments/types.ts src/lib/segments/__tests__/types.test.ts
git commit -m "feat(segments): segment registry, thresholds and shared types"
```

---

### Task 2: `tallyScansByCard` (pur)

**Files:**
- Create: `src/lib/segments/scans.ts`
- Test: `src/lib/segments/__tests__/scans.test.ts`

- [ ] **Step 1: Écrire le test (échoue d'abord)**

```ts
import { describe, it, expect } from "vitest";
import { tallyScansByCard } from "@/lib/segments/scans";

describe("tallyScansByCard", () => {
  it("compte les scans par carte", () => {
    const m = tallyScansByCard([{ card_id: "a" }, { card_id: "a" }, { card_id: "b" }]);
    expect(m.get("a")).toBe(2);
    expect(m.get("b")).toBe(1);
    expect(m.get("c")).toBeUndefined();
  });
  it("liste vide -> map vide", () => {
    expect(tallyScansByCard([]).size).toBe(0);
  });
});
```

- [ ] **Step 2: Vérifier l'échec** — Run: `npm test -- scans` → FAIL.

- [ ] **Step 3: Implémenter**

```ts
export function tallyScansByCard(rows: { card_id: string }[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.card_id, (m.get(r.card_id) ?? 0) + 1);
  return m;
}
```

- [ ] **Step 4: Vérifier le succès** — Run: `npm test -- scans` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/segments/scans.ts src/lib/segments/__tests__/scans.test.ts
git commit -m "feat(segments): tally scans per card"
```

---

### Task 3: `buildCustomerStats` (pur — agrégation par client)

**Files:**
- Create: `src/lib/segments/stats.ts`
- Test: `src/lib/segments/__tests__/stats.test.ts`

- [ ] **Step 1: Écrire le test (échoue d'abord)**

```ts
import { describe, it, expect } from "vitest";
import { buildCustomerStats } from "@/lib/segments/stats";

describe("buildCustomerStats", () => {
  const customer = { id: "c1", full_name: "Alice", created_at: "2026-05-01T00:00:00Z" };

  it("agrège visites (somme), tampons (max), dernière visite (max), joignable (OR)", () => {
    const cards = [
      { id: "k1", stamps_count: 4, last_scan: "2026-05-10T00:00:00Z" },
      { id: "k2", stamps_count: 9, last_scan: "2026-05-20T00:00:00Z" },
    ];
    const scanCounts = new Map([["k1", 3], ["k2", 5]]);
    const reachable = new Set(["k2"]);
    const s = buildCustomerStats(customer, cards, scanCounts, reachable);
    expect(s.visits).toBe(8);
    expect(s.maxStamps).toBe(9);
    expect(s.lastScan?.toISOString()).toBe("2026-05-20T00:00:00.000Z");
    expect(s.reachablePush).toBe(true);
    expect(s.name).toBe("Alice");
  });

  it("jamais scanné -> lastScan null, visits 0, non joignable", () => {
    const s = buildCustomerStats(customer, [{ id: "k1", stamps_count: 0, last_scan: null }], new Map(), new Set());
    expect(s.visits).toBe(0);
    expect(s.lastScan).toBeNull();
    expect(s.reachablePush).toBe(false);
  });

  it("nom manquant -> 'Client'", () => {
    const s = buildCustomerStats({ id: "c1", full_name: null, created_at: "2026-05-01T00:00:00Z" }, [], new Map(), new Set());
    expect(s.name).toBe("Client");
  });
});
```

- [ ] **Step 2: Vérifier l'échec** — Run: `npm test -- stats` → FAIL.

- [ ] **Step 3: Implémenter**

```ts
import { type CustomerStats } from "./types";

export type CustomerRow = { id: string; full_name: string | null; created_at: string };
export type CardRow = { id: string; stamps_count: number | null; last_scan: string | null };

export function buildCustomerStats(
  customer: CustomerRow,
  cards: CardRow[],
  scanCounts: Map<string, number>,
  reachableSerials: Set<string>,
): CustomerStats {
  let visits = 0;
  let lastScanMs = 0;
  let maxStamps = 0;
  let reachablePush = false;
  for (const c of cards) {
    visits += scanCounts.get(c.id) ?? 0;
    if (c.last_scan) lastScanMs = Math.max(lastScanMs, new Date(c.last_scan).getTime());
    maxStamps = Math.max(maxStamps, c.stamps_count ?? 0);
    if (reachableSerials.has(c.id)) reachablePush = true;
  }
  return {
    customerId: customer.id,
    name: customer.full_name ?? "Client",
    visits,
    lastScan: lastScanMs > 0 ? new Date(lastScanMs) : null,
    createdAt: new Date(customer.created_at),
    maxStamps,
    reachablePush,
  };
}
```

- [ ] **Step 4: Vérifier le succès** — Run: `npm test -- stats` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/segments/stats.ts src/lib/segments/__tests__/stats.test.ts
git commit -m "feat(segments): per-customer stats aggregation"
```

---

### Task 4: `classifyCustomer` (pur — le cœur)

**Files:**
- Create: `src/lib/segments/classify.ts`
- Test: `src/lib/segments/__tests__/classify.test.ts`

- [ ] **Step 1: Écrire le test (échoue d'abord)**

```ts
import { describe, it, expect } from "vitest";
import { classifyCustomer } from "@/lib/segments/classify";
import { type CustomerStats } from "@/lib/segments/types";

const NOW = new Date("2026-06-01T00:00:00Z");
const DAY = 86_400_000;
// Construit des stats de test. recencyDays: jours depuis la dernière visite
// (null = jamais scanné). tenureDays: jours depuis l'inscription.
function stats(p: {
  visits?: number;
  tenureDays?: number;
  recencyDays?: number | null;
  maxStamps?: number;
  reachablePush?: boolean;
}): CustomerStats {
  const tenureDays = p.tenureDays ?? 200;
  const recency = p.recencyDays === undefined ? 5 : p.recencyDays; // défaut : vu il y a 5j
  return {
    customerId: "c",
    name: "X",
    visits: p.visits ?? 5,
    lastScan: recency === null ? null : new Date(NOW.getTime() - recency * DAY),
    createdAt: new Date(NOW.getTime() - tenureDays * DAY),
    maxStamps: p.maxStamps ?? 0,
    reachablePush: p.reachablePush ?? false,
  };
}

describe("classifyCustomer — stades", () => {
  it("recence > 90j -> inactif", () => {
    expect(classifyCustomer(stats({ recencyDays: 91 }), NOW).stage).toBe("inactif");
  });
  it("recence = 90j -> en_train_de_partir (borne)", () => {
    expect(classifyCustomer(stats({ recencyDays: 90 }), NOW).stage).toBe("en_train_de_partir");
  });
  it("recence = 31j -> en_train_de_partir", () => {
    expect(classifyCustomer(stats({ recencyDays: 31 }), NOW).stage).toBe("en_train_de_partir");
  });
  it("actif + visites >= 10 -> vip", () => {
    expect(classifyCustomer(stats({ recencyDays: 5, visits: 10 }), NOW).stage).toBe("vip");
  });
  it("actif + inscrit <= 30j + visites <= 2 -> nouveau", () => {
    expect(classifyCustomer(stats({ recencyDays: 5, tenureDays: 30, visits: 2 }), NOW).stage).toBe("nouveau");
  });
  it("actif + inscrit 31j + visites 2 -> regulier (plus 'nouveau')", () => {
    expect(classifyCustomer(stats({ recencyDays: 5, tenureDays: 31, visits: 2 }), NOW).stage).toBe("regulier");
  });
  it("actif + visites 3..9 -> regulier", () => {
    expect(classifyCustomer(stats({ recencyDays: 5, tenureDays: 200, visits: 3 }), NOW).stage).toBe("regulier");
  });
  it("jamais scanné, inscrit récemment -> nouveau (recence = ancienneté)", () => {
    expect(classifyCustomer(stats({ recencyDays: null, tenureDays: 10, visits: 0 }), NOW).stage).toBe("nouveau");
  });
  it("jamais scanné, inscrit il y a longtemps -> inactif", () => {
    expect(classifyCustomer(stats({ recencyDays: null, tenureDays: 200, visits: 0 }), NOW).stage).toBe("inactif");
  });
});

describe("classifyCustomer — étiquettes", () => {
  it("tampons >= 10 -> recompense_prete vrai", () => {
    expect(classifyCustomer(stats({ recencyDays: 5, maxStamps: 10 }), NOW).flags.recompense_prete).toBe(true);
  });
  it("tampons 9 -> recompense_prete faux", () => {
    expect(classifyCustomer(stats({ recencyDays: 5, maxStamps: 9 }), NOW).flags.recompense_prete).toBe(false);
  });
  it("joignable_push reflète reachablePush", () => {
    expect(classifyCustomer(stats({ recencyDays: 5, reachablePush: true }), NOW).flags.joignable_push).toBe(true);
  });
});
```

- [ ] **Step 2: Vérifier l'échec** — Run: `npm test -- classify` → FAIL.

- [ ] **Step 3: Implémenter**

```ts
import {
  ACTIVE_DAYS, AT_RISK_DAYS, NEW_TENURE_DAYS, NEW_MAX_VISITS, VIP_MIN_VISITS,
  REWARD_THRESHOLD, DAY_MS, type CustomerStats, type Classification, type StageKey,
} from "./types";

export function classifyCustomer(stats: CustomerStats, now: Date): Classification {
  // Récence : depuis la dernière visite ; à défaut, depuis l'inscription (silencieux).
  const refMs = stats.lastScan ? stats.lastScan.getTime() : stats.createdAt.getTime();
  const recencyDays = (now.getTime() - refMs) / DAY_MS;
  const tenureDays = (now.getTime() - stats.createdAt.getTime()) / DAY_MS;

  let stage: StageKey;
  if (recencyDays > AT_RISK_DAYS) stage = "inactif";
  else if (recencyDays > ACTIVE_DAYS) stage = "en_train_de_partir";
  else if (stats.visits >= VIP_MIN_VISITS) stage = "vip";
  else if (tenureDays <= NEW_TENURE_DAYS && stats.visits <= NEW_MAX_VISITS) stage = "nouveau";
  else stage = "regulier";

  return {
    stage,
    flags: {
      recompense_prete: stats.maxStamps >= REWARD_THRESHOLD,
      joignable_push: stats.reachablePush,
    },
  };
}
```

- [ ] **Step 4: Vérifier le succès** — Run: `npm test -- classify` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/segments/classify.ts src/lib/segments/__tests__/classify.test.ts
git commit -m "feat(segments): lifecycle classifier (5 stages + 2 flags)"
```

---

### Task 5: `summarizeSegments` (pur — compteurs + %)

**Files:**
- Create: `src/lib/segments/summary.ts`
- Test: `src/lib/segments/__tests__/summary.test.ts`

- [ ] **Step 1: Écrire le test (échoue d'abord)**

```ts
import { describe, it, expect } from "vitest";
import { summarizeSegments } from "@/lib/segments/summary";
import { type Classification } from "@/lib/segments/types";

const mk = (stage: Classification["stage"], rp = false, jp = false): Classification => ({
  stage, flags: { recompense_prete: rp, joignable_push: jp },
});

describe("summarizeSegments", () => {
  it("compte les stades, calcule les %, additionne les étiquettes", () => {
    const r = summarizeSegments([
      mk("regulier", true, true),
      mk("regulier", false, true),
      mk("inactif"),
      mk("vip", true, false),
    ]);
    expect(r.total).toBe(4);
    expect(r.stages.regulier.count).toBe(2);
    expect(r.stages.regulier.pct).toBe(50);
    expect(r.stages.vip.count).toBe(1);
    expect(r.stages.nouveau.count).toBe(0);
    expect(r.flags.recompense_prete).toBe(2);
    expect(r.flags.joignable_push).toBe(2);
  });
  it("aucune donnée -> total 0, pct 0", () => {
    const r = summarizeSegments([]);
    expect(r.total).toBe(0);
    expect(r.stages.inactif.pct).toBe(0);
  });
});
```

- [ ] **Step 2: Vérifier l'échec** — Run: `npm test -- summary` → FAIL.

- [ ] **Step 3: Implémenter**

```ts
import { STAGE_KEYS, FLAG_KEYS, type Classification, type StageKey, type FlagKey } from "./types";

export type SegmentSummary = {
  total: number;
  stages: Record<StageKey, { count: number; pct: number }>;
  flags: Record<FlagKey, number>;
};

export function summarizeSegments(classifications: Classification[]): SegmentSummary {
  const total = classifications.length;
  const stages = Object.fromEntries(
    STAGE_KEYS.map((k) => [k, { count: 0, pct: 0 }]),
  ) as SegmentSummary["stages"];
  const flags = Object.fromEntries(FLAG_KEYS.map((k) => [k, 0])) as SegmentSummary["flags"];

  for (const c of classifications) {
    stages[c.stage].count++;
    if (c.flags.recompense_prete) flags.recompense_prete++;
    if (c.flags.joignable_push) flags.joignable_push++;
  }
  for (const k of STAGE_KEYS) {
    stages[k].pct = total ? Math.round((stages[k].count / total) * 100) : 0;
  }
  return { total, stages, flags };
}
```

- [ ] **Step 4: Vérifier le succès** — Run: `npm test -- summary` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/segments/summary.ts src/lib/segments/__tests__/summary.test.ts
git commit -m "feat(segments): summarize stage counts, percentages and flag totals"
```

---

### Task 6: `fetch.ts` — branchement Supabase (scoping marchand)

**Files:**
- Create: `src/lib/segments/fetch.ts`

> Pas de test unitaire (touche la DB) — vérifié par `npm run build`. La logique pure qu'il appelle est déjà testée.

- [ ] **Step 1: Implémenter**

```ts
import { createClient } from "@/utils/supabase/server";
import { tallyScansByCard } from "./scans";
import { buildCustomerStats, type CustomerRow, type CardRow } from "./stats";
import { classifyCustomer } from "./classify";
import { summarizeSegments, type SegmentSummary } from "./summary";
import { STAGE_KEYS, type StageKey, type CustomerStats, type Classification } from "./types";

type CustomerWithCards = CustomerRow & { loyalty_cards: CardRow[] | null };

export function isStageKey(s: string): s is StageKey {
  return (STAGE_KEYS as readonly string[]).includes(s);
}

// Charge tous les clients du marchand + agrège + classe. RLS limite déjà au marchand connecté.
async function loadClassified(merchantId: string): Promise<{ stats: CustomerStats; cls: Classification }[]> {
  const supabase = await createClient();
  const [{ data: customers }, { data: scans }] = await Promise.all([
    supabase
      .from("customers")
      .select("id, full_name, created_at, loyalty_cards(id, stamps_count, last_scan)")
      .eq("merchant_id", merchantId),
    supabase.from("scan_history").select("card_id").eq("merchant_id", merchantId),
  ]);

  const list = (customers ?? []) as CustomerWithCards[];
  const scanCounts = tallyScansByCard((scans ?? []) as { card_id: string }[]);

  const cardIds = list.flatMap((c) => (c.loyalty_cards ?? []).map((k) => k.id));
  let reachable = new Set<string>();
  if (cardIds.length) {
    const { data: regs } = await supabase
      .from("wallet_device_registrations")
      .select("serial_number")
      .in("serial_number", cardIds);
    reachable = new Set((regs ?? []).map((r) => r.serial_number as string));
  }

  const now = new Date();
  return list.map((c) => {
    const stats = buildCustomerStats(c, c.loyalty_cards ?? [], scanCounts, reachable);
    return { stats, cls: classifyCustomer(stats, now) };
  });
}

export async function fetchSegmentCounts(merchantId: string): Promise<SegmentSummary> {
  const rows = await loadClassified(merchantId);
  return summarizeSegments(rows.map((r) => r.cls));
}

export type Member = {
  customerId: string;
  name: string;
  lastScan: string | null;
  visits: number;
  stamps: number;
};

export async function fetchSegmentMembers(merchantId: string, stage: StageKey): Promise<Member[]> {
  const rows = await loadClassified(merchantId);
  return rows
    .filter((r) => r.cls.stage === stage)
    .map((r) => ({
      customerId: r.stats.customerId,
      name: r.stats.name,
      lastScan: r.stats.lastScan ? r.stats.lastScan.toISOString() : null,
      visits: r.stats.visits,
      stamps: r.stats.maxStamps,
    }))
    .sort((a, b) => b.visits - a.visits);
}
```

- [ ] **Step 2: Vérifier le build** — Run: `npm run build` → « Compiled successfully ».

- [ ] **Step 3: Commit**

```bash
git add src/lib/segments/fetch.ts
git commit -m "feat(segments): supabase fetch layer (counts + members, merchant-scoped)"
```

---

### Task 7: Routes API — compteurs & membres

**Files:**
- Create: `src/app/api/segments/route.ts`
- Create: `src/app/api/segments/[segment]/route.ts`

- [ ] **Step 1: Route compteurs**

Create `src/app/api/segments/route.ts`:
```ts
import { NextResponse } from "next/server";
import { currentMerchantId } from "@/lib/analytics/merchant";
import { fetchSegmentCounts } from "@/lib/segments/fetch";

export async function GET() {
  const merchantId = await currentMerchantId();
  if (!merchantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const summary = await fetchSegmentCounts(merchantId);
  return NextResponse.json({ data: summary });
}
```

- [ ] **Step 2: Route membres (params async — Next.js 16)**

Create `src/app/api/segments/[segment]/route.ts`:
```ts
import { NextResponse } from "next/server";
import { currentMerchantId } from "@/lib/analytics/merchant";
import { fetchSegmentMembers, isStageKey } from "@/lib/segments/fetch";

export async function GET(_req: Request, { params }: { params: Promise<{ segment: string }> }) {
  const merchantId = await currentMerchantId();
  if (!merchantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { segment } = await params;
  if (!isStageKey(segment)) return NextResponse.json({ error: "bad segment" }, { status: 400 });
  const members = await fetchSegmentMembers(merchantId, segment);
  return NextResponse.json({ data: members });
}
```

- [ ] **Step 3: Vérifier le build** — Run: `npm run build` → OK (routes `/api/segments` et `/api/segments/[segment]` listées).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/segments/route.ts "src/app/api/segments/[segment]/route.ts"
git commit -m "feat(api): segments counts + members endpoints (merchant-scoped)"
```

---

### Task 8: Route API — export CSV

**Files:**
- Create: `src/app/api/segments/export/csv/route.ts`

- [ ] **Step 1: Implémenter (réutilise `toCsv`)**

Create `src/app/api/segments/export/csv/route.ts`:
```ts
import { type NextRequest } from "next/server";
import { currentMerchantId } from "@/lib/analytics/merchant";
import { fetchSegmentMembers, isStageKey } from "@/lib/segments/fetch";
import { toCsv } from "@/lib/analytics/csv";

export async function GET(req: NextRequest) {
  const merchantId = await currentMerchantId();
  if (!merchantId) return new Response("unauthorized", { status: 401 });
  const segment = req.nextUrl.searchParams.get("segment") ?? "";
  if (!isStageKey(segment)) return new Response("bad segment", { status: 400 });

  const members = await fetchSegmentMembers(merchantId, segment);
  const csv = toCsv(
    ["nom", "derniere_visite", "visites", "tampons"],
    members.map((m) => [m.name, m.lastScan ?? "", m.visits, m.stamps]),
  );
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="segment-${segment}.csv"`,
    },
  });
}
```

- [ ] **Step 2: Vérifier le build** — Run: `npm run build` → OK (route `/api/segments/export/csv` listée).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/segments/export/csv/route.ts
git commit -m "feat(api): per-segment CSV export"
```

---

### Task 9: UI — onglet Segments (vue d'ensemble + drill-down)

**Files:**
- Create: `src/app/dashboard/segments/SegmentsView.tsx`
- Create: `src/app/dashboard/segments/page.tsx`
- Modify: `src/app/dashboard/DashboardShell.tsx` (imports lucide + `navItems`)

- [ ] **Step 1: Composant client `SegmentsView.tsx`**

Create `src/app/dashboard/segments/SegmentsView.tsx`:
```tsx
"use client";
import { useState } from "react";
import { STAGE_FAMILIES, STAGE_LABELS, FLAG_LABELS, type StageKey } from "@/lib/segments/types";
import type { SegmentSummary } from "@/lib/segments/summary";
import type { Member } from "@/lib/segments/fetch";

export function SegmentsView({ summary }: { summary: SegmentSummary }) {
  const [active, setActive] = useState<StageKey | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);

  const open = async (stage: StageKey) => {
    setActive(stage);
    setLoading(true);
    setMembers([]);
    try {
      const res = await fetch(`/api/segments/${stage}`);
      const json = await res.json();
      setMembers(json.data ?? []);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {STAGE_FAMILIES.map((family) => (
        <div key={family.title}>
          <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4">{family.title}</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {family.stages.map((stage) => {
              const s = summary.stages[stage];
              return (
                <button
                  key={stage}
                  onClick={() => open(stage)}
                  className={`text-left bg-zinc-900/40 border rounded-3xl p-6 transition-all hover:border-emerald-500/50 ${
                    active === stage ? "border-emerald-500/70" : "border-zinc-800"
                  }`}
                >
                  <div className="text-sm font-bold text-zinc-300">{STAGE_LABELS[stage]}</div>
                  <div className="text-3xl font-bold mt-2">{s.count}</div>
                  <div className="text-xs text-emerald-400 mt-1">{s.pct} % de la base</div>
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div>
        <h2 className="text-sm font-bold text-zinc-400 uppercase tracking-widest mb-4">Étiquettes</h2>
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="bg-zinc-900/40 border border-zinc-800 rounded-2xl px-4 py-2">
            {FLAG_LABELS.recompense_prete} : <strong>{summary.flags.recompense_prete}</strong>
          </span>
          <span className="bg-zinc-900/40 border border-zinc-800 rounded-2xl px-4 py-2">
            {FLAG_LABELS.joignable_push} : <strong>{summary.flags.joignable_push}</strong>
          </span>
        </div>
      </div>

      {active && (
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold">{STAGE_LABELS[active]} — {members.length} client(s)</h3>
            <a
              href={`/api/segments/export/csv?segment=${active}`}
              className="bg-emerald-500 text-black rounded-xl px-4 py-2 text-sm font-bold"
            >
              Exporter CSV
            </a>
          </div>
          {loading ? (
            <div className="h-24 animate-pulse bg-zinc-800/40 rounded-xl" />
          ) : members.length === 0 ? (
            <p className="text-sm text-zinc-600">Aucun client dans ce groupe.</p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-widest text-zinc-500 border-b border-zinc-800">
                  <th className="py-3">Client</th>
                  <th className="py-3">Dernière visite</th>
                  <th className="py-3">Visites</th>
                  <th className="py-3">Tampons</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.customerId} className="border-b border-zinc-900">
                    <td className="py-3">{m.name}</td>
                    <td className="py-3 text-zinc-400">{m.lastScan ? new Date(m.lastScan).toLocaleDateString() : "—"}</td>
                    <td className="py-3">{m.visits}</td>
                    <td className="py-3">{m.stamps}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Page serveur `page.tsx`**

Create `src/app/dashboard/segments/page.tsx`:
```tsx
import { redirect } from "next/navigation";
import { currentMerchantId } from "@/lib/analytics/merchant";
import { fetchSegmentCounts } from "@/lib/segments/fetch";
import { SegmentsView } from "./SegmentsView";

export const dynamic = "force-dynamic";

export default async function SegmentsPage() {
  const merchantId = await currentMerchantId();
  if (!merchantId) redirect("/login");
  const summary = await fetchSegmentCounts(merchantId);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Segments</h1>
        <p className="text-zinc-500">Votre clientèle, triée automatiquement. {summary.total} client(s).</p>
      </div>
      <SegmentsView summary={summary} />
    </div>
  );
}
```

- [ ] **Step 3: Ajouter l'onglet dans `DashboardShell.tsx`**

In `src/app/dashboard/DashboardShell.tsx`, add `Layers` to the existing `lucide-react` import block (the one ending at line 17, after `ChevronRight`):
```tsx
  ChevronRight,
  Layers
} from "lucide-react";
```

Then in the `navItems` array, insert after the `Clients` entry:
```tsx
    { name: "Clients", icon: Users, href: "/dashboard/customers" },
    { name: "Segments", icon: Layers, href: "/dashboard/segments" },
```

- [ ] **Step 4: Build + fumée** — Run: `npm run build` → OK (route `/dashboard/segments` listée). Puis `npm run dev`, se connecter (`demo@walletcard.app` / `‹DEMO_PASSWORD›`), ouvrir l'onglet **Segments** : les cartes affichent des effectifs ; cliquer un groupe charge la liste ; « Exporter CSV » télécharge le fichier.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/segments/ src/app/dashboard/DashboardShell.tsx
git commit -m "feat(dashboard): Segments tab — overview, drill-down, CSV export"
```

---

### Task 10: Vérification finale

- [ ] **Step 1: Tests** — Run: `npm test` → tous PASS (types, scans, stats, classify, summary + suites existantes).
- [ ] **Step 2: Build** — Run: `npm run build` → « Compiled successfully », routes `/api/segments/**` et `/dashboard/segments` présentes.
- [ ] **Step 3: Lint** — Run: `npm run lint` → pas de nouvelle erreur bloquante.
- [ ] **Step 4: Fumée** — En dev, sur le compte démo : effectifs cohérents (somme des stades = total clients), drill-down OK, export CSV OK, onglet visible dans la barre.

---

## Notes de réalisation

- **TDD** sur toute la logique pure (`tallyScansByCard`, `buildCustomerStats`, `classifyCustomer`, `summarizeSegments`). `fetch.ts`, routes et UI vérifiés par `build` + fumée (comme les modules livrés).
- **Aucune migration** : lecture seule de tables existantes. Zéro risque sur la base partagée.
- **Scoping marchand** : `currentMerchantId()` + RLS sur `customers`/`scan_history`. `wallet_device_registrations` interrogée uniquement sur les `serial_number` (= ids de cartes) du marchand.
- **DRY** : réutilise `toCsv`, `currentMerchantId`, `createClient`.
- **Réutilisation Module 4** : `classifyCustomer` et `fetchSegmentMembers(merchantId, stage)` résoudront « tous les clients du segment X » au moment de l'envoi de campagne.
- **YAGNI** : pas de stockage, pas de seuils configurables, pas de constructeur de règles, pas de graphiques.
```
