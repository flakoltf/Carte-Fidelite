// @vitest-environment jsdom
// e2e local du parcours d'onboarding (3 étapes) à travers <OnboardingGate> :
// guide plein écran → progression des étapes → bascule Comptoir + bandeau →
// disparition du bandeau. ExpressOnboarding et le bandeau sont RÉELS (intégration) ;
// seul le Comptoir est neutralisé en exposant son slot `banner`.
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import type { ReactNode } from "react";
import OnboardingGate from "../OnboardingGate";
import { ONBOARDING_DISMISSED_KEY } from "../onboardingExpressStore";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
// Comptoir neutralisé mais on EXPOSE son bandeau (le reste est testé ailleurs).
vi.mock("../ComptoirHome", () => ({
  default: ({ banner }: { banner?: ReactNode }) => <div data-testid="comptoir-home">{banner}</div>,
}));

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

const BASE = { shopName: "Café du Rhône", logoUrl: null };
const stepStatus = (n: 1 | 2 | 3) =>
  within(screen.getByTestId(`oe-step-${n}`)).getByText(/Fait|En cours|À faire/).textContent;

describe("Parcours onboarding express — flow 3 étapes", () => {
  beforeEach(() => installMemoryStorage());
  afterEach(cleanup);

  it("progresse étape par étape jusqu'à une carte distribuable", () => {
    // ── Étape 1 : marchand vierge → guide plein écran, étape 1 « En cours ».
    const { rerender } = render(
      <OnboardingGate {...BASE} isFirstRun sectorConfirmed={false} cardPersonalized={false} cardsCount={0} />
    );
    expect(screen.getByTestId("oe-step-1")).toBeTruthy();
    expect(stepStatus(1)).toBe("En cours");
    expect(stepStatus(2)).toBe("À faire");
    expect(stepStatus(3)).toBe("À faire");
    // Le bouton de l'étape 1 mène à la confirmation du secteur.
    expect(within(screen.getByTestId("oe-step-1")).getByRole("link").getAttribute("href")).toBe(
      "/onboarding/secteur"
    );

    // ── Étape 2 : secteur confirmé → toujours le guide, étape 2 « En cours ».
    rerender(
      <OnboardingGate {...BASE} isFirstRun sectorConfirmed cardPersonalized={false} cardsCount={0} />
    );
    expect(stepStatus(1)).toBe("Fait");
    expect(stepStatus(2)).toBe("En cours");
    expect(within(screen.getByTestId("oe-step-2")).getByRole("link").getAttribute("href")).toBe(
      "/dashboard/studio?express=1"
    );

    // ── Carte personnalisée (configurée) → on QUITTE le plein écran : Comptoir
    //    + bandeau « Distribuez votre QR » (étape 3, non bloquante).
    rerender(
      <OnboardingGate {...BASE} isFirstRun sectorConfirmed cardPersonalized cardsCount={0} />
    );
    expect(screen.queryByTestId("oe-step-1")).toBeNull(); // plus de plein écran
    expect(screen.getByTestId("comptoir-home")).toBeTruthy();
    expect(screen.getByTestId("comptoir-distribute-banner").getAttribute("href")).toBe("/dashboard/card");

    // ── Étape 3 franchie : une carte distribuée → Comptoir SANS bandeau.
    rerender(
      <OnboardingGate {...BASE} isFirstRun sectorConfirmed cardPersonalized cardsCount={1} />
    );
    expect(screen.getByTestId("comptoir-home")).toBeTruthy();
    expect(screen.queryByTestId("comptoir-distribute-banner")).toBeNull();
  });

  it("le marchand peut sortir du guide à tout moment (skip) → Comptoir", () => {
    render(
      <OnboardingGate {...BASE} isFirstRun sectorConfirmed={false} cardPersonalized={false} cardsCount={0} />
    );
    fireEvent.click(screen.getByRole("button", { name: /découvrir ma carte sans guide/i }));
    // Le flag posé est lu par le gate (useSyncExternalStore) → bascule Comptoir.
    expect(window.localStorage.getItem(ONBOARDING_DISMISSED_KEY)).toBe("1");
    expect(screen.getByTestId("comptoir-home")).toBeTruthy();
    expect(screen.queryByTestId("oe-step-1")).toBeNull();
  });
});
