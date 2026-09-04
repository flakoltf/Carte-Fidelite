// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import EnrollClient from "../EnrollClient";

// Case à cocher « offres par email » du formulaire public /c/[slug] :
//  - JAMAIS pré-cochée (consentement explicite, LPD/RGPD) ;
//  - optionnelle : l'enrôlement part sans elle, avec marketingConsent=false ;
//  - cochée → marketingConsent=true dans le POST /api/enroll.

const props = {
  slug: "cafe-du-rhone",
  shopName: "Café du Rhône",
  primaryColor: "#0D6B5E",
  logoUrl: null,
  rewardLabel: "Le 10e café offert",
};

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ cardId: "card-1", isNew: true }) });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function fillRequired() {
  fireEvent.change(screen.getByPlaceholderText("Marie"), { target: { value: "Nadia" } });
  fireEvent.change(screen.getByPlaceholderText("marie.dupont@email.com"), { target: { value: "nadia@example.ch" } });
}

function sentBody(): Record<string, unknown> {
  const init = fetchMock.mock.calls[0][1] as { body: string };
  return JSON.parse(init.body);
}

describe("EnrollClient — case de consentement email", () => {
  it("affiche la case avec le nom du commerce, NON pré-cochée", () => {
    render(<EnrollClient {...props} />);
    const box = screen.getByRole("checkbox", { name: /offres de Café du Rhône par email/i }) as HTMLInputElement;
    expect(box.checked).toBe(false);
    expect(box.required).toBe(false);
  });

  it("sans cocher : l'enrôlement part avec marketingConsent=false", async () => {
    render(<EnrollClient {...props} />);
    fillRequired();
    fireEvent.click(screen.getByRole("button", { name: /créer ma carte/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(sentBody().marketingConsent).toBe(false);
  });

  it("case cochée : marketingConsent=true dans le POST", async () => {
    render(<EnrollClient {...props} />);
    fillRequired();
    fireEvent.click(screen.getByRole("checkbox", { name: /offres de Café du Rhône par email/i }));
    fireEvent.click(screen.getByRole("button", { name: /créer ma carte/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(sentBody().marketingConsent).toBe(true);
  });
});
