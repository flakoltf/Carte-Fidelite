import { test as setup, expect } from "@playwright/test";
import fs from "node:fs";
import { ADMIN_STORAGE_STATE } from "./paths";

// Login ADMIN une fois pour toutes (specs admin-*.spec.ts). Même logique de
// réutilisation du storageState que auth.setup.ts (marchand).
//
// Credentials FOURNIS PAR L'ENVIRONNEMENT, jamais committés :
//   E2E_ADMIN_EMAIL    (défaut : admin-demo@walletcard.app — compte démo admin)
//   E2E_ADMIN_PASSWORD (obligatoire)
// Sans mot de passe : le projet admin est ignoré (skip), pas en échec — la CI
// comptoir n'en dépend pas.
const REUSE_MAX_AGE_MS = 30 * 60 * 1000;

setup("authenticate admin (compte démo admin)", async ({ page }) => {
  const password = process.env.E2E_ADMIN_PASSWORD;
  setup.skip(!password, "E2E_ADMIN_PASSWORD absent : specs admin ignorées");
  if (!process.env.CI && fs.existsSync(ADMIN_STORAGE_STATE)) {
    const ageMs = Date.now() - fs.statSync(ADMIN_STORAGE_STATE).mtimeMs;
    setup.skip(ageMs < REUSE_MAX_AGE_MS, "storageState admin récent réutilisé");
  }
  const email = process.env.E2E_ADMIN_EMAIL ?? "admin-demo@walletcard.app";

  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password!);
  await page.getByRole("button", { name: /se connecter/i }).click();
  await page.waitForURL(/\/admin(\/|$|\?)/, { timeout: 15_000 });
  await expect(page.locator("main")).toBeVisible();
  await page.context().storageState({ path: ADMIN_STORAGE_STATE });
});
