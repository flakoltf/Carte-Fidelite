import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { AudienceKey } from "@/lib/segments/audience";
import type { CampaignRow, ValidatedCampaign } from "./types";

type DbCampaign = {
  id: string; merchant_id: string; audience: string; title: string; body: string;
  mode: "once" | "recurring"; run_on: string | null; active: boolean;
  cooldown_days: number; last_run_on: string | null;
};

function rowToCampaign(r: DbCampaign): CampaignRow {
  return {
    id: r.id, merchantId: r.merchant_id, audience: r.audience as AudienceKey,
    title: r.title, body: r.body, mode: r.mode, runOn: r.run_on,
    active: r.active, cooldownDays: r.cooldown_days, lastRunOn: r.last_run_on,
  };
}

const COLS = "id, merchant_id, audience, title, body, mode, run_on, active, cooldown_days, last_run_on";

export async function createCampaign(merchantId: string, v: ValidatedCampaign): Promise<void> {
  await supabaseAdmin.from("campaigns").insert({
    merchant_id: merchantId, audience: v.audience, title: v.title, body: v.body,
    mode: v.mode, run_on: v.runOn, cooldown_days: v.cooldownDays,
  });
}

// Met à jour active/run_on/title/body/audience/cooldown ; scopée au marchand.
export async function updateCampaign(
  merchantId: string, id: string, patch: Record<string, unknown>,
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("campaigns").update(patch).eq("id", id).eq("merchant_id", merchantId).select("id").maybeSingle();
  return !!data;
}

export async function deleteCampaign(merchantId: string, id: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("campaigns").delete().eq("id", id).eq("merchant_id", merchantId).select("id").maybeSingle();
  return !!data;
}

// Cron : campagnes 'once' dues (jamais exécutées, date passée/aujourd'hui), tous marchands.
export async function fetchDueOnceCampaigns(today: string): Promise<CampaignRow[]> {
  const { data } = await supabaseAdmin
    .from("campaigns").select(COLS)
    .eq("mode", "once").is("last_run_on", null).lte("run_on", today);
  return (data ?? []).map((r) => rowToCampaign(r as DbCampaign));
}

// Cron : campagnes 'recurring' actives, tous marchands.
export async function fetchActiveRecurringCampaigns(): Promise<CampaignRow[]> {
  const { data } = await supabaseAdmin
    .from("campaigns").select(COLS).eq("mode", "recurring").eq("active", true);
  return (data ?? []).map((r) => rowToCampaign(r as DbCampaign));
}

// Dernier envoi par carte pour une campagne, dans la fenêtre de cooldown.
export async function fetchRecentSends(campaignId: string, sinceIso: string): Promise<Map<string, Date>> {
  const { data } = await supabaseAdmin
    .from("campaign_sends").select("card_id, sent_at").eq("campaign_id", campaignId).gte("sent_at", sinceIso);
  const map = new Map<string, Date>();
  for (const row of (data ?? []) as { card_id: string; sent_at: string }[]) {
    const d = new Date(row.sent_at);
    const prev = map.get(row.card_id);
    if (!prev || d > prev) map.set(row.card_id, d);
  }
  return map;
}

export async function recordCampaignSends(campaignId: string, cardIds: string[]): Promise<void> {
  if (!cardIds.length) return;
  await supabaseAdmin.from("campaign_sends").insert(cardIds.map((card_id) => ({ campaign_id: campaignId, card_id })));
}

export async function setLastRunOn(campaignId: string, today: string): Promise<void> {
  await supabaseAdmin.from("campaigns").update({ last_run_on: today }).eq("id", campaignId);
}
