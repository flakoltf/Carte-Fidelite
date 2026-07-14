// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ValidationPanel } from "../ValidationPanel";
import type { Issue } from "@/lib/cardDesign/validateTemplate";

afterEach(cleanup);

const issues: Issue[] = [
  { id: "e", severity: "error", message: "Champ en trop", fieldId: "f1", zone: "secondary" },
  { id: "w", severity: "warning", message: "Valeur longue" },
  { id: "i", severity: "info", message: "Police imposée par le système" },
];

describe("ValidationPanel", () => {
  it("groupe par sévérité et n'annonce pas « publiable » s'il y a une erreur", () => {
    render(<ValidationPanel issues={issues} />);
    expect(screen.getByText("Champ en trop")).toBeTruthy();
    expect(screen.getByText("Valeur longue")).toBeTruthy();
    expect(screen.getByText("Police imposée par le système")).toBeTruthy();
    expect(screen.queryByText(/publiable/i)).toBeNull();
  });

  it("annonce « publiable » quand il n'y a aucune erreur", () => {
    render(<ValidationPanel issues={[issues[1], issues[2]]} />);
    expect(screen.getByText(/publiable/i)).toBeTruthy();
  });

  it("le lien « Voir le champ » appelle onFocusField avec le bon id", () => {
    const onFocusField = vi.fn();
    render(<ValidationPanel issues={issues} onFocusField={onFocusField} />);
    fireEvent.click(screen.getByText("Voir le champ"));
    expect(onFocusField).toHaveBeenCalledWith("f1");
  });
});
