import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { ClientsScreen } from "../ClientsScreen";

// L'écran parle au client API central (`api()`), remplacé ici par un faux qui
// sert le contrat des routes segments. Aucun réseau.
const mockApi = { get: jest.fn() };
jest.mock("@/lib/api", () => ({
  ...jest.requireActual("@/lib/api"),
  api: () => mockApi,
}));

const summary = {
  total: 3,
  stages: {
    nouveau: { count: 1, pct: 33 }, regulier: { count: 1, pct: 33 }, vip: { count: 1, pct: 33 },
    en_train_de_partir: { count: 0, pct: 0 }, inactif: { count: 0, pct: 0 },
  },
  flags: { recompense_prete: 1, joignable_push: 2 },
};

const NOW = new Date("2026-09-05T10:00:00.000Z");

function serve(members: Record<string, unknown[]>) {
  mockApi.get.mockImplementation(async (path: string) => {
    if (path === "/api/segments") return { data: summary };
    const stage = path.replace("/api/segments/", "");
    return { data: members[stage] ?? [] };
  });
}

const BASE = {
  vip: [{ customerId: "a", name: "Anna Roux", lastScan: "2026-09-04T09:00:00.000Z", visits: 12, stamps: 3 }],
  regulier: [{ customerId: "m", name: "Marc Dupont", lastScan: "2026-08-12T09:00:00.000Z", visits: 5, stamps: 5 }],
  nouveau: [{ customerId: "b", name: "Bruno Ky", lastScan: null, visits: 0, stamps: 0 }],
};

beforeEach(() => {
  mockApi.get.mockReset();
});

describe("ClientsScreen", () => {
  it("pendant le chargement : indicateur, ni recherche ni liste", async () => {
    mockApi.get.mockReturnValue(new Promise(() => {}));
    await render(<ClientsScreen now={() => NOW} />);

    expect(screen.getByText("Chargement de vos clients…")).toBeTruthy();
    expect(screen.queryByTestId("recherche-clients")).toBeNull();
  });

  it("affiche la liste : nom, segment, dernier passage, visites", async () => {
    serve(BASE);
    await render(<ClientsScreen now={() => NOW} />);

    expect(await screen.findByText("Anna Roux")).toBeTruthy();
    expect(screen.getByText("Marc Dupont")).toBeTruthy();
    expect(screen.getByText("Bruno Ky")).toBeTruthy();
    // Trié par dernier passage : Anna (hier), Marc (12 août), Bruno (jamais).
    expect(screen.getByText("Hier")).toBeTruthy();
    expect(screen.getByText("12 août")).toBeTruthy();
    expect(screen.getByText("Jamais venu")).toBeTruthy();
    expect(screen.getByText("12 visites")).toBeTruthy();
    expect(screen.getByText("3 clients")).toBeTruthy();
  });

  it("recherche par nom", async () => {
    serve(BASE);
    await render(<ClientsScreen now={() => NOW} />);
    await screen.findByText("Anna Roux");

    await fireEvent.changeText(screen.getByTestId("recherche-clients"), "marc");
    expect(screen.queryByText("Anna Roux")).toBeNull();
    expect(screen.getByText("Marc Dupont")).toBeTruthy();
  });

  it("filtre par segment avec le compte du serveur, et revient à « Tous »", async () => {
    serve(BASE);
    await render(<ClientsScreen now={() => NOW} />);
    await screen.findByText("Anna Roux");

    await fireEvent.press(screen.getByTestId("segment-nouveau"));
    expect(screen.queryByText("Anna Roux")).toBeNull();
    expect(screen.getByText("Bruno Ky")).toBeTruthy();
    expect(screen.getByTestId("segment-nouveau").props.accessibilityState).toMatchObject({ selected: true });

    await fireEvent.press(screen.getByTestId("segment-all"));
    expect(screen.getByText("Anna Roux")).toBeTruthy();
  });

  it("aucun résultat de recherche : message dédié, pas l'état vide de la base", async () => {
    serve(BASE);
    await render(<ClientsScreen now={() => NOW} />);
    await screen.findByText("Anna Roux");

    await fireEvent.changeText(screen.getByTestId("recherche-clients"), "zzz");
    expect(screen.getByText("Aucun client ne correspond à votre recherche.")).toBeTruthy();
  });

  it("base vide : invitation à afficher le QR en caisse (même copy que le web)", async () => {
    serve({});
    await render(<ClientsScreen now={() => NOW} />);

    expect(await screen.findByText("Vos clients apparaîtront ici dès leur première carte.")).toBeTruthy();
  });

  it("erreur réseau : message lisible et bouton Réessayer qui recharge", async () => {
    mockApi.get.mockRejectedValueOnce(new Error("Connexion impossible. Vérifiez votre réseau."));
    await render(<ClientsScreen now={() => NOW} />);

    expect(await screen.findByText("Connexion impossible. Vérifiez votre réseau.")).toBeTruthy();
    serve(BASE);
    await fireEvent.press(screen.getByRole("button", { name: "Réessayer" }));
    expect(await screen.findByText("Anna Roux")).toBeTruthy();
  });

  it("au tap sur une ligne : fiche simple avec les mêmes informations, en grand", async () => {
    serve(BASE);
    await render(<ClientsScreen now={() => NOW} />);
    await screen.findByText("Anna Roux");

    await fireEvent.press(screen.getByTestId("client-a"));
    const sheet = await screen.findByTestId("fiche-client");
    expect(sheet).toBeTruthy();
    expect(screen.getAllByText("Anna Roux").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Dernier passage")).toBeTruthy();
    expect(screen.getByText("Segment")).toBeTruthy();
    expect(screen.getAllByText("VIP").length).toBeGreaterThanOrEqual(1);

    await fireEvent.press(screen.getByRole("button", { name: "Fermer" }));
    await waitFor(() => expect(screen.queryByTestId("fiche-client")).toBeNull());
  });

  it("les lignes et les filtres offrent une cible tactile d'au moins 44 pt", async () => {
    serve(BASE);
    await render(<ClientsScreen now={() => NOW} />);
    await screen.findByText("Anna Roux");

    const flatten = (style: unknown) =>
      Object.assign({}, ...(Array.isArray(style) ? style.flat(Infinity) : [style]).filter(Boolean));
    const row = flatten(screen.getByTestId("client-a").props.style);
    expect(row.minHeight as number).toBeGreaterThanOrEqual(44);
    const chip = flatten(screen.getByTestId("segment-vip").props.style);
    expect(chip.minHeight as number).toBeGreaterThanOrEqual(44);
  });
});
