// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";
import ComptoirHome from "../ComptoirHome";

// next/link → simple <a> en test (pas de routeur App nécessaire).
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// StatTrio est testé séparément ; on l'isole pour ne pas charger la Server Action.
vi.mock("../StatTrio", () => ({ default: () => <div data-testid="stat-trio" /> }));

describe("<ComptoirHome>", () => {
  afterEach(cleanup);

  it("affiche le nom du commerce et les 3 chiffres", () => {
    render(<ComptoirHome shopName="Café du Rhône" />);
    expect(screen.getByText("Café du Rhône")).toBeTruthy();
    expect(screen.getByTestId("stat-trio")).toBeTruthy();
  });

  it("l'engrenage mène au tableau de bord complet /dashboard/full", () => {
    render(<ComptoirHome shopName="Café du Rhône" />);
    const gear = screen.getByRole("link", { name: /réglages et tableau de bord complet/i });
    expect(gear.getAttribute("href")).toBe("/dashboard/full");
  });

  it("expose un bouton Scanner accessible (rôle button) vers /dashboard/scan", () => {
    render(<ComptoirHome shopName="Café du Rhône" />);
    const scan = screen.getByRole("button", { name: /scanner une carte/i });
    expect(scan.getAttribute("href")).toBe("/dashboard/scan");
  });

  it("le libellé du bouton est en français", () => {
    render(<ComptoirHome shopName="Café du Rhône" />);
    expect(screen.getByText("Scanner une carte")).toBeTruthy();
  });

  it("affiche l'initiale du commerce faute de logo", () => {
    render(<ComptoirHome shopName="Boulangerie Zen" logoUrl={null} />);
    expect(screen.getByText("B")).toBeTruthy();
  });
});
