import { defineConfig, devices } from "@playwright/test";

// Garde-fou absolu : les tests E2E ne tournent QUE contre localhost.
// On refuse de pointer vers la prod (halocard.ch) même via variable d'env.
const BASE_URL = "http://localhost:3000";

// Config Playwright — parcours marchand COMPTOIR bout en bout.
// Filet de sécurité avant la prod : on teste le geste central (scanner → créditer)
// sur un viewport mobile, le contexte réel d'usage au comptoir.
export default defineConfig({
  testDir: "./e2e",
  // Un échec ne doit pas bloquer la suite : on isole, on tague, on rejoue 1×.
  retries: 1,
  // Geste comptoir = quelques secondes ; 30 s couvre le 1er compile turbopack.
  timeout: 30_000,
  expect: { timeout: 5_000 },
  // Pas de test.only oublié qui masquerait le reste en CI.
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    // Trace gardée au 1er retry → diagnostic d'un flake sans coût sur le run vert.
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      // « Mobile Safari » = nom/forme du comptoir (iPhone 13). On force le moteur
      // chromium (installé en CI) ; le device fournit viewport + tactile + isMobile.
      name: "Mobile Safari",
      use: { ...devices["iPhone 13"], browserName: "chromium" },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    // Local : on réutilise le dev déjà lancé. CI : Playwright le démarre.
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
