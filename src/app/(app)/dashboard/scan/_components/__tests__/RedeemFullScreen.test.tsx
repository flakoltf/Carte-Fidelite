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

// Task 12 : carte à points — props `tiers`/`maxThreshold` remplacent le bouton
// OFFRIR unique par un bouton par palier. Sans `tiers`, comportement ci-dessus
// strictement inchangé (couvert par les tests précédents).
describe("<RedeemFullScreen> — paliers points (tiers)", () => {
  const tiers = [
    { threshold: 10, reward: "☕ Café offert" },
    { threshold: 20, reward: "🥐 Petit-déjeuner offert" },
  ];

  beforeEach(() => push.mockReset());
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("rend un bouton par palier, le max marqué « remet la carte à zéro », pas de bouton OFFRIR", () => {
    render(
      <RedeemFullScreen
        cardId="QR"
        rewardLabel="🎁 Récompense offerte"
        tiers={tiers}
        maxThreshold={20}
        onCancel={() => {}}
      />,
    );
    expect(screen.queryByRole("button", { name: /offrir · valider/i })).toBeNull();
    const cafe = screen.getByRole("button", { name: /☕ Café offert/ });
    expect(cafe.textContent).toContain("10 points");
    expect(cafe.textContent).not.toContain("remet la carte à zéro");
    const petitDej = screen.getByRole("button", { name: /🥐 Petit-déjeuner offert/ });
    expect(petitDej.textContent).toContain("remet la carte à zéro");
  });

  it("l'aria-label de la modale reflète le titre visible « Choisissez la récompense »", () => {
    render(
      <RedeemFullScreen
        cardId="QR"
        rewardLabel="🎁 Récompense offerte"
        tiers={tiers}
        maxThreshold={20}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByRole("dialog", { name: /choisissez la récompense/i })).toBeTruthy();
  });

  it("palier intermédiaire : POST { cardId, tierThreshold }, retire le palier validé, propose Terminer sans rediriger", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, tier: { threshold: 10, reward: "☕ Café offert" }, cycleReset: false }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const onRedeemed = vi.fn();

    const { container } = render(
      <RedeemFullScreen
        cardId="QR"
        rewardLabel="🎁 Récompense offerte"
        tiers={tiers}
        maxThreshold={20}
        onCancel={() => {}}
        onRedeemed={onRedeemed}
      />,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /☕ Café offert/ }));
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/scan/redeem");
    expect(JSON.parse(init.body)).toEqual({ cardId: "QR", tierThreshold: 10 });

    // Palier validé retiré ; le palier max reste validable ; pas de redirection.
    expect(screen.queryByRole("button", { name: /☕ Café offert/ })).toBeNull();
    expect(screen.getByRole("button", { name: /🥐 Petit-déjeuner offert/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /^terminer$/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^annuler$/i })).toBeNull();
    expect(onRedeemed).not.toHaveBeenCalled();

    // Copy correcte (pas de « offert offert » : le libellé de la récompense
    // porte déjà « offert »/« offerte ») et annoncée par UNE SEULE région live
    // : la région sr-only (assertive, dédiée succès/erreur) reste vide ici,
    // seule la note visible (role=status, polite) porte le message.
    const note = screen.getByRole("status");
    expect(note.textContent).toBe("Validé : ☕ Café offert. Vous pouvez valider un autre palier ou terminer.");
    expect(note.textContent).not.toMatch(/offert offert/i);
    const srOnly = container.querySelector('[aria-live="assertive"]');
    expect(srOnly?.textContent).toBe("");
  });

  it("palier max (cycleReset) : célébration « Carte remise à zéro » puis redirection", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, tier: { threshold: 20, reward: "🥐 Petit-déjeuner offert" }, cycleReset: true }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const onRedeemed = vi.fn();

    render(
      <RedeemFullScreen
        cardId="QR"
        rewardLabel="🎁 Récompense offerte"
        tiers={tiers}
        maxThreshold={20}
        onCancel={() => {}}
        onRedeemed={onRedeemed}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /🥐 Petit-déjeuner offert/ }));
    await act(async () => {
      await vi.runAllTimersAsync();
    });

    expect(screen.getByText("Carte remise à zéro")).toBeTruthy();
    expect(onRedeemed).toHaveBeenCalledTimes(1);
  });

  it("erreur serveur (palier déjà validé) : affiche l'alerte, le bouton reste, pas de redirection", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: false, json: async () => ({ error: "Palier déjà validé sur ce cycle." }) });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <RedeemFullScreen cardId="QR" rewardLabel="🎁 Récompense offerte" tiers={tiers} maxThreshold={20} onCancel={() => {}} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /☕ Café offert/ }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Palier déjà validé");
    expect(push).not.toHaveBeenCalled();
  });
});
