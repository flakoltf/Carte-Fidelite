import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

// Gardes STATIQUES de la surface self-service (Agent C) — pendant des
// surfaceGuards (admin, Agent B) et studioGuards (marchand, Agent A).
// La CI échoue si une future route du parcours oublie le gate du flag, le
// rate-limit, la résolution du tenant ou le filtre service-role.

const SRC = join(__dirname, "../../..");

function walk(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const SIGNUP_API_DIR = join(SRC, "app/api/signup");
const ONBOARDING_API_DIR = join(SRC, "app/api/onboarding");
const SIGNUP_PAGES_DIR = join(SRC, "app/(app)/signup");
const ONBOARDING_PAGES_DIR = join(SRC, "app/(app)/onboarding");

describe("étanchéité de la surface self-service", () => {
  it("POST /api/signup : flag fail-closed + rate-limit + captcha + audit", () => {
    const content = readFileSync(join(SIGNUP_API_DIR, "route.ts"), "utf8");
    expect(content).toContain("isSelfServiceEnabled");
    expect(content).toContain("rateLimit(");
    expect(content).toContain("verifyCaptcha");
    expect(content).toContain("logAuditEvent");
    // Le compte est créé NON confirmé : la vérification d'email est obligatoire.
    expect(content).toContain("email_confirm: false");
  });

  it("la surface publique d'inscription ne fixe JAMAIS de rôle", () => {
    for (const file of walk(SIGNUP_API_DIR).filter((f) => f.endsWith(".ts"))) {
      const content = readFileSync(file, "utf8");
      expect(content, `${file} semble écrire un rôle`).not.toMatch(/role\s*[:=]/);
    }
  });

  it("chaque route /api/onboarding/** résout le tenant via currentMerchantId", () => {
    const routes = walk(ONBOARDING_API_DIR).filter((f) => f.endsWith("route.ts"));
    expect(routes.length).toBeGreaterThanOrEqual(5);
    for (const route of routes) {
      const content = readFileSync(route, "utf8");
      expect(content, `${route.replace(SRC, "src")} ne résout pas le tenant`).toContain("currentMerchantId");
    }
  });

  it("chaque route /api/onboarding/** utilisant le service-role filtre par tenant (invariant 3)", () => {
    for (const route of walk(ONBOARDING_API_DIR).filter((f) => f.endsWith("route.ts"))) {
      const content = readFileSync(route, "utf8");
      if (!content.includes("supabaseAdmin")) continue;
      const filtersTenant =
        content.includes(`.eq("merchant_id", merchantId)`) ||
        content.includes(`.eq("id", merchantId)`) ||
        content.includes("p_merchant_id: merchantId") ||
        content.includes("fetchOnboardingState(merchantId)");
      expect(filtersTenant, `${route.replace(SRC, "src")} interroge la base sans filtre tenant`).toBe(true);
    }
  });

  it("l'enrollment_token n'apparaît NULLE PART dans le parcours self-service", () => {
    const files = [
      ...walk(SIGNUP_API_DIR),
      ...walk(ONBOARDING_API_DIR),
      ...walk(SIGNUP_PAGES_DIR),
      ...walk(ONBOARDING_PAGES_DIR),
    ].filter((f) => /\.(ts|tsx)$/.test(f));
    expect(files.length).toBeGreaterThan(5);
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      expect(content, `${file.replace(SRC, "src")} expose enrollment_token`).not.toContain("enrollment_token");
    }
  });

  it("le wizard n'importe aucune couche admin cross-tenant", () => {
    const forbidden = ["merchant_health", "@/lib/admin/merchantsList", "@/lib/admin/overview", "@/lib/admin/merchantDetail", "@/lib/admin/billingOverview"];
    const files = [...walk(ONBOARDING_PAGES_DIR), ...walk(ONBOARDING_API_DIR), ...walk(SIGNUP_PAGES_DIR)].filter((f) =>
      /\.(ts|tsx)$/.test(f)
    );
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      for (const f of forbidden) {
        expect(content, `${file.replace(SRC, "src")} importe ${f}`).not.toContain(f);
      }
    }
  });

  it("flag éteint : /signup conserve la redirection historique vers /login", () => {
    const page = readFileSync(join(SIGNUP_PAGES_DIR, "page.tsx"), "utf8");
    expect(page).toContain("isSelfServiceEnabled");
    expect(page).toContain('redirect("/login")');
  });

  it("/signup/confirm : type de jeton whitelisté, session via client SSR (cookies)", () => {
    const confirm = readFileSync(join(SIGNUP_PAGES_DIR, "confirm/route.ts"), "utf8");
    expect(confirm).toContain('type !== "magiclink"');
    expect(confirm).toContain("verifyOtp");
    expect(confirm).toContain("ensureMerchantProvisioned");
  });

  it("le choix de palier passe par le port BillingProvider (couture Stripe)", () => {
    const plan = readFileSync(join(ONBOARDING_API_DIR, "plan/route.ts"), "utf8");
    expect(plan).toContain("getBillingProvider");
    expect(plan).toContain("evaluatePlanChange");
    // Jamais de SDK Stripe direct dans les routes.
    expect(plan.toLowerCase()).not.toContain('from "stripe"');
  });
});
