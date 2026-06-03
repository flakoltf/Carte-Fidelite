# MFA marchand (2FA TOTP optionnel) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à un marchand d'activer une double authentification TOTP optionnelle (Réglages → Sécurité), exiger le code à la connexion via une page `/login/mfa`, et faire respecter ce step-up dans le middleware — en s'appuyant sur le MFA natif de Supabase Auth.

**Architecture:** Deux fonctions pures testées (`mfaStepUpRequired`, `isValidTotpCode`). Le MFA (enroll/verify/unenroll) utilise le client navigateur Supabase, côté UI : un composant `SecuritySection` dans les Réglages, une page `/login/mfa` pour saisir le code. Le `proxy.ts` (middleware) calcule l'AAL et redirige toute session AAL1-en-attente vers `/login/mfa`. Un petit endpoint journalise les évènements MFA. Aucune migration BDD.

**Tech Stack:** Next.js 16 (App Router, middleware/proxy) · React 19 · TypeScript · Supabase Auth MFA (`@supabase/ssr`) · Tailwind v4 · Vitest · lucide-react.

**Spec:** `docs/superpowers/specs/2026-06-03-mfa-marchand-design.md`

---

## File Structure

```
src/lib/auth/mfa.ts                       # NEW — mfaStepUpRequired + isValidTotpCode (PUR, testé)
src/lib/auth/__tests__/mfa.test.ts        # NEW
src/lib/auditLog.ts                       # MODIFY — ajoute 'MFA_ENROLLED' | 'MFA_DISABLED'
src/app/api/auth/mfa-event/route.ts       # NEW — journalise les évènements MFA
src/proxy.ts                              # MODIFY — enforcement AAL (step-up)
src/app/dashboard/settings/SecuritySection.tsx  # NEW — UI activer/désactiver 2FA
src/app/dashboard/settings/page.tsx       # MODIFY — rend <SecuritySection/>
src/app/login/mfa/page.tsx                # NEW — page de saisie du code à la connexion
```

**Réutilisé (DRY) :** client navigateur `@/utils/supabase/client`, `logAuditEvent`/`extractRequestMeta`, `supabaseAdmin`, le `proxy.ts` existant, la grammaire UI Réglages/Login.

> **Sécurité du déploiement :** le changement `proxy.ts` est **inerte tant qu'aucun marchand n'a activé la 2FA** (`needsStepUp` est faux pour tout le monde). Aucun risque de blocage des comptes existants.

---

## Task 1: Logique pure `mfaStepUpRequired` + `isValidTotpCode` (TDD)

**Files:**
- Test: `src/lib/auth/__tests__/mfa.test.ts`
- Create: `src/lib/auth/mfa.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { mfaStepUpRequired, isValidTotpCode } from "../mfa";

describe("mfaStepUpRequired", () => {
  it("vrai quand aal1 → aal2", () => { expect(mfaStepUpRequired("aal1", "aal2")).toBe(true); });
  it("faux quand déjà aal2", () => { expect(mfaStepUpRequired("aal2", "aal2")).toBe(false); });
  it("faux quand pas de facteur (aal1 → aal1)", () => { expect(mfaStepUpRequired("aal1", "aal1")).toBe(false); });
  it("faux sur valeurs nulles/undefined", () => {
    expect(mfaStepUpRequired(null, null)).toBe(false);
    expect(mfaStepUpRequired(undefined, "aal2")).toBe(false);
    expect(mfaStepUpRequired("aal1", undefined)).toBe(false);
  });
});

describe("isValidTotpCode", () => {
  it("accepte 6 chiffres", () => { expect(isValidTotpCode("123456")).toBe(true); });
  it("trim les espaces", () => { expect(isValidTotpCode(" 123456 ")).toBe(true); });
  it("refuse 5 chiffres", () => { expect(isValidTotpCode("12345")).toBe(false); });
  it("refuse des lettres", () => { expect(isValidTotpCode("abcdef")).toBe(false); });
  it("refuse vide", () => { expect(isValidTotpCode("")).toBe(false); });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/auth/__tests__/mfa.test.ts`
Expected: FAIL — `Failed to resolve import "../mfa"`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// Faut-il demander le 2e facteur ? (session mot de passe OK, mais 2FA active non validée)
export function mfaStepUpRequired(
  currentLevel: string | null | undefined,
  nextLevel: string | null | undefined,
): boolean {
  return currentLevel === "aal1" && nextLevel === "aal2";
}

export function isValidTotpCode(code: string): boolean {
  return /^\d{6}$/.test(code.trim());
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/auth/__tests__/mfa.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth/mfa.ts src/lib/auth/__tests__/mfa.test.ts
git commit -m "feat(mfa): pure mfaStepUpRequired + isValidTotpCode with tests"
```

---

## Task 2: Actions d'audit + endpoint `/api/auth/mfa-event`

**Files:**
- Modify: `src/lib/auditLog.ts`
- Create: `src/app/api/auth/mfa-event/route.ts`

- [ ] **Step 1: Ajouter les actions d'audit**

Dans `src/lib/auditLog.ts`, ajouter à l'union `AuditAction` (après `| 'CUSTOMER_UPDATED'`) :
```typescript
  | 'CUSTOMER_UPDATED'
  | 'MFA_ENROLLED'
  | 'MFA_DISABLED';
```

- [ ] **Step 2: Créer l'endpoint**

`src/app/api/auth/mfa-event/route.ts` :
```typescript
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { logAuditEvent, extractRequestMeta } from "@/lib/auditLog";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { createClient } = await import("@/utils/supabase/server");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { event } = await req.json().catch(() => ({}));
  if (event !== "enrolled" && event !== "disabled") {
    return NextResponse.json({ error: "Évènement invalide" }, { status: 400 });
  }

  const { data: merchant } = await supabaseAdmin
    .from("merchants").select("id").eq("user_id", user.id).maybeSingle();

  await logAuditEvent({
    action: event === "enrolled" ? "MFA_ENROLLED" : "MFA_DISABLED",
    user_id: user.id,
    merchant_id: merchant?.id,
    ...extractRequestMeta(req),
  });

  return NextResponse.json({ success: true });
}
```

- [ ] **Step 3: Vérifier la compilation**

Run: `npx tsc --noEmit` (ignorer les 2 erreurs préexistantes `passJson.test.ts`).
Expected: aucune nouvelle erreur.

- [ ] **Step 4: Commit**

```bash
git add src/lib/auditLog.ts src/app/api/auth/mfa-event/route.ts
git commit -m "feat(mfa): MFA audit actions + mfa-event logging endpoint"
```

---

## Task 3: Enforcement dans `proxy.ts`

**Files:**
- Modify: `src/proxy.ts`

- [ ] **Step 1: Remplacer le contenu complet de `src/proxy.ts`**

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { mfaStepUpRequired } from '@/lib/auth/mfa'

export default async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request: { headers: request.headers } })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname
  const isProtected =
    path.startsWith('/dashboard') || path.startsWith('/scan') || path.startsWith('/admin')

  // Pas de session → routes protégées renvoyées au login.
  if (!user && isProtected) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user) {
    // AAL : fail-open (si l'appel échoue, on ne bloque personne).
    let needsStepUp = false
    try {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      needsStepUp = mfaStepUpRequired(aal?.currentLevel, aal?.nextLevel)
    } catch {
      needsStepUp = false
    }

    if (needsStepUp) {
      // 2FA active mais code non saisi : seule /login/mfa est accessible.
      if (path !== '/login/mfa' && (isProtected || path === '/' || path === '/login' || path === '/signup')) {
        return NextResponse.redirect(new URL('/login/mfa', request.url))
      }
    } else if (path === '/' || path === '/login' || path === '/login/mfa' || path === '/signup') {
      // Session pleinement authentifiée : éloigner des pages d'entrée.
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return response
}

export const config = {
  // /enroll/* (page publique d'enrôlement) et /api/enroll* sont exclus :
  // ce sont des routes publiques, sans session, identifiées par enrollment_token.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|enroll|api/enroll|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

- [ ] **Step 2: Vérifier le build**

Run: `npx tsc --noEmit` (ignorer passJson) puis `npm run build`.
Expected: succès (le middleware compile ; aucun comportement modifié tant qu'aucun facteur n'est activé).

- [ ] **Step 3: Commit**

```bash
git add src/proxy.ts
git commit -m "feat(mfa): enforce AAL2 step-up in proxy (inert until a factor is enrolled)"
```

---

## Task 4: Réglages — `SecuritySection` (activer / désactiver)

**Files:**
- Create: `src/app/dashboard/settings/SecuritySection.tsx`
- Modify: `src/app/dashboard/settings/page.tsx`

- [ ] **Step 1: Créer le composant**

`src/app/dashboard/settings/SecuritySection.tsx` :
```typescript
"use client";
import { useState, useEffect, useCallback } from "react";
import { ShieldCheck, Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { isValidTotpCode } from "@/lib/auth/mfa";

export function SecuritySection() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [factorId, setFactorId] = useState<string | null>(null); // facteur TOTP vérifié
  const [enrolling, setEnrolling] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.auth.mfa.listFactors();
    const verified = data?.totp?.find((f) => f.status === "verified") ?? null;
    setFactorId(verified ? verified.id : null);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { refresh(); }, [refresh]);

  const startEnroll = async () => {
    setBusy(true); setError(null);
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Authenticator" });
      if (error || !data) throw new Error(error?.message ?? "enroll");
      setEnrolling({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
    } catch {
      setError("Impossible de démarrer l'activation.");
    } finally { setBusy(false); }
  };

  const confirmEnroll = async () => {
    if (!enrolling || !isValidTotpCode(code)) { setError("Code à 6 chiffres requis."); return; }
    setBusy(true); setError(null);
    try {
      const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enrolling.id, code: code.trim() });
      if (error) throw new Error(error.message);
      await fetch("/api/auth/mfa-event", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: "enrolled" }) });
      setEnrolling(null); setCode("");
      await refresh();
    } catch {
      setError("Code incorrect. Réessayez.");
    } finally { setBusy(false); }
  };

  const cancelEnroll = async () => {
    if (enrolling) { try { await supabase.auth.mfa.unenroll({ factorId: enrolling.id }); } catch { /* ignore */ } }
    setEnrolling(null); setCode(""); setError(null);
  };

  const disable = async () => {
    if (!factorId) return;
    if (!window.confirm("Désactiver la double authentification ?")) return;
    setBusy(true); setError(null);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId });
      if (error) throw new Error(error.message);
      await fetch("/api/auth/mfa-event", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event: "disabled" }) });
      await refresh();
    } catch {
      setError("Échec. Reconnectez-vous puis réessayez.");
    } finally { setBusy(false); }
  };

  const inputCls = "w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3 px-4 text-sm";

  return (
    <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-8 space-y-6">
      <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
        <ShieldCheck className="w-4 h-4" /> SÉCURITÉ — DOUBLE AUTHENTIFICATION
      </div>

      {loading ? (
        <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
      ) : factorId ? (
        <div className="space-y-3">
          <p className="text-sm text-emerald-400">✅ Double authentification activée.</p>
          <p className="text-xs text-zinc-500">Un code de votre appli d&apos;authentification sera demandé à chaque connexion.</p>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button onClick={disable} disabled={busy}
            className="px-5 py-2.5 rounded-xl border border-red-500/30 text-red-400 text-sm font-bold disabled:opacity-50">
            {busy ? "…" : "Désactiver"}
          </button>
        </div>
      ) : enrolling ? (
        <div className="space-y-4">
          <p className="text-sm text-zinc-300">1. Scannez ce QR avec votre appli (Google / Microsoft Authenticator) :</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enrolling.qr} alt="QR code 2FA" className="w-44 h-44 bg-white rounded-xl p-2" />
          <p className="text-xs text-zinc-500 break-all">Ou clé manuelle : <span className="font-mono text-zinc-300">{enrolling.secret}</span></p>
          <p className="text-sm text-zinc-300">2. Entrez le code à 6 chiffres affiché :</p>
          <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} placeholder="123456" className={inputCls} />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button onClick={confirmEnroll} disabled={busy} className="px-5 py-2.5 rounded-xl bg-emerald-500 text-black font-bold text-sm disabled:opacity-50">{busy ? "…" : "Confirmer"}</button>
            <button onClick={cancelEnroll} disabled={busy} className="px-4 py-2.5 rounded-xl border border-zinc-700 text-sm">Annuler</button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-zinc-400">Protégez votre compte : en plus du mot de passe, un code temporaire de votre téléphone sera requis à la connexion.</p>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button onClick={startEnroll} disabled={busy}
            className="px-5 py-2.5 rounded-xl bg-emerald-500 text-black font-bold text-sm disabled:opacity-50">
            {busy ? "…" : "Activer la double authentification"}
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Intégrer dans la page Réglages**

Dans `src/app/dashboard/settings/page.tsx` : ajouter en haut l'import
```typescript
import { SecuritySection } from "./SecuritySection";
```
puis rendre `<SecuritySection />` comme **dernier enfant** du conteneur racine `<div className="max-w-4xl space-y-10">` (après le bloc `<div className="grid lg:grid-cols-3 gap-8"> … </div>` existant). Ne rien retirer d'autre.

- [ ] **Step 3: Vérifier le build**

Run: `npx tsc --noEmit` (ignorer passJson) puis `npm run build`.
Expected: succès, `/dashboard/settings` compile, aucune erreur de lint (le commentaire `eslint-disable-next-line` couvre le `<img>`).

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/settings/SecuritySection.tsx src/app/dashboard/settings/page.tsx
git commit -m "feat(mfa-ui): security section to enable/disable 2FA in settings"
```

---

## Task 5: Page d'étape MFA `/login/mfa`

**Files:**
- Create: `src/app/login/mfa/page.tsx`

- [ ] **Step 1: Créer la page**

```typescript
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { isValidTotpCode } from "@/lib/auth/mfa";

export default function MfaChallenge() {
  const supabase = createClient();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidTotpCode(code)) { setError("Entrez un code à 6 chiffres."); return; }
    setBusy(true); setError("");
    try {
      const { data: factors } = await supabase.auth.mfa.listFactors();
      const totp = factors?.totp?.find((f) => f.status === "verified");
      if (!totp) throw new Error("no-factor");
      const { error: vErr } = await supabase.auth.mfa.challengeAndVerify({ factorId: totp.id, code: code.trim() });
      if (vErr) throw new Error(vErr.message);
      const { data: { user } } = await supabase.auth.getUser();
      const { data: merchant } = await supabase.from("merchants").select("role").eq("user_id", user?.id).maybeSingle();
      router.push(merchant?.role === "admin" ? "/admin" : "/dashboard");
      router.refresh();
    } catch {
      setError("Code incorrect. Réessayez.");
    } finally { setBusy(false); }
  };

  const cancel = async () => { await supabase.auth.signOut(); router.push("/login"); router.refresh(); };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center mb-4">
            <ShieldCheck className="text-emerald-400 w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold">Vérification en deux étapes</h1>
          <p className="text-zinc-500 mt-2 text-center">Entrez le code de votre appli d&apos;authentification.</p>
        </div>
        <form onSubmit={verify} className="bg-zinc-900/50 border border-zinc-800 rounded-3xl p-8 space-y-5">
          <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={6} autoFocus placeholder="123456"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3.5 px-4 text-center text-lg tracking-widest outline-none focus:border-emerald-500" />
          {error && <div className="bg-red-500/10 border border-red-500/30 text-red-500 p-3 rounded-2xl text-sm">{error}</div>}
          <button disabled={busy} className="w-full bg-white text-black font-bold py-4 rounded-2xl disabled:opacity-50 flex items-center justify-center gap-2">
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : "Vérifier"}
          </button>
          <button type="button" onClick={cancel} className="w-full text-zinc-500 text-sm hover:text-white">Annuler et se déconnecter</button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Vérifier le build**

Run: `npx tsc --noEmit` (ignorer passJson) puis `npm run build`.
Expected: succès, `/login/mfa` listée.

- [ ] **Step 3: Commit**

```bash
git add src/app/login/mfa/page.tsx
git commit -m "feat(mfa): login step-up page to enter the 2FA code"
```

---

## Task 6: Vérification finale

- [ ] **Step 1: Suite complète**

Run: `npx vitest run`
Expected: tous verts (125 de la branche + 9 nouveaux = 134).

- [ ] **Step 2: Build de production**

Run: `npm run build`
Expected: succès ; routes `/login/mfa`, `/api/auth/mfa-event` listées.

- [ ] **Step 3: Notes de fumée (compte démo, nécessite une appli d'authentification)**

À faire manuellement par le contrôleur/l'utilisateur (le MFA exige un vrai TOTP) :
1. Réglages → Sécurité → **Activer** → scanner le QR avec Google/Microsoft Authenticator → saisir le code → « 2FA activée ✅ ».
2. Se déconnecter, se reconnecter (email+mot de passe) → redirigé vers `/login/mfa` → saisir le code → arrive au dashboard.
3. Réglages → Sécurité → **Désactiver** → la connexion suivante ne demande plus de code.
4. Prérequis Supabase : vérifier que le facteur **TOTP** du MFA est activé sur le projet `oqcelbbozpykwkasjtqy` (activé par défaut).

---

## Self-Review (rempli pendant la rédaction)

- **Couverture spec :** pures `mfaStepUpRequired`/`isValidTotpCode` (Task 1) ; activer/désactiver TOTP avec QR + confirmation (Task 4) ; page `/login/mfa` + redirection par rôle (Task 5) ; enforcement proxy avec fail-open (Task 3) ; audit `MFA_ENROLLED`/`MFA_DISABLED` + endpoint (Task 2) ; vérif Supabase TOTP (Task 6) ; aucune migration. Hors périmètre (SMS, codes de secours, obligatoire, trusted devices) non implémenté.
- **Placeholders :** aucun — code complet à chaque step. (La seule instruction « insérer comme dernier enfant » de Task 4 Step 2 donne un ancrage précis dans un fichier existant à lire.)
- **Cohérence des types :** `mfaStepUpRequired(string|null|undefined, …)` (Task 1) consommé par le proxy (Task 3) avec `aal?.currentLevel` ; `isValidTotpCode` (Task 1) utilisé Tasks 4 et 5 ; actions `'MFA_ENROLLED'`/`'MFA_DISABLED'` déclarées (Task 2) et émises par l'endpoint (Task 2) appelé depuis l'UI (Task 4) ; `factorId` (string) cohérent enroll→verify→unenroll.
```
