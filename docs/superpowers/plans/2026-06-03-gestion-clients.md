# Gestion clients complète — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rendre l'onglet Clients pleinement fonctionnel : recherche + filtre statut, édition (nom/email/téléphone) via modale, et suppression (RGPD) câblée — en réutilisant l'API de suppression et `RedeemCell` existants.

**Architecture:** Deux fonctions pures testées (`validateCustomerUpdate`, `filterCustomers`). La page serveur ne fait que charger les données et les passe à un composant client unique `CustomersTable` (recherche/filtre en mémoire + actions par ligne). Une modale `EditCustomerModal` poste vers un nouveau `PATCH /api/customers/[id]`. Aucune migration BDD.

**Tech Stack:** Next.js 16 (App Router, route handlers `params` async) · React 19 · TypeScript · Supabase (`supabaseAdmin` + RLS) · Tailwind v4 · Vitest · lucide-react.

**Spec:** `docs/superpowers/specs/2026-06-03-gestion-clients-design.md`

---

## File Structure

```
src/lib/customers/validate.ts                # NEW — validateCustomerUpdate (PUR, testé)
src/lib/customers/__tests__/validate.test.ts # NEW
src/lib/customers/filter.ts                  # NEW — filterCustomers + types (PUR, testé)
src/lib/customers/__tests__/filter.test.ts   # NEW
src/lib/auditLog.ts                          # MODIFY — ajoute 'CUSTOMER_UPDATED'
src/app/api/customers/[id]/route.ts          # MODIFY — ajoute PATCH (DELETE inchangé)
src/app/dashboard/customers/EditCustomerModal.tsx  # NEW — modale d'édition
src/app/dashboard/customers/CustomersTable.tsx     # NEW — table client (recherche/filtre/actions)
src/app/dashboard/customers/page.tsx         # MODIFY — charge + délègue à CustomersTable
```

**Réutilisé (DRY) :** `RedeemCell` (`./RedeemCell`), le `DELETE` existant (`/api/customers/[id]`), `rateLimit`, `logAuditEvent`/`extractRequestMeta`, `supabaseAdmin`, `fetchMerchantConfig`.

---

## Task 1: `validateCustomerUpdate` (PUR, TDD)

**Files:**
- Test: `src/lib/customers/__tests__/validate.test.ts`
- Create: `src/lib/customers/validate.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { validateCustomerUpdate } from "../validate";

describe("validateCustomerUpdate", () => {
  it("refuse une mise à jour vide", () => {
    expect(validateCustomerUpdate({})).toEqual({ ok: false, error: "Aucune modification" });
  });
  it("accepte un nom valide avec accents et le trim", () => {
    const r = validateCustomerUpdate({ fullName: "  José Müller-O'Neil  " });
    expect(r).toEqual({ ok: true, value: { fullName: "José Müller-O'Neil" } });
  });
  it("refuse un nom trop court", () => {
    expect(validateCustomerUpdate({ fullName: "A" })).toEqual({ ok: false, error: "Nom invalide" });
  });
  it("normalise et accepte un email", () => {
    const r = validateCustomerUpdate({ email: "  JEAN@Example.COM " });
    expect(r).toEqual({ ok: true, value: { email: "jean@example.com" } });
  });
  it("refuse un email invalide", () => {
    expect(validateCustomerUpdate({ email: "pasunemail" })).toEqual({ ok: false, error: "Email invalide" });
  });
  it("vide le téléphone (chaîne vide → null)", () => {
    expect(validateCustomerUpdate({ phone: "  " })).toEqual({ ok: true, value: { phone: null } });
  });
  it("accepte un téléphone valide", () => {
    expect(validateCustomerUpdate({ phone: "+41 79 123 45 67" })).toEqual({ ok: true, value: { phone: "+41 79 123 45 67" } });
  });
  it("refuse un téléphone invalide", () => {
    expect(validateCustomerUpdate({ phone: "abcd" })).toEqual({ ok: false, error: "Téléphone invalide" });
  });
  it("gère une mise à jour partielle (un seul champ)", () => {
    const r = validateCustomerUpdate({ email: "a@b.co", fullName: undefined });
    expect(r).toEqual({ ok: true, value: { email: "a@b.co" } });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/customers/__tests__/validate.test.ts`
Expected: FAIL — `Failed to resolve import "../validate"`.

- [ ] **Step 3: Write minimal implementation**

```typescript
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_RE = /^[\p{L}\s'-]{2,100}$/u;
const PHONE_RE = /^[0-9+()\s-]{4,30}$/;

export type CustomerUpdateInput = { fullName?: unknown; email?: unknown; phone?: unknown };
export type ValidatedCustomerUpdate = { fullName?: string; email?: string; phone?: string | null };

export type ValidateResult =
  | { ok: true; value: ValidatedCustomerUpdate }
  | { ok: false; error: string };

export function validateCustomerUpdate(input: CustomerUpdateInput): ValidateResult {
  const value: ValidatedCustomerUpdate = {};

  if (input.fullName !== undefined) {
    if (typeof input.fullName !== "string") return { ok: false, error: "Nom invalide" };
    const name = input.fullName.trim();
    if (!NAME_RE.test(name)) return { ok: false, error: "Nom invalide" };
    value.fullName = name;
  }

  if (input.email !== undefined) {
    if (typeof input.email !== "string") return { ok: false, error: "Email invalide" };
    const email = input.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email) || email.length > 254) return { ok: false, error: "Email invalide" };
    value.email = email;
  }

  if (input.phone !== undefined) {
    if (typeof input.phone !== "string") return { ok: false, error: "Téléphone invalide" };
    const phone = input.phone.trim();
    if (phone === "") {
      value.phone = null;
    } else if (!PHONE_RE.test(phone)) {
      return { ok: false, error: "Téléphone invalide" };
    } else {
      value.phone = phone;
    }
  }

  if (Object.keys(value).length === 0) return { ok: false, error: "Aucune modification" };
  return { ok: true, value };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/customers/__tests__/validate.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/customers/validate.ts src/lib/customers/__tests__/validate.test.ts
git commit -m "feat(customers): pure validateCustomerUpdate with tests"
```

---

## Task 2: `filterCustomers` (PUR, TDD)

**Files:**
- Test: `src/lib/customers/__tests__/filter.test.ts`
- Create: `src/lib/customers/filter.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { filterCustomers, type CustomerListItem } from "../filter";

const mk = (over: Partial<CustomerListItem>): CustomerListItem => ({
  id: "1", full_name: "Jean Dupont", email: "jean@ex.com", phone: "0790000000", loyalty_cards: [{ id: "c1", stamps_count: 3, last_scan: null }],
  ...over,
});

describe("filterCustomers", () => {
  const list = [
    mk({ id: "1", full_name: "Jean Dupont", email: "jean@ex.com", phone: "0791112233", loyalty_cards: [{ id: "c1", stamps_count: 10, last_scan: null }] }),
    mk({ id: "2", full_name: "Marie Curie", email: "marie@ex.com", phone: "0794445566", loyalty_cards: [{ id: "c2", stamps_count: 2, last_scan: null }] }),
    mk({ id: "3", full_name: "Sans Carte", email: null, phone: null, loyalty_cards: [] }),
  ];

  it("renvoie tout sans recherche ni filtre", () => {
    expect(filterCustomers(list, "", "all", 10).map((c) => c.id)).toEqual(["1", "2", "3"]);
  });
  it("recherche par nom (insensible à la casse)", () => {
    expect(filterCustomers(list, "marie", "all", 10).map((c) => c.id)).toEqual(["2"]);
  });
  it("recherche par email", () => {
    expect(filterCustomers(list, "JEAN@", "all", 10).map((c) => c.id)).toEqual(["1"]);
  });
  it("recherche par téléphone", () => {
    expect(filterCustomers(list, "4445566", "all", 10).map((c) => c.id)).toEqual(["2"]);
  });
  it("filtre 'full' = cartes pleines selon l'objectif", () => {
    expect(filterCustomers(list, "", "full", 10).map((c) => c.id)).toEqual(["1"]);
  });
  it("filtre 'nocard' = sans carte", () => {
    expect(filterCustomers(list, "", "nocard", 10).map((c) => c.id)).toEqual(["3"]);
  });
  it("combine recherche et filtre", () => {
    expect(filterCustomers(list, "marie", "full", 10)).toEqual([]);
  });
  it("liste vide → []", () => {
    expect(filterCustomers([], "x", "all", 10)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/customers/__tests__/filter.test.ts`
Expected: FAIL — `Failed to resolve import "../filter"`.

- [ ] **Step 3: Write minimal implementation**

```typescript
export type CustomerListItem = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  loyalty_cards: { id: string; stamps_count: number; last_scan: string | null }[] | null;
};

export type StatusFilter = "all" | "full" | "nocard";

export function filterCustomers(
  customers: CustomerListItem[],
  query: string,
  status: StatusFilter,
  stampGoal: number,
): CustomerListItem[] {
  const q = query.trim().toLowerCase();
  return customers.filter((c) => {
    const matchesQuery = !q
      || c.full_name.toLowerCase().includes(q)
      || (c.email ?? "").toLowerCase().includes(q)
      || (c.phone ?? "").toLowerCase().includes(q);
    if (!matchesQuery) return false;

    const card = c.loyalty_cards?.[0];
    if (status === "full") return !!card && card.stamps_count >= stampGoal;
    if (status === "nocard") return !card;
    return true;
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/customers/__tests__/filter.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/customers/filter.ts src/lib/customers/__tests__/filter.test.ts
git commit -m "feat(customers): pure filterCustomers with tests"
```

---

## Task 3: `PATCH /api/customers/[id]` + audit action

**Files:**
- Modify: `src/lib/auditLog.ts`
- Modify: `src/app/api/customers/[id]/route.ts`

- [ ] **Step 1: Ajouter l'action d'audit**

Dans `src/lib/auditLog.ts`, ajouter `'CUSTOMER_UPDATED'` à l'union `AuditAction` (la dernière entrée actuelle est `| 'REWARD_REDEEMED';` — ajouter après) :

```typescript
  | 'REWARD_REDEEMED'
  | 'CUSTOMER_UPDATED';
```

- [ ] **Step 2: Ajouter le handler PATCH**

Dans `src/app/api/customers/[id]/route.ts` : ajouter l'import en tête, puis le `export async function PATCH` à la suite du `DELETE` existant (NE PAS toucher au `DELETE`).

Import à ajouter (sous les imports existants) :
```typescript
import { validateCustomerUpdate } from "@/lib/customers/validate";
```

Handler à ajouter :
```typescript
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json({ error: "Identifiant invalide" }, { status: 400 });
    }

    const { createClient } = await import("@/utils/supabase/server");
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    const rateLimitResult = await rateLimit(`customer-update:${user.id}`, 30, 3600000); // 30/hour
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: "Trop de modifications. Réessayez plus tard." }, { status: 429 });
    }

    const { data: merchant } = await supabaseAdmin
      .from("merchants").select("id").eq("user_id", user.id).maybeSingle();
    if (!merchant) return NextResponse.json({ error: "Profil marchand manquant" }, { status: 400 });

    const { data: customer } = await supabaseAdmin
      .from("customers").select("id, merchant_id").eq("id", id).maybeSingle();
    if (!customer) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });
    if (customer.merchant_id !== merchant.id) {
      return NextResponse.json({ error: "Ce client n'appartient pas à votre boutique" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const v = validateCustomerUpdate(body);
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

    const update: Record<string, unknown> = {};
    if (v.value.fullName !== undefined) update.full_name = v.value.fullName;
    if (v.value.email !== undefined) update.email = v.value.email;
    if (v.value.phone !== undefined) update.phone = v.value.phone;

    const { error: updErr } = await supabaseAdmin.from("customers").update(update).eq("id", id);
    if (updErr) {
      if ((updErr as { code?: string }).code === "23505") {
        return NextResponse.json({ error: "Email déjà utilisé par un autre client" }, { status: 409 });
      }
      throw updErr;
    }

    const meta = extractRequestMeta(req);
    await logAuditEvent({
      action: "CUSTOMER_UPDATED",
      merchant_id: merchant.id,
      user_id: user.id,
      details: { customer_id: id, fields: Object.keys(update) },
      ...meta,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Customer update error:", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Erreur lors de la modification" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Vérifier la compilation + tests**

Run: `npx tsc --noEmit` (ignorer les 2 erreurs préexistantes `passJson.test.ts`) puis `npx vitest run`.
Expected: aucune nouvelle erreur ; tous les tests verts.

- [ ] **Step 4: Commit**

```bash
git add src/lib/auditLog.ts "src/app/api/customers/[id]/route.ts"
git commit -m "feat(customers): PATCH endpoint to edit customer (name/email/phone) + audit"
```

---

## Task 4: Modale d'édition `EditCustomerModal`

**Files:**
- Create: `src/app/dashboard/customers/EditCustomerModal.tsx`

- [ ] **Step 1: Créer la modale**

```typescript
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

export type EditableCustomer = { id: string; full_name: string; email: string | null; phone: string | null };

export function EditCustomerModal({ customer, onClose }: { customer: EditableCustomer; onClose: () => void }) {
  const router = useRouter();
  const [fullName, setFullName] = useState(customer.full_name);
  const [email, setEmail] = useState(customer.email ?? "");
  const [phone, setPhone] = useState(customer.phone ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/customers/${customer.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Échec");
      onClose();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Échec");
    } finally {
      setBusy(false);
    }
  };

  const input = "w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm";

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 w-full max-w-md space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Modifier le client</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-1">
          <label className="text-sm text-zinc-400">Nom</label>
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} className={input} />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-zinc-400">Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-zinc-400">Téléphone</label>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optionnel" className={input} />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex gap-2 justify-end pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-zinc-700 text-sm">Annuler</button>
          <button onClick={save} disabled={busy}
            className="px-5 py-2 rounded-xl bg-emerald-500 text-black font-bold text-sm disabled:opacity-50">
            {busy ? "…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `npx tsc --noEmit` (ignorer passJson).
Expected: aucune nouvelle erreur.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/customers/EditCustomerModal.tsx
git commit -m "feat(customers-ui): edit customer modal"
```

---

## Task 5: Table client `CustomersTable` + refonte `page.tsx`

**Files:**
- Create: `src/app/dashboard/customers/CustomersTable.tsx`
- Modify: `src/app/dashboard/customers/page.tsx`

- [ ] **Step 1: Créer `CustomersTable`**

```typescript
"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, Mail, Smartphone, Calendar, Users, Pencil, Trash2 } from "lucide-react";
import { RedeemCell } from "./RedeemCell";
import { EditCustomerModal, type EditableCustomer } from "./EditCustomerModal";
import { filterCustomers, type CustomerListItem, type StatusFilter } from "@/lib/customers/filter";

export function CustomersTable({ customers, stampGoal }: { customers: CustomerListItem[]; stampGoal: number }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [editing, setEditing] = useState<EditableCustomer | null>(null);

  const filtered = useMemo(
    () => filterCustomers(customers, query, status, stampGoal),
    [customers, query, status, stampGoal],
  );

  const del = async (c: CustomerListItem) => {
    if (!window.confirm(`Supprimer définitivement ${c.full_name} et toutes ses données ?`)) return;
    const res = await fetch(`/api/customers/${c.id}`, { method: "DELETE" });
    if (res.ok) router.refresh();
    else window.alert("Échec de la suppression.");
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Base Clients</h1>
          <p className="text-zinc-500">Gérez vos {customers.length} clients enregistrés.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} type="text" placeholder="Rechercher..."
              className="bg-zinc-900 border border-zinc-800 rounded-xl py-2 pl-10 pr-4 text-sm focus:border-emerald-500/50 outline-none transition-all w-full md:w-64" />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className="bg-zinc-900 border border-zinc-800 rounded-xl py-2 px-3 text-sm text-zinc-300">
            <option value="all">Tous</option>
            <option value="full">Carte pleine</option>
            <option value="nocard">Sans carte</option>
          </select>
        </div>
      </div>

      <div className="bg-zinc-900/40 border border-zinc-800 rounded-[32px] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 text-xs font-bold text-zinc-500 uppercase tracking-widest bg-zinc-950/20">
                <th className="px-8 py-5">Client</th>
                <th className="px-8 py-5">Fidélité</th>
                <th className="px-8 py-5">Contact</th>
                <th className="px-8 py-5">Dernière Visite</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {filtered.length > 0 ? filtered.map((customer) => {
                const card = customer.loyalty_cards?.[0];
                return (
                  <tr key={customer.id} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">
                          {customer.full_name[0]}
                        </div>
                        <div>
                          <div className="font-bold">{customer.full_name}</div>
                          <div className="text-xs text-zinc-500">ID: {customer.id.slice(0, 8)}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      {card ? (
                        <div className="flex flex-col gap-1.5">
                          <div className="text-sm font-bold text-emerald-400">{card.stamps_count} / {stampGoal} pts</div>
                          <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, (card.stamps_count / stampGoal) * 100)}%` }} />
                          </div>
                        </div>
                      ) : (<span className="text-xs text-zinc-600 italic">Pas de carte active</span>)}
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-xs text-zinc-400"><Mail className="w-3 h-3" />{customer.email || "Non renseigné"}</div>
                        <div className="flex items-center gap-2 text-xs text-zinc-400"><Smartphone className="w-3 h-3" />{customer.phone || "Non renseigné"}</div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-2 text-sm text-zinc-500 underline decoration-zinc-800 underline-offset-4">
                        <Calendar className="w-4 h-4" />
                        {card?.last_scan ? new Date(card.last_scan).toLocaleDateString() : "—"}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center justify-end gap-2">
                        <RedeemCell cardId={card?.id ?? null} stampsCount={card?.stamps_count ?? null} goal={stampGoal} customerName={customer.full_name} />
                        <button onClick={() => setEditing({ id: customer.id, full_name: customer.full_name, email: customer.email, phone: customer.phone })}
                          title="Modifier" className="p-2 rounded-lg border border-zinc-700 hover:bg-zinc-800">
                          <Pencil className="w-4 h-4 text-zinc-400" />
                        </button>
                        <button onClick={() => del(customer)} title="Supprimer"
                          className="p-2 rounded-lg border border-red-500/30 hover:bg-red-500/10">
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={5} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-4 text-zinc-600">
                      <Users className="w-12 h-12 opacity-20" />
                      <p>Aucun client trouvé.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editing && <EditCustomerModal customer={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
```

- [ ] **Step 2: Refondre `page.tsx`** — remplacer le contenu complet par :

```typescript
import { createClient } from "@/utils/supabase/server";
import { fetchMerchantConfig } from "@/lib/merchant-config/fetch";
import { CustomersTable } from "./CustomersTable";
import type { CustomerListItem } from "@/lib/customers/filter";

export default async function Customers() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: merchant } = await supabase
    .from("merchants").select("id").eq("user_id", user?.id).single();

  const stampGoal = merchant ? (await fetchMerchantConfig(merchant.id)).stampGoal : 10;

  const { data: customers } = await supabase
    .from("customers")
    .select("id, full_name, email, phone, loyalty_cards(id, stamps_count, last_scan)")
    .eq("merchant_id", merchant?.id)
    .order("created_at", { ascending: false });

  return <CustomersTable customers={(customers ?? []) as CustomerListItem[]} stampGoal={stampGoal} />;
}
```

- [ ] **Step 3: Vérifier le build complet**

Run: `npx tsc --noEmit` (ignorer passJson) puis `npm run build`.
Expected: succès, `/dashboard/customers` listée, aucun import inutilisé.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/customers/CustomersTable.tsx src/app/dashboard/customers/page.tsx
git commit -m "feat(customers-ui): searchable/filterable client table with edit + delete actions"
```

---

## Task 6: Vérification finale

- [ ] **Step 1: Suite complète**

Run: `npx vitest run`
Expected: tous verts (108 de la branche + 9 validate + 8 filter = 125).

- [ ] **Step 2: Build de production**

Run: `npm run build`
Expected: succès.

- [ ] **Step 3: Fumée (compte démo, `npm run dev` déjà lancé)**

1. Onglet Clients : taper dans la recherche → la liste se filtre (nom/email/téléphone).
2. Filtre « Carte pleine » → seules les cartes ≥ objectif s'affichent ; « Sans carte » → seuls les clients sans carte.
3. Bouton « Modifier » (crayon) → modale → changer le nom → Enregistrer → la ligne se met à jour.
4. Mettre un email déjà utilisé par un autre client → message « Email déjà utilisé… » (409).
5. Bouton « Supprimer » (corbeille) → confirmation → le client disparaît.

---

## Self-Review (rempli pendant la rédaction)

- **Couverture spec :** recherche+filtre (Tasks 2, 5) ; édition nom/email/téléphone via modale + PATCH (Tasks 3, 4, 5) ; suppression câblée sur le DELETE existant (Task 5) ; validation pure (Task 1) ; action audit `CUSTOMER_UPDATED` (Task 3) ; unicité email → 409 (Task 3) ; aucune migration. Hors périmètre (bulk, CSV, fiche détaillée, édition tampons) non implémenté.
- **Placeholders :** aucun — code complet à chaque step.
- **Cohérence des types :** `CustomerListItem` défini Task 2, consommé Tasks 5 (table) et page ; `StatusFilter` Task 2 ↔ Task 5 ; `validateCustomerUpdate` Task 1 ↔ Task 3 ; `EditableCustomer` Task 4 ↔ Task 5 ; `ValidatedCustomerUpdate` mappé en `full_name/email/phone` (Task 3). Le `DELETE` existant inchangé.
```
