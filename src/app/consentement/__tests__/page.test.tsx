// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

// Page sobre d'atterrissage des liens de consentement (/consentement?etat=…&m=…).
// Publique, non indexée ; le nom du commerce est relu en base (jamais depuis
// l'URL → pas de page de phishing à contenu libre).

const merchants: Record<string, { shop_name: string }> = {
  "22222222-2222-4222-8222-222222222222": { shop_name: "Café du Rhône" },
};
vi.mock("@/lib/supabaseAdmin", () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: (_c: string, id: string) => ({ maybeSingle: async () => ({ data: merchants[id] ?? null }) }),
      }),
    }),
  },
}));

import Page, { metadata } from "../page";

async function renderPage(sp: Record<string, string>) {
  render(await Page({ searchParams: Promise.resolve(sp) }));
}
afterEach(cleanup);

describe("/consentement", () => {
  it("n'est pas indexée", () => {
    expect(metadata.robots).toMatchObject({ index: false });
  });

  it("confirmé : nomme le commerce et rappelle la désinscription possible", async () => {
    await renderPage({ etat: "confirme", m: "22222222-2222-4222-8222-222222222222" });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/confirmée/i);
    expect(screen.getByText(/Café du Rhône/)).toBeTruthy();
    expect(screen.getByText(/désinscrire/i)).toBeTruthy();
  });

  it("désinscrit : confirme qu'aucun email ne sera plus envoyé", async () => {
    await renderPage({ etat: "desinscrit", m: "22222222-2222-4222-8222-222222222222" });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/désinscrit/i);
    expect(screen.getByText(/Café du Rhône/)).toBeTruthy();
  });

  it("expiré / invalide / erreur : message sobre, sans détail technique", async () => {
    await renderPage({ etat: "expire" });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/expiré/i);
    cleanup();
    await renderPage({ etat: "invalide" });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/plus valable/i);
    cleanup();
    await renderPage({ etat: "erreur" });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/réessayer/i);
  });

  it("etat inconnu ou m non-UUID → traité comme invalide, aucune lecture en base", async () => {
    await renderPage({ etat: "confirme", m: "<script>" });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/confirmée/i);
    expect(screen.queryByText(/Café du Rhône/)).toBeNull();
    cleanup();
    await renderPage({ etat: "n'importe quoi" });
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/plus valable/i);
  });
});
