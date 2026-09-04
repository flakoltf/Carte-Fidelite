import { describe, it, expect, vi, beforeEach } from "vitest";
import { submitLead } from "../actions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { rateLimit } from "@/lib/rateLimit";
import { sendEmail } from "@/lib/email/send";
import { logAuditEvent } from "@/lib/auditLog";

// La Server Action est testée sans réseau : Supabase, Upstash, Resend et
// l'audit sont mockés. `redirect` jette (comme le vrai Next) pour couper le flux.

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));
vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers({ "x-real-ip": "203.0.113.7", "user-agent": "vitest" })),
}));
vi.mock("@/lib/supabaseAdmin", () => ({ supabaseAdmin: { from: vi.fn() } }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: vi.fn() }));
vi.mock("@/lib/email/send", () => ({ sendEmail: vi.fn() }));
vi.mock("@/lib/auditLog", () => ({ logAuditEvent: vi.fn() }));

const mockedFrom = vi.mocked(supabaseAdmin.from);
const mockedRateLimit = vi.mocked(rateLimit);
const mockedSendEmail = vi.mocked(sendEmail);
const mockedAudit = vi.mocked(logAuditEvent);

function fd(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  const values: Record<string, string> = {
    business: "Boulangerie du Bourg",
    sector: "Boulangerie",
    contactName: "Anne Favre",
    email: "anne@bourg.ch",
    phone: "079 555 12 34",
    message: "Nous cherchons une carte simple.",
    plan: "",
    website: "",
    ...overrides,
  };
  for (const [k, v] of Object.entries(values)) data.set(k, v);
  return data;
}

type InsertResult = { data: { id: string } | null; error: { code?: string; message: string } | null };

function mockInsert(...results: InsertResult[]) {
  const insert = vi.fn();
  for (const result of results) {
    insert.mockReturnValueOnce({ select: () => ({ single: async () => result }) });
  }
  mockedFrom.mockReturnValue({ insert } as never);
  return insert;
}

const LEAD_OK: InsertResult = { data: { id: "lead-123" }, error: null };

async function expectRedirect(promise: Promise<unknown>, url: string) {
  await expect(promise).rejects.toThrow(`REDIRECT:${url}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedRateLimit.mockResolvedValue({ success: true, remaining: 4 });
  mockedSendEmail.mockResolvedValue({ sent: true, id: "email-1" });
  mockedAudit.mockResolvedValue(undefined);
});

describe("submitLead — enregistrement", () => {
  it("insère le lead avec les nouvelles colonnes et redirige vers le succès", async () => {
    const insert = mockInsert(LEAD_OK);
    await expectRedirect(submitLead(fd()), "/demarrer?ok=1");
    expect(mockedFrom).toHaveBeenCalledWith("leads");
    expect(insert).toHaveBeenCalledWith({
      business_name: "Boulangerie du Bourg",
      trade: "Boulangerie",
      contact: "anne@bourg.ch",
      contact_name: "Anne Favre",
      phone: "079 555 12 34",
      message: "Nous cherchons une carte simple.",
      plan: null,
      source_path: "/demarrer",
    });
  });

  it("pose l'audit LEAD_CREATED (action existante, pas de nouvelle AuditAction)", async () => {
    mockInsert(LEAD_OK);
    await expectRedirect(submitLead(fd()), "/demarrer?ok=1");
    expect(mockedAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "LEAD_CREATED",
        ip_address: "203.0.113.7",
        details: expect.objectContaining({ lead_id: "lead-123", source: "web:/demarrer" }),
      })
    );
  });

  it("retombe sur les colonnes historiques si la migration n'est pas appliquée", async () => {
    const insert = mockInsert(
      { data: null, error: { code: "PGRST204", message: "Could not find the 'phone' column" } },
      LEAD_OK
    );
    await expectRedirect(submitLead(fd()), "/demarrer?ok=1");
    expect(insert).toHaveBeenCalledTimes(2);
    expect(insert).toHaveBeenLastCalledWith({
      business_name: "Boulangerie du Bourg",
      trade: "Boulangerie",
      contact: "anne@bourg.ch · Anne Favre · 079 555 12 34",
      plan: null,
      source_path: "/demarrer",
    });
  });

  it("redirige vers l'erreur technique si l'insertion échoue", async () => {
    mockInsert({ data: null, error: { code: "XX000", message: "boom" } });
    await expectRedirect(submitLead(fd()), "/demarrer?erreur=technique");
    expect(mockedAudit).not.toHaveBeenCalled();
  });
});

describe("submitLead — validation serveur", () => {
  it("rejette un email invalide sans rien insérer", async () => {
    const insert = mockInsert(LEAD_OK);
    await expectRedirect(submitLead(fd({ email: "pas-un-email" })), "/demarrer?erreur=email");
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejette un secteur hors liste même si le client force la valeur", async () => {
    const insert = mockInsert(LEAD_OK);
    await expectRedirect(submitLead(fd({ sector: "Garage" })), "/demarrer?erreur=champs");
    expect(insert).not.toHaveBeenCalled();
  });

  it("honeypot rempli → rejet silencieux (faux succès, aucun insert, aucun email)", async () => {
    const insert = mockInsert(LEAD_OK);
    await expectRedirect(submitLead(fd({ website: "https://spam.example" })), "/demarrer?ok=1");
    expect(insert).not.toHaveBeenCalled();
    expect(mockedSendEmail).not.toHaveBeenCalled();
    expect(mockedAudit).not.toHaveBeenCalled();
  });
});

describe("submitLead — rate-limit", () => {
  it("bloque au-delà de la limite par IP", async () => {
    const insert = mockInsert(LEAD_OK);
    mockedRateLimit.mockResolvedValue({ success: false, remaining: 0 });
    await expectRedirect(submitLead(fd()), "/demarrer?erreur=limite");
    expect(mockedRateLimit).toHaveBeenCalledWith("lead-ip:203.0.113.7", 5, 3600000);
    expect(insert).not.toHaveBeenCalled();
  });

  it("fail-open : Redis injoignable ne bloque pas le prospect", async () => {
    const insert = mockInsert(LEAD_OK);
    mockedRateLimit.mockRejectedValue(new Error("ECONNREFUSED"));
    await expectRedirect(submitLead(fd()), "/demarrer?ok=1");
    expect(insert).toHaveBeenCalledTimes(1);
  });
});

describe("submitLead — notification fondateur best-effort", () => {
  it("un échec d'envoi (ou clé absente) n'empêche ni le lead ni le succès", async () => {
    mockInsert(LEAD_OK);
    mockedSendEmail.mockRejectedValue(new Error("Resend down"));
    await expectRedirect(submitLead(fd()), "/demarrer?ok=1");
  });
});
