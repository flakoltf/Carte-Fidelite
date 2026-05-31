# Canal Push Wallet — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre au marchand de pousser des notifications (et la mise à jour live des cartes) via Apple Wallet, avec une interface d'envoi ; Google branché mais désactivé.

**Architecture:** Les passes deviennent « push-ready » (`webServiceURL` + `authenticationToken` + champ message) dans `buildApplePassBuffer` lui-même → tous les appelants couverts. Un service web PassKit (4 endpoints) gère l'enregistrement des appareils dans `wallet_device_registrations`. Un sender APNs (HTTP/2, certificat Pass Type ID existant) envoie un ping vide. Une abstraction `NotificationChannel` (AppleChannel actif, GoogleChannel désactivé) met à jour les cartes et pousse ; utilisée par `/api/notifications/send` (UI marchand) et par le scan (carte vivante). Logique pure isolée et testée (Vitest).

**Tech Stack:** Next.js 16 (App Router, route handlers async params) · TypeScript · Supabase (`supabaseAdmin`) · Node `http2` (APNs) · passkit-generator · Vitest.

**Spec:** `docs/superpowers/specs/2026-05-31-push-wallet-design.md`

---

## File Structure

```
supabase/migrations/20260531_push_wallet.sql
src/lib/wallet/
  passJson.ts      # buildPassJson(input) -> objet pass.json (PUR)
  authToken.ts     # parseApplePassAuth(header) PUR ; ensureAuthToken(cardId), getCardMessage(cardId) (DB)
  updates.ts       # filterUpdatedSerials(cards, sinceTag) PUR
  apns.ts          # buildApnsRequest(token,passTypeId) PUR ; sendPush(tokens,passTypeId) (http2)
  channel.ts       # NotificationChannel, AppleChannel, GoogleChannel, getChannels()
  __tests__/*.test.ts
src/lib/applePass.ts                         # modifié : push-ready via buildPassJson
src/app/api/wallet/apple/v1/devices/[deviceId]/registrations/[passTypeId]/[serial]/route.ts  # POST/DELETE
src/app/api/wallet/apple/v1/devices/[deviceId]/registrations/[passTypeId]/route.ts           # GET serials
src/app/api/wallet/apple/v1/passes/[passTypeId]/[serial]/route.ts                            # GET latest
src/app/api/wallet/apple/v1/log/route.ts                                                     # POST log
src/app/api/notifications/send/route.ts      # envoi marchand
src/app/api/scan/route.ts                    # modifié : carte vivante
src/app/dashboard/notifications/page.tsx     # UI marchand
src/app/dashboard/notifications/SendForm.tsx
src/app/dashboard/DashboardShell.tsx         # modifié : onglet Notifications
```

---

### Task 1: Migration BDD

**Files:** Create `supabase/migrations/20260531_push_wallet.sql`

- [ ] **Step 1: Écrire la migration**
```sql
ALTER TABLE loyalty_cards ADD COLUMN IF NOT EXISTS auth_token TEXT;
ALTER TABLE loyalty_cards ADD COLUMN IF NOT EXISTS pass_message TEXT;
ALTER TABLE loyalty_cards ADD COLUMN IF NOT EXISTS pass_updated_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS wallet_device_registrations (
  id uuid primary key default uuid_generate_v4(),
  device_library_id text not null,
  pass_type_id text not null,
  serial_number text not null,
  push_token text not null,
  created_at timestamptz default now(),
  unique (device_library_id, serial_number)
);
CREATE INDEX IF NOT EXISTS idx_wdr_serial ON wallet_device_registrations (pass_type_id, serial_number);
CREATE INDEX IF NOT EXISTS idx_wdr_device ON wallet_device_registrations (device_library_id);

CREATE TABLE IF NOT EXISTS wallet_notifications (
  id uuid primary key default uuid_generate_v4(),
  merchant_id uuid references merchants(id) on delete cascade,
  title text not null,
  body text not null,
  sent_count int not null default 0,
  created_at timestamptz default now()
);
```

- [ ] **Step 2: NE PAS appliquer** — créer le fichier seulement, le commiter. L'application en prod (MCP Supabase `apply_migration`, name `push_wallet`, projet `oqcelbbozpykwkasjtqy`) est faite par le contrôleur avec le consentement utilisateur, hors de ce sous-agent.

- [ ] **Step 3: Commit**
```bash
git add supabase/migrations/20260531_push_wallet.sql
git commit -m "feat(db): push wallet — card push fields + device registrations + notifications log"
```

---

### Task 2: `buildPassJson` (pur) + test

**Files:** Create `src/lib/wallet/passJson.ts`, Test `src/lib/wallet/__tests__/passJson.test.ts`

- [ ] **Step 1: Test (échoue d'abord)**
```ts
import { describe, it, expect } from "vitest";
import { buildPassJson } from "@/lib/wallet/passJson";

const base = {
  cardId: "card-1", customerName: "Alice", stamps: 3,
  orgName: "Café", backgroundColor: "rgb(0,0,0)",
  passTypeIdentifier: "pass.x", teamIdentifier: "T1", barcodeMessage: "sig",
};

describe("buildPassJson", () => {
  it("inclut webServiceURL + authenticationToken quand fournis", () => {
    const p = buildPassJson({ ...base, webServiceURL: "https://x/api/wallet/apple", authToken: "tok", message: "Promo" });
    expect(p.webServiceURL).toBe("https://x/api/wallet/apple");
    expect(p.authenticationToken).toBe("tok");
    const msg = p.storeCard.backFields.find((f: { key: string }) => f.key === "message");
    expect(msg.value).toBe("Promo");
    expect(msg.changeMessage).toBe("%@");
    expect(p.serialNumber).toBe("card-1");
  });
  it("sans authToken : pas de webServiceURL (pass non push-ready)", () => {
    const p = buildPassJson(base);
    expect(p.webServiceURL).toBeUndefined();
    expect(p.authenticationToken).toBeUndefined();
  });
});
```

- [ ] **Step 2: Vérifier l'échec** — `npm test -- passJson` → FAIL.

- [ ] **Step 3: Implémenter**
```ts
export interface PassJsonInput {
  cardId: string; customerName: string; stamps: number;
  orgName: string; backgroundColor: string;
  passTypeIdentifier: string; teamIdentifier: string; barcodeMessage: string;
  webServiceURL?: string; authToken?: string; message?: string;
}

export function buildPassJson(i: PassJsonInput): Record<string, unknown> & {
  storeCard: { backFields: { key: string; value: string; changeMessage?: string }[] };
} {
  const pass = {
    formatVersion: 1,
    passTypeIdentifier: i.passTypeIdentifier,
    teamIdentifier: i.teamIdentifier,
    serialNumber: i.cardId,
    organizationName: i.orgName,
    description: "Carte de fidélité numérique",
    logoText: i.orgName,
    backgroundColor: i.backgroundColor,
    foregroundColor: "rgb(255, 255, 255)",
    labelColor: "rgb(255, 255, 255)",
    storeCard: {
      headerFields: [] as unknown[],
      primaryFields: [{ key: "stamps", label: "TAMPONS", value: `${i.stamps} / 10`, textAlignment: "PKTextAlignmentRight" }],
      secondaryFields: [{ key: "customerName", label: "CLIENT", value: i.customerName }],
      auxiliaryFields: [] as unknown[],
      backFields: [{ key: "message", label: "INFO", value: i.message ?? "", changeMessage: "%@" }],
    },
    barcodes: [{ message: i.barcodeMessage, format: "PKBarcodeFormatQR", messageEncoding: "iso-8859-1", altText: "Scannez pour valider vos tampons" }],
  } as Record<string, unknown> & { storeCard: { backFields: { key: string; value: string; changeMessage?: string }[] } };

  if (i.webServiceURL && i.authToken) {
    pass.webServiceURL = i.webServiceURL;
    pass.authenticationToken = i.authToken;
  }
  return pass;
}
```

- [ ] **Step 4: Vérifier le succès** — `npm test -- passJson` → PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/wallet/passJson.ts src/lib/wallet/__tests__/passJson.test.ts
git commit -m "feat(wallet): pure pass.json builder (push-ready fields)"
```

---

### Task 3: `authToken.ts` (parse pur + helpers DB)

**Files:** Create `src/lib/wallet/authToken.ts`, Test `src/lib/wallet/__tests__/authToken.test.ts`

- [ ] **Step 1: Test (échoue d'abord)**
```ts
import { describe, it, expect } from "vitest";
import { parseApplePassAuth } from "@/lib/wallet/authToken";

describe("parseApplePassAuth", () => {
  it("extrait le token du header ApplePass", () => {
    expect(parseApplePassAuth("ApplePass abc123")).toBe("abc123");
  });
  it("renvoie null si header absent ou mauvais schéma", () => {
    expect(parseApplePassAuth(null)).toBeNull();
    expect(parseApplePassAuth("Bearer xyz")).toBeNull();
  });
});
```

- [ ] **Step 2: Échec** — `npm test -- authToken` → FAIL.

- [ ] **Step 3: Implémenter**
```ts
import { randomBytes } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export function parseApplePassAuth(header: string | null): string | null {
  if (!header) return null;
  const m = /^ApplePass\s+(.+)$/.exec(header.trim());
  return m ? m[1] : null;
}

export async function ensureAuthToken(cardId: string): Promise<string> {
  const { data } = await supabaseAdmin.from("loyalty_cards").select("auth_token").eq("id", cardId).single();
  if (data?.auth_token) return data.auth_token as string;
  const token = randomBytes(16).toString("hex");
  await supabaseAdmin.from("loyalty_cards").update({ auth_token: token }).eq("id", cardId);
  return token;
}

export async function getCardMessage(cardId: string): Promise<string> {
  const { data } = await supabaseAdmin.from("loyalty_cards").select("pass_message").eq("id", cardId).single();
  return (data?.pass_message as string) ?? "";
}
```

- [ ] **Step 4: Succès** — `npm test -- authToken` → PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/wallet/authToken.ts src/lib/wallet/__tests__/authToken.test.ts
git commit -m "feat(wallet): ApplePass auth parsing + per-card auth token helpers"
```

---

### Task 4: Passes push-ready dans `applePass.ts`

**Files:** Modify `src/lib/applePass.ts`

> But : sans changer les appelants, rendre tout pass généré push-ready.

- [ ] **Step 1: Remplacer la construction inline de `passJson` + l'appel**

Dans `buildApplePassBuffer`, après le calcul de `orgName`, `backgroundColor`, `passTypeIdentifier`, `teamIdentifier` (déjà présents), **remplacer** le bloc `const passJson = { ... };` par :
```ts
const { buildPassJson } = await import("@/lib/wallet/passJson");
const { ensureAuthToken, getCardMessage } = await import("@/lib/wallet/authToken");

const authToken = await ensureAuthToken(cardId);
const message = await getCardMessage(cardId);
const webServiceURL =
  process.env.APPLE_WEB_SERVICE_URL ||
  `${process.env.NEXT_PUBLIC_BASE_URL || "https://carte-fidelite-nu.vercel.app"}/api/wallet/apple`;

const passJson = buildPassJson({
  cardId,
  customerName,
  stamps,
  orgName,
  backgroundColor,
  passTypeIdentifier,
  teamIdentifier,
  barcodeMessage: signQRCode(cardId),
  webServiceURL,
  authToken,
  message,
});
```
(Le reste de la fonction — buffers, PKPass, getAsBuffer — est inchangé. Le fichier est déjà `@ts-nocheck`.)

- [ ] **Step 2: Vérifier le build** — `npm run build` → « Compiled successfully » (les appelants existants compilent toujours).

- [ ] **Step 3: Commit**
```bash
git add src/lib/applePass.ts
git commit -m "feat(wallet): make generated Apple passes push-ready (webServiceURL + auth token + message)"
```

---

### Task 5: `updates.ts` — filtre des cartes modifiées (pur)

**Files:** Create `src/lib/wallet/updates.ts`, Test `src/lib/wallet/__tests__/updates.test.ts`

- [ ] **Step 1: Test (échoue)**
```ts
import { describe, it, expect } from "vitest";
import { filterUpdatedSerials } from "@/lib/wallet/updates";

describe("filterUpdatedSerials", () => {
  it("garde les serials modifiés après le tag, lastUpdated = max", () => {
    const cards = [
      { serial: "a", updatedAt: 100 },
      { serial: "b", updatedAt: 300 },
      { serial: "c", updatedAt: 50 },
    ];
    const r = filterUpdatedSerials(cards, "120");
    expect(r.serials).toEqual(["b"]);
    expect(r.lastUpdated).toBe("300");
  });
  it("sans tag : tout ce qui a updatedAt > 0", () => {
    expect(filterUpdatedSerials([{ serial: "a", updatedAt: 5 }]).serials).toEqual(["a"]);
  });
});
```

- [ ] **Step 2: Échec** — `npm test -- updates` → FAIL.

- [ ] **Step 3: Implémenter**
```ts
export function filterUpdatedSerials(
  cards: { serial: string; updatedAt: number }[],
  sinceTag?: string
): { serials: string[]; lastUpdated: string } {
  const since = sinceTag ? Number(sinceTag) : 0;
  const serials = cards.filter((c) => c.updatedAt > since).map((c) => c.serial);
  const lastUpdated = String(cards.reduce((m, c) => Math.max(m, c.updatedAt), since));
  return { serials, lastUpdated };
}
```

- [ ] **Step 4: Succès** — `npm test -- updates` → PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/wallet/updates.ts src/lib/wallet/__tests__/updates.test.ts
git commit -m "feat(wallet): updated-serials filter for PassKit web service"
```

---

### Task 6: `apns.ts` — requête pure + sender HTTP/2

**Files:** Create `src/lib/wallet/apns.ts`, Test `src/lib/wallet/__tests__/apns.test.ts`

- [ ] **Step 1: Test de `buildApnsRequest` (échoue)**
```ts
import { describe, it, expect } from "vitest";
import { buildApnsRequest } from "@/lib/wallet/apns";

describe("buildApnsRequest", () => {
  it("construit path/headers/body pour APNs", () => {
    const r = buildApnsRequest("TOKEN", "pass.x");
    expect(r.path).toBe("/3/device/TOKEN");
    expect(r.headers["apns-topic"]).toBe("pass.x");
    expect(r.headers["apns-push-type"]).toBe("background");
    expect(r.body).toBe("{}");
  });
});
```

- [ ] **Step 2: Échec** — `npm test -- apns` → FAIL.

- [ ] **Step 3: Implémenter (pure + transport)**
```ts
import http2 from "node:http2";
import fs from "node:fs/promises";
import path from "node:path";

export function buildApnsRequest(pushToken: string, passTypeId: string): {
  path: string; headers: Record<string, string>; body: string;
} {
  return {
    path: `/3/device/${pushToken}`,
    headers: { "apns-topic": passTypeId, "apns-push-type": "background", "apns-priority": "5" },
    body: "{}",
  };
}

async function loadPem(envB64: string | undefined, fileRelPath: string): Promise<Buffer> {
  if (envB64 && envB64.trim().length > 0) return Buffer.from(envB64, "base64");
  return fs.readFile(path.join(process.cwd(), fileRelPath));
}

// Ping APNs vide ("ta carte a changé"). Auth TLS = certificat Pass Type ID existant.
export async function sendPush(pushTokens: string[], passTypeId: string): Promise<{ ok: number; dead: string[] }> {
  if (!pushTokens.length) return { ok: 0, dead: [] };
  const [cert, key] = await Promise.all([
    loadPem(process.env.SIGNER_CERT_BASE64, process.env.SIGNER_CERT_PATH || "certs/signerCert.pem"),
    loadPem(process.env.SIGNER_KEY_BASE64, process.env.SIGNER_KEY_PATH || "certs/signerKey.pem"),
  ]);
  const passphrase = process.env.SIGNER_KEY_PASSPHRASE || "";
  const host = process.env.APNS_HOST || "https://api.push.apple.com";
  const client = http2.connect(host, { cert, key, passphrase });

  let ok = 0;
  const dead: string[] = [];
  await Promise.all(pushTokens.map((tok) => new Promise<void>((resolve) => {
    const r = buildApnsRequest(tok, passTypeId);
    const reqStream = client.request({ ":method": "POST", ":path": r.path, ...r.headers });
    let status = 0;
    reqStream.on("response", (h) => { status = Number(h[":status"]); });
    reqStream.setEncoding("utf8");
    reqStream.on("data", () => {});
    reqStream.on("end", () => { if (status === 200) ok++; else if (status === 410) dead.push(tok); resolve(); });
    reqStream.on("error", () => resolve());
    reqStream.end(r.body);
  })));
  client.close();
  return { ok, dead };
}
```

- [ ] **Step 4: Succès** — `npm test -- apns` → PASS. `npm run build` OK.

- [ ] **Step 5: Commit**
```bash
git add src/lib/wallet/apns.ts src/lib/wallet/__tests__/apns.test.ts
git commit -m "feat(wallet): APNs sender (http2, pass type cert) + pure request builder"
```

---

### Task 7: Abstraction canal (`channel.ts`) + test `getChannels`

**Files:** Create `src/lib/wallet/channel.ts`, Test `src/lib/wallet/__tests__/channel.test.ts`

- [ ] **Step 1: Test de `getChannels` (échoue)**
```ts
import { describe, it, expect, afterEach } from "vitest";
import { getChannels, AppleChannel, GoogleChannel } from "@/lib/wallet/channel";

afterEach(() => { delete process.env.GOOGLE_PUSH_ENABLED; });

describe("getChannels", () => {
  it("Apple seul par défaut (Google démo)", () => {
    const ch = getChannels();
    expect(ch).toContain(AppleChannel);
    expect(ch).not.toContain(GoogleChannel);
  });
  it("inclut Google si flag activé", () => {
    process.env.GOOGLE_PUSH_ENABLED = "true";
    expect(getChannels()).toContain(GoogleChannel);
  });
});
```

- [ ] **Step 2: Échec** — `npm test -- channel` → FAIL.

- [ ] **Step 3: Implémenter**
```ts
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { sendPush } from "./apns";

export interface NotificationChannel {
  notify(cardIds: string[], message?: { title: string; body: string }): Promise<{ pushed: number }>;
}

const passTypeId = () => process.env.APPLE_PASS_TYPE_ID || "pass.com.walletcard.fidelite";

export const AppleChannel: NotificationChannel = {
  async notify(cardIds, message) {
    if (!cardIds.length) return { pushed: 0 };
    const update: Record<string, unknown> = { pass_updated_at: new Date().toISOString() };
    if (message) update.pass_message = `${message.title}\n${message.body}`;
    await supabaseAdmin.from("loyalty_cards").update(update).in("id", cardIds);

    const { data } = await supabaseAdmin
      .from("wallet_device_registrations").select("push_token").in("serial_number", cardIds);
    const tokens = [...new Set((data ?? []).map((r) => r.push_token as string))];
    if (!tokens.length) return { pushed: 0 };

    const res = await sendPush(tokens, passTypeId());
    if (res.dead.length) await supabaseAdmin.from("wallet_device_registrations").delete().in("push_token", res.dead);
    return { pushed: res.ok };
  },
};

// Désactivé tant que l'émetteur Google Wallet est en mode démo (pas d'accès publishing).
export const GoogleChannel: NotificationChannel = {
  async notify() { return { pushed: 0 }; },
};

export function getChannels(): NotificationChannel[] {
  const channels: NotificationChannel[] = [AppleChannel];
  if (process.env.GOOGLE_PUSH_ENABLED === "true") channels.push(GoogleChannel);
  return channels;
}
```

- [ ] **Step 4: Succès** — `npm test -- channel` → PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/wallet/channel.ts src/lib/wallet/__tests__/channel.test.ts
git commit -m "feat(wallet): notification channel abstraction (Apple active, Google disabled)"
```

---

### Task 8: Service web — register / unregister

**Files:** Create `src/app/api/wallet/apple/v1/devices/[deviceId]/registrations/[passTypeId]/[serial]/route.ts`

- [ ] **Step 1: Implémenter (POST + DELETE)**
```ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { parseApplePassAuth } from "@/lib/wallet/authToken";

export const runtime = "nodejs";

async function authorize(req: Request, serial: string): Promise<boolean> {
  const token = parseApplePassAuth(req.headers.get("authorization"));
  if (!token) return false;
  const { data } = await supabaseAdmin.from("loyalty_cards").select("auth_token").eq("id", serial).single();
  return !!data?.auth_token && data.auth_token === token;
}

export async function POST(req: Request, { params }: { params: Promise<{ deviceId: string; passTypeId: string; serial: string }> }) {
  const { deviceId, passTypeId, serial } = await params;
  if (!(await authorize(req, serial))) return new NextResponse("unauthorized", { status: 401 });
  const { pushToken } = await req.json().catch(() => ({}));
  if (!pushToken || typeof pushToken !== "string") return new NextResponse("bad request", { status: 400 });

  const { data: existing } = await supabaseAdmin
    .from("wallet_device_registrations").select("id")
    .eq("device_library_id", deviceId).eq("serial_number", serial).maybeSingle();
  if (existing) return new NextResponse(null, { status: 200 });

  await supabaseAdmin.from("wallet_device_registrations").insert({
    device_library_id: deviceId, pass_type_id: passTypeId, serial_number: serial, push_token: pushToken,
  });
  return new NextResponse(null, { status: 201 });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ deviceId: string; passTypeId: string; serial: string }> }) {
  const { deviceId, serial } = await params;
  if (!(await authorize(req, serial))) return new NextResponse("unauthorized", { status: 401 });
  await supabaseAdmin.from("wallet_device_registrations").delete()
    .eq("device_library_id", deviceId).eq("serial_number", serial);
  return new NextResponse(null, { status: 200 });
}
```

- [ ] **Step 2: Build** — `npm run build` OK.
- [ ] **Step 3: Commit**
```bash
git add "src/app/api/wallet/apple/v1/devices/[deviceId]/registrations/[passTypeId]/[serial]/route.ts"
git commit -m "feat(wallet): PassKit device register/unregister endpoint"
```

---

### Task 9: Service web — liste des cartes à mettre à jour

**Files:** Create `src/app/api/wallet/apple/v1/devices/[deviceId]/registrations/[passTypeId]/route.ts`

- [ ] **Step 1: Implémenter (GET)**
```ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { filterUpdatedSerials } from "@/lib/wallet/updates";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ deviceId: string; passTypeId: string }> }) {
  const { deviceId, passTypeId } = await params;
  const sinceTag = new URL(req.url).searchParams.get("passesUpdatedSince") ?? undefined;

  const { data: regs } = await supabaseAdmin
    .from("wallet_device_registrations").select("serial_number")
    .eq("device_library_id", deviceId).eq("pass_type_id", passTypeId);
  const serials = (regs ?? []).map((r) => r.serial_number as string);
  if (!serials.length) return new NextResponse(null, { status: 204 });

  const { data: cards } = await supabaseAdmin.from("loyalty_cards").select("id, pass_updated_at").in("id", serials);
  const list = (cards ?? []).map((c) => ({
    serial: c.id as string,
    updatedAt: c.pass_updated_at ? new Date(c.pass_updated_at as string).getTime() : 0,
  }));
  const { serials: fresh, lastUpdated } = filterUpdatedSerials(list, sinceTag);
  if (!fresh.length) return new NextResponse(null, { status: 204 });
  return NextResponse.json({ serialNumbers: fresh, lastUpdated });
}
```

- [ ] **Step 2: Build** — OK.
- [ ] **Step 3: Commit**
```bash
git add "src/app/api/wallet/apple/v1/devices/[deviceId]/registrations/[passTypeId]/route.ts"
git commit -m "feat(wallet): PassKit list-updatable-passes endpoint"
```

---

### Task 10: Service web — dernière version du pass + log

**Files:** Create `src/app/api/wallet/apple/v1/passes/[passTypeId]/[serial]/route.ts` ; Create `src/app/api/wallet/apple/v1/log/route.ts`

- [ ] **Step 1: Get latest pass**
```ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { parseApplePassAuth } from "@/lib/wallet/authToken";
import { buildApplePassBuffer } from "@/lib/applePass";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ passTypeId: string; serial: string }> }) {
  const { serial } = await params;
  const token = parseApplePassAuth(req.headers.get("authorization"));
  const { data: card } = await supabaseAdmin
    .from("loyalty_cards")
    .select("stamps_count, auth_token, customers(full_name), merchants(shop_name, primary_color)")
    .eq("id", serial).single();
  if (!card) return new NextResponse("not found", { status: 404 });
  if (!token || token !== card.auth_token) return new NextResponse("unauthorized", { status: 401 });

  const customer = card.customers as unknown as { full_name?: string } | null;
  const merchant = card.merchants as unknown as { shop_name?: string; primary_color?: string } | null;
  const buffer = await buildApplePassBuffer({
    cardId: serial,
    customerName: customer?.full_name ?? "Client",
    stamps: (card.stamps_count as number) ?? 0,
    branding: { shopName: merchant?.shop_name ?? null, primaryColor: merchant?.primary_color ?? null },
  });
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: { "Content-Type": "application/vnd.apple.pkpass", "Last-Modified": new Date().toUTCString() },
  });
}
```

- [ ] **Step 2: Log endpoint**
```ts
import { NextResponse } from "next/server";
export async function POST(req: Request) {
  try { const body = await req.json(); console.log("[ApplePass log]", JSON.stringify(body).slice(0, 500)); } catch {}
  return new NextResponse(null, { status: 200 });
}
```

- [ ] **Step 3: Build** — OK.
- [ ] **Step 4: Commit**
```bash
git add "src/app/api/wallet/apple/v1/passes/[passTypeId]/[serial]/route.ts" "src/app/api/wallet/apple/v1/log/route.ts"
git commit -m "feat(wallet): PassKit latest-pass + log endpoints"
```

---

### Task 11: Envoi marchand `/api/notifications/send`

**Files:** Create `src/app/api/notifications/send/route.ts`

- [ ] **Step 1: Implémenter**
```ts
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { currentMerchantId } from "@/lib/analytics/merchant";
import { getChannels } from "@/lib/wallet/channel";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const merchantId = await currentMerchantId();
  if (!merchantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { title, body } = await req.json().catch(() => ({}));
  if (typeof title !== "string" || typeof body !== "string" || !title.trim() || !body.trim())
    return NextResponse.json({ error: "bad input" }, { status: 400 });

  const { data: cards } = await supabaseAdmin.from("loyalty_cards").select("id").eq("merchant_id", merchantId);
  const cardIds = (cards ?? []).map((c) => c.id as string);
  if (!cardIds.length) return NextResponse.json({ pushed: 0, reachable: 0 });

  const { data: regs } = await supabaseAdmin
    .from("wallet_device_registrations").select("serial_number").in("serial_number", cardIds);
  const reachable = [...new Set((regs ?? []).map((r) => r.serial_number as string))];

  let pushed = 0;
  for (const ch of getChannels()) pushed += (await ch.notify(reachable, { title, body })).pushed;
  await supabaseAdmin.from("wallet_notifications").insert({ merchant_id: merchantId, title, body, sent_count: pushed });
  return NextResponse.json({ pushed, reachable: reachable.length });
}
```

- [ ] **Step 2: Build** — OK.
- [ ] **Step 3: Commit**
```bash
git add src/app/api/notifications/send/route.ts
git commit -m "feat(notifications): merchant broadcast endpoint (update + APNs)"
```

---

### Task 12: Carte vivante au scan

**Files:** Modify `src/app/api/scan/route.ts`

- [ ] **Step 1: Ajouter le push best-effort**

Juste après le bloc « 4. Enregistrer l'historique du scan » (l'`insert` dans `scan_history`) et avant « 5. Audit trail », insérer :
```ts
    // 4b. Carte vivante : pousse la mise à jour du pass (best-effort, n'échoue pas le scan)
    try {
      const { getChannels } = await import("@/lib/wallet/channel");
      for (const ch of getChannels()) await ch.notify([actualCardId]);
    } catch (e) {
      console.error("[scan] push notify failed:", e);
    }
```

- [ ] **Step 2: Build** — OK.
- [ ] **Step 3: Commit**
```bash
git add src/app/api/scan/route.ts
git commit -m "feat(scan): push live pass update after a scan"
```

---

### Task 13: UI marchand « Notifications »

**Files:** Create `src/app/dashboard/notifications/page.tsx`, `src/app/dashboard/notifications/SendForm.tsx` ; Modify `src/app/dashboard/DashboardShell.tsx`

- [ ] **Step 1: Formulaire client `SendForm.tsx`**
```tsx
"use client";
import { useState } from "react";

export function SendForm() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const send = async () => {
    setSending(true); setResult(null);
    try {
      const res = await fetch("/api/notifications/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body }),
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

- [ ] **Step 2: Page serveur `page.tsx` (form + historique)**
```tsx
import { createClient } from "@/utils/supabase/server";
import { SendForm } from "./SendForm";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: merchant } = await supabase.from("merchants").select("id").eq("user_id", user?.id).single();
  const { data: history } = await supabase
    .from("wallet_notifications").select("*").eq("merchant_id", merchant?.id)
    .order("created_at", { ascending: false }).limit(20);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Notifications</h1>
        <p className="text-zinc-500">Envoyez un message à vos clients, directement dans leur Wallet — sans SMS.</p>
      </div>
      <SendForm />
      <div>
        <h2 className="text-lg font-bold mb-4">Historique</h2>
        <div className="space-y-3">
          {history && history.length > 0 ? history.map((n) => (
            <div key={n.id} className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-4">
              <div className="font-bold">{n.title}</div>
              <div className="text-sm text-zinc-400">{n.body}</div>
              <div className="text-xs text-zinc-600 mt-1">{new Date(n.created_at).toLocaleString()} · {n.sent_count} envoyé(s)</div>
            </div>
          )) : <p className="text-zinc-600 text-sm">Aucune notification envoyée pour l'instant.</p>}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Ajouter l'onglet dans `DashboardShell.tsx`**

Dans `src/app/dashboard/DashboardShell.tsx`, importer `Bell` depuis `lucide-react` (l'ajouter à la liste d'imports existante depuis `lucide-react`), et ajouter une entrée au tableau `navItems` après `{ name: "Clients", ... }` :
```tsx
    { name: "Notifications", icon: Bell, href: "/dashboard/notifications" },
```

- [ ] **Step 4: Build + fumée** — `npm run build` OK ; en dev, l'onglet « Notifications » apparaît, le formulaire poste (0 envoi tant qu'aucune carte push-ready enregistrée).

- [ ] **Step 5: Commit**
```bash
git add src/app/dashboard/notifications/ src/app/dashboard/DashboardShell.tsx
git commit -m "feat(dashboard): notifications tab — send a wallet message to customers"
```

---

### Task 14: Vérification finale

- [ ] **Step 1: Tests** — `npm test` → tous PASS (passJson, authToken, updates, apns, channel + ceux du module analytique).
- [ ] **Step 2: Build** — `npm run build` → « Compiled successfully », routes `/api/wallet/apple/**` et `/api/notifications/send` listées.
- [ ] **Step 3: Lint** — `npm run lint` (pas de nouvelle erreur bloquante).
- [ ] **Step 4: Fumée prod (iPhone)** — après application de la migration + déploiement : (1) générer/ré-ajouter une carte → vérifier qu'elle s'installe (pass push-ready) ; (2) faire un scan → la carte se met à jour sur le téléphone ; (3) envoyer un message depuis `/dashboard/notifications` → notification reçue + visible au dos de la carte.

---

## Notes de réalisation

- **TDD** sur la logique pure (`buildPassJson`, `parseApplePassAuth`, `filterUpdatedSerials`, `buildApnsRequest`, `getChannels`). Les endpoints, l'http2 APNs et l'UI sont vérifiés par `build` + fumée iPhone (APNs réel non testable unitairement).
- **Sécurité** : service web authentifié par `authenticationToken` par carte ; `/api/notifications/send` scopé marchand ; tables de registration non exposées au client.
- **Apple-first** : `GoogleChannel` est inerte (mode démo) ; activable via `GOOGLE_PUSH_ENABLED=true` quand l'accès publishing sera accordé, sans toucher au reste.
- **Push-ready transparent** : la modif de `applePass.ts` (Task 4) rend push-ready TOUS les passes générés (génération directe + enrôlement public + get-latest), sans changer les appelants.
- **Migration** : à appliquer en prod (`apply_migration`, projet WalletCard `oqcelbbozpykwkasjtqy`) avant la fumée iPhone.
- **Cartes existantes** : ne reçoivent rien tant qu'elles ne sont pas ré-ajoutées (elles n'ont pas de `webServiceURL`). Partager le lien d'ajout au wallet existant pour migrer.
- **Ré-ajout (ajustement vs spec)** : pas de bouton de ré-ajout dédié — YAGNI. Le flux d'enrôlement existant (page `/enroll/[token]`, génération de pass) produit désormais des passes push-ready (grâce à Task 4), donc « ré-ajouter » = repasser par l'ajout au wallet existant. Un bouton dédié pourra s'ajouter plus tard si besoin.
