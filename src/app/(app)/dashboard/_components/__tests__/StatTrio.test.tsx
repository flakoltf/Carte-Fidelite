// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import StatTrio from "../StatTrio";
import { getComptoirStats } from "../../_actions/comptoirStats";

// La Server Action est mockée : le test du composant ne touche jamais la BDD.
vi.mock("../../_actions/comptoirStats", () => ({ getComptoirStats: vi.fn() }));
const mockedStats = vi.mocked(getComptoirStats);

describe("<StatTrio>", () => {
  beforeEach(() => mockedStats.mockReset());
  afterEach(cleanup);

  it("affiche le skeleton avant la réponse de la Server Action", () => {
    let resolve!: (v: { activeCards: number; scansToday: number; rewardsDue: number }) => void;
    mockedStats.mockReturnValue(new Promise((r) => { resolve = r; }));
    render(<StatTrio />);
    expect(screen.getByTestId("stat-skeleton-activeCards")).toBeTruthy();
    expect(screen.getByRole("group", { name: /chiffres clés/i }).getAttribute("aria-busy")).toBe("true");
    resolve({ activeCards: 0, scansToday: 0, rewardsDue: 0 });
  });

  it("affiche les 3 chiffres et leurs libellés français", async () => {
    mockedStats.mockResolvedValue({ activeCards: 128, scansToday: 9, rewardsDue: 3 });
    render(<StatTrio />);
    expect(await screen.findByText("128")).toBeTruthy();
    expect(screen.getByText("9")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("Cartes actives")).toBeTruthy();
    expect(screen.getByText("Scans aujourd’hui")).toBeTruthy();
    expect(screen.getByText("Récompenses dues")).toBeTruthy();
  });

  it("affiche 0 (et non un skeleton infini) quand le commerce n'a aucune donnée", async () => {
    // getComptoirStats avale déjà les erreurs DB en zéros (cf. stats.test.ts) :
    // le comptoir voit « 0 », jamais une erreur brute au-dessus du bouton Scanner.
    mockedStats.mockResolvedValue({ activeCards: 0, scansToday: 0, rewardsDue: 0 });
    render(<StatTrio />);
    expect(await screen.findAllByText("0")).toHaveLength(3);
    expect(screen.queryByTestId("stat-skeleton-activeCards")).toBeNull();
  });
});
