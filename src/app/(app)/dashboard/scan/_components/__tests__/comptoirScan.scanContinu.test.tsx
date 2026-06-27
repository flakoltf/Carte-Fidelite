// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";
import ComptoirScan from "../ComptoirScan";

// UXP-3 « scan continu » : un crédit simple (mode "added") relance la caméra
// tout seul après 1,5 s, sans bouton « scan suivant » obligatoire, le toast de
// confirmation restant affiché. reward/error gardent leur tap (non couverts ici).

// Caméra : on capte le callback de décodage + on compte les démarrages.
const h = vi.hoisted(() => ({ decode: null as ((t: string) => void) | null, starts: 0 }));
vi.mock("html5-qrcode", () => ({
  Html5Qrcode: class {
    constructor(_id: string) {}
    start(_c: unknown, _o: unknown, onDecode: (t: string) => void) {
      h.starts += 1;
      h.decode = onDecode;
      return Promise.resolve();
    }
    stop() {
      return Promise.resolve();
    }
    clear() {}
  },
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

const stampOk = () =>
  vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, rewardReady: false, card: { customers: { full_name: "Léa" } } }),
  });

describe("<ComptoirScan> — scan continu", () => {
  beforeEach(() => {
    push.mockReset();
    h.decode = null;
    h.starts = 0;
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("crédit simple → toast de confirmation, pas de bouton « scan suivant »", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", stampOk());
    render(<ComptoirScan programType="stamp_card" rewardLabel="🎁 Récompense" />);

    fireEvent.click(screen.getByText("Démarrer le scan"));
    expect(h.starts).toBe(1);
    await act(async () => {
      h.decode?.("QR-1");
      await vi.advanceTimersByTimeAsync(0);
    });

    // Toast (role status) avec le message de confirmation.
    const toast = screen.getByRole("status");
    expect(toast.textContent).toContain("Tampon ajouté");
    // Plus de bouton obligatoire « scan suivant ».
    expect(screen.queryByRole("button", { name: /scan suivant/i })).toBeNull();
  });

  it("relance la caméra toute seule après 1,5 s (zéro tap)", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("fetch", stampOk());
    render(<ComptoirScan programType="stamp_card" rewardLabel="🎁 Récompense" />);

    fireEvent.click(screen.getByText("Démarrer le scan"));
    await act(async () => {
      h.decode?.("QR-1");
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(h.starts).toBe(1); // toujours en confirmation, caméra arrêtée

    // 1,5 s plus tard : la caméra redémarre sans intervention.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SCAN_CONTINU_DELAY);
    });
    expect(h.starts).toBe(2);
    expect(screen.queryByRole("status")).toBeNull();
  });
});

// Miroir du délai interne (constante non exportée du composant).
const SCAN_CONTINU_DELAY = 1500;
