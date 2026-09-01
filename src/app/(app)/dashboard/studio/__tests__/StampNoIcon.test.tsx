// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import StampGrid from "../_components/StampGrid";
import StampsSection from "../_components/StampsSection";
import type { StampsConfig } from "@/lib/cardDesign/types";

afterEach(cleanup);

const BASE: StampsConfig = { goal: 4, icon: "☕", shape: "circle" };

describe("StampGrid — option « sans icône »", () => {
  it("icône présente → l'emoji est rendu dans les alvéoles obtenues", () => {
    render(<StampGrid stamps={BASE} count={2} onBackground="#0D6B5E" />);
    expect(screen.getAllByText("☕")).toHaveLength(2);
  });

  it("icon vide → aucune icône rendue, l'alvéole obtenue reste une plaque pleine", () => {
    const { container } = render(
      <StampGrid stamps={{ ...BASE, icon: "" }} count={2} onBackground="#0D6B5E" />
    );
    expect(screen.queryByText("☕")).toBeNull();
    // La grille garde bien ses 4 alvéoles (2 obtenues + 2 vides).
    const grid = container.querySelector('[role="img"]')!;
    expect(grid.children).toHaveLength(4);
    expect(grid.getAttribute("aria-label")).toBe("2 tampons sur 4");
  });

  it("icon = espaces seuls → même rendu que sans icône", () => {
    render(<StampGrid stamps={{ ...BASE, icon: "   " }} count={1} onBackground="#0D6B5E" />);
    expect(screen.queryByText("☕")).toBeNull();
  });
});

describe("StampsSection — bouton « Sans icône »", () => {
  it("propose « Sans icône » et le sélectionner pose icon: ''", () => {
    const onChange = vi.fn();
    render(<StampsSection stamps={BASE} onChange={onChange} background="#0D6B5E" onFilledUploaded={vi.fn()} onEmptyUploaded={vi.fn()} />);
    const btn = screen.getByRole("button", { name: /sans icône/i });
    fireEvent.click(btn);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ icon: "" }));
  });

  it("l'état sélectionné suit le choix (icon vide + pas de visuel uploadé)", () => {
    const { rerender } = render(
      <StampsSection stamps={BASE} onChange={vi.fn()} background="#0D6B5E" onFilledUploaded={vi.fn()} onEmptyUploaded={vi.fn()} />
    );
    expect(screen.getByRole("button", { name: /sans icône/i }).getAttribute("aria-pressed")).toBe("false");
    rerender(<StampsSection stamps={{ ...BASE, icon: "" }} onChange={vi.fn()} background="#0D6B5E" onFilledUploaded={vi.fn()} onEmptyUploaded={vi.fn()} />);
    expect(screen.getByRole("button", { name: /sans icône/i }).getAttribute("aria-pressed")).toBe("true");
  });
});
