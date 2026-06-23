// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";
import OnboardingGate from "../OnboardingGate";
import { ONBOARDING_DISMISSED_KEY } from "../onboardingExpressStore";

// next/link → <a> (le bandeau réel est un Link).
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// Le Comptoir est isolé, mais on EXPOSE son slot `banner` pour vérifier le bandeau.
vi.mock("../ComptoirHome", () => ({
  default: ({ banner }: { banner?: ReactNode }) => (
    <div data-testid="comptoir-home">{banner}</div>
  ),
}));
vi.mock("../ExpressOnboarding", () => ({ default: () => <div data-testid="express-onboarding" /> }));

const BASE = {
  shopName: "Café du Rhône",
  logoUrl: null,
  sectorConfirmed: false,
  cardPersonalized: false,
  cardsCount: 0,
};

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

const shows = (id: string) => Boolean(screen.queryByTestId(id));

describe("<OnboardingGate>", () => {
  beforeEach(() => installMemoryStorage());
  afterEach(cleanup);

  it("pas premier passage → Comptoir, jamais le guide", () => {
    render(<OnboardingGate {...BASE} isFirstRun={false} sectorConfirmed cardPersonalized cardsCount={3} />);
    expect(shows("comptoir-home")).toBe(true);
    expect(shows("express-onboarding")).toBe(false);
  });

  it("compte réellement non configuré (mécanique manquante) → plein écran Express", () => {
    render(<OnboardingGate {...BASE} isFirstRun />);
    expect(shows("express-onboarding")).toBe(true);
    expect(shows("comptoir-home")).toBe(false);
  });

  it("récompense manquante (secteur fait, carte non personnalisée) → plein écran Express", () => {
    render(<OnboardingGate {...BASE} isFirstRun sectorConfirmed />);
    expect(shows("express-onboarding")).toBe(true);
  });

  it("guide masqué (localStorage) → Comptoir même si non configuré", () => {
    window.localStorage.setItem(ONBOARDING_DISMISSED_KEY, "1");
    render(<OnboardingGate {...BASE} isFirstRun />);
    expect(shows("comptoir-home")).toBe(true);
    expect(shows("express-onboarding")).toBe(false);
  });

  it("CHEF : configuré (mécanique ET récompense) → JAMAIS le plein écran, même < 24 h", () => {
    // isFirstRun vrai uniquement par « créé < 24 h », mais tout est configuré.
    render(<OnboardingGate {...BASE} isFirstRun sectorConfirmed cardPersonalized cardsCount={0} />);
    expect(shows("express-onboarding")).toBe(false);
    expect(shows("comptoir-home")).toBe(true);
  });

  it("configuré < 24 h sans carte distribuée → Comptoir + bandeau « Distribuez votre QR »", () => {
    render(<OnboardingGate {...BASE} isFirstRun sectorConfirmed cardPersonalized cardsCount={0} />);
    expect(shows("comptoir-home")).toBe(true);
    const banner = screen.getByTestId("comptoir-distribute-banner");
    expect(banner.getAttribute("href")).toBe("/dashboard/card");
  });

  it("configuré avec ≥ 1 carte distribuée → Comptoir SANS bandeau", () => {
    render(<OnboardingGate {...BASE} isFirstRun sectorConfirmed cardPersonalized cardsCount={2} />);
    expect(shows("comptoir-home")).toBe(true);
    expect(shows("comptoir-distribute-banner")).toBe(false);
  });

  it("configuré mais plus premier passage (compte ancien) → pas de bandeau", () => {
    render(
      <OnboardingGate {...BASE} isFirstRun={false} sectorConfirmed cardPersonalized cardsCount={0} />
    );
    expect(shows("comptoir-home")).toBe(true);
    expect(shows("comptoir-distribute-banner")).toBe(false);
  });
});
