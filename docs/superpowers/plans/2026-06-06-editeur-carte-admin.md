# Éditeur de carte commerçant (A0 + A1) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à l'admin de concevoir la carte d'un commerçant (couleurs, logo, champs, QR) avec aperçu live Apple + Google, et appliquer le design (nouveaux `.pkpass` Apple ; création/PATCH de la `LoyaltyClass` Google).

**Architecture:** Un modèle de design unifié (`CardDesign`) persisté dans `card_designs`, traduit par une couche de mapping pure vers Apple PassKit (storeCard) et Google Wallet (LoyaltyClass/Object). Les images sont redimensionnées côté serveur (`sharp`) aux dimensions officielles et stockées dans Supabase Storage. L'UI admin pilote des aperçus HTML/CSS répliquant les deux wallets.

**Tech Stack:** Next.js 16 (App Router, route handlers), React 19, TypeScript, Supabase (Postgres + Storage + RLS), `passkit-generator`, `googleapis`, `sharp`, `@dnd-kit`, `react-colorful`, `react-image-crop`, vitest.

**Spec de référence:** `docs/superpowers/specs/2026-06-06-editeur-carte-admin-design.md`

**Branche:** `feat/admin-card-editor` (déjà créée depuis `feat/public-enrollment`).

**⚠️ Avant de coder (règle AGENTS.md):** lire `node_modules/next/dist/docs/` pour les conventions Next 16 custom (route handlers, runtime). Lire les fichiers existants cités avant de les modifier : `src/lib/applePass.ts`, `src/lib/wallet/passJson.ts`, `src/lib/googlePass.ts`, `src/lib/adminAuth.ts`, `src/app/admin/merchants/[id]/page.tsx`.

---

## Carte des fichiers

**Créés :**
- `supabase/migrations/20260606_card_designs.sql` — table, RLS, trigger, bucket Storage.
- `src/lib/cardDesign/types.ts` — type `CardDesign` et constantes de limites.
- `src/lib/cardDesign/color.ts` — hex→rgb, ratio de contraste.
- `src/lib/cardDesign/mapApple.ts` — `CardDesign` → champs pass.json Apple.
- `src/lib/cardDesign/mapGoogle.ts` — `CardDesign` → champs LoyaltyClass/Object.
- `src/lib/cardDesign/validation.ts` — erreurs bloquantes + avertissements.
- `src/lib/cardDesign/imageSizes.ts` — dimensions officielles + `resizeLogo` (sharp).
- `src/lib/cardDesign/storage.ts` — chemins Storage + upload/download (service-role).
- `src/lib/cardDesign/repository.ts` — load/save `card_designs`.
- `src/lib/wallet/googleClass.ts` — `ensureLoyaltyClass` (GET + insert/PATCH).
- `src/app/api/admin/merchants/[id]/card-design/route.ts` — GET/PUT.
- `src/app/api/admin/merchants/[id]/card-design/logo/route.ts` — upload + resize.
- `src/app/admin/merchants/[id]/card/page.tsx` — page éditeur.
- `src/app/admin/merchants/[id]/card/CardEditor.tsx` — composant client (état).
- `src/app/admin/merchants/[id]/card/ColorField.tsx`, `LogoUpload.tsx`, `FieldList.tsx`, `BarcodeField.tsx`.
- `src/app/admin/merchants/[id]/card/ApplePassPreview.tsx`, `GooglePassPreview.tsx`.
- Tests : `src/lib/cardDesign/__tests__/{color,mapApple,mapGoogle,validation,imageSizes}.test.ts`.

**Modifiés :**
- `package.json` — dépendances.
- `src/lib/wallet/passJson.ts` — accepter un `CardDesign` et utiliser `mapApple`.
- `src/lib/applePass.ts` — charger le design + insérer le logo du commerçant dans le `.pkpass`.
- `src/lib/googlePass.ts` — utiliser la classe par commerçant (`merchant_<id>`).
- `src/app/admin/merchants/[id]/page.tsx` — lien « Design de la carte ».

---

## Task 1 : Dépendances

**Files:** Modify: `package.json`

- [ ] **Step 1: Installer les dépendances**

```bash
cd ~/Projects/HALO/app
npm install sharp @dnd-kit/core @dnd-kit/sortable react-colorful react-image-crop
```

- [ ] **Step 2: Vérifier l'installation**

Run: `node -e "require('sharp'); console.log('sharp ok')"`
Expected: `sharp ok`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: deps éditeur de carte (sharp, dnd-kit, react-colorful, react-image-crop)"
```
> Note : si `package-lock.json` contient des modifs antérieures non liées (autre terminal), faire `git add -p` pour ne committer que les lignes des nouvelles deps.

---

## Task 2 : Migration `card_designs` + Storage + RLS

**Files:** Create: `supabase/migrations/20260606_card_designs.sql`

- [ ] **Step 1: Écrire la migration**

```sql
-- Table des designs de carte (1 design actif par commerçant ; versioning = A3)
create table if not exists public.card_designs (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null unique references public.merchants(id) on delete cascade,
  background_color text not null default '#0D6B5E',
  foreground_color text not null default '#FFFFFF',
  label_color text not null default '#BFEEE6',
  program_name text not null default 'Carte de fidélité',
  logo_original_path text,
  logo_assets jsonb not null default '{}'::jsonb,
  fields jsonb not null default '[]'::jsonb,
  barcode jsonb not null default '{"type":"QR","source":"card_token"}'::jsonb,
  google_class_id text,
  google_class_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create index if not exists card_designs_merchant_idx on public.card_designs(merchant_id);

-- updated_at auto
create or replace function public.touch_card_designs_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_card_designs_updated_at on public.card_designs;
create trigger trg_card_designs_updated_at
  before update on public.card_designs
  for each row execute function public.touch_card_designs_updated_at();

-- RLS : lecture admin OU propriétaire ; écriture admin only
alter table public.card_designs enable row level security;

drop policy if exists card_designs_select on public.card_designs;
create policy card_designs_select on public.card_designs for select
  using (
    public.is_admin()
    or merchant_id in (select id from public.merchants where user_id = auth.uid())
  );

drop policy if exists card_designs_write on public.card_designs;
create policy card_designs_write on public.card_designs for all
  using (public.is_admin())
  with check (public.is_admin());

-- Storage : bucket privé pour les images de carte
insert into storage.buckets (id, name, public)
values ('card-assets', 'card-assets', false)
on conflict (id) do nothing;

drop policy if exists card_assets_admin_all on storage.objects;
create policy card_assets_admin_all on storage.objects for all
  using (bucket_id = 'card-assets' and public.is_admin())
  with check (bucket_id = 'card-assets' and public.is_admin());
```

- [ ] **Step 2: Appliquer la migration**

Via l'outil Supabase MCP `apply_migration` (name: `card_designs`) **ou** `supabase db push` si CLI locale configurée. Vérifier ensuite avec `list_tables` que `card_designs` existe et que RLS est activée.

- [ ] **Step 3: Vérifier la fonction `is_admin()` existe**

Run (SQL): `select proname from pg_proc where proname = 'is_admin';`
Expected: une ligne `is_admin` (définie dans `20240527_roles_and_enrollment.sql`).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260606_card_designs.sql
git commit -m "feat(db): table card_designs + bucket Storage + RLS"
```

---

## Task 3 : Type `CardDesign` et limites

**Files:** Create: `src/lib/cardDesign/types.ts`

- [ ] **Step 1: Écrire le type et les limites**

```ts
export type CardZone = 'header' | 'primary' | 'secondary' | 'auxiliary' | 'back';

export type CardField = {
  id: string;
  zone: CardZone;
  label: string;
  value: string; // peut contenir des jetons : {nom}, {points}, {palier}
  order: number;
};

export type LogoAssets = {
  apple?: { x1?: string; x2?: string; x3?: string; icon1?: string; icon2?: string; icon3?: string };
  google?: { logo?: string };
};

export type CardBarcode = { type: 'QR'; source: 'card_token' | 'custom'; value?: string };

export type CardDesign = {
  colors: { background: string; foreground: string; label: string };
  programName: string;
  logo: { originalPath?: string; assets?: LogoAssets };
  fields: CardField[];
  barcode: CardBarcode;
};

// Limites de l'emplacement Apple storeCard (respect des specs).
export const APPLE_ZONE_LIMITS: Record<CardZone, number> = {
  header: 3,
  primary: 1,
  secondary: 4,
  auxiliary: 4,
  back: Infinity,
};

export const DEFAULT_CARD_DESIGN: CardDesign = {
  colors: { background: '#0D6B5E', foreground: '#FFFFFF', label: '#BFEEE6' },
  programName: 'Carte de fidélité',
  logo: {},
  fields: [{ id: 'points', zone: 'primary', label: 'TAMPONS', value: '{points}', order: 0 }],
  barcode: { type: 'QR', source: 'card_token' },
};
```

- [ ] **Step 2: Vérifier la compilation des types**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: aucune erreur sur ce fichier.

- [ ] **Step 3: Commit**

```bash
git add src/lib/cardDesign/types.ts
git commit -m "feat(card): type CardDesign + limites de zones"
```

---

## Task 4 : Utilitaires couleur (hex→rgb, contraste)

**Files:** Create: `src/lib/cardDesign/color.ts` · Test: `src/lib/cardDesign/__tests__/color.test.ts`

- [ ] **Step 1: Écrire le test**

```ts
import { describe, it, expect } from 'vitest';
import { hexToRgbString, contrastRatio } from '../color';

describe('hexToRgbString', () => {
  it('convertit #0D6B5E en rgb', () => {
    expect(hexToRgbString('#0D6B5E')).toBe('rgb(13, 107, 94)');
  });
  it('gère le format court #fff', () => {
    expect(hexToRgbString('#fff')).toBe('rgb(255, 255, 255)');
  });
});

describe('contrastRatio', () => {
  it('blanc sur noir ≈ 21', () => {
    expect(Math.round(contrastRatio('#FFFFFF', '#000000'))).toBe(21);
  });
  it('blanc sur émeraude HALO > 4.5 (AA)', () => {
    expect(contrastRatio('#FFFFFF', '#0D6B5E')).toBeGreaterThan(4.5);
  });
});
```

- [ ] **Step 2: Lancer le test (échec attendu)**

Run: `npx vitest run src/lib/cardDesign/__tests__/color.test.ts`
Expected: FAIL (`Cannot find module '../color'`).

- [ ] **Step 3: Implémenter**

```ts
function parseHex(hex: string): [number, number, number] {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function hexToRgbString(hex: string): string {
  const [r, g, b] = parseHex(hex);
  return `rgb(${r}, ${g}, ${b})`;
}

function relativeLuminance(hex: string): number {
  const channels = parseHex(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
```

- [ ] **Step 4: Lancer le test (succès attendu)**

Run: `npx vitest run src/lib/cardDesign/__tests__/color.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/cardDesign/color.ts src/lib/cardDesign/__tests__/color.test.ts
git commit -m "feat(card): util couleur hex→rgb + contraste WCAG"
```

---

## Task 5 : Mapping → Apple

**Files:** Create: `src/lib/cardDesign/mapApple.ts` · Test: `src/lib/cardDesign/__tests__/mapApple.test.ts`

- [ ] **Step 1: Écrire le test**

```ts
import { describe, it, expect } from 'vitest';
import { mapToAppleFields } from '../mapApple';
import type { CardDesign } from '../types';

const base: CardDesign = {
  colors: { background: '#0D6B5E', foreground: '#FFFFFF', label: '#BFEEE6' },
  programName: 'Café Démo',
  logo: {},
  fields: [
    { id: 'p', zone: 'primary', label: 'TAMPONS', value: '7 / 10', order: 0 },
    { id: 's1', zone: 'secondary', label: 'PALIER', value: 'Argent', order: 1 },
  ],
  barcode: { type: 'QR', source: 'card_token' },
};

describe('mapToAppleFields', () => {
  it('place les champs dans les bons tableaux', () => {
    const r = mapToAppleFields(base);
    expect(r.primaryFields).toEqual([{ key: 'p', label: 'TAMPONS', value: '7 / 10' }]);
    expect(r.secondaryFields).toEqual([{ key: 's1', label: 'PALIER', value: 'Argent' }]);
  });
  it('convertit les couleurs en rgb', () => {
    const r = mapToAppleFields(base);
    expect(r.backgroundColor).toBe('rgb(13, 107, 94)');
    expect(r.foregroundColor).toBe('rgb(255, 255, 255)');
    expect(r.labelColor).toBe('rgb(191, 238, 230)');
  });
  it('déborde vers backFields au-delà des limites de zone', () => {
    const many: CardDesign = {
      ...base,
      fields: Array.from({ length: 6 }, (_, i) => ({ id: `a${i}`, zone: 'auxiliary' as const, label: `L${i}`, value: `V${i}`, order: i })),
    };
    const r = mapToAppleFields(many);
    expect(r.auxiliaryFields).toHaveLength(4);
    expect(r.backFields.length).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 2: Lancer le test (échec attendu)**

Run: `npx vitest run src/lib/cardDesign/__tests__/mapApple.test.ts`
Expected: FAIL (module introuvable).

- [ ] **Step 3: Implémenter**

```ts
import type { CardDesign, CardZone } from './types';
import { APPLE_ZONE_LIMITS } from './types';
import { hexToRgbString } from './color';

type AppleField = { key: string; label: string; value: string };

export type AppleFieldMap = {
  backgroundColor: string;
  foregroundColor: string;
  labelColor: string;
  organizationName: string;
  logoText: string;
  headerFields: AppleField[];
  primaryFields: AppleField[];
  secondaryFields: AppleField[];
  auxiliaryFields: AppleField[];
  backFields: AppleField[];
};

const ZONES: CardZone[] = ['header', 'primary', 'secondary', 'auxiliary', 'back'];

export function mapToAppleFields(design: CardDesign): AppleFieldMap {
  const buckets: Record<CardZone, AppleField[]> = {
    header: [], primary: [], secondary: [], auxiliary: [], back: [],
  };
  const sorted = [...design.fields].sort((a, b) => a.order - b.order);
  for (const f of sorted) {
    const af: AppleField = { key: f.id, label: f.label, value: f.value };
    const limit = APPLE_ZONE_LIMITS[f.zone];
    if (buckets[f.zone].length < limit) buckets[f.zone].push(af);
    else buckets.back.push(af); // débordement → verso
  }
  return {
    backgroundColor: hexToRgbString(design.colors.background),
    foregroundColor: hexToRgbString(design.colors.foreground),
    labelColor: hexToRgbString(design.colors.label),
    organizationName: design.programName,
    logoText: design.programName,
    headerFields: buckets.header,
    primaryFields: buckets.primary,
    secondaryFields: buckets.secondary,
    auxiliaryFields: buckets.auxiliary,
    backFields: buckets.back,
  };
}
void ZONES;
```

- [ ] **Step 4: Lancer le test (succès attendu)**

Run: `npx vitest run src/lib/cardDesign/__tests__/mapApple.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/cardDesign/mapApple.ts src/lib/cardDesign/__tests__/mapApple.test.ts
git commit -m "feat(card): mapping CardDesign → champs Apple (limites de zones)"
```

---

## Task 6 : Mapping → Google

**Files:** Create: `src/lib/cardDesign/mapGoogle.ts` · Test: `src/lib/cardDesign/__tests__/mapGoogle.test.ts`

- [ ] **Step 1: Écrire le test**

```ts
import { describe, it, expect } from 'vitest';
import { mapToGoogleClass, mapToGoogleObjectExtras } from '../mapGoogle';
import type { CardDesign } from '../types';

const base: CardDesign = {
  colors: { background: '#0D6B5E', foreground: '#FFFFFF', label: '#BFEEE6' },
  programName: 'Café Démo',
  logo: { assets: { google: { logo: 'm1/google/logo.png' } } },
  fields: [
    { id: 'p', zone: 'primary', label: 'Tampons', value: '{points}', order: 0 },
    { id: 's1', zone: 'secondary', label: 'Palier', value: 'Argent', order: 1 },
  ],
  barcode: { type: 'QR', source: 'card_token' },
};

describe('mapToGoogleClass', () => {
  it('mappe couleur, nom et modules texte', () => {
    const c = mapToGoogleClass(base, 'https://cdn/m1/google/logo.png');
    expect(c.hexBackgroundColor).toBe('#0D6B5E');
    expect(c.programName).toBe('Café Démo');
    expect(c.programLogo.sourceUri.uri).toBe('https://cdn/m1/google/logo.png');
    expect(c.textModulesData.some((t: any) => t.header === 'Palier')).toBe(true);
  });
});

describe('mapToGoogleObjectExtras', () => {
  it('expose le libellé de points du champ primary', () => {
    expect(mapToGoogleObjectExtras(base).pointsLabel).toBe('Tampons');
  });
});
```

- [ ] **Step 2: Lancer le test (échec attendu)**

Run: `npx vitest run src/lib/cardDesign/__tests__/mapGoogle.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implémenter**

```ts
import type { CardDesign } from './types';

export function mapToGoogleClass(design: CardDesign, logoPublicUrl?: string) {
  const textModulesData = design.fields
    .filter((f) => f.zone !== 'primary')
    .sort((a, b) => a.order - b.order)
    .map((f) => ({ id: f.id, header: f.label, body: f.value }));

  return {
    programName: design.programName,
    hexBackgroundColor: design.colors.background,
    programLogo: {
      sourceUri: { uri: logoPublicUrl ?? '' },
      contentDescription: { defaultValue: { language: 'fr', value: design.programName } },
    },
    textModulesData,
  };
}

export function mapToGoogleObjectExtras(design: CardDesign) {
  const primary = design.fields.find((f) => f.zone === 'primary');
  return { pointsLabel: primary?.label ?? 'Points' };
}
```

- [ ] **Step 4: Lancer le test (succès attendu)**

Run: `npx vitest run src/lib/cardDesign/__tests__/mapGoogle.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/cardDesign/mapGoogle.ts src/lib/cardDesign/__tests__/mapGoogle.test.ts
git commit -m "feat(card): mapping CardDesign → LoyaltyClass Google"
```

---

## Task 7 : Validation

**Files:** Create: `src/lib/cardDesign/validation.ts` · Test: `src/lib/cardDesign/__tests__/validation.test.ts`

- [ ] **Step 1: Écrire le test**

```ts
import { describe, it, expect } from 'vitest';
import { validateDesign } from '../validation';
import { DEFAULT_CARD_DESIGN } from '../types';

describe('validateDesign', () => {
  it('valide le design par défaut sans erreur bloquante', () => {
    const r = validateDesign(DEFAULT_CARD_DESIGN);
    expect(r.errors).toHaveLength(0);
  });
  it('bloque si programName vide', () => {
    const r = validateDesign({ ...DEFAULT_CARD_DESIGN, programName: '  ' });
    expect(r.errors).toContain('Le nom du programme est obligatoire.');
  });
  it('bloque sans champ primary', () => {
    const r = validateDesign({ ...DEFAULT_CARD_DESIGN, fields: [] });
    expect(r.errors.some((e) => e.includes('champ principal'))).toBe(true);
  });
  it('avertit si le contraste est insuffisant', () => {
    const r = validateDesign({
      ...DEFAULT_CARD_DESIGN,
      colors: { background: '#FFFFFF', foreground: '#FFFFFF', label: '#FFFFFF' },
    });
    expect(r.warnings.some((w) => w.includes('contraste'))).toBe(true);
  });
});
```

- [ ] **Step 2: Lancer le test (échec attendu)**

Run: `npx vitest run src/lib/cardDesign/__tests__/validation.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implémenter**

```ts
import type { CardDesign } from './types';
import { contrastRatio } from './color';

export type ValidationResult = { errors: string[]; warnings: string[] };

export function validateDesign(design: CardDesign): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!design.programName || !design.programName.trim()) {
    errors.push('Le nom du programme est obligatoire.');
  }
  if (!design.fields.some((f) => f.zone === 'primary')) {
    errors.push('Il faut au moins un champ principal (primary), ex. les points.');
  }
  if (!design.logo.assets?.apple?.x1 && !design.logo.originalPath) {
    warnings.push('Aucun logo : le pass utilisera un logo par défaut.');
  }
  if (contrastRatio(design.colors.background, design.colors.foreground) < 4.5) {
    warnings.push('Le contraste texte/fond est faible (< 4.5:1, WCAG AA).');
  }
  if (contrastRatio(design.colors.background, design.colors.label) < 4.5) {
    warnings.push('Le contraste des libellés/fond est faible (< 4.5:1).');
  }
  return { errors, warnings };
}
```

- [ ] **Step 4: Lancer le test (succès attendu)**

Run: `npx vitest run src/lib/cardDesign/__tests__/validation.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/cardDesign/validation.ts src/lib/cardDesign/__tests__/validation.test.ts
git commit -m "feat(card): validation (bloquantes + avertissements contraste)"
```

---

## Task 8 : Tailles d'images + redimensionnement

**Files:** Create: `src/lib/cardDesign/imageSizes.ts` · Test: `src/lib/cardDesign/__tests__/imageSizes.test.ts`

> ⚠️ Avant : confirmer la taille d'icône Apple (29/58/87) sur la réf. officielle PassKit. Ajuster `APPLE_ICON` si nécessaire.

- [ ] **Step 1: Écrire le test (sharp mocké)**

```ts
import { describe, it, expect, vi } from 'vitest';

const resizeCalls: Array<{ w: number; h: number }> = [];
vi.mock('sharp', () => {
  const api: any = {
    resize: (opts: any) => { resizeCalls.push({ w: opts.width, h: opts.height }); return api; },
    png: () => api,
    toBuffer: async () => Buffer.from('x'),
  };
  return { default: () => api };
});

import { resizeLogo, APPLE_LOGO, GOOGLE_LOGO } from '../imageSizes';

describe('resizeLogo', () => {
  it('génère toutes les tailles Apple + Google', async () => {
    const out = await resizeLogo(Buffer.from('orig'));
    expect(Object.keys(out)).toEqual(
      expect.arrayContaining(['apple_x1', 'apple_x2', 'apple_x3', 'apple_icon1', 'apple_icon2', 'apple_icon3', 'google_logo'])
    );
    expect(resizeCalls).toContainEqual({ w: APPLE_LOGO.x1.w, h: APPLE_LOGO.x1.h });
    expect(resizeCalls).toContainEqual({ w: GOOGLE_LOGO.w, h: GOOGLE_LOGO.h });
  });
});
```

- [ ] **Step 2: Lancer le test (échec attendu)**

Run: `npx vitest run src/lib/cardDesign/__tests__/imageSizes.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implémenter**

```ts
import sharp from 'sharp';

// Dimensions officielles (px). Icône Apple : confirmer sur la réf. PassKit.
export const APPLE_LOGO = { x1: { w: 160, h: 50 }, x2: { w: 320, h: 100 }, x3: { w: 480, h: 150 } };
export const APPLE_ICON = { x1: { w: 29, h: 29 }, x2: { w: 58, h: 58 }, x3: { w: 87, h: 87 } };
export const GOOGLE_LOGO = { w: 660, h: 660 };

async function fit(input: Buffer, w: number, h: number): Promise<Buffer> {
  return sharp(input)
    .resize({ width: w, height: h, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

export async function resizeLogo(input: Buffer): Promise<Record<string, Buffer>> {
  return {
    apple_x1: await fit(input, APPLE_LOGO.x1.w, APPLE_LOGO.x1.h),
    apple_x2: await fit(input, APPLE_LOGO.x2.w, APPLE_LOGO.x2.h),
    apple_x3: await fit(input, APPLE_LOGO.x3.w, APPLE_LOGO.x3.h),
    apple_icon1: await fit(input, APPLE_ICON.x1.w, APPLE_ICON.x1.h),
    apple_icon2: await fit(input, APPLE_ICON.x2.w, APPLE_ICON.x2.h),
    apple_icon3: await fit(input, APPLE_ICON.x3.w, APPLE_ICON.x3.h),
    google_logo: await fit(input, GOOGLE_LOGO.w, GOOGLE_LOGO.h),
  };
}
```

- [ ] **Step 4: Lancer le test (succès attendu)**

Run: `npx vitest run src/lib/cardDesign/__tests__/imageSizes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cardDesign/imageSizes.ts src/lib/cardDesign/__tests__/imageSizes.test.ts
git commit -m "feat(card): tailles officielles + resize logo (sharp)"
```

---

## Task 9 : Storage helpers

**Files:** Create: `src/lib/cardDesign/storage.ts`

> Lire d'abord comment l'app crée un client Supabase service-role (chercher `SUPABASE_SERVICE_ROLE_KEY` dans `src/lib`). Réutiliser ce helper.

- [ ] **Step 1: Implémenter**

```ts
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'card-assets';

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export function applePath(merchantId: string, name: string) { return `${merchantId}/apple/${name}`; }
export function googlePath(merchantId: string, name: string) { return `${merchantId}/google/${name}`; }

export async function uploadAsset(path: string, body: Buffer, contentType = 'image/png') {
  const sb = serviceClient();
  const { error } = await sb.storage.from(BUCKET).upload(path, body, { contentType, upsert: true });
  if (error) throw new Error(`upload ${path}: ${error.message}`);
  return path;
}

export async function downloadAsset(path: string): Promise<Buffer> {
  const sb = serviceClient();
  const { data, error } = await sb.storage.from(BUCKET).download(path);
  if (error || !data) throw new Error(`download ${path}: ${error?.message}`);
  return Buffer.from(await data.arrayBuffer());
}

export async function signedUrl(path: string, expiresIn = 3600): Promise<string> {
  const sb = serviceClient();
  const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error || !data) throw new Error(`signedUrl ${path}: ${error?.message}`);
  return data.signedUrl;
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: aucune erreur sur ce fichier.

- [ ] **Step 3: Commit**

```bash
git add src/lib/cardDesign/storage.ts
git commit -m "feat(card): helpers Storage (bucket card-assets, service-role)"
```

---

## Task 10 : Repository `card_designs`

**Files:** Create: `src/lib/cardDesign/repository.ts`

> Réutiliser le client serveur Supabase de l'app (chercher `createClient` dans `src/lib/supabase*` — celui à contexte auth pour RLS). Pour l'écriture admin, la RLS exige `is_admin()` ; l'appel se fait depuis une route déjà gardée par `requireAdminApi()`.

- [ ] **Step 1: Implémenter**

```ts
import type { CardDesign } from './types';
import { DEFAULT_CARD_DESIGN } from './types';

type Row = {
  background_color: string; foreground_color: string; label_color: string;
  program_name: string; logo_original_path: string | null; logo_assets: any;
  fields: any; barcode: any; google_class_id: string | null;
};

export function rowToDesign(row: Row): CardDesign {
  return {
    colors: { background: row.background_color, foreground: row.foreground_color, label: row.label_color },
    programName: row.program_name,
    logo: { originalPath: row.logo_original_path ?? undefined, assets: row.logo_assets ?? {} },
    fields: Array.isArray(row.fields) ? row.fields : [],
    barcode: row.barcode ?? DEFAULT_CARD_DESIGN.barcode,
  };
}

export function designToRow(d: CardDesign) {
  return {
    background_color: d.colors.background,
    foreground_color: d.colors.foreground,
    label_color: d.colors.label,
    program_name: d.programName,
    logo_original_path: d.logo.originalPath ?? null,
    logo_assets: d.logo.assets ?? {},
    fields: d.fields,
    barcode: d.barcode,
  };
}

// `supabase` = client serveur avec contexte auth (RLS). `userId` pour updated_by.
export async function loadDesign(supabase: any, merchantId: string): Promise<CardDesign> {
  const { data } = await supabase.from('card_designs').select('*').eq('merchant_id', merchantId).maybeSingle();
  return data ? rowToDesign(data) : DEFAULT_CARD_DESIGN;
}

export async function saveDesign(supabase: any, merchantId: string, userId: string, design: CardDesign) {
  const row = { merchant_id: merchantId, updated_by: userId, ...designToRow(design) };
  const { error } = await supabase.from('card_designs').upsert(row, { onConflict: 'merchant_id' });
  if (error) throw new Error(`saveDesign: ${error.message}`);
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: pas d'erreur.

- [ ] **Step 3: Commit**

```bash
git add src/lib/cardDesign/repository.ts
git commit -m "feat(card): repository card_designs (load/save + conversions)"
```

---

## Task 11 : Classe Google (`ensureLoyaltyClass`)

**Files:** Create: `src/lib/wallet/googleClass.ts`

> Lire `src/lib/googlePass.ts` pour réutiliser l'auth (compte de service via `GOOGLE_CREDENTIALS_JSON`) et `GOOGLE_ISSUER_ID`. Factoriser un helper `getWalletClient()` si utile.

- [ ] **Step 1: Implémenter (GET puis insert ou PATCH — jamais d'update complet)**

```ts
import { google } from 'googleapis';
import type { CardDesign } from '@/lib/cardDesign/types';
import { mapToGoogleClass } from '@/lib/cardDesign/mapGoogle';

function credentials() {
  const raw = process.env.GOOGLE_CREDENTIALS_JSON!;
  return JSON.parse(raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8'));
}

function walletClient() {
  const creds = credentials();
  const auth = new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/wallet_object.issuer'],
  });
  return google.walletobjects({ version: 'v1', auth });
}

export function classIdFor(merchantId: string): string {
  return `${process.env.GOOGLE_ISSUER_ID}.merchant_${merchantId.replace(/-/g, '')}`;
}

// Crée la classe si absente, sinon PATCH fusionné (n'efface aucun champ existant).
export async function ensureLoyaltyClass(merchantId: string, design: CardDesign, logoPublicUrl?: string): Promise<string> {
  const client = walletClient();
  const id = classIdFor(merchantId);
  const patch = mapToGoogleClass(design, logoPublicUrl);

  try {
    await client.loyaltyclass.get({ resourceId: id });
    await client.loyaltyclass.patch({ resourceId: id, requestBody: patch }); // PATCH = merge
  } catch (e: any) {
    if (e?.code === 404 || e?.response?.status === 404) {
      await client.loyaltyclass.insert({
        requestBody: { id, issuerName: design.programName, reviewStatus: 'UNDER_REVIEW', ...patch },
      });
    } else {
      throw e;
    }
  }
  return id;
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: pas d'erreur (vérifier le nom exact des méthodes `loyaltyclass` dans `googleapis` : `get`/`patch`/`insert`).

- [ ] **Step 3: Commit**

```bash
git add src/lib/wallet/googleClass.ts
git commit -m "feat(wallet): ensureLoyaltyClass (GET puis insert/PATCH)"
```

---

## Task 12 : Brancher le générateur Apple sur le design

**Files:** Modify: `src/lib/wallet/passJson.ts`, `src/lib/applePass.ts`

> Lire les deux fichiers d'abord. `buildPassJson` construit aujourd'hui des champs figés ; on lui passe un `CardDesign` optionnel et on remplace les champs par `mapToAppleFields`.

- [ ] **Step 1: Étendre `buildPassJson`**

Ajouter un paramètre `design?: CardDesign` à `PassJsonInput`. Quand il est fourni, utiliser `mapToAppleFields(design)` pour `backgroundColor/foregroundColor/labelColor/organizationName/logoText` et pour `storeCard.{header,primary,secondary,auxiliary,back}Fields`. Résoudre les jetons (`{points}`, `{nom}`, `{palier}`) avec les valeurs réelles du client avant l'appel. Conserver le comportement actuel quand `design` est absent (rétrocompat — pas de régression).

```ts
// extrait : remplacement des champs quand design fourni
import { mapToAppleFields } from '@/lib/cardDesign/mapApple';
// ...
if (input.design) {
  const m = mapToAppleFields(input.design);
  pass.backgroundColor = m.backgroundColor;
  pass.foregroundColor = m.foregroundColor;
  pass.labelColor = m.labelColor;
  pass.organizationName = m.organizationName;
  pass.logoText = m.logoText;
  pass.storeCard = {
    headerFields: m.headerFields,
    primaryFields: m.primaryFields,
    secondaryFields: m.secondaryFields,
    auxiliaryFields: m.auxiliaryFields,
    backFields: m.backFields,
  };
}
```

- [ ] **Step 2: Charger le design + logo dans `applePass.ts`**

Dans `buildApplePassBuffer`, charger le `CardDesign` du commerçant (`loadDesign`), le transmettre à `buildPassJson`, et — si `design.logo.assets.apple` existe — télécharger les logos depuis Storage (`downloadAsset`) et les ajouter au pass à la place des assets de `/public/pass-assets`. Conserver le fallback `/public` quand aucun logo n'est défini.

- [ ] **Step 3: Test de non-régression**

Run: `npx vitest run` puis générer un pass de démo (compte `admin-demo@walletcard.app`) et l'ouvrir sur iPhone : vérifier couleurs/champs/logo.
Expected: tests verts ; pass valide.

- [ ] **Step 4: Commit**

```bash
git add src/lib/wallet/passJson.ts src/lib/applePass.ts
git commit -m "feat(wallet): pass Apple piloté par le CardDesign du commerçant"
```

---

## Task 13 : Brancher le générateur Google sur la classe du commerçant

**Files:** Modify: `src/lib/googlePass.ts`

- [ ] **Step 1: Utiliser `classIdFor(merchantId)`**

Remplacer le `classId` figé (`${issuerId}.ma_classe_fidelite_template`) par `classIdFor(merchant.id)` (import depuis `googleClass.ts`). Le libellé des points provient de `mapToGoogleObjectExtras(design).pointsLabel`. Vérifier que la classe existe (appel `ensureLoyaltyClass` au moins une fois, idéalement à la publication — Task 14 — pas à chaque génération d'objet).

- [ ] **Step 2: Test**

Run: générer un pass Google de démo et l'ajouter sur Android (si publishing access actif) ou en mode démo.
Expected: l'objet référence la classe du commerçant.

- [ ] **Step 3: Commit**

```bash
git add src/lib/googlePass.ts
git commit -m "feat(wallet): objet Google rattaché à la classe par commerçant"
```

---

## Task 14 : API `card-design` (GET/PUT + synchro Google)

**Files:** Create: `src/app/api/admin/merchants/[id]/card-design/route.ts`

> Lire `src/lib/adminAuth.ts` (`requireAdminApi`) et un exemple de route admin existante pour le client Supabase + la signature des handlers Next 16.

- [ ] **Step 1: Implémenter**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/adminAuth';
import { loadDesign, saveDesign } from '@/lib/cardDesign/repository';
import { validateDesign } from '@/lib/cardDesign/validation';
import { ensureLoyaltyClass } from '@/lib/wallet/googleClass';
import { signedUrl } from '@/lib/cardDesign/storage';
// createClient serveur : adapter à l'helper réel de l'app

export const runtime = 'nodejs';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi(); if (guard) return guard;
  const { id } = await params;
  const supabase = await /* createClient() de l'app */ (globalThis as any).noop?.();
  const design = await loadDesign(supabase, id);
  return NextResponse.json({ design });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi(); if (guard) return guard;
  const { id } = await params;
  const { design, userId } = await parseBodyAndUser(req); // récupérer auth.uid()
  const { errors, warnings } = validateDesign(design);
  if (errors.length) return NextResponse.json({ errors }, { status: 422 });

  const supabase = await /* createClient() */ (globalThis as any).noop?.();
  await saveDesign(supabase, id, userId, design);

  let googleClassId: string | null = null;
  try {
    const logoUrl = design.logo.assets?.google?.logo ? await signedUrl(design.logo.assets.google.logo) : undefined;
    googleClassId = await ensureLoyaltyClass(id, design, logoUrl);
    await supabase.from('card_designs').update({ google_class_id: googleClassId, google_class_synced_at: new Date().toISOString() }).eq('merchant_id', id);
  } catch (e) {
    return NextResponse.json({ ok: true, warnings, googleSync: 'failed' }, { status: 207 });
  }
  return NextResponse.json({ ok: true, warnings, googleClassId });
}
```

> Remplacer les `/* createClient() */` par l'helper réel (lu à l'étape de lecture), et implémenter `parseBodyAndUser` (lecture `await req.json()` + `auth.getUser()`). Journaliser via `logAuditEvent` (`CARD_DESIGN_UPDATED`, `CARD_CLASS_SYNCED`).

- [ ] **Step 2: Test manuel**

`curl` GET avec session admin → renvoie le design (ou défaut). PUT avec un design invalide (programName vide) → 422. PUT valide → 200 + `googleClassId`.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/admin/merchants/[id]/card-design/route.ts"
git commit -m "feat(api): GET/PUT card-design + synchro classe Google"
```

---

## Task 15 : API upload logo (resize)

**Files:** Create: `src/app/api/admin/merchants/[id]/card-design/logo/route.ts`

- [ ] **Step 1: Implémenter**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminApi } from '@/lib/adminAuth';
import { resizeLogo } from '@/lib/cardDesign/imageSizes';
import { uploadAsset, applePath, googlePath } from '@/lib/cardDesign/storage';

export const runtime = 'nodejs';
const MAX = 5 * 1024 * 1024;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdminApi(); if (guard) return guard;
  const { id } = await params;
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'fichier manquant' }, { status: 400 });
  if (!['image/png', 'image/jpeg'].includes(file.type)) return NextResponse.json({ error: 'PNG/JPG requis' }, { status: 415 });
  if (file.size > MAX) return NextResponse.json({ error: 'max 5 Mo' }, { status: 413 });

  const buf = Buffer.from(await file.arrayBuffer());
  const out = await resizeLogo(buf);
  const assets = {
    apple: {
      x1: await uploadAsset(applePath(id, 'logo.png'), out.apple_x1),
      x2: await uploadAsset(applePath(id, 'logo@2x.png'), out.apple_x2),
      x3: await uploadAsset(applePath(id, 'logo@3x.png'), out.apple_x3),
      icon1: await uploadAsset(applePath(id, 'icon.png'), out.apple_icon1),
      icon2: await uploadAsset(applePath(id, 'icon@2x.png'), out.apple_icon2),
      icon3: await uploadAsset(applePath(id, 'icon@3x.png'), out.apple_icon3),
    },
    google: { logo: await uploadAsset(googlePath(id, 'logo.png'), out.google_logo) },
  };
  return NextResponse.json({ assets });
}
```

- [ ] **Step 2: Test manuel**

`curl -F file=@logo.png` (session admin) → renvoie `assets` avec 7 chemins ; vérifier la présence dans le bucket.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/admin/merchants/[id]/card-design/logo/route.ts"
git commit -m "feat(api): upload + resize logo vers Storage"
```

---

## Task 16 : Composants de contrôle (ColorField, LogoUpload, FieldList, BarcodeField)

**Files:** Create: `ColorField.tsx`, `LogoUpload.tsx`, `FieldList.tsx`, `BarcodeField.tsx` (dans `src/app/admin/merchants/[id]/card/`)

- [ ] **Step 1: `ColorField.tsx`** (react-colorful + saisie hex)

```tsx
'use client';
import { HexColorPicker } from 'react-colorful';
export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>{label}</label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <HexColorPicker color={value} onChange={onChange} style={{ width: 120, height: 120 }} />
        <input value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: `FieldList.tsx`** (dnd-kit, ajout/suppression/réordonnancement, badge de zone)

Utiliser `@dnd-kit/core` + `@dnd-kit/sortable` (`SortableContext`, `useSortable`, `arrayMove`). Chaque item édite `label`, `value`, `zone` (select des 5 zones) ; bouton supprimer ; bouton « + Ajouter un champ » qui pousse `{ id: crypto.randomUUID(), zone:'secondary', label:'', value:'', order: n }`. `onChange(fields)` remonte l'état trié par `order`.

- [ ] **Step 3: `LogoUpload.tsx`** (drop + crop + POST vers l'API logo)

Zone de dépôt → `react-image-crop` pour recadrer → `FormData` POST vers `…/card-design/logo` → `onUploaded(assets)`.

- [ ] **Step 4: `BarcodeField.tsx`** (type QR fixe + source `card_token`/`custom`).

- [ ] **Step 5: Vérifier compilation**

Run: `npx tsc --noEmit && npm run lint`
Expected: pas d'erreur.

- [ ] **Step 6: Commit**

```bash
git add "src/app/admin/merchants/[id]/card/ColorField.tsx" "src/app/admin/merchants/[id]/card/FieldList.tsx" "src/app/admin/merchants/[id]/card/LogoUpload.tsx" "src/app/admin/merchants/[id]/card/BarcodeField.tsx"
git commit -m "feat(ui): contrôles éditeur (couleurs, champs dnd, logo, code-barres)"
```

---

## Task 17 : Aperçus Apple & Google

**Files:** Create: `ApplePassPreview.tsx`, `GooglePassPreview.tsx`

- [ ] **Step 1: `ApplePassPreview.tsx`**

Composant pur recevant `design: CardDesign` (+ valeurs de démo pour les jetons). Réplique le chrome Apple : fond `colors.background`, texte `colors.foreground`, libellés `colors.label`, en-tête logo+programName, primary mis en avant, secondary/auxiliary, QR. Reproduire fidèlement la maquette validée (`.superpowers/brainstorm/.../editor-ui.html`).

- [ ] **Step 2: `GooglePassPreview.tsx`**

Réplique Google : en-tête `hexBackgroundColor`, logo circulaire, programName, points (libellé du champ primary), QR.

- [ ] **Step 3: Vérifier compilation** — `npx tsc --noEmit`.

- [ ] **Step 4: Commit**

```bash
git add "src/app/admin/merchants/[id]/card/ApplePassPreview.tsx" "src/app/admin/merchants/[id]/card/GooglePassPreview.tsx"
git commit -m "feat(ui): aperçus live Apple & Google"
```

---

## Task 18 : Page éditeur + assemblage + lien

**Files:** Create: `card/page.tsx`, `card/CardEditor.tsx` · Modify: `src/app/admin/merchants/[id]/page.tsx`

- [ ] **Step 1: `page.tsx`** (server) — `requireAdminPage()`, charge le design (`loadDesign`) et passe à `<CardEditor merchantId={id} initial={design} />`.

- [ ] **Step 2: `CardEditor.tsx`** (client) — état `CardDesign`, branche les contrôles (Task 16) et les aperçus (Task 17). Affiche les `warnings` de `validateDesign` en direct. Bouton **Enregistrer & publier** → `PUT …/card-design` ; bloque si `errors`. Responsive : grille 2 colonnes desktop ; sur mobile, aperçu collant en haut + bascule iPhone/Android (état `tab`).

- [ ] **Step 3: Lien depuis la fiche commerçant** — dans `src/app/admin/merchants/[id]/page.tsx`, ajouter un lien/bouton « Design de la carte » vers `./card`.

- [ ] **Step 4: Vérifier** — `npx tsc --noEmit && npm run lint && npm run build`.
Expected: build OK.

- [ ] **Step 5: Commit**

```bash
git add "src/app/admin/merchants/[id]/card/page.tsx" "src/app/admin/merchants/[id]/card/CardEditor.tsx" "src/app/admin/merchants/[id]/page.tsx"
git commit -m "feat(ui): page éditeur de carte + lien depuis la fiche commerçant"
```

---

## Tests manuels (recette)

1. `/admin` → fiche d'un commerçant → « Design de la carte ».
2. Modifier les couleurs → les **deux aperçus** se mettent à jour en direct ; un mauvais contraste affiche un avertissement.
3. Uploader un logo (PNG) → recadrer → il apparaît dans les aperçus ; vérifier dans le bucket `card-assets` les 7 fichiers générés (tailles correctes).
4. Ajouter/supprimer/réordonner des champs par glisser-déposer ; vérifier que le débordement Apple va au verso.
5. Laisser `programName` vide → **Enregistrer & publier** bloqué (422).
6. Publier un design valide → vérifier en base `card_designs` (1 ligne) + `google_class_id` + `google_class_synced_at` renseignés.
7. Générer un pass Apple de démo (compte `admin-demo@walletcard.app`) → ouvrir sur iPhone : couleurs/champs/logo conformes.
8. (Si publishing access Android) ajouter le pass Google → vérifier le rendu de la classe ; re-publier une modif → la carte installée se met à jour.
9. Mobile : aperçu collant + bascule iPhone/Android opérationnels ; contrôles tactiles.
10. RLS : un compte **marchand** (non-admin) ne peut pas PUT le design (403).

## Reste à tester / vérifier après implémentation

- Taille d'icône Apple confirmée sur la réf. officielle.
- `sharp` opérationnel sur l'environnement de déploiement (runtime nodejs).
- Noms exacts des méthodes `googleapis` `loyaltyclass` (`get`/`patch`/`insert`) selon la version installée.
- Limite Apple : un changement de design ne se re-pousse pas sur les pass déjà installés (valeurs uniquement).

---

## Auto-revue (writing-plans)

**Couverture spec :** §5 données → T2 ; §6 modèle → T3 ; §7 mapping → T5/T6 ; §8 images → T8/T15 ; §9 UI → T16/T17/T18 ; §10 aperçus → T17 ; §11 publication → T11/T13/T14 ; §12 validation → T7 ; §13 sécurité → T2(RLS)/T14/T15 ; §15 tests → T4-T8 ; §16 fichiers/deps → T1 + tous. Couvert.

**Placeholders :** les `/* createClient() */` de T14 sont explicitement signalés comme « à remplacer par l'helper réel après lecture » (dépend d'un fichier existant non lu) — ce n'est pas un TODO masqué mais une instruction de lecture ciblée. Les composants Ui denses (FieldList/LogoUpload/CardEditor) sont décrits avec leurs entrées/sorties précises plutôt que codés intégralement, car ils dépendent des conventions de composants existantes à suivre.

**Cohérence des types :** `CardDesign`, `CardField`, `LogoAssets`, `AppleFieldMap`, `mapToAppleFields`, `mapToGoogleClass`, `validateDesign`, `resizeLogo`, `loadDesign`/`saveDesign`, `ensureLoyaltyClass`, `classIdFor` — noms cohérents entre tâches.
