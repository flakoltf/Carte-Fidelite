// @vitest-environment jsdom
//
// Golden composant : les aperçus rendent la SORTIE DES ADAPTERS. Un champ que le
// générateur pousse au dos (débordement) ne doit PAS apparaître sur le recto ;
// le sous-titre Google ne doit plus être codé en dur.

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import type { CardDesign } from "@/lib/cardDesign/types";
import { AppleWalletPreview, GoogleWalletPreview } from "../WalletPreviews";

vi.mock("../BarcodeVisual", () => ({ default: () => <div data-testid="barcode" /> }));

function design(fields: CardDesign["fields"]): CardDesign {
  return {
    colors: { background: "#0D6B5E", foreground: "#FFFFFF", label: "#BFEEE6" },
    programName: "Café du Léman",
    logo: {},
    fields,
    barcode: { type: "QR", source: "card_token" },
  };
}

afterEach(cleanup);

describe("AppleWalletPreview", () => {
  it("cache au recto les champs que le générateur déborde au dos", () => {
    const secondary = Array.from({ length: 6 }, (_, i) => ({
      id: `s${i}`,
      zone: "secondary" as const,
      label: `L${i}`,
      value: `VAL${i}`,
      order: i + 1,
    }));
    render(<AppleWalletPreview design={design(secondary)} assets={{}} />);
    // VAL0..VAL3 sur le recto ; VAL4/VAL5 débordés → absents du recto.
    expect(screen.getByText("VAL3")).toBeTruthy();
    expect(screen.queryByText("VAL4")).toBeNull();
    expect(screen.queryByText("VAL5")).toBeNull();

    // En basculant au dos, les champs débordés apparaissent.
    fireEvent.click(screen.getByLabelText("Voir le dos"));
    expect(screen.getByText("VAL4")).toBeTruthy();
    expect(screen.getByText("VAL5")).toBeTruthy();
  });
});

describe("GoogleWalletPreview", () => {
  it("affiche programName et non un sous-titre codé en dur", () => {
    render(
      <GoogleWalletPreview
        design={design([{ id: "p", zone: "primary", label: "POINTS", value: "{points}", order: 1 }])}
        assets={{}}
      />,
    );
    expect(screen.getByText("Café du Léman")).toBeTruthy();
    expect(screen.queryByText("Carte de fidélité")).toBeNull();
  });
});
