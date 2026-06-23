import { test as setup, expect } from "@playwright/test";
import { STORAGE_STATE } from "./paths";

// Authentification UNE fois pour toutes : on se connecte au compte démo stable
// « Café du Rhône » (stamp_card, configuré) et on sauvegarde l'état (cookies
// sb-* de session Supabase) dans un storageState réutilisé par tous les specs.
//
// Credentials FOURNIS PAR L'ENVIRONNEMENT, jamais committés :
//   E2E_MERCHANT_EMAIL    (défaut : demo@example.com)
//   E2E_MERCHANT_PASSWORD (obligatoire — secret GitHub en CI, cf. e2e/README.md)
//
// Le scan reste mocké dans les specs : ce login ne lit que des données (zéro
// écriture loyalty en prod).
setup("authenticate merchant (Café du Rhône)", async ({ page }) => {
  const email = process.env.E2E_MERCHANT_EMAIL ?? "demo@example.com";
  const password = process.env.E2E_MERCHANT_PASSWORD;
  if (!password) {
    throw new Error(
      "E2E_MERCHANT_PASSWORD manquant : fournis le mot de passe du compte démo " +
        "(jamais committé ; secret GitHub en CI). Voir e2e/README.md.",
    );
  }

  await page.goto("/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: /se connecter/i }).click();

  // Un marchand atterrit sur /dashboard. Si la 2FA est active sur le compte,
  // on échoue avec un message clair (le compte démo ne devrait pas l'avoir).
  await page.waitForURL(/\/dashboard(\/|$|\?)/, { timeout: 15_000 }).catch(() => {
    throw new Error(
      "Login non abouti vers /dashboard (mauvais identifiants, ou 2FA active sur le compte démo ?).",
    );
  });

  // L'accueil peut afficher le guidage Express (compte non « configuré » en base).
  // On pose le MÊME signal local que le bouton « Découvrir ma carte sans guide »
  // (clé `halo_onboarding_dismissed`, cf. onboardingExpressStore.ts) pour aller
  // DIRECT au Comptoir — purement local, aucune écriture serveur. Capturé dans le
  // storageState → tous les specs démarrent sur ComptoirHome.
  await page.evaluate(() => window.localStorage.setItem("halo_onboarding_dismissed", "1"));
  await page.reload();

  // Sanity : le bouton géant SCANNER du comptoir est là → session marchande OK.
  await expect(page.getByRole("button", { name: "Scanner une carte" })).toBeVisible();

  await page.context().storageState({ path: STORAGE_STATE });
});
