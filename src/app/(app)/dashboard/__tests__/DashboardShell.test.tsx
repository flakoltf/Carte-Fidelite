// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import type { ReactNode } from "react";
import DashboardShell from "../DashboardShell";

// next/navigation : routeur stub + chemin courant fixe (Vue d'ensemble active).
const push = vi.fn();
vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push }),
}));

// next/link → simple <a> (pas de routeur App nécessaire en test).
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// Supabase client : on n'exerce que signOut au logout.
const signOut = vi.fn().mockResolvedValue({ error: null });
vi.mock("@/utils/supabase/client", () => ({ createClient: () => ({ auth: { signOut } }) }));

// framer-motion → éléments simples (pas d'animation en test).
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
  useReducedMotion: () => false,
  motion: new Proxy(
    {},
    {
      get: (_t, tag: string) => {
        const Tag = tag as "div";
        return ({ children, ...rest }: { children?: ReactNode }) => {
          const { initial, animate, exit, transition, layoutId, ...dom } = rest as Record<string, unknown>;
          void initial;
          void animate;
          void exit;
          void transition;
          void layoutId;
          return <Tag {...(dom as object)}>{children}</Tag>;
        };
      },
    },
  ),
}));

describe("<DashboardShell>", () => {
  beforeEach(() => {
    push.mockReset();
    signOut.mockClear();
  });
  afterEach(cleanup);

  it("expose une navigation accessible (rôle nav + aria-label)", () => {
    render(<DashboardShell><div /></DashboardShell>);
    // Desktop + mobile partagent le même aria-label → au moins une nav nommée.
    const navs = screen.getAllByRole("navigation", { name: /navigation principale/i });
    expect(navs.length).toBeGreaterThanOrEqual(1);
  });

  it("regroupe les items en 5 zones titrées", () => {
    render(<DashboardShell><div /></DashboardShell>);
    for (const title of ["Comptoir", "Ma carte", "Clients", "Marketing", "Réglages"]) {
      expect(screen.getAllByText(title).length).toBeGreaterThanOrEqual(1);
    }
  });

  it("met le Scanner en avant (gras) dans la zone Comptoir, vers /dashboard/scan", () => {
    render(<DashboardShell><div /></DashboardShell>);
    const scanLinks = screen.getAllByRole("link", { name: /^scanner$/i });
    expect(scanLinks.length).toBeGreaterThanOrEqual(1);
    const desktop = scanLinks[0];
    expect(desktop.getAttribute("href")).toBe("/dashboard/scan");
    // « mis en avant » = libellé en gras.
    expect(within(desktop).getByText("Scanner").className).toContain("font-bold");
  });

  it("les liens des 5 zones pointent vers les bonnes routes", () => {
    render(<DashboardShell><div /></DashboardShell>);
    const cases: Record<string, string> = {
      "Vue d'ensemble": "/dashboard",
      "Ma carte": "/dashboard/card",
      "Studio de carte": "/dashboard/studio",
      Clients: "/dashboard/customers",
      Groupes: "/dashboard/segments",
      Campagnes: "/dashboard/campaigns",
      "Messages clients": "/dashboard/notifications",
      Abonnement: "/dashboard/subscription",
      "Sécurité": "/dashboard/security",
      "Paramètres": "/dashboard/settings",
      "Activité": "/dashboard/activity",
    };
    for (const [name, href] of Object.entries(cases)) {
      const links = screen.getAllByRole("link", { name: new RegExp(`^${name}$`, "i") });
      expect(links[0].getAttribute("href")).toBe(href);
    }
  });

  it("marque la page courante avec aria-current", () => {
    render(<DashboardShell><div /></DashboardShell>);
    const active = screen.getAllByRole("link", { name: /vue d'ensemble/i })[0];
    expect(active.getAttribute("aria-current")).toBe("page");
  });

  it("propose la déconnexion", () => {
    render(<DashboardShell><div /></DashboardShell>);
    expect(screen.getAllByRole("button", { name: /déconnexion/i }).length).toBeGreaterThanOrEqual(1);
  });
});
