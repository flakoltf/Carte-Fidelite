import { test, expect } from "./fixtures";

// E2E-3 — Parcours comptoir « points au montant » (amount_points), bout en bout.
// Le compte démo est stamp_card : on simule un marchand amount_points via le seam
// d'AFFICHAGE `?e2eProgram=amount_points` (gated NEXT_PUBLIC_E2E, inerte en prod).
// Le crédit /api/scan reste mocké (filet anti-écriture-prod) — la décision réelle
// du programme côté serveur n'est jamais altérée.
test.describe("Comptoir — points au montant (amount_points)", () => {
  test("scan → pavé CHF → saisie 25.50 → VALIDER → « +25 points crédités »", async ({
    page,
    scanApi,
  }) => {
    // 1. /dashboard → ComptoirHome (bouton SCANNER géant).
    await page.goto("/dashboard");
    const scanner = page.getByRole("button", { name: "Scanner une carte" });
    await expect(scanner).toBeVisible();

    // 2. Clic SCANNER → /dashboard/scan.
    await scanner.click();
    await expect(page).toHaveURL(/\/dashboard\/scan(\/|$|\?)/);

    // Bascule en mode amount_points (ce qu'un vrai marchand amount_points aurait).
    await page.goto("/dashboard/scan?e2eProgram=amount_points");

    // 3. Décision QR simulée via le seam → mode « saisie du montant ».
    await page.waitForFunction(() => typeof (window as unknown as { __e2eDecode?: unknown }).__e2eDecode === "function");
    await page.evaluate(() =>
      (window as unknown as { __e2eDecode: (c: string) => void }).__e2eDecode("e2e-card-amount"),
    );

    // 4. Le pavé numérique (AmountPad) est affiché.
    await expect(page.getByText("Montant de l’achat")).toBeVisible();

    // 5. Saisie « 25.50 » CHF (séparateur virgule à la suisse).
    await page.getByRole("button", { name: "2", exact: true }).click();
    await page.getByRole("button", { name: "5", exact: true }).click();
    await page.getByRole("button", { name: "virgule" }).click();
    await page.getByRole("button", { name: "5", exact: true }).click();
    await page.getByRole("button", { name: "0", exact: true }).click();
    // Le bouton VALIDER reflète le montant saisi → preuve sans ambiguïté de « 25.50 »
    // (l'<output> du montant porte le même texte, d'où le ciblage sur le bouton).
    const valider = page.getByRole("button", { name: "VALIDER CHF 25.50" });
    await expect(valider).toBeVisible();

    // 6. On arme la réponse du crédit (25 points), puis VALIDER.
    scanApi.mockScan({ success: true, rewardReady: false, pointsEarned: 25 });
    await valider.click();

    // 7. Crédit confirmé : toast « +25 points crédités ».
    const toast = page.getByRole("status");
    await expect(toast).toBeVisible();
    await expect(toast).toContainText("+25 points crédités");
  });
});
