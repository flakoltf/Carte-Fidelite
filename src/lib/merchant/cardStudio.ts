// Studio de design marchand (Agent A) — logique pure : parsing/sanitisation
// d'un CardDesign non fiable (corps de requête), étanchéité des chemins
// d'assets au tenant, et mapping des colonnes studio (brouillon / publication).
// Testé sans réseau dans __tests__/cardStudio.test.ts.

import type {
  CardBarcode,
  CardDesign,
  CardField,
  CardTypeKey,
  CardZone,
  LogoAssets,
  StampsConfig,
  StampShape,
} from '@/lib/cardDesign/types';
import {
  BARCODE_FORMATS,
  CARD_TYPES,
  DEFAULT_CARD_DESIGN,
  STAMP_SHAPES,
} from '@/lib/cardDesign/types';
import { designToRow } from '@/lib/cardDesign/repository';

// ─── Bornes structurelles (anti-abus : le design est stocké tel quel en jsonb) ──

const MAX_FIELDS = 24;
const MAX_TEXT = 120;
const MAX_BACK_TEXT = 800;
const MAX_BARCODE_VALUE = 512;
const MAX_PATH = 300;

const ZONES: readonly CardZone[] = ['header', 'primary', 'secondary', 'auxiliary', 'back'];
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function str(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.length <= max ? value : null;
}

function clampStr(value: unknown, max: number, fallback = ''): string {
  return typeof value === 'string' ? value.slice(0, max) : fallback;
}

function hex(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX_RE.test(value.trim()) ? value.trim().toUpperCase() : fallback;
}

function assetPath(value: unknown): string | undefined {
  const s = str(value, MAX_PATH);
  // Chemins Storage relatifs uniquement — pas d'URL, pas de traversée.
  if (!s || s.includes('..') || s.startsWith('/') || s.includes('://')) return undefined;
  return s;
}

// ─── Parsing d'un CardDesign non fiable ───────────────────────────────────────

function parseFields(input: unknown): CardField[] {
  if (!Array.isArray(input)) return [];
  const fields: CardField[] = [];
  for (const raw of input.slice(0, MAX_FIELDS)) {
    if (typeof raw !== 'object' || raw === null) continue;
    const r = raw as Record<string, unknown>;
    const zone = ZONES.includes(r.zone as CardZone) ? (r.zone as CardZone) : 'secondary';
    fields.push({
      id: clampStr(r.id, 64) || `f-${fields.length}`,
      zone,
      label: clampStr(r.label, MAX_TEXT),
      value: clampStr(r.value, zone === 'back' ? MAX_BACK_TEXT : MAX_TEXT),
      order: typeof r.order === 'number' && Number.isFinite(r.order) ? r.order : fields.length,
    });
  }
  // Ordre normalisé : tri par ordre fourni puis ré-indexation séquentielle.
  return fields.sort((a, b) => a.order - b.order).map((f, i) => ({ ...f, order: i }));
}

function parseAssets(input: unknown): LogoAssets {
  if (typeof input !== 'object' || input === null) return {};
  const r = input as { apple?: Record<string, unknown>; google?: Record<string, unknown> };
  const apple: NonNullable<LogoAssets['apple']> = {};
  const google: NonNullable<LogoAssets['google']> = {};
  for (const key of ['x1', 'x2', 'x3', 'icon1', 'icon2', 'icon3', 'strip1', 'strip2', 'strip3'] as const) {
    const p = assetPath(r.apple?.[key]);
    if (p) apple[key] = p;
  }
  for (const key of ['logo', 'hero'] as const) {
    const p = assetPath(r.google?.[key]);
    if (p) google[key] = p;
  }
  return {
    ...(Object.keys(apple).length ? { apple } : {}),
    ...(Object.keys(google).length ? { google } : {}),
  };
}

function parseBarcode(input: unknown): CardBarcode {
  const fallback = DEFAULT_CARD_DESIGN.barcode;
  if (typeof input !== 'object' || input === null) return { ...fallback };
  const r = input as Record<string, unknown>;
  const type = BARCODE_FORMATS.includes(r.type as CardBarcode['type'])
    ? (r.type as CardBarcode['type'])
    : fallback.type;
  const source = r.source === 'custom' ? 'custom' : 'card_token';
  const value = str(r.value, MAX_BARCODE_VALUE) ?? undefined;
  const altText = str(r.altText, 100) ?? undefined;
  return { type, source, ...(value ? { value } : {}), ...(altText ? { altText } : {}) };
}

function parseStamps(input: unknown): StampsConfig | undefined {
  if (typeof input !== 'object' || input === null) return undefined;
  const r = input as Record<string, unknown>;
  const goal = typeof r.goal === 'number' && Number.isFinite(r.goal) ? Math.round(r.goal) : 10;
  const shape = STAMP_SHAPES.includes(r.shape as StampShape) ? (r.shape as StampShape) : 'circle';
  const filledAssetPath = assetPath(r.filledAssetPath);
  const emptyAssetPath = assetPath(r.emptyAssetPath);
  return {
    goal,
    icon: clampStr(r.icon, 16, '⭐'),
    shape,
    ...(filledAssetPath ? { filledAssetPath } : {}),
    ...(emptyAssetPath ? { emptyAssetPath } : {}),
  };
}

/**
 * Reconstruit un CardDesign propre depuis un corps de requête non fiable.
 * Retourne null si la structure de base est inexploitable. Aucune clé inconnue
 * ne survit (le design est persisté en jsonb et resservi tel quel).
 */
export function parseCardDesign(input: unknown): CardDesign | null {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return null;
  const r = input as Record<string, unknown>;
  const colors = (typeof r.colors === 'object' && r.colors !== null ? r.colors : {}) as Record<string, unknown>;
  const logo = (typeof r.logo === 'object' && r.logo !== null ? r.logo : {}) as Record<string, unknown>;
  const cardType = CARD_TYPES.includes(r.cardType as CardTypeKey) ? (r.cardType as CardTypeKey) : 'stamps';
  const stamps = parseStamps(r.stamps);
  const originalPath = assetPath(logo.originalPath);

  return {
    colors: {
      background: hex(colors.background, DEFAULT_CARD_DESIGN.colors.background),
      foreground: hex(colors.foreground, DEFAULT_CARD_DESIGN.colors.foreground),
      label: hex(colors.label, DEFAULT_CARD_DESIGN.colors.label),
    },
    programName: clampStr(r.programName, 60).trim(),
    logo: {
      ...(originalPath ? { originalPath } : {}),
      assets: parseAssets(logo.assets),
    },
    fields: parseFields(r.fields),
    barcode: parseBarcode(r.barcode),
    cardType,
    ...(cardType === 'stamps' ? { stamps: stamps ?? { goal: 10, icon: '⭐', shape: 'circle' } } : stamps ? { stamps } : {}),
  };
}

// ─── Étanchéité tenant des chemins d'assets ───────────────────────────────────

function scopedPath(path: string | undefined, merchantId: string): string | undefined {
  return path && path.startsWith(`${merchantId}/`) ? path : undefined;
}

/**
 * Supprime tout chemin d'asset qui n'appartient pas au marchand courant —
 * un design ne peut référencer que des fichiers de SON préfixe Storage.
 * (Sans cela, un marchand pourrait faire signer des URLs d'un autre tenant.)
 */
export function enforceAssetOwnership(design: CardDesign, merchantId: string): CardDesign {
  const apple = design.logo.assets?.apple ?? {};
  const google = design.logo.assets?.google ?? {};
  const cleanApple = Object.fromEntries(
    Object.entries(apple).map(([k, v]) => [k, scopedPath(v, merchantId)]).filter(([, v]) => v)
  ) as NonNullable<LogoAssets['apple']>;
  const cleanGoogle = Object.fromEntries(
    Object.entries(google).map(([k, v]) => [k, scopedPath(v, merchantId)]).filter(([, v]) => v)
  ) as NonNullable<LogoAssets['google']>;

  return {
    ...design,
    logo: {
      ...(scopedPath(design.logo.originalPath, merchantId)
        ? { originalPath: design.logo.originalPath }
        : {}),
      assets: {
        ...(Object.keys(cleanApple).length ? { apple: cleanApple } : {}),
        ...(Object.keys(cleanGoogle).length ? { google: cleanGoogle } : {}),
      },
    },
    ...(design.stamps
      ? {
          stamps: {
            ...design.stamps,
            filledAssetPath: scopedPath(design.stamps.filledAssetPath, merchantId),
            emptyAssetPath: scopedPath(design.stamps.emptyAssetPath, merchantId),
          },
        }
      : {}),
  };
}

// ─── Mapping colonnes studio ──────────────────────────────────────────────────

/** Ligne d'upsert pour une PUBLICATION : design complet + métadonnées studio. */
export function designToPublishRow(design: CardDesign, merchantId: string, userId: string, nextVersion: number) {
  return {
    merchant_id: merchantId,
    updated_by: userId,
    ...designToRow(design),
    card_type: design.cardType ?? 'stamps',
    stamps: design.stamps ?? null,
    draft: null,
    draft_saved_at: null,
    version: nextVersion,
    published_at: new Date().toISOString(),
  };
}

/** Ligne d'upsert pour un BROUILLON : ne touche pas au design publié. */
export function designToDraftRow(design: CardDesign, merchantId: string, userId: string) {
  return {
    merchant_id: merchantId,
    updated_by: userId,
    draft: design,
    draft_saved_at: new Date().toISOString(),
  };
}

/** Objectif de tampons à synchroniser dans merchants.stamp_goal (1..50 en base). */
export function stampGoalForMerchant(design: CardDesign): number | null {
  if ((design.cardType ?? 'stamps') !== 'stamps' || !design.stamps) return null;
  const goal = Math.round(design.stamps.goal);
  return goal >= 1 && goal <= 50 ? goal : null;
}
