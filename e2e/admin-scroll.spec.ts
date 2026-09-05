import { test, expect } from "@playwright/test";

// Régression « espace mort défilable » côté ADMIN (bug n°3, audit PR #78) :
// AdminShell avait le patron du dashboard AVANT le correctif fond noir
// (min-h-screen + <main h-screen pt-24> + en-tête mobile fixed). Mesuré avant
// correctif (iPhone 13) : /admin/merchants/[id]/card laissait le document
// défiler de 117 px sous la coque (inputs fichier sr-only hors conteneur).
// Le seul défilement autorisé est celui de <main> ; le document ne bouge pas.
//
// Le marchand visé : E2E_ADMIN_MERCHANT_ID (défaut : Café du Rhône, démo).
test.skip(!process.env.E2E_ADMIN_PASSWORD, "E2E_ADMIN_PASSWORD absent : specs admin ignorées");

const MERCHANT_ID = process.env.E2E_ADMIN_MERCHANT_ID ?? "0d9a1c65-a51d-4c2b-9ed6-24b27e2011ea";
const PAGES = ["/admin", "/admin/merchants", `/admin/merchants/${MERCHANT_ID}`, `/admin/merchants/${MERCHANT_ID}/card`];

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
  test.describe(`admin — aucun espace mort défilable (${colorScheme})`, () => {
    test.use({ colorScheme });
    for (const path of PAGES) {
      test(`${path} : seul <main> défile, fond de fin de page = thème`, async ({ page }) => {
        await page.goto(path);
        await expect(page.locator("main")).toBeVisible();
        await page.waitForTimeout(500);
        const m = await measure(page);
        expect(m.docScrollable, "le document ne doit pas défiler").toBe(false);
        expect(m.windowScrollY).toBe(0);
        expect(m.bodyBg).not.toBe("rgb(10, 10, 10)");
        expect(m.mainBg).toBe("rgb(243, 240, 233)"); // calcaire
      });
    }
  });
}

test.describe("admin — grand écran", () => {
  test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, colorScheme: "dark" });
  test("/admin/merchants/[id]/card : aucun espace mort défilable sur grand écran", async ({ page }) => {
    await page.goto(`/admin/merchants/${MERCHANT_ID}/card`);
    await expect(page.locator("main")).toBeVisible();
    await page.waitForTimeout(500);
    const m = await measure(page);
    expect(m.docScrollable).toBe(false);
    expect(m.bodyBg).not.toBe("rgb(10, 10, 10)");
  });
});
