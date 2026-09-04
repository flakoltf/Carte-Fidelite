import { describe, expect, it } from "vitest";
import {
  computeFunnel,
  dueFollowups,
  followupBucket,
  normalizeLeadStatus,
  validateLeadCreate,
  validateLeadPatch,
  type PipelineLead,
} from "../leadsCompute";

const lead = (over: Partial<PipelineLead>): PipelineLead => ({
  id: "l1",
  businessName: "Café Test",
  trade: null,
  contact: "test@example.com",
  contactName: null,
  phone: null,
  message: null,
  plan: null,
  sourcePath: "/demarrer",
  status: "nouveau",
  nextFollowupAt: null,
  lostReason: null,
  convertedMerchantId: null,
  createdAt: "2026-06-01T10:00:00Z",
  updatedAt: null,
  noteCount: 0,
  ...over,
});

describe("normalizeLeadStatus", () => {
  it("tolère les valeurs inconnues", () => {
    expect(normalizeLeadStatus("demo")).toBe("demo");
    expect(normalizeLeadStatus("n'importe")).toBe("nouveau");
    expect(normalizeLeadStatus(null)).toBe("nouveau");
  });
});

describe("computeFunnel", () => {
  it("compte par étape et calcule les taux", () => {
    const f = computeFunnel([
      lead({ status: "nouveau" }),
      lead({ status: "contacte" }),
      lead({ status: "gagne" }),
      lead({ status: "gagne" }),
      lead({ status: "perdu" }),
    ]);
    expect(f.total).toBe(5);
    expect(f.byStatus.gagne).toBe(2);
    expect(f.winRate).toBeCloseTo(2 / 3);
    expect(f.conversionRate).toBeCloseTo(2 / 5);
  });

  it("taux null tant que rien n'est tranché / vide", () => {
    expect(computeFunnel([lead({})]).winRate).toBeNull();
    expect(computeFunnel([]).conversionRate).toBeNull();
  });
});

describe("followupBucket / dueFollowups", () => {
  const now = new Date("2026-06-10T12:00:00");

  it("classe en retard / aujourd'hui / à venir", () => {
    expect(followupBucket("2026-06-08T09:00:00", now)).toBe("en_retard");
    expect(followupBucket("2026-06-10T16:00:00", now)).toBe("aujourdhui");
    expect(followupBucket("2026-06-12T09:00:00", now)).toBe("a_venir");
    expect(followupBucket(null, now)).toBeNull();
    expect(followupBucket("invalide", now)).toBeNull();
  });

  it("dueFollowups exclut gagnés/perdus et trie les plus en retard d'abord", () => {
    const due = dueFollowups(
      [
        lead({ id: "a", nextFollowupAt: "2026-06-09T09:00:00" }),
        lead({ id: "b", nextFollowupAt: "2026-06-05T09:00:00" }),
        lead({ id: "c", nextFollowupAt: "2026-06-09T09:00:00", status: "gagne" }),
        lead({ id: "d", nextFollowupAt: "2026-06-20T09:00:00" }),
        lead({ id: "e" }),
      ],
      now
    );
    expect(due.map((l) => l.id)).toEqual(["b", "a"]);
  });
});

describe("validateLeadPatch", () => {
  it("accepte statut + relance + conversion", () => {
    const r = validateLeadPatch({
      status: "gagne",
      nextFollowupAt: "2026-06-20",
      convertedMerchantId: "123e4567-e89b-42d3-a456-426614174000",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.changedFields).toEqual(["status", "nextFollowupAt", "convertedMerchantId"]);
  });

  it("refuse statut inconnu, date invalide, uuid invalide, patch vide", () => {
    expect(validateLeadPatch({ status: "archive" }).ok).toBe(false);
    expect(validateLeadPatch({ nextFollowupAt: "demain" }).ok).toBe(false);
    expect(validateLeadPatch({ convertedMerchantId: "abc" }).ok).toBe(false);
    expect(validateLeadPatch({}).ok).toBe(false);
  });

  it("null efface relance / motif / conversion", () => {
    const r = validateLeadPatch({ nextFollowupAt: null, lostReason: null, convertedMerchantId: null });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.nextFollowupAt).toBeNull();
      expect(r.value.lostReason).toBeNull();
      expect(r.value.convertedMerchantId).toBeNull();
    }
  });
});

describe("validateLeadCreate (saisie terrain)", () => {
  it("exige nom et contact, normalise le reste", () => {
    const r = validateLeadCreate({ businessName: "  Boulangerie X ", contact: "079 000 00 00", trade: " café " });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.businessName).toBe("Boulangerie X");
      expect(r.value.trade).toBe("café");
      expect(r.value.sourcePath).toBe("admin:manuel");
    }
  });

  it("refuse nom trop court ou contact manquant", () => {
    expect(validateLeadCreate({ businessName: "B", contact: "079 000 00 00" }).ok).toBe(false);
    expect(validateLeadCreate({ businessName: "Boulangerie", contact: "" }).ok).toBe(false);
  });
});
