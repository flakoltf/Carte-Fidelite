// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import type { ReactNode } from "react";
import ExpressOnboarding from "../ExpressOnboarding";
import { ONBOARDING_DISMISSED_KEY, POSTER_DONE_KEY } from "../onboardingExpressStore";

// next/link → simple <a> en test (pas de routeur App nécessaire).
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// Marchand vierge : rien de fait. Les tests ne renversent qu'un critère à la fois.
const FRESH = { shopName: "Café du Rhône", sectorConfirmed: false, cardPersonalized: false, cardsCount: 0 };

function step(n: 1 | 2 | 3) {
  return screen.getByTestId(`oe-step-${n}`);
}

// localStorage en mémoire, neuf à chaque test : neutralise le localStorage
// expérimental global de Node (qui n'expose pas `clear`) et isole les cas.
function installMemoryStorage() {
  const map = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
  };
  Object.defineProperty(window, "localStorage", { value: storage, configurable: true });
}

describe("<ExpressOnboarding>", () => {
  beforeEach(() => {
    installMemoryStorage();
  });
  afterEach(cleanup);

  it("affiche les 3 étapes numérotées avec leurs intitulés", () => {
    render(<ExpressOnboarding {...FRESH} />);
    expect(within(step(1)).getByText(/confirmez votre commerce/i)).toBeTruthy();
    expect(within(step(2)).getByText(/personnalisez votre carte/i)).toBeTruthy();
    expect(within(step(3)).getByText(/distribuez votre qr/i)).toBeTruthy();
  });

  it("mène chaque étape vers sa destination (secteur · studio express · carte)", () => {
    render(<ExpressOnboarding {...FRESH} />);
    expect(within(step(1)).getByRole("link").getAttribute("href")).toBe("/onboarding/secteur");
    expect(within(step(2)).getByRole("link").getAttribute("href")).toBe("/dashboard/studio?express=1");
    expect(within(step(3)).getByRole("link").getAttribute("href")).toBe("/dashboard/card");
  });

  it("marchand vierge : étape 1 « En cours », étapes 2 et 3 « À faire »", () => {
    render(<ExpressOnboarding {...FRESH} />);
    expect(within(step(1)).getByText("En cours")).toBeTruthy();
    expect(within(step(2)).getByText("À faire")).toBeTruthy();
    expect(within(step(3)).getByText("À faire")).toBeTruthy();
  });

  it("secteur confirmé : étape 1 « Fait » (coche), étape 2 devient « En cours »", () => {
    render(<ExpressOnboarding {...FRESH} sectorConfirmed />);
    expect(within(step(1)).getByText("Fait")).toBeTruthy();
    expect(within(step(1)).getByTestId("oe-check")).toBeTruthy();
    expect(within(step(2)).getByText("En cours")).toBeTruthy();
    // L'étape faite n'affiche plus de bouton d'action.
    expect(within(step(1)).queryByRole("link")).toBeNull();
  });

  it("tout fait (secteur + carte + 1 carte distribuée) : 3 coches", () => {
    render(<ExpressOnboarding {...FRESH} sectorConfirmed cardPersonalized cardsCount={4} />);
    expect(screen.getAllByTestId("oe-check")).toHaveLength(3);
    expect(within(step(3)).getByText("Fait")).toBeTruthy();
  });

  it("étape 3 « Fait » via le QR téléchargé (halo_poster_done) même sans carte distribuée", () => {
    window.localStorage.setItem(POSTER_DONE_KEY, "1");
    render(<ExpressOnboarding {...FRESH} sectorConfirmed cardPersonalized cardsCount={0} />);
    expect(within(step(3)).getByText("Fait")).toBeTruthy();
  });

  it("« Tout est prêt, masquer ce guide » pose halo_onboarding_dismissed = 1", () => {
    render(<ExpressOnboarding {...FRESH} />);
    fireEvent.click(screen.getByRole("button", { name: /masquer ce guide/i }));
    expect(window.localStorage.getItem(ONBOARDING_DISMISSED_KEY)).toBe("1");
  });

  it("« Découvrir ma carte sans guide » (skip) pose aussi halo_onboarding_dismissed = 1", () => {
    render(<ExpressOnboarding {...FRESH} />);
    fireEvent.click(screen.getByRole("button", { name: /découvrir ma carte sans guide/i }));
    expect(window.localStorage.getItem(ONBOARDING_DISMISSED_KEY)).toBe("1");
  });
});
