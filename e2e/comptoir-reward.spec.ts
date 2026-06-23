import { test, expect } from "./fixtures";

// E2E-4 — Parcours comptoir « offrir la récompense » (RedeemFullScreen), bout en
// bout. Le scan renvoie rewardReady (mock /api/scan) → écran doré 1-tap ; OFFRIR
// encaisse (mock /api/scan/redeem) → célébration UXP-2 puis retour auto au Comptoir.
// Aucune écriture en prod (les deux routes sont mockées par le filet `scanApi`).
test.describe("Comptoir — offrir la récompense (reward)", () => {
  test("scan rewardReady → RedeemFullScreen → OFFRIR → animation rapide (UXP-2) → retour Comptoir", async ({
    page,
    scanApi,
  }) => {
    // 1. /dashboard → ComptoirHome, puis SCANNER → /dashboard/scan.
    await page.goto("/dashboard");
    const scanner = page.getByRole("button", { name: "Scanner une carte" });
    await expect(scanner).toBeVisible();
    await scanner.click();
    await expect(page).toHaveURL(/\/dashboard\/scan(\/|$|\?)/);

    // 2. Scan « carte au seuil » : la réponse porte rewardReady → écran « Offrir ».
    scanApi.mockScan({ success: true, rewardReady: true });
    await page.waitForFunction(() => typeof (window as unknown as { __e2eDecode?: unknown }).__e2eDecode === "function");
    await page.evaluate(() =>
      (window as unknown as { __e2eDecode: (c: string) => void }).__e2eDecode("e2e-card-reward"),
    );

    // 3. RedeemFullScreen visible + libellé de récompense (heading) affiché.
    const dialog = page.getByRole("dialog", { name: "Offrir la récompense" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { level: 1 })).toBeVisible();

    const offrir = page.getByRole("button", { name: /OFFRIR/ });
    await expect(offrir).toBeVisible();

    // 4. OFFRIR → encaissement mocké → célébration. UXP-2 : la célébration est
    //    snappy — l'état « offert » (bouton OFFRIR retiré) apparaît bien sous 700 ms
    //    (avant même le timer de redirection REDIRECT_MS=600).
    scanApi.mockRedeem({ success: true });
    const t0 = Date.now();
    await offrir.click();
    await expect(offrir).toBeHidden();
    const elapsed = Date.now() - t0;
    expect(elapsed, `animation succès trop lente (${elapsed} ms) — UXP-2 attend < 700 ms`).toBeLessThan(700);

    // 5. Retour automatique à ComptoirHome après l'animation (REDIRECT_MS=600),
    //    sans aucun tap : le bouton SCANNER géant réapparaît.
    await expect(page.getByRole("button", { name: "Scanner une carte" })).toBeVisible({ timeout: 5_000 });
  });
});
