import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { AUDIT_ACTIONS } from "../auditLog";

// Piège connu : audit_logs_action_check rejette silencieusement toute action
// absente de sa liste (logAuditEvent est best-effort). Ce test garantit que la
// migration la plus récente touchant la contrainte couvre toutes les actions du code.

// La détection doit exiger une VRAIE clause ADD CONSTRAINT ... CHECK, pas une
// simple mention du nom : une migration peut citer la contrainte en commentaire
// sans la redéfinir (ex. 20260618_amount_points.sql : « pas de jumelle ici »).
// Un includes('audit_logs_action_check') capturerait ce commentaire et pourrait
// désigner la mauvaise migration comme « la plus récente du CHECK ».
const DEFINES_CHECK = /add\s+constraint\s+audit_logs_action_check\s+check/i;

describe("synchronisation AuditAction ↔ audit_logs_action_check", () => {
  it("toute AuditAction du code figure dans la dernière migration du CHECK", () => {
    const dir = join(__dirname, "../../../supabase/migrations");
    const withCheck = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .filter((f) => DEFINES_CHECK.test(readFileSync(join(dir, f), "utf8")))
      .sort();
    expect(withCheck.length).toBeGreaterThan(0);

    const lastMigration = withCheck.at(-1)!;
    const sql = readFileSync(join(dir, lastMigration), "utf8");
    for (const action of AUDIT_ACTIONS) {
      expect(sql, `'${action}' manque dans ${lastMigration} — ajouter une migration jumelle`).toContain(`'${action}'`);
    }
  });
});
