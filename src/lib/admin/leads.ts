// Accès données du mini-CRM leads — surface ADMIN UNIQUEMENT (gate
// requireAdminPage/requireAdminApi). Lecture via le client RLS (policy
// « leads admin read » : is_admin()), écriture via les routes API service-role.

import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeLeadStatus, type PipelineLead } from "./leadsCompute";

export async function fetchPipelineLeads(supabase: SupabaseClient): Promise<PipelineLead[]> {
  const [{ data: leads, error }, { data: notes }] = await Promise.all([
    supabase
      .from("leads")
      .select(
        "id, business_name, trade, contact, contact_name, phone, message, plan, source_path, status, next_followup_at, lost_reason, converted_merchant_id, created_at, updated_at"
      )
      .order("created_at", { ascending: false }),
    supabase.from("admin_notes").select("lead_id").not("lead_id", "is", null),
  ]);
  if (error) throw error;

  const noteCounts = new Map<string, number>();
  for (const n of notes ?? []) {
    const id = n.lead_id as string;
    noteCounts.set(id, (noteCounts.get(id) ?? 0) + 1);
  }

  return (leads ?? []).map((l) => ({
    id: l.id as string,
    businessName: l.business_name as string,
    trade: (l.trade as string) ?? null,
    contact: l.contact as string,
    contactName: (l.contact_name as string) ?? null,
    phone: (l.phone as string) ?? null,
    message: (l.message as string) ?? null,
    plan: (l.plan as string) ?? null,
    sourcePath: (l.source_path as string) ?? null,
    status: normalizeLeadStatus(l.status),
    nextFollowupAt: (l.next_followup_at as string) ?? null,
    lostReason: (l.lost_reason as string) ?? null,
    convertedMerchantId: (l.converted_merchant_id as string) ?? null,
    createdAt: l.created_at as string,
    updatedAt: (l.updated_at as string) ?? null,
    noteCount: noteCounts.get(l.id as string) ?? 0,
  }));
}

export interface AdminNote {
  id: string;
  merchantId: string | null;
  leadId: string | null;
  body: string;
  authorUserId: string;
  pinned: boolean;
  createdAt: string;
}

function mapNote(n: Record<string, unknown>): AdminNote {
  return {
    id: n.id as string,
    merchantId: (n.merchant_id as string) ?? null,
    leadId: (n.lead_id as string) ?? null,
    body: n.body as string,
    authorUserId: n.author_user_id as string,
    pinned: Boolean(n.pinned),
    createdAt: n.created_at as string,
  };
}

export async function fetchNotesForMerchant(supabase: SupabaseClient, merchantId: string): Promise<AdminNote[]> {
  const { data, error } = await supabase
    .from("admin_notes")
    .select("id, merchant_id, lead_id, body, author_user_id, pinned, created_at")
    .eq("merchant_id", merchantId)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapNote);
}
