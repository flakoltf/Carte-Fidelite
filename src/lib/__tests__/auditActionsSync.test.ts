import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { AUDIT_ACTIONS } from "../auditLog";

// Piège connu : audit_logs_action_check rejette silencieusement toute action
// absente de sa liste (logAuditEvent est best-effort). Ce test garantit que la
// migration la plus récente touchant la contrainte couvre toutes les actions du code.
describe("synchronisation AuditAction ↔ audit_logs_action_check", () => {
  it("toute AuditAction du code figure dans la dernière migration du CHECK", () => {
    const dir = join(__dirname, "../../../supabase/migrations");
    const withCheck = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .filter((f) => readFileSync(join(dir, f), "utf8").includes("audit_logs_action_check"))
      .sort();
    expect(withCheck.length).toBeGreaterThan(0);

    const lastMigration = withCheck.at(-1)!;
    const sql = readFileSync(join(dir, lastMigration), "utf8");
    for (const action of AUDIT_ACTIONS) {
      expect(sql, `'${action}' manque dans ${lastMigration} — ajouter une migration jumelle`).toContain(`'${action}'`);
    }
  });
});
