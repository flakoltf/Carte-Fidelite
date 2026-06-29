import { test, expect } from "./fixtures";

// E2E-2 — Parcours comptoir « carte à tampons » (stamp_card), bout en bout.
// Compte : Café du Rhône (storageState du projet setup). Le crédit /api/scan est
// mocké (filet anti-écriture-prod) ; le décodage QR est déclenché par le seam
// window.__e2eDecode (pas de vraie caméra en headless).
test.describe("Comptoir — tampon (stamp_card)", () => {
  test("dashboard → scan → toast « Tampon ajouté » → retour auto scanner (UXP-3)", async ({
    page,
    scanApi,
  }) => {
    // 1. /dashboard → ComptoirHome : le bouton SCANNER géant est visible.
    await page.goto("/dashboard");
    const scanner = page.getByRole("button", { name: "Scanner une carte" });
    await expect(scanner).toBeVisible();

    // 2. Clic SCANNER → navigation vers /dashboard/scan.
    await scanner.click();
    await expect(page).toHaveURL(/\/dashboard\/scan(\/|$|\?)/);

    // 3. On arme le mock du crédit, puis on déclenche la décision QR via le seam.
    scanApi.mockScan({
      success: true,
      rewardReady: false,
      card: { customers: { full_name: "Sophie Meier" } },
    });
    await page.waitForFunction(() => typeof (window as unknown as { __e2eDecode?: unknown }).__e2eDecode === "function");
    await page.evaluate(() =>
      (window as unknown as { __e2eDecode: (c: string) => void }).__e2eDecode("e2e-card-stamp"),
    );

    // 4. Toast de confirmation « Tampon ajouté » (role=status).
    const toast = page.getByRole("status");
    await expect(toast).toBeVisible();
    await expect(toast).toContainText("Tampon ajouté");

    // 5. UXP-3 « scan continu » : sans aucun tap, la caméra se relance seule après
    //    ~1,5 s. Le lecteur QR (#comptoir-reader) réapparaît → retour au scan prouvé.
    await expect(page.locator("#comptoir-reader")).toBeVisible({ timeout: 5_000 });
  });
});
