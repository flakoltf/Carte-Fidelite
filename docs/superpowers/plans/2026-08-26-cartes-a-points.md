# Cartes à points + {visites} — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Programme de fidélité « points fixes par scan » avec paliers cumulatifs, validation staff, expiration et notification wallet, plus la variable dynamique `{visites}` dans le Card Design Studio.

**Architecture:** Nouveau `loyalty_type = 'points'` à côté des 4 types existants ; config (points/scan, paliers, expiration) en JSONB dans `merchants.loyalty_config` (pattern visit_based/tiered) ; état par carte sur `loyalty_cards` (`points_balance` existant, `redeemed_tiers`, `points_cycle_started_at`) ; incrément et validation atomiques via RPC Postgres (invariant 4) ; expiration par cron quotidien Vercel.

**Tech Stack:** Next.js 16.2 App Router (VERSION MODIFIÉE — lire `node_modules/next/dist/docs/` avant tout code Next), React 19, TS strict, Supabase (Postgres + RLS), Vitest.

**Spec:** `docs/superpowers/plans/2026-08-26-cartes-a-points-SPEC.md`

## Global Constraints

- Lire `AGENTS.md` + `node_modules/next/dist/docs/` avant d'écrire du code Next (version modifiée).
- Invariant 1 : toute nouvelle `AuditAction` exige une migration jumelle de `audit_logs_action_check` restatant la LISTE COMPLÈTE, dans un fichier qui trie lexicalement après `20260618_audit_actions_demo.sql`.
- Invariant 2 : Google Wallet — jamais d'UPDATE/PUT, toujours GET-then-merge/PATCH.
- Invariant 3 : toute route `supabaseAdmin` DOIT poser `.eq("merchant_id", …)` manuellement.
- Invariant 4 : incréments via RPC atomique (FOR UPDATE), jamais de read-modify-write.
- Invariant 6 : migrations dans `supabase/migrations/`, 100 % additives + idempotentes, application prod MANUELLE avec accord explicite du user (ne jamais exécuter en prod soi-même).
- `npx vitest run` avant tout commit ; Conventional Commits FR ; jamais de commit sur `main`.
- Copy produit : français suisse, vouvoiement ; TS strict, pas de `any` non justifié.
- Branche `feat/cartes-a-points` créée depuis `origin/main` FRAIS (git fetch d'abord), dans un worktree isolé (le checkout principal est occupé par une autre branche).

---

### Task 1: Types + validation du programme `points`

**Files:**
- Modify: `src/lib/loyalty/types.ts`
- Modify: `src/lib/loyalty/validate.ts`
- Test: `src/lib/loyalty/__tests__/validatePoints.test.ts` (nouveau)

**Interfaces:**
- Produces: `PointsTier = { threshold: number; reward: string }`, `PointsExpiration`, `PointsConfig`, union `LoyaltyProgram` étendue avec `{ type: "points"; config: PointsConfig }`, `LOYALTY_TYPES` incluant `"points"`, `ScanEvent` étendu avec `{ kind: "points_tier_reached"; threshold: number; reward: string }`. `validateLoyaltyProgram("points", raw)` retourne le programme nettoyé.

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
// src/lib/loyalty/__tests__/validatePoints.test.ts
import { describe, expect, it } from "vitest";
import { validateLoyaltyProgram } from "../validate";

const tiers = [
  { threshold: 30, reward: "10% de réduction" },
  { threshold: 50, reward: "Café offert" },
];

describe("validateLoyaltyProgram — points", () => {
  it("accepte une config points valide", () => {
    const v = validateLoyaltyProgram("points", { pointsPerScan: 5, tiers });
    expect(v.ok).toBe(true);
    if (v.ok) expect(v.program).toEqual({ type: "points", config: { pointsPerScan: 5, tiers } });
  });
  it("normalise l'expiration rolling", () => {
    const v = validateLoyaltyProgram("points", { pointsPerScan: 1, tiers, expiration: { type: "rolling", months: 12 } });
    expect(v.ok).toBe(true);
    if (v.ok && v.program.type === "points")
      expect(v.program.config.expiration).toEqual({ type: "rolling", months: 12 });
  });
  it("accepte fixed_date 31/12 et rejette 29/02", () => {
    expect(validateLoyaltyProgram("points", { pointsPerScan: 1, tiers, expiration: { type: "fixed_date", month: 12, day: 31 } }).ok).toBe(true);
    expect(validateLoyaltyProgram("points", { pointsPerScan: 1, tiers, expiration: { type: "fixed_date", month: 2, day: 29 } }).ok).toBe(false);
  });
  it("rejette pointsPerScan non entier, ≤ 0 ou > 1000", () => {
    for (const bad of [0, -1, 1.5, 1001, "5"])
      expect(validateLoyaltyProgram("points", { pointsPerScan: bad, tiers }).ok).toBe(false);
  });
  it("rejette paliers vides, > 6, non strictement croissants, reward vide ou > 80 chars", () => {
    expect(validateLoyaltyProgram("points", { pointsPerScan: 1, tiers: [] }).ok).toBe(false);
    expect(validateLoyaltyProgram("points", { pointsPerScan: 1, tiers: [{ threshold: 30, reward: "a" }, { threshold: 30, reward: "b" }] }).ok).toBe(false);
    expect(validateLoyaltyProgram("points", { pointsPerScan: 1, tiers: [{ threshold: 30, reward: "" }] }).ok).toBe(false);
    expect(validateLoyaltyProgram("points", { pointsPerScan: 1, tiers: [{ threshold: 30, reward: "x".repeat(81) }] }).ok).toBe(false);
  });
  it("trim le reward", () => {
    const v = validateLoyaltyProgram("points", { pointsPerScan: 1, tiers: [{ threshold: 10, reward: "  Café offert  " }] });
    expect(v.ok).toBe(true);
    if (v.ok && v.program.type === "points") expect(v.program.config.tiers[0].reward).toBe("Café offert");
  });
});
```

- [ ] **Step 2:** `npx vitest run src/lib/loyalty/__tests__/validatePoints.test.ts` → FAIL (« Type de programme inconnu »).

- [ ] **Step 3: Implémenter les types** — dans `src/lib/loyalty/types.ts` :

```ts
export type LoyaltyType = "stamp_card" | "visit_based" | "tiered" | "amount_points" | "points";

// Carte à points (points FIXES par scan — distinct d'amount_points).
// Paliers cumulatifs strictement croissants ; le DERNIER = maximum (cap + reset).
export type PointsTier = { threshold: number; reward: string };
export type PointsExpiration =
  | { type: "none" }
  | { type: "fixed_date"; month: number; day: number } // reset annuel récurrent
  | { type: "rolling"; months: number }; // N mois après le 1er scan du cycle
export type PointsConfig = {
  pointsPerScan: number;
  tiers: PointsTier[];
  expiration?: PointsExpiration; // absent = aucune expiration
};
```

Étendre l'union (`| { type: "points"; config: PointsConfig }`), `ScanEvent` (`| { kind: "points_tier_reached"; threshold: number; reward: string }`) et `LOYALTY_TYPES` (ajouter `"points"`).

- [ ] **Step 4: Implémenter la validation** — dans `src/lib/loyalty/validate.ts`, avant le `return { ok: false, error: "Type de programme inconnu." }` final (réutiliser `isInt` et `strictAsc` existants) :

```ts
  if (type === "points") {
    const pps = cfg.pointsPerScan;
    if (!isInt(pps) || pps < 1 || pps > 1000) return { ok: false, error: "Points par scan : un entier de 1 à 1000." };

    const rawTiers = cfg.tiers;
    if (!Array.isArray(rawTiers) || rawTiers.length === 0 || rawTiers.length > 6) return { ok: false, error: "Paliers : 1 à 6." };
    const tiers: PointsTier[] = [];
    for (const t of rawTiers) {
      const threshold = (t as Record<string, unknown>)?.threshold;
      const reward = (t as Record<string, unknown>)?.reward;
      if (!isInt(threshold) || threshold < 1) return { ok: false, error: "Seuil de palier invalide (entier > 0)." };
      if (typeof reward !== "string" || reward.trim().length < 1 || reward.trim().length > 80)
        return { ok: false, error: "Offre de palier : 1 à 80 caractères." };
      tiers.push({ threshold, reward: reward.trim() });
    }
    if (!strictAsc(tiers.map((t) => t.threshold))) return { ok: false, error: "Seuils de paliers strictement croissants et distincts." };

    const config: PointsConfig = { pointsPerScan: pps, tiers };

    const exp = cfg.expiration as Record<string, unknown> | undefined;
    if (exp !== undefined && exp !== null && (exp as { type?: unknown }).type !== "none") {
      if (exp.type === "rolling") {
        if (!isInt(exp.months) || (exp.months as number) < 1 || (exp.months as number) > 60)
          return { ok: false, error: "Expiration glissante : 1 à 60 mois." };
        config.expiration = { type: "rolling", months: exp.months as number };
      } else if (exp.type === "fixed_date") {
        const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; // année non bissextile : 29/02 refusé
        const m = exp.month, d = exp.day;
        if (!isInt(m) || m < 1 || m > 12 || !isInt(d) || d < 1 || d > DAYS[(m as number) - 1])
          return { ok: false, error: "Expiration à date fixe : jour/mois invalides." };
        config.expiration = { type: "fixed_date", month: m as number, day: d as number };
      } else {
        return { ok: false, error: "Type d'expiration inconnu." };
      }
    }
    return { ok: true, program: { type: "points", config } };
  }
```

Importer `PointsConfig, PointsTier` depuis `./types` en tête de fichier.

- [ ] **Step 5:** `npx vitest run src/lib/loyalty/__tests__/validatePoints.test.ts` → PASS, puis `npx vitest run` complet (rien de cassé).

- [ ] **Step 6: Commit** — `feat(loyalty): type de programme points — types + validation`

---

### Task 2: Helpers purs (paliers, expiration) + moteur + résolution

**Files:**
- Create: `src/lib/loyalty/points.ts`
- Modify: `src/lib/loyalty/engine.ts` (case `points` dans `applyScan` + `programCanRedeem`)
- Modify: `src/lib/loyalty/resolveProgram.ts:16` (ajouter `|| type === "points"`)
- Test: `src/lib/loyalty/__tests__/points.test.ts` (nouveau)

**Interfaces:**
- Consumes: `PointsConfig`, `PointsTier`, `PointsExpiration` (Task 1).
- Produces:
  - `maxPointsThreshold(config: PointsConfig): number`
  - `crossedPointsTiers(config: PointsConfig, before: number, after: number): PointsTier[]`
  - `redeemablePointsTiers(config: PointsConfig, balance: number, redeemedTiers: number[]): PointsTier[]`
  - `parseRedeemedTiers(raw: unknown): number[]` (jsonb → entiers sains, sinon `[]`)
  - `pointsCycleExpired(expiration: PointsExpiration | undefined, cycleStartedAt: Date | null, now: Date): boolean`
  - `applyScan` gère `type === "points"` (cap au palier max, `added:false`+`rewardReady:true` si déjà plein — miroir stamps).

- [ ] **Step 1: Tests qui échouent**

```ts
// src/lib/loyalty/__tests__/points.test.ts
import { describe, expect, it } from "vitest";
import { crossedPointsTiers, maxPointsThreshold, parseRedeemedTiers, pointsCycleExpired, redeemablePointsTiers } from "../points";
import { applyScan } from "../engine";
import type { PointsConfig } from "../types";

const config: PointsConfig = {
  pointsPerScan: 5,
  tiers: [{ threshold: 30, reward: "10% de réduction" }, { threshold: 40, reward: "Boisson offerte" }, { threshold: 50, reward: "Menu offert" }],
};

describe("helpers points", () => {
  it("maxPointsThreshold = dernier palier", () => expect(maxPointsThreshold(config)).toBe(50));
  it("crossedPointsTiers détecte un ou plusieurs franchissements", () => {
    expect(crossedPointsTiers(config, 27, 32).map((t) => t.threshold)).toEqual([30]);
    expect(crossedPointsTiers({ ...config, pointsPerScan: 25 }, 28, 50).map((t) => t.threshold)).toEqual([30, 40, 50]);
    expect(crossedPointsTiers(config, 32, 37)).toEqual([]);
  });
  it("redeemablePointsTiers exclut les paliers déjà validés dans le cycle", () => {
    expect(redeemablePointsTiers(config, 42, []).map((t) => t.threshold)).toEqual([30, 40]);
    expect(redeemablePointsTiers(config, 42, [30]).map((t) => t.threshold)).toEqual([40]);
    expect(redeemablePointsTiers(config, 12, [])).toEqual([]);
  });
  it("parseRedeemedTiers ne garde que des entiers", () => {
    expect(parseRedeemedTiers([30, "x", 40.5, 50])).toEqual([30, 50]);
    expect(parseRedeemedTiers(null)).toEqual([]);
    expect(parseRedeemedTiers("[30]")).toEqual([]);
  });
});

describe("pointsCycleExpired", () => {
  const now = new Date("2026-08-26T10:00:00Z");
  it("none / pas d'ancre → jamais expiré", () => {
    expect(pointsCycleExpired(undefined, new Date("2020-01-01"), now)).toBe(false);
    expect(pointsCycleExpired({ type: "none" }, new Date("2020-01-01"), now)).toBe(false);
    expect(pointsCycleExpired({ type: "rolling", months: 12 }, null, now)).toBe(false);
  });
  it("rolling : expiré passé N mois", () => {
    expect(pointsCycleExpired({ type: "rolling", months: 12 }, new Date("2025-08-25T00:00:00Z"), now)).toBe(true);
    expect(pointsCycleExpired({ type: "rolling", months: 12 }, new Date("2025-08-27T00:00:00Z"), now)).toBe(false);
  });
  it("fixed_date : expiré si le cycle a commencé avant la DERNIÈRE occurrence de la date", () => {
    const exp = { type: "fixed_date", month: 12, day: 31 } as const;
    // dernière occurrence du 31/12 avant le 26/08/2026 = 31/12/2025
    expect(pointsCycleExpired(exp, new Date("2025-12-30T00:00:00Z"), now)).toBe(true);
    expect(pointsCycleExpired(exp, new Date("2026-01-02T00:00:00Z"), now)).toBe(false);
  });
});

describe("applyScan — points", () => {
  const program = { type: "points", config } as const;
  it("crédite pointsPerScan et émet l'événement au franchissement", () => {
    expect(applyScan(program, 10)).toEqual({ newCount: 15, added: true, rewardReady: false, events: [] });
    const r = applyScan(program, 27);
    expect(r).toMatchObject({ newCount: 32, added: true, rewardReady: true });
    expect(r.events).toEqual([{ kind: "points_tier_reached", threshold: 30, reward: "10% de réduction" }]);
  });
  it("plafonne au palier max sans surplus", () => {
    expect(applyScan(program, 48).newCount).toBe(50);
  });
  it("carte pleine : rien d'ajouté, récompense proposée (miroir stamps)", () => {
    expect(applyScan(program, 50)).toEqual({ newCount: 50, added: false, rewardReady: true, events: [] });
  });
});
```

- [ ] **Step 2:** `npx vitest run src/lib/loyalty/__tests__/points.test.ts` → FAIL (module `../points` absent).

- [ ] **Step 3: Implémenter `src/lib/loyalty/points.ts`**

```ts
import type { PointsConfig, PointsExpiration, PointsTier } from "./types";

// Le dernier palier (validation : strictement croissants) = maximum du programme.
export function maxPointsThreshold(config: PointsConfig): number {
  return config.tiers[config.tiers.length - 1].threshold;
}

// Paliers franchis par CETTE transition (before < seuil ≤ after) — jamais redéclenchés.
export function crossedPointsTiers(config: PointsConfig, before: number, after: number): PointsTier[] {
  return config.tiers.filter((t) => before < t.threshold && after >= t.threshold);
}

// Paliers atteints ET pas encore validés dans le cycle (modèle cumulatif validé en spec).
export function redeemablePointsTiers(config: PointsConfig, balance: number, redeemedTiers: number[]): PointsTier[] {
  return config.tiers.filter((t) => balance >= t.threshold && !redeemedTiers.includes(t.threshold));
}

// redeemed_tiers est une jsonb éditable hors contrôle → on ne propage que des entiers.
export function parseRedeemedTiers(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is number => typeof v === "number" && Number.isInteger(v));
}

// Expiration du CYCLE (carte entière) : l'ancre est points_cycle_started_at (posée au
// 1er scan du cycle, remise à null au reset). fixed_date = reset annuel récurrent :
// expiré si l'ancre précède la dernière occurrence de la date. rolling = N mois.
export function pointsCycleExpired(expiration: PointsExpiration | undefined, cycleStartedAt: Date | null, now: Date): boolean {
  if (!expiration || expiration.type === "none" || !cycleStartedAt) return false;
  if (expiration.type === "rolling") {
    const boundary = new Date(now);
    boundary.setUTCMonth(boundary.getUTCMonth() - expiration.months);
    return cycleStartedAt < boundary;
  }
  const thisYear = new Date(Date.UTC(now.getUTCFullYear(), expiration.month - 1, expiration.day, 23, 59, 59));
  const boundary = thisYear <= now ? thisYear : new Date(Date.UTC(now.getUTCFullYear() - 1, expiration.month - 1, expiration.day, 23, 59, 59));
  return cycleStartedAt < boundary;
}
```

- [ ] **Step 4: Moteur** — dans `src/lib/loyalty/engine.ts`, importer `crossedPointsTiers, maxPointsThreshold` et ajouter dans le `switch` d'`applyScan` :

```ts
    case "points": {
      const cap = maxPointsThreshold(program.config);
      if (currentValue >= cap) return { newCount: currentValue, added: false, rewardReady: true, events: [] };
      const newValue = Math.min(currentValue + program.config.pointsPerScan, cap);
      const crossed = crossedPointsTiers(program.config, currentValue, newValue);
      return {
        newCount: newValue,
        added: true,
        rewardReady: crossed.length > 0,
        events: crossed.map((t) => ({ kind: "points_tier_reached" as const, threshold: t.threshold, reward: t.reward })),
      };
    }
```

Dans `programCanRedeem`, ajouter avant le `return false` :
`if (program.type === "points") return currentValue >= program.config.tiers[0].threshold;`

- [ ] **Step 5: Résolution** — `src/lib/loyalty/resolveProgram.ts:16` :
`if (type === "visit_based" || type === "tiered" || type === "amount_points" || type === "points") {`

- [ ] **Step 6:** `npx vitest run` complet → PASS.

- [ ] **Step 7: Commit** — `feat(loyalty): moteur points — paliers cumulatifs, cap au max, expiration pure`

---

### Task 3: Migration 1 — colonnes carte + RPC atomiques

**Files:**
- Create: `supabase/migrations/20260826_points_card.sql`

**Interfaces:**
- Produces: colonnes `loyalty_cards.redeemed_tiers jsonb DEFAULT '[]'`, `loyalty_cards.points_cycle_started_at timestamptz` ; RPC `scan_increment_points(p_card_id uuid, p_points int, p_cap int, p_cooldown_seconds int) → table(new_count int, points_added int, status text)` (statuts `incremented|cooldown|full|notfound`) ; RPC `points_redeem_tier(p_card_id uuid, p_merchant_id uuid, p_threshold int, p_max_threshold int) → text` (`reset|redeemed|already|not_reached|notfound`).

- [ ] **Step 1: Écrire la migration** (modèles : `20260604_scan_atomic_increment.sql` et `20260618_amount_points.sql`)

```sql
-- Carte à points (points FIXES par scan, paliers cumulatifs) — spec 2026-08-26.
-- 100 % ADDITIF et idempotent. PRÉ-REQUIS PROD : 20260618_amount_points.sql
-- (points_balance) — la colonne est ré-ajoutée défensivement ci-dessous pour
-- lever tout risque d'ordre. Application prod MANUELLE avec accord explicite.
-- Aucune nouvelle table → registre RLS inchangé. Nouvelle AuditAction
-- POINTS_EXPIRED : jumelle dans 20260826_audit_actions_points.sql (invariant 1).

-- 1) loyalty_type : autoriser 'points' (ancien set ⊂ nouveau set, rejouable).
alter table merchants drop constraint if exists merchants_loyalty_type_chk;
alter table merchants drop constraint if exists merchants_loyalty_type_check;
alter table merchants
  add constraint merchants_loyalty_type_chk
  check (loyalty_type in ('stamp_card', 'visit_based', 'tiered', 'amount_points', 'points'));

-- 2) État par carte. points_balance : défensif (déjà posé par 20260618 si appliquée).
alter table loyalty_cards add column if not exists points_balance integer not null default 0;
-- Paliers intermédiaires déjà validés dans le CYCLE courant (vidé au reset).
alter table loyalty_cards add column if not exists redeemed_tiers jsonb not null default '[]'::jsonb;
-- Ancre d'expiration : posée au 1er scan du cycle, remise à null au reset.
alter table loyalty_cards add column if not exists points_cycle_started_at timestamptz;

-- 3) Incrément ATOMIQUE (miroir de scan_increment, sur points_balance).
--    p_cap = seuil du palier max (>0 toujours) : crédite au plus jusqu'au cap
--    (pas de surplus — spec), statut 'full' si déjà plein.
create or replace function scan_increment_points(
  p_card_id uuid,
  p_points integer,
  p_cap integer,
  p_cooldown_seconds integer
)
returns table(new_count integer, points_added integer, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
  v_add integer;
  r loyalty_cards%rowtype;
begin
  select * into r from loyalty_cards where id = p_card_id for update;
  if not found then
    new_count := 0; points_added := 0; status := 'notfound';
    return next; return;
  end if;

  if r.points_balance >= p_cap then
    new_count := r.points_balance; points_added := 0; status := 'full';
  elsif p_cooldown_seconds > 0
        and r.last_scan is not null
        and r.last_scan > v_now - make_interval(secs => p_cooldown_seconds) then
    new_count := r.points_balance; points_added := 0; status := 'cooldown';
  else
    v_add := least(p_points, p_cap - r.points_balance);
    update loyalty_cards
      set points_balance = points_balance + v_add,
          last_scan = v_now,
          points_cycle_started_at = coalesce(points_cycle_started_at, v_now)
      where id = p_card_id;
    new_count := r.points_balance + v_add; points_added := v_add; status := 'incremented';
  end if;
  return next;
end $$;

revoke execute on function scan_increment_points(uuid, integer, integer, integer) from public, anon, authenticated;

-- 4) Validation staff ATOMIQUE d'un palier (SEC-01 : jamais de double validation).
--    Palier max → reset complet du cycle ; intermédiaire → marqué dans redeemed_tiers.
create or replace function points_redeem_tier(
  p_card_id uuid,
  p_merchant_id uuid,
  p_threshold integer,
  p_max_threshold integer
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  r loyalty_cards%rowtype;
begin
  select * into r from loyalty_cards where id = p_card_id and merchant_id = p_merchant_id for update;
  if not found then return 'notfound'; end if;
  if r.points_balance < p_threshold then return 'not_reached'; end if;

  if p_threshold >= p_max_threshold then
    update loyalty_cards
      set points_balance = 0, redeemed_tiers = '[]'::jsonb, points_cycle_started_at = null
      where id = p_card_id;
    return 'reset';
  end if;

  if r.redeemed_tiers @> jsonb_build_array(p_threshold) then return 'already'; end if;
  update loyalty_cards
    set redeemed_tiers = r.redeemed_tiers || jsonb_build_array(p_threshold)
    where id = p_card_id;
  return 'redeemed';
end $$;

revoke execute on function points_redeem_tier(uuid, uuid, integer, integer) from public, anon, authenticated;
```

- [ ] **Step 2:** `npx vitest run` (les gardes `auditActionsSync` / `rlsPolicyGuard` doivent rester verts — pas de nouvelle action ici, pas de nouvelle table).

- [ ] **Step 3: Commit** — `feat(db): carte à points — redeemed_tiers, ancre de cycle, RPC scan_increment_points + points_redeem_tier (repo only)`

---

### Task 4: Studio rules — publication du programme points

**Files:**
- Modify: `src/lib/loyalty/studioRules.ts` (`StudioRulesInput`, `configForType`)
- Test: `src/lib/loyalty/__tests__/studioRulesPoints.test.ts` (nouveau)

**Interfaces:**
- Consumes: `validateLoyaltyProgram("points", …)` (Task 1).
- Produces: `buildLoyaltyUpdate({ type: "points", config: { pointsPerScan, tiers, expiration } , reward_label })` → `{ loyalty_type: "points", loyalty_config: PointsConfig, reward_label }`.

- [ ] **Step 1: Test qui échoue**

```ts
// src/lib/loyalty/__tests__/studioRulesPoints.test.ts
import { describe, expect, it } from "vitest";
import { buildLoyaltyUpdate } from "../studioRules";

describe("buildLoyaltyUpdate — points", () => {
  it("construit l'update marchand pour un programme points", () => {
    const r = buildLoyaltyUpdate({
      type: "points",
      config: { pointsPerScan: 5, tiers: [{ threshold: 30, reward: "10% de réduction" }], expiration: { type: "rolling", months: 12 } },
    });
    expect(r).toEqual({
      ok: true,
      update: {
        loyalty_type: "points",
        loyalty_config: { pointsPerScan: 5, tiers: [{ threshold: 30, reward: "10% de réduction" }], expiration: { type: "rolling", months: 12 } },
        reward_label: null,
      },
    });
  });
  it("propage l'erreur de validation", () => {
    expect(buildLoyaltyUpdate({ type: "points", config: { pointsPerScan: 0, tiers: [] } }).ok).toBe(false);
  });
});
```

- [ ] **Step 2:** vitest → FAIL.

- [ ] **Step 3: Implémenter** — dans `StudioRulesInput`, élargir le commentaire du champ `type` (`"stamp_card" | "visit_based" | "tiered" | "points"`) et le champ `config` :
`config?: { milestones?: unknown; tiers?: unknown; pointsPerScan?: unknown; expiration?: unknown };`
Dans `configForType`, avant le `return {}` final :

```ts
  if (input.type === "points") {
    const cfg: Record<string, unknown> = {
      pointsPerScan: input.config?.pointsPerScan,
      tiers: input.config?.tiers,
    };
    if (input.config?.expiration !== undefined) cfg.expiration = input.config.expiration;
    return cfg;
  }
```

- [ ] **Step 4:** vitest ciblé PASS puis `npx vitest run` complet.

- [ ] **Step 5: Commit** — `feat(studio): publication des règles du programme points`

---

### Task 5: Route scan — branche `points` + notification de palier

**Files:**
- Modify: `src/app/api/scan/route.ts` (nouvelle branche après la branche `amount_points`, avant `const cap = …` L185)

**Interfaces:**
- Consumes: RPC `scan_increment_points` (Task 3), helpers `maxPointsThreshold`, `crossedPointsTiers`, `redeemablePointsTiers`, `parseRedeemedTiers` (Task 2).
- Produces: réponse JSON `{ success: true, loyaltyType: "points", currentValue: number, pointsAdded: number, rewardReady: boolean, redeemableTiers: PointsTier[], maxThreshold: number, added: boolean }` — consommée par le comptoir (Task 11).

- [ ] **Step 1: Implémenter la branche** (mêmes gardes déjà passées : auth, rate-limit, signature QR, idempotence, suspension, tenancy) :

```ts
    // 2-ter. points : crédit FIXE par scan via la RPC atomique dédiée (invariant 4).
    if (program.type === "points") {
      const capPoints = maxPointsThreshold(program.config);
      const { data: rpcData, error: rpcError } = await supabaseAdmin.rpc("scan_increment_points", {
        p_card_id: actualCardId,
        p_points: program.config.pointsPerScan,
        p_cap: capPoints,
        p_cooldown_seconds: cfg.scanCooldownSeconds,
      });
      if (rpcError) {
        console.error("[scan] RPC scan_increment_points échec:", rpcError.message);
        throw new Error("Crédit atomique indisponible");
      }
      const row = (Array.isArray(rpcData) ? rpcData[0] : null) as
        { new_count: number; points_added: number; status: "incremented" | "cooldown" | "full" | "notfound" } | null;
      if (!row) throw new Error("scan_increment_points: réponse vide");

      if (row.status === "cooldown") {
        return NextResponse.json(
          { error: "Carte déjà scannée à l'instant. Patientez quelques secondes.", cooldown: true },
          { status: 429 }
        );
      }
      if (row.status === "notfound") {
        return NextResponse.json({ error: "Carte invalide ou introuvable" }, { status: 404 });
      }

      const redeemed = parseRedeemedTiers(card.redeemed_tiers);
      const redeemable = redeemablePointsTiers(program.config, row.new_count, redeemed);

      // Carte pleine : aucun point ajouté, on propose juste la validation (miroir stamps).
      if (row.status === "full") {
        const response = {
          success: true, loyaltyType: "points" as const, currentValue: row.new_count, pointsAdded: 0,
          added: false, rewardReady: redeemable.length > 0, redeemableTiers: redeemable, maxThreshold: capPoints,
        };
        await setIdempotency(idempotencyKey, response);
        return NextResponse.json(response);
      }

      const before = row.new_count - row.points_added;
      const crossed = crossedPointsTiers(program.config, before, row.new_count);

      // Historique (points_added = points crédités ce scan) puis push best-effort :
      // AVEC message au franchissement de palier (récompense disponible), silencieux sinon.
      await supabaseAdmin.from("scan_history")
        .insert({ card_id: actualCardId, merchant_id: card.merchant_id, points_added: row.points_added });
      try {
        const { getChannels } = await import("@/lib/wallet/channel");
        const top = crossed[crossed.length - 1];
        const message = top
          ? { title: "Récompense disponible 🎁", body: `${top.reward} — présentez votre carte au comptoir pour en profiter.` }
          : undefined;
        for (const ch of getChannels()) await ch.notify([actualCardId], message);
      } catch (e) {
        console.error("[scan] push notify failed:", e);
      }

      const meta = extractRequestMeta(req);
      await logAuditEvent({
        action: "CARD_SCANNED",
        merchant_id: merchant.id, user_id: user.id, card_id: actualCardId,
        details: {
          points_added: row.points_added, new_balance: row.new_count,
          crossed_thresholds: crossed.map((t) => t.threshold),
          reward_ready: redeemable.length > 0, loyalty_type: program.type,
        }, ...meta,
      });

      const response = {
        success: true, loyaltyType: "points" as const, currentValue: row.new_count, pointsAdded: row.points_added,
        added: true, rewardReady: redeemable.length > 0, redeemableTiers: redeemable, maxThreshold: capPoints,
      };
      await setIdempotency(idempotencyKey, response);
      return NextResponse.json(response);
    }
```

Imports à ajouter en tête : `import { crossedPointsTiers, maxPointsThreshold, parseRedeemedTiers, redeemablePointsTiers } from "@/lib/loyalty/points";`

- [ ] **Step 2:** `npx vitest run` complet (aucune régression) + `npm run lint`.
- [ ] **Step 3: Commit** — `feat(scan): branche points — crédit fixe atomique, paliers, notification wallet`

---

### Task 6: Validation staff d'un palier (redeem)

**Files:**
- Modify: `src/lib/loyalty/redeem.ts` (brancher AVANT le rejet `program.type !== "stamp_card"` L49-50)

**Interfaces:**
- Consumes: RPC `points_redeem_tier` (Task 3), `maxPointsThreshold` (Task 2).
- Produces: `POST /api/scan/redeem` accepte `{ cardId, tierThreshold?: number }` ; pour un programme points, `tierThreshold` est OBLIGATOIRE et doit correspondre à un palier configuré. Réponse `{ success: true, tier: PointsTier, cycleReset: boolean }`. Statuts d'erreur : 400 palier inconnu/absent, 409 `not_reached`/`already`, 404 `notfound`.

- [ ] **Step 1: Implémenter** — dans `redeemReward`, lire le body une seule fois : remplacer `const { cardId } = await req.json().catch(() => ({}));` par `const body = await req.json().catch(() => ({})); const { cardId, tierThreshold } = body;` puis, après `const program = resolveLoyaltyProgram(merchant);` :

```ts
  // Programme points : validation d'UN palier précis (cumulatif — spec 2026-08-26).
  if (program.type === "points") {
    const tier = Number.isInteger(tierThreshold)
      ? program.config.tiers.find((t) => t.threshold === tierThreshold)
      : undefined;
    if (!tier) return NextResponse.json({ error: "Palier inconnu pour ce programme." }, { status: 400 });
    const maxThreshold = maxPointsThreshold(program.config);

    const { data: outcome, error: rpcError } = await supabaseAdmin.rpc("points_redeem_tier", {
      p_card_id: actualCardId, p_merchant_id: merchant.id,
      p_threshold: tier.threshold, p_max_threshold: maxThreshold,
    });
    if (rpcError) {
      console.error("[redeem] RPC points_redeem_tier échec:", rpcError.message);
      return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
    if (outcome === "notfound") return NextResponse.json({ error: "Carte introuvable" }, { status: 404 });
    if (outcome === "not_reached") return NextResponse.json({ error: "Palier non atteint." }, { status: 409 });
    if (outcome === "already") return NextResponse.json({ error: "Palier déjà validé sur ce cycle." }, { status: 409 });
    const cycleReset = outcome === "reset";

    await logAuditEvent({
      action: "REWARD_REDEEMED",
      merchant_id: merchant.id, user_id: user.id, card_id: actualCardId,
      details: { tier_threshold: tier.threshold, reward: tier.reward, cycle_reset: cycleReset, loyalty_type: "points" },
      ...extractRequestMeta(req),
    });

    try {
      const { getChannels } = await import("@/lib/wallet/channel");
      const msgBody = cycleReset
        ? "Merci 🎉 Votre carte repart à zéro."
        : `${tier.reward} — vos points continuent de cumuler.`;
      for (const ch of getChannels()) await ch.notify([actualCardId], { title: "Récompense utilisée", body: msgBody });
    } catch (e) {
      console.error("[redeem] push failed:", e instanceof Error ? e.message : e);
    }

    return NextResponse.json({ success: true, tier, cycleReset });
  }
```

Import : `import { maxPointsThreshold } from "@/lib/loyalty/points";`

- [ ] **Step 2:** `npx vitest run` complet + `npm run lint`.
- [ ] **Step 3: Commit** — `feat(redeem): validation staff par palier — reset au max, trace audit`

---

### Task 7: Fix changeMessage sur le chemin design (pré-requis notification visible)

**Files:**
- Modify: `src/lib/wallet/passJson.ts:150-156` (remplacement du storeCard design)
- Test: `src/lib/wallet/__tests__/passJsonMessage.test.ts` (nouveau ; si un test de passJson existe déjà dans `src/lib/wallet/__tests__/`, y ajouter le cas plutôt que créer un doublon)

**Interfaces:**
- Produces: le champ `message` (`changeMessage: "%@"`) survit au chemin design → le texte poussé via `AppleChannel.notify(…, message)` redevient visible (bannière écran verrouillé, sous réserve des limites iOS connues — cf. `docs/DIAGNOSTIC-apple-wallet-banniere-maj.md`).

- [ ] **Step 1: Test qui échoue**

```ts
// src/lib/wallet/__tests__/passJsonMessage.test.ts
import { describe, expect, it } from "vitest";
import { buildPassJson } from "../passJson";
import type { CardDesign } from "@/lib/cardDesign/types";

const design = {
  backgroundColor: "#0D6B5E", foregroundColor: "#FFFFFF", labelColor: "#BFEEE6",
  programName: "Test", fields: [{ id: "f1", zone: "primary", label: "POINTS", value: "{points}" }],
  barcode: { type: "QR", source: "card_token" },
} as unknown as CardDesign;

describe("buildPassJson — message sur le chemin design", () => {
  it("conserve le champ message avec changeMessage quand un design est présent", () => {
    const pass = buildPassJson({
      cardId: "c1", customerName: "Test", stamps: 3, orgName: "Org", backgroundColor: "#000",
      passTypeIdentifier: "pass.test", teamIdentifier: "T", barcodeMessage: "m",
      message: "Récompense disponible 🎁", design,
    });
    const msg = pass.storeCard.backFields.find((f) => f.key === "message");
    expect(msg).toBeDefined();
    expect(msg?.value).toBe("Récompense disponible 🎁");
    expect(msg?.changeMessage).toBe("%@");
  });
});
```

(Ajuster la forme minimale de `CardDesign` au vrai type — lire `src/lib/cardDesign/types.ts` ; si `zone`/`id` diffèrent, corriger le fixture, pas le test d'intention.)

- [ ] **Step 2:** vitest → FAIL (le storeCard design ne contient pas `message`).

- [ ] **Step 3: Implémenter** — dans le bloc `if (i.design)`, remplacer l'affectation du storeCard par :

```ts
    // Replace the entire storeCard with design-driven field buckets.
    // Le champ message (changeMessage) est RÉINJECTÉ en tête des backFields :
    // sans lui, aucun texte de notification n'atteint le pass quand un design
    // est publié (bug corrigé — les pushes de palier seraient invisibles).
    (pass as Record<string, unknown>).storeCard = {
      headerFields: m.headerFields,
      primaryFields,
      secondaryFields: m.secondaryFields,
      auxiliaryFields,
      backFields: [
        { key: "message", label: "INFO", value: i.message ?? "", changeMessage: "%@" },
        ...m.backFields,
      ],
    };
```

Note : +1 backField sur le chemin design → la règle pratique passe à « design ≤ 5 backFields » (identité ~4 + message, plafond 10). Mettre à jour le commentaire `MAX_BACK_FIELDS` si nécessaire.

- [ ] **Step 4:** vitest ciblé PASS + `npx vitest run` complet.
- [ ] **Step 5: Commit** — `fix(wallet): le changeMessage survit au chemin design (notifications visibles)`

---

### Task 8: Pass Apple/Google — affichage du solde de points

**Files:**
- Modify: `src/lib/applePass.ts` (fonction `buildApplePassBuffer`, chargement marchand L95-120)
- Modify: `src/lib/googlePass.ts` + son/ses call-sites (`grep -rn "buildGoogleSaveUrl(" src/`)

**Interfaces:**
- Consumes: `resolveLoyaltyProgram` (déjà importable), `maxPointsThreshold`, `redeemablePointsTiers`, `parseRedeemedTiers` (Task 2).
- Produces: pour un marchand `loyalty_type = 'points'`, le jeton `{points}` du pass affiche `points_balance / seuil_max` et `{palier}` la description du plus haut palier atteint ; `loyaltyPoints.balance` Google reçoit `points_balance` à l'enrôlement.

- [ ] **Step 1: Lire `src/lib/applePass.ts` en entier** (la requête marchand L95-120 charge déjà `stamp_goal` ; le row carte fournit `stamps_count`).

- [ ] **Step 2: Implémenter côté Apple** — dans `buildApplePassBuffer` :
  - étendre le `select` marchand avec `loyalty_type, loyalty_config` et le `select` carte avec `points_balance, redeemed_tiers` ;
  - résoudre `const program = resolveLoyaltyProgram(mRow)` ;
  - si `program.type === "points"` : passer à `buildPassJson` `stamps: card.points_balance ?? 0`, `stampGoal: maxPointsThreshold(program.config)`, et `palier` = `reward` du plus haut palier `threshold <= points_balance` (sinon `undefined`) ;
  - sinon : comportement actuel inchangé (stamps_count / stamp_goal, palier tiered existant).

- [ ] **Step 3: Implémenter côté Google** — au(x) call-site(s) de `buildGoogleSaveUrl` (route d'enrôlement) : si le programme du marchand est `points`, passer `stamps: points_balance` au lieu de `stamps_count`. Ne PAS toucher à la classe (invariant 2) ni au channel Google (stub).

- [ ] **Step 4:** `npx vitest run` + `npm run lint` ; vérification manuelle notée pour la fin (pass Apple au simulateur — cf. Task 14).
- [ ] **Step 5: Commit** — `feat(wallet): le pass affiche le solde de points ({points} = solde / max, {palier} = offre atteinte)`

---

### Task 9: `{visites}` — résolution serveur

**Files:**
- Modify: `src/lib/wallet/passJson.ts` (`PassJsonInput` + ctx)
- Modify: `src/lib/applePass.ts` (COUNT scan_history)
- Modify: `src/lib/cardDesign/types.ts:7` (commentaire du contrat de jetons)
- Test: étendre `src/lib/wallet/__tests__/passJsonMessage.test.ts` (ou le test passJson existant)

**Interfaces:**
- Produces: `PassJsonInput.visites?: number` ; ctx `visites` → le jeton `{visites}` rend le nombre total de scans de la carte (compteur à vie, indépendant des resets de points).

- [ ] **Step 1: Test qui échoue** — ajouter au test passJson :

```ts
  it("résout {visites} depuis l'input", () => {
    const withVisits = {
      ...design,
      fields: [{ ...design.fields[0], value: "{visites} visites" }],
    } as unknown as CardDesign;
    const pass = buildPassJson({
      cardId: "c1", customerName: "Test", stamps: 3, orgName: "Org", backgroundColor: "#000",
      passTypeIdentifier: "pass.test", teamIdentifier: "T", barcodeMessage: "m",
      design: withVisits, visites: 17,
    });
    expect(pass.storeCard.primaryFields[0].value).toBe("17 visites");
  });
```

- [ ] **Step 2:** vitest → FAIL.

- [ ] **Step 3: Implémenter** — `passJson.ts` : ajouter `visites?: number;` à `PassJsonInput` (commentaire : « nombre total de scans de la carte — jeton {visites} ») et dans le ctx :
`visites: i.visites !== undefined ? String(i.visites) : undefined,`
`cardDesign/types.ts:7` : compléter le commentaire → `{nom}, {points}, {palier}, {visites}`.

- [ ] **Step 4: Alimenter depuis Apple** — dans `buildApplePassBuffer`, avant l'appel à `buildPassJson` (index `idx_scan_history_card_id` en place → requête bon marché) :

```ts
  // {visites} : total de scans de la carte (compteur à vie, best-effort).
  const { count: visites } = await supabaseAdmin
    .from("scan_history")
    .select("id", { count: "exact", head: true })
    .eq("card_id", cardId);
```

puis passer `visites: visites ?? 0` dans l'input. (Google : classe par marchand, jetons non résolus — limitation existante conservée, cf. spec.)

- [ ] **Step 5:** vitest ciblé PASS + `npx vitest run` complet.
- [ ] **Step 6: Commit** — `feat(wallet): jeton {visites} résolu côté serveur (COUNT scan_history)`

---

### Task 10: `{visites}` — Studio, éditeurs admin et previews

**Files:**
- Modify: `src/app/(app)/dashboard/studio/_components/FieldsSection.tsx:45-49` (liste `TOKENS`) et `:106` (placeholder)
- Modify: `src/app/(app)/admin/merchants/[id]/card/CardEditor.tsx:177-178` (aide) et `FieldList.tsx:108` (placeholder)
- Modify: `src/app/(app)/dashboard/studio/_components/WalletPreviews.tsx:20-28` (`SampleData` + `DEFAULT_SAMPLE`)
- Modify: `src/app/(app)/dashboard/studio/StudioClient.tsx:186-193` (`sample`)
- Modify: `src/app/(app)/admin/merchants/[id]/card/ApplePassPreview.tsx:6-14` et `GooglePassPreview.tsx:6-14` (`DEMO_SAMPLE`)

**Interfaces:**
- Consumes: résolution serveur (Task 9).
- Produces: `{visites}` insérable au Studio (chip + hint « Nombre total de passages ») et rendu dans les 3 previews avec une valeur d'exemple (ex. `12`).

- [ ] **Step 1:** ajouter à `TOKENS` : `{ token: '{visites}', hint: 'Nombre total de passages' }` ; compléter placeholders et textes d'aide admin avec `{visites}`.
- [ ] **Step 2:** étendre le type `SampleData` (+ `visites: string`) et TOUS les samples (`DEFAULT_SAMPLE`, `sample` de StudioClient, les deux `DEMO_SAMPLE`) avec `visites: '12'`. Les resolvers de preview utilisent déjà un regex générique — vérifier que la clé suffit.
- [ ] **Step 3:** `npx vitest run` + `npm run lint` ; contrôle visuel navigateur (mémoire projet : toute retouche UI se vérifie au navigateur — capture du Studio avec un champ `{visites}` + preview).
- [ ] **Step 4: Commit** — `feat(studio): variable {visites} insérable + previews`

---

### Task 11: Studio — section de configuration du programme points

**Files:**
- Create: `src/app/(app)/dashboard/studio/_components/PointsSection.tsx`
- Modify: `src/app/(app)/dashboard/studio/StudioClient.tsx` (remplacer le paragraphe statique L594-599 ; état `pointsRules` ; `publish()` L242-285 envoie `program`)
- Modify: `src/app/api/merchant/card-design/route.ts:69-110` (GET : exposer `loyaltyType` + `loyaltyConfig` dans le sous-objet merchant)
- Modify: `src/lib/cardDesign/studioValidation.ts:66-74` (exiger un champ `{points}` aussi pour `cardType === 'points'`)

**Interfaces:**
- Consumes: `buildLoyaltyUpdate` côté serveur (Task 4 — la route publish L51-56 accepte déjà `body.program`), `PointsConfig` (Task 1).
- Produces: composant contrôlé `PointsSection({ value, onChange }: { value: PointsRulesState; onChange: (v: PointsRulesState) => void })` avec `type PointsRulesState = { pointsPerScan: number; tiers: { threshold: number; reward: string }[]; expiration: { type: "none" } | { type: "fixed_date"; month: number; day: number } | { type: "rolling"; months: number } }` ; à la publication d'une carte `points`, `publish()` inclut `program: { type: "points", config: pointsRules }`.

- [ ] **Step 1: Écrire `PointsSection.tsx`** (client component, copy FR suisse, vouvoiement — style calqué sur `StampsSection.tsx` à lire d'abord) :

```tsx
"use client";

// Règles du programme « carte à points » (points fixes par scan, paliers cumulatifs).
// Composant contrôlé : l'état vit dans StudioClient, la validation de fond est
// serveur (buildLoyaltyUpdate) — ici seulement des gardes de saisie.
export type PointsRulesState = {
  pointsPerScan: number;
  tiers: { threshold: number; reward: string }[];
  expiration: { type: "none" } | { type: "fixed_date"; month: number; day: number } | { type: "rolling"; months: number };
};

export const DEFAULT_POINTS_RULES: PointsRulesState = {
  pointsPerScan: 10,
  tiers: [
    { threshold: 100, reward: "10% de réduction" },
    { threshold: 200, reward: "Un article offert" },
  ],
  expiration: { type: "none" },
};

export default function PointsSection({ value, onChange }: { value: PointsRulesState; onChange: (v: PointsRulesState) => void }) {
  const setTier = (i: number, patch: Partial<{ threshold: number; reward: string }>) =>
    onChange({ ...value, tiers: value.tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)) });

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium">Points gagnés par passage</label>
        <input
          type="number" min={1} max={1000} value={value.pointsPerScan}
          onChange={(e) => onChange({ ...value, pointsPerScan: Math.max(1, Math.min(1000, Number(e.target.value) || 1)) })}
          className="mt-1 w-24 rounded border px-2 py-1"
        />
      </div>

      <div>
        <p className="text-sm font-medium">Paliers de récompense</p>
        <p className="text-xs text-neutral-500">Le dernier palier est le maximum : sa validation remet le compteur à zéro.</p>
        {value.tiers.map((t, i) => (
          <div key={i} className="mt-2 flex items-center gap-2">
            <input
              type="number" min={1} value={t.threshold} aria-label={`Seuil du palier ${i + 1}`}
              onChange={(e) => setTier(i, { threshold: Math.max(1, Number(e.target.value) || 1) })}
              className="w-20 rounded border px-2 py-1"
            />
            <input
              type="text" maxLength={80} value={t.reward} placeholder="Ex. 10% de réduction" aria-label={`Offre du palier ${i + 1}`}
              onChange={(e) => setTier(i, { reward: e.target.value })}
              className="flex-1 rounded border px-2 py-1"
            />
            {value.tiers.length > 1 && (
              <button type="button" aria-label={`Supprimer le palier ${i + 1}`}
                onClick={() => onChange({ ...value, tiers: value.tiers.filter((_, j) => j !== i) })}
                className="text-sm text-red-600">Retirer</button>
            )}
          </div>
        ))}
        {value.tiers.length < 6 && (
          <button type="button"
            onClick={() => {
              const last = value.tiers[value.tiers.length - 1];
              onChange({ ...value, tiers: [...value.tiers, { threshold: (last?.threshold ?? 0) + 50, reward: "" }] });
            }}
            className="mt-2 text-sm font-medium text-emerald-700">+ Ajouter un palier</button>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium">Expiration des points</label>
        <select
          value={value.expiration.type}
          onChange={(e) => {
            const t = e.target.value;
            onChange({
              ...value,
              expiration: t === "rolling" ? { type: "rolling", months: 12 }
                : t === "fixed_date" ? { type: "fixed_date", month: 12, day: 31 }
                : { type: "none" },
            });
          }}
          className="mt-1 rounded border px-2 py-1"
        >
          <option value="none">Aucune expiration</option>
          <option value="fixed_date">Chaque année à date fixe</option>
          <option value="rolling">Après N mois d'ancienneté</option>
        </select>
        {value.expiration.type === "rolling" && (
          <label className="mt-2 block text-sm">
            Durée (mois)
            <input type="number" min={1} max={60} value={value.expiration.months}
              onChange={(e) => onChange({ ...value, expiration: { type: "rolling", months: Math.max(1, Math.min(60, Number(e.target.value) || 12)) } })}
              className="ml-2 w-20 rounded border px-2 py-1" />
          </label>
        )}
        {value.expiration.type === "fixed_date" && (
          <div className="mt-2 flex items-center gap-2 text-sm">
            <span>Chaque</span>
            <input type="number" min={1} max={31} value={value.expiration.day} aria-label="Jour"
              onChange={(e) => onChange({ ...value, expiration: { type: "fixed_date", month: (value.expiration as { month: number }).month, day: Math.max(1, Math.min(31, Number(e.target.value) || 31)) } })}
              className="w-16 rounded border px-2 py-1" />
            <span>/</span>
            <input type="number" min={1} max={12} value={value.expiration.month} aria-label="Mois"
              onChange={(e) => onChange({ ...value, expiration: { type: "fixed_date", month: Math.max(1, Math.min(12, Number(e.target.value) || 12)), day: (value.expiration as { day: number }).day } })}
              className="w-16 rounded border px-2 py-1" />
          </div>
        )}
      </div>
    </div>
  );
}
```

(Adapter les classes utilitaires au style réel des sections voisines après lecture de `StampsSection.tsx` — cohérence visuelle avant tout.)

- [ ] **Step 2: Câbler StudioClient** — état `const [pointsRules, setPointsRules] = useState<PointsRulesState>(DEFAULT_POINTS_RULES);`, initialisé depuis le GET si `merchant.loyaltyType === "points"` (config existante) ; remplacer le paragraphe statique (`cardType === 'points'`) par `<PointsSection value={pointsRules} onChange={setPointsRules} />` ; dans `publish()`, quand `cardType === 'points'`, inclure au body : `program: { type: "points", config: pointsRules, reward_label: <valeur existante du studio le cas échéant> }` (forme attendue par `buildLoyaltyUpdate` : `{ type, config: { pointsPerScan, tiers, expiration }, reward_label? }`).
- [ ] **Step 3: GET card-design** — exposer `loyaltyType: merchant.loyalty_type` et `loyaltyConfig: merchant.loyalty_config` dans le payload (étendre le `select` de la route si nécessaire ; tenancy déjà en place).
- [ ] **Step 4: studioValidation** — étendre la règle « au moins un champ `{points}` » à `cardType === 'points'` (même erreur bloquante que pour `stamps`).
- [ ] **Step 5:** `npx vitest run` + `npm run lint` + vérification navigateur (Studio : choisir « Carte à points », configurer 2 paliers, publier ; vérifier `merchants.loyalty_type/loyalty_config` via l'API, pas en devinant).
- [ ] **Step 6: Commit** — `feat(studio): configuration complète de la carte à points (points/scan, paliers, expiration)`

---

### Task 12: Comptoir — état des points + validation de récompense

**Files:**
- Modify: `src/app/(app)/dashboard/scan/_components/ComptoirScan.tsx` (gestion de la réponse `loyaltyType: "points"`)
- Modify: `src/app/(app)/dashboard/scan/_components/RedeemFullScreen.tsx` (liste de paliers validables)
- Modify: `src/app/(app)/dashboard/scan/page.tsx:25-57` (passer `programType` déjà résolu — vérifier qu'il couvre `points`)

**Interfaces:**
- Consumes: réponse scan (Task 5), redeem par palier (Task 6).
- Produces: UX inchangée pour un scan sans palier (toast « +N points — solde X / max ») ; si `rewardReady`, écran de validation listant `redeemableTiers` (un bouton par palier, le max marqué « remet la carte à zéro ») qui poste `{ cardId, tierThreshold }` sur `/api/scan/redeem`.

- [ ] **Step 1: Lire** `ComptoirScan.tsx` et `RedeemFullScreen.tsx` en entier (état `Mode` L13, `handleScan` L40-73, redeem existant L64-84).
- [ ] **Step 2: ComptoirScan** — dans le traitement de la réponse : si `data.loyaltyType === "points"` : afficher le résultat (`+{pointsAdded} points · {currentValue} / {maxThreshold}`) ; si `data.rewardReady`, stocker `data.redeemableTiers` dans l'état et passer en `mode = "reward"` ; sinon retour au scan continu (un scan = une action, invariant UX).
- [ ] **Step 3: RedeemFullScreen** — props additionnelles optionnelles `tiers?: { threshold: number; reward: string }[]` et `maxThreshold?: number` ; quand `tiers` est fourni, rendre un bouton par palier :

```tsx
{tiers.map((t) => (
  <button key={t.threshold} type="button" onClick={() => handleRedeemTier(t.threshold)} className={/* même style que le bouton OFFRIR existant */}>
    <span>{t.reward}</span>
    <span className="text-sm opacity-80">
      {t.threshold} points{t.threshold === maxThreshold ? " · remet la carte à zéro" : ""}
    </span>
  </button>
))}
```

`handleRedeemTier(threshold)` reprend le POST existant en ajoutant `tierThreshold: threshold` au body ; après succès : si `cycleReset`, message « Carte remise à zéro » ; sinon retirer le palier validé de la liste locale (les autres restent validables) et proposer « Terminer ». Sans `tiers` (cartes à tampons), comportement actuel inchangé.

- [ ] **Step 4:** `npx vitest run` + `npm run lint` + vérification navigateur du comptoir (compte démo — voir `~/Projects/HALO/COMPTES-DEMO.md`, jamais `NEXT_PUBLIC_E2E=1` en prod) : scan d'une carte points, franchissement d'un palier, validation intermédiaire puis validation max.
- [ ] **Step 5: Commit** — `feat(comptoir): affichage du solde points + validation de récompense par palier`

---

### Task 13: Expiration — cron quotidien + migration audit

**Files:**
- Create: `src/app/api/cron/points-expiry/route.ts`
- Create: `supabase/migrations/20260826_audit_actions_points.sql`
- Modify: `vercel.json` (3e entrée crons)
- Modify: `src/lib/admin/systemHealth.ts:7` (`CRON_JOBS` + `"points-expiry"`)
- Modify: `src/lib/auditLog.ts:7-66` (`AUDIT_ACTIONS` + `POINTS_EXPIRED`)

**Interfaces:**
- Consumes: `pointsCycleExpired`, `parseRedeemedTiers` (Task 2), `resolveLoyaltyProgram`, `recordCronRun`, pattern d'auth `CRON_SECRET` (modèle : `src/app/api/cron/campaigns/route.ts`).
- Produces: job quotidien qui remet à zéro (`points_balance = 0`, `redeemed_tiers = []`, `points_cycle_started_at = null`) les cartes expirées des marchands `points` avec expiration configurée, trace `POINTS_EXPIRED` par carte, push silencieux de refresh, `recordCronRun("points-expiry", …)`.

- [ ] **Step 1: Migration jumelle** — `supabase/migrations/20260826_audit_actions_points.sql` : copier INTÉGRALEMENT le bloc `ALTER TABLE … CHECK (action = ANY (ARRAY[ … ]))` de `20260618_audit_actions_demo.sql` (les 49 valeurs) et ajouter en fin de liste :

```sql
    -- Carte à points (2026-08-26)
    'POINTS_EXPIRED'
```

avec l'en-tête de commentaire habituel (jumelle invariant 1, à appliquer EN DERNIER, le fichier trie après `20260618_*`).

- [ ] **Step 2:** ajouter `"POINTS_EXPIRED",` à `AUDIT_ACTIONS` puis `npx vitest run src/lib/__tests__/auditActionsSync.test.ts` → PASS (le test lit la migration lexicalement la plus récente).

- [ ] **Step 3: Route cron**

```ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logAuditEvent } from "@/lib/auditLog";
import { recordCronRun } from "@/lib/cron/recordRun";
import { resolveLoyaltyProgram } from "@/lib/loyalty/resolveProgram";
import { pointsCycleExpired } from "@/lib/loyalty/points";
import { timingSafeEqualStr } from "@/lib/cron/auth"; // même helper que campaigns — vérifier le chemin réel dans campaigns/route.ts

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Expiration des cycles de points (spec 2026-08-26) : quotidien, idempotent
// (une carte remise à zéro a points_cycle_started_at = null → jamais re-touchée).
async function run(req: Request): Promise<NextResponse> {
  const startedAt = new Date();
  let reset = 0;
  try {
    const { data: merchants } = await supabaseAdmin
      .from("merchants")
      .select("id, loyalty_type, loyalty_config, stamp_goal")
      .eq("loyalty_type", "points");

    for (const m of merchants ?? []) {
      const program = resolveLoyaltyProgram(m);
      if (program.type !== "points" || !program.config.expiration || program.config.expiration.type === "none") continue;

      const { data: cards } = await supabaseAdmin
        .from("loyalty_cards")
        .select("id, points_balance, points_cycle_started_at")
        .eq("merchant_id", m.id) // invariant 3
        .not("points_cycle_started_at", "is", null);

      const now = new Date();
      const expired = (cards ?? []).filter((c) =>
        pointsCycleExpired(program.config.expiration, c.points_cycle_started_at ? new Date(c.points_cycle_started_at) : null, now)
      );
      for (const c of expired) {
        const { error } = await supabaseAdmin
          .from("loyalty_cards")
          .update({ points_balance: 0, redeemed_tiers: [], points_cycle_started_at: null })
          .eq("id", c.id)
          .eq("merchant_id", m.id);
        if (error) continue;
        reset++;
        await logAuditEvent({
          action: "POINTS_EXPIRED",
          merchant_id: m.id, card_id: c.id,
          details: { previous_balance: c.points_balance, expiration: program.config.expiration },
        });
      }
      if (expired.length > 0) {
        // Refresh silencieux des passes concernés (best-effort).
        try {
          const { getChannels } = await import("@/lib/wallet/channel");
          for (const ch of getChannels()) await ch.notify(expired.map((c) => c.id));
        } catch (e) {
          console.error("[points-expiry] push failed:", e);
        }
      }
    }
    await recordCronRun({ job: "points-expiry", status: "ok", startedAt, details: { reset } });
    return NextResponse.json({ ok: true, reset });
  } catch (e) {
    await recordCronRun({ job: "points-expiry", status: "error", startedAt, details: { reset } });
    console.error("[points-expiry]", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !timingSafeEqualStr(req.headers.get("authorization") ?? "", `Bearer ${secret}`))
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  return run(req);
}
export const GET = POST; // Vercel Cron déclenche en GET
```

Reprendre l'auth et la signature EXACTES de `src/app/api/cron/campaigns/route.ts` (le helper `timingSafeEqualStr` y est peut-être local — copier le vrai pattern, ne pas inventer d'import). Vérifier la signature réelle de `recordCronRun` (`src/lib/cron/recordRun.ts:7-25`).

- [ ] **Step 4:** `vercel.json` : ajouter `{ "path": "/api/cron/points-expiry", "schedule": "0 4 * * *" }` ; `systemHealth.ts` : ajouter `"points-expiry"` à `CRON_JOBS`.
- [ ] **Step 5:** `npx vitest run` complet + `npm run lint` ; test manuel local : `curl -X POST -H "Authorization: Bearer $CRON_SECRET" localhost:3000/api/cron/points-expiry`.
- [ ] **Step 6: Commit** — `feat(cron): expiration quotidienne des cycles de points + action POINTS_EXPIRED`

---

### Task 14: Vérification finale et intégration

- [ ] **Step 1:** `npx vitest run` (suite complète), `npm run lint`, `npm run build` — tout vert, sorties collées dans le compte-rendu (jamais d'affirmation sans preuve).
- [ ] **Step 2: Parcours navigateur complet** (mémoire projet : vérification au navigateur obligatoire) : Studio → carte points 2 paliers → publier ; comptoir → scans jusqu'au palier 1 → notification → validation intermédiaire → scans jusqu'au max → validation max → carte à zéro ; champ `{visites}` visible dans la preview.
- [ ] **Step 3:** Récapitulatif des DEUX migrations à appliquer en prod (dans l'ordre : `20260618_amount_points.sql` si absente — vérifier l'état réel d'abord, invariant 6 —, puis `20260826_points_card.sql`, puis `20260826_audit_actions_points.sql`) → à soumettre au user, JAMAIS appliquées sans son accord explicite.
- [ ] **Step 4:** Utiliser superpowers:requesting-code-review puis superpowers:finishing-a-development-branch (PR vers `main`, jamais de commit direct).

## Suivis hors périmètre (à noter en PR)

- `/api/scan/revert` ne décrémente pas `points_balance` (préexistant pour amount_points, inchangé ici).
- Option `points` dans le formulaire admin `EditMerchantForm` et l'onboarding wizard.
- Mise à jour de l'objet Google Wallet au scan (GoogleChannel stub).
