// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";
import ComptoirScan from "../ComptoirScan";

// Flux comptoir « points » (Task 12) : scan → crédit FIXE direct sur /api/scan
// (pas d'AmountPad, contrairement à amount_points) → toast solde si pas de
// palier validable, sinon <RedeemFullScreen> listant les paliers atteints.

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

describe("<ComptoirScan> — flux points", () => {
  beforeEach(() => {
    push.mockReset();
    h.decode = null;
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("scan direct sur /api/scan sans AmountPad pour un programme points", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true, loyaltyType: "points", currentValue: 8, pointsAdded: 4,
        added: true, rewardReady: false, redeemableTiers: [], maxThreshold: 20,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ComptoirScan programType="points" rewardLabel="🎁 Récompense offerte" />);
    await scanCard("QR-POINTS");

    expect(screen.queryByText("Montant de l’achat")).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/scan");
    expect(JSON.parse(init.body)).toEqual({ cardId: "QR-POINTS" });
  });

  it("sans palier validable : toast solde puis reprise du scan continu (une action)", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true, loyaltyType: "points", currentValue: 8, pointsAdded: 4,
        added: true, rewardReady: false, redeemableTiers: [], maxThreshold: 20,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ComptoirScan programType="points" rewardLabel="🎁 Récompense offerte" />);
    fireEvent.click(screen.getByText("Démarrer le scan"));
    await act(async () => {
      h.decode?.("QR-POINTS");
      await vi.advanceTimersByTimeAsync(0);
    });

    const toast = screen.getByRole("status");
    expect(toast.textContent).toContain("+4 points · 8 / 20");
    expect(screen.queryByRole("dialog", { name: /offrir la récompense/i })).toBeNull();
  });

  it("palier franchi (rewardReady) : ouvre RedeemFullScreen avec un bouton par palier, le max marqué « remet la carte à zéro »", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true, loyaltyType: "points", currentValue: 20, pointsAdded: 4,
        added: true, rewardReady: true,
        redeemableTiers: [
          { threshold: 10, reward: "☕ Café offert" },
          { threshold: 20, reward: "🥐 Petit-déjeuner offert" },
        ],
        maxThreshold: 20,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ComptoirScan programType="points" rewardLabel="🎁 Récompense offerte" />);
    await scanCard("QR-POINTS");

    expect(await screen.findByRole("dialog", { name: /offrir la récompense/i })).toBeTruthy();
    const cafe = screen.getByRole("button", { name: /☕ Café offert/ });
    expect(cafe.textContent).not.toContain("remet la carte à zéro");
    const petitDej = screen.getByRole("button", { name: /🥐 Petit-déjeuner offert/ });
    expect(petitDej.textContent).toContain("remet la carte à zéro");
  });

  it("carte pleine (added:false) mais rewardReady : ouvre aussi RedeemFullScreen (miroir stamps)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true, loyaltyType: "points", currentValue: 20, pointsAdded: 0,
        added: false, rewardReady: true,
        redeemableTiers: [{ threshold: 20, reward: "🥐 Petit-déjeuner offert" }],
        maxThreshold: 20,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ComptoirScan programType="points" rewardLabel="🎁 Récompense offerte" />);
    await scanCard("QR-POINTS");
    expect(await screen.findByRole("dialog", { name: /offrir la récompense/i })).toBeTruthy();
  });
});
