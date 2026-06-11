import { describe, expect, it } from "vitest";
import { AUDIT_ACTIONS } from "@/lib/auditLog";
import { parseAuditFilters, SENSITIVE_ACTIONS } from "../auditQuery";
import { validateFlagPatch, validateSettingPatch, EDITABLE_SETTINGS } from "../platform";
import { csvEscape, buildCsv } from "../csv";
import { computeUsageState, computePlanDistribution, type BillingRow } from "../billingOverview";

describe("SENSITIVE_ACTIONS", () => {
  it("est un sous-ensemble strict de AUDIT_ACTIONS (sinon le filtre .in() rate)", () => {
    for (const a of SENSITIVE_ACTIONS) {
      expect(AUDIT_ACTIONS).toContain(a);
    }
  });
});

describe("parseAuditFilters", () => {
  it("valeurs par défaut sur params vides ou hostiles", () => {
    expect(parseAuditFilters({})).toEqual({ action: null, merchantId: null, sensitiveOnly: false, days: 30, page: 1 });
    expect(parseAuditFilters({ action: "DROP TABLE", merchant: "x", days: "-3", page: "0" })).toEqual({
      action: null,
      merchantId: null,
      sensitiveOnly: false,
      days: 30,
      page: 1,
    });
  });

  it("parse des filtres valides", () => {
    const f = parseAuditFilters({
      action: "MERCHANT_SUSPENDED",
      merchant: "123e4567-e89b-42d3-a456-426614174000",
      sensitive: "1",
      days: "90",
      page: "3",
    });
    expect(f.action).toBe("MERCHANT_SUSPENDED");
    expect(f.merchantId).toBe("123e4567-e89b-42d3-a456-426614174000");
    expect(f.sensitiveOnly).toBe(true);
    expect(f.days).toBe(90);
    expect(f.page).toBe(3);
  });

  it("prend la première valeur d'un param répété", () => {
    expect(parseAuditFilters({ days: ["7", "365"] }).days).toBe(7);
  });
});

describe("validateFlagPatch / validateSettingPatch", () => {
  it("flag : clé normée + booléen exigés", () => {
    expect(validateFlagPatch({ key: "ma-feature", enabled: true }).ok).toBe(true);
    expect(validateFlagPatch({ key: "Ma Feature", enabled: true }).ok).toBe(false);
    expect(validateFlagPatch({ key: "ok-key", enabled: "oui" }).ok).toBe(false);
  });

  it("setting : liste fermée de clés, objet JSON exigé", () => {
    for (const key of EDITABLE_SETTINGS) {
      expect(validateSettingPatch({ key, value: { a: 1 } }).ok).toBe(true);
    }
    expect(validateSettingPatch({ key: "autre_cle", value: {} }).ok).toBe(false);
    expect(validateSettingPatch({ key: "db_backup", value: [1] }).ok).toBe(false);
    expect(validateSettingPatch({ key: "db_backup", value: "x" }).ok).toBe(false);
  });
});

describe("csv (RFC 4180 + anti-injection tableur)", () => {
  it("échappe virgules, guillemets, retours ligne", () => {
    expect(csvEscape('a"b')).toBe('"a""b"');
    expect(csvEscape("a,b")).toBe('"a,b"');
    expect(csvEscape("a\nb")).toBe('"a\nb"');
    expect(csvEscape(null)).toBe("");
  });

  it("neutralise les formules Excel/Sheets", () => {
    expect(csvEscape("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvEscape("+41 79")).toBe("'+41 79");
  });

  it("buildCsv : BOM + CRLF + en-têtes", () => {
    const csv = buildCsv(["a", "b"], [["1", "x,y"]]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('1,"x,y"\r\n');
  });
});

describe("billingOverview (purs)", () => {
  const row = (over: Partial<BillingRow>): BillingRow => ({
    merchantId: "m",
    shopName: "X",
    email: null,
    plan: "essentiel",
    planStartedAt: null,
    billingCycle: "monthly",
    launchPartner: false,
    trialEndsAt: null,
    trialActive: false,
    suspendedAt: null,
    capOverride: null,
    cap: 200,
    activeCards90: 0,
    usageState: "ok",
    priceChf: 69,
    isDemo: false,
    ...over,
  });

  it("computeUsageState : seuils 80 % et 100 %", () => {
    expect(computeUsageState(100, 200)).toBe("ok");
    expect(computeUsageState(160, 200)).toBe("near");
    expect(computeUsageState(201, 200)).toBe("over");
    expect(computeUsageState(10, null)).toBe("uncapped");
  });

  it("computePlanDistribution : exclut les démos du compte, les essais du MRR", () => {
    const d = computePlanDistribution([
      row({}),
      row({ trialActive: true }),
      row({ isDemo: true }),
      row({ plan: "croissance", cap: 750, priceChf: 129 }),
    ]);
    const essentiel = d.find((x) => x.plan === "essentiel")!;
    expect(essentiel.count).toBe(2); // démo exclue, essai compté dans le parc
    expect(essentiel.mrrChf).toBe(69); // mais pas dans le MRR
    expect(d.find((x) => x.plan === "croissance")!.mrrChf).toBe(129);
  });
});
