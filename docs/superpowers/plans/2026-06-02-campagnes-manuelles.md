# Sous-projet 4a — Campagnes manuelles ciblées — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre au marchand d'envoyer un message push Wallet à une audience ciblée (un segment, « Récompense prête », ou tous), en étendant l'envoi existant et en réutilisant le moteur de segmentation comme source unique des audiences.

**Architecture:** Une fonction pure `selectAudienceCardIds` (testée) filtre des lignes classées par audience ; `fetchAudienceCardIds` la branche sur `loadClassified` (moteur de segmentation déjà en place, étendu pour exposer les `cardIds`). La route `/api/notifications/send` accepte un `audience` (défaut « all » → rétro-compatible) et journalise l'audience. L'UI marchand (onglet Notifications) gagne un sélecteur d'audience avec tailles, alimenté par l'endpoint `/api/segments` existant.

**Tech Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Supabase (`@supabase/ssr` RLS + service-role) · Vitest · Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-06-02-campagnes-manuelles-design.md`

---

## File Structure

```
supabase/migrations/20260602_campaign_audience.sql   # NEW (créée, PAS appliquée par le sous-agent)
src/lib/segments/audience.ts        # AudienceKey, AUDIENCE_KEYS, isAudienceKey, audienceLabel, selectAudienceCardIds (PUR)
src/lib/segments/__tests__/audience.test.ts
src/lib/segments/fetch.ts           # MODIFY : loadClassified expose cardIds ; + fetchAudienceCardIds
src/app/api/notifications/send/route.ts  # MODIFY : param audience + log audience
src/app/dashboard/notifications/SendForm.tsx  # MODIFY : sélecteur d'audience + tailles
src/app/dashboard/notifications/page.tsx      # MODIFY : audience dans l'historique
```

**Réutilisé (DRY) :** `STAGE_KEYS`/`STAGE_LABELS`/`FLAG_LABELS` (`@/lib/segments/types`), `loadClassified` (`@/lib/segments/fetch`), `/api/segments` (tailles), `getChannels`/`rateLimit`/`currentMerchantId` (route existante).

---

### Task 1: Migration BDD (créer, NE PAS appliquer)

**Files:** Create `supabase/migrations/20260602_campaign_audience.sql`

- [ ] **Step 1: Écrire la migration**
```sql
ALTER TABLE wallet_notifications ADD COLUMN IF NOT EXISTS audience TEXT NOT NULL DEFAULT 'all';
```

- [ ] **Step 2: NE PAS appliquer** — créer le fichier seulement. L'application en prod (projet WalletCard `oqcelbbozpykwkasjtqy`) est faite par le contrôleur avec le consentement utilisateur, hors de ce sous-agent.

- [ ] **Step 3: Commit**
```bash
git add supabase/migrations/20260602_campaign_audience.sql
git commit -m "feat(db): wallet_notifications.audience for targeted campaigns"
```

---

### Task 2: `audience.ts` — modèle + sélecteur pur (TDD)

**Files:** Create `src/lib/segments/audience.ts`, Test `src/lib/segments/__tests__/audience.test.ts`

- [ ] **Step 1: Écrire le test (échoue d'abord)**
```ts
import { describe, it, expect } from "vitest";
import { selectAudienceCardIds, AUDIENCE_KEYS, audienceLabel, isAudienceKey } from "@/lib/segments/audience";

const rows = [
  { stage: "vip" as const, recompenseReady: true, cardIds: ["a"] },
  { stage: "inactif" as const, recompenseReady: false, cardIds: ["b", "c"] },
  { stage: "regulier" as const, recompenseReady: true, cardIds: ["d"] },
];

describe("AUDIENCE_KEYS / libellés", () => {
  it("5 stades + recompense_prete + all, chacun avec un libellé", () => {
    expect(AUDIENCE_KEYS).toHaveLength(7);
    for (const a of AUDIENCE_KEYS) expect(audienceLabel(a).length).toBeGreaterThan(0);
    expect(audienceLabel("all")).toBe("Tous mes clients");
  });
  it("isAudienceKey valide/invalide", () => {
    expect(isAudienceKey("vip")).toBe(true);
    expect(isAudienceKey("recompense_prete")).toBe(true);
    expect(isAudienceKey("garage")).toBe(false);
  });
});

describe("selectAudienceCardIds", () => {
  it("all -> union de toutes les cartes", () => {
    expect(selectAudienceCardIds(rows, "all").sort()).toEqual(["a", "b", "c", "d"]);
  });
  it("un stade -> cartes de ce stade", () => {
    expect(selectAudienceCardIds(rows, "inactif")).toEqual(["b", "c"]);
  });
  it("recompense_prete -> cartes des clients flaggés", () => {
    expect(selectAudienceCardIds(rows, "recompense_prete").sort()).toEqual(["a", "d"]);
  });
  it("audience sans membre -> []", () => {
    expect(selectAudienceCardIds(rows, "nouveau")).toEqual([]);
  });
});
```

- [ ] **Step 2: Vérifier l'échec** — Run: `cd ~/Projects/Carte-Fidelite && npm test -- audience` → FAIL.

- [ ] **Step 3: Implémenter**
```ts
import { STAGE_KEYS, STAGE_LABELS, FLAG_LABELS, type StageKey } from "./types";

export type AudienceKey = StageKey | "recompense_prete" | "all";

export const AUDIENCE_KEYS: readonly AudienceKey[] = [...STAGE_KEYS, "recompense_prete", "all"];

export function isAudienceKey(s: string): s is AudienceKey {
  return (AUDIENCE_KEYS as readonly string[]).includes(s);
}

export function audienceLabel(a: AudienceKey): string {
  if (a === "all") return "Tous mes clients";
  if (a === "recompense_prete") return FLAG_LABELS.recompense_prete;
  return STAGE_LABELS[a];
}

export type AudienceRow = { stage: StageKey; recompenseReady: boolean; cardIds: string[] };

export function selectAudienceCardIds(rows: AudienceRow[], audience: AudienceKey): string[] {
  const ids: string[] = [];
  for (const r of rows) {
    const match =
      audience === "all" ? true
      : audience === "recompense_prete" ? r.recompenseReady
      : r.stage === audience;
    if (match) ids.push(...r.cardIds);
  }
  return ids;
}
```

- [ ] **Step 4: Vérifier le succès** — Run: `npm test -- audience` → PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/segments/audience.ts src/lib/segments/__tests__/audience.test.ts
git commit -m "feat(campaigns): audience model + pure card-id selector"
```

---

### Task 3: `fetch.ts` — exposer les cardIds + `fetchAudienceCardIds`

**Files:** Modify `src/lib/segments/fetch.ts`

> `loadClassified` charge déjà clients + cartes ; on expose les `cardIds` par client (ajout non-cassant : `fetchSegmentCounts`/`fetchSegmentMembers` ignorent le champ).

- [ ] **Step 1: Étendre `loadClassified`**

Dans `src/lib/segments/fetch.ts` :
1. Changer la signature de retour de `loadClassified` de
   `Promise<{ stats: CustomerStats; cls: Classification }[]>`
   vers
   `Promise<{ stats: CustomerStats; cls: Classification; cardIds: string[] }[]>`.
2. Dans le `return list.map(...)`, remplacer le corps par :
```ts
  return list.map((c) => {
    const cards = c.loyalty_cards ?? [];
    const stats = buildCustomerStats(c, cards, scanCounts, reachable);
    return { stats, cls: classifyCustomer(stats, now, cfg), cardIds: cards.map((k) => k.id) };
  });
```

- [ ] **Step 2: Ajouter `fetchAudienceCardIds`**

Ajouter en haut l'import :
```ts
import { selectAudienceCardIds, type AudienceKey, type AudienceRow } from "./audience";
```
Puis ajouter cette fonction exportée (par ex. après `fetchSegmentMembers`) :
```ts
export async function fetchAudienceCardIds(merchantId: string, audience: AudienceKey): Promise<string[]> {
  const rows = await loadClassified(merchantId);
  const audienceRows: AudienceRow[] = rows.map((r) => ({
    stage: r.cls.stage,
    recompenseReady: r.cls.flags.recompense_prete,
    cardIds: r.cardIds,
  }));
  return selectAudienceCardIds(audienceRows, audience);
}
```

- [ ] **Step 3: Vérifier** — Run: `npm run build` → « Compiled successfully » ; `npm test` → tous PASS (les suites segments existantes ne cassent pas).

- [ ] **Step 4: Commit**
```bash
git add src/lib/segments/fetch.ts
git commit -m "feat(campaigns): resolve audience to card ids via segmentation engine"
```

---

### Task 4: Route d'envoi — paramètre `audience`

**Files:** Modify `src/app/api/notifications/send/route.ts`

- [ ] **Step 1: Remplacer le fichier**

Remplacer tout `src/app/api/notifications/send/route.ts` par :
```ts
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { currentMerchantId } from "@/lib/analytics/merchant";
import { getChannels } from "@/lib/wallet/channel";
import { rateLimit } from "@/lib/rateLimit";
import { fetchAudienceCardIds } from "@/lib/segments/fetch";
import { isAudienceKey, type AudienceKey } from "@/lib/segments/audience";

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
  if (!cardIds.length) return NextResponse.json({ pushed: 0, reachable: 0 });

  const { data: regs } = await supabaseAdmin
    .from("wallet_device_registrations").select("serial_number").in("serial_number", cardIds);
  const reachable = [...new Set((regs ?? []).map((r) => r.serial_number as string))];

  let pushed = 0;
  for (const ch of getChannels()) pushed += (await ch.notify(reachable, { title, body })).pushed;
  await supabaseAdmin
    .from("wallet_notifications")
    .insert({ merchant_id: merchantId, title, body, sent_count: pushed, audience: aud });
  return NextResponse.json({ pushed, reachable: reachable.length });
}
```

- [ ] **Step 2: Vérifier** — Run: `npm run build` → OK (route `/api/notifications/send` listée).

- [ ] **Step 3: Commit**
```bash
git add src/app/api/notifications/send/route.ts
git commit -m "feat(campaigns): send route targets an audience + logs it"
```

---

### Task 5: UI — sélecteur d'audience dans `SendForm`

**Files:** Modify `src/app/dashboard/notifications/SendForm.tsx`

- [ ] **Step 1: Remplacer le fichier**

Remplacer tout `src/app/dashboard/notifications/SendForm.tsx` par :
```tsx
"use client";
import { useEffect, useState } from "react";
import { AUDIENCE_KEYS, audienceLabel, type AudienceKey } from "@/lib/segments/audience";
import type { SegmentSummary } from "@/lib/segments/summary";

export function SendForm() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<AudienceKey>("all");
  const [summary, setSummary] = useState<SegmentSummary | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetch("/api/segments")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setSummary(j?.data ?? null))
      .catch(() => {});
  }, []);

  const sizeOf = (a: AudienceKey): number | null => {
    if (!summary) return null;
    if (a === "all") return summary.total;
    if (a === "recompense_prete") return summary.flags.recompense_prete;
    return summary.stages[a]?.count ?? 0;
  };

  const send = async () => {
    setSending(true); setResult(null);
    try {
      const res = await fetch("/api/notifications/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, audience }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error();
      setResult(`Envoyé à ${json.pushed} appareil(s) (${json.reachable} client(s) joignable(s)).`);
      setTitle(""); setBody("");
    } catch {
      setResult("Échec de l'envoi. Réessayez.");
    } finally { setSending(false); }
  };

  return (
    <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-6 max-w-xl space-y-4">
      <div className="space-y-1">
        <label className="text-sm text-zinc-400">Audience</label>
        <select value={audience} onChange={(e) => setAudience(e.target.value as AudienceKey)}
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm">
          {AUDIENCE_KEYS.map((a) => {
            const n = sizeOf(a);
            return <option key={a} value={a}>{audienceLabel(a)}{n !== null ? ` (${n})` : ""}</option>;
          })}
        </select>
      </div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre (ex. Offre du week-end)"
        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm" />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Votre message…" rows={3}
        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm" />
      <button onClick={send} disabled={sending || !title.trim() || !body.trim()}
        className="bg-emerald-500 text-black rounded-xl px-5 py-2.5 font-bold disabled:opacity-50">
        {sending ? "Envoi…" : "Envoyer à mes clients"}
      </button>
      {result && <p className="text-sm text-zinc-300">{result}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Vérifier** — Run: `npm run build` → OK.

- [ ] **Step 3: Commit**
```bash
git add src/app/dashboard/notifications/SendForm.tsx
git commit -m "feat(campaigns): audience selector with sizes in send form"
```

---

### Task 6: Historique — afficher l'audience

**Files:** Modify `src/app/dashboard/notifications/page.tsx`

- [ ] **Step 1: Afficher le libellé d'audience**

Dans `src/app/dashboard/notifications/page.tsx` :
1. Ajouter l'import : `import { audienceLabel, isAudienceKey } from "@/lib/segments/audience";`
2. Dans la `div` méta de chaque entrée d'historique, remplacer :
```tsx
              <div className="text-xs text-zinc-600 mt-1">{new Date(n.created_at).toLocaleString()} · {n.sent_count} envoyé(s)</div>
```
par :
```tsx
              <div className="text-xs text-zinc-600 mt-1">{new Date(n.created_at).toLocaleString()} · {n.sent_count} envoyé(s) · {isAudienceKey(n.audience) ? audienceLabel(n.audience) : "Tous mes clients"}</div>
```

- [ ] **Step 2: Build + fumée** — Run: `npm run build` → OK. Puis `npm run dev`, connecté en marchand démo (`demo@walletcard.app`), onglet **Notifications** : le sélecteur affiche les audiences avec tailles ; envoyer vers « Inactifs » ; l'historique montre l'audience ; « Tous » = comportement d'avant.

- [ ] **Step 3: Commit**
```bash
git add src/app/dashboard/notifications/page.tsx
git commit -m "feat(campaigns): show targeted audience in notification history"
```

---

### Task 7: Vérification finale

- [ ] **Step 1: Tests** — Run: `npm test` → tous PASS (dont la nouvelle suite `audience`).
- [ ] **Step 2: Build** — Run: `npm run build` → « Compiled successfully », routes `/api/notifications/send` et `/dashboard/notifications` présentes.
- [ ] **Step 3: Lint** — Run: `npx eslint src/lib/segments "src/app/api/notifications/send" "src/app/dashboard/notifications"` → 0 erreur.
- [ ] **Step 4: Fumée (après migration appliquée par le contrôleur)** — En dev, compte démo : choisir « Récompense prête » / « Inactifs » → envoyer → réponse `pushed/reachable` cohérente, historique avec l'audience. « Tous » identique à avant.

---

## Notes de réalisation

- **TDD** sur la logique pure (`selectAudienceCardIds`, registre/labels d'audience). Route, fetch et UI vérifiés par `build` + fumée.
- **Migration** : créée mais appliquée en prod (`oqcelbbozpykwkasjtqy`) par le contrôleur **avec consentement** — un sous-agent ne l'applique jamais.
- **Rétro-compatibilité** : sans `audience`, la route reste un broadcast « all » ; colonne `audience` défaut `'all'` pour les envois historiques.
- **DRY / source unique** : l'audience est résolue par le **moteur de segmentation** (même définition que l'onglet Segments) ; aucune logique de classification dupliquée. Le canal push (Module 3) reste inchangé.
- **Réutilisation 4b** : `fetchAudienceCardIds` sera le point d'entrée d'audience des déclencheurs automatisés (anniversaire, rappels inactifs).
- **Hors périmètre** : automatisation/planificateur, modèles de message, combinaisons d'audiences, table `campaigns` dédiée.
```
