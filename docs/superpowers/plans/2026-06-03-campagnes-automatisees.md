# Sous-projet 4b — Campagnes self-service — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner au commerçant un onglet « Campagnes » où il crée et pilote lui-même ses campagnes push Wallet, envoyées maintenant, à une date, ou en récurrent (un cron quotidien), en réutilisant l'audience (4a) et le canal push (Module 3).

**Architecture:** Une campagne = audience (`AudienceKey` existant) + message + moment (`once`/`recurring`). Trois fonctions **pures testées** décident l'éligibilité (`validateCampaignInput`, `isCampaignDue`, `selectRecurringRecipients`). Un helper d'envoi partagé (`deliverToCards`) factorise le flux 4a (notify + journal `wallet_notifications`) et sert à la fois la route 4a et le cron. Un endpoint cron protégé par `CRON_SECRET` parcourt les campagnes dues/actives de tous les marchands. Une API CRUD marchand + un onglet UI complètent.

**Tech Stack:** Next.js 16 (App Router, route handlers `params` async) · React 19 · TypeScript · Supabase (`@supabase/ssr` RLS + `supabaseAdmin` service-role) · Tailwind v4 · Vitest · lucide-react · Vercel Cron.

**Spec:** `docs/superpowers/specs/2026-06-03-campagnes-automatisees-design.md`

---

## File Structure

```
supabase/migrations/20260603_campaigns.sql            # NEW (créée, PAS appliquée par le sous-agent)
src/lib/campaigns/types.ts        # NEW — CampaignRow, CampaignInput, ValidatedCampaign (types partagés)
src/lib/campaigns/validate.ts     # NEW — validateCampaignInput (PUR, testé)
src/lib/campaigns/due.ts          # NEW — isCampaignDue (PUR, testé)
src/lib/campaigns/recipients.ts   # NEW — selectRecurringRecipients (PUR, testé)
src/lib/campaigns/__tests__/validate.test.ts     # NEW
src/lib/campaigns/__tests__/due.test.ts          # NEW
src/lib/campaigns/__tests__/recipients.test.ts   # NEW
src/lib/campaigns/fetch.ts        # NEW — DB: CRUD + fetch dues/actives + sends (thin, non testé unitairement)
src/lib/notifications/deliver.ts  # NEW — deliverToCards (helper d'envoi partagé)
src/app/api/notifications/send/route.ts   # MODIFY — réutilise deliverToCards (DRY)
src/app/api/cron/campaigns/route.ts       # NEW — endpoint cron protégé CRON_SECRET
src/app/api/campaigns/route.ts            # NEW — POST (create)
src/app/api/campaigns/[id]/route.ts       # NEW — PATCH (toggle/edit), DELETE
src/app/dashboard/campaigns/page.tsx      # NEW — server component (liste via RLS)
src/app/dashboard/campaigns/CampaignsView.tsx  # NEW — client (form + liste + actions)
src/app/dashboard/DashboardShell.tsx      # MODIFY — entrée de nav « Campagnes »
vercel.json                               # NEW — déclaration du cron quotidien
```

**Réutilisé (DRY) :** `AUDIENCE_KEYS`/`audienceLabel`/`AudienceKey` (`@/lib/segments/audience`), `fetchAudienceCardIds` (`@/lib/segments/fetch`), `getChannels` (`@/lib/wallet/channel`), `currentMerchantId` (`@/lib/analytics/merchant`), `DAY_MS` (`@/lib/segments/types`), `SegmentSummary` + endpoint `/api/segments` (tailles d'audience), `supabaseAdmin`, le pattern de carte UI Tailwind des onglets existants.

---

## Task 1: Migration BDD (créer, NE PAS appliquer)

**Files:**
- Create: `supabase/migrations/20260603_campaigns.sql`

- [ ] **Step 1: Écrire la migration**

```sql
-- Sous-projet 4b — campagnes self-service (programmées & récurrentes).
CREATE TABLE IF NOT EXISTS campaigns (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  merchant_id   uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  audience      text NOT NULL DEFAULT 'all',
  title         text NOT NULL,
  body          text NOT NULL,
  mode          text NOT NULL CHECK (mode IN ('once','recurring')),
  run_on        date,
  active        boolean NOT NULL DEFAULT true,
  cooldown_days int NOT NULL DEFAULT 30,
  last_run_on   date,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_campaigns_merchant ON campaigns (merchant_id);

CREATE TABLE IF NOT EXISTS campaign_sends (
  campaign_id uuid NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  card_id     text NOT NULL,
  sent_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, card_id, sent_at)
);
CREATE INDEX IF NOT EXISTS idx_campaign_sends_lookup ON campaign_sends (campaign_id, sent_at);

-- RLS : le marchand lit ses propres campagnes via le client RLS (page dashboard).
-- Les écritures passent par le service-role (routes API). Même pattern que wallet_notifications.
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "campaigns scoped to merchant" ON campaigns;
CREATE POLICY "campaigns scoped to merchant" ON campaigns
  FOR SELECT USING (
    merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
  );

-- campaign_sends : service-role uniquement (cron). Deny par défaut anon/authenticated.
ALTER TABLE campaign_sends ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 2: NE PAS appliquer** — créer le fichier seulement. L'application en prod (projet WalletCard `oqcelbbozpykwkasjtqy`) est faite par le contrôleur avec le consentement utilisateur, hors de ce sous-agent.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260603_campaigns.sql
git commit -m "feat(db): campaigns + campaign_sends tables for sub-project 4b (not applied)"
```

---

## Task 2: Types partagés campagnes

**Files:**
- Create: `src/lib/campaigns/types.ts`

- [ ] **Step 1: Écrire les types**

```typescript
import type { AudienceKey } from "@/lib/segments/audience";

export type CampaignMode = "once" | "recurring";

// Entrée brute reçue de l'API (avant validation).
export type CampaignInput = {
  audience?: unknown;
  title?: unknown;
  body?: unknown;
  mode?: unknown;
  runOn?: unknown;
  cooldownDays?: unknown;
};

// Campagne validée et normalisée (prête à insérer).
export type ValidatedCampaign = {
  audience: AudienceKey;
  title: string;
  body: string;
  mode: CampaignMode;
  runOn: string | null;       // YYYY-MM-DD si mode = once, sinon null
  cooldownDays: number;       // pertinent si mode = recurring
};

// Ligne campagne telle que manipulée côté logique (camelCase, mappée depuis la DB).
export type CampaignRow = {
  id: string;
  merchantId: string;
  audience: AudienceKey;
  title: string;
  body: string;
  mode: CampaignMode;
  runOn: string | null;
  active: boolean;
  cooldownDays: number;
  lastRunOn: string | null;
};
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/campaigns/types.ts
git commit -m "feat(campaigns): shared types for sub-project 4b"
```

---

## Task 3: `validateCampaignInput` (PUR, TDD)

**Files:**
- Test: `src/lib/campaigns/__tests__/validate.test.ts`
- Create: `src/lib/campaigns/validate.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { validateCampaignInput } from "../validate";

describe("validateCampaignInput", () => {
  const base = { audience: "inactif", title: "Coucou", body: "Revenez !" };

  it("accepte une campagne 'once' valide et normalise", () => {
    const r = validateCampaignInput({ ...base, mode: "once", runOn: "2026-06-14" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toEqual({
        audience: "inactif", title: "Coucou", body: "Revenez !",
        mode: "once", runOn: "2026-06-14", cooldownDays: 30,
      });
    }
  });

  it("accepte une campagne 'recurring' et applique le cooldown par défaut 30", () => {
    const r = validateCampaignInput({ ...base, mode: "recurring" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value).toMatchObject({ mode: "recurring", runOn: null, cooldownDays: 30 });
  });

  it("respecte un cooldown explicite pour 'recurring'", () => {
    const r = validateCampaignInput({ ...base, mode: "recurring", cooldownDays: 7 });
    expect(r.ok && r.value.cooldownDays).toBe(7);
  });

  it("rejette une audience inconnue", () => {
    const r = validateCampaignInput({ ...base, mode: "once", runOn: "2026-06-14", audience: "vips" });
    expect(r).toEqual({ ok: false, error: "Audience invalide" });
  });

  it("rejette un message vide", () => {
    const r = validateCampaignInput({ ...base, body: "   ", mode: "recurring" });
    expect(r).toEqual({ ok: false, error: "Titre et message requis" });
  });

  it("rejette un mode inconnu", () => {
    const r = validateCampaignInput({ ...base, mode: "tous_les_lundis" });
    expect(r).toEqual({ ok: false, error: "Mode invalide" });
  });

  it("rejette 'once' sans date valide", () => {
    const r = validateCampaignInput({ ...base, mode: "once", runOn: "14/06/2026" });
    expect(r).toEqual({ ok: false, error: "Date d'envoi invalide" });
  });

  it("rejette un cooldown < 1 pour 'recurring'", () => {
    const r = validateCampaignInput({ ...base, mode: "recurring", cooldownDays: 0 });
    expect(r).toEqual({ ok: false, error: "Cooldown invalide" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/campaigns/__tests__/validate.test.ts`
Expected: FAIL — `Failed to resolve import "../validate"`.

- [ ] **Step 3: Write minimal implementation**

```typescript
import { isAudienceKey } from "@/lib/segments/audience";
import type { CampaignInput, ValidatedCampaign } from "./types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type ValidateResult =
  | { ok: true; value: ValidatedCampaign }
  | { ok: false; error: string };

export function validateCampaignInput(input: CampaignInput): ValidateResult {
  const audience = input.audience;
  if (typeof audience !== "string" || !isAudienceKey(audience))
    return { ok: false, error: "Audience invalide" };

  const title = typeof input.title === "string" ? input.title.trim() : "";
  const body = typeof input.body === "string" ? input.body.trim() : "";
  if (!title || !body) return { ok: false, error: "Titre et message requis" };

  if (input.mode !== "once" && input.mode !== "recurring")
    return { ok: false, error: "Mode invalide" };

  if (input.mode === "once") {
    const runOn = input.runOn;
    if (typeof runOn !== "string" || !DATE_RE.test(runOn))
      return { ok: false, error: "Date d'envoi invalide" };
    return { ok: true, value: { audience, title, body, mode: "once", runOn, cooldownDays: 30 } };
  }

  const cd = input.cooldownDays;
  const cooldownDays = cd === undefined ? 30 : cd;
  if (typeof cooldownDays !== "number" || !Number.isInteger(cooldownDays) || cooldownDays < 1)
    return { ok: false, error: "Cooldown invalide" };
  return { ok: true, value: { audience, title, body, mode: "recurring", runOn: null, cooldownDays } };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/campaigns/__tests__/validate.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/campaigns/validate.ts src/lib/campaigns/__tests__/validate.test.ts
git commit -m "feat(campaigns): pure validateCampaignInput with tests"
```

---

## Task 4: `isCampaignDue` (PUR, TDD)

**Files:**
- Test: `src/lib/campaigns/__tests__/due.test.ts`
- Create: `src/lib/campaigns/due.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { isCampaignDue } from "../due";
import type { CampaignRow } from "../types";

const once = (over: Partial<CampaignRow>): CampaignRow => ({
  id: "c1", merchantId: "m1", audience: "all", title: "T", body: "B",
  mode: "once", runOn: "2026-06-10", active: true, cooldownDays: 30, lastRunOn: null,
  ...over,
});

describe("isCampaignDue", () => {
  it("due quand run_on est passé et jamais exécutée", () => {
    expect(isCampaignDue(once({ runOn: "2026-06-10" }), "2026-06-12")).toBe(true);
  });
  it("due quand run_on est aujourd'hui", () => {
    expect(isCampaignDue(once({ runOn: "2026-06-12" }), "2026-06-12")).toBe(true);
  });
  it("pas due quand run_on est dans le futur", () => {
    expect(isCampaignDue(once({ runOn: "2026-06-20" }), "2026-06-12")).toBe(false);
  });
  it("pas due quand déjà exécutée", () => {
    expect(isCampaignDue(once({ runOn: "2026-06-10", lastRunOn: "2026-06-10" }), "2026-06-12")).toBe(false);
  });
  it("pas due pour une campagne récurrente", () => {
    expect(isCampaignDue(once({ mode: "recurring", runOn: null }), "2026-06-12")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/campaigns/__tests__/due.test.ts`
Expected: FAIL — `Failed to resolve import "../due"`.

- [ ] **Step 3: Write minimal implementation**

```typescript
import type { CampaignRow } from "./types";

// `today` et `runOn` sont des dates ISO YYYY-MM-DD → comparables lexicographiquement.
export function isCampaignDue(c: CampaignRow, today: string): boolean {
  return c.mode === "once" && c.runOn !== null && c.runOn <= today && c.lastRunOn === null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/campaigns/__tests__/due.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/campaigns/due.ts src/lib/campaigns/__tests__/due.test.ts
git commit -m "feat(campaigns): pure isCampaignDue with tests"
```

---

## Task 5: `selectRecurringRecipients` (PUR, TDD)

**Files:**
- Test: `src/lib/campaigns/__tests__/recipients.test.ts`
- Create: `src/lib/campaigns/recipients.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { selectRecurringRecipients } from "../recipients";

const now = new Date("2026-06-30T09:00:00Z");
const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

describe("selectRecurringRecipients", () => {
  it("inclut une carte jamais notifiée", () => {
    expect(selectRecurringRecipients(["a"], new Map(), 30, now)).toEqual(["a"]);
  });
  it("exclut une carte notifiée hier (cooldown 30)", () => {
    const last = new Map([["a", daysAgo(1)]]);
    expect(selectRecurringRecipients(["a"], last, 30, now)).toEqual([]);
  });
  it("ré-inclut une carte notifiée il y a 31 jours (cooldown 30)", () => {
    const last = new Map([["a", daysAgo(31)]]);
    expect(selectRecurringRecipients(["a"], last, 30, now)).toEqual(["a"]);
  });
  it("filtre un mélange et préserve l'ordre", () => {
    const last = new Map([["b", daysAgo(2)], ["c", daysAgo(40)]]);
    expect(selectRecurringRecipients(["a", "b", "c"], last, 30, now)).toEqual(["a", "c"]);
  });
  it("renvoie [] pour une audience vide", () => {
    expect(selectRecurringRecipients([], new Map(), 30, now)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/campaigns/__tests__/recipients.test.ts`
Expected: FAIL — `Failed to resolve import "../recipients"`.

- [ ] **Step 3: Write minimal implementation**

```typescript
import { DAY_MS } from "@/lib/segments/types";

// Garde les cartes jamais notifiées ou notifiées il y a plus de `cooldownDays`.
export function selectRecurringRecipients(
  cardIds: string[],
  lastSentByCard: Map<string, Date>,
  cooldownDays: number,
  now: Date,
): string[] {
  const cutoff = now.getTime() - cooldownDays * DAY_MS;
  return cardIds.filter((id) => {
    const last = lastSentByCard.get(id);
    return !last || last.getTime() <= cutoff;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/campaigns/__tests__/recipients.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/campaigns/recipients.ts src/lib/campaigns/__tests__/recipients.test.ts
git commit -m "feat(campaigns): pure selectRecurringRecipients with tests"
```

---

## Task 6: Helper d'envoi partagé `deliverToCards` + refacto route 4a (DRY)

**Files:**
- Create: `src/lib/notifications/deliver.ts`
- Modify: `src/app/api/notifications/send/route.ts`

- [ ] **Step 1: Créer le helper partagé**

Ce code extrait **exactement** la logique d'envoi+journal déjà présente dans la route 4a (lignes 25-36), pour la partager avec le cron.

```typescript
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getChannels } from "@/lib/wallet/channel";
import type { AudienceKey } from "@/lib/segments/audience";

// Notifie les cartes joignables et journalise l'envoi dans wallet_notifications.
// Réutilisé par /api/notifications/send (4a) et le cron des campagnes (4b).
export async function deliverToCards(
  merchantId: string,
  audience: AudienceKey,
  cardIds: string[],
  message: { title: string; body: string },
): Promise<{ pushed: number; reachable: number }> {
  if (!cardIds.length) return { pushed: 0, reachable: 0 };

  const { data: regs } = await supabaseAdmin
    .from("wallet_device_registrations").select("serial_number").in("serial_number", cardIds);
  const reachable = [...new Set((regs ?? []).map((r) => r.serial_number as string))];

  let pushed = 0;
  for (const ch of getChannels()) pushed += (await ch.notify(reachable, message)).pushed;

  await supabaseAdmin
    .from("wallet_notifications")
    .insert({ merchant_id: merchantId, title: message.title, body: message.body, sent_count: pushed, audience });

  return { pushed, reachable: reachable.length };
}
```

- [ ] **Step 2: Refactorer la route 4a pour utiliser le helper**

Remplacer le corps après le calcul de `cardIds` (anciennes lignes 24-36) dans `src/app/api/notifications/send/route.ts`. Le fichier complet devient :

```typescript
import { NextResponse, type NextRequest } from "next/server";
import { currentMerchantId } from "@/lib/analytics/merchant";
import { rateLimit } from "@/lib/rateLimit";
import { fetchAudienceCardIds } from "@/lib/segments/fetch";
import { isAudienceKey, type AudienceKey } from "@/lib/segments/audience";
import { deliverToCards } from "@/lib/notifications/deliver";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const merchantId = await currentMerchantId();
  if (!merchantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // 10 envois / heure par marchand (anti-spam APNs)
  const rl = await rateLimit(`notify:${merchantId}`, 10, 3600000);
  if (!rl.success) return NextResponse.json({ error: "Trop d'envois. Réessayez plus tard." }, { status: 429 });

  const { title, body, audience } = await req.json().catch(() => ({}));
  if (typeof title !== "string" || typeof body !== "string" || !title.trim() || !body.trim())
    return NextResponse.json({ error: "bad input" }, { status: 400 });
  const aud: AudienceKey = audience === undefined ? "all" : audience;
  if (!isAudienceKey(aud)) return NextResponse.json({ error: "bad audience" }, { status: 400 });

  const cardIds = await fetchAudienceCardIds(merchantId, aud);
  const res = await deliverToCards(merchantId, aud, cardIds, { title, body });
  return NextResponse.json(res);
}
```

- [ ] **Step 3: Vérifier le build + les tests existants**

Run: `npx tsc --noEmit && npx vitest run`
Expected: build OK, 79 tests existants toujours verts (+ 18 nouveaux des Tasks 3-5).

- [ ] **Step 4: Fumée 4a (compte démo)**

Run: `npm run dev` puis se connecter (`demo@walletcard.app` / `demo-walletcard-2026`), onglet Notifications → envoyer « Tous mes clients » → réponse « Envoyé à N… » comme avant ; l'envoi apparaît dans l'historique. Comportement 4a inchangé.

- [ ] **Step 5: Commit**

```bash
git add src/lib/notifications/deliver.ts src/app/api/notifications/send/route.ts
git commit -m "refactor(notifications): extract shared deliverToCards, reuse in send route"
```

---

## Task 7: Couche DB campagnes `fetch.ts`

**Files:**
- Create: `src/lib/campaigns/fetch.ts`

Code DB fin (non testé unitairement, comme les autres `fetch*` du repo).

- [ ] **Step 1: Écrire les helpers DB**

```typescript
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { AudienceKey } from "@/lib/segments/audience";
import type { CampaignRow, ValidatedCampaign } from "./types";

type DbCampaign = {
  id: string; merchant_id: string; audience: string; title: string; body: string;
  mode: "once" | "recurring"; run_on: string | null; active: boolean;
  cooldown_days: number; last_run_on: string | null;
};

function rowToCampaign(r: DbCampaign): CampaignRow {
  return {
    id: r.id, merchantId: r.merchant_id, audience: r.audience as AudienceKey,
    title: r.title, body: r.body, mode: r.mode, runOn: r.run_on,
    active: r.active, cooldownDays: r.cooldown_days, lastRunOn: r.last_run_on,
  };
}

const COLS = "id, merchant_id, audience, title, body, mode, run_on, active, cooldown_days, last_run_on";

export async function createCampaign(merchantId: string, v: ValidatedCampaign): Promise<void> {
  await supabaseAdmin.from("campaigns").insert({
    merchant_id: merchantId, audience: v.audience, title: v.title, body: v.body,
    mode: v.mode, run_on: v.runOn, cooldown_days: v.cooldownDays,
  });
}

// Met à jour active/run_on/title/body/audience/cooldown ; scopée au marchand.
export async function updateCampaign(
  merchantId: string, id: string, patch: Record<string, unknown>,
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("campaigns").update(patch).eq("id", id).eq("merchant_id", merchantId).select("id").maybeSingle();
  return !!data;
}

export async function deleteCampaign(merchantId: string, id: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("campaigns").delete().eq("id", id).eq("merchant_id", merchantId).select("id").maybeSingle();
  return !!data;
}

// Cron : campagnes 'once' dues (jamais exécutées, date passée/aujourd'hui), tous marchands.
export async function fetchDueOnceCampaigns(today: string): Promise<CampaignRow[]> {
  const { data } = await supabaseAdmin
    .from("campaigns").select(COLS)
    .eq("mode", "once").is("last_run_on", null).lte("run_on", today);
  return (data ?? []).map((r) => rowToCampaign(r as DbCampaign));
}

// Cron : campagnes 'recurring' actives, tous marchands.
export async function fetchActiveRecurringCampaigns(): Promise<CampaignRow[]> {
  const { data } = await supabaseAdmin
    .from("campaigns").select(COLS).eq("mode", "recurring").eq("active", true);
  return (data ?? []).map((r) => rowToCampaign(r as DbCampaign));
}

// Dernier envoi par carte pour une campagne, dans la fenêtre de cooldown.
export async function fetchRecentSends(campaignId: string, sinceIso: string): Promise<Map<string, Date>> {
  const { data } = await supabaseAdmin
    .from("campaign_sends").select("card_id, sent_at").eq("campaign_id", campaignId).gte("sent_at", sinceIso);
  const map = new Map<string, Date>();
  for (const row of (data ?? []) as { card_id: string; sent_at: string }[]) {
    const d = new Date(row.sent_at);
    const prev = map.get(row.card_id);
    if (!prev || d > prev) map.set(row.card_id, d);
  }
  return map;
}

export async function recordCampaignSends(campaignId: string, cardIds: string[]): Promise<void> {
  if (!cardIds.length) return;
  await supabaseAdmin.from("campaign_sends").insert(cardIds.map((card_id) => ({ campaign_id: campaignId, card_id })));
}

export async function setLastRunOn(campaignId: string, today: string): Promise<void> {
  await supabaseAdmin.from("campaigns").update({ last_run_on: today }).eq("id", campaignId);
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add src/lib/campaigns/fetch.ts
git commit -m "feat(campaigns): DB layer (CRUD, due/active fetch, sends tracking)"
```

---

## Task 8: Endpoint cron `/api/cron/campaigns`

**Files:**
- Create: `src/app/api/cron/campaigns/route.ts`

- [ ] **Step 1: Écrire l'endpoint cron**

```typescript
import { NextResponse, type NextRequest } from "next/server";
import { fetchAudienceCardIds } from "@/lib/segments/fetch";
import { deliverToCards } from "@/lib/notifications/deliver";
import { isCampaignDue } from "@/lib/campaigns/due";
import { selectRecurringRecipients } from "@/lib/campaigns/recipients";
import { DAY_MS } from "@/lib/segments/types";
import {
  fetchDueOnceCampaigns, fetchActiveRecurringCampaigns, fetchRecentSends,
  recordCampaignSends, setLastRunOn,
} from "@/lib/campaigns/fetch";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  let processed = 0;
  let pushed = 0;

  // 1) Campagnes programmées (once) dues.
  for (const c of await fetchDueOnceCampaigns(today)) {
    if (!isCampaignDue(c, today)) continue; // garde défensive
    try {
      const cardIds = await fetchAudienceCardIds(c.merchantId, c.audience);
      const res = await deliverToCards(c.merchantId, c.audience, cardIds, { title: c.title, body: c.body });
      await recordCampaignSends(c.id, cardIds);
      await setLastRunOn(c.id, today);
      processed++; pushed += res.pushed;
    } catch (e) {
      console.error("cron once campaign failed", c.id, e instanceof Error ? e.message : e);
    }
  }

  // 2) Campagnes récurrentes actives (avec cooldown par client).
  for (const c of await fetchActiveRecurringCampaigns()) {
    try {
      const cardIds = await fetchAudienceCardIds(c.merchantId, c.audience);
      const sinceIso = new Date(now.getTime() - c.cooldownDays * DAY_MS).toISOString();
      const lastSent = await fetchRecentSends(c.id, sinceIso);
      const recipients = selectRecurringRecipients(cardIds, lastSent, c.cooldownDays, now);
      if (recipients.length) {
        const res = await deliverToCards(c.merchantId, c.audience, recipients, { title: c.title, body: c.body });
        await recordCampaignSends(c.id, recipients);
        pushed += res.pushed;
      }
      await setLastRunOn(c.id, today);
      processed++;
    } catch (e) {
      console.error("cron recurring campaign failed", c.id, e instanceof Error ? e.message : e);
    }
  }

  return NextResponse.json({ processed, pushed });
}

// Vercel Cron déclenche en GET ; on délègue à la même logique.
export async function GET(req: NextRequest) {
  return POST(req);
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Fumée locale du cron**

Ajouter temporairement `CRON_SECRET=dev-secret` dans `.env.local`, `npm run dev`, puis (la migration Task 1 doit avoir été appliquée en prod par le contrôleur, et une campagne `once` `run_on = aujourd'hui` créée — via Task 9 ou un insert manuel) :

Run: `curl -s -X POST -H "Authorization: Bearer dev-secret" http://localhost:3000/api/cron/campaigns`
Expected: `{"processed":N,"pushed":M}` ; un mauvais secret → `{"error":"unauthorized"}` (401).

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/campaigns/route.ts
git commit -m "feat(campaigns): protected cron endpoint runs due & recurring campaigns"
```

---

## Task 9: API CRUD marchand `/api/campaigns`

**Files:**
- Create: `src/app/api/campaigns/route.ts`
- Create: `src/app/api/campaigns/[id]/route.ts`

- [ ] **Step 1: Écrire la route collection (POST)**

`src/app/api/campaigns/route.ts` :

```typescript
import { NextResponse, type NextRequest } from "next/server";
import { currentMerchantId } from "@/lib/analytics/merchant";
import { validateCampaignInput } from "@/lib/campaigns/validate";
import { createCampaign } from "@/lib/campaigns/fetch";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const merchantId = await currentMerchantId();
  if (!merchantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const v = validateCampaignInput(body);
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  await createCampaign(merchantId, v.value);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Écrire la route item (PATCH/DELETE)**

`src/app/api/campaigns/[id]/route.ts` :

```typescript
import { NextResponse, type NextRequest } from "next/server";
import { currentMerchantId } from "@/lib/analytics/merchant";
import { updateCampaign, deleteCampaign } from "@/lib/campaigns/fetch";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const merchantId = await currentMerchantId();
  if (!merchantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (typeof body.active === "boolean") patch.active = body.active;
  if (Object.keys(patch).length === 0)
    return NextResponse.json({ error: "Aucune modification" }, { status: 400 });

  const ok = await updateCampaign(merchantId, id, patch);
  if (!ok) return NextResponse.json({ error: "Campagne introuvable" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const merchantId = await currentMerchantId();
  if (!merchantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "bad id" }, { status: 400 });

  const ok = await deleteCampaign(merchantId, id);
  if (!ok) return NextResponse.json({ error: "Campagne introuvable" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/campaigns/route.ts src/app/api/campaigns/[id]/route.ts
git commit -m "feat(campaigns): merchant CRUD API (create, toggle active, delete)"
```

---

## Task 10: `vercel.json` — déclaration du cron quotidien

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: Écrire la config cron**

```json
{
  "crons": [
    { "path": "/api/cron/campaigns", "schedule": "0 9 * * *" }
  ]
}
```

> Note (contrôleur) : sur le plan **hobby**, Vercel exécute les cron **1×/jour** (fenêtre approximative autour de 09:00 UTC) — granularité au jour, conforme à la spec. La variable `CRON_SECRET` doit être ajoutée dans Vercel → Settings → Environment Variables (Production) ; Vercel injecte automatiquement l'en-tête `Authorization: Bearer $CRON_SECRET` sur l'appel du cron.

- [ ] **Step 2: Commit**

```bash
git add vercel.json
git commit -m "feat(campaigns): daily Vercel cron for campaign delivery"
```

---

## Task 11: UI — onglet « Campagnes » (liste + création + actions)

**Files:**
- Create: `src/app/dashboard/campaigns/page.tsx`
- Create: `src/app/dashboard/campaigns/CampaignsView.tsx`
- Modify: `src/app/dashboard/DashboardShell.tsx`

- [ ] **Step 1: Page serveur (liste via RLS)**

`src/app/dashboard/campaigns/page.tsx` :

```typescript
import { createClient } from "@/utils/supabase/server";
import { CampaignsView, type CampaignListItem } from "./CampaignsView";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: merchant } = await supabase.from("merchants").select("id").eq("user_id", user?.id).single();
  if (!merchant) return <p className="text-zinc-500">Aucun profil marchand associé à ce compte.</p>;

  const { data } = await supabase
    .from("campaigns")
    .select("id, audience, title, body, mode, run_on, active")
    .eq("merchant_id", merchant.id)
    .order("created_at", { ascending: false });

  const campaigns = (data ?? []) as CampaignListItem[];
  return <CampaignsView initial={campaigns} />;
}
```

- [ ] **Step 2: Vue client (formulaire + liste + actions)**

`src/app/dashboard/campaigns/CampaignsView.tsx` :

```typescript
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AUDIENCE_KEYS, audienceLabel, type AudienceKey } from "@/lib/segments/audience";
import type { SegmentSummary } from "@/lib/segments/summary";

export type CampaignListItem = {
  id: string; audience: AudienceKey; title: string; body: string;
  mode: "once" | "recurring"; run_on: string | null; active: boolean;
};

type Moment = "now" | "once" | "recurring";

function statusLabel(c: CampaignListItem): string {
  if (c.mode === "once") return c.run_on ? `Programmée le ${new Date(c.run_on).toLocaleDateString()}` : "Programmée";
  return c.active ? "Récurrente • active" : "Récurrente • en pause";
}

export function CampaignsView({ initial }: { initial: CampaignListItem[] }) {
  const router = useRouter();
  const [summary, setSummary] = useState<SegmentSummary | null>(null);
  const [audience, setAudience] = useState<AudienceKey>("all");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [moment, setMoment] = useState<Moment>("now");
  const [runOn, setRunOn] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/segments").then((r) => (r.ok ? r.json() : null)).then((j) => setSummary(j?.data ?? null)).catch(() => {});
  }, []);

  const sizeOf = (a: AudienceKey): number | null => {
    if (!summary) return null;
    if (a === "all") return summary.total;
    if (a === "recompense_prete") return summary.flags.recompense_prete;
    return summary.stages[a]?.count ?? 0;
  };

  const submit = async () => {
    setBusy(true); setMsg(null);
    try {
      if (moment === "now") {
        const res = await fetch("/api/notifications/send", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, body, audience }),
        });
        if (!res.ok) throw new Error();
        const j = await res.json();
        setMsg(`Envoyé à ${j.pushed} appareil(s).`);
      } else {
        const res = await fetch("/api/campaigns", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ audience, title, body, mode: moment, runOn: moment === "once" ? runOn : null }),
        });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error); }
        setMsg("Campagne enregistrée.");
        router.refresh();
      }
      setTitle(""); setBody(""); setRunOn("");
    } catch (e) {
      setMsg(e instanceof Error && e.message ? e.message : "Échec. Réessayez.");
    } finally { setBusy(false); }
  };

  const toggle = async (c: CampaignListItem) => {
    await fetch(`/api/campaigns/${c.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !c.active }),
    });
    router.refresh();
  };

  const remove = async (id: string) => {
    await fetch(`/api/campaigns/${id}`, { method: "DELETE" });
    router.refresh();
  };

  const input = "w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Campagnes</h1>
        <p className="text-zinc-500">Envoyez maintenant, programmez un jour, ou activez une relance récurrente.</p>
      </div>

      <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-6 max-w-xl space-y-4">
        <div className="space-y-1">
          <label className="text-sm text-zinc-400">Audience</label>
          <select value={audience} onChange={(e) => setAudience(e.target.value as AudienceKey)} className={input}>
            {AUDIENCE_KEYS.map((a) => {
              const n = sizeOf(a);
              return <option key={a} value={a}>{audienceLabel(a)}{n !== null ? ` (${n})` : ""}</option>;
            })}
          </select>
        </div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre" className={input} />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Votre message…" rows={3} className={input} />
        <div className="space-y-1">
          <label className="text-sm text-zinc-400">Quand ?</label>
          <select value={moment} onChange={(e) => setMoment(e.target.value as Moment)} className={input}>
            <option value="now">Maintenant</option>
            <option value="once">Programmée (un jour)</option>
            <option value="recurring">Récurrente (relance auto)</option>
          </select>
        </div>
        {moment === "once" && (
          <input type="date" value={runOn} onChange={(e) => setRunOn(e.target.value)} className={input} />
        )}
        <button onClick={submit}
          disabled={busy || !title.trim() || !body.trim() || (moment === "once" && !runOn)}
          className="bg-emerald-500 text-black rounded-xl px-5 py-2.5 font-bold disabled:opacity-50">
          {busy ? "…" : moment === "now" ? "Envoyer" : "Enregistrer la campagne"}
        </button>
        {msg && <p className="text-sm text-zinc-300">{msg}</p>}
      </div>

      <div>
        <h2 className="text-lg font-bold mb-4">Mes campagnes programmées & récurrentes</h2>
        <div className="space-y-3">
          {initial.length > 0 ? initial.map((c) => (
            <div key={c.id} className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-4 flex items-start justify-between gap-4">
              <div>
                <div className="font-bold">{c.title}</div>
                <div className="text-sm text-zinc-400">{c.body}</div>
                <div className="text-xs text-zinc-600 mt-1">{audienceLabel(c.audience)} · {statusLabel(c)}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {c.mode === "recurring" && (
                  <button onClick={() => toggle(c)} className="text-xs px-3 py-1.5 rounded-lg border border-zinc-700 hover:bg-zinc-800">
                    {c.active ? "Mettre en pause" : "Activer"}
                  </button>
                )}
                <button onClick={() => remove(c.id)} className="text-xs px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10">
                  Supprimer
                </button>
              </div>
            </div>
          )) : <p className="text-zinc-600 text-sm">Aucune campagne programmée ou récurrente pour l&apos;instant.</p>}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Ajouter l'entrée de nav**

Dans `src/app/dashboard/DashboardShell.tsx` : ajouter `Megaphone` à l'import `lucide-react` (ligne ~6-18) et insérer l'item de nav juste après « Notifications » dans `navItems` (ligne ~37) :

```typescript
    { name: "Notifications", icon: Bell, href: "/dashboard/notifications" },
    { name: "Campagnes", icon: Megaphone, href: "/dashboard/campaigns" },
```

- [ ] **Step 4: Vérifier le build complet**

Run: `npx tsc --noEmit && npm run build`
Expected: build OK, aucune erreur de type ni de lint.

- [ ] **Step 5: Fumée UI (compte démo)**

Run: `npm run dev` → connexion démo → onglet « Campagnes » :
1. Audience « Inactifs », titre + message, **Maintenant** → « Envoyé à N… ».
2. **Programmée** + date du jour → « Campagne enregistrée », apparaît dans la liste « Programmée le … ».
3. **Récurrente** → apparaît « Récurrente • active » ; bouton « Mettre en pause » bascule l'état ; « Supprimer » la retire.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/campaigns/page.tsx src/app/dashboard/campaigns/CampaignsView.tsx src/app/dashboard/DashboardShell.tsx
git commit -m "feat(campaigns): self-service Campagnes tab (now/scheduled/recurring) + nav"
```

---

## Task 12: Vérification finale

- [ ] **Step 1: Suite complète**

Run: `npx vitest run`
Expected: tous les tests verts (79 existants + 18 nouveaux = 97).

- [ ] **Step 2: Build de production**

Run: `npm run build`
Expected: succès, routes `/api/cron/campaigns`, `/api/campaigns`, `/dashboard/campaigns` listées.

- [ ] **Step 3: Notes de déploiement (pour le contrôleur, hors sous-agent)**

Rappels à exécuter en prod avec consentement :
1. Appliquer la migration `20260603_campaigns.sql` sur `oqcelbbozpykwkasjtqy`.
2. Ajouter `CRON_SECRET` dans Vercel (Production).
3. Le cron `vercel.json` s'active au prochain déploiement.

---

## Self-Review (rempli pendant la rédaction)

- **Couverture spec :** modèle de campagne (Task 2) ; audiences réutilisées (Tasks 6-8, 11) ; `campaigns`/`campaign_sends` + RLS (Task 1) ; logique pure validate/due/recipients (Tasks 3-5) ; cron protégé `CRON_SECRET` once+recurring (Task 8) ; idempotence `last_run_on` + cooldown (Tasks 7-8) ; CRUD marchand (Task 9) ; `vercel.json` 09:00 (Task 10) ; onglet UI 3 moments + actions (Task 11) ; tests TDD (Tasks 3-5) + build/fumée (6, 11, 12). Mode « Maintenant » → flux 4a réutilisé (Task 11). Hors périmètre (email/SMS, heure précise, anniversaire, A/B, analytics) non implémenté — conforme.
- **Placeholders :** aucun — code complet à chaque step.
- **Cohérence des types :** `CampaignRow`/`ValidatedCampaign`/`CampaignInput` (Task 2) utilisés tels quels dans validate (3), due (4), fetch (7), cron (8) ; `deliverToCards(merchantId, audience, cardIds, message)` même signature en Tasks 6, 8 ; `selectRecurringRecipients(cardIds, Map, cooldownDays, now)` identique Tasks 5 et 8 ; `CampaignListItem` partagé page↔vue (Task 11).
```
