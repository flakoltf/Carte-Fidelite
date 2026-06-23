// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import AmountPad from "../AmountPad";

const tapDigit = (d: string) => fireEvent.click(screen.getByRole("button", { name: d }));
const tapKey = (label: string) => fireEvent.click(screen.getByRole("button", { name: label }));

describe("<AmountPad>", () => {
  afterEach(cleanup);

  it("affiche CHF 0.— au départ et le bouton VALIDER désactivé", () => {
    render(<AmountPad onConfirm={vi.fn().mockResolvedValue(undefined)} />);
    expect(screen.getByRole("status").textContent).toBe("CHF 0.—");
    const valider = screen.getByRole("button", { name: /valider/i });
    expect((valider as HTMLButtonElement).disabled).toBe(true);
  });

  it("compose un montant avec centimes via la grille", () => {
    render(<AmountPad onConfirm={vi.fn().mockResolvedValue(undefined)} />);
    ["1", "2"].forEach(tapDigit);
    tapKey("virgule");
    ["5", "0"].forEach(tapDigit);
    expect(screen.getByRole("status").textContent).toBe("CHF 12.50");
  });

  it("effacer corrige la saisie", () => {
    render(<AmountPad onConfirm={vi.fn().mockResolvedValue(undefined)} />);
    ["1", "2", "5"].forEach(tapDigit);
    tapKey("effacer");
    expect(screen.getByRole("status").textContent).toBe("CHF 12.—");
  });

  it("n'autorise pas de dépasser 9999.95", () => {
    render(<AmountPad onConfirm={vi.fn().mockResolvedValue(undefined)} />);
    ["9", "9", "9", "9", "9"].forEach(tapDigit); // le 5e est ignoré
    expect(screen.getByRole("status").textContent).toBe("CHF 9999.—");
  });

  it("VALIDER appelle onConfirm avec le montant numérique en CHF", async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<AmountPad onConfirm={onConfirm} />);
    ["7"].forEach(tapDigit);
    tapKey("virgule");
    ["5"].forEach(tapDigit); // 7,5 → 7.5 CHF
    const valider = screen.getByRole("button", { name: /valider/i });
    expect(valider.textContent).toContain("CHF 7.50");
    fireEvent.click(valider);
    expect(onConfirm).toHaveBeenCalledWith(7.5);
  });
});
