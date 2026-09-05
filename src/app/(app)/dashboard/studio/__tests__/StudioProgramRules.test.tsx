// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import StudioClient from "../StudioClient";

// Studio « règles complètes » : le commerçant configure les 5 mécaniques du
// moteur sans passer par l'admin, et la publication round-trippe TOUTES les
// clés de loyalty_config (une clé perdue = effacement silencieux en base).

const pushSpy = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushSpy }) }));
vi.mock("../_components/TemplateGallery", () => ({ default: () => <div /> }));
vi.mock("../_components/ColorsSection", () => ({ default: () => <div /> }));
vi.mock("../_components/FieldsSection", () => ({ default: () => <div /> }));
vi.mock("../_components/BarcodeSection", () => ({ default: () => <div /> }));
vi.mock("../_components/ImageUploadField", () => ({ default: () => <div /> }));
vi.mock("../_components/StampGrid", () => ({ default: () => <div /> }));

type CapturedSample = Record<string, string>;
const previewSamples = vi.hoisted(() => [] as CapturedSample[]);
vi.mock("../_components/WalletPreviews", () => ({
  AppleWalletPreview: (props: { sample: Record<string, string> }) => {
    previewSamples.push(props.sample);
    return <div data-testid="apple-preview" />;
  },
  GoogleWalletPreview: (props: { sample: Record<string, string> }) => {
    previewSamples.push(props.sample);
    return <div data-testid="google-preview" />;
  },
}));

function jsonOk(data: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data) } as Response);
}

const BASE_DESIGN = {
  colors: { background: "#0D6B5E", foreground: "#FFFFFF", label: "#BFEEE6" },
  programName: "Carte de fidélité",
  logo: {},
  fields: [{ id: "points", zone: "primary", label: "TAMPONS", value: "{points}", order: 0 }],
  barcode: { type: "QR", source: "card_token" },
  cardType: "stamps",
  stamps: { goal: 10, icon: "☕", shape: "circle" },
};

let fetchMock: ReturnType<typeof vi.fn>;

function setup(
  loyaltyType: string,
  loyaltyConfig: Record<string, unknown> | null,
  cardType: "stamps" | "points" = "stamps",
  opts: { withoutStamps?: boolean; stampGoal?: number } = {}
) {
  const design: Record<string, unknown> = { ...BASE_DESIGN, cardType };
  if (opts.withoutStamps) delete design.stamps;
  fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url.includes("/api/merchant/card-design/publish")) return jsonOk({ ok: true, version: 2 });
    if (url.includes("/api/merchant/card-design") && method === "GET") {
      return jsonOk({
        published: design,
        draft: null,
        version: 1,
        publishedAt: "2026-08-01T00:00:00Z",
        draftSavedAt: null,
        assetUrls: {},
        merchant: { shopName: "Café du Rhône", businessType: "cafe", stampGoal: opts.stampGoal ?? 10, slug: "cafe-du-rhone", loyaltyType, loyaltyConfig },
      });
    }
    if (url.includes("/api/merchant/me") && method === "GET") return jsonOk({ merchant: { reward_label: null } });
    return jsonOk({});
  });
  vi.stubGlobal("fetch", fetchMock);
}

function publishBody(): Record<string, unknown> | undefined {
  const call = fetchMock.mock.calls.find(
    (c) => String(c[0]).includes("/api/merchant/card-design/publish") && (c[1] as RequestInit)?.method === "POST"
  );
  return call ? JSON.parse(String((call[1] as RequestInit).body)) : undefined;
}

async function renderAndPublish() {
  render(<StudioClient />);
  await screen.findByText(/studio de carte/i);
  fireEvent.click(await screen.findByRole("button", { name: /publier la version/i }));
  await waitFor(() => expect(publishBody()).toBeTruthy());
  return publishBody()!.program as Record<string, unknown>;
}

beforeEach(() => {
  previewSamples.length = 0;
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("StudioClient — publication round-trip de TOUTES les mécaniques", () => {
  it("stamp_card : welcome_stamps et intermediate_milestone chargés ressortent à la publication", async () => {
    setup("stamp_card", { goal: 10, welcome_stamps: 1, intermediate_milestone: 5 });
    const program = await renderAndPublish();
    expect(program).toEqual({ type: "stamp_card", goal: 10, welcome_stamps: 1, intermediate_milestone: 5 });
  });

  it("stamp_card sans option : programme explicite (objectif du Studio = objectif moteur)", async () => {
    setup("stamp_card", { goal: 10 });
    const program = await renderAndPublish();
    expect(program).toMatchObject({ type: "stamp_card", goal: 10, welcome_stamps: 0, intermediate_milestone: null });
  });

  it("stamp_card à visuel « points » sans grille (kit démo) : l'objectif publié est celui de loyalty_config, jamais le défaut 10", async () => {
    setup("stamp_card", { goal: 8, welcome_stamps: 1 }, "points", { withoutStamps: true, stampGoal: 8 });
    render(<StudioClient />);
    await screen.findByText(/studio de carte/i);
    // La récompense intermédiaire se borne aussi sur l'objectif réel (2..7).
    const sel = screen.getByRole("combobox", { name: /récompense intermédiaire/i });
    const values = within(sel).getAllByRole("option").map((o) => (o as HTMLOptionElement).value);
    expect(values).toEqual(["", "2", "3", "4", "5", "6", "7"]);
    fireEvent.click(screen.getByRole("button", { name: /publier la version/i }));
    await waitFor(() => expect(publishBody()).toBeTruthy());
    expect(publishBody()!.program).toEqual({ type: "stamp_card", goal: 8, welcome_stamps: 1, intermediate_milestone: null });
  });

  it("stamp_card : l'échéance glissante chargée ressort à la publication", async () => {
    setup("stamp_card", { goal: 10, expiration: { type: "rolling", months: 6 } });
    const program = await renderAndPublish();
    expect(program).toMatchObject({ type: "stamp_card", goal: 10, config: { expiration: { type: "rolling", months: 6 } } });
  });

  it("stamp_card : activer l'échéance glissante au Studio → publiée", async () => {
    setup("stamp_card", { goal: 10 });
    render(<StudioClient />);
    await screen.findByText(/studio de carte/i);
    fireEvent.change(screen.getByRole("combobox", { name: /expiration des tampons/i }), { target: { value: "rolling" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: /durée avant expiration en mois/i }), { target: { value: "9" } });
    fireEvent.click(screen.getByRole("button", { name: /publier la version/i }));
    await waitFor(() => expect(publishBody()).toBeTruthy());
    expect(publishBody()!.program).toMatchObject({ type: "stamp_card", config: { expiration: { type: "rolling", months: 9 } } });
  });

  it("amount_points : l'échéance glissante chargée ressort intacte", async () => {
    setup(
      "amount_points",
      { type: "amount_points", pointsPerChf: 1, rewardThreshold: 200, rewardLabel: "CHF 20 offerts", expiration: { type: "rolling", months: 12 } },
      "points"
    );
    const program = await renderAndPublish();
    expect(program).toMatchObject({ type: "amount_points", config: { expiration: { type: "rolling", months: 12 } } });
  });

  it("visit_based : les paliers chargés ressortent intacts", async () => {
    setup("visit_based", { milestones: [5, 20, 50] });
    const program = await renderAndPublish();
    expect(program).toEqual({ type: "visit_based", config: { milestones: [5, 20, 50] } });
  });

  it("tiered : les niveaux chargés ressortent intacts", async () => {
    const tiers = [{ name: "Bronze", at: 1 }, { name: "Argent", at: 10 }, { name: "Or", at: 30 }];
    setup("tiered", { tiers }, "points");
    const program = await renderAndPublish();
    expect(program).toEqual({ type: "tiered", config: { tiers } });
  });

  it("amount_points : maxPointsPerScan (réglé par l'admin) n'est PAS perdu", async () => {
    setup("amount_points", { type: "amount_points", pointsPerChf: 1.5, rewardThreshold: 200, rewardLabel: "CHF 20 offerts", maxPointsPerScan: 300 }, "points");
    const program = await renderAndPublish();
    expect(program).toEqual({
      type: "amount_points",
      config: { pointsPerChf: 1.5, rewardThreshold: 200, rewardLabel: "CHF 20 offerts", maxPointsPerScan: 300 },
    });
  });
});

describe("StudioClient — éditeurs des règles", () => {
  it("stamp_card : activer le tampon de bienvenue et une récompense intermédiaire → publiés", async () => {
    setup("stamp_card", { goal: 10 });
    render(<StudioClient />);
    await screen.findByText(/studio de carte/i);
    fireEvent.click(screen.getByRole("checkbox", { name: /tampon de bienvenue/i }));
    fireEvent.change(screen.getByRole("combobox", { name: /récompense intermédiaire/i }), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /publier la version/i }));
    await waitFor(() => expect(publishBody()).toBeTruthy());
    expect(publishBody()!.program).toEqual({ type: "stamp_card", goal: 10, welcome_stamps: 1, intermediate_milestone: 5 });
  });

  it("tiered : éditeur de niveaux présent, seuils non croissants → erreur moteur affichée et publication bloquée", async () => {
    setup("tiered", { tiers: [{ name: "Argent", at: 10 }, { name: "Or", at: 30 }] }, "points");
    render(<StudioClient />);
    await screen.findByText(/studio de carte/i);
    const seuil2 = screen.getByRole("spinbutton", { name: /seuil du niveau 2/i });
    fireEvent.change(seuil2, { target: { value: "5" } });
    expect(await screen.findByText(/seuils de niveaux strictement croissants/i)).toBeTruthy();
    expect((screen.getByRole("button", { name: /publier la version/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("tiered : ajouter un niveau → publié avec le nouveau niveau", async () => {
    setup("tiered", { tiers: [{ name: "Argent", at: 10 }] }, "points");
    render(<StudioClient />);
    await screen.findByText(/studio de carte/i);
    fireEvent.click(screen.getByRole("button", { name: /ajouter un niveau/i }));
    fireEvent.change(screen.getByRole("textbox", { name: /nom du niveau 2/i }), { target: { value: "Or" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: /seuil du niveau 2/i }), { target: { value: "25" } });
    fireEvent.click(screen.getByRole("button", { name: /publier la version/i }));
    await waitFor(() => expect(publishBody()).toBeTruthy());
    expect(publishBody()!.program).toEqual({ type: "tiered", config: { tiers: [{ name: "Argent", at: 10 }, { name: "Or", at: 25 }] } });
  });

  it("visit_based : modifier un palier → publié", async () => {
    setup("visit_based", { milestones: [5, 20] });
    render(<StudioClient />);
    await screen.findByText(/studio de carte/i);
    fireEvent.change(screen.getByRole("spinbutton", { name: /palier 2/i }), { target: { value: "25" } });
    fireEvent.click(screen.getByRole("button", { name: /publier la version/i }));
    await waitFor(() => expect(publishBody()).toBeTruthy());
    expect(publishBody()!.program).toEqual({ type: "visit_based", config: { milestones: [5, 25] } });
  });

  it("changer de mécanique (tampons → niveaux) bascule le visuel en carte à points et publie le nouveau type", async () => {
    setup("stamp_card", { goal: 10 });
    render(<StudioClient />);
    await screen.findByText(/studio de carte/i);
    fireEvent.click(screen.getByRole("radio", { name: /niveaux par visites/i }));
    fireEvent.click(screen.getByRole("button", { name: /publier la version/i }));
    await waitFor(() => expect(publishBody()).toBeTruthy());
    const body = publishBody()!;
    expect((body.design as { cardType: string }).cardType).toBe("points");
    expect((body.program as { type: string }).type).toBe("tiered");
  });
});

describe("StudioClient — aperçu cohérent avec les règles", () => {
  it("tiered : {palier} = plus haut niveau configuré, {progression} vers le prochain niveau", async () => {
    setup("tiered", { tiers: [{ name: "Bronze", at: 1 }, { name: "Argent", at: 10 }, { name: "Or", at: 30 }] }, "points");
    render(<StudioClient />);
    await screen.findByText(/studio de carte/i);
    await waitFor(() => expect(previewSamples.length).toBeGreaterThan(0));
    expect(previewSamples.some((s) => s.palier === "Or")).toBe(true);
    // Client fictif = 7 visites → prochain niveau Argent à 10.
    expect(previewSamples.some((s) => s.progression === "7/10 visites")).toBe(true);
  });

  it("visit_based : {progression} vers le prochain palier de visites", async () => {
    setup("visit_based", { milestones: [5, 20, 50] });
    render(<StudioClient />);
    await screen.findByText(/studio de carte/i);
    await waitFor(() => expect(previewSamples.length).toBeGreaterThan(0));
    expect(previewSamples.some((s) => s.progression === "7/20 visites")).toBe(true);
  });

  it("stamp_card avec récompense intermédiaire : l'aide affiche le tampon concerné", async () => {
    setup("stamp_card", { goal: 10, intermediate_milestone: 5 });
    render(<StudioClient />);
    await screen.findByText(/studio de carte/i);
    const sel = screen.getByRole("combobox", { name: /récompense intermédiaire/i }) as HTMLSelectElement;
    expect(sel.value).toBe("5");
    // Options strictement entre 1 et l'objectif : 2..9.
    const values = within(sel).getAllByRole("option").map((o) => (o as HTMLOptionElement).value);
    expect(values).toEqual(["", "2", "3", "4", "5", "6", "7", "8", "9"]);
  });
});
