// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";
import ComptoirHome from "../ComptoirHome";

// next/link → simple <a> ; `prefetch` exposé en data-attr pour l'assertion UXP-4.
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    prefetch,
    ...rest
  }: {
    href: string;
    children: ReactNode;
    prefetch?: boolean;
  }) => (
    <a href={href} data-prefetch={prefetch ? "true" : undefined} {...rest}>
      {children}
    </a>
  ),
}));

// StatTrio est testé séparément ; on l'isole pour ne pas charger la Server Action.
vi.mock("../StatTrio", () => ({ default: () => <div data-testid="stat-trio" /> }));

// html5-qrcode : le préchargeur (UXP-4) en fait un import() ; on le stub pour
// garder le test hermétique (pas de chargement réel de la lib caméra).
vi.mock("html5-qrcode", () => ({ Html5Qrcode: class {} }));

describe("<ComptoirHome>", () => {
  afterEach(cleanup);

  it("affiche le nom du commerce et les 3 chiffres", () => {
    render(<ComptoirHome shopName="Café du Rhône" />);
    expect(screen.getByText("Café du Rhône")).toBeTruthy();
    expect(screen.getByTestId("stat-trio")).toBeTruthy();
  });

  it("« Vue complète » mène au tableau de bord complet, depuis les chiffres", () => {
    render(<ComptoirHome shopName="Café du Rhône" />);
    const link = screen.getByRole("link", { name: /vue complète/i });
    expect(link.getAttribute("href")).toBe("/dashboard/full");
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

  it("le bouton Scanner force le prefetch de /dashboard/scan (UXP-4)", () => {
    render(<ComptoirHome shopName="Café du Rhône" />);
    const scan = screen.getByRole("button", { name: /scanner une carte/i });
    expect(scan.getAttribute("data-prefetch")).toBe("true");
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
