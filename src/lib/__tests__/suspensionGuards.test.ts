import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Garde statique : la suspension administrative (merchants.suspended_at) doit
// être consultée par TOUS les points d'entrée qui font vivre le programme d'un
// marchand — comptoir, enrôlement public, émission d'artefacts Wallet. L'audit
// du 2026-06-11 a trouvé 4 chemins qui l'ignoraient ; ce test fige la liste
// pour qu'aucun futur point d'entrée connu ne régresse en silence.

const SRC = join(__dirname, "../..");

const SUSPENSION_AWARE_ENTRYPOINTS = [
  "app/api/scan/route.ts",
  "app/api/redeem/route.ts",
  "app/api/enroll/route.ts",
  "app/api/enroll/[cardId]/route.ts",
  "app/api/generate-apple-pass/route.ts",
  "app/api/generate-google-pass/route.ts",
  "app/c/[slug]/page.tsx",
];

describe("suspension administrative — étanchéité des points d'entrée", () => {
  for (const rel of SUSPENSION_AWARE_ENTRYPOINTS) {
    it(`${rel} consulte suspended_at`, () => {
      const content = readFileSync(join(SRC, rel), "utf8");
      expect(content, `${rel} ne consulte pas merchants.suspended_at`).toContain("suspended_at");
    });
  }

  it("l'artefact Wallet public respecte le gate Google côté serveur", () => {
    const content = readFileSync(join(SRC, "app/api/enroll/[cardId]/route.ts"), "utf8");
    expect(content).toContain("NEXT_PUBLIC_GOOGLE_WALLET_READY");
  });
});
