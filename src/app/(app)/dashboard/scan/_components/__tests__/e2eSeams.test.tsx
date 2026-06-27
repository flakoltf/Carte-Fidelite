// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";
import ComptoirScan from "../ComptoirScan";
import { e2eProgramOverride } from "../../page";

// Garde anti-régression des SEAMS E2E (cf. e2e/README.md). Filet pour ne JAMAIS
// expédier un seam vivant : sans `NEXT_PUBLIC_E2E === "1"`, les deux seams sont
// du code mort (window.__e2eDecode reste undefined, l'override ?e2eProgram est
// ignoré). Avec le flag, ils s'activent.

vi.mock("html5-qrcode", () => ({
  Html5Qrcode: class {
    constructor(_id: string) {}
    start() {
      return Promise.resolve();
    }
    stop() {
      return Promise.resolve();
    }
    clear() {}
  },
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

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

type WindowSeam = { __e2eDecode?: (cardId: string) => void };

afterEach(() => {
  cleanup();
  delete process.env.NEXT_PUBLIC_E2E;
  delete (window as unknown as WindowSeam).__e2eDecode;
});

describe("seam E2E — window.__e2eDecode (ComptoirScan)", () => {
  it("NEXT_PUBLIC_E2E absent → window.__e2eDecode reste undefined (code mort en prod)", () => {
    delete process.env.NEXT_PUBLIC_E2E;
    render(<ComptoirScan programType="stamp_card" rewardLabel="Un café offert" />);
    expect((window as unknown as WindowSeam).__e2eDecode).toBeUndefined();
  });

  it('NEXT_PUBLIC_E2E="1" → window.__e2eDecode exposé, puis nettoyé au démontage', () => {
    process.env.NEXT_PUBLIC_E2E = "1";
    const { unmount } = render(<ComptoirScan programType="stamp_card" rewardLabel="Un café offert" />);
    expect(typeof (window as unknown as WindowSeam).__e2eDecode).toBe("function");
    unmount();
    expect((window as unknown as WindowSeam).__e2eDecode).toBeUndefined();
  });
});

describe("seam E2E — e2eProgramOverride (scan/page.tsx)", () => {
  it("NEXT_PUBLIC_E2E absent → override ignoré (toujours null)", () => {
    delete process.env.NEXT_PUBLIC_E2E;
    expect(e2eProgramOverride("amount_points")).toBeNull();
    expect(e2eProgramOverride("stamp_card")).toBeNull();
    expect(e2eProgramOverride(undefined)).toBeNull();
  });

  it('NEXT_PUBLIC_E2E="1" → n\'override que pour un LoyaltyType valide', () => {
    process.env.NEXT_PUBLIC_E2E = "1";
    expect(e2eProgramOverride("amount_points")).toBe("amount_points");
    expect(e2eProgramOverride("stamp_card")).toBe("stamp_card");
    expect(e2eProgramOverride(["amount_points"])).toBe("amount_points");
    expect(e2eProgramOverride("n_importe_quoi")).toBeNull();
    expect(e2eProgramOverride(undefined)).toBeNull();
  });
});
