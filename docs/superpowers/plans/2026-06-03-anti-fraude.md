# Idempotence + cooldown + anti-fraude — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corriger l'idempotence du scan (un vrai 2e achat est compté), ajouter un délai minimum réglable par carte (anti-spam, réglé par l'admin), et détecter/signaler les activités anormales côté marchand et admin.

**Architecture:** Pures testées (`withinCooldown`, `maxInWindow`, `evaluateSignals`) + extension de la config marchand existante (`scanCooldownSeconds` dans `segment_config`). Le scanner envoie une clé d'idempotence unique ; la route scan applique le cooldown. La détection lit `scan_history`/`audit_logs`/`customers` (7 j) et s'affiche en lecture seule sur `/dashboard/security` (marchand) et dans `/admin`. Aucune migration BDD.

**Tech Stack:** Next.js 16 · React 19 · TypeScript · Supabase (`supabaseAdmin`) · Tailwind v4 · Vitest · lucide-react.

**Spec:** `docs/superpowers/specs/2026-06-03-anti-fraude-design.md`

---

## File Structure

```
src/lib/loyalty/cooldown.ts                     # NEW — withinCooldown (PUR, testé)
src/lib/loyalty/__tests__/cooldown.test.ts      # NEW
src/lib/merchant-config/types.ts                # MODIFY — DEFAULT_SCAN_COOLDOWN_SECONDS + champ scanCooldownSeconds
src/lib/merchant-config/resolve.ts              # MODIFY — lit scan_cooldown_seconds
src/lib/merchant-config/validate.ts             # MODIFY — valide scanCooldownSeconds → segmentConfig
src/lib/merchant-config/__tests__/resolve.test.ts   # MODIFY — attendus + nouveau cas
src/lib/merchant-config/__tests__/validate.test.ts  # MODIFY — attendus + bornes
src/app/admin/merchants/[id]/EditMerchantForm.tsx   # MODIFY — champ cooldown
src/app/admin/merchants/[id]/page.tsx               # MODIFY — passe scanCooldownSeconds au form
src/app/api/scan/route.ts                       # MODIFY — cooldown enforcement
src/app/scan/page.tsx                           # MODIFY — clé idempotence unique
src/lib/antifraud/config.ts                     # NEW — règles/seuils centralisés
src/lib/antifraud/detect.ts                     # NEW — maxInWindow + evaluateSignals (PUR, testé)
src/lib/antifraud/__tests__/detect.test.ts      # NEW
src/lib/antifraud/fetch.ts                      # NEW — fetchMerchantFlags + fetchAllMerchantsWithFlags
src/app/dashboard/security/page.tsx             # NEW — panneau marchand
src/app/dashboard/DashboardShell.tsx            # MODIFY — entrée nav « Sécurité »
src/app/admin/page.tsx                          # MODIFY — section alertes
```

> ⚠️ L'utilisateur retravaille en parallèle le dashboard (« HALO Light »). Les seuls edits hors fichiers neufs : `DashboardShell.tsx` (1 ligne nav), `admin/page.tsx`, `EditMerchantForm.tsx`, scan route/page, config. Aucun de ces fichiers n'est dans sa refonte en cours (analytics/dashboard page).

---

## Task 1: `withinCooldown` (PUR, TDD)

**Files:** Test `src/lib/loyalty/__tests__/cooldown.test.ts` · Create `src/lib/loyalty/cooldown.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { withinCooldown } from "../cooldown";

const now = new Date("2026-06-03T12:00:00Z");
const secAgo = (s: number) => new Date(now.getTime() - s * 1000).toISOString();

describe("withinCooldown", () => {
  it("désactivé quand cooldown <= 0", () => {
    expect(withinCooldown(secAgo(1), now, 0)).toBe(false);
  });
  it("faux quand lastScan est null", () => {
    expect(withinCooldown(null, now, 30)).toBe(false);
  });
  it("vrai quand scanné il y a 10 s (cooldown 30)", () => {
    expect(withinCooldown(secAgo(10), now, 30)).toBe(true);
  });
  it("faux quand scanné il y a 40 s (cooldown 30)", () => {
    expect(withinCooldown(secAgo(40), now, 30)).toBe(false);
  });
  it("faux exactement à la limite (30 s, cooldown 30)", () => {
    expect(withinCooldown(secAgo(30), now, 30)).toBe(false);
  });
});
```

- [ ] **Step 2: Run → FAIL** — `npx vitest run src/lib/loyalty/__tests__/cooldown.test.ts` (import introuvable).

- [ ] **Step 3: Implement** `src/lib/loyalty/cooldown.ts`

```typescript
// Vrai si la carte a été scannée il y a moins de `cooldownSeconds`. 0 = désactivé.
export function withinCooldown(lastScan: string | null, now: Date, cooldownSeconds: number): boolean {
  if (cooldownSeconds <= 0 || !lastScan) return false;
  return now.getTime() - new Date(lastScan).getTime() < cooldownSeconds * 1000;
}
```

- [ ] **Step 4: Run → PASS** (5 tests).
- [ ] **Step 5: Commit**

```bash
git add src/lib/loyalty/cooldown.ts src/lib/loyalty/__tests__/cooldown.test.ts
git commit -m "feat(loyalty): pure withinCooldown with tests"
```

---

## Task 2: Config marchand — `scanCooldownSeconds`

**Files:** Modify `types.ts`, `resolve.ts`, `validate.ts`, et leurs 2 tests.

- [ ] **Step 1: Mettre à jour les tests existants (ils vont échouer)**

Dans `src/lib/merchant-config/__tests__/resolve.test.ts`, le cas « config pleine » doit inclure le nouveau champ. Remplacer son `expect` par :
```typescript
    expect(r).toEqual({ stampGoal: 12, scanCooldownSeconds: 30, thresholds: { activeDays: 14, atRiskDays: 45, vipVisits: 6, newTenureDays: 7 } });
```
Et ajouter un cas :
```typescript
  it("lit scan_cooldown_seconds depuis segment_config", () => {
    const r = resolveMerchantConfig({ stamp_goal: 10, segment_config: { scan_cooldown_seconds: 45 } });
    expect(r.scanCooldownSeconds).toBe(45);
  });
```

Dans `src/lib/merchant-config/__tests__/validate.test.ts`, le cas « entrée valide » : remplacer l'attendu `segmentConfig` par :
```typescript
      expect(r.value.segmentConfig).toEqual({ active_days: 30, at_risk_days: 90, vip_visits: 10, new_tenure_days: 30, scan_cooldown_seconds: 30 });
```
Et ajouter un cas :
```typescript
  it("scanCooldownSeconds : défaut 30 si absent, bornes 0–600", () => {
    expect(validateMerchantConfig(base).ok).toBe(true); // absent → 30
    const r = validateMerchantConfig({ ...base, scanCooldownSeconds: 45 });
    expect(r.ok && r.value.segmentConfig.scan_cooldown_seconds).toBe(45);
    expect(validateMerchantConfig({ ...base, scanCooldownSeconds: -1 }).ok).toBe(false);
    expect(validateMerchantConfig({ ...base, scanCooldownSeconds: 601 }).ok).toBe(false);
    expect(validateMerchantConfig({ ...base, scanCooldownSeconds: 0 }).ok).toBe(true);
  });
```

Run `npx vitest run src/lib/merchant-config` → FAIL (champ inexistant).

- [ ] **Step 2: `types.ts`** — ajouter la constante, le champ au type et au défaut.

Ajouter après `DEFAULT_STAMP_GOAL` :
```typescript
export const DEFAULT_SCAN_COOLDOWN_SECONDS = 30;
```
Dans `ResolvedMerchantConfig`, ajouter `scanCooldownSeconds: number;` :
```typescript
export type ResolvedMerchantConfig = {
  stampGoal: number;
  scanCooldownSeconds: number;
  thresholds: ResolvedSegmentThresholds;
};
```
Dans `DEFAULT_MERCHANT_CONFIG`, ajouter `scanCooldownSeconds: DEFAULT_SCAN_COOLDOWN_SECONDS,` :
```typescript
export const DEFAULT_MERCHANT_CONFIG: ResolvedMerchantConfig = {
  stampGoal: DEFAULT_STAMP_GOAL,
  scanCooldownSeconds: DEFAULT_SCAN_COOLDOWN_SECONDS,
  thresholds: DEFAULT_THRESHOLDS,
};
```

- [ ] **Step 3: `resolve.ts`** — lire le champ. Ajouter l'import `DEFAULT_SCAN_COOLDOWN_SECONDS` et la ligne :

```typescript
import { DEFAULT_STAMP_GOAL, DEFAULT_SCAN_COOLDOWN_SECONDS, DEFAULT_THRESHOLDS, type ResolvedMerchantConfig } from "./types";
```
Dans l'objet retourné, ajouter après `stampGoal` :
```typescript
    scanCooldownSeconds: num(sc.scan_cooldown_seconds, DEFAULT_SCAN_COOLDOWN_SECONDS),
```

- [ ] **Step 4: `validate.ts`** — valider et persister.

Dans `MerchantConfigInput`, ajouter `scanCooldownSeconds?: unknown;`.
Dans `ValidatedMerchantConfig`, étendre `segmentConfig` : `scan_cooldown_seconds: number`.
Avant le `return { ok: true, ... }`, ajouter la validation (défaut 30) :
```typescript
  const cd = input.scanCooldownSeconds === undefined ? 30 : input.scanCooldownSeconds;
  if (!isInt(cd) || cd < 0 || cd > 600)
    return { ok: false, error: "Délai mini invalide (0 à 600 s)." };
```
Et dans le `segmentConfig` retourné, ajouter `scan_cooldown_seconds: cd,`.

- [ ] **Step 5: Run → PASS** — `npx vitest run src/lib/merchant-config` (tous verts).
- [ ] **Step 6: Commit**

```bash
git add src/lib/merchant-config/
git commit -m "feat(config): merchant-configurable scan cooldown (segment_config)"
```

---

## Task 3: UI admin — champ cooldown

**Files:** Modify `EditMerchantForm.tsx`, `[id]/page.tsx`.

- [ ] **Step 1: `[id]/page.tsx`** — passer la valeur au form. Dans l'objet `merchant={{...}}` passé à `EditMerchantForm`, ajouter après `stampGoal: cfg.stampGoal,` :
```typescript
            scanCooldownSeconds: cfg.scanCooldownSeconds,
```

- [ ] **Step 2: `EditMerchantForm.tsx`** — étendre Props, state, payload, et ajouter le champ.

(a) Dans `Props.merchant`, ajouter `scanCooldownSeconds: number;` (après `stampGoal`).
(b) Ajouter un state : `const [scanCooldownSeconds, setScanCooldownSeconds] = useState(merchant.scanCooldownSeconds);` (sous `stampGoal`).
(c) Dans le `body: JSON.stringify({...})` du `save`, ajouter `scanCooldownSeconds,` (à côté de `stampGoal`).
(d) Dans la grille `Programme & segmentation`, ajouter un champ (après le bloc « Objectif carte ») :
```tsx
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-400 ml-1">Délai mini entre 2 tampons (s)</label>
          <input type="number" min={0} max={600} value={scanCooldownSeconds}
            onChange={(e) => setScanCooldownSeconds(Number(e.target.value))} className={numInput} />
        </div>
```

- [ ] **Step 3: Vérifier** — `npx tsc --noEmit` (ignorer passJson) + `npm run build`. La route `PATCH /api/admin/merchants/[id]` persiste déjà via `validateMerchantConfig` → `segment_config` (aucune modif route).
- [ ] **Step 4: Commit**

```bash
git add "src/app/admin/merchants/[id]/EditMerchantForm.tsx" "src/app/admin/merchants/[id]/page.tsx"
git commit -m "feat(admin-ui): per-merchant scan cooldown field"
```

---

## Task 4: Scan — idempotence unique + cooldown

**Files:** Modify `src/app/api/scan/route.ts`, `src/app/scan/page.tsx`.

- [ ] **Step 1: Route scan** — importer `withinCooldown`, lire la config complète, appliquer le cooldown.

Ajouter l'import en tête :
```typescript
import { withinCooldown } from "@/lib/loyalty/cooldown";
```
Remplacer le bloc « 2. Règle de comptage » (la ligne `const { stampGoal } = await fetchMerchantConfig(merchant.id);`) par :
```typescript
    // 2. Config marchand + anti-spam (délai mini entre 2 tampons sur la même carte)
    const cfg = await fetchMerchantConfig(merchant.id);
    if (withinCooldown(card.last_scan, new Date(), cfg.scanCooldownSeconds)) {
      return NextResponse.json(
        { error: "Carte déjà scannée à l'instant. Patientez quelques secondes.", cooldown: true },
        { status: 429 }
      );
    }
    const { newStamps, rewardReady, added } = applyStamp(card.stamps_count, cfg.stampGoal);
```
(Le reste — `if (!added)` renvoie toujours `stampGoal: cfg.stampGoal` : remplacer `stampGoal` par `cfg.stampGoal` dans les deux réponses `NextResponse.json({... stampGoal ...})`. C'est-à-dire `stampGoal: cfg.stampGoal` aux lignes de réponse.)

Concrètement, dans la réponse `if (!added)` et dans la réponse finale, remplacer `stampGoal,` par `stampGoal: cfg.stampGoal,`.

- [ ] **Step 2: Scanner** — clé d'idempotence unique par scan. Dans `src/app/scan/page.tsx`, `handleProcessScan`, modifier l'appel fetch :
```typescript
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json", "idempotency-key": crypto.randomUUID() },
        body: JSON.stringify({ cardId })
      });
```

- [ ] **Step 3: Vérifier** — `npx tsc --noEmit` (ignorer passJson) + `npx vitest run` (verts) + `npm run build`.
- [ ] **Step 4: Commit**

```bash
git add src/app/api/scan/route.ts src/app/scan/page.tsx
git commit -m "fix(scan): unique idempotency key (legit repeat scans) + per-card cooldown"
```

---

## Task 5: Moteur de détection (PUR, TDD)

**Files:** Create `src/lib/antifraud/config.ts`, `src/lib/antifraud/detect.ts`, test `src/lib/antifraud/__tests__/detect.test.ts`.

- [ ] **Step 1: Constantes** `src/lib/antifraud/config.ts`

```typescript
export const FRAUD_RULES = {
  scanBurst:   { windowMs: 5 * 60_000,  threshold: 20, label: "Scans en rafale",                windowLabel: "5 min" },
  redeemBurst: { windowMs: 10 * 60_000, threshold: 5,  label: "Encaissements en rafale",        windowLabel: "10 min" },
  enrollBurst: { windowMs: 5 * 60_000,  threshold: 15, label: "Inscriptions en rafale",         windowLabel: "5 min" },
  cardFarming: { windowMs: 30 * 60_000, threshold: 4,  label: "Carte tamponnée trop souvent",   windowLabel: "30 min" },
} as const;

export const FRAUD_LOOKBACK_DAYS = 7;
```

- [ ] **Step 2: Write the failing test** `src/lib/antifraud/__tests__/detect.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { maxInWindow, evaluateSignals } from "../detect";

const t0 = 1_000_000_000_000;
const min = (m: number) => t0 + m * 60_000;

describe("maxInWindow", () => {
  it("liste vide → 0", () => { expect(maxInWindow([], 60_000)).toBe(0); });
  it("tous dans la fenêtre → n", () => { expect(maxInWindow([t0, t0 + 1000, t0 + 2000], 60_000)).toBe(3); });
  it("étalés hors fenêtre → 1", () => { expect(maxInWindow([min(0), min(10), min(20)], 60_000)).toBe(1); });
  it("rafale au milieu → le pic", () => {
    expect(maxInWindow([min(0), min(30), min(30) + 1000, min(30) + 2000, min(60)], 5 * 60_000)).toBe(3);
  });
});

describe("evaluateSignals", () => {
  it("aucun signal → []", () => {
    expect(evaluateSignals({ scans: [], redemptions: [], enrollments: [] })).toEqual([]);
  });
  it("flag scan_burst si > 20 scans en 5 min", () => {
    const scans = Array.from({ length: 21 }, (_, i) => ({ cardId: `c${i}`, at: t0 + i * 1000 }));
    const flags = evaluateSignals({ scans, redemptions: [], enrollments: [] });
    expect(flags.some((f) => f.kind === "scan_burst" && f.count === 21)).toBe(true);
  });
  it("flag card_farming pour la carte au-delà du seuil seulement", () => {
    const scans = [
      ...Array.from({ length: 5 }, (_, i) => ({ cardId: "spam", at: t0 + i * 1000 })),
      { cardId: "ok", at: t0 },
    ];
    const flags = evaluateSignals({ scans, redemptions: [], enrollments: [] });
    const farm = flags.filter((f) => f.kind === "card_farming");
    expect(farm).toHaveLength(1);
    expect(farm[0].cardId).toBe("spam");
  });
  it("pas de flag si pile au seuil (20 scans)", () => {
    const scans = Array.from({ length: 20 }, (_, i) => ({ cardId: `c${i}`, at: t0 + i * 1000 }));
    expect(evaluateSignals({ scans, redemptions: [], enrollments: [] }).some((f) => f.kind === "scan_burst")).toBe(false);
  });
});
```

Run → FAIL.

- [ ] **Step 3: Implement** `src/lib/antifraud/detect.ts`

```typescript
import { FRAUD_RULES } from "./config";

// Nombre max d'évènements tombant dans une même fenêtre glissante de `windowMs`.
export function maxInWindow(timestamps: number[], windowMs: number): number {
  if (timestamps.length === 0) return 0;
  const ts = [...timestamps].sort((a, b) => a - b);
  let max = 1, start = 0;
  for (let end = 0; end < ts.length; end++) {
    while (ts[end] - ts[start] >= windowMs) start++;
    max = Math.max(max, end - start + 1);
  }
  return max;
}

export type Flag = { kind: string; label: string; count: number; threshold: number; windowLabel: string; cardId?: string };
export type SignalsInput = {
  scans: { cardId: string; at: number }[];
  redemptions: { at: number }[];
  enrollments: { at: number }[];
};

export function evaluateSignals(input: SignalsInput): Flag[] {
  const flags: Flag[] = [];
  const r = FRAUD_RULES;

  const check = (kind: string, rule: { windowMs: number; threshold: number; label: string; windowLabel: string }, times: number[]) => {
    const peak = maxInWindow(times, rule.windowMs);
    if (peak > rule.threshold)
      flags.push({ kind, label: rule.label, count: peak, threshold: rule.threshold, windowLabel: rule.windowLabel });
  };

  check("scan_burst", r.scanBurst, input.scans.map((s) => s.at));
  check("redeem_burst", r.redeemBurst, input.redemptions.map((s) => s.at));
  check("enroll_burst", r.enrollBurst, input.enrollments.map((s) => s.at));

  const byCard = new Map<string, number[]>();
  for (const s of input.scans) {
    const arr = byCard.get(s.cardId) ?? [];
    arr.push(s.at);
    byCard.set(s.cardId, arr);
  }
  for (const [cardId, times] of byCard) {
    const peak = maxInWindow(times, r.cardFarming.windowMs);
    if (peak > r.cardFarming.threshold)
      flags.push({ kind: "card_farming", label: r.cardFarming.label, count: peak, threshold: r.cardFarming.threshold, windowLabel: r.cardFarming.windowLabel, cardId });
  }

  return flags;
}
```

- [ ] **Step 4: Run → PASS** (8 tests).
- [ ] **Step 5: Commit**

```bash
git add src/lib/antifraud/config.ts src/lib/antifraud/detect.ts src/lib/antifraud/__tests__/detect.test.ts
git commit -m "feat(antifraud): pure detection engine (maxInWindow + evaluateSignals)"
```

---

## Task 6: Couche fetch des signaux

**Files:** Create `src/lib/antifraud/fetch.ts`.

- [ ] **Step 1: Écrire les helpers DB**

```typescript
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { evaluateSignals, type Flag } from "./detect";
import { FRAUD_LOOKBACK_DAYS } from "./config";

const DAY_MS = 86_400_000;

export async function fetchMerchantFlags(merchantId: string): Promise<Flag[]> {
  const sinceIso = new Date(Date.now() - FRAUD_LOOKBACK_DAYS * DAY_MS).toISOString();
  const [{ data: scans }, { data: redemptions }, { data: enrollments }] = await Promise.all([
    supabaseAdmin.from("scan_history").select("card_id, scanned_at").eq("merchant_id", merchantId).gte("scanned_at", sinceIso),
    supabaseAdmin.from("audit_logs").select("created_at").eq("merchant_id", merchantId).eq("action", "REWARD_REDEEMED").gte("created_at", sinceIso),
    supabaseAdmin.from("customers").select("created_at").eq("merchant_id", merchantId).gte("created_at", sinceIso),
  ]);
  return evaluateSignals({
    scans: (scans ?? []).map((s) => ({ cardId: s.card_id as string, at: new Date(s.scanned_at as string).getTime() })),
    redemptions: (redemptions ?? []).map((r) => ({ at: new Date(r.created_at as string).getTime() })),
    enrollments: (enrollments ?? []).map((e) => ({ at: new Date(e.created_at as string).getTime() })),
  });
}

export type MerchantFlags = { merchantId: string; shopName: string; flags: Flag[] };

export async function fetchAllMerchantsWithFlags(): Promise<MerchantFlags[]> {
  const { data: merchants } = await supabaseAdmin.from("merchants").select("id, shop_name").eq("role", "merchant");
  const results: MerchantFlags[] = [];
  for (const m of merchants ?? []) {
    const flags = await fetchMerchantFlags(m.id as string);
    if (flags.length) results.push({ merchantId: m.id as string, shopName: (m.shop_name as string) ?? "—", flags });
  }
  return results;
}
```

- [ ] **Step 2: Vérifier** — `npx tsc --noEmit` (ignorer passJson).
- [ ] **Step 3: Commit**

```bash
git add src/lib/antifraud/fetch.ts
git commit -m "feat(antifraud): signal fetch (merchant + all-merchants flags)"
```

---

## Task 7: Page marchand `/dashboard/security` + nav

**Files:** Create `src/app/dashboard/security/page.tsx` · Modify `src/app/dashboard/DashboardShell.tsx`.

- [ ] **Step 1: Page**

```typescript
import { createClient } from "@/utils/supabase/server";
import { fetchMerchantFlags } from "@/lib/antifraud/fetch";
import { ShieldAlert, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SecurityPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: merchant } = await supabase.from("merchants").select("id").eq("user_id", user?.id).single();
  if (!merchant) return <p className="text-zinc-500">Aucun profil marchand associé à ce compte.</p>;

  const flags = await fetchMerchantFlags(merchant.id);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Sécurité</h1>
        <p className="text-zinc-500">Activité inhabituelle détectée sur les 7 derniers jours.</p>
      </div>
      {flags.length === 0 ? (
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-8 flex items-center gap-3 text-emerald-400">
          <ShieldCheck className="w-6 h-6" /> Aucune activité suspecte détectée.
        </div>
      ) : (
        <div className="space-y-3">
          {flags.map((f, i) => (
            <div key={i} className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-amber-300">{f.label}</div>
                <div className="text-sm text-zinc-400">
                  {f.count} en {f.windowLabel} (seuil&nbsp;: {f.threshold}){f.cardId ? ` · carte ${f.cardId.slice(0, 8)}` : ""}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Nav** — dans `src/app/dashboard/DashboardShell.tsx`, ajouter `ShieldAlert` à l'import `lucide-react`, et insérer dans `navItems` (après « Notifications ») :
```typescript
    { name: "Sécurité", icon: ShieldAlert, href: "/dashboard/security" },
```

- [ ] **Step 3: Vérifier** — `npx tsc --noEmit` (ignorer passJson) + `npm run build` (`/dashboard/security` listée).
- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/security/page.tsx src/app/dashboard/DashboardShell.tsx
git commit -m "feat(antifraud): merchant security panel + nav entry"
```

---

## Task 8: Section admin (alertes)

**Files:** Modify `src/app/admin/page.tsx`.

- [ ] **Step 1: Ajouter la section** — importer le fetch + l'icône, charger les flags, rendre une section après la grille de stats.

(a) Imports en tête :
```typescript
import { ShieldAlert } from "lucide-react";
import { fetchAllMerchantsWithFlags } from "@/lib/antifraud/fetch";
```
(b) Dans le composant, après le bloc `Promise.all([...])`/`recentMerchants`, ajouter :
```typescript
  const flagged = await fetchAllMerchantsWithFlags();
```
(c) Insérer cette section **juste après** la `<div className="grid grid-cols-2 lg:grid-cols-4 gap-6"> … </div>` des stats (avant « Derniers marchands ») :
```tsx
      <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-8">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><ShieldAlert className="w-5 h-5 text-amber-400" /> Alertes anti-fraude (7 j)</h2>
        {flagged.length === 0 ? (
          <p className="text-emerald-400 text-sm">Aucune alerte. ✅</p>
        ) : (
          <div className="space-y-3">
            {flagged.map((m) => (
              <Link key={m.merchantId} href={`/admin/merchants/${m.merchantId}`}
                className="block p-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl hover:border-amber-500/40 transition-all">
                <div className="font-bold text-amber-300">{m.shopName}</div>
                <div className="text-xs text-zinc-400 mt-1">
                  {m.flags.map((f) => `${f.label} (${f.count}/${f.threshold} en ${f.windowLabel})`).join(" · ")}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
```

- [ ] **Step 2: Vérifier** — `npx tsc --noEmit` (ignorer passJson) + `npm run build`.
- [ ] **Step 3: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "feat(antifraud): admin platform-wide fraud alerts section"
```

---

## Task 9: Vérification finale

- [ ] **Step 1: Suite** — `npx vitest run`
Expected: tous verts (134 de la branche + 5 cooldown + 8 detect + cas config = ~150).
- [ ] **Step 2: Build** — `npm run build` (routes `/dashboard/security` + admin OK).
- [ ] **Step 3: Fumée (compte démo)**
1. Admin → fiche d'un marchand → régler « Délai mini » à `30` → enregistrer.
2. Scanner une carte, puis re-scanner la MÊME dans les 30 s → message « Carte déjà scannée à l'instant ». Au-delà de 30 s → tampon ajouté (le bug du café est corrigé : 2 achats espacés = 2 tampons).
3. Marchand → onglet Sécurité → panneau (vide si rien d'anormal).
4. Admin → section « Alertes anti-fraude » (vide si rien).

---

## Self-Review (rempli pendant la rédaction)

- **Couverture spec :** idempotence unique (Task 4) ; cooldown config + admin + enforcement + pur (Tasks 1-4) ; moteur pur 4 règles (Task 5) ; fetch signaux (Task 6) ; surface marchand (Task 7) ; surface admin (Task 8) ; aucune migration (cooldown dans `segment_config`). Hors périmètre (email, blocage auto, ML, géoloc, persistance, seuils par marchand) non implémenté.
- **Placeholders :** aucun — code complet à chaque step (les edits ponctuels donnent des ancrages précis dans des fichiers à lire).
- **Cohérence des types :** `withinCooldown(string|null, Date, number)` (Task 1) ↔ scan route (Task 4) ; `ResolvedMerchantConfig.scanCooldownSeconds` (Task 2) ↔ form (Task 3) ↔ scan (Task 4) ; `Flag`/`SignalsInput` (Task 5) ↔ fetch (Task 6) ↔ pages (Tasks 7-8) ; `MerchantFlags` (Task 6) ↔ admin (Task 8). Tests existants config mis à jour pour le nouveau champ (Task 2).
```
