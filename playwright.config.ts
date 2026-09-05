import { defineConfig, devices } from "@playwright/test";
import { ADMIN_STORAGE_STATE, STORAGE_STATE } from "./e2e/paths";

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
    // Étape 0 : login marchand → storageState (cf. e2e/auth.setup.ts).
    { name: "setup", testMatch: /(^|\/)auth\.setup\.ts$/ },
    {
      // « Mobile Safari » = forme du comptoir (iPhone 13). On force le moteur
      // chromium (installé en CI) ; le device fournit viewport + tactile + isMobile.
      name: "Mobile Safari",
      testMatch: /.*\.spec\.ts/,
      // Les specs admin ont leur propre session (projet « Admin » ci-dessous).
      testIgnore: /(^|\/)admin-[^/]*\.spec\.ts$/,
      dependencies: ["setup"],
      use: {
        ...devices["iPhone 13"],
        browserName: "chromium",
        // Session marchande réutilisée (pas de re-login par test).
        storageState: STORAGE_STATE,
        // Fausse caméra : getUserMedia résout sans prompt → le mode « scanning »
        // est stable (le lecteur QR reste monté). Le décodage QR lui-même est
        // déclenché par le seam window.__e2eDecode (la fausse vidéo n'a pas de QR).
        permissions: ["camera"],
        launchOptions: {
          args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
        },
      },
    },
    // Étape 0 bis : login admin → storageState admin (ignoré sans E2E_ADMIN_PASSWORD).
    { name: "admin-setup", testMatch: /(^|\/)admin\.setup\.ts$/ },
    {
      // Back-office : mêmes device/moteur que le comptoir, session admin.
      name: "Admin",
      testMatch: /(^|\/)admin-[^/]*\.spec\.ts$/,
      dependencies: ["admin-setup"],
      use: {
        ...devices["iPhone 13"],
        browserName: "chromium",
        // Sans E2E_ADMIN_PASSWORD, admin.setup est ignoré et le fichier n'existe
        // pas : on ne le référence pas (les specs admin se skippent d'elles-mêmes).
        storageState: process.env.E2E_ADMIN_PASSWORD ? ADMIN_STORAGE_STATE : undefined,
      },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    // Local : on réutilise le dev déjà lancé. CI : Playwright le démarre.
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Active les seams E2E (inertes en prod : ce flag n'est jamais posé sur le
    // Vercel de prod). Indispensable pour window.__e2eDecode et ?e2eProgram.
    env: { NEXT_PUBLIC_E2E: "1" },
  },
});
