// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";
import ComptoirScan from "../ComptoirScan";

// Flux comptoir amount_points : scan → <AmountPad> → POST /api/scan { amountChf }
// → si rewardReady, <RedeemFullScreen>. Les autres types ne montrent pas le pavé.

// Caméra : on capte le callback de décodage pour le déclencher à la main.
const h = vi.hoisted(() => ({ decode: null as ((t: string) => void) | null }));
vi.mock("html5-qrcode", () => ({
  Html5Qrcode: class {
    constructor(_id: string) {}
    start(_c: unknown, _o: unknown, onDecode: (t: string) => void) {
      h.decode = onDecode;
      return Promise.resolve();
    }
    stop() {
      return Promise.resolve();
    }
    clear() {}
  },
  Html5QrcodeSupportedFormats: { QR_CODE: 0 },
}));

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
  useReducedMotion: () => false,
  motion: new Proxy(
    {},
    {
      get: (_t, tag: string) => {
        const Tag = tag as "div" | "span";
        return ({ children, ...rest }: { children?: ReactNode }) => {
          const { initial, animate, exit, transition, ...dom } = rest as Record<string, unknown>;
          void initial;
          void animate;
          void exit;
          void transition;
          return <Tag {...(dom as object)}>{children}</Tag>;
        };
      },
    },
  ),
}));

async function scanCard(cardId = "QR-CARD") {
  fireEvent.click(screen.getByText("Démarrer le scan"));
  await act(async () => {
    h.decode?.(cardId);
  });
}

describe("<ComptoirScan> — flux amount_points", () => {
  beforeEach(() => {
    push.mockReset();
    h.decode = null;
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("affiche <AmountPad> après le scan pour un programme amount_points", async () => {
    render(<ComptoirScan programType="amount_points" rewardLabel="☕ Café offert" />);
    await scanCard();
    expect(await screen.findByText("Montant de l’achat")).toBeTruthy();
    // pavé : on retrouve la touche « virgule » et le bouton VALIDER.
    expect(screen.getByRole("button", { name: "virgule" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /valider/i })).toBeTruthy();
  });

  it("onConfirm poste /api/scan avec amountChf, et rewardReady ouvre RedeemFullScreen", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, rewardReady: true, rewardLabel: "☕ Café offert", pointsEarned: 5, currentValue: 120 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ComptoirScan programType="amount_points" rewardLabel="☕ Café offert" />);
    await scanCard();
    await screen.findByText("Montant de l’achat");

    // Saisie 12,50 CHF.
    ["1", "2"].forEach((d) => fireEvent.click(screen.getByRole("button", { name: d })));
    fireEvent.click(screen.getByRole("button", { name: "virgule" }));
    ["5", "0"].forEach((d) => fireEvent.click(screen.getByRole("button", { name: d })));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /valider/i }));
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/scan");
    expect(JSON.parse(init.body)).toEqual({ cardId: "QR-CARD", amountChf: 12.5 });

    // rewardReady → écran doré « Offrir la récompense ».
    expect(await screen.findByRole("dialog", { name: /offrir la récompense/i })).toBeTruthy();
  });

  it("amount_points sans reward : crédit direct + message points, pas de RedeemFullScreen", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, rewardReady: false, pointsEarned: 3, currentValue: 23 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ComptoirScan programType="amount_points" rewardLabel="☕ Café offert" />);
    await scanCard();
    await screen.findByText("Montant de l’achat");
    fireEvent.click(screen.getByRole("button", { name: "9" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /valider/i }));
    });
    expect(await screen.findByText("+3 points crédités")).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: /offrir la récompense/i })).toBeNull();
  });

  it("programme stamp_card : PAS de pavé montant, scan direct sur /api/scan", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, rewardReady: false, card: { customers: { full_name: "Nadia" } } }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ComptoirScan programType="stamp_card" rewardLabel="🎁 Récompense" />);
    await scanCard("QR-STAMP");

    // Pas d'AmountPad : crédit direct → on attend la confirmation « Tampon ajouté ».
    expect(screen.queryByText("Montant de l’achat")).toBeNull();
    expect(await screen.findByText(/Tampon ajouté/)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ cardId: "QR-STAMP" });
  });
});
