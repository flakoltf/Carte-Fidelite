// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import LeadsBoard from "../LeadsBoard";
import type { PipelineLead } from "@/lib/admin/leadsCompute";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const LONG_MESSAGE =
  "Nous cherchons une carte simple pour fidéliser le quartier, sans application à installer, " +
  "avec un tampon virtuel par visite et une récompense au bout de dix passages en boutique.";

function lead(overrides: Partial<PipelineLead> = {}): PipelineLead {
  return {
    id: "lead-1",
    businessName: "Boulangerie du Bourg",
    trade: "Boulangerie",
    contact: "anne@bourg.ch",
    contactName: "Anne Favre",
    phone: "079 555 12 34",
    message: null,
    plan: null,
    sourcePath: "/demarrer",
    status: "nouveau",
    nextFollowupAt: null,
    lostReason: null,
    convertedMerchantId: null,
    createdAt: "2026-09-04T08:00:00Z",
    updatedAt: null,
    noteCount: 0,
    ...overrides,
  };
}

afterEach(cleanup);

describe("<LeadsBoard> — champs du formulaire enrichi", () => {
  it("affiche le nom du contact et le téléphone sur la carte", () => {
    render(<LeadsBoard leads={[lead()]} />);
    expect(screen.getByText(/Anne Favre/)).toBeTruthy();
    expect(screen.getByText(/079 555 12 34/)).toBeTruthy();
  });

  it("affiche le message libre tronqué, dépliable pour tout lire", () => {
    render(<LeadsBoard leads={[lead({ message: LONG_MESSAGE })]} />);
    const details = document.querySelector("details") as HTMLDetailsElement;
    expect(details).not.toBeNull();
    expect(details.open).toBe(false);
    const summary = details.querySelector("summary") as HTMLElement;
    expect(summary.textContent).toMatch(/Nous cherchons une carte simple/);
    expect(summary.textContent!.length).toBeLessThan(LONG_MESSAGE.length);
    expect(details.textContent).toContain("dix passages en boutique");
  });

  it("sans message : pas de bloc dépliable", () => {
    render(<LeadsBoard leads={[lead()]} />);
    expect(document.querySelector("details")).toBeNull();
  });
});
