// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { LEAD_SECTORS } from "@/lib/leads/leadFormValidation";

// La Server Action est mockée : son import réel tire Upstash/Supabase,
// jamais nécessaires pour tester le rendu.
vi.mock("../actions", () => ({ submitLead: vi.fn() }));

import Page from "../page";

// Rendu du formulaire /demarrer (Server Component async : on attend le JSX
// puis on le rend — la Server Action n'est jamais invoquée ici).

async function renderPage(searchParams: Record<string, string> = {}) {
  render(await Page({ searchParams: Promise.resolve(searchParams) }));
}

afterEach(cleanup);

describe("/demarrer — formulaire enrichi", () => {
  it("affiche les champs obligatoires avec leurs libellés", async () => {
    await renderPage();
    for (const label of [/nom du commerce/i, /secteur d'activité/i, /prénom et nom/i, /^email/i]) {
      const field = screen.getByLabelText(label) as HTMLInputElement;
      expect(field.required).toBe(true);
    }
  });

  it("affiche téléphone et message comme facultatifs", async () => {
    await renderPage();
    const phone = screen.getByLabelText(/téléphone/i) as HTMLInputElement;
    const message = screen.getByLabelText(/parlez-nous de votre commerce/i) as HTMLTextAreaElement;
    expect(phone.required).toBe(false);
    expect(message.required).toBe(false);
    expect(message.tagName).toBe("TEXTAREA");
    expect(message.maxLength).toBe(1000);
  });

  it("propose la liste fermée des secteurs", async () => {
    await renderPage();
    const select = screen.getByLabelText(/secteur d'activité/i) as HTMLSelectElement;
    const options = Array.from(select.options).map((o) => o.value).filter(Boolean);
    expect(options).toEqual([...LEAD_SECTORS]);
  });

  it("embarque un honeypot invisible pour les bots", async () => {
    await renderPage();
    const hp = document.querySelector('input[name="website"]') as HTMLInputElement;
    expect(hp).not.toBeNull();
    expect(hp.tabIndex).toBe(-1);
    expect(hp.getAttribute("autocomplete")).toBe("off");
    expect(hp.getAttribute("aria-hidden")).toBe("true");
  });

  it("transmet le palier venu du pricing en champ caché (pas un champ du formulaire)", async () => {
    await renderPage({ plan: "croissance" });
    const plan = document.querySelector('input[name="plan"]') as HTMLInputElement;
    expect(plan.type).toBe("hidden");
    expect(plan.value).toBe("croissance");
  });

  it("succès : confirme la réception sans promettre d'email (clé Resend absente en prod)", async () => {
    await renderPage({ ok: "1" });
    const heading = screen.getByRole("heading", { name: /nous avons bien reçu votre demande/i });
    const card = heading.closest("div") as HTMLElement;
    expect(card.textContent).not.toMatch(/e-?mail/i);
  });
});
