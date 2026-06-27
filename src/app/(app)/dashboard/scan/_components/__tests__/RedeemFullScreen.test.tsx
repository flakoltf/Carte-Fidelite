// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";
import RedeemFullScreen from "../RedeemFullScreen";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

// framer-motion → éléments simples et déterministes (pas d'animation en test).
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
  useReducedMotion: () => false,
  motion: new Proxy(
    {},
    {
      get: (_t, tag: string) => {
        const Tag = tag as "div" | "span";
        return ({ children, ...rest }: { children?: ReactNode }) => {
          // On retire les props d'animation pour ne pas polluer le DOM.
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

const okFetch = () =>
  vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, card: {} }) });

describe("<RedeemFullScreen>", () => {
  beforeEach(() => push.mockReset());
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("affiche la récompense en grand, le bouton OFFRIR et le lien Annuler", () => {
    render(
      <RedeemFullScreen cardId="QR" rewardLabel="☕ Café offert" onCancel={() => {}} />,
    );
    expect(screen.getByText("☕ Café offert")).toBeTruthy();
    expect(screen.getByRole("button", { name: /offrir · valider la récompense/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^annuler$/i })).toBeTruthy();
  });

  it("est un dialogue accessible avec région aria-live", () => {
    const { container } = render(
      <RedeemFullScreen cardId="QR" rewardLabel="☕ Café offert" onCancel={() => {}} />,
    );
    const dialog = screen.getByRole("dialog", { name: /offrir la récompense/i });
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(container.querySelector('[aria-live="assertive"]')).toBeTruthy();
  });

  it("Annuler déclenche onCancel", () => {
    const onCancel = vi.fn();
    render(<RedeemFullScreen cardId="QR" rewardLabel="☕ Café offert" onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: /^annuler$/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("OFFRIR appelle POST /api/redeem avec le cardId, fête puis redirige", async () => {
    vi.useFakeTimers();
    const fetchMock = okFetch();
    vi.stubGlobal("fetch", fetchMock);
    const onRedeemed = vi.fn();
    render(
      <RedeemFullScreen
        cardId="QR-PAYLOAD"
        rewardLabel="☕ Café offert"
        onCancel={() => {}}
        onRedeemed={onRedeemed}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /offrir · valider/i }));
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/scan/redeem");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ cardId: "QR-PAYLOAD" });
    expect(screen.getByText("Récompense offerte")).toBeTruthy();
    expect(onRedeemed).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("mode silencieux : ni vibration ni confettis, juste le check vert", async () => {
    vi.useFakeTimers();
    // jsdom de ce projet n'expose pas de localStorage fonctionnel → stub mémoire.
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => (k === "halo_silent_mode" ? "1" : null),
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
    });
    const vibrate = vi.fn();
    Object.defineProperty(window.navigator, "vibrate", { value: vibrate, configurable: true });
    vi.stubGlobal("fetch", okFetch());

    const { container } = render(
      <RedeemFullScreen cardId="QR" rewardLabel="☕ Café offert" onCancel={() => {}} onRedeemed={() => {}} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /offrir · valider/i }));
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(screen.getByText("Récompense offerte")).toBeTruthy();
    expect(vibrate).not.toHaveBeenCalled();
    // Aucun confetti (token de classe `bg-white` exact) en mode silencieux.
    expect(container.querySelectorAll(".bg-white").length).toBe(0);
  });

  it("affiche une erreur si l'encaissement échoue (pas de redirection)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: false, json: async () => ({ error: "Carte non complète" }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<RedeemFullScreen cardId="QR" rewardLabel="☕ Café offert" onCancel={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /offrir · valider/i }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Carte non complète");
    expect(push).not.toHaveBeenCalled();
  });
});
