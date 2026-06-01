# Sous-projet 1 — Config marchand par l'admin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre paramétrables par marchand (via l'admin) l'objectif de carte (nb de tampons), 4 seuils de segmentation, le métier et le branding, en remplaçant les constantes figées (le « 10 ») par une config résolue — sans rien casser pour les marchands non configurés.

**Architecture:** Un module pur `merchant-config/` (défauts centralisés + `resolveMerchantConfig` + `validateMerchantConfig`) et un helper DB `fetchMerchantConfig`. Les consommateurs (segmentation, analytique, pass Wallet) reçoivent les valeurs résolues au lieu de constantes. L'admin édite via le formulaire marchand existant + la route `PATCH` étendue. Une migration ajoute `stamp_goal` + `segment_config` sur `merchants`.

**Tech Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Supabase `@supabase/ssr` (RLS) + service-role (admin) · Vitest · Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-06-01-admin-merchant-config-design.md`

---

## File Structure

```
supabase/migrations/20260601_merchant_config.sql      # NEW (créée, PAS appliquée par le sous-agent)
src/lib/merchant-config/
  types.ts        # défauts + types (DEFAULT_STAMP_GOAL, DEFAULT_THRESHOLDS, DEFAULT_MERCHANT_CONFIG, BUSINESS_TYPES)
  resolve.ts      # PUR : resolveMerchantConfig(row)
  validate.ts     # PUR : validateMerchantConfig(input)
  fetch.ts        # DB : fetchMerchantConfig(merchantId) (RLS)
  __tests__/{resolve,validate}.test.ts
src/lib/segments/classify.ts        # MODIFY : classifyCustomer(stats, now, cfg)
src/lib/segments/types.ts           # MODIFY : retirer les constantes désormais dans merchant-config
src/lib/segments/fetch.ts           # MODIFY : charge cfg + passe à classifyCustomer
src/lib/segments/__tests__/classify.test.ts  # MODIFY : passe un cfg
src/lib/analytics/kpis.ts           # MODIFY : seuil = stamp_goal du marchand
src/lib/analytics/rewards.ts        # MODIFY : seuil = stamp_goal du marchand
src/lib/analytics/types.ts          # MODIFY : retirer REWARD_THRESHOLD (inutilisé)
src/lib/wallet/passJson.ts          # MODIFY : libellé "X / <stampGoal>"
src/lib/wallet/__tests__/passJson.test.ts  # MODIFY : test du libellé
src/lib/applePass.ts                # MODIFY : lit stamp_goal de la carte, le passe
src/app/api/admin/merchants/[id]/route.ts  # MODIFY : accepte + valide la config
src/app/admin/merchants/[id]/EditMerchantForm.tsx  # MODIFY : section "Programme & segmentation"
src/app/admin/merchants/[id]/page.tsx              # MODIFY : select + passe la config
```

**Réutilisé (DRY) :** `createClient` (`@/utils/supabase/server`), `supabaseAdmin` (`@/lib/supabaseAdmin`), `requireAdminApi` (`@/lib/adminAuth`), `computeRewards`/`computeKpis` (prennent déjà le seuil en paramètre).

---

### Task 1: Migration BDD (créer, NE PAS appliquer)

**Files:** Create `supabase/migrations/20260601_merchant_config.sql`

- [ ] **Step 1: Écrire la migration**
```sql
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS stamp_goal INT NOT NULL DEFAULT 10;
ALTER TABLE merchants ADD CONSTRAINT merchants_stamp_goal_range CHECK (stamp_goal BETWEEN 1 AND 50);
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS segment_config JSONB;
```

- [ ] **Step 2: NE PAS appliquer** — créer le fichier seulement. L'application en prod (projet WalletCard `oqcelbbozpykwkasjtqy`) est faite par le contrôleur avec le consentement utilisateur, hors de ce sous-agent.

- [ ] **Step 3: Commit**
```bash
git add supabase/migrations/20260601_merchant_config.sql
git commit -m "feat(db): per-merchant stamp_goal + segment_config"
```

---

### Task 2: `merchant-config/types.ts` (défauts centralisés)

**Files:** Create `src/lib/merchant-config/types.ts`

> Pas de test dédié (constantes/types). Vérifié par les tasks suivantes qui l'importent.

- [ ] **Step 1: Implémenter**
```ts
export const DEFAULT_STAMP_GOAL = 10;

export type ResolvedSegmentThresholds = {
  activeDays: number;
  atRiskDays: number;
  vipVisits: number;
  newTenureDays: number;
};

export const DEFAULT_THRESHOLDS: ResolvedSegmentThresholds = {
  activeDays: 30,
  atRiskDays: 90,
  vipVisits: 10,
  newTenureDays: 30,
};

export type ResolvedMerchantConfig = {
  stampGoal: number;
  thresholds: ResolvedSegmentThresholds;
};

export const DEFAULT_MERCHANT_CONFIG: ResolvedMerchantConfig = {
  stampGoal: DEFAULT_STAMP_GOAL,
  thresholds: DEFAULT_THRESHOLDS,
};

// Métiers connus (preset dashboard).
export const BUSINESS_TYPES = ["cafe", "restaurant", "boulangerie", "boutique", "salon", "sport", "autre"] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];
```

- [ ] **Step 2: Vérifier la compilation** — Run: `cd ~/Projects/Carte-Fidelite && npx tsc --noEmit` → pas d'erreur sur ce fichier.

- [ ] **Step 3: Commit**
```bash
git add src/lib/merchant-config/types.ts
git commit -m "feat(merchant-config): centralized defaults and types"
```

---

### Task 3: `resolveMerchantConfig` (pur)

**Files:** Create `src/lib/merchant-config/resolve.ts`, Test `src/lib/merchant-config/__tests__/resolve.test.ts`

- [ ] **Step 1: Test (échoue d'abord)**
```ts
import { describe, it, expect } from "vitest";
import { resolveMerchantConfig } from "@/lib/merchant-config/resolve";
import { DEFAULT_MERCHANT_CONFIG } from "@/lib/merchant-config/types";

describe("resolveMerchantConfig", () => {
  it("ligne nulle -> défauts", () => {
    expect(resolveMerchantConfig(null)).toEqual(DEFAULT_MERCHANT_CONFIG);
  });
  it("stamp_goal nul + segment_config nul -> défauts", () => {
    expect(resolveMerchantConfig({ stamp_goal: null, segment_config: null })).toEqual(DEFAULT_MERCHANT_CONFIG);
  });
  it("config partielle -> comble les champs manquants", () => {
    const r = resolveMerchantConfig({ stamp_goal: 8, segment_config: { at_risk_days: 60 } });
    expect(r.stampGoal).toBe(8);
    expect(r.thresholds.atRiskDays).toBe(60);
    expect(r.thresholds.activeDays).toBe(30); // défaut
    expect(r.thresholds.vipVisits).toBe(10);  // défaut
  });
  it("config pleine -> valeurs respectées", () => {
    const r = resolveMerchantConfig({
      stamp_goal: 12,
      segment_config: { active_days: 14, at_risk_days: 45, vip_visits: 6, new_tenure_days: 7 },
    });
    expect(r).toEqual({ stampGoal: 12, thresholds: { activeDays: 14, atRiskDays: 45, vipVisits: 6, newTenureDays: 7 } });
  });
});
```

- [ ] **Step 2: Vérifier l'échec** — Run: `npm test -- resolve` → FAIL.

- [ ] **Step 3: Implémenter**
```ts
import { DEFAULT_STAMP_GOAL, DEFAULT_THRESHOLDS, type ResolvedMerchantConfig } from "./types";

export type MerchantConfigRow = { stamp_goal: number | null; segment_config: unknown };

const num = (v: unknown, d: number): number => (typeof v === "number" && Number.isFinite(v) ? v : d);

export function resolveMerchantConfig(row: MerchantConfigRow | null): ResolvedMerchantConfig {
  const sc = (row?.segment_config ?? {}) as Record<string, unknown>;
  return {
    stampGoal: num(row?.stamp_goal, DEFAULT_STAMP_GOAL),
    thresholds: {
      activeDays: num(sc.active_days, DEFAULT_THRESHOLDS.activeDays),
      atRiskDays: num(sc.at_risk_days, DEFAULT_THRESHOLDS.atRiskDays),
      vipVisits: num(sc.vip_visits, DEFAULT_THRESHOLDS.vipVisits),
      newTenureDays: num(sc.new_tenure_days, DEFAULT_THRESHOLDS.newTenureDays),
    },
  };
}
```

- [ ] **Step 4: Vérifier le succès** — Run: `npm test -- resolve` → PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/merchant-config/resolve.ts src/lib/merchant-config/__tests__/resolve.test.ts
git commit -m "feat(merchant-config): resolve merchant config with defaults"
```

---

### Task 4: `validateMerchantConfig` (pur)

**Files:** Create `src/lib/merchant-config/validate.ts`, Test `src/lib/merchant-config/__tests__/validate.test.ts`

- [ ] **Step 1: Test (échoue d'abord)**
```ts
import { describe, it, expect } from "vitest";
import { validateMerchantConfig } from "@/lib/merchant-config/validate";

const base = {
  stampGoal: 10, businessType: "cafe", primaryColor: "#10b981", logoUrl: "",
  activeDays: 30, atRiskDays: 90, vipVisits: 10, newTenureDays: 30,
};

describe("validateMerchantConfig", () => {
  it("entrée valide -> ok + segmentConfig en snake_case", () => {
    const r = validateMerchantConfig(base);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.stampGoal).toBe(10);
      expect(r.value.logoUrl).toBeNull();
      expect(r.value.segmentConfig).toEqual({ active_days: 30, at_risk_days: 90, vip_visits: 10, new_tenure_days: 30 });
    }
  });
  it("stamp_goal hors bornes -> erreur", () => {
    expect(validateMerchantConfig({ ...base, stampGoal: 0 }).ok).toBe(false);
    expect(validateMerchantConfig({ ...base, stampGoal: 51 }).ok).toBe(false);
    expect(validateMerchantConfig({ ...base, stampGoal: 3.5 }).ok).toBe(false);
  });
  it("at_risk <= active -> erreur", () => {
    expect(validateMerchantConfig({ ...base, atRiskDays: 30 }).ok).toBe(false);
  });
  it("métier inconnu -> erreur", () => {
    expect(validateMerchantConfig({ ...base, businessType: "garage" }).ok).toBe(false);
  });
  it("couleur invalide -> erreur", () => {
    expect(validateMerchantConfig({ ...base, primaryColor: "vert" }).ok).toBe(false);
  });
  it("logo URL invalide -> erreur ; URL http(s) -> ok", () => {
    expect(validateMerchantConfig({ ...base, logoUrl: "abc" }).ok).toBe(false);
    expect(validateMerchantConfig({ ...base, logoUrl: "https://x/l.png" }).ok).toBe(true);
  });
  it("vip_visits / new_tenure_days < 1 -> erreur", () => {
    expect(validateMerchantConfig({ ...base, vipVisits: 0 }).ok).toBe(false);
    expect(validateMerchantConfig({ ...base, newTenureDays: 0 }).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Vérifier l'échec** — Run: `npm test -- validate` → FAIL.

- [ ] **Step 3: Implémenter**
```ts
import { BUSINESS_TYPES } from "./types";

export type MerchantConfigInput = {
  stampGoal?: unknown; businessType?: unknown; primaryColor?: unknown; logoUrl?: unknown;
  activeDays?: unknown; atRiskDays?: unknown; vipVisits?: unknown; newTenureDays?: unknown;
};

export type ValidatedMerchantConfig = {
  stampGoal: number; businessType: string; primaryColor: string; logoUrl: string | null;
  segmentConfig: { active_days: number; at_risk_days: number; vip_visits: number; new_tenure_days: number };
};

export type ValidateResult = { ok: true; value: ValidatedMerchantConfig } | { ok: false; error: string };

const isInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);

export function validateMerchantConfig(input: MerchantConfigInput): ValidateResult {
  if (!isInt(input.stampGoal) || input.stampGoal < 1 || input.stampGoal > 50)
    return { ok: false, error: "Objectif carte invalide (1 à 50)." };
  if (typeof input.businessType !== "string" || !(BUSINESS_TYPES as readonly string[]).includes(input.businessType))
    return { ok: false, error: "Métier inconnu." };
  if (typeof input.primaryColor !== "string" || !/^#[0-9a-fA-F]{6}$/.test(input.primaryColor))
    return { ok: false, error: "Couleur invalide (format #rrggbb)." };
  let logoUrl: string | null = null;
  if (input.logoUrl !== undefined && input.logoUrl !== null && input.logoUrl !== "") {
    if (typeof input.logoUrl !== "string" || !/^https?:\/\/.+/.test(input.logoUrl))
      return { ok: false, error: "URL de logo invalide." };
    logoUrl = input.logoUrl;
  }
  if (!isInt(input.activeDays) || input.activeDays < 1)
    return { ok: false, error: "Jours « actif » invalide (≥ 1)." };
  if (!isInt(input.atRiskDays) || input.atRiskDays <= input.activeDays)
    return { ok: false, error: "Jours « à risque » doit dépasser « actif »." };
  if (!isInt(input.vipVisits) || input.vipVisits < 1)
    return { ok: false, error: "Visites VIP invalide (≥ 1)." };
  if (!isInt(input.newTenureDays) || input.newTenureDays < 1)
    return { ok: false, error: "Ancienneté « nouveau » invalide (≥ 1)." };
  return {
    ok: true,
    value: {
      stampGoal: input.stampGoal, businessType: input.businessType,
      primaryColor: input.primaryColor, logoUrl,
      segmentConfig: {
        active_days: input.activeDays, at_risk_days: input.atRiskDays,
        vip_visits: input.vipVisits, new_tenure_days: input.newTenureDays,
      },
    },
  };
}
```

- [ ] **Step 4: Vérifier le succès** — Run: `npm test -- validate` → PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/merchant-config/validate.ts src/lib/merchant-config/__tests__/validate.test.ts
git commit -m "feat(merchant-config): validate admin config input"
```

---

### Task 5: `fetchMerchantConfig` (DB, RLS)

**Files:** Create `src/lib/merchant-config/fetch.ts`

> Pas de test unitaire (touche la DB). Vérifié par build + les tasks consommatrices.

- [ ] **Step 1: Implémenter**
```ts
import { createClient } from "@/utils/supabase/server";
import { resolveMerchantConfig } from "./resolve";
import { type ResolvedMerchantConfig } from "./types";

export async function fetchMerchantConfig(merchantId: string): Promise<ResolvedMerchantConfig> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("merchants")
    .select("stamp_goal, segment_config")
    .eq("id", merchantId)
    .single();
  return resolveMerchantConfig(data ?? null);
}
```

- [ ] **Step 2: Build** — Run: `npm run build` → « Compiled successfully ».

- [ ] **Step 3: Commit**
```bash
git add src/lib/merchant-config/fetch.ts
git commit -m "feat(merchant-config): fetch resolved config for a merchant"
```

---

### Task 6: Segmentation — `classifyCustomer` paramétré

**Files:** Modify `src/lib/segments/classify.ts`, `src/lib/segments/types.ts`, `src/lib/segments/__tests__/classify.test.ts`

- [ ] **Step 1: Mettre à jour le test (échoue d'abord)**

Dans `src/lib/segments/__tests__/classify.test.ts` :
1. Ajouter en tête : `import { DEFAULT_MERCHANT_CONFIG, type ResolvedMerchantConfig } from "@/lib/merchant-config/types";`
2. Remplacer **tous** les appels `classifyCustomer(stats(...), NOW)` par `classifyCustomer(stats(...), NOW, DEFAULT_MERCHANT_CONFIG)`.
3. Ajouter ce bloc de tests « config custom » à la fin du fichier :
```ts
describe("classifyCustomer — config marchand custom", () => {
  const cfg: ResolvedMerchantConfig = {
    stampGoal: 8,
    thresholds: { activeDays: 14, atRiskDays: 60, vipVisits: 5, newTenureDays: 7 },
  };
  it("at_risk_days=60 : 70j de récence -> inactif", () => {
    expect(classifyCustomer(stats({ recencyDays: 70 }), NOW, cfg).stage).toBe("inactif");
  });
  it("vip_visits=5 : 5 visites récentes -> vip", () => {
    expect(classifyCustomer(stats({ recencyDays: 5, visits: 5 }), NOW, cfg).stage).toBe("vip");
  });
  it("stampGoal=8 : 8 tampons -> recompense_prete", () => {
    expect(classifyCustomer(stats({ recencyDays: 5, maxStamps: 8 }), NOW, cfg).flags.recompense_prete).toBe(true);
  });
});
```

- [ ] **Step 2: Vérifier l'échec** — Run: `npm test -- classify` → FAIL (signature + import).

- [ ] **Step 3: Réécrire `classify.ts`**
```ts
import { NEW_MAX_VISITS, DAY_MS, type CustomerStats, type Classification, type StageKey } from "./types";
import { type ResolvedMerchantConfig } from "@/lib/merchant-config/types";

export function classifyCustomer(stats: CustomerStats, now: Date, cfg: ResolvedMerchantConfig): Classification {
  // Récence : depuis la dernière visite ; à défaut, depuis l'inscription (silencieux).
  const refMs = stats.lastScan ? stats.lastScan.getTime() : stats.createdAt.getTime();
  const recencyDays = (now.getTime() - refMs) / DAY_MS;
  const tenureDays = (now.getTime() - stats.createdAt.getTime()) / DAY_MS;
  const t = cfg.thresholds;

  let stage: StageKey;
  if (recencyDays > t.atRiskDays) stage = "inactif";
  else if (recencyDays > t.activeDays) stage = "en_train_de_partir";
  else if (stats.visits >= t.vipVisits) stage = "vip";
  else if (tenureDays <= t.newTenureDays && stats.visits <= NEW_MAX_VISITS) stage = "nouveau";
  else stage = "regulier";

  return {
    stage,
    flags: {
      recompense_prete: stats.maxStamps >= cfg.stampGoal,
      joignable_push: stats.reachablePush,
    },
  };
}
```

- [ ] **Step 4: Nettoyer `types.ts`** — Dans `src/lib/segments/types.ts`, **supprimer** les 5 constantes désormais portées par merchant-config (elles n'ont plus qu'un seul ex-consommateur, `classify.ts`) :
```ts
export const ACTIVE_DAYS = 30;
export const AT_RISK_DAYS = 90;
export const NEW_TENURE_DAYS = 30;
export const VIP_MIN_VISITS = 10;
export const REWARD_THRESHOLD = 10;
```
**Conserver** `NEW_MAX_VISITS = 2` et `DAY_MS` (toujours utilisés par `classify.ts`).

- [ ] **Step 5: Vérifier le succès** — Run: `npm test -- classify` → PASS.

- [ ] **Step 6: Commit**
```bash
git add src/lib/segments/classify.ts src/lib/segments/types.ts src/lib/segments/__tests__/classify.test.ts
git commit -m "feat(segments): classify with per-merchant config (thresholds + stamp goal)"
```

---

### Task 7: Segmentation — `fetch.ts` charge la config

**Files:** Modify `src/lib/segments/fetch.ts`

- [ ] **Step 1: Brancher `fetchMerchantConfig`**

Dans `src/lib/segments/fetch.ts` :
1. Ajouter l'import : `import { fetchMerchantConfig } from "@/lib/merchant-config/fetch";`
2. Dans `loadClassified`, **avant** le `return list.map(...)`, charger la config une fois :
```ts
  const cfg = await fetchMerchantConfig(merchantId);
```
3. Dans le `.map`, remplacer `classifyCustomer(stats, now)` par `classifyCustomer(stats, now, cfg)`.

- [ ] **Step 2: Build** — Run: `npm run build` → OK.

- [ ] **Step 3: Commit**
```bash
git add src/lib/segments/fetch.ts
git commit -m "feat(segments): load per-merchant config in fetch layer"
```

---

### Task 8: Analytique — seuil de récompense = `stamp_goal`

**Files:** Modify `src/lib/analytics/rewards.ts`, `src/lib/analytics/kpis.ts`, `src/lib/analytics/types.ts`

- [ ] **Step 1: `rewards.ts`** — Remplacer l'import et `fetchRewards` :
```ts
import { createClient } from "@/utils/supabase/server";
import { fetchMerchantConfig } from "@/lib/merchant-config/fetch";
import { type RangeKey } from "./types";

export type Rewards = { completedCards: number; totalCards: number; completionRate: number };

export function computeRewards(cards: { stamps_count: number }[], threshold: number): Rewards {
  const completedCards = cards.filter((c) => c.stamps_count >= threshold).length;
  const totalCards = cards.length;
  return { completedCards, totalCards, completionRate: totalCards ? Math.round((completedCards / totalCards) * 100) : 0 };
}

export async function fetchRewards(merchantId: string, _range: RangeKey): Promise<Rewards> {
  const supabase = await createClient();
  const { stampGoal } = await fetchMerchantConfig(merchantId);
  const { data } = await supabase.from("loyalty_cards").select("stamps_count").eq("merchant_id", merchantId);
  return computeRewards(data ?? [], stampGoal);
}
```

- [ ] **Step 2: `kpis.ts`** — (1) changer l'import ligne 3 de `import { INACTIVE_DAYS, REWARD_THRESHOLD, type RangeKey } from "./types";` vers `import { INACTIVE_DAYS, type RangeKey } from "./types";` ; (2) ajouter `import { fetchMerchantConfig } from "@/lib/merchant-config/fetch";` ; (3) dans `fetchKpis`, après `const activeSince = ...`, ajouter `const { stampGoal } = await fetchMerchantConfig(merchantId);` ; (4) remplacer `.gte("stamps_count", REWARD_THRESHOLD)` par `.gte("stamps_count", stampGoal)`.

- [ ] **Step 3: `types.ts`** — Dans `src/lib/analytics/types.ts`, **supprimer** `export const REWARD_THRESHOLD = 10;` (plus aucun consommateur). **Conserver** `INACTIVE_DAYS` (utilisé par `retention.ts` et `kpis.ts`).

- [ ] **Step 4: Build + tests** — Run: `npm run build` → OK ; `npm test` → tous PASS (les tests analytiques existants utilisent `computeRewards`/`computeKpis` avec seuil en paramètre, inchangés).

- [ ] **Step 5: Commit**
```bash
git add src/lib/analytics/rewards.ts src/lib/analytics/kpis.ts src/lib/analytics/types.ts
git commit -m "feat(analytics): reward threshold = per-merchant stamp goal"
```

---

### Task 9: Pass Wallet — libellé « X / objectif »

**Files:** Modify `src/lib/wallet/passJson.ts`, `src/lib/wallet/__tests__/passJson.test.ts`

- [ ] **Step 1: Ajouter le test (échoue d'abord)**

Ajouter ce test à la fin de `src/lib/wallet/__tests__/passJson.test.ts` **sans ré-importer** `buildPassJson`/`describe`/`it`/`expect` (déjà importés en tête du fichier) :
```ts
describe("buildPassJson — objectif de carte", () => {
  const base = {
    cardId: "c", customerName: "A", stamps: 3, orgName: "Café",
    backgroundColor: "rgb(0,0,0)", passTypeIdentifier: "pass.x", teamIdentifier: "T", barcodeMessage: "sig",
  };
  it("stampGoal fourni -> 'stamps / stampGoal'", () => {
    const p = buildPassJson({ ...base, stampGoal: 8 });
    const f = p.storeCard.primaryFields.find((x: { key: string }) => x.key === "stamps");
    expect(f.value).toBe("3 / 8");
  });
  it("stampGoal absent -> défaut 10", () => {
    const p = buildPassJson(base);
    const f = p.storeCard.primaryFields.find((x: { key: string }) => x.key === "stamps");
    expect(f.value).toBe("3 / 10");
  });
});
```
*(Note : si `primaryFields` n'est pas typé sur le retour, le `.find` reste valide à l'exécution ; le fichier de test n'est pas en strict sur ce point.)*

- [ ] **Step 2: Vérifier l'échec** — Run: `npm test -- passJson` → le nouveau bloc FAIL (libellé `/ 10` figé).

- [ ] **Step 3: Modifier `passJson.ts`** — (1) ajouter `stampGoal?: number;` à l'interface `PassJsonInput` (après `stamps: number;`) ; (2) dans `primaryFields`, remplacer `value: \`${i.stamps} / 10\`` par `value: \`${i.stamps} / ${i.stampGoal ?? 10}\``.

- [ ] **Step 4: Vérifier le succès** — Run: `npm test -- passJson` → PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/wallet/passJson.ts src/lib/wallet/__tests__/passJson.test.ts
git commit -m "feat(wallet): pass shows X / <merchant stamp goal>"
```

---

### Task 10: Pass Apple — transmettre `stamp_goal`

**Files:** Modify `src/lib/applePass.ts`

> Le fichier est `@ts-nocheck`. Couvre tous les appelants sans les changer.

- [ ] **Step 1: Lire l'objectif depuis la carte et le passer**

Dans `src/lib/applePass.ts`, dans `buildApplePassBuffer`, juste **avant** l'appel `const passJson = buildPassJson({ ... })`, ajouter :
```ts
  const { supabaseAdmin } = await import("@/lib/supabaseAdmin");
  let stampGoal = 10;
  const { data: cardRow } = await supabaseAdmin
    .from("loyalty_cards")
    .select("merchant_id")
    .eq("id", cardId)
    .single();
  if (cardRow?.merchant_id) {
    const { data: mRow } = await supabaseAdmin
      .from("merchants")
      .select("stamp_goal")
      .eq("id", cardRow.merchant_id)
      .single();
    stampGoal = mRow?.stamp_goal ?? 10;
  }
```
Puis, dans l'objet passé à `buildPassJson({ ... })`, ajouter le champ `stampGoal,` (à côté de `stamps,`).

- [ ] **Step 2: Build** — Run: `npm run build` → OK.

- [ ] **Step 3: Commit**
```bash
git add src/lib/applePass.ts
git commit -m "feat(wallet): generated Apple pass uses merchant stamp goal"
```

---

### Task 11: Route admin — accepter + valider la config

**Files:** Modify `src/app/api/admin/merchants/[id]/route.ts`

- [ ] **Step 1: Étendre le `PATCH`**

Remplacer le corps entre `const update: Record<string, unknown> = {};` et le bloc `if (Object.keys(update).length === 0)` par :
```ts
    const update: Record<string, unknown> = {};

    if (typeof body.shopName === "string") {
      const s = body.shopName.trim();
      if (s.length < 2 || s.length > 100) {
        return NextResponse.json({ error: "Nom de boutique invalide" }, { status: 400 });
      }
      update.shop_name = s;
    }

    // Bundle config marchand (présent dès que le formulaire enregistre).
    if (body.stampGoal !== undefined) {
      const { validateMerchantConfig } = await import("@/lib/merchant-config/validate");
      const v = validateMerchantConfig(body);
      if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });
      update.stamp_goal = v.value.stampGoal;
      update.business_type = v.value.businessType;
      update.primary_color = v.value.primaryColor;
      update.logo_url = v.value.logoUrl;
      update.segment_config = v.value.segmentConfig;
    }
```
*(On retire les anciens blocs individuels `primaryColor`/`logoUrl` : ils sont désormais couverts par le bundle validé. Le seul appelant est le formulaire admin, mis à jour au Task 12.)*

- [ ] **Step 2: Build** — Run: `npm run build` → OK.

- [ ] **Step 3: Commit**
```bash
git add "src/app/api/admin/merchants/[id]/route.ts"
git commit -m "feat(admin-api): validate and persist per-merchant config"
```

---

### Task 12: UI admin — section « Programme & segmentation »

**Files:** Modify `src/app/admin/merchants/[id]/page.tsx`, `src/app/admin/merchants/[id]/EditMerchantForm.tsx`

- [ ] **Step 1: Page serveur — charger + passer la config**

Dans `src/app/admin/merchants/[id]/page.tsx` :
1. Étendre le `select` : `"id, shop_name, email, primary_color, logo_url, enrollment_token, role, business_type, stamp_goal, segment_config"`.
2. Ajouter l'import : `import { resolveMerchantConfig } from "@/lib/merchant-config/resolve";`
3. Avant le `return`, résoudre : `const cfg = resolveMerchantConfig({ stamp_goal: m.stamp_goal, segment_config: m.segment_config });`
4. Étendre le prop passé à `<EditMerchantForm merchant={{ ... }} />` :
```tsx
          merchant={{
            id: m.id,
            shopName: m.shop_name,
            primaryColor: m.primary_color || "#10b981",
            logoUrl: m.logo_url,
            stampGoal: cfg.stampGoal,
            businessType: m.business_type || "autre",
            thresholds: cfg.thresholds,
          }}
```

- [ ] **Step 2: Réécrire `EditMerchantForm.tsx`**

Remplacer **tout** le fichier `src/app/admin/merchants/[id]/EditMerchantForm.tsx` par :
```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Store, RefreshCw, Check, AlertCircle } from "lucide-react";

const BUSINESS_OPTIONS = ["cafe", "restaurant", "boulangerie", "boutique", "salon", "sport", "autre"];

interface Props {
  merchant: {
    id: string;
    shopName: string;
    primaryColor: string;
    logoUrl: string | null;
    stampGoal: number;
    businessType: string;
    thresholds: { activeDays: number; atRiskDays: number; vipVisits: number; newTenureDays: number };
  };
}

export default function EditMerchantForm({ merchant }: Props) {
  const router = useRouter();
  const [shopName, setShopName] = useState(merchant.shopName);
  const [primaryColor, setPrimaryColor] = useState(merchant.primaryColor);
  const [logoUrl, setLogoUrl] = useState(merchant.logoUrl || "");
  const [stampGoal, setStampGoal] = useState(merchant.stampGoal);
  const [businessType, setBusinessType] = useState(merchant.businessType);
  const [activeDays, setActiveDays] = useState(merchant.thresholds.activeDays);
  const [atRiskDays, setAtRiskDays] = useState(merchant.thresholds.atRiskDays);
  const [vipVisits, setVipVisits] = useState(merchant.thresholds.vipVisits);
  const [newTenureDays, setNewTenureDays] = useState(merchant.thresholds.newTenureDays);
  const [saving, setSaving] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMsg("");
    try {
      const res = await fetch(`/api/admin/merchants/${merchant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopName, primaryColor, logoUrl,
          stampGoal, businessType, activeDays, atRiskDays, vipVisits, newTenureDays,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "Erreur lors de l'enregistrement.");
        return;
      }
      setMsg("Modifications enregistrées.");
      router.refresh();
    } catch {
      setError("Erreur de connexion.");
    } finally {
      setSaving(false);
    }
  };

  const rotate = async () => {
    if (!confirm("Régénérer le lien d'enrôlement ? L'ancien QR/lien ne fonctionnera plus.")) return;
    setRotating(true);
    setError("");
    setMsg("");
    try {
      const res = await fetch(`/api/admin/merchants/${merchant.id}/rotate-token`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || "Erreur lors de la rotation.");
        return;
      }
      setMsg("Nouveau lien d'enrôlement généré.");
      router.refresh();
    } catch {
      setError("Erreur de connexion.");
    } finally {
      setRotating(false);
    }
  };

  const numInput = "w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3 px-4 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all";

  return (
    <form onSubmit={save} className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-6 space-y-5 h-fit">
      <h2 className="font-bold">Branding</h2>

      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-400 ml-1">Nom de la boutique</label>
        <div className="relative group">
          <Store className="absolute left-4 top-3.5 w-5 h-5 text-zinc-500 group-focus-within:text-amber-400 transition-colors" />
          <input
            required
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            maxLength={100}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3.5 pl-12 pr-4 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-400 ml-1">Couleur de marque</label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="w-12 h-12 rounded-xl bg-transparent border border-zinc-800 cursor-pointer"
          />
          <span className="font-mono text-sm text-zinc-400">{primaryColor}</span>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-400 ml-1">URL du logo (optionnel)</label>
        <input
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          placeholder="https://…/logo.png"
          className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3.5 px-4 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all placeholder:text-zinc-700"
        />
      </div>

      <h2 className="font-bold pt-2 border-t border-zinc-800">Programme &amp; segmentation</h2>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-400 ml-1">Objectif carte (tampons)</label>
          <input type="number" min={1} max={50} value={stampGoal}
            onChange={(e) => setStampGoal(Number(e.target.value))} className={numInput} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-400 ml-1">Métier</label>
          <select value={businessType} onChange={(e) => setBusinessType(e.target.value)} className={numInput}>
            {BUSINESS_OPTIONS.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-400 ml-1">Jours « actif » (déf. 30)</label>
          <input type="number" min={1} value={activeDays}
            onChange={(e) => setActiveDays(Number(e.target.value))} className={numInput} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-400 ml-1">Jours « à risque » (déf. 90)</label>
          <input type="number" min={1} value={atRiskDays}
            onChange={(e) => setAtRiskDays(Number(e.target.value))} className={numInput} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-400 ml-1">Visites VIP (déf. 10)</label>
          <input type="number" min={1} value={vipVisits}
            onChange={(e) => setVipVisits(Number(e.target.value))} className={numInput} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-zinc-400 ml-1">Ancienneté « nouveau » (déf. 30)</label>
          <input type="number" min={1} value={newTenureDays}
            onChange={(e) => setNewTenureDays(Number(e.target.value))} className={numInput} />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-2xl px-4 py-3 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}
      {msg && (
        <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl px-4 py-3 text-sm">
          <Check className="w-4 h-4 shrink-0" />
          {msg}
        </div>
      )}

      <div className="flex flex-wrap gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 bg-amber-500 text-black font-bold px-5 py-3 rounded-2xl hover:bg-amber-400 transition-all disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Enregistrer"}
        </button>
        <button
          type="button"
          onClick={rotate}
          disabled={rotating}
          className="flex items-center gap-2 bg-zinc-800 hover:bg-zinc-700 px-5 py-3 rounded-2xl font-medium transition-colors disabled:opacity-50"
        >
          {rotating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Régénérer le lien
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 3: Build + fumée** — Run: `npm run build` → OK. Puis `npm run dev`, se connecter en **admin**, ouvrir `/admin/merchants/<id d'un marchand>` : la section « Programme & segmentation » s'affiche, l'enregistrement fonctionne ; un `at_risk ≤ actif` renvoie l'erreur de validation.

- [ ] **Step 4: Commit**
```bash
git add src/app/admin/merchants/ 
git commit -m "feat(admin-ui): edit per-merchant program & segmentation config"
```

---

### Task 13: Vérification finale

- [ ] **Step 1: Tests** — Run: `npm test` → tous PASS (merchant-config resolve/validate + segments/analytics/wallet existants adaptés).
- [ ] **Step 2: Build** — Run: `npm run build` → « Compiled successfully ».
- [ ] **Step 3: Lint** — Run: `npx eslint src/lib/merchant-config src/lib/segments src/lib/analytics src/lib/wallet "src/app/api/admin/merchants/[id]" "src/app/admin/merchants/[id]"` → propre.
- [ ] **Step 4: Fumée (après migration appliquée par le contrôleur)** — En dev sur le compte démo : régler un marchand (ex. objectif 8, jours « à risque » 60) → l'onglet Segments reclasse en conséquence, le widget « récompenses » de l'analytique suit, et un pass régénéré affiche « X / 8 ».

---

## Notes de réalisation

- **TDD** sur la logique pure (`resolveMerchantConfig`, `validateMerchantConfig`, `classifyCustomer` avec config custom). Le reste vérifié par `build` + fumée.
- **Migration** : créée mais appliquée en prod (`oqcelbbozpykwkasjtqy`) par le contrôleur **avec consentement** — un sous-agent ne l'applique jamais.
- **Rétro-compatibilité** : `stamp_goal` défaut 10 + `segment_config` nul → `resolveMerchantConfig` rend les défauts → comportement identique tant que l'admin ne change rien.
- **DRY** : défauts centralisés dans `merchant-config/types.ts` ; constantes mortes retirées de `segments/types.ts` et `analytics/types.ts` ; `computeRewards`/`computeKpis` réutilisés tels quels.
- **Sécurité** : route admin protégée par `requireAdminApi` (service-role) ; ces colonnes ne sont pas privilégiées (le trigger `enforce_merchant_role_guard` reste la dernière ligne de défense) ; validation serveur fait foi.
- **Transparent** : `applePass.ts` lit l'objectif depuis la carte → tous les appelants (`generate-apple-pass`, `enroll`, `get-latest`) couverts sans changement.
- **Hors périmètre** : types de programme (points/paliers/cashback), branding carte avancé, self-service marchand, `INACTIVE_DAYS` analytique (notion distincte).
```
