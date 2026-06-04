# Mode concierge super-admin (impersonation) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre au super-admin de basculer dans le contexte d'un commerçant et de piloter ses écrans de gestion existants, avec bannière persistante et audit.

**Architecture:** On détourne le point unique `currentMerchantId()` : en contexte d'impersonation (admin + cookie signé valide), il renvoie le marchand ciblé, donc tous les écrans/API existants suivent. Cookie HMAC HttpOnly, double vérrou rôle admin, audit append-only.

**Tech Stack:** Next.js 16 (App Router, src/), Supabase (RLS + service-role), TypeScript, Vitest, crypto (HMAC).

Spec : `docs/superpowers/specs/2026-06-04-super-admin-concierge-design.md`

---

## Carte des fichiers

**Créés :**
- `src/lib/admin/impersonation.ts` — signature/vérif du token + `resolveEffectiveMerchantId` (pur) + lecture cookie
- `src/lib/admin/__tests__/impersonation.test.ts` — tests purs
- `src/app/api/admin/impersonate/start/route.ts` — démarre l'impersonation
- `src/app/api/admin/impersonate/stop/route.ts` — arrête l'impersonation
- `src/app/api/admin/merchants/[id]/management-mode/route.ts` — toggle du drapeau
- `src/app/api/merchant/me/route.ts` — renvoie le marchand effectif (pour écrans client)
- `src/app/dashboard/ImpersonationBanner.tsx` — bannière persistante
- `src/app/admin/merchants/ManageAsButton.tsx` — bouton « Gérer en tant que »
- `src/app/admin/merchants/ManagementModeToggle.tsx` — interrupteur du drapeau
- `supabase/migrations/20260604_admin_concierge.sql` — colonne + audit actions + RLS campaigns

**Modifiés :**
- `src/lib/analytics/merchant.ts` — `currentMerchantId()` utilise le résolveur
- `src/lib/auditLog.ts` — 2 nouveaux `AuditAction`
- `src/app/dashboard/layout.tsx` — autorise l'admin si impersonation active
- `src/app/dashboard/DashboardShell.tsx` (ou layout) — insère la bannière
- `src/app/admin/merchants/page.tsx` — badge + filtre + boutons
- `src/app/dashboard/settings/page.tsx` & `src/app/dashboard/generate/page.tsx` — lisent `/api/merchant/me`

---

## Task 1 : Signature HMAC du token d'impersonation (pur)

**Files:**
- Create: `src/lib/admin/impersonation.ts`
- Test: `src/lib/admin/__tests__/impersonation.test.ts`

- [ ] **Step 1: Écrire le test qui échoue**

```typescript
// src/lib/admin/__tests__/impersonation.test.ts
import { describe, it, expect, beforeAll } from "vitest";
import { signImpersonationToken, verifyImpersonationToken } from "../impersonation";

beforeAll(() => {
  process.env.IMPERSONATION_SECRET = "test-secret-1234567890";
});

describe("token d'impersonation", () => {
  it("round-trip : un token signé est revérifié et rend le merchantId", () => {
    const token = signImpersonationToken("merchant-abc");
    expect(verifyImpersonationToken(token)).toBe("merchant-abc");
  });

  it("rejette un token trafiqué (signature modifiée)", () => {
    const token = signImpersonationToken("merchant-abc");
    const tampered = token.slice(0, -2) + (token.endsWith("aa") ? "bb" : "aa");
    expect(verifyImpersonationToken(tampered)).toBe(null);
  });

  it("rejette un merchantId modifié pour la même signature", () => {
    const token = signImpersonationToken("merchant-abc");
    const sig = token.slice(token.lastIndexOf(".") + 1);
    expect(verifyImpersonationToken(`merchant-XXX.${sig}`)).toBe(null);
  });

  it("rejette null/undefined/format invalide", () => {
    expect(verifyImpersonationToken(null)).toBe(null);
    expect(verifyImpersonationToken(undefined)).toBe(null);
    expect(verifyImpersonationToken("sans-point")).toBe(null);
  });
});
```

- [ ] **Step 2: Lancer le test pour le voir échouer**

Run: `cd /home/ayoub/Projects/Carte-Fidelite-worktrees/admin-concierge && npx vitest run src/lib/admin/__tests__/impersonation.test.ts`
Expected: FAIL — `Cannot find module '../impersonation'`.

- [ ] **Step 3: Implémentation minimale**

```typescript
// src/lib/admin/impersonation.ts
import crypto from "crypto";

function secret(): string {
  return process.env.IMPERSONATION_SECRET || process.env.QR_SIGNATURE_SECRET || "";
}

/** "merchantId.signature" — HMAC-SHA256 du merchantId, base64url. */
export function signImpersonationToken(merchantId: string): string {
  const sig = crypto.createHmac("sha256", secret()).update(merchantId).digest("base64url");
  return `${merchantId}.${sig}`;
}

export function verifyImpersonationToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const i = token.lastIndexOf(".");
  if (i < 1) return null;
  const merchantId = token.slice(0, i);
  const sig = token.slice(i + 1);
  const expected = crypto.createHmac("sha256", secret()).update(merchantId).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  return merchantId;
}
```

- [ ] **Step 4: Lancer le test pour le voir passer**

Run: `npx vitest run src/lib/admin/__tests__/impersonation.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/impersonation.ts src/lib/admin/__tests__/impersonation.test.ts
git commit -m "feat(admin): HMAC sign/verify du token d'impersonation"
```

---

## Task 2 : `resolveEffectiveMerchantId` (décision pure)

**Files:**
- Modify: `src/lib/admin/impersonation.ts`
- Test: `src/lib/admin/__tests__/impersonation.test.ts`

- [ ] **Step 1: Ajouter le test qui échoue**

```typescript
// à ajouter dans impersonation.test.ts
import { resolveEffectiveMerchantId } from "../impersonation";

describe("resolveEffectiveMerchantId", () => {
  const base = { ownMerchantId: "own-1", impersonatedMerchantId: "imp-9", impersonatedExists: true };

  it("admin + cookie valide + marchand existe → marchand impersonné", () => {
    expect(resolveEffectiveMerchantId({ ...base, sessionRole: "admin" })).toBe("imp-9");
  });

  it("non-admin → ignore le cookie, renvoie son propre marchand", () => {
    expect(resolveEffectiveMerchantId({ ...base, sessionRole: "merchant" })).toBe("own-1");
  });

  it("admin sans cookie → son propre marchand", () => {
    expect(resolveEffectiveMerchantId({ ...base, sessionRole: "admin", impersonatedMerchantId: null })).toBe("own-1");
  });

  it("admin + cookie mais marchand inexistant → son propre marchand", () => {
    expect(resolveEffectiveMerchantId({ ...base, sessionRole: "admin", impersonatedExists: false })).toBe("own-1");
  });

  it("session nulle → null", () => {
    expect(resolveEffectiveMerchantId({ ...base, sessionRole: null, ownMerchantId: null })).toBe(null);
  });
});
```

- [ ] **Step 2: Lancer pour voir échouer**

Run: `npx vitest run src/lib/admin/__tests__/impersonation.test.ts`
Expected: FAIL — `resolveEffectiveMerchantId` non exporté.

- [ ] **Step 3: Implémentation**

```typescript
// à ajouter dans impersonation.ts
export type SessionRole = "admin" | "merchant" | null;

export interface EffectiveMerchantArgs {
  sessionRole: SessionRole;
  ownMerchantId: string | null;
  impersonatedMerchantId: string | null; // déjà vérifié HMAC
  impersonatedExists: boolean;
}

export function resolveEffectiveMerchantId(a: EffectiveMerchantArgs): string | null {
  if (a.sessionRole === "admin" && a.impersonatedMerchantId && a.impersonatedExists) {
    return a.impersonatedMerchantId;
  }
  return a.ownMerchantId;
}
```

- [ ] **Step 4: Lancer pour voir passer**

Run: `npx vitest run src/lib/admin/__tests__/impersonation.test.ts`
Expected: PASS (tous).

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/impersonation.ts src/lib/admin/__tests__/impersonation.test.ts
git commit -m "feat(admin): resolveEffectiveMerchantId (décision pure d'impersonation)"
```

---

## Task 3 : Helpers cookie (lecture/écriture/effacement)

**Files:**
- Modify: `src/lib/admin/impersonation.ts`

> Note : ces helpers utilisent `next/headers` (`cookies()`), non testables en unité pure.
> Leur cœur (`verifyImpersonationToken`) est déjà testé (Task 1). On les garde minimaux.

- [ ] **Step 1: Ajouter les helpers cookie**

```typescript
// à ajouter dans impersonation.ts
import { cookies } from "next/headers";

export const IMPERSONATION_COOKIE = "imp_mid";

/** Lit + vérifie le cookie. Renvoie le merchantId impersonné ou null. */
export async function readImpersonationCookie(): Promise<string | null> {
  const store = await cookies();
  return verifyImpersonationToken(store.get(IMPERSONATION_COOKIE)?.value);
}

/** Pose le cookie signé (à appeler dans un route handler). */
export async function setImpersonationCookie(merchantId: string): Promise<void> {
  const store = await cookies();
  store.set(IMPERSONATION_COOKIE, signImpersonationToken(merchantId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 h
  });
}

export async function clearImpersonationCookie(): Promise<void> {
  const store = await cookies();
  store.delete(IMPERSONATION_COOKIE);
}
```

- [ ] **Step 2: Vérifier la compilation des types**

Run: `npx tsc --noEmit 2>&1 | grep -E "admin/impersonation" || echo "OK pas d'erreur"`
Expected: `OK pas d'erreur`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/admin/impersonation.ts
git commit -m "feat(admin): helpers cookie d'impersonation (read/set/clear)"
```

---

## Task 4 : Migration SQL (colonne + audit actions + RLS campaigns)

**Files:**
- Create: `supabase/migrations/20260604_admin_concierge.sql`

- [ ] **Step 1: Écrire la migration**

```sql
-- supabase/migrations/20260604_admin_concierge.sql

-- 1) Drapeau "mode de gestion" (étiquette : le commerçant garde son accès)
ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS managed_by_concierge BOOLEAN NOT NULL DEFAULT false;

-- 2) Nouveaux types d'action d'audit pour l'impersonation
ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_action_check;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_action_check
  CHECK (action = ANY (ARRAY[
    'CARD_GENERATED','CARD_SCANNED','POINTS_INCREMENTED',
    'LOGIN_SUCCESS','LOGIN_FAILED','MERCHANT_CREATED','CUSTOMER_DELETED',
    'MERCHANT_UPDATED','MERCHANT_TOKEN_ROTATED','REWARD_REDEEMED',
    'CUSTOMER_UPDATED','MFA_ENROLLED','MFA_DISABLED',
    'ADMIN_IMPERSONATION_START','ADMIN_IMPERSONATION_STOP'
  ]));

-- 3) Correctif : la policy SELECT de campaigns oubliait l'override admin
DROP POLICY IF EXISTS "campaigns scoped to merchant" ON campaigns;
CREATE POLICY "campaigns scoped to merchant" ON campaigns
  FOR SELECT USING (
    merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
    OR is_admin()
  );
```

> Note : la contrainte CHECK liste les valeurs actuelles + les 2 nouvelles. Vérifier
> qu'aucune valeur existante (ex. `MFA_ENROLLED`) n'est omise avant d'appliquer.

- [ ] **Step 2: Vérifier la liste des actions vs le type TS**

Run: `grep -oE "'[A-Z_]+'" src/lib/auditLog.ts | sort -u`
Expected: toutes ces valeurs présentes dans la contrainte CHECK ci-dessus.

- [ ] **Step 3: Commit (application en base faite séparément via l'outil Supabase)**

```bash
git add supabase/migrations/20260604_admin_concierge.sql
git commit -m "feat(admin): migration concierge (managed_by_concierge + audit actions + RLS campaigns)"
```

> L'application réelle de la migration sur Supabase se fait via `apply_migration`
> (MCP Supabase) ou la CLI, hors de ce plan de code.

---

## Task 5 : Nouveaux types d'audit (TS)

**Files:**
- Modify: `src/lib/auditLog.ts`

- [ ] **Step 1: Ajouter les deux actions au type**

Dans `src/lib/auditLog.ts`, étendre le type `AuditAction` :

```typescript
export type AuditAction =
  | 'CARD_GENERATED'
  | 'CARD_SCANNED'
  | 'POINTS_INCREMENTED'
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'MERCHANT_CREATED'
  | 'CUSTOMER_DELETED'
  | 'MERCHANT_UPDATED'
  | 'MERCHANT_TOKEN_ROTATED'
  | 'REWARD_REDEEMED'
  | 'CUSTOMER_UPDATED'
  | 'MFA_ENROLLED'
  | 'MFA_DISABLED'
  | 'ADMIN_IMPERSONATION_START'
  | 'ADMIN_IMPERSONATION_STOP';
```

- [ ] **Step 2: Vérifier les types**

Run: `npx tsc --noEmit 2>&1 | grep -E "auditLog" || echo "OK"`
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/auditLog.ts
git commit -m "feat(admin): types d'audit ADMIN_IMPERSONATION_START/STOP"
```

---

## Task 6 : Brancher l'impersonation dans `currentMerchantId()`

**Files:**
- Modify: `src/lib/analytics/merchant.ts`

- [ ] **Step 1: Remplacer le corps de `currentMerchantId()`**

```typescript
// src/lib/analytics/merchant.ts
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readImpersonationCookie, resolveEffectiveMerchantId, type SessionRole } from "@/lib/admin/impersonation";

export async function currentMerchantId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: own } = await supabase
    .from("merchants")
    .select("id, role")
    .eq("user_id", user.id)
    .single();

  const ownMerchantId = (own?.id as string) ?? null;
  const sessionRole = (own?.role as SessionRole) ?? null;

  // Chemin rapide : pas admin → pas d'impersonation possible.
  if (sessionRole !== "admin") return ownMerchantId;

  const impersonatedMerchantId = await readImpersonationCookie();
  if (!impersonatedMerchantId) return ownMerchantId;

  const { data: target } = await supabaseAdmin
    .from("merchants")
    .select("id")
    .eq("id", impersonatedMerchantId)
    .maybeSingle();

  return resolveEffectiveMerchantId({
    sessionRole,
    ownMerchantId,
    impersonatedMerchantId,
    impersonatedExists: Boolean(target),
  });
}
```

> Conserver toute autre fonction déjà exportée par ce fichier.

- [ ] **Step 2: Vérifier types + suite de tests existante**

Run: `npx tsc --noEmit 2>&1 | grep -E "analytics/merchant" || echo "OK" && npx vitest run`
Expected: `OK` puis tous les tests passent (aucune régression).

- [ ] **Step 3: Commit**

```bash
git add src/lib/analytics/merchant.ts
git commit -m "feat(admin): currentMerchantId honore l'impersonation (admin + cookie)"
```

---

## Task 7 : API start / stop impersonation

**Files:**
- Create: `src/app/api/admin/impersonate/start/route.ts`
- Create: `src/app/api/admin/impersonate/stop/route.ts`

- [ ] **Step 1: Route `start`**

```typescript
// src/app/api/admin/impersonate/start/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { requireAdminApi, getSessionRole } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { setImpersonationCookie } from "@/lib/admin/impersonation";
import { logAuditEvent } from "@/lib/auditLog";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const guard = await requireAdminApi();
  if (guard) return guard;

  const { merchantId } = await req.json().catch(() => ({}));
  if (typeof merchantId !== "string" || !merchantId) {
    return NextResponse.json({ error: "merchantId requis" }, { status: 400 });
  }

  const { data: target } = await supabaseAdmin
    .from("merchants").select("id, shop_name").eq("id", merchantId).maybeSingle();
  if (!target) return NextResponse.json({ error: "Commerçant introuvable" }, { status: 404 });

  await setImpersonationCookie(merchantId);

  const { userId } = await getSessionRole();
  await logAuditEvent({
    action: "ADMIN_IMPERSONATION_START",
    merchant_id: merchantId,
    user_id: userId ?? undefined,
    details: { impersonation: true, shop_name: target.shop_name },
  });

  return NextResponse.json({ ok: true, shopName: target.shop_name });
}
```

- [ ] **Step 2: Route `stop`**

```typescript
// src/app/api/admin/impersonate/stop/route.ts
import { NextResponse } from "next/server";
import { requireAdminApi, getSessionRole } from "@/lib/adminAuth";
import { readImpersonationCookie, clearImpersonationCookie } from "@/lib/admin/impersonation";
import { logAuditEvent } from "@/lib/auditLog";

export const runtime = "nodejs";

export async function POST() {
  const guard = await requireAdminApi();
  if (guard) return guard;

  const merchantId = await readImpersonationCookie();
  await clearImpersonationCookie();

  if (merchantId) {
    const { userId } = await getSessionRole();
    await logAuditEvent({
      action: "ADMIN_IMPERSONATION_STOP",
      merchant_id: merchantId,
      user_id: userId ?? undefined,
      details: { impersonation: true },
    });
  }
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 3: Vérifier types**

Run: `npx tsc --noEmit 2>&1 | grep -E "impersonate" || echo "OK"`
Expected: `OK`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/impersonate
git commit -m "feat(admin): API start/stop impersonation (gardée admin + audit)"
```

---

## Task 8 : API toggle du drapeau « mode de gestion »

**Files:**
- Create: `src/app/api/admin/merchants/[id]/management-mode/route.ts`

- [ ] **Step 1: Écrire la route**

```typescript
// src/app/api/admin/merchants/[id]/management-mode/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { requireAdminApi, getSessionRole } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logAuditEvent } from "@/lib/auditLog";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi();
  if (guard) return guard;

  const { id } = await params;
  const { managed } = await req.json().catch(() => ({}));
  if (typeof managed !== "boolean") {
    return NextResponse.json({ error: "champ 'managed' booléen requis" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("merchants").update({ managed_by_concierge: managed }).eq("id", id);
  if (error) return NextResponse.json({ error: "échec mise à jour" }, { status: 500 });

  const { userId } = await getSessionRole();
  await logAuditEvent({
    action: "MERCHANT_UPDATED",
    merchant_id: id,
    user_id: userId ?? undefined,
    details: { managed_by_concierge: managed },
  });

  return NextResponse.json({ ok: true, managed });
}
```

- [ ] **Step 2: Vérifier types**

Run: `npx tsc --noEmit 2>&1 | grep -E "management-mode" || echo "OK"`
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/merchants/
git commit -m "feat(admin): API toggle managed_by_concierge"
```

---

## Task 9 : Ouvrir le dashboard à l'admin qui impersonne

**Files:**
- Modify: `src/app/dashboard/layout.tsx`

- [ ] **Step 1: Adapter la garde du layout**

Aujourd'hui le layout redirige tout admin vers `/admin`. Le modifier pour autoriser
un admin **uniquement** s'il a une impersonation active :

```typescript
// dans src/app/dashboard/layout.tsx — au niveau de la garde de rôle
import { getSessionRole } from "@/lib/adminAuth";
import { readImpersonationCookie } from "@/lib/admin/impersonation";
import { redirect } from "next/navigation";

// ... dans le composant layout (server) :
const { userId, role } = await getSessionRole();
if (!userId) redirect("/login");
if (role === "admin") {
  const impersonating = await readImpersonationCookie();
  if (!impersonating) redirect("/admin"); // admin sans impersonation → back-office
}
```

> Garder le reste du layout (shell, MFA, etc.) inchangé. Adapter aux variables déjà
> présentes dans le fichier (ne pas dupliquer un `getSessionRole` déjà appelé : réutiliser).

- [ ] **Step 2: Vérifier types**

Run: `npx tsc --noEmit 2>&1 | grep -E "dashboard/layout" || echo "OK"`
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/layout.tsx
git commit -m "feat(admin): dashboard accessible à l'admin en impersonation"
```

---

## Task 10 : Bannière persistante

**Files:**
- Create: `src/app/dashboard/ImpersonationBanner.tsx`
- Modify: `src/app/dashboard/layout.tsx` (insérer la bannière au-dessus du contenu)

- [ ] **Step 1: Composant serveur bannière**

```tsx
// src/app/dashboard/ImpersonationBanner.tsx
import { readImpersonationCookie } from "@/lib/admin/impersonation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import StopImpersonationButton from "./StopImpersonationButton";

export default async function ImpersonationBanner() {
  const merchantId = await readImpersonationCookie();
  if (!merchantId) return null;
  const { data } = await supabaseAdmin
    .from("merchants").select("shop_name").eq("id", merchantId).maybeSingle();
  const name = data?.shop_name ?? "ce commerçant";
  return (
    <div style={{ background: "#0D6B5E", color: "#fff", padding: "8px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14 }}>
      <span>⚠️ Tu agis en tant que <strong>{name}</strong></span>
      <StopImpersonationButton />
    </div>
  );
}
```

- [ ] **Step 2: Bouton client « Quitter »**

```tsx
// src/app/dashboard/StopImpersonationButton.tsx
"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function StopImpersonationButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function stop() {
    setBusy(true);
    await fetch("/api/admin/impersonate/stop", { method: "POST" });
    router.push("/admin");
  }
  return (
    <button onClick={stop} disabled={busy} style={{ background: "#fff", color: "#0D6B5E", border: "none", borderRadius: 6, padding: "4px 12px", cursor: "pointer", fontWeight: 600 }}>
      {busy ? "…" : "Quitter"}
    </button>
  );
}
```

- [ ] **Step 3: Insérer la bannière dans le layout**

Dans `src/app/dashboard/layout.tsx`, juste avant le rendu des `children` (au-dessus du shell) :

```tsx
import ImpersonationBanner from "./ImpersonationBanner";
// ...
return (
  <>
    {/* @ts-expect-error Server Component async */}
    <ImpersonationBanner />
    {/* ... shell + children existants ... */}
  </>
);
```

> Adapter à la structure JSX réelle du layout (insérer `<ImpersonationBanner />` en tête).

- [ ] **Step 4: Vérifier types**

Run: `npx tsc --noEmit 2>&1 | grep -E "Banner|dashboard/layout" || echo "OK"`
Expected: `OK`.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/ImpersonationBanner.tsx src/app/dashboard/StopImpersonationButton.tsx src/app/dashboard/layout.tsx
git commit -m "feat(admin): bannière persistante d'impersonation"
```

---

## Task 11 : UI admin — bouton « Gérer en tant que » + badge/toggle/filtre

**Files:**
- Create: `src/app/admin/merchants/ManageAsButton.tsx`
- Create: `src/app/admin/merchants/ManagementModeToggle.tsx`
- Modify: `src/app/admin/merchants/page.tsx`

- [ ] **Step 1: Bouton « Gérer en tant que »**

```tsx
// src/app/admin/merchants/ManageAsButton.tsx
"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function ManageAsButton({ merchantId }: { merchantId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function start() {
    setBusy(true);
    const r = await fetch("/api/admin/impersonate/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ merchantId }),
    });
    if (r.ok) router.push("/dashboard");
    else setBusy(false);
  }
  return (
    <button onClick={start} disabled={busy}>{busy ? "…" : "Gérer en tant que"}</button>
  );
}
```

- [ ] **Step 2: Interrupteur du drapeau**

```tsx
// src/app/admin/merchants/ManagementModeToggle.tsx
"use client";
import { useState } from "react";

export default function ManagementModeToggle({ merchantId, initial }: { merchantId: string; initial: boolean }) {
  const [managed, setManaged] = useState(initial);
  const [busy, setBusy] = useState(false);
  async function toggle() {
    setBusy(true);
    const r = await fetch(`/api/admin/merchants/${merchantId}/management-mode`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ managed: !managed }),
    });
    if (r.ok) setManaged(!managed);
    setBusy(false);
  }
  return (
    <button onClick={toggle} disabled={busy} title="Géré par nous (étiquette)">
      {managed ? "● géré par nous" : "○ géré par lui"}
    </button>
  );
}
```

- [ ] **Step 3: Brancher dans la page liste marchands**

Dans `src/app/admin/merchants/page.tsx` : ajouter `managed_by_concierge` au `select`,
afficher `<ManagementModeToggle merchantId={m.id} initial={m.managed_by_concierge} />`
et `<ManageAsButton merchantId={m.id} />` sur chaque ligne. Ajouter un filtre simple
(« tous / gérés par nous ») côté serveur via un paramètre de recherche.

```tsx
// extrait — adapter au JSX existant de la table
// select : .select("id, shop_name, email, role, managed_by_concierge")
// dans chaque ligne :
<td><ManagementModeToggle merchantId={m.id} initial={m.managed_by_concierge ?? false} /></td>
<td><ManageAsButton merchantId={m.id} /></td>
```

- [ ] **Step 4: Vérifier types**

Run: `npx tsc --noEmit 2>&1 | grep -E "admin/merchants" || echo "OK"`
Expected: `OK`.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/merchants/
git commit -m "feat(admin): bouton Gérer-en-tant-que + badge/toggle managed_by_concierge"
```

---

## Task 12 : `/api/merchant/me` + adapter les écrans client

**Files:**
- Create: `src/app/api/merchant/me/route.ts`
- Modify: `src/app/dashboard/settings/page.tsx`, `src/app/dashboard/generate/page.tsx`

- [ ] **Step 1: API renvoyant le marchand effectif**

```typescript
// src/app/api/merchant/me/route.ts
import { NextResponse } from "next/server";
import { currentMerchantId } from "@/lib/analytics/merchant";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET() {
  const merchantId = await currentMerchantId();
  if (!merchantId) return NextResponse.json({ error: "non authentifié" }, { status: 401 });
  const { data } = await supabaseAdmin
    .from("merchants")
    .select("id, shop_name, email, primary_color, logo_url, address, stamp_goal")
    .eq("id", merchantId)
    .maybeSingle();
  return NextResponse.json({ merchant: data });
}
```

- [ ] **Step 2: Adapter `/settings` et `/generate`**

Dans ces 2 écrans (clients), remplacer la résolution du marchand via le client Supabase
navigateur (`auth.getUser() → merchants.user_id`) par un appel à `GET /api/merchant/me`
(qui respecte l'impersonation). **Ne pas modifier le style ni la structure visuelle** —
seulement la source des données du marchand.

> Repérer dans chaque fichier l'endroit où `supabase.auth.getUser()` puis
> `from("merchants").eq("user_id", ...)` sont appelés, et le remplacer par
> `const { merchant } = await (await fetch("/api/merchant/me")).json();`.

- [ ] **Step 3: Vérifier types + suite complète**

Run: `npx tsc --noEmit 2>&1 | grep -E "merchant/me|settings|generate" || echo "OK" && npx vitest run`
Expected: `OK` + tous les tests verts.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/merchant/me src/app/dashboard/settings src/app/dashboard/generate
git commit -m "feat(admin): /api/merchant/me + settings/generate respectent l'impersonation"
```

---

## Vérification finale (après tous les tasks)

- [ ] `npx vitest run` — toute la suite verte (dont les nouveaux tests purs).
- [ ] `npx tsc --noEmit` — 0 erreur sur les fichiers ajoutés/modifiés.
- [ ] Build de prod (avec `.env.local` temporaire) : `npm run build` → exit 0.
- [ ] Migration `20260604_admin_concierge.sql` appliquée sur Supabase (via `apply_migration`).
- [ ] Test manuel : se connecter admin → liste marchands → « Gérer en tant que » →
      bannière visible → naviguer campagnes/clients/segments du marchand → « Quitter » →
      retour `/admin`. Vérifier 2 lignes d'audit (START/STOP).

## Notes de coordination
- Le **design agent** travaille en parallèle sur l'apparence (landing, HALO Light) :
  ne pas modifier le style des composants commerçant réutilisés, seulement la logique.
- Avant de fusionner `feat/admin-concierge` dans `feat/public-enrollment`, vérifier
  l'absence de verrou Git et que l'autre agent est au repos (cf. méthode de coordination).
