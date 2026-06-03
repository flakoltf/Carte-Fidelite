# Encaissement de la récompense — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre au commerçant d'encaisser la récompense d'une carte pleine (depuis le Scanner ou la fiche Clients) : la carte repart à zéro, c'est tracé, la carte Wallet se met à jour, et l'analytique compte les récompenses offertes — tout en corrigeant le seuil `10` codé en dur.

**Architecture:** Une fonction pure `applyStamp` (testée) devient la source unique de la règle de comptage (respect du `stampGoal`, plafonnement). Un endpoint `POST /api/redeem` remet la carte à zéro après vérifications (propriété marchand + `canRedeem`), trace via `audit_logs` (`REWARD_REDEEMED`) et pousse le Wallet. Le Scanner et la fiche Clients gagnent un bouton d'encaissement ; l'analytique compte les `REWARD_REDEEMED`. **Aucune migration BDD.**

**Tech Stack:** Next.js 16 (App Router, route handlers `params`/réponses) · React 19 · TypeScript · Supabase (`@supabase/ssr` RLS + `supabaseAdmin`) · Tailwind v4 · Vitest · lucide-react.

**Spec:** `docs/superpowers/specs/2026-06-03-encaissement-recompense-design.md`

---

## File Structure

```
src/lib/loyalty/stamp.ts                 # NEW — applyStamp + canRedeem (PUR, testé)
src/lib/loyalty/__tests__/stamp.test.ts  # NEW
src/lib/auditLog.ts                      # MODIFY — ajoute 'REWARD_REDEEMED' à AuditAction
src/app/api/redeem/route.ts              # NEW — endpoint d'encaissement
src/app/api/scan/route.ts                # MODIFY — applyStamp + stampGoal + champ rewardReady/added
src/app/scan/page.tsx                    # MODIFY — bouton encaisser + /goal
src/app/dashboard/customers/RedeemCell.tsx   # NEW — bouton client par ligne
src/app/dashboard/customers/page.tsx     # MODIFY — id de carte + stampGoal + /goal + RedeemCell
src/lib/analytics/rewards.ts             # MODIFY — redeemedCount (compte REWARD_REDEEMED)
src/lib/analytics/__tests__/rewards.test.ts  # MODIFY — test redeemedCount
src/app/dashboard/_analytics/widgets/RewardsWidget.tsx  # MODIFY — affiche redeemedCount
```

**Réutilisé (DRY) :** `fetchMerchantConfig` (`@/lib/merchant-config/fetch`, → `stampGoal`), `verifyQRCode` (`@/lib/qrSignature`), `getChannels` (`@/lib/wallet/channel`), `logAuditEvent`/`extractRequestMeta` (`@/lib/auditLog`), `rateLimit` (`@/lib/rateLimit`), `resolveRange` (`@/lib/analytics/range`), `supabaseAdmin`, le widget Récompenses existant.

---

## Task 1: Logique pure `applyStamp` + `canRedeem` (TDD)

**Files:**
- Test: `src/lib/loyalty/__tests__/stamp.test.ts`
- Create: `src/lib/loyalty/stamp.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from "vitest";
import { applyStamp, canRedeem } from "../stamp";

describe("applyStamp", () => {
  it("ajoute un tampon sous l'objectif (pas encore prête)", () => {
    expect(applyStamp(3, 10)).toEqual({ newStamps: 4, rewardReady: false, added: true });
  });
  it("ajoute le tampon qui atteint l'objectif (prête)", () => {
    expect(applyStamp(9, 10)).toEqual({ newStamps: 10, rewardReady: true, added: true });
  });
  it("n'ajoute rien si la carte est déjà pleine (prête)", () => {
    expect(applyStamp(10, 10)).toEqual({ newStamps: 10, rewardReady: true, added: false });
  });
  it("n'ajoute rien si la carte est au-delà de l'objectif", () => {
    expect(applyStamp(11, 10)).toEqual({ newStamps: 11, rewardReady: true, added: false });
  });
  it("respecte un objectif personnalisé", () => {
    expect(applyStamp(7, 8)).toEqual({ newStamps: 8, rewardReady: true, added: true });
  });
});

describe("canRedeem", () => {
  it("faux sous l'objectif", () => { expect(canRedeem(9, 10)).toBe(false); });
  it("vrai à l'objectif", () => { expect(canRedeem(10, 10)).toBe(true); });
  it("vrai au-delà de l'objectif", () => { expect(canRedeem(11, 10)).toBe(true); });
  it("faux si objectif 0", () => { expect(canRedeem(5, 0)).toBe(false); });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/loyalty/__tests__/stamp.test.ts`
Expected: FAIL — `Failed to resolve import "../stamp"`.

- [ ] **Step 3: Write minimal implementation**

```typescript
export type StampResult = { newStamps: number; rewardReady: boolean; added: boolean };

// Règle unique de comptage : incrémente tant qu'on est sous l'objectif, plafonne sinon.
export function applyStamp(currentStamps: number, goal: number): StampResult {
  if (currentStamps >= goal) return { newStamps: currentStamps, rewardReady: true, added: false };
  const next = currentStamps + 1;
  return { newStamps: next, rewardReady: next >= goal, added: true };
}

export function canRedeem(stamps: number, goal: number): boolean {
  return goal > 0 && stamps >= goal;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/loyalty/__tests__/stamp.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/loyalty/stamp.ts src/lib/loyalty/__tests__/stamp.test.ts
git commit -m "feat(loyalty): pure applyStamp + canRedeem with tests"
```

---

## Task 2: Action d'audit + endpoint d'encaissement

**Files:**
- Modify: `src/lib/auditLog.ts`
- Create: `src/app/api/redeem/route.ts`

- [ ] **Step 1: Ajouter l'action d'audit**

Dans `src/lib/auditLog.ts`, ajouter `'REWARD_REDEEMED'` à l'union `AuditAction` :

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
  | 'REWARD_REDEEMED';
```

- [ ] **Step 2: Créer l'endpoint d'encaissement**

Create `src/app/api/redeem/route.ts` :

```typescript
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { rateLimit } from "@/lib/rateLimit";
import { verifyQRCode } from "@/lib/qrSignature";
import { canRedeem } from "@/lib/loyalty/stamp";
import { fetchMerchantConfig } from "@/lib/merchant-config/fetch";
import { logAuditEvent, extractRequestMeta } from "@/lib/auditLog";

export const runtime = "nodejs";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  const { createClient } = await import("@/utils/supabase/server");
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user;
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const rl = await rateLimit(`redeem:${user.id}`, 60, 60000);
  if (!rl.success) return NextResponse.json({ error: "Trop de demandes. Réessayez." }, { status: 429 });

  const { cardId } = await req.json().catch(() => ({}));
  if (!cardId || typeof cardId !== "string" || cardId.length > 200)
    return NextResponse.json({ error: "ID de carte invalide" }, { status: 400 });

  // Accepte un payload QR signé (Scanner) OU un UUID de carte brut (fiche Clients).
  const v = verifyQRCode(cardId);
  const actualCardId = v.valid && v.cardId ? v.cardId : (UUID_RE.test(cardId) ? cardId : null);
  if (!actualCardId) return NextResponse.json({ error: "Carte invalide" }, { status: 400 });

  const { data: merchant } = await supabaseAdmin
    .from("merchants").select("id").eq("user_id", user.id).single();
  if (!merchant) return NextResponse.json({ error: "Profil marchand manquant" }, { status: 400 });

  const { data: card } = await supabaseAdmin
    .from("loyalty_cards").select("*, customers(*)").eq("id", actualCardId).single();
  if (!card) return NextResponse.json({ error: "Carte introuvable" }, { status: 404 });
  if (card.merchant_id !== merchant.id)
    return NextResponse.json({ error: "Cette carte appartient à un autre établissement" }, { status: 403 });

  const { stampGoal } = await fetchMerchantConfig(merchant.id);
  if (!canRedeem(card.stamps_count, stampGoal))
    return NextResponse.json({ error: "Carte non complète" }, { status: 409 });

  const { data: updatedCard, error } = await supabaseAdmin
    .from("loyalty_cards").update({ stamps_count: 0 }).eq("id", actualCardId).select("*, customers(*)").single();
  if (error) return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });

  await logAuditEvent({
    action: "REWARD_REDEEMED",
    merchant_id: merchant.id, user_id: user.id, card_id: actualCardId,
    details: { goal: stampGoal }, ...extractRequestMeta(req),
  });

  // Carte vivante : maj du pass + petit message (best-effort, n'échoue pas l'encaissement).
  try {
    const { getChannels } = await import("@/lib/wallet/channel");
    for (const ch of getChannels())
      await ch.notify([actualCardId], { title: "Récompense utilisée", body: "Merci 🎉 Votre carte repart à zéro." });
  } catch (e) {
    console.error("[redeem] push failed:", e instanceof Error ? e.message : e);
  }

  return NextResponse.json({ success: true, card: updatedCard });
}
```

- [ ] **Step 3: Vérifier la compilation**

Run: `npx tsc --noEmit` (ignorer les 2 erreurs préexistantes dans `src/lib/wallet/__tests__/passJson.test.ts`).
Expected: aucune nouvelle erreur.

- [ ] **Step 4: Commit**

```bash
git add src/lib/auditLog.ts src/app/api/redeem/route.ts
git commit -m "feat(redeem): REWARD_REDEEMED audit action + protected redeem endpoint"
```

---

## Task 3: Scan API — respecter l'objectif + plafonner (corrige le 10 en dur)

**Files:**
- Modify: `src/app/api/scan/route.ts`

- [ ] **Step 1: Remplacer le contenu complet de `src/app/api/scan/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { rateLimit } from "@/lib/rateLimit";
import { checkIdempotency, setIdempotency } from "@/lib/idempotency";
import { verifyQRCode } from "@/lib/qrSignature";
import { logAuditEvent, extractRequestMeta } from "@/lib/auditLog";
import { applyStamp } from "@/lib/loyalty/stamp";
import { fetchMerchantConfig } from "@/lib/merchant-config/fetch";

export async function POST(req: Request) {
  try {
    // --- SÉCURITÉ : Authentification ---
    const { createClient } = await import("@/utils/supabase/server");
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

    // Rate limiting: 200 scans par minute par merchant
    const rateLimitResult = await rateLimit(`scan:${user.id}`, 200, 60000);
    if (!rateLimitResult.success) {
      return NextResponse.json({ error: "Trop de scans. Réessayez dans 1 minute." }, { status: 429 });
    }

    const { cardId } = await req.json();
    if (!cardId || typeof cardId !== 'string' || cardId.length > 200) {
      return NextResponse.json({ error: "ID de carte invalide" }, { status: 400 });
    }

    // --- SÉCURITÉ : Vérifier la signature du QR code ---
    const qrVerification = verifyQRCode(cardId);
    if (!qrVerification.valid || !qrVerification.cardId) {
      return NextResponse.json({ error: "QR code invalide ou forgé" }, { status: 400 });
    }
    const actualCardId = qrVerification.cardId;

    // --- SÉCURITÉ : Idempotence ---
    const idempotencyKey = `${user.id}:${actualCardId}:${req.headers.get('idempotency-key') || ''}`;
    const cachedResponse = await checkIdempotency(idempotencyKey);
    if (cachedResponse) return NextResponse.json(cachedResponse);

    const { data: merchant } = await supabaseAdmin
      .from("merchants").select("id").eq("user_id", user.id).single();
    if (!merchant) return NextResponse.json({ error: "Profil marchand manquant" }, { status: 400 });

    // 1. Récupérer la carte
    const { data: card, error: cardError } = await supabaseAdmin
      .from("loyalty_cards").select("*, customers(*)").eq("id", actualCardId).single();
    if (cardError || !card) {
      return NextResponse.json({ error: "Carte invalide ou introuvable" }, { status: 404 });
    }

    // --- SÉCURITÉ : Vérifier la propriété ---
    if (card.merchant_id !== merchant.id) {
      return NextResponse.json({ error: "Cette carte appartient à un autre établissement" }, { status: 403 });
    }

    // 2. Règle de comptage (objectif configurable, plafonnement) — source unique applyStamp
    const { stampGoal } = await fetchMerchantConfig(merchant.id);
    const { newStamps, rewardReady, added } = applyStamp(card.stamps_count, stampGoal);

    // Carte déjà pleine → aucun tampon ajouté : on propose juste d'encaisser.
    // (On ne met PAS en cache d'idempotence : aucun changement d'état.)
    if (!added) {
      return NextResponse.json({
        success: true, card, rewardReady: true, rewardUnlocked: true, added: false, stampGoal,
      });
    }

    // 3. Incrémenter
    const { data: updatedCard, error: updateError } = await supabaseAdmin
      .from("loyalty_cards")
      .update({ stamps_count: newStamps, last_scan: new Date().toISOString() })
      .eq("id", actualCardId).select("*, customers(*)").single();
    if (updateError) throw updateError;

    // 4. Historique du scan
    await supabaseAdmin.from("scan_history")
      .insert({ card_id: actualCardId, merchant_id: card.merchant_id, points_added: 1 });

    // 4b. Carte vivante : push best-effort
    try {
      const { getChannels } = await import("@/lib/wallet/channel");
      for (const ch of getChannels()) await ch.notify([actualCardId]);
    } catch (e) {
      console.error("[scan] push notify failed:", e);
    }

    // 5. Audit
    const meta = extractRequestMeta(req);
    await logAuditEvent({
      action: "CARD_SCANNED",
      merchant_id: merchant.id, user_id: user.id, card_id: actualCardId,
      details: { new_stamps: newStamps, reward_ready: rewardReady }, ...meta,
    });

    const response = { success: true, card: updatedCard, rewardReady, rewardUnlocked: rewardReady, added: true, stampGoal };
    await setIdempotency(idempotencyKey, response);
    return NextResponse.json(response);

  } catch (error: unknown) {
    console.error("Erreur Scan API:", error);
    return NextResponse.json({ error: "Erreur serveur lors de la validation" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Vérifier la compilation + tests**

Run: `npx tsc --noEmit` (ignorer les 2 erreurs préexistantes passJson) puis `npx vitest run`.
Expected: aucune nouvelle erreur ; tous les tests verts.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/scan/route.ts
git commit -m "fix(scan): respect configurable stampGoal + cap at goal (no more hardcoded 10)"
```

---

## Task 4: Scanner UI — bouton encaisser + affichage /objectif

**Files:**
- Modify: `src/app/scan/page.tsx`

- [ ] **Step 1: Remplacer le contenu complet de `src/app/scan/page.tsx`**

```typescript
"use client";

import { useEffect, useState } from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import { Camera, RefreshCw, CheckCircle, AlertCircle, Loader2, Gift } from "lucide-react";

export default function ScanPage() {
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "scanning" | "processing" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [cardDetails, setCardDetails] = useState<any>(null);
  const [goal, setGoal] = useState(10);
  const [rewardReady, setRewardReady] = useState(false);
  const [redeemed, setRedeemed] = useState(false);
  const [redeeming, setRedeeming] = useState(false);

  useEffect(() => {
    if (status === "scanning") {
        const scanner = new Html5QrcodeScanner("reader", {
            fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0
        }, false);
        scanner.render(onScanSuccess, onScanFailure);
        function onScanSuccess(decodedText: string) { scanner.clear(); handleProcessScan(decodedText); }
        function onScanFailure() { /* ignore */ }
        return () => { scanner.clear(); };
    }
  }, [status]);

  const handleProcessScan = async (cardId: string) => {
    setStatus("processing");
    setRedeemed(false);
    try {
      const res = await fetch("/api/scan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId })
      });
      const data = await res.json();
      if (data.success) {
        setScanResult(cardId);
        setCardDetails(data.card);
        setGoal(data.stampGoal ?? 10);
        setRewardReady(!!data.rewardReady);
        setStatus("success");
        setMessage(data.added
          ? `Point ajouté à ${data.card.customers.full_name} !`
          : `${data.card.customers.full_name} a une récompense prête.`);
        if (typeof window !== "undefined" && window.navigator.vibrate) window.navigator.vibrate(200);
      } else {
        setStatus("error");
        setMessage(data.error || "Erreur lors du scan");
      }
    } catch {
      setStatus("error");
      setMessage("Erreur réseau ou serveur");
    }
  };

  const handleRedeem = async () => {
    if (!scanResult) return;
    setRedeeming(true);
    try {
      const res = await fetch("/api/redeem", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: scanResult })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error);
      setRedeemed(true);
      setRewardReady(false);
      setCardDetails(data.card);
      setMessage("Récompense remise ✅ La carte repart à zéro.");
    } catch {
      setMessage("Échec de l'encaissement. Réessayez.");
    } finally {
      setRedeeming(false);
    }
  };

  const resetScanner = () => {
    setScanResult(null); setCardDetails(null); setStatus("scanning");
    setMessage(""); setRewardReady(false); setRedeemed(false);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full">
        <div className="mb-8 text-center">
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                Letaief Scanner
            </h1>
            <p className="text-zinc-500 mt-2">Validez les tampons de vos clients en un clin d&apos;œil.</p>
        </div>

        <div className="relative aspect-square w-full bg-zinc-900 rounded-3xl border border-zinc-800 shadow-2xl overflow-hidden flex flex-col items-center justify-center">

          {status === "idle" && (
            <button onClick={() => setStatus("scanning")}
                className="group flex flex-col items-center gap-4 transition-transform hover:scale-105">
                <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20 group-hover:bg-emerald-500/20 transition-colors">
                    <Camera className="w-10 h-10 text-emerald-400" />
                </div>
                <span className="font-semibold text-lg">Démarrer le Scan</span>
            </button>
          )}

          {status === "scanning" && (<div id="reader" className="w-full h-full"></div>)}

          {status === "processing" && (
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="w-12 h-12 text-cyan-400 animate-spin" />
                <span className="text-zinc-400 animate-pulse">Vérification de la carte...</span>
            </div>
          )}

          {status === "success" && (
            <div className="flex flex-col items-center p-8 animate-in zoom-in duration-300 w-full">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-lg ${rewardReady && !redeemed ? "bg-amber-500 shadow-amber-500/20" : "bg-emerald-500 shadow-emerald-500/20"}`}>
                    {rewardReady && !redeemed ? <Gift className="w-12 h-12 text-white" /> : <CheckCircle className="w-12 h-12 text-white" />}
                </div>
                <h2 className="text-2xl font-bold mb-2">{rewardReady && !redeemed ? "Récompense prête 🎁" : "Validé !"}</h2>
                <p className={`font-medium mb-4 text-center ${rewardReady && !redeemed ? "text-amber-400" : "text-emerald-400"}`}>{message}</p>

                {cardDetails && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 w-full mb-6">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-zinc-500 text-xs uppercase tracking-widest font-bold">Solde</span>
                            <span className="text-white font-mono text-lg">{cardDetails.stamps_count} / {goal}</span>
                        </div>
                        <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-1000"
                                style={{ width: `${Math.min(100, (cardDetails.stamps_count / goal) * 100)}%` }}></div>
                        </div>
                    </div>
                )}

                {rewardReady && !redeemed && (
                    <button onClick={handleRedeem} disabled={redeeming}
                        className="flex items-center gap-2 bg-amber-500 text-black px-6 py-3 rounded-xl font-bold hover:bg-amber-400 transition-colors disabled:opacity-50 mb-3 w-full justify-center">
                        <Gift className="w-4 h-4" />
                        {redeeming ? "…" : "Remettre la récompense"}
                    </button>
                )}

                <button onClick={resetScanner}
                    className="flex items-center gap-2 bg-white text-black px-6 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors w-full justify-center">
                    <RefreshCw className="w-4 h-4" />
                    Scan Suivant
                </button>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center p-8 animate-in shake duration-500">
                <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/30">
                    <AlertCircle className="w-12 h-12 text-red-500" />
                </div>
                <h2 className="text-2xl font-bold mb-2 text-red-500">Oups !</h2>
                <p className="text-zinc-400 mb-8 text-center">{message}</p>
                <button onClick={resetScanner}
                    className="bg-zinc-800 hover:bg-zinc-700 text-white px-8 py-3 rounded-xl font-bold transition-all">
                    Réessayer
                </button>
            </div>
          )}

        </div>

        <div className="mt-8 flex justify-center gap-4">
            <div className="flex items-center gap-2 text-zinc-500 text-sm">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                Serveur Opérationnel
            </div>
        </div>
      </div>

      <style jsx global>{`
        #reader__scan_region { background: transparent !important; }
        #reader__dashboard { display: none !important; }
        #reader video { border-radius: 20px !important; object-fit: cover !important; }
        @keyframes shake {
            0%, 100% { transform: translateX(0); }
            10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
            20%, 40%, 60%, 80% { transform: translateX(5px); }
        }
        .animate-in.shake { animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both; }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 2: Vérifier le build**

Run: `npx tsc --noEmit` (ignorer passJson) puis `npm run build`.
Expected: succès, aucune erreur de lint.

- [ ] **Step 3: Commit**

```bash
git add src/app/scan/page.tsx
git commit -m "feat(scan-ui): redeem button when card is full + show progress out of stampGoal"
```

---

## Task 5: Fiche Clients — bouton encaisser + affichage /objectif

**Files:**
- Create: `src/app/dashboard/customers/RedeemCell.tsx`
- Modify: `src/app/dashboard/customers/page.tsx`

- [ ] **Step 1: Créer le composant client `RedeemCell`**

Create `src/app/dashboard/customers/RedeemCell.tsx` :

```typescript
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Gift } from "lucide-react";
import { canRedeem } from "@/lib/loyalty/stamp";

export function RedeemCell({ cardId, stampsCount, goal, customerName }: {
  cardId: string | null;
  stampsCount: number | null;
  goal: number;
  customerName: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (!cardId || stampsCount === null || !canRedeem(stampsCount, goal)) return null;

  const redeem = async () => {
    if (!window.confirm(`Remettre la récompense de ${customerName} ? La carte repart à zéro.`)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/redeem", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId }),
      });
      if (!res.ok) throw new Error();
      setDone(true);
      router.refresh();
    } catch {
      window.alert("Échec de l'encaissement.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button onClick={redeem} disabled={busy || done}
      className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-500 text-black font-bold hover:bg-emerald-400 transition-colors disabled:opacity-50">
      <Gift className="w-3.5 h-3.5" /> {busy ? "…" : "Récompense remise"}
    </button>
  );
}
```

- [ ] **Step 2: Modifier `src/app/dashboard/customers/page.tsx`**

Trois changements : (a) imports, (b) requête + objectif, (c) colonnes `/objectif` et cellule Actions.

(a) En tête de fichier, ajouter les imports (garder les imports lucide existants, retirer `MoreVertical` devenu inutile) :
```typescript
import { fetchMerchantConfig } from "@/lib/merchant-config/fetch";
import { RedeemCell } from "./RedeemCell";
```

(b) Remplacer la récupération du marchand/clients par (ajout de l'`id` de carte + `stampGoal`) :
```typescript
  const { data: { user } } = await supabase.auth.getUser();
  const { data: merchant } = await supabase
    .from("merchants").select("id").eq("user_id", user?.id).single();

  const stampGoal = merchant ? (await fetchMerchantConfig(merchant.id)).stampGoal : 10;

  const { data: customers } = await supabase
    .from("customers")
    .select("*, loyalty_cards(id, stamps_count, last_scan)")
    .eq("merchant_id", merchant?.id)
    .order("created_at", { ascending: false });
```

(c) Dans la colonne Fidélité, remplacer les deux `10` en dur :
```typescript
                                            <div className="text-sm font-bold text-emerald-400">{customer.loyalty_cards[0].stamps_count} / {stampGoal} pts</div>
                                            <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-emerald-500"
                                                    style={{ width: `${Math.min(100, (customer.loyalty_cards[0].stamps_count / stampGoal) * 100)}%` }}
                                                />
                                            </div>
```

Et remplacer la cellule Actions (le bouton `MoreVertical`) par :
```typescript
                                <td className="px-8 py-6 text-right">
                                    <RedeemCell
                                        cardId={customer.loyalty_cards?.[0]?.id ?? null}
                                        stampsCount={customer.loyalty_cards?.[0]?.stamps_count ?? null}
                                        goal={stampGoal}
                                        customerName={customer.full_name}
                                    />
                                </td>
```

- [ ] **Step 3: Vérifier le build**

Run: `npx tsc --noEmit` (ignorer passJson) puis `npm run build`.
Expected: succès, pas d'import `MoreVertical` inutilisé (le retirer de la ligne d'import lucide si le lint le signale).

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/customers/RedeemCell.tsx src/app/dashboard/customers/page.tsx
git commit -m "feat(customers-ui): redeem reward action per row + show progress out of stampGoal"
```

---

## Task 6: Analytique — compteur « récompenses offertes »

**Files:**
- Modify: `src/lib/analytics/rewards.ts`
- Modify: `src/lib/analytics/__tests__/rewards.test.ts`
- Modify: `src/app/dashboard/_analytics/widgets/RewardsWidget.tsx`

- [ ] **Step 1: Étendre le test pur (TDD)**

Dans `src/lib/analytics/__tests__/rewards.test.ts`, ajouter un cas pour `redeemedCount` (le test existant reste inchangé et passe car le paramètre a une valeur par défaut) :

```typescript
  it("expose redeemedCount passé en argument", () => {
    const r = computeRewards([{ stamps_count: 10 }], 10, 7);
    expect(r.redeemedCount).toBe(7);
  });

  it("redeemedCount par défaut à 0", () => {
    const r = computeRewards([{ stamps_count: 3 }], 10);
    expect(r.redeemedCount).toBe(0);
  });
```

- [ ] **Step 2: Run test — échoue d'abord**

Run: `npx vitest run src/lib/analytics/__tests__/rewards.test.ts`
Expected: FAIL (la propriété `redeemedCount` n'existe pas encore).

- [ ] **Step 3: Modifier `src/lib/analytics/rewards.ts`**

```typescript
import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchMerchantConfig } from "@/lib/merchant-config/fetch";
import { resolveRange } from "./range";
import { type RangeKey } from "./types";

export type Rewards = { completedCards: number; totalCards: number; completionRate: number; redeemedCount: number };

export function computeRewards(cards: { stamps_count: number }[], threshold: number, redeemedCount = 0): Rewards {
  const completedCards = cards.filter((c) => c.stamps_count >= threshold).length;
  const totalCards = cards.length;
  return {
    completedCards, totalCards,
    completionRate: totalCards ? Math.round((completedCards / totalCards) * 100) : 0,
    redeemedCount,
  };
}

export async function fetchRewards(merchantId: string, range: RangeKey): Promise<Rewards> {
  const supabase = await createClient();
  const { stampGoal } = await fetchMerchantConfig(merchantId);
  const { data } = await supabase.from("loyalty_cards").select("stamps_count").eq("merchant_id", merchantId);

  // Récompenses réellement encaissées sur la période (trace audit_logs).
  const { from } = resolveRange(range);
  const { count } = await supabaseAdmin
    .from("audit_logs")
    .select("id", { count: "exact", head: true })
    .eq("merchant_id", merchantId)
    .eq("action", "REWARD_REDEEMED")
    .gte("created_at", from.toISOString());

  return computeRewards(data ?? [], stampGoal, count ?? 0);
}
```

- [ ] **Step 4: Run tests — passent**

Run: `npx vitest run src/lib/analytics/__tests__/rewards.test.ts`
Expected: PASS (le cas existant + les 2 nouveaux).

- [ ] **Step 5: Afficher dans le widget**

Dans `src/app/dashboard/_analytics/widgets/RewardsWidget.tsx`, ajouter une ligne sous le taux de complétion :

```typescript
        : (<div><div className="text-3xl font-bold">{data.completedCards}</div>
            <div className="text-sm text-zinc-500">{data.completionRate}% des cartes ({data.totalCards})</div>
            <div className="text-sm text-emerald-400 mt-1">{data.redeemedCount} récompense(s) offerte(s)</div></div>)}
```

- [ ] **Step 6: Vérifier build complet**

Run: `npx tsc --noEmit` (ignorer passJson) puis `npm run build`.
Expected: succès.

- [ ] **Step 7: Commit**

```bash
git add src/lib/analytics/rewards.ts src/lib/analytics/__tests__/rewards.test.ts src/app/dashboard/_analytics/widgets/RewardsWidget.tsx
git commit -m "feat(analytics): count redeemed rewards over range in Rewards widget"
```

---

## Task 7: Vérification finale

- [ ] **Step 1: Suite complète**

Run: `npx vitest run`
Expected: tous les tests verts (97 de la branche + 11 nouveaux du Task 1 + 2 du Task 6 = 110).

- [ ] **Step 2: Build de production**

Run: `npm run build`
Expected: succès ; route `/api/redeem` listée.

- [ ] **Step 3: Fumée (compte démo, après `npm run dev`)**

1. Scanner : scanner une carte jusqu'à atteindre l'objectif → l'écran montre « Récompense prête » + bouton « Remettre la récompense » ; cliquer → « Récompense remise ✅ », solde à 0.
2. Re-scanner une carte déjà pleine → propose directement d'encaisser (aucun tampon ajouté).
3. Fiche Clients : un client dont la carte est pleine affiche « Récompense remise » → cliquer → carte à 0 (la ligne se rafraîchit).
4. Analytique → widget Récompenses : « X récompense(s) offerte(s) » a augmenté.

---

## Self-Review (rempli pendant la rédaction)

- **Couverture spec :** logique pure `applyStamp`/`canRedeem` (Task 1) ; correction du `10` en dur + plafonnement + `rewardReady`/`added`/`stampGoal` dans la réponse scan (Task 3) ; endpoint `/api/redeem` marchand-only, propriété + `canRedeem` + audit `REWARD_REDEEMED` + push best-effort (Task 2) ; bouton encaisser Scanner (Task 4) ET fiche Clients (Task 5) ; `/objectif` au lieu de `/10` (Tasks 4, 5) ; compteur « récompenses offertes » sur la période (Task 6) ; aucune migration. `last_scan` inchangé à l'encaissement (Task 2). Hors périmètre (paliers, catalogue, expiration, auto-encaissement, email) non implémenté.
- **Placeholders :** aucun — code complet à chaque step.
- **Cohérence des types :** `applyStamp(currentStamps, goal) → { newStamps, rewardReady, added }` identique Tasks 1, 3 ; `canRedeem(stamps, goal)` identique Tasks 1, 2, 5 ; réponse scan `{ rewardReady, added, stampGoal }` consommée par le Scanner (Task 4) ; `Rewards` étendu avec `redeemedCount` (Task 6) consommé par RewardsWidget ; action `'REWARD_REDEEMED'` déclarée (Task 2) et comptée (Task 6).
```
