import { test, expect } from "@playwright/test";

// Régression « fond noir » : dans le dashboard (Studio en tête), on pouvait
// défiler le DOCUMENT au-delà de la coque et découvrir le fond du body — noir
// quand l'OS est en mode sombre. Causes mesurées : inputs fichier `sr-only`
// (position absolue, hors conteneur de défilement) qui allongeaient le document,
// bannière d'essai empilée au-dessus d'une coque 100vh, body noir en dark.
// Le seul défilement autorisé est celui de <main> ; le document ne bouge pas.
const PAGES = ["/dashboard/studio", "/dashboard", "/dashboard/customers"];

async function measure(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const se = document.scrollingElement!;
    const main = document.querySelector("main")!;
    main.scrollTop = main.scrollHeight;
    window.scrollTo(0, se.scrollHeight);
    return {
      docScrollable: se.scrollHeight > se.clientHeight + 1,
      windowScrollY: window.scrollY,
      bodyBg: getComputedStyle(document.body).backgroundColor,
      mainBg: getComputedStyle(main).backgroundColor,
    };
  });
}

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`dashboard — aucun espace mort défilable (${colorScheme})`, () => {
    test.use({ colorScheme });

    for (const path of PAGES) {
      test(`${path} : seul <main> défile, fond de fin de page = thème`, async ({ page }) => {
        await page.goto(path);
        await expect(page.locator("main")).toBeVisible();
        await page.waitForTimeout(500);
        const m = await measure(page);
        expect(m.docScrollable, "le document ne doit pas défiler").toBe(false);
        expect(m.windowScrollY).toBe(0);
        // Jamais de noir : le fond visible en fin de page est celui du thème.
        expect(m.bodyBg).not.toBe("rgb(10, 10, 10)");
        expect(m.mainBg).toBe("rgb(243, 240, 233)"); // calcaire
      });
    }
  });
}

test.describe("dashboard — grand écran", () => {
  // Même moteur (chromium) que le projet mobile : seul le viewport change.
  test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, colorScheme: "dark" });
  test("/dashboard/studio : aucun espace mort défilable sur grand écran", async ({ page }) => {
    await page.goto("/dashboard/studio");
    await expect(page.locator("main")).toBeVisible();
    await page.waitForTimeout(500);
    const m = await measure(page);
    expect(m.docScrollable).toBe(false);
    expect(m.bodyBg).not.toBe("rgb(10, 10, 10)");
  });
});
