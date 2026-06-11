import type { SupabaseClient } from '@supabase/supabase-js';
import type { CardDesign, LogoAssets, CardField, CardBarcode, CardTypeKey, StampsConfig } from './types';
import { CARD_TYPES, DEFAULT_CARD_DESIGN } from './types';

type Row = {
  background_color: string;
  foreground_color: string;
  label_color: string;
  program_name: string;
  logo_original_path: string | null;
  logo_assets: LogoAssets | null;
  fields: CardField[] | null;
  barcode: CardBarcode | null;
  google_class_id: string | null;
  // Colonnes studio (20260611_card_design_studio.sql) — optionnelles tant que
  // la migration n'est pas appliquée : la lecture reste rétro-compatible.
  card_type?: string | null;
  stamps?: StampsConfig | null;
};

export function rowToDesign(row: Row): CardDesign {
  const cardType = CARD_TYPES.includes(row.card_type as CardTypeKey)
    ? (row.card_type as CardTypeKey)
    : undefined;
  return {
    colors: {
      background: row.background_color,
      foreground: row.foreground_color,
      label: row.label_color,
    },
    programName: row.program_name,
    logo: {
      originalPath: row.logo_original_path ?? undefined,
      assets: row.logo_assets ?? {},
    },
    fields: Array.isArray(row.fields) ? row.fields : [],
    barcode: row.barcode ?? DEFAULT_CARD_DESIGN.barcode,
    ...(cardType ? { cardType } : {}),
    ...(row.stamps ? { stamps: row.stamps } : {}),
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

export async function loadDesign(supabase: SupabaseClient, merchantId: string): Promise<CardDesign> {
  const { data } = await supabase
    .from('card_designs')
    .select('*')
    .eq('merchant_id', merchantId)
    .maybeSingle();
  return data ? rowToDesign(data) : DEFAULT_CARD_DESIGN;
}

/**
 * Like loadDesign but returns null when no design row exists in the DB.
 * Use this when you need to distinguish "no design saved" from the default design,
 * e.g. to preserve legacy pass-generation behavior when merchants haven't set up a design.
 */
export async function loadDesignOrNull(supabase: SupabaseClient, merchantId: string): Promise<CardDesign | null> {
  const { data } = await supabase
    .from('card_designs')
    .select('*')
    .eq('merchant_id', merchantId)
    .maybeSingle();
  return data ? rowToDesign(data) : null;
}

export async function saveDesign(
  supabase: SupabaseClient,
  merchantId: string,
  userId: string,
  design: CardDesign,
) {
  const row = { merchant_id: merchantId, updated_by: userId, ...designToRow(design) };
  const { error } = await supabase
    .from('card_designs')
    .upsert(row, { onConflict: 'merchant_id' });
  if (error) throw new Error(`saveDesign: ${error.message}`);
}
