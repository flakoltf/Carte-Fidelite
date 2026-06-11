// Calculs purs du mini-CRM leads (testés sans réseau).
// Surface ADMIN UNIQUEMENT — même règle d'import que overviewCompute.

export const LEAD_STATUSES = ["nouveau", "contacte", "demo", "gagne", "perdu"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  nouveau: "Nouveau",
  contacte: "Contacté",
  demo: "Démo",
  gagne: "Gagné",
  perdu: "Perdu",
};

export interface PipelineLead {
  id: string;
  businessName: string;
  trade: string | null;
  contact: string;
  plan: string | null;
  sourcePath: string | null;
  status: LeadStatus;
  nextFollowupAt: string | null;
  lostReason: string | null;
  convertedMerchantId: string | null;
  createdAt: string;
  updatedAt: string | null;
  noteCount: number;
}

export function normalizeLeadStatus(status: unknown): LeadStatus {
  return typeof status === "string" && (LEAD_STATUSES as readonly string[]).includes(status)
    ? (status as LeadStatus)
    : "nouveau";
}

// ── Funnel : volumes par étape + taux de conversion ─────────────────────────
export interface FunnelStats {
  byStatus: Record<LeadStatus, number>;
  total: number;
  /** gagnés / (gagnés + perdus) — null tant qu'aucun lead n'est tranché. */
  winRate: number | null;
  /** gagnés / total — null si aucun lead. */
  conversionRate: number | null;
}

export function computeFunnel(leads: Pick<PipelineLead, "status">[]): FunnelStats {
  const byStatus: Record<LeadStatus, number> = { nouveau: 0, contacte: 0, demo: 0, gagne: 0, perdu: 0 };
  for (const l of leads) byStatus[l.status]++;
  const total = leads.length;
  const decided = byStatus.gagne + byStatus.perdu;
  return {
    byStatus,
    total,
    winRate: decided > 0 ? byStatus.gagne / decided : null,
    conversionRate: total > 0 ? byStatus.gagne / total : null,
  };
}

// ── Relances : en retard / aujourd'hui / à venir ────────────────────────────
export type FollowupBucket = "en_retard" | "aujourdhui" | "a_venir" | null;

export function followupBucket(nextFollowupAt: string | null, now: Date): FollowupBucket {
  if (!nextFollowupAt) return null;
  const due = new Date(nextFollowupAt);
  if (Number.isNaN(due.getTime())) return null;
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(startOfToday.getTime() + 86400000);
  if (due < startOfToday) return "en_retard";
  if (due < endOfToday) return "aujourdhui";
  return "a_venir";
}

/** Leads à relancer, les plus en retard d'abord. Les gagnés/perdus sont exclus. */
export function dueFollowups(leads: PipelineLead[], now: Date): PipelineLead[] {
  return leads
    .filter((l) => l.status !== "gagne" && l.status !== "perdu")
    .filter((l) => {
      const bucket = followupBucket(l.nextFollowupAt, now);
      return bucket === "en_retard" || bucket === "aujourdhui";
    })
    .sort((a, b) => new Date(a.nextFollowupAt!).getTime() - new Date(b.nextFollowupAt!).getTime());
}

// ── Validation du PATCH lead ────────────────────────────────────────────────
export interface LeadPatch {
  status?: LeadStatus;
  nextFollowupAt?: string | null;
  lostReason?: string | null;
  convertedMerchantId?: string | null;
}

export type LeadPatchResult =
  | { ok: true; value: LeadPatch; changedFields: string[] }
  | { ok: false; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateLeadPatch(body: unknown): LeadPatchResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Corps de requête invalide" };
  }
  const b = body as Record<string, unknown>;
  const value: LeadPatch = {};
  const changedFields: string[] = [];

  if (b.status !== undefined) {
    if (typeof b.status !== "string" || !(LEAD_STATUSES as readonly string[]).includes(b.status)) {
      return { ok: false, error: "Statut inconnu (nouveau, contacte, demo, gagne, perdu)" };
    }
    value.status = b.status as LeadStatus;
    changedFields.push("status");
  }

  if (b.nextFollowupAt !== undefined) {
    if (b.nextFollowupAt === null) {
      value.nextFollowupAt = null;
    } else if (typeof b.nextFollowupAt === "string" && !Number.isNaN(Date.parse(b.nextFollowupAt))) {
      value.nextFollowupAt = new Date(b.nextFollowupAt).toISOString();
    } else {
      return { ok: false, error: "Date de relance invalide" };
    }
    changedFields.push("nextFollowupAt");
  }

  if (b.lostReason !== undefined) {
    if (b.lostReason === null) {
      value.lostReason = null;
    } else if (typeof b.lostReason === "string" && b.lostReason.trim().length <= 500) {
      value.lostReason = b.lostReason.trim() || null;
    } else {
      return { ok: false, error: "Motif de perte invalide (500 caractères max)" };
    }
    changedFields.push("lostReason");
  }

  if (b.convertedMerchantId !== undefined) {
    if (b.convertedMerchantId === null) {
      value.convertedMerchantId = null;
    } else if (typeof b.convertedMerchantId === "string" && UUID_RE.test(b.convertedMerchantId)) {
      value.convertedMerchantId = b.convertedMerchantId;
    } else {
      return { ok: false, error: "Identifiant de marchand converti invalide" };
    }
    changedFields.push("convertedMerchantId");
  }

  if (changedFields.length === 0) {
    return { ok: false, error: "Aucune modification fournie" };
  }
  return { ok: true, value, changedFields };
}

// ── Validation de la création manuelle (prospection terrain) ────────────────
export type LeadCreateResult =
  | { ok: true; value: { businessName: string; trade: string | null; contact: string; plan: string | null; sourcePath: string } }
  | { ok: false; error: string };

export function validateLeadCreate(body: unknown): LeadCreateResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Corps de requête invalide" };
  }
  const b = body as Record<string, unknown>;
  const businessName = typeof b.businessName === "string" ? b.businessName.trim() : "";
  const contact = typeof b.contact === "string" ? b.contact.trim() : "";
  if (businessName.length < 2 || businessName.length > 120) {
    return { ok: false, error: "Nom de l'établissement requis (2–120 caractères)" };
  }
  if (contact.length < 3 || contact.length > 254) {
    return { ok: false, error: "Contact requis (email ou téléphone)" };
  }
  const trade = typeof b.trade === "string" && b.trade.trim() ? b.trade.trim().slice(0, 80) : null;
  const plan = typeof b.plan === "string" && b.plan.trim() ? b.plan.trim().slice(0, 40) : null;
  return { ok: true, value: { businessName, trade, contact, plan, sourcePath: "admin:manuel" } };
}
