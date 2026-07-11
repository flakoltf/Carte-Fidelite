// @vitest-environment jsdom
//
// Tests de caractérisation du wizard d'onboarding. Ils FIXENT le comportement
// actuel (quelle section s'affiche pour un état donné, quel endpoint chaque
// action appelle) pour servir de filet de sécurité au découpage du composant.
// Aucune assertion sur le style : uniquement structure, navigation, appels API.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import OnboardingClient from "../OnboardingClient";
import type { OnboardingState } from "@/lib/signup/state";

// framer-motion → passthrough déterministe (pas d'animation en test).
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
  motion: new Proxy(
    {},
    {
      get: (_t, tag: string) => {
        const Tag = tag as "div" | "span" | "nav" | "form" | "main" | "ol" | "ul" | "li" | "a";
        return ({ children, ...rest }: { children?: ReactNode }) => {
          const { initial, animate, exit, transition, ...dom } = rest as Record<string, unknown>;
          void initial;
          void animate;
          void exit;
          void transition;
          return <Tag {...(dom as object)}>{children}</Tag>;
        };
      },
    },
  ),
}));

// next/link → ancre simple.
vi.mock("next/link", () => ({
  default: ({ children, href }: { children?: ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

// Enfants lourds (QR/canvas) → substituts inertes et identifiables.
vi.mock("@/components/halo/HaloMark", () => ({ HaloSymbol: () => <span data-testid="halo" /> }));
vi.mock("@/app/(app)/admin/EnrollmentQR", () => ({
  default: ({ url }: { url: string }) => <div data-testid="qr">{url}</div>,
}));
vi.mock("@/components/halo/QrPosterButton", () => ({
  default: () => <button type="button">Affichette</button>,
}));

function makeState(overrides: Partial<OnboardingState> = {}): OnboardingState {
  return {
    merchantId: "m1",
    shopName: "",
    profileFilled: false,
    businessType: "cafe",
    address: null,
    slug: null,
    loyaltyType: "stamp_card",
    stampGoal: 10,
    milestones: [],
    plan: "essentiel",
    billingCycle: "monthly",
    subscriptionStatus: "trial",
    trialEndsAt: null,
    step: "profile",
    completedAt: null,
    signupSource: "self",
    setupMode: null,
    conciergePending: false,
    designPublished: false,
    activeCards: 0,
    ...overrides,
  };
}

let fetchMock: ReturnType<typeof vi.fn>;

function renderWizard(overrides: Partial<OnboardingState> = {}, props: { welcome?: boolean } = {}) {
  return render(<OnboardingClient initialState={makeState(overrides)} welcome={props.welcome ?? false} />);
}

/** Corps JSON de l'énième appel fetch. */
function bodyOf(callIndex: number): Record<string, unknown> {
  const init = fetchMock.mock.calls[callIndex][1] as RequestInit;
  return JSON.parse(init.body as string);
}

beforeEach(() => {
  fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => ({ slug: "cafe-leman", state: { designPublished: true } }),
  }));
  vi.stubGlobal("fetch", fetchMock);
  window.scrollTo = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("Fork de parcours (setupMode null)", () => {
  it("affiche les deux parcours", () => {
    renderWizard({ setupMode: null });
    expect(screen.getByText("HALO crée ma carte")).toBeTruthy();
    expect(screen.getByText("Je crée ma carte")).toBeTruthy();
  });

  it("« HALO crée ma carte » appelle POST /api/onboarding/mode et bascule en concierge", async () => {
    renderWizard({ setupMode: null });
    fireEvent.click(screen.getByText("HALO crée ma carte"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/onboarding/mode", expect.objectContaining({ method: "POST" })));
    expect(bodyOf(0)).toEqual({ mode: "concierge" });
    await screen.findByText("Ce qui se passe ensuite :", { exact: false });
  });

  it("« Je crée ma carte » appelle mode=self et affiche l'étape profil + la barre de progression", async () => {
    renderWizard({ setupMode: null });
    fireEvent.click(screen.getByText("Je crée ma carte"));
    await waitFor(() => expect(bodyOf(0)).toEqual({ mode: "self" }));
    expect(screen.getByLabelText("Nom du commerce")).toBeTruthy();
    expect(screen.getByLabelText("Progression")).toBeTruthy();
  });
});

describe("Parcours concierge", () => {
  it("soumet POST /api/onboarding/concierge et affiche le QR en ligne", async () => {
    renderWizard({ setupMode: "concierge" });
    fireEvent.change(screen.getByLabelText("Nom du commerce"), { target: { value: "Café du Léman" } });
    fireEvent.click(screen.getByRole("button", { name: /Mettre ma carte en ligne/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/onboarding/concierge", expect.objectContaining({ method: "POST" })));
    expect(await screen.findByTestId("qr")).toBeTruthy();
  });
});

describe("Étape profil (self)", () => {
  it("soumet PATCH /api/onboarding/profile puis avance vers le programme", async () => {
    renderWizard({ setupMode: "self", step: "profile" });
    fireEvent.change(screen.getByLabelText("Nom du commerce"), { target: { value: "Café du Léman" } });
    fireEvent.click(screen.getByRole("button", { name: /Continuer/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/onboarding/profile", expect.objectContaining({ method: "PATCH" })));
    expect(await screen.findByText("Votre programme de fidélité")).toBeTruthy();
  });
});

describe("Étape programme (self)", () => {
  it("carte à tampons : PATCH avec type stamp_card + objectif, puis étape design", async () => {
    renderWizard({ setupMode: "self", step: "program", loyaltyType: "stamp_card", stampGoal: 10 });
    fireEvent.click(screen.getByRole("button", { name: /Continuer/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/onboarding/program", expect.objectContaining({ method: "PATCH" })));
    expect(bodyOf(0)).toEqual({ type: "stamp_card", goal: 10 });
    expect(await screen.findByText("Le design de votre carte")).toBeTruthy();
  });

  it("points par montant : lecture seule, aucun ré-enregistrement, passe direct au design", async () => {
    renderWizard({ setupMode: "self", step: "program", loyaltyType: "amount_points" });
    expect(screen.getByText(/Programme « points par montant »/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Continuer/ }));
    expect(await screen.findByText("Le design de votre carte")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("Étape design (self)", () => {
  it("« Vérifier » interroge GET /api/onboarding", async () => {
    renderWizard({ setupMode: "self", step: "design" });
    fireEvent.click(screen.getByRole("button", { name: /Vérifier/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/onboarding", expect.objectContaining({ method: "GET" })));
  });
});

describe("Étape palier (self)", () => {
  it("choisit un palier : POST /api/onboarding/plan puis étape mise en ligne", async () => {
    renderWizard({ setupMode: "self", step: "plan", plan: "essentiel", billingCycle: "monthly" });
    fireEvent.click(screen.getByRole("button", { name: /Choisir/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/onboarding/plan", expect.objectContaining({ method: "POST" })));
    expect(bodyOf(0)).toEqual({ plan: "essentiel", cycle: "monthly" });
    expect(await screen.findByText("Tout est prêt")).toBeTruthy();
  });
});

describe("Étape mise en ligne (self)", () => {
  it("« Mettre ma carte en ligne » appelle POST /api/onboarding/complete et affiche le QR", async () => {
    renderWizard({ setupMode: "self", step: "launch", shopName: "Café du Léman", profileFilled: true });
    fireEvent.click(screen.getByRole("button", { name: /Mettre ma carte en ligne/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/onboarding/complete", expect.objectContaining({ method: "POST" })));
    expect(await screen.findByTestId("qr")).toBeTruthy();
  });
});
