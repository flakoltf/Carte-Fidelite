# Moteur de fidélité multi-types — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à l'admin de choisir, par marchand, la mécanique de fidélité (carte à tampons, paliers de visites, niveaux), via un moteur pur `applyScan` qui généralise l'actuel `applyStamp`, sans casser l'existant.

**Architecture :** Un programme `{ type, config }` par marchand (colonnes `merchants.loyalty_type` + `loyalty_config`). Fonction pure `applyScan(program, count)` dispatchant vers 3 règles (`stamp_card`/`visit_based`/`tiered`). `loyalty_cards.stamps_count` réutilisé. Défaut `stamp_card` + fallback sur `merchants.stamp_goal` ⇒ rétro-compatibilité totale, zéro backfill.

**Tech Stack :** TypeScript, Next.js 16 (App Router, route handlers `params` async), Supabase (`supabaseAdmin` / `@supabase/ssr`), Vitest (logique pure).

**Spec :** `docs/superpowers/specs/2026-06-04-moteur-fidelite-design.md`

---

## File Structure

- `src/lib/loyalty/types.ts` — **créer** — types `LoyaltyProgram`, configs, `ScanResult`, `ScanEvent`.
- `src/lib/loyalty/engine.ts` — **créer** — `applyScan` + `programCanRedeem` (dispatch par type).
- `src/lib/loyalty/validate.ts` — **créer** — `validateLoyaltyProgram(type, rawConfig)`.
- `src/lib/loyalty/resolveProgram.ts` — **créer** — `resolveLoyaltyProgram(row)`.
- `src/lib/loyalty/stamp.ts` — **inchangé** — `applyStamp`/`canRedeem` réutilisés par l'engine.
- `src/lib/loyalty/__tests__/{engine,validate,resolveProgram}.test.ts` — **créer**.
- `supabase/migrations/20260604_loyalty_program.sql` — **créer** (appliquée par l'utilisateur).
- `src/app/api/scan/route.ts` — **modifier** — utiliser `applyScan` + `resolveLoyaltyProgram`.
- `src/app/api/redeem/route.ts` — **modifier** — `programCanRedeem`.
- `src/app/api/admin/merchants/[id]/route.ts` — **modifier** — valider + persister le programme.
- `src/app/admin/merchants/[id]/EditMerchantForm.tsx` — **modifier** — sélecteur de type + champs dynamiques.

> **Lot A** = Tasks 1–4 (pur, aucune BDD, livrable immédiatement).
> **Lot B** = Tasks 5–8 (dépendent de la migration appliquée par l'utilisateur).

---

## Task 1 : Types du programme de fidélité

**Files:**
- Create: `src/lib/loyalty/types.ts`

- [ ] **Step 1: Écrire les types**

```ts
export type LoyaltyType = "stamp_card" | "visit_based" | "tiered";

export type StampCardConfig = { goal: number };
export type VisitBasedConfig = { milestones: number[] };
export type Tier = { name: string; at: number };
export type TieredConfig = { tiers: Tier[] };

export type LoyaltyProgram =
  | { type: "stamp_card"; config: StampCardConfig }
  | { type: "visit_based"; config: VisitBasedConfig }
  | { type: "tiered"; config: TieredConfig };

export type ScanEvent =
  | { kind: "reward_ready" }
  | { kind: "milestone_reached"; at: number }
  | { kind: "tier_changed"; name: string };

export type ScanResult = {
  newCount: number;
  added: boolean;
  rewardReady: boolean;
  events: ScanEvent[];
};

export const LOYALTY_TYPES: readonly LoyaltyType[] = ["stamp_card", "visit_based", "tiered"];
```

- [ ] **Step 2: Vérifier la compilation**

Run: `cd ~/Projects/Carte-Fidelite-worktrees/loyalty-engine && npx tsc --noEmit -p tsconfig.json 2>&1 | head`
Expected: aucune erreur sur `types.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/loyalty/types.ts
git commit -m "feat(loyalty): program types (stamp/visit/tiered)"
```

---

## Task 2 : Moteur `applyScan` + `programCanRedeem`

**Files:**
- Create: `src/lib/loyalty/engine.ts`
- Test: `src/lib/loyalty/__tests__/engine.test.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
import { describe, it, expect } from "vitest";
import { applyScan, programCanRedeem } from "../engine";
import type { LoyaltyProgram } from "../types";

const stamp = (goal: number): LoyaltyProgram => ({ type: "stamp_card", config: { goal } });
const visit = (milestones: number[]): LoyaltyProgram => ({ type: "visit_based", config: { milestones } });
const tiered = (tiers: { name: string; at: number }[]): LoyaltyProgram => ({ type: "tiered", config: { tiers } });

describe("applyScan — stamp_card", () => {
  it("incrémente sous l'objectif (pas d'event)", () => {
    expect(applyScan(stamp(10), 3)).toEqual({ newCount: 4, added: true, rewardReady: false, events: [] });
  });
  it("atteint l'objectif → reward_ready + event", () => {
    expect(applyScan(stamp(10), 9)).toEqual({ newCount: 10, added: true, rewardReady: true, events: [{ kind: "reward_ready" }] });
  });
  it("carte déjà pleine → rien ajouté, prête, pas de nouvel event", () => {
    expect(applyScan(stamp(10), 10)).toEqual({ newCount: 10, added: false, rewardReady: true, events: [] });
  });
});

describe("applyScan — visit_based", () => {
  it("incrémente sans palier (toujours added, jamais reset)", () => {
    expect(applyScan(visit([5, 20]), 2)).toEqual({ newCount: 3, added: true, rewardReady: false, events: [] });
  });
  it("franchit un palier → reward_ready + milestone_reached", () => {
    expect(applyScan(visit([5, 20]), 4)).toEqual({ newCount: 5, added: true, rewardReady: true, events: [{ kind: "milestone_reached", at: 5 }] });
  });
  it("continue de compter au-delà d'un palier (jamais reset)", () => {
    expect(applyScan(visit([5, 20]), 5)).toEqual({ newCount: 6, added: true, rewardReady: false, events: [] });
  });
});

describe("applyScan — tiered", () => {
  const tiers = [{ name: "Bronze", at: 1 }, { name: "Argent", at: 5 }, { name: "Or", at: 10 }];
  it("montée de niveau → tier_changed", () => {
    expect(applyScan(tiered(tiers), 4)).toEqual({ newCount: 5, added: true, rewardReady: false, events: [{ kind: "tier_changed", name: "Argent" }] });
  });
  it("pas de montée → pas d'event", () => {
    expect(applyScan(tiered(tiers), 5)).toEqual({ newCount: 6, added: true, rewardReady: false, events: [] });
  });
  it("premier scan entre dans le 1er palier", () => {
    expect(applyScan(tiered(tiers), 0)).toEqual({ newCount: 1, added: true, rewardReady: false, events: [{ kind: "tier_changed", name: "Bronze" }] });
  });
});

describe("programCanRedeem", () => {
  it("stamp_card pleine → true", () => { expect(programCanRedeem(stamp(10), 10)).toBe(true); });
  it("stamp_card non pleine → false", () => { expect(programCanRedeem(stamp(10), 9)).toBe(false); });
  it("visit_based → toujours false", () => { expect(programCanRedeem(visit([5]), 5)).toBe(false); });
  it("tiered → toujours false", () => { expect(programCanRedeem(tiered([{ name: "X", at: 1 }]), 99)).toBe(false); });
});
```

- [ ] **Step 2: Lancer les tests → échec attendu**

Run: `npx vitest run src/lib/loyalty/__tests__/engine.test.ts`
Expected: FAIL (`applyScan is not a function`).

- [ ] **Step 3: Implémenter le moteur**

```ts
import { applyStamp, canRedeem } from "./stamp";
import type { LoyaltyProgram, ScanResult, Tier } from "./types";

function currentTier(tiers: Tier[], count: number): Tier | null {
  let result: Tier | null = null;
  for (const t of [...tiers].sort((a, b) => a.at - b.at)) if (count >= t.at) result = t;
  return result;
}

export function applyScan(program: LoyaltyProgram, currentCount: number): ScanResult {
  switch (program.type) {
    case "stamp_card": {
      const r = applyStamp(currentCount, program.config.goal);
      return {
        newCount: r.newStamps,
        added: r.added,
        rewardReady: r.rewardReady,
        events: r.added && r.rewardReady ? [{ kind: "reward_ready" }] : [],
      };
    }
    case "visit_based": {
      const next = currentCount + 1;
      const hit = program.config.milestones.includes(next);
      return {
        newCount: next,
        added: true,
        rewardReady: hit,
        events: hit ? [{ kind: "milestone_reached", at: next }] : [],
      };
    }
    case "tiered": {
      const next = currentCount + 1;
      const before = currentTier(program.config.tiers, currentCount);
      const after = currentTier(program.config.tiers, next);
      const changed = after !== null && after.name !== before?.name;
      return {
        newCount: next,
        added: true,
        rewardReady: false,
        events: changed ? [{ kind: "tier_changed", name: after.name }] : [],
      };
    }
  }
}

export function programCanRedeem(program: LoyaltyProgram, count: number): boolean {
  return program.type === "stamp_card" && canRedeem(count, program.config.goal);
}
```

- [ ] **Step 4: Lancer les tests → vert**

Run: `npx vitest run src/lib/loyalty/__tests__/engine.test.ts`
Expected: PASS (16 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/loyalty/engine.ts src/lib/loyalty/__tests__/engine.test.ts
git commit -m "feat(loyalty): pure applyScan engine + programCanRedeem"
```

---

## Task 3 : Validation `validateLoyaltyProgram`

**Files:**
- Create: `src/lib/loyalty/validate.ts`
- Test: `src/lib/loyalty/__tests__/validate.test.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
import { describe, it, expect } from "vitest";
import { validateLoyaltyProgram } from "../validate";

describe("validateLoyaltyProgram — stamp_card", () => {
  it("goal valide", () => {
    expect(validateLoyaltyProgram("stamp_card", { goal: 8 })).toEqual({ ok: true, program: { type: "stamp_card", config: { goal: 8 } } });
  });
  it("goal hors bornes → erreur", () => {
    expect(validateLoyaltyProgram("stamp_card", { goal: 0 }).ok).toBe(false);
    expect(validateLoyaltyProgram("stamp_card", { goal: 51 }).ok).toBe(false);
  });
});

describe("validateLoyaltyProgram — visit_based", () => {
  it("paliers croissants distincts valides", () => {
    expect(validateLoyaltyProgram("visit_based", { milestones: [5, 20, 50] })).toEqual({ ok: true, program: { type: "visit_based", config: { milestones: [5, 20, 50] } } });
  });
  it("vide → erreur", () => { expect(validateLoyaltyProgram("visit_based", { milestones: [] }).ok).toBe(false); });
  it("non strictement croissant → erreur", () => { expect(validateLoyaltyProgram("visit_based", { milestones: [5, 5] }).ok).toBe(false); });
  it("non entier positif → erreur", () => { expect(validateLoyaltyProgram("visit_based", { milestones: [0, 3] }).ok).toBe(false); });
});

describe("validateLoyaltyProgram — tiered", () => {
  it("paliers valides", () => {
    expect(validateLoyaltyProgram("tiered", { tiers: [{ name: "Bronze", at: 1 }, { name: "Or", at: 10 }] })).toEqual({ ok: true, program: { type: "tiered", config: { tiers: [{ name: "Bronze", at: 1 }, { name: "Or", at: 10 }] } } });
  });
  it("vide → erreur", () => { expect(validateLoyaltyProgram("tiered", { tiers: [] }).ok).toBe(false); });
  it("at non croissant → erreur", () => { expect(validateLoyaltyProgram("tiered", { tiers: [{ name: "A", at: 5 }, { name: "B", at: 5 }] }).ok).toBe(false); });
  it("nom vide → erreur", () => { expect(validateLoyaltyProgram("tiered", { tiers: [{ name: "", at: 1 }] }).ok).toBe(false); });
});

describe("validateLoyaltyProgram — type inconnu", () => {
  it("erreur", () => { expect(validateLoyaltyProgram("bidon", {}).ok).toBe(false); });
});
```

- [ ] **Step 2: Lancer les tests → échec attendu**

Run: `npx vitest run src/lib/loyalty/__tests__/validate.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implémenter la validation**

```ts
import type { LoyaltyProgram, LoyaltyType } from "./types";

export type ValidateResult = { ok: true; program: LoyaltyProgram } | { ok: false; error: string };

const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);
const strictAsc = (xs: number[]): boolean => xs.every((x, i) => i === 0 || x > xs[i - 1]);

export function validateLoyaltyProgram(type: unknown, raw: unknown): ValidateResult {
  const cfg = (raw ?? {}) as Record<string, unknown>;

  if (type === "stamp_card") {
    const goal = cfg.goal;
    if (!isInt(goal) || goal < 1 || goal > 50) return { ok: false, error: "Objectif carte invalide (1 à 50)." };
    return { ok: true, program: { type: "stamp_card", config: { goal } } };
  }

  if (type === "visit_based") {
    const ms = cfg.milestones;
    if (!Array.isArray(ms) || ms.length === 0 || ms.length > 10) return { ok: false, error: "Paliers : 1 à 10 valeurs." };
    if (!ms.every((m) => isInt(m) && m > 0)) return { ok: false, error: "Chaque palier doit être un entier > 0." };
    if (!strictAsc(ms as number[])) return { ok: false, error: "Paliers strictement croissants et distincts." };
    return { ok: true, program: { type: "visit_based", config: { milestones: ms as number[] } } };
  }

  if (type === "tiered") {
    const tiers = cfg.tiers;
    if (!Array.isArray(tiers) || tiers.length === 0 || tiers.length > 6) return { ok: false, error: "Niveaux : 1 à 6." };
    const cleaned: { name: string; at: number }[] = [];
    for (const t of tiers) {
      const name = (t as Record<string, unknown>)?.name;
      const at = (t as Record<string, unknown>)?.at;
      if (typeof name !== "string" || name.trim().length < 1 || name.length > 40) return { ok: false, error: "Nom de niveau invalide (1 à 40 caractères)." };
      if (!isInt(at) || at < 1) return { ok: false, error: "Seuil de niveau invalide (entier > 0)." };
      cleaned.push({ name: name.trim(), at });
    }
    if (!strictAsc(cleaned.map((t) => t.at))) return { ok: false, error: "Seuils de niveaux strictement croissants et distincts." };
    return { ok: true, program: { type: "tiered", config: { tiers: cleaned } } };
  }

  return { ok: false, error: "Type de programme inconnu." };
}
```

- [ ] **Step 4: Lancer les tests → vert**

Run: `npx vitest run src/lib/loyalty/__tests__/validate.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/loyalty/validate.ts src/lib/loyalty/__tests__/validate.test.ts
git commit -m "feat(loyalty): validateLoyaltyProgram for the 3 types"
```

---

## Task 4 : Résolution depuis la BDD `resolveLoyaltyProgram`

**Files:**
- Create: `src/lib/loyalty/resolveProgram.ts`
- Test: `src/lib/loyalty/__tests__/resolveProgram.test.ts`

- [ ] **Step 1: Écrire les tests qui échouent**

```ts
import { describe, it, expect } from "vitest";
import { resolveLoyaltyProgram } from "../resolveProgram";

describe("resolveLoyaltyProgram", () => {
  it("null → stamp_card avec goal par défaut", () => {
    expect(resolveLoyaltyProgram(null)).toEqual({ type: "stamp_card", config: { goal: 10 } });
  });
  it("type absent → stamp_card, goal depuis stamp_goal", () => {
    expect(resolveLoyaltyProgram({ loyalty_type: null, loyalty_config: null, stamp_goal: 8 })).toEqual({ type: "stamp_card", config: { goal: 8 } });
  });
  it("stamp_card : config.goal prioritaire sur stamp_goal", () => {
    expect(resolveLoyaltyProgram({ loyalty_type: "stamp_card", loyalty_config: { goal: 6 }, stamp_goal: 12 })).toEqual({ type: "stamp_card", config: { goal: 6 } });
  });
  it("visit_based valide", () => {
    expect(resolveLoyaltyProgram({ loyalty_type: "visit_based", loyalty_config: { milestones: [5, 20] }, stamp_goal: 10 })).toEqual({ type: "visit_based", config: { milestones: [5, 20] } });
  });
  it("tiered valide", () => {
    expect(resolveLoyaltyProgram({ loyalty_type: "tiered", loyalty_config: { tiers: [{ name: "Or", at: 10 }] }, stamp_goal: 10 })).toEqual({ type: "tiered", config: { tiers: [{ name: "Or", at: 10 }] } });
  });
  it("type connu mais config corrompue → repli stamp_card", () => {
    expect(resolveLoyaltyProgram({ loyalty_type: "visit_based", loyalty_config: { milestones: "oops" }, stamp_goal: 9 })).toEqual({ type: "stamp_card", config: { goal: 9 } });
  });
});
```

- [ ] **Step 2: Lancer les tests → échec attendu**

Run: `npx vitest run src/lib/loyalty/__tests__/resolveProgram.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implémenter le resolver (réutilise la validation)**

```ts
import { DEFAULT_STAMP_GOAL } from "@/lib/merchant-config/types";
import { validateLoyaltyProgram } from "./validate";
import type { LoyaltyProgram } from "./types";

export type MerchantProgramRow = {
  loyalty_type: string | null;
  loyalty_config: unknown;
  stamp_goal: number | null;
};

export function resolveLoyaltyProgram(row: MerchantProgramRow | null): LoyaltyProgram {
  const goal = typeof row?.stamp_goal === "number" && Number.isInteger(row.stamp_goal) ? row.stamp_goal : DEFAULT_STAMP_GOAL;
  const fallback: LoyaltyProgram = { type: "stamp_card", config: { goal } };

  const type = row?.loyalty_type;
  if (type === "visit_based" || type === "tiered") {
    const v = validateLoyaltyProgram(type, row?.loyalty_config);
    return v.ok ? v.program : fallback;
  }
  if (type === "stamp_card") {
    const cfg = (row?.loyalty_config ?? {}) as Record<string, unknown>;
    const g = cfg.goal;
    return { type: "stamp_card", config: { goal: typeof g === "number" && Number.isInteger(g) && g >= 1 && g <= 50 ? g : goal } };
  }
  return fallback;
}
```

- [ ] **Step 4: Lancer les tests → vert**

Run: `npx vitest run src/lib/loyalty/__tests__/resolveProgram.test.ts`
Expected: PASS.

- [ ] **Step 5: Suite complète + commit**

Run: `npx vitest run`
Expected: tous verts (existants + ~30 nouveaux).

```bash
git add src/lib/loyalty/resolveProgram.ts src/lib/loyalty/__tests__/resolveProgram.test.ts
git commit -m "feat(loyalty): resolveLoyaltyProgram from merchant row (stamp_card fallback)"
```

> **barrière Lot A/B** — Tasks 1–4 livrées et testées. Les tâches suivantes dépendent de la migration.

---

## Task 5 : Migration (écrite ici, APPLIQUÉE PAR L'UTILISATEUR)

**Files:**
- Create: `supabase/migrations/20260604_loyalty_program.sql`

- [ ] **Step 1: Écrire la migration**

```sql
-- Moteur de fidélité multi-types : type + config par marchand.
-- Rétro-compatible : défaut stamp_card, goal reste lu sur merchants.stamp_goal.
alter table merchants
  add column if not exists loyalty_type text not null default 'stamp_card',
  add column if not exists loyalty_config jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'merchants_loyalty_type_chk') then
    alter table merchants
      add constraint merchants_loyalty_type_chk
      check (loyalty_type in ('stamp_card','visit_based','tiered'));
  end if;
end $$;
```

- [ ] **Step 2: Commit (sans appliquer)**

```bash
git add supabase/migrations/20260604_loyalty_program.sql
git commit -m "feat(loyalty): migration loyalty_type + loyalty_config (à appliquer)"
```

- [ ] **Step 3: ⛔ STOP — demander le feu vert à l'utilisateur**

Base PROD partagée → **ne pas appliquer soi-même**. Présenter le SQL et attendre l'accord explicite.
Une fois approuvée, l'appliquer via `mcp__claude_ai_Supabase__apply_migration` (projet `oqcelbbozpykwkasjtqy`)
ou la laisser appliquer par l'utilisateur. **Tasks 6–8 ne tournent en runtime qu'après application.**

---

## Task 6 : Câbler `/api/scan` sur le moteur

**Files:**
- Modify: `src/app/api/scan/route.ts`

- [ ] **Step 1: Charger le programme et remplacer applyStamp**

Récupérer les colonnes nécessaires dans le `select` du marchand, puis dispatcher.
Remplacer le bloc actuel autour de `applyStamp` :

```ts
// imports (haut du fichier)
import { applyScan } from "@/lib/loyalty/engine";
import { resolveLoyaltyProgram } from "@/lib/loyalty/resolveProgram";
```

Modifier la requête marchand pour lire le programme :

```ts
const { data: merchant } = await supabaseAdmin
  .from("merchants")
  .select("id, loyalty_type, loyalty_config, stamp_goal")
  .eq("user_id", user.id)
  .single();
if (!merchant) return NextResponse.json({ error: "Profil marchand manquant" }, { status: 400 });
```

Remplacer le calcul des tampons :

```ts
const program = resolveLoyaltyProgram(merchant);
const { newCount, added, rewardReady, events } = applyScan(program, card.stamps_count);

// stamp_card pleine → rien à incrémenter, on propose juste d'encaisser.
if (!added) {
  return NextResponse.json({
    success: true, card, rewardReady: true, rewardUnlocked: true, added: false,
    stampGoal: cfg.stampGoal, loyaltyType: program.type, events: [],
  });
}
```

Et dans l'update + la réponse finale, utiliser `newCount` au lieu de `newStamps`, et exposer le type/events :

```ts
const { data: updatedCard, error: updateError } = await supabaseAdmin
  .from("loyalty_cards")
  .update({ stamps_count: newCount, last_scan: new Date().toISOString() })
  .eq("id", actualCardId).select("*, customers(*)").single();
// ...
const response = {
  success: true, card: updatedCard, rewardReady, rewardUnlocked: rewardReady, added: true,
  stampGoal: cfg.stampGoal, loyaltyType: program.type, events,
};
```

> `cfg.stampGoal` reste fourni pour l'UI tampons existante (inchangée). `events`/`loyaltyType` sont additifs.

- [ ] **Step 2: Build / typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -i "scan/route" || echo "scan route OK"`
Expected: pas d'erreur de type sur le fichier.

- [ ] **Step 3: Fumée manuelle (après migration appliquée)**

Avec le compte démo marchand, scanner une carte stamp_card → comportement identique à avant
(+1 tampon, prête au goal). Vérifier la réponse JSON contient `loyaltyType: "stamp_card"`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/scan/route.ts
git commit -m "feat(scan): drive scan through applyScan loyalty engine"
```

---

## Task 7 : `/api/redeem` via `programCanRedeem`

**Files:**
- Modify: `src/app/api/redeem/route.ts`

- [ ] **Step 1: Remplacer canRedeem par programCanRedeem**

```ts
// imports
import { applyScan } from "@/lib/loyalty/engine"; // non requis si seul programCanRedeem est utilisé
import { programCanRedeem } from "@/lib/loyalty/engine";
import { resolveLoyaltyProgram } from "@/lib/loyalty/resolveProgram";
```

Lire le programme du marchand :

```ts
const { data: merchant } = await supabaseAdmin
  .from("merchants")
  .select("id, loyalty_type, loyalty_config, stamp_goal")
  .eq("user_id", user.id)
  .single();
if (!merchant) return NextResponse.json({ error: "Profil marchand manquant" }, { status: 400 });
```

Remplacer le contrôle d'encaissement :

```ts
const program = resolveLoyaltyProgram(merchant);
if (!programCanRedeem(program, card.stamps_count)) {
  return NextResponse.json(
    { error: program.type === "stamp_card" ? "Carte non complète" : "Ce programme n'a pas d'encaissement." },
    { status: 409 }
  );
}
```

> Le reset à 0 et le reste de la route restent inchangés (ne s'exécute que pour stamp_card via le garde ci-dessus). Retirer l'import désormais inutilisé `canRedeem` + `fetchMerchantConfig` si `stampGoal` n'est plus référencé dans le `details` d'audit (sinon garder et logger `program.type`).

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -i "redeem/route" || echo "redeem route OK"`
Expected: pas d'erreur.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/redeem/route.ts
git commit -m "feat(redeem): gate redemption on programCanRedeem (stamp_card only)"
```

---

## Task 8 : Admin — sélecteur de type + champs dynamiques

**Files:**
- Modify: `src/app/api/admin/merchants/[id]/route.ts`
- Modify: `src/app/admin/merchants/[id]/EditMerchantForm.tsx`

- [ ] **Step 1: API — valider et persister le programme**

Dans le PATCH, après le bloc `body.stampGoal` existant, ajouter un bloc additif :

```ts
if (body.loyaltyType !== undefined) {
  const { validateLoyaltyProgram } = await import("@/lib/loyalty/validate");
  const v = validateLoyaltyProgram(body.loyaltyType, body.loyaltyConfig);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
  update.loyalty_type = v.program.type;
  update.loyalty_config = v.program.config;
  // garder merchants.stamp_goal synchro pour la rétro-compat de l'UI tampons
  if (v.program.type === "stamp_card") update.stamp_goal = v.program.config.goal;
}
```

- [ ] **Step 2: UI — état + sélecteur**

Dans `EditMerchantForm.tsx`, ajouter un état `loyaltyType` (initialisé depuis la prop marchand, défaut `"stamp_card"`) et les champs dynamiques :
- `stamp_card` : réutilise le champ « Objectif carte » existant (`stampGoal`).
- `visit_based` : input texte « Paliers (ex : 5, 20, 50) » → parser en `number[]`.
- `tiered` : liste éditable de `{ name, at }` (ajouter/retirer une ligne).

Au submit, inclure dans le body : `loyaltyType` et `loyaltyConfig` (`{ goal }` | `{ milestones }` | `{ tiers }`).

```tsx
// extrait — sélecteur de type
<label className="text-sm font-medium text-zinc-400 ml-1">Type de programme</label>
<select
  value={loyaltyType}
  onChange={(e) => setLoyaltyType(e.target.value as "stamp_card" | "visit_based" | "tiered")}
  className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3 px-4 outline-none"
>
  <option value="stamp_card">Carte à tampons (objectif)</option>
  <option value="visit_based">Paliers de visites (récompenses successives)</option>
  <option value="tiered">Niveaux de fidélité (statuts)</option>
</select>
```

> Garder le thème **zinc actuel** (le skin HALO Light de l'admin est hors v1, cf. spec).
> Construire `loyaltyConfig` côté client selon `loyaltyType` ; la validation serveur fait foi.

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit 2>&1 | grep -iE "EditMerchantForm|admin/merchants" || echo "admin OK"`
Run: `npm run build 2>&1 | tail -5`
Expected: build OK.

- [ ] **Step 4: Fumée manuelle (après migration)**

`/admin/merchants/[id]` : choisir « Paliers de visites », saisir `5, 20, 50`, enregistrer → recharger,
la sélection persiste. Scanner une carte de ce marchand → compteur cumulatif, message au palier 5.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/merchants/[id]/route.ts src/app/admin/merchants/[id]/EditMerchantForm.tsx
git commit -m "feat(admin): per-merchant loyalty program selector + dynamic config"
```

---

## Self-Review (rempli par l'auteur du plan)

- **Couverture spec :** stamp/visit/tiered (T2), validation (T3), résolution + fallback (T4), migration (T5), scan (T6), redeem (T7), admin UI+API (T8). ✅
- **Pas de placeholder :** code complet à chaque step. ✅
- **Cohérence des types :** `ScanResult {newCount, added, rewardReady, events}`, `validateLoyaltyProgram → {ok, program}`, `resolveLoyaltyProgram(row) → LoyaltyProgram`, `programCanRedeem(program, count)` — noms identiques de T1 à T8. ✅
- **Rétro-compat :** défaut `stamp_card` + fallback `stamp_goal` ; Lot A sans BDD ; migration `add column if not exists` + `default`. ✅

## Notes d'exécution

- Worktree isolé `feature/loyalty-engine` depuis `feat/public-enrollment` (cf. méthode worktrees du projet : fallback `git worktree add` hors dépôt, copier `.env.local`, `npm install`, baseline `npx vitest run`).
- **Lot A (T1–T4)** déployable et testable immédiatement, sans toucher la BDD.
- **Lot B (T6–T8)** ne s'active en runtime qu'**après application de la migration (T5) par l'utilisateur**.
