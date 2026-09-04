// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import Page from "../page";

// Rendu réel du markdown (loadLegalDoc lit src/content/legal/cookies.md au
// build) : on verrouille que la page publique colle à ce que le site dépose
// VRAIMENT, et qu'aucune consigne de gabarit ne fuit vers le public.

afterEach(cleanup);

function pageText(): string {
  render(<Page />);
  return document.body.textContent ?? "";
}

describe("/cookies — politique collée à la réalité", () => {
  it("ne montre aucune note de gabarit ni placeholder au public", () => {
    const text = pageText();
    expect(text).not.toContain("Adapter ce tableau");
    expect(text).not.toContain("⚠️");
    expect(text).not.toMatch(/\[[A-ZÉÈ]/); // aucun jeton [EN MAJUSCULES] non substitué
  });

  it("décrit les cookies réels : session Supabase (sb-) essentielle sur l'app", () => {
    const text = pageText();
    expect(text).toContain("sb-");
    expect(text).toContain("app.halocard.ch");
  });

  it("dit explicitement que la mesure d'audience (Vercel Analytics) est sans cookies", () => {
    const text = pageText();
    expect(text).toContain("Vercel Analytics");
    expect(text).toMatch(/sans (aucun )?cookie/i);
  });

  it("ne promet ni panneau de consentement inexistant ni durée d'audience de 13 mois", () => {
    const text = pageText();
    expect(text).not.toMatch(/panneau de gestion du consentement/i);
    expect(text).not.toContain("13 mois");
  });

  it("n'affiche plus la catégorie « Fonctionnels » générique", () => {
    const text = pageText();
    expect(text).not.toContain("Fonctionnels");
  });

  it("rend le titre de la politique", () => {
    render(<Page />);
    expect(screen.getByRole("heading", { level: 1, name: /politique cookies/i })).toBeTruthy();
  });
});
