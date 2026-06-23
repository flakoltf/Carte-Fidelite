// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import StudioClient from "../StudioClient";

// Routeur App : on espionne push (navigation après validation).
const pushSpy = vi.hoisted(() => vi.fn());
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushSpy }) }));

// Enfants lourds de l'éditeur complet : neutralisés (le mode normal les monte).
vi.mock("../_components/TemplateGallery", () => ({ default: () => <div /> }));
vi.mock("../_components/ColorsSection", () => ({ default: () => <div /> }));
vi.mock("../_components/StampsSection", () => ({ default: () => <div /> }));
vi.mock("../_components/FieldsSection", () => ({ default: () => <div /> }));
vi.mock("../_components/BarcodeSection", () => ({ default: () => <div /> }));
vi.mock("../_components/ImageUploadField", () => ({ default: () => <div /> }));
vi.mock("../_components/StampGrid", () => ({ default: () => <div /> }));
vi.mock("../_components/WalletPreviews", () => ({
  AppleWalletPreview: () => <div />,
  GoogleWalletPreview: () => <div />,
}));

const PAYLOAD = {
  published: null,
  draft: null,
  version: 0,
  publishedAt: null,
  draftSavedAt: null,
  assetUrls: {},
  merchant: { shopName: "Café du Rhône", businessType: "cafe", stampGoal: 10, slug: "cafe-du-rhone" },
};

function jsonOk(data: unknown) {
  return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(data) } as Response);
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  pushSpy.mockReset();
  fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url.includes("/api/merchant/card-design") && method === "GET") return jsonOk(PAYLOAD);
    if (url.includes("/api/merchant/me") && method === "GET") return jsonOk({ merchant: { reward_label: null } });
    if (url.includes("/api/merchant/me") && method === "PATCH") return jsonOk({ ok: true });
    if (url.includes("/api/merchant/card-design") && method === "PUT") return jsonOk({ draftSavedAt: "now" });
    return jsonOk({});
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("StudioClient — mode express (?express=1)", () => {
  it("affiche la bannière « pré-remplie », les 3 champs et le gros bouton de validation", async () => {
    render(<StudioClient express />);
    expect(await screen.findByText(/vérifiez et validez/i)).toBeTruthy();
    expect(screen.getByLabelText(/couleur principale/i)).toBeTruthy();
    expect(screen.getByLabelText(/nom du programme/i)).toBeTruthy();
    expect(screen.getByLabelText(/récompense/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /personnaliser plus/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /valider et continuer/i })).toBeTruthy();
  });

  it("validation impossible tant que la récompense est vide", async () => {
    render(<StudioClient express />);
    await screen.findByText(/vérifiez et validez/i);
    const validate = screen.getByRole("button", { name: /valider et continuer/i }) as HTMLButtonElement;
    expect(validate.disabled).toBe(true);
  });

  it("validation : enregistre la récompense + le brouillon, puis va vers /dashboard/card", async () => {
    render(<StudioClient express />);
    await screen.findByText(/vérifiez et validez/i);
    fireEvent.change(screen.getByLabelText(/récompense/i), { target: { value: "Le 10e café offert" } });
    fireEvent.click(screen.getByRole("button", { name: /valider et continuer/i }));

    await waitFor(() => expect(pushSpy).toHaveBeenCalledWith("/dashboard/card"));

    const calls = fetchMock.mock.calls.map((c) => ({ url: String(c[0]), init: c[1] as RequestInit | undefined }));
    const patch = calls.find((c) => c.url.includes("/api/merchant/me") && c.init?.method === "PATCH");
    expect(patch).toBeTruthy();
    expect(String(patch!.init!.body)).toContain("Le 10e café offert");
    expect(calls.some((c) => c.url.includes("/api/merchant/card-design") && c.init?.method === "PUT")).toBe(true);
  });

  it("mode normal (sans express) : pas de bannière express", async () => {
    render(<StudioClient />);
    // L'en-tête normal apparaît, jamais la bannière express.
    expect(await screen.findByText(/studio de carte/i)).toBeTruthy();
    expect(screen.queryByText(/vérifiez et validez/i)).toBeNull();
  });
});
