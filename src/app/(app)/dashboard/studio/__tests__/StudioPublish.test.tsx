// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import StudioClient from "../StudioClient";

// Régression Important 1 (revue finale cartes-à-points) : la porte à sens unique
// points→stamps. Un marchand dont merchants.loyalty_type vaut encore "points"
// republie un design TAMPONS (cardType: 'stamps') sans jamais faire basculer le
// programme côté serveur — comptoir points + pass tampons restaient incohérents,
// sans retour self-serve. StudioClient doit désormais envoyer un `program`
// stamp_card explicite dans CE cas précis, et dans ce cas SEULEMENT (jamais pour
// un marchand déjà stamp_card/visit_based/tiered, sous peine d'écraser
// welcome_stamps/intermediate_milestone/milestones existants).
//
// Régression Minor 6 : l'aperçu Studio d'une carte à points affiche désormais
// « x / maxThreshold » (fidèle au pass réel), jamais un nombre brut.

const pushSpy = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushSpy }) }));

vi.mock("../_components/TemplateGallery", () => ({ default: () => <div /> }));
vi.mock("../_components/ColorsSection", () => ({ default: () => <div /> }));
vi.mock("../_components/StampsSection", () => ({ default: () => <div /> }));
vi.mock("../_components/PointsSection", () => ({
  default: () => <div data-testid="points-section" />,
  DEFAULT_POINTS_RULES: { pointsPerScan: 10, tiers: [{ threshold: 100, reward: "10% de réduction" }], expiration: { type: "none" } },
}));
vi.mock("../_components/FieldsSection", () => ({ default: () => <div /> }));
vi.mock("../_components/BarcodeSection", () => ({ default: () => <div /> }));
vi.mock("../_components/ImageUploadField", () => ({ default: () => <div /> }));
vi.mock("../_components/StampGrid", () => ({ default: () => <div /> }));

const previewSamples = vi.hoisted(() => [] as { who: string; points: string }[]);
vi.mock("../_components/WalletPreviews", () => ({
  AppleWalletPreview: (props: { sample: { points: string } }) => {
    previewSamples.push({ who: "apple", points: props.sample.points });
    return <div data-testid="apple-preview">{props.sample.points}</div>;
  },
  GoogleWalletPreview: (props: { sample: { points: string } }) => {
    previewSamples.push({ who: "google", points: props.sample.points });
    return <div data-testid="google-preview">{props.sample.points}</div>;
  },
}));

function jsonOk(data: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data) } as Response);
}

const STAMPS_DESIGN = {
  colors: { background: "#0D6B5E", foreground: "#FFFFFF", label: "#BFEEE6" },
  programName: "Carte de fidélité",
  logo: {},
  fields: [{ id: "points", zone: "primary", label: "TAMPONS", value: "{points}", order: 0 }],
  barcode: { type: "QR", source: "card_token" },
  cardType: "stamps",
  stamps: { goal: 10, icon: "☕", shape: "circle" },
};

let fetchMock: ReturnType<typeof vi.fn>;

function setupFetch(merchantLoyaltyType: string) {
  fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url.includes("/api/merchant/card-design/publish")) return jsonOk({ ok: true, version: 1 });
    if (url.includes("/api/merchant/card-design") && method === "GET") {
      return jsonOk({
        published: STAMPS_DESIGN,
        draft: null,
        version: 3,
        publishedAt: "2026-08-01T00:00:00Z",
        draftSavedAt: null,
        assetUrls: {},
        merchant: {
          shopName: "Café du Rhône",
          businessType: "cafe",
          stampGoal: 10,
          slug: "cafe-du-rhone",
          loyaltyType: merchantLoyaltyType,
          loyaltyConfig: null,
        },
      });
    }
    if (url.includes("/api/merchant/me") && method === "GET") return jsonOk({ merchant: { reward_label: null } });
    return jsonOk({});
  });
  vi.stubGlobal("fetch", fetchMock);
}

beforeEach(() => {
  pushSpy.mockReset();
  previewSamples.length = 0;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function publishCallBody(): Record<string, unknown> | undefined {
  const call = fetchMock.mock.calls.find(
    (c) => String(c[0]).includes("/api/merchant/card-design/publish") && (c[1] as RequestInit)?.method === "POST"
  );
  if (!call) return undefined;
  return JSON.parse(String((call[1] as RequestInit).body));
}

describe("StudioClient — publication d'une carte à tampons (Important 1)", () => {
  it("marchand déjà stamp_card : republier des tampons n'envoie AUCUN `program`", async () => {
    setupFetch("stamp_card");
    render(<StudioClient />);
    await screen.findByText(/studio de carte/i);
    const publishBtn = await screen.findByRole("button", { name: /publier la version/i });
    fireEvent.click(publishBtn);
    await waitFor(() => expect(publishCallBody()).toBeTruthy());
    const body = publishCallBody()!;
    expect(body.program).toBeUndefined();
  });

  it("marchand encore « points » : republier des tampons envoie un `program` stamp_card (bascule explicite)", async () => {
    setupFetch("points");
    render(<StudioClient />);
    await screen.findByText(/studio de carte/i);
    const publishBtn = await screen.findByRole("button", { name: /publier la version/i });
    fireEvent.click(publishBtn);
    await waitFor(() => expect(publishCallBody()).toBeTruthy());
    const body = publishCallBody()!;
    expect(body.program).toEqual({ type: "stamp_card", goal: 10 });
  });
});

describe("StudioClient — aperçu d'une carte à points (Minor 6)", () => {
  it("le jeton {points} de l'aperçu prend la forme « x / maxThreshold », jamais un nombre brut", async () => {
    fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url.includes("/api/merchant/card-design") && method === "GET") {
        return jsonOk({
          published: null,
          draft: {
            ...STAMPS_DESIGN,
            cardType: "points",
            fields: [{ id: "points", zone: "primary", label: "POINTS", value: "{points}", order: 0 }],
          },
          version: 1,
          publishedAt: null,
          draftSavedAt: null,
          assetUrls: {},
          merchant: {
            shopName: "Café du Rhône",
            businessType: "cafe",
            stampGoal: 10,
            slug: "cafe-du-rhone",
            loyaltyType: "points",
            loyaltyConfig: { pointsPerScan: 5, tiers: [{ threshold: 30, reward: "Café offert" }, { threshold: 80, reward: "Menu offert" }] },
          },
        });
      }
      if (url.includes("/api/merchant/me") && method === "GET") return jsonOk({ merchant: { reward_label: null } });
      return jsonOk({});
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<StudioClient />);
    await screen.findByText(/studio de carte/i);

    await waitFor(() => expect(previewSamples.length).toBeGreaterThan(0));
    // Dernier palier = 80 → mi-parcours = 40 → « 40 / 80 » (jamais un nombre seul).
    for (const s of previewSamples) {
      expect(s.points).toMatch(/^\d+ \/ \d+$/);
    }
    expect(previewSamples.some((s) => s.points === "40 / 80")).toBe(true);
  });
});
