import { createClient } from "@/utils/supabase/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { tallyScansByCard } from "./scans";
import { buildCustomerStats, type CustomerRow, type CardRow } from "./stats";
import { classifyCustomer } from "./classify";
import { summarizeSegments, type SegmentSummary } from "./summary";
import { STAGE_KEYS, type StageKey, type CustomerStats, type Classification } from "./types";

type CustomerWithCards = CustomerRow & { loyalty_cards: CardRow[] | null };

export function isStageKey(s: string): s is StageKey {
  return (STAGE_KEYS as readonly string[]).includes(s);
}

// Charge tous les clients du marchand + agrège + classe. RLS limite déjà au marchand connecté.
async function loadClassified(merchantId: string): Promise<{ stats: CustomerStats; cls: Classification }[]> {
  const supabase = await createClient();
  const [{ data: customers }, { data: scans }] = await Promise.all([
    supabase
      .from("customers")
      .select("id, full_name, created_at, loyalty_cards(id, stamps_count, last_scan)")
      .eq("merchant_id", merchantId),
    supabase.from("scan_history").select("card_id").eq("merchant_id", merchantId),
  ]);

  const list = (customers ?? []) as CustomerWithCards[];
  const scanCounts = tallyScansByCard((scans ?? []) as { card_id: string }[]);

  const cardIds = list.flatMap((c) => (c.loyalty_cards ?? []).map((k) => k.id));
  let reachable = new Set<string>();
  if (cardIds.length) {
    // wallet_device_registrations n'a pas de RLS → on lit via supabaseAdmin (comme tous
    // les autres appels), en restant scopé aux serial_number (= ids de cartes) du marchand.
    const { data: regs } = await supabaseAdmin
      .from("wallet_device_registrations")
      .select("serial_number")
      .in("serial_number", cardIds);
    reachable = new Set((regs ?? []).map((r) => r.serial_number as string));
  }

  const now = new Date();
  return list.map((c) => {
    const stats = buildCustomerStats(c, c.loyalty_cards ?? [], scanCounts, reachable);
    return { stats, cls: classifyCustomer(stats, now) };
  });
}

export async function fetchSegmentCounts(merchantId: string): Promise<SegmentSummary> {
  const rows = await loadClassified(merchantId);
  return summarizeSegments(rows.map((r) => r.cls));
}

export type Member = {
  customerId: string;
  name: string;
  lastScan: string | null;
  visits: number;
  stamps: number;
};

export async function fetchSegmentMembers(merchantId: string, stage: StageKey): Promise<Member[]> {
  const rows = await loadClassified(merchantId);
  return rows
    .filter((r) => r.cls.stage === stage)
    .map((r) => ({
      customerId: r.stats.customerId,
      name: r.stats.name,
      lastScan: r.stats.lastScan ? r.stats.lastScan.toISOString() : null,
      visits: r.stats.visits,
      stamps: r.stats.maxStamps,
    }))
    .sort((a, b) => b.visits - a.visits);
}
