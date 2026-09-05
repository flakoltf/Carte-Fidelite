// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import type { ReactNode } from "react";
import AdminShell from "../AdminShell";

// Bug n°3 (audit PR #78) : la coque admin avait le patron « min-h-screen +
// <main h-screen pt-24> + en-tête mobile fixed » du dashboard AVANT le correctif
// fond noir. Mesuré au navigateur (iPhone 13, /admin/merchants/[id]/card) : le
// document défilait de 117 px sous la coque (inputs fichier sr-only hors
// conteneur). Même correctif que DashboardShell : seule <main> défile, elle est
// positionnée (relative) et peinte, l'en-tête mobile est dans le flux.
// La preuve de non-défilement du document vit dans e2e/admin-scroll.spec.ts ;
// ici on verrouille la STRUCTURE qui la rend possible.

vi.mock("next/navigation", () => ({ usePathname: () => "/admin", useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/utils/supabase/client", () => ({ createClient: () => ({ auth: { signOut: vi.fn() } }) }));
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children?: ReactNode }) => <>{children}</>,
  motion: new Proxy({}, { get: (_t, tag: string) => ({ children, ...rest }: { children?: ReactNode }) => {
    const { initial, animate, exit, transition, ...dom } = rest as Record<string, unknown>;
    void initial; void animate; void exit; void transition;
    const Tag = tag as "div";
    return <Tag {...(dom as object)}>{children}</Tag>;
  } }),
}));

afterEach(cleanup);

describe("<AdminShell> — coque sans espace mort défilable", () => {
  it("<main> est le seul conteneur de défilement : positionnée, peinte, sans hauteur d'écran propre ni pt-24", () => {
    const { container } = render(<AdminShell><div>contenu</div></AdminShell>);
    const main = container.querySelector("main")!;
    const cls = main.className.split(/\s+/);
    expect(cls).toContain("overflow-y-auto");
    expect(cls).toContain("relative");
    expect(cls).toContain("min-h-0");
    expect(cls).toContain("bg-calcaire");
    expect(cls).not.toContain("h-screen");
    expect(cls).not.toContain("pt-24");
  });

  it("la racine remplit la colonne parente (flex-1, min-h-0) au lieu d'imposer min-h-screen", () => {
    const { container } = render(<AdminShell><div>contenu</div></AdminShell>);
    const root = container.firstElementChild as HTMLElement;
    const cls = root.className.split(/\s+/);
    expect(cls).toContain("flex-1");
    expect(cls).toContain("min-h-0");
    expect(cls).toContain("overflow-hidden");
    expect(cls).not.toContain("min-h-screen");
  });

  it("l'en-tête mobile est dans le flux (jamais fixed)", () => {
    const { container } = render(<AdminShell><div>contenu</div></AdminShell>);
    const fixed = Array.from(container.querySelectorAll("[class]")).filter((el) =>
      (el.getAttribute("class") ?? "").split(/\s+/).includes("fixed"),
    );
    expect(fixed).toHaveLength(0);
  });
});
