import type { CardDesign } from './types';
import { DEFAULT_CARD_DESIGN } from './types';

type Row = {
  background_color: string;
  foreground_color: string;
  label_color: string;
  program_name: string;
  logo_original_path: string | null;
  logo_assets: any;
  fields: any;
  barcode: any;
  google_class_id: string | null;
};

export function rowToDesign(row: Row): CardDesign {
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

export async function loadDesign(supabase: any, merchantId: string): Promise<CardDesign> {
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
export async function loadDesignOrNull(supabase: any, merchantId: string): Promise<CardDesign | null> {
  const { data } = await supabase
    .from('card_designs')
    .select('*')
    .eq('merchant_id', merchantId)
    .maybeSingle();
  return data ? rowToDesign(data) : null;
}

export async function saveDesign(
  supabase: any,
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
