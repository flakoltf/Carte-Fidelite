import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Gardes d'étanchéité entre les deux surfaces (admin cross-tenant / marchand
// scopé). Tests STATIQUES : ils échouent à la CI si une future route admin
// oublie son gate, ou si du code marchand importe la couche cross-tenant.

const SRC = join(__dirname, "../../..");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

describe("étanchéité des surfaces admin / marchand", () => {
  it("chaque route API admin appelle requireAdminApi (gate fail-closed)", () => {
    const adminApiDir = join(SRC, "app/api/admin");
    const routes = walk(adminApiDir).filter((f) => f.endsWith("route.ts"));
    expect(routes.length).toBeGreaterThan(0);
    for (const route of routes) {
      const content = readFileSync(route, "utf8");
      expect(content, `${route.replace(SRC, "src")} ne contient pas requireAdminApi`).toContain(
        "requireAdminApi"
      );
    }
  });

  it("le layout admin pose le gate requireAdminPage (toutes les pages /admin en héritent)", () => {
    const layout = readFileSync(join(SRC, "app/(app)/admin/layout.tsx"), "utf8");
    expect(layout).toContain("requireAdminPage");
  });

  it("la couche cross-tenant lib/admin/overview n'est importée QUE par la surface admin", () => {
    const allFiles = walk(SRC).filter(
      (f) => (f.endsWith(".ts") || f.endsWith(".tsx")) && !f.includes("__tests__")
    );
    const offenders = allFiles.filter((f) => {
      const content = readFileSync(f, "utf8");
      if (!content.includes("@/lib/admin/overview") && !content.includes("lib/admin/overview")) return false;
      const rel = f.replace(SRC, "");
      const isAdminSurface =
        rel.includes("/app/(app)/admin/") || rel.includes("/app/api/admin/") || rel.includes("/lib/admin/");
      return !isAdminSurface;
    });
    expect(
      offenders.map((f) => f.replace(SRC, "src")),
      "du code hors surface admin importe la couche cross-tenant"
    ).toEqual([]);
  });

  it("aucun fetcher analytics marchand n'importe la couche admin cross-tenant", () => {
    const analyticsDir = join(SRC, "lib/analytics");
    const files = walk(analyticsDir).filter((f) => f.endsWith(".ts") && !f.includes("__tests__"));
    for (const f of files) {
      const content = readFileSync(f, "utf8");
      expect(content, `${f.replace(SRC, "src")} importe lib/admin/overview`).not.toContain(
        "lib/admin/overview"
      );
      expect(content, `${f.replace(SRC, "src")} lit merchant_health (vue cross-tenant)`).not.toContain(
        "merchant_health"
      );
    }
  });
});
