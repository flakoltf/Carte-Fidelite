# B1 — Vue d'ensemble / Insights par marchand (admin) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner au super-admin un écran « santé en un écran » par marchand : KPIs 30 j, statut d'activation, segments, mini-courbe de visites, états neuf/à risque.

**Architecture:** Sous-page serveur `…/[id]/insights` qui réutilise les libs analytics/segments existantes (DRY). Une seule brique métier nouvelle, pure et testée : `computeActivation`. Le rendu serveur charge les données (chaque appel en `try/catch` → dégradation « — »), calcule l'activation, et rend des sections HALO. Recharts (client) pour la courbe.

**Tech Stack:** Next.js App Router (server components), Supabase (RLS `is_admin` via session), recharts, Vitest, Tailwind/HALO.

**Spec source:** `docs/superpowers/specs/2026-06-08-admin-b1-merchant-insights-design.md`

---

## File Structure

- **Create** `src/lib/admin/activation.ts` — fonction pure `computeActivation` (statut d'activation). Une responsabilité : déduire les 3 étapes + `isLive`.
- **Create** `src/lib/admin/__tests__/activation.test.ts` — tests TDD de `computeActivation`.
- **Create** `src/app/admin/merchants/[id]/insights/MiniVisitsChart.tsx` — composant client recharts (la courbe seule).
- **Create** `src/app/admin/merchants/[id]/insights/page.tsx` — page serveur : data + activation + layout + états.
- **Modify** `src/app/admin/merchants/[id]/page.tsx` — ajouter un lien « Vue d'ensemble » à côté du lien carte existant.

**Frontière anti-collision :** 100 % territoire admin. Seul fichier existant modifié = `…/[id]/page.tsx` (ajout d'un lien). L'autre agent travaille sur `…/[id]/card/**` — pas sur la fiche elle-même.

---

## Task 1: `computeActivation` (pur, TDD)

**Files:**
- Create: `src/lib/admin/activation.ts`
- Test: `src/lib/admin/__tests__/activation.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/admin/__tests__/activation.test.ts
import { describe, it, expect } from "vitest";
import { computeActivation } from "../activation";

describe("computeActivation", () => {
  it("aucune étape faite → doneCount 0, isLive false", () => {
    const a = computeActivation({ hasCard: false, customerCount: 0, scanCount: 0 });
    expect(a.doneCount).toBe(0);
    expect(a.isLive).toBe(false);
    expect(a.steps.map((s) => s.done)).toEqual([false, false, false]);
  });

  it("toutes les étapes faites → doneCount 3, isLive true", () => {
    const a = computeActivation({ hasCard: true, customerCount: 5, scanCount: 12 });
    expect(a.doneCount).toBe(3);
    expect(a.isLive).toBe(true);
    expect(a.steps.every((s) => s.done)).toBe(true);
  });

  it("partiel (carte seule) → doneCount 1, isLive false", () => {
    const a = computeActivation({ hasCard: true, customerCount: 0, scanCount: 0 });
    expect(a.doneCount).toBe(1);
    expect(a.isLive).toBe(false);
    expect(a.steps.find((s) => s.key === "card")?.done).toBe(true);
    expect(a.steps.find((s) => s.key === "customer")?.done).toBe(false);
  });

  it("expose les 3 étapes attendues dans l'ordre card → customer → scan", () => {
    const a = computeActivation({ hasCard: false, customerCount: 1, scanCount: 0 });
    expect(a.steps.map((s) => s.key)).toEqual(["card", "customer", "scan"]);
    expect(a.steps.find((s) => s.key === "customer")?.done).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/admin/__tests__/activation.test.ts`
Expected: FAIL — `Failed to resolve import "../activation"` / `computeActivation is not a function`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/admin/activation.ts
export type ActivationStep = { key: string; label: string; done: boolean };
export type ActivationStatus = { steps: ActivationStep[]; doneCount: number; isLive: boolean };

/**
 * Déduit le statut d'activation d'un marchand depuis 3 signaux observables.
 * Étape « QR affiché » volontairement écartée (non détectable).
 */
export function computeActivation(input: {
  hasCard: boolean;
  customerCount: number;
  scanCount: number;
}): ActivationStatus {
  const steps: ActivationStep[] = [
    { key: "card", label: "Carte configurée", done: input.hasCard },
    { key: "customer", label: "Premier client inscrit", done: input.customerCount > 0 },
    { key: "scan", label: "Premier scan en caisse", done: input.scanCount > 0 },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  return { steps, doneCount, isLive: doneCount === steps.length };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/admin/__tests__/activation.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/activation.ts src/lib/admin/__tests__/activation.test.ts
git commit -m "feat(admin): computeActivation — statut d'activation marchand (pur, testé)"
```

---

## Task 2: MiniVisitsChart (client)

**Files:**
- Create: `src/app/admin/merchants/[id]/insights/MiniVisitsChart.tsx`

Pattern repris de `src/app/dashboard/_analytics/widgets/VisitsWidget.tsx` (mêmes couleurs/axes), mais reçoit `points` en props (pas de hook data) car le serveur a déjà les données.

- [ ] **Step 1: Create the component**

```tsx
// src/app/admin/merchants/[id]/insights/MiniVisitsChart.tsx
"use client";

import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";
import type { Point } from "@/lib/analytics/visits";

export default function MiniVisitsChart({ points }: { points: Point[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={points}>
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6E7073" }} hide={points.length > 14} />
        <YAxis tick={{ fontSize: 10, fill: "#6E7073" }} width={28} allowDecimals={false} />
        <Tooltip contentStyle={{ background: "#FFFFFF", border: "1px solid #E6E1D5", borderRadius: 12 }} />
        <Line type="monotone" dataKey="value" stroke="#0D6B5E" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: no error referencing `MiniVisitsChart.tsx`.

- [ ] **Step 3: Commit**

```bash
git add "src/app/admin/merchants/[id]/insights/MiniVisitsChart.tsx"
git commit -m "feat(admin): MiniVisitsChart — courbe visites 30j (client recharts)"
```

---

## Task 3: Page serveur insights

**Files:**
- Create: `src/app/admin/merchants/[id]/insights/page.tsx`

Réutilise : `fetchKpis(id, "30j")` (`@/lib/analytics/kpis` → `KpisData { totalCustomers, newCustomers, visits, activeCustomers, completedCards, activeRate }`), `fetchVisits(id, "30j")` (`@/lib/analytics/visits` → `Point[]`), `fetchSegmentCounts(id)` (`@/lib/segments/fetch` → `SegmentSummary { total, stages: Record<StageKey,{count,pct}>, flags }`), `STAGE_STYLE`/`LEGEND_ORDER` (`@/lib/segments/stageStyle`), `computeActivation` (Task 1). Garde UUID + `role` reprise de `…/[id]/card/page.tsx`. RLS `is_admin` via session (`createClient`), `merchantId` pris de l'URL (indépendant de l'impersonation).

> ⚠️ ESLint `react/no-unescaped-entities` : toutes les apostrophes dans le JSX **texte** sont écrites `&apos;` (cf. le reste de l'admin). Respecter ça dans le code ci-dessous.

- [ ] **Step 1: Create the page**

```tsx
// src/app/admin/merchants/[id]/insights/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Check, X } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { fetchKpis } from "@/lib/analytics/kpis";
import { fetchVisits, type Point } from "@/lib/analytics/visits";
import { fetchSegmentCounts } from "@/lib/segments/fetch";
import { STAGE_STYLE, LEGEND_ORDER } from "@/lib/segments/stageStyle";
import { computeActivation, type ActivationStatus } from "@/lib/admin/activation";
import MiniVisitsChart from "./MiniVisitsChart";

export const dynamic = "force-dynamic";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function MerchantInsightsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();
  const { data: m } = await supabase
    .from("merchants")
    .select("id, shop_name, role")
    .eq("id", id)
    .maybeSingle();
  if (!m || m.role !== "merchant") notFound();

  // Inputs d'activation (tout-temps) — comptes directs, dégradation propre.
  let hasCard = false;
  let customerCount = 0;
  let scanCount = 0;
  try {
    const [cardRes, custRes, scanRes] = await Promise.all([
      supabase.from("card_designs").select("merchant_id", { count: "exact", head: true }).eq("merchant_id", id),
      supabase.from("customers").select("id", { count: "exact", head: true }).eq("merchant_id", id),
      supabase.from("scan_history").select("id", { count: "exact", head: true }).eq("merchant_id", id),
    ]);
    hasCard = (cardRes.count ?? 0) > 0;
    customerCount = custRes.count ?? 0;
    scanCount = scanRes.count ?? 0;
  } catch {
    // comptes indisponibles → activation partielle, jamais de page blanche
  }

  const activation = computeActivation({ hasCard, customerCount, scanCount });

  // Métriques réutilisées (chacune dégrade indépendamment).
  const kpis = await fetchKpis(id, "30j").catch(() => null);
  const segments = await fetchSegmentCounts(id).catch(() => null);
  const visits: Point[] = await fetchVisits(id, "30j").catch(() => []);

  const notLive = customerCount === 0 && scanCount === 0;
  const riskShare =
    segments && segments.total > 0
      ? (segments.stages.inactif.count + segments.stages.en_train_de_partir.count) / segments.total
      : 0;
  const atRisk = !notLive && ((kpis?.visits === 0) || riskShare > 0.5);

  const num = (n: number | undefined) => (n === undefined ? "—" : String(n));

  return (
    <div className="space-y-8">
      <div>
        <Link
          href={`/admin/merchants/${id}`}
          className="inline-flex items-center gap-2 text-sm text-galet-ink hover:text-onyx mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour au marchand
        </Link>
        <h1 className="font-display text-3xl text-onyx tracking-tight">Vue d&apos;ensemble</h1>
        <p className="text-galet-ink">{m.shop_name}</p>
      </div>

      {atRisk && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-700 rounded-2xl px-4 py-3 text-sm">
          Activité en baisse sur 30 jours — ce marchand mérite un suivi.
        </div>
      )}

      {notLive ? (
        <section className="bg-surface border border-line-warm rounded-3xl p-6 shadow-sm">
          <h2 className="font-bold text-onyx mb-1">Activation</h2>
          <p className="text-sm text-galet-ink mb-5">Ce marchand n&apos;est pas encore opérationnel.</p>
          <ActivationChecklist activation={activation} />
        </section>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiTile label="Clients" value={num(kpis?.totalCustomers)} />
            <KpiTile label="Visites 30 j" value={num(kpis?.visits)} />
            <KpiTile label="% actifs" value={kpis ? `${kpis.activeRate}%` : "—"} />
            <KpiTile label="Cartes complétées" value={num(kpis?.completedCards)} />
          </div>

          <div className="grid gap-8 lg:grid-cols-2">
            <section className="bg-surface border border-line-warm rounded-3xl p-6 shadow-sm">
              <h2 className="font-bold text-onyx mb-4">Activation</h2>
              <ActivationChecklist activation={activation} />
            </section>

            <section className="bg-surface border border-line-warm rounded-3xl p-6 shadow-sm">
              <h2 className="font-bold text-onyx mb-4">Segments</h2>
              {segments && segments.total > 0 ? (
                <ul className="space-y-2">
                  {LEGEND_ORDER.map((k) => (
                    <li key={k} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: STAGE_STYLE[k].color }} />
                        <span className="text-galet-ink">{STAGE_STYLE[k].label}</span>
                      </span>
                      <span className="font-medium text-onyx">{segments.stages[k].count}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-galet">—</p>
              )}
            </section>
          </div>

          <section className="bg-surface border border-line-warm rounded-3xl p-6 shadow-sm">
            <h2 className="font-bold text-onyx mb-4">Visites — 30 derniers jours</h2>
            {visits.length > 0 ? <MiniVisitsChart points={visits} /> : <p className="text-sm text-galet">—</p>}
          </section>
        </>
      )}
    </div>
  );
}

function KpiTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface border border-line-warm rounded-3xl p-5 shadow-sm">
      <div className="text-xs text-galet-ink mb-1">{label}</div>
      <div className="text-3xl font-bold text-onyx">{value}</div>
    </div>
  );
}

function ActivationChecklist({ activation }: { activation: ActivationStatus }) {
  return (
    <div className="space-y-3">
      <div className="text-sm text-galet-ink">
        {activation.doneCount}/{activation.steps.length} étapes
      </div>
      <ul className="space-y-2">
        {activation.steps.map((s) => (
          <li key={s.key} className="flex items-center gap-2 text-sm">
            {s.done ? (
              <Check className="w-4 h-4 text-halo shrink-0" />
            ) : (
              <X className="w-4 h-4 text-galet shrink-0" />
            )}
            <span className={s.done ? "text-onyx" : "text-galet-ink"}>{s.label}</span>
          </li>
        ))}
      </ul>
      {activation.isLive && <div className="text-xs text-halo font-medium">✓ Marchand opérationnel</div>}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint "src/app/admin/merchants/[id]/insights/**"`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add "src/app/admin/merchants/[id]/insights/page.tsx"
git commit -m "feat(admin): page insights marchand (KPIs, activation, segments, visites, états)"
```

---

## Task 4: Lien « Vue d'ensemble » dans la fiche marchand

**Files:**
- Modify: `src/app/admin/merchants/[id]/page.tsx`

Le lien carte existant ressemble à :

```tsx
        <Link
          href={`/admin/merchants/${m.id}/card`}
          className="inline-flex items-center gap-2 mt-4 bg-halo text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-halo-600 transition-colors"
        >
          <CreditCard className="w-4 h-4" />
          Personnaliser la carte
        </Link>
```

- [ ] **Step 1: Ajouter l'icône à l'import lucide**

Repérer l'import existant `import { ArrowLeft, CreditCard } from "lucide-react";` et le remplacer par :

```tsx
import { ArrowLeft, CreditCard, BarChart3 } from "lucide-react";
```

- [ ] **Step 2: Encapsuler les deux liens dans un conteneur flex**

Remplacer le bloc du lien carte ci-dessus par :

```tsx
        <div className="flex flex-wrap items-center gap-3 mt-4">
          <Link
            href={`/admin/merchants/${m.id}/insights`}
            className="inline-flex items-center gap-2 bg-surface border border-line-warm text-onyx text-sm font-medium px-4 py-2 rounded-xl hover:bg-calcaire transition-colors"
          >
            <BarChart3 className="w-4 h-4" />
            Vue d&apos;ensemble
          </Link>
          <Link
            href={`/admin/merchants/${m.id}/card`}
            className="inline-flex items-center gap-2 bg-halo text-white text-sm font-medium px-4 py-2 rounded-xl hover:bg-halo-600 transition-colors"
          >
            <CreditCard className="w-4 h-4" />
            Personnaliser la carte
          </Link>
        </div>
```

> Note : retirer le `mt-4` de l'ancien `<Link>` carte (déplacé sur le conteneur `<div>`).

- [ ] **Step 3: Typecheck + lint**

Run: `npx tsc --noEmit && npx eslint "src/app/admin/merchants/[id]/page.tsx"`
Expected: aucune erreur.

- [ ] **Step 4: Commit**

```bash
git add "src/app/admin/merchants/[id]/page.tsx"
git commit -m "feat(admin): lien Vue d'ensemble dans la fiche marchand"
```

---

## Task 5: Vérification end-to-end

- [ ] **Step 1: Tests unitaires**

Run: `npx vitest run src/lib/admin/__tests__/activation.test.ts`
Expected: PASS.

- [ ] **Step 2: Suite complète (non-régression)**

Run: `npx vitest run`
Expected: tout vert.

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: « ✓ Compiled successfully » et la route `ƒ /admin/merchants/[id]/insights` listée.

- [ ] **Step 4: Rendu authentifié (comme A2)**

Démarrer le dev sur un port libre, se connecter en admin démo, puis GET la page :

```bash
# 1) (si besoin) réinitialiser le mot de passe admin démo — exécuté par l'utilisateur :
#    DEMO_ADMIN_PASSWORD='...' node scripts/reset-demo-admin-password.mjs
# 2) login → cookie, puis GET insights d'un marchand existant
```

Expected : HTTP 200 et présence des marqueurs « Vue d'ensemble », « Activation », « Clients », et au moins un libellé de segment (ex. « Régulier »). Pour un marchand neuf (0 client / 0 scan) : le message « Ce marchand n'est pas encore opérationnel » apparaît et les graphes sont masqués.

- [ ] **Step 5: Vérif navigateur**

Ouvrir `/admin/merchants` → un marchand avec données → « Vue d'ensemble » : KPIs + segments + courbe. Puis un marchand neuf : état d'activation mis en avant.

---

## Self-Review (effectuée)

- **Couverture spec** : placement/garde (T3), réutilisation données KPIs/segments/visites (T3), `computeActivation` pur+testé (T1), MiniVisitsChart (T2), mise en page 4 KPI + checklist + segments + courbe (T3), états neuf/à risque (T3), lien d'accès (T4), tests + build + rendu authentifié (T5). ✅
- **Pas de placeholder** : tout le code est complet (activation, chart, page, lien).
- **Cohérence des types** : `ActivationStatus`/`ActivationStep` (T1) réutilisés en T3 ; `Point` importé de `@/lib/analytics/visits` ; `KpisData`/`SegmentSummary`/`STAGE_STYLE`/`LEGEND_ORDER` consommés avec leurs vrais noms (vérifiés dans le code source).
- **Anti-collision** : un seul fichier existant modifié (`…/[id]/page.tsx`, ajout de lien).
