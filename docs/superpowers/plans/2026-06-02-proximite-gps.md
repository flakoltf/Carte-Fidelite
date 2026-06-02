# Proximité GPS (géofence Wallet) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire remonter la carte de fidélité à proximité de la boutique via le champ natif `locations` des pass Apple/Google, en saisissant l'adresse (géocodée via Nominatim) côté marchand ET admin.

**Architecture:** Un module pur `geo/geocode.ts` (build URL Nominatim + parse + validations, testé) et un wrapper `geocodeAddress`. Un helper serveur `applyMerchantLocation` (géocode-ou-coords-manuelles → persiste `address/latitude/longitude` → push de rafraîchissement best-effort), appelé par une route marchand self-service et par la route admin. Les générateurs de pass Apple (`passJson`/`applePass`) et Google (`googlePass`) ajoutent `locations` quand le marchand a des coordonnées.

**Tech Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Supabase (service-role) · Nominatim/OSM (géocodage, gratuit) · Vitest · Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-06-02-proximite-gps-design.md`

---

## File Structure

```
supabase/migrations/20260602_merchant_location.sql   # NEW (créée, PAS appliquée par le sous-agent)
src/lib/geo/geocode.ts        # PUR : buildNominatimUrl, parseGeocode, isValidLatLng, proximityText + geocodeAddress (fetch)
src/lib/geo/__tests__/geocode.test.ts
src/lib/geo/applyLocation.ts  # applyMerchantLocation(merchantId, input) : géocode/persist/refresh
src/app/api/merchant/location/route.ts          # NEW : POST self-service marchand
src/app/api/admin/merchants/[id]/route.ts       # MODIFY : accepte address → applyMerchantLocation
src/lib/wallet/passJson.ts    # MODIFY : champ optionnel locations
src/lib/applePass.ts          # MODIFY : charge lat/lng → locations
src/lib/googlePass.ts         # MODIFY : charge lat/lng → locations
src/app/dashboard/settings/page.tsx             # MODIFY : section Adresse & proximité (marchand)
src/app/admin/merchants/[id]/EditMerchantForm.tsx  # MODIFY : champ adresse (admin)
```

**Réutilisé (DRY) :** `supabaseAdmin`, `currentMerchantId`, `getChannels` (refresh push, Module 3), `requireAdminApi` (route admin).

---

### Task 1: Migration BDD (créer, NE PAS appliquer)

**Files:** Create `supabase/migrations/20260602_merchant_location.sql`

- [ ] **Step 1: Écrire la migration**
```sql
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE merchants ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
```

- [ ] **Step 2: NE PAS appliquer** — fichier seulement. Application en prod (`oqcelbbozpykwkasjtqy`) par le contrôleur avec consentement utilisateur.

- [ ] **Step 3: Commit**
```bash
git add supabase/migrations/20260602_merchant_location.sql
git commit -m "feat(db): merchant address + latitude/longitude for proximity"
```

---

### Task 2: `geo/geocode.ts` — module géocodage (TDD sur le pur)

**Files:** Create `src/lib/geo/geocode.ts`, Test `src/lib/geo/__tests__/geocode.test.ts`

- [ ] **Step 1: Écrire le test (échoue d'abord)**
```ts
import { describe, it, expect } from "vitest";
import { buildNominatimUrl, parseGeocode, isValidLatLng, proximityText } from "@/lib/geo/geocode";

describe("buildNominatimUrl", () => {
  it("encode l'adresse (espaces/accents)", () => {
    const url = buildNominatimUrl("12 rue de la Paix, Genève");
    expect(url.startsWith("https://nominatim.openstreetmap.org/search?format=json&limit=1&q=")).toBe(true);
    expect(url).toContain("12%20rue%20de%20la%20Paix");
    expect(url).toContain("Gen%C3%A8ve");
  });
});

describe("parseGeocode", () => {
  it("tableau valide -> coords numériques", () => {
    expect(parseGeocode([{ lat: "46.2044", lon: "6.1432" }])).toEqual({ latitude: 46.2044, longitude: 6.1432 });
  });
  it("tableau vide -> null", () => {
    expect(parseGeocode([])).toBeNull();
  });
  it("champs manquants / non numériques -> null", () => {
    expect(parseGeocode([{ lat: "abc", lon: "6.1" }])).toBeNull();
    expect(parseGeocode([{}])).toBeNull();
    expect(parseGeocode("oops")).toBeNull();
  });
});

describe("isValidLatLng", () => {
  it("bornes", () => {
    expect(isValidLatLng(46.2, 6.14)).toBe(true);
    expect(isValidLatLng(90, 180)).toBe(true);
    expect(isValidLatLng(-91, 0)).toBe(false);
    expect(isValidLatLng(0, 181)).toBe(false);
    expect(isValidLatLng(NaN, 0)).toBe(false);
  });
});

describe("proximityText", () => {
  it("contient le nom de la boutique", () => {
    expect(proximityText("Café Lumière")).toContain("Café Lumière");
  });
});
```

- [ ] **Step 2: Vérifier l'échec** — Run: `cd ~/Projects/Carte-Fidelite && npm test -- geocode` → FAIL.

- [ ] **Step 3: Implémenter**
```ts
export function buildNominatimUrl(address: string): string {
  return `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}`;
}

export function parseGeocode(json: unknown): { latitude: number; longitude: number } | null {
  if (!Array.isArray(json) || json.length === 0) return null;
  const first = json[0] as { lat?: unknown; lon?: unknown };
  const latitude = Number(first.lat);
  const longitude = Number(first.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

export function isValidLatLng(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export function proximityText(shopName: string): string {
  return `À deux pas — votre carte ${shopName}`;
}

// Wrapper réseau : géocode une adresse via Nominatim. null en cas d'échec.
export async function geocodeAddress(address: string): Promise<{ latitude: number; longitude: number } | null> {
  try {
    const res = await fetch(buildNominatimUrl(address), {
      headers: { "User-Agent": "CarteFidelite/1.0 (support@walletcard.app)" },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const coords = parseGeocode(json);
    if (!coords || !isValidLatLng(coords.latitude, coords.longitude)) return null;
    return coords;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Vérifier le succès** — Run: `npm test -- geocode` → PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/geo/geocode.ts src/lib/geo/__tests__/geocode.test.ts
git commit -m "feat(geo): nominatim geocoding helpers (pure + fetch)"
```

---

### Task 3: `applyMerchantLocation` (helper serveur)

**Files:** Create `src/lib/geo/applyLocation.ts`

> Pas de test unitaire (DB + réseau). Vérifié par build + fumée.

- [ ] **Step 1: Implémenter**
```ts
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { geocodeAddress, isValidLatLng } from "./geocode";

export type ApplyLocationInput = { address?: string; latitude?: number; longitude?: number };
export type ApplyLocationResult = { located: boolean; latitude: number | null; longitude: number | null };

// Résout les coordonnées (manuelles valides prioritaires, sinon géocodage de l'adresse),
// persiste address/latitude/longitude, puis rafraîchit les pass existants (best-effort).
export async function applyMerchantLocation(merchantId: string, input: ApplyLocationInput): Promise<ApplyLocationResult> {
  let latitude: number | null = null;
  let longitude: number | null = null;

  if (typeof input.latitude === "number" && typeof input.longitude === "number" && isValidLatLng(input.latitude, input.longitude)) {
    latitude = input.latitude;
    longitude = input.longitude;
  } else if (input.address && input.address.trim()) {
    const coords = await geocodeAddress(input.address.trim());
    if (coords) { latitude = coords.latitude; longitude = coords.longitude; }
  }

  await supabaseAdmin
    .from("merchants")
    .update({ address: input.address?.trim() ?? null, latitude, longitude })
    .eq("id", merchantId);

  if (latitude != null && longitude != null) {
    try {
      const { data: cards } = await supabaseAdmin.from("loyalty_cards").select("id").eq("merchant_id", merchantId);
      const cardIds = (cards ?? []).map((c) => c.id as string);
      if (cardIds.length) {
        const { getChannels } = await import("@/lib/wallet/channel");
        for (const ch of getChannels()) await ch.notify(cardIds);
      }
    } catch (e) {
      console.error("[location] refresh push failed:", e);
    }
  }

  return { located: latitude != null && longitude != null, latitude, longitude };
}
```

- [ ] **Step 2: Build** — Run: `npm run build` → « Compiled successfully ».

- [ ] **Step 3: Commit**
```bash
git add src/lib/geo/applyLocation.ts
git commit -m "feat(geo): apply merchant location (geocode, persist, refresh passes)"
```

---

### Task 4: Route marchand self-service `POST /api/merchant/location`

**Files:** Create `src/app/api/merchant/location/route.ts`

- [ ] **Step 1: Implémenter**
```ts
import { NextResponse, type NextRequest } from "next/server";
import { currentMerchantId } from "@/lib/analytics/merchant";
import { applyMerchantLocation } from "@/lib/geo/applyLocation";
import { isValidLatLng } from "@/lib/geo/geocode";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const merchantId = await currentMerchantId();
  if (!merchantId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { address, latitude, longitude } = await req.json().catch(() => ({}));
  if (typeof address !== "string" || address.trim().length < 5 || address.trim().length > 200)
    return NextResponse.json({ error: "Adresse invalide (5 à 200 caractères)." }, { status: 400 });
  if (latitude !== undefined && longitude !== undefined && !isValidLatLng(Number(latitude), Number(longitude)))
    return NextResponse.json({ error: "Coordonnées invalides." }, { status: 400 });

  const result = await applyMerchantLocation(merchantId, {
    address,
    latitude: latitude !== undefined ? Number(latitude) : undefined,
    longitude: longitude !== undefined ? Number(longitude) : undefined,
  });
  return NextResponse.json(result);
}
```

- [ ] **Step 2: Build** — Run: `npm run build` → OK (route `/api/merchant/location` listée).

- [ ] **Step 3: Commit**
```bash
git add src/app/api/merchant/location/route.ts
git commit -m "feat(api): merchant self-service location endpoint"
```

---

### Task 5: Route admin — accepter l'adresse

**Files:** Modify `src/app/api/admin/merchants/[id]/route.ts`

- [ ] **Step 1: Ajouter le traitement de l'adresse**

Dans `src/app/api/admin/merchants/[id]/route.ts`, **juste avant** le bloc `if (Object.keys(update).length === 0)`, insérer :
```ts
    // Adresse / position (géocodée) — traitée à part via le helper partagé.
    if (typeof body.address === "string" && body.address.trim()) {
      const { applyMerchantLocation } = await import("@/lib/geo/applyLocation");
      await applyMerchantLocation(id, {
        address: body.address,
        latitude: typeof body.latitude === "number" ? body.latitude : undefined,
        longitude: typeof body.longitude === "number" ? body.longitude : undefined,
      });
    }
```
*(Note : `applyMerchantLocation` fait sa propre écriture `merchants` pour address/lat/lng ; le reste de la route gère shop_name + config. Si seule l'adresse est fournie, le `update` peut rester vide — c'est volontaire, on retourne quand même `ok`.)*

Puis remplacer le bloc :
```ts
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Aucune modification fournie" }, { status: 400 });
    }
```
par :
```ts
    const addressOnly = typeof body.address === "string" && body.address.trim().length > 0;
    if (Object.keys(update).length === 0 && !addressOnly) {
      return NextResponse.json({ error: "Aucune modification fournie" }, { status: 400 });
    }
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ ok: true });
    }
```

- [ ] **Step 2: Build** — Run: `npm run build` → OK.

- [ ] **Step 3: Commit**
```bash
git add "src/app/api/admin/merchants/[id]/route.ts"
git commit -m "feat(admin-api): set merchant address (geocoded) via shared helper"
```

---

### Task 6: Pass Apple — champ `locations` (TDD)

**Files:** Modify `src/lib/wallet/passJson.ts`, `src/lib/wallet/__tests__/passJson.test.ts`

- [ ] **Step 1: Ajouter le test (échoue d'abord)**

Ajouter à la fin de `src/lib/wallet/__tests__/passJson.test.ts` (sans ré-importer `buildPassJson`/`vitest`, déjà importés en tête) :
```ts
describe("buildPassJson — locations (proximité)", () => {
  const base = {
    cardId: "c", customerName: "A", stamps: 3, stampGoal: 10, orgName: "Café",
    backgroundColor: "rgb(0,0,0)", passTypeIdentifier: "pass.x", teamIdentifier: "T", barcodeMessage: "sig",
  };
  it("locations fournies -> champ top-level locations", () => {
    const p = buildPassJson({ ...base, locations: [{ latitude: 46.2, longitude: 6.14, relevantText: "près" }] });
    expect((p as { locations?: unknown[] }).locations).toEqual([{ latitude: 46.2, longitude: 6.14, relevantText: "près" }]);
  });
  it("sans locations -> pas de champ locations", () => {
    const p = buildPassJson(base);
    expect((p as { locations?: unknown[] }).locations).toBeUndefined();
  });
});
```

- [ ] **Step 2: Vérifier l'échec** — Run: `npm test -- passJson` → le nouveau bloc FAIL.

- [ ] **Step 3: Modifier `passJson.ts`** — (1) ajouter à l'interface `PassJsonInput` (après `message?: string;`) :
```ts
  locations?: { latitude: number; longitude: number; relevantText: string }[];
```
(2) juste avant `return pass;`, ajouter :
```ts
  if (i.locations && i.locations.length > 0) {
    pass.locations = i.locations;
  }
```

- [ ] **Step 4: Vérifier le succès** — Run: `npm test -- passJson` → PASS.

- [ ] **Step 5: Commit**
```bash
git add src/lib/wallet/passJson.ts src/lib/wallet/__tests__/passJson.test.ts
git commit -m "feat(wallet): optional pass locations (Apple proximity)"
```

---

### Task 7: Pass Apple — charger les coords du marchand

**Files:** Modify `src/lib/applePass.ts`

> Fichier `@ts-nocheck`.

- [ ] **Step 1: Étendre la requête marchand + construire `locations`**

Dans `src/lib/applePass.ts`, dans `buildApplePassBuffer`, remplacer la requête qui sélectionne `stamp_goal` :
```ts
    const { data: mRow } = await supabaseAdmin
      .from("merchants")
      .select("stamp_goal")
      .eq("id", cardRow.merchant_id)
      .single();
    stampGoal = mRow?.stamp_goal ?? 10;
```
par :
```ts
    const { data: mRow } = await supabaseAdmin
      .from("merchants")
      .select("stamp_goal, latitude, longitude")
      .eq("id", cardRow.merchant_id)
      .single();
    stampGoal = mRow?.stamp_goal ?? 10;
    if (mRow?.latitude != null && mRow?.longitude != null) {
      const { proximityText } = await import("@/lib/geo/geocode");
      locations = [{ latitude: mRow.latitude, longitude: mRow.longitude, relevantText: proximityText(orgName) }];
    }
```
Et déclarer `locations` avant le `if (cardRow?.merchant_id) {` (au même niveau que `let stampGoal = 10;`) :
```ts
  let locations;
```
Enfin, dans l'objet passé à `buildPassJson({ ... })`, ajouter le champ `locations,` (à côté de `stampGoal,`).

- [ ] **Step 2: Build** — Run: `npm run build` → OK.

- [ ] **Step 3: Commit**
```bash
git add src/lib/applePass.ts
git commit -m "feat(wallet): Apple pass embeds merchant location when set"
```

---

### Task 8: Pass Google — champ `locations`

**Files:** Modify `src/lib/googlePass.ts`

- [ ] **Step 1: Charger les coords + ajouter `locations` à l'objet fidélité**

Dans `src/lib/googlePass.ts`, dans `buildGoogleSaveUrl`, juste **avant** `const loyaltyObject = {`, ajouter :
```ts
  const { supabaseAdmin } = await import("@/lib/supabaseAdmin");
  let geoLocations: { latitude: number; longitude: number }[] | undefined;
  const { data: cardRow } = await supabaseAdmin
    .from("loyalty_cards").select("merchant_id").eq("id", cardId).single();
  if (cardRow?.merchant_id) {
    const { data: mRow } = await supabaseAdmin
      .from("merchants").select("latitude, longitude").eq("id", cardRow.merchant_id).single();
    if (mRow?.latitude != null && mRow?.longitude != null) {
      geoLocations = [{ latitude: mRow.latitude as number, longitude: mRow.longitude as number }];
    }
  }
```
Puis, dans l'objet `loyaltyObject`, ajouter après la ligne `barcode: { ... },` :
```ts
    ...(geoLocations ? { locations: geoLocations } : {}),
```

- [ ] **Step 2: Build** — Run: `npm run build` → OK.

- [ ] **Step 3: Commit**
```bash
git add src/lib/googlePass.ts
git commit -m "feat(wallet): Google pass embeds merchant location when set"
```

---

### Task 9: UI marchand — section « Adresse & proximité »

**Files:** Modify `src/app/dashboard/settings/page.tsx`

- [ ] **Step 1: Ajouter l'état + le handler + la section**

Lire le fichier courant. C'est un composant client (`"use client"`) qui charge le marchand dans `fetchMerchant`. Appliquer :

1. Dans `fetchMerchant`, après `setLogoUrl(...)`, ajouter : `setAddress(data.address || "");`
2. Ajouter les états (à côté de `logoUrl`) :
```tsx
  const [address, setAddress] = useState("");
  const [savingAddr, setSavingAddr] = useState(false);
  const [addrMsg, setAddrMsg] = useState("");
```
3. Ajouter le handler (à côté de `handleSave`) :
```tsx
  const saveAddress = async () => {
    setSavingAddr(true); setAddrMsg("");
    try {
      const res = await fetch("/api/merchant/location", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const json = await res.json();
      if (!res.ok) { setAddrMsg(json.error || "Erreur."); return; }
      setAddrMsg(json.located ? "Position trouvée ✓ — vos clients seront alertés à proximité." : "Adresse enregistrée, mais non localisée. Vérifiez l'adresse.");
    } catch {
      setAddrMsg("Erreur de connexion.");
    } finally { setSavingAddr(false); }
  };
```
4. Ajouter cette section dans le rendu, après le bloc du formulaire branding (dans la colonne `lg:col-span-2`) :
```tsx
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-6 space-y-4">
          <h2 className="font-bold flex items-center gap-2"><Store className="w-4 h-4" /> Adresse & proximité</h2>
          <p className="text-sm text-zinc-500">Vos clients verront leur carte sur leur écran verrouillé quand ils passent près de votre boutique (≈100 m).</p>
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="12 rue de la Paix, Genève"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3 px-4 text-sm outline-none focus:border-emerald-500" />
          <button type="button" onClick={saveAddress} disabled={savingAddr || address.trim().length < 5}
            className="bg-emerald-500 text-black rounded-xl px-5 py-2.5 font-bold disabled:opacity-50">
            {savingAddr ? "Enregistrement…" : "Enregistrer l'adresse"}
          </button>
          {addrMsg && <p className="text-sm text-zinc-300">{addrMsg}</p>}
        </div>
```

- [ ] **Step 2: Build + fumée** — Run: `npm run build` → OK. Puis (compte démo marchand) Paramètres → saisir une adresse réelle → « Position trouvée ✓ ».

- [ ] **Step 3: Commit**
```bash
git add src/app/dashboard/settings/page.tsx
git commit -m "feat(settings): merchant address & proximity (self-service)"
```

---

### Task 10: UI admin — champ adresse

**Files:** Modify `src/app/admin/merchants/[id]/EditMerchantForm.tsx`

- [ ] **Step 1: Ajouter le champ adresse**

Lire le fichier courant (il contient déjà la section « Programme & segmentation » du sous-projet 1). Appliquer :

1. Étendre l'interface `Props.merchant` avec `address: string | null;`
2. Ajouter l'état : `const [address, setAddress] = useState(merchant.address || "");`
3. Inclure `address` dans le corps du `PATCH` (dans `JSON.stringify({ ... })`) : ajouter `address,`
4. Ajouter, après la section « Programme & segmentation », un champ :
```tsx
      <h2 className="font-bold pt-2 border-t border-zinc-800">Adresse (proximité)</h2>
      <input value={address} onChange={(e) => setAddress(e.target.value)}
        placeholder="12 rue de la Paix, Genève"
        className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-3 px-4 focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 outline-none transition-all" />
```

Puis, dans `src/app/admin/merchants/[id]/page.tsx`, étendre le `select` pour inclure `address` et passer `address: m.address` dans le prop `merchant={{ ... }}`.

- [ ] **Step 2: Build** — Run: `npm run build` → OK.

- [ ] **Step 3: Commit**
```bash
git add src/app/admin/merchants/
git commit -m "feat(admin-ui): edit merchant address for proximity"
```

---

### Task 11: Vérification finale

- [ ] **Step 1: Tests** — Run: `npm test` → tous PASS (dont `geocode` + le nouveau bloc `passJson`).
- [ ] **Step 2: Build** — Run: `npm run build` → « Compiled successfully », routes `/api/merchant/location`, `/api/admin/merchants/[id]`, `/dashboard/settings` présentes.
- [ ] **Step 3: Lint** — Run: `npx eslint src/lib/geo src/lib/wallet "src/app/api/merchant/location" "src/app/api/admin/merchants/[id]" src/app/dashboard/settings "src/app/admin/merchants/[id]"` → 0 erreur.
- [ ] **Step 4: Fumée (après migration appliquée par le contrôleur)** — Compte démo : (marchand) Paramètres → adresse → « Position trouvée ✓ » ; régénérer un pass Apple → le `pass.json` contient `locations`. (admin) `/admin/merchants/[id]` → adresse enregistrée.

---

## Notes de réalisation

- **TDD** sur le pur (`buildNominatimUrl`, `parseGeocode`, `isValidLatLng`, `proximityText`, `buildPassJson` locations). Helper serveur, routes, pass et UI vérifiés par build + fumée.
- **Migration** : créée mais appliquée en prod par le contrôleur avec consentement.
- **Rétro-compatibilité** : sans coords (`null`) → aucun `locations` sur le pass → comportement inchangé.
- **DRY** : `applyMerchantLocation` partagé entre route marchand et route admin ; `proximityText`/géocodage centralisés dans `geo`. Le refresh réutilise le canal push (Module 3).
- **Géocodage serveur** : Nominatim appelé côté serveur (User-Agent propre), uniquement à l'enregistrement de l'adresse.
- **Réalité OS** : rayon ~100 m contrôlé par iOS/Android ; pas de `maxDistance` fixé.
- **Hors périmètre** : iBeacon (premium), carte interactive, relevantText personnalisable, multi-positions.
```
