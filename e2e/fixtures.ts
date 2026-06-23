import { test as base, expect, type Route } from "@playwright/test";

type JsonBody = Record<string, unknown>;

// Mock des routes de crédit du comptoir. Le test déclare la réponse attendue ;
// toute requête /api/scan*, /api/scan/redeem*, /api/redeem* non mockée est
// COUPÉE et fait échouer le test (filet anti-écriture-prod ci-dessous).
export class ScanApiMock {
  private scanResponse: JsonBody | null = null;
  private redeemResponse: JsonBody | null = null;
  /** URLs de scan/redeem arrivées sans mock — doit rester vide. */
  readonly unexpected: string[] = [];

  /** Réponse simulée de POST /api/scan (crédit tampon ou points). */
  mockScan(body: JsonBody): void {
    this.scanResponse = body;
  }

  /** Réponse simulée de POST /api/scan/redeem (encaissement récompense). */
  mockRedeem(body: JsonBody): void {
    this.redeemResponse = body;
  }

  /** @internal résout la réponse pour une URL (redeem prioritaire sur scan). */
  resolve(url: string): JsonBody | null {
    if (/\/api\/(scan\/redeem|redeem)(\/|$|\?)/.test(url)) return this.redeemResponse;
    if (/\/api\/scan(\/|$|\?)/.test(url)) return this.scanResponse;
    return null;
  }
}

// Fixture `scanApi` : installe le FILET ANTI-ÉCRITURE-PROD (consigne CHEF #5).
// Aucune requête de crédit ne doit JAMAIS atteindre la vraie Supabase :
//   - si le test a fourni un mock → on répond 200 + JSON ;
//   - sinon → route.abort() ET on enregistre l'appel → échec explicite en fin
//     de test. Un mock oublié ne peut donc pas polluer la base réelle.
export const test = base.extend<{ scanApi: ScanApiMock }>({
  scanApi: async ({ page }, use) => {
    const api = new ScanApiMock();
    await page.route(/\/api\/(scan|redeem)(\/|$|\?)/, async (route: Route) => {
      const url = route.request().url();
      const body = api.resolve(url);
      if (body) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(body),
        });
      } else {
        api.unexpected.push(url);
        await route.abort();
      }
    });

    await use(api);

    expect(
      api.unexpected,
      `Appel(s) de crédit non mocké(s) — risque d'écriture en prod : ${api.unexpected.join(", ")}`,
    ).toEqual([]);
  },
});

export { expect };
