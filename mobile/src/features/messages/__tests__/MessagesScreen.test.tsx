import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

import { MessagesScreen } from "../MessagesScreen";

// JAMAIS d'envoi réel : `api()` est remplacé par un faux dont on inspecte les appels.
const mockApi = { get: jest.fn(), post: jest.fn() };
jest.mock("@/lib/api", () => ({
  ...jest.requireActual("@/lib/api"),
  api: () => mockApi,
}));

const summary = {
  total: 7,
  stages: {
    nouveau: { count: 2, pct: 29 }, regulier: { count: 3, pct: 43 }, vip: { count: 1, pct: 14 },
    en_train_de_partir: { count: 1, pct: 14 }, inactif: { count: 0, pct: 0 },
  },
  flags: { recompense_prete: 1, joignable_push: 4 },
};

beforeEach(() => {
  mockApi.get.mockReset();
  mockApi.post.mockReset();
  mockApi.get.mockResolvedValue({ data: summary });
});

async function fillAndSend(title: string, body: string) {
  await fireEvent.changeText(screen.getByTestId("champ-titre"), title);
  await fireEvent.changeText(screen.getByTestId("champ-message"), body);
  await fireEvent.press(screen.getByTestId("bouton-envoyer"));
}

describe("MessagesScreen", () => {
  it("propose les mêmes audiences que le web, avec la taille de chaque groupe", async () => {
    await render(<MessagesScreen />);

    expect(await screen.findByText("Tous mes clients")).toBeTruthy();
    expect(screen.getByText("7 clients")).toBeTruthy();
    expect(screen.getByText("Réguliers")).toBeTruthy();
    expect(screen.getByText("3 clients")).toBeTruthy();
    expect(screen.getByText("Récompense prête")).toBeTruthy();
    // VIP (1), En train de partir (1) et Récompense prête (1) : singulier partout.
    expect(screen.getAllByText("1 client")).toHaveLength(3);
    expect(screen.getByText("Aucun client")).toBeTruthy();
    expect(screen.getByTestId("audience-all").props.accessibilityState).toMatchObject({ selected: true });
  });

  it("refuse un formulaire vide sans rien envoyer", async () => {
    await render(<MessagesScreen />);
    await screen.findByText("Tous mes clients");

    await fireEvent.press(screen.getByTestId("bouton-envoyer"));
    expect(screen.getByText("Donnez un titre à votre message.")).toBeTruthy();
    expect(screen.getByText("Écrivez votre message.")).toBeTruthy();
    expect(mockApi.post).not.toHaveBeenCalled();
  });

  it("envoie titre, message et audience choisie, puis confirme « Message envoyé à X clients »", async () => {
    mockApi.post.mockResolvedValue({ pushed: 3, reachable: 3 });
    await render(<MessagesScreen />);
    await screen.findByText("Tous mes clients");

    await fireEvent.press(screen.getByTestId("audience-regulier"));
    await fillAndSend("  Offre du week-end ", "-20 % samedi.");

    await waitFor(() =>
      expect(mockApi.post).toHaveBeenCalledWith("/api/notifications/send", {
        title: "Offre du week-end",
        body: "-20 % samedi.",
        audience: "regulier",
      }),
    );
    expect(await screen.findByText("Message envoyé à 3 clients. (3 ont la carte dans leur téléphone.)")).toBeTruthy();
    // Le formulaire est vidé après l'envoi (comme le web).
    expect(screen.getByTestId("champ-titre").props.value).toBe("");
    expect(screen.getByTestId("champ-message").props.value).toBe("");
  });

  it("personne de joignable : avertissement clair, pas de faux succès", async () => {
    mockApi.post.mockResolvedValue({ pushed: 0, reachable: 0 });
    await render(<MessagesScreen />);
    await screen.findByText("Tous mes clients");

    await fillAndSend("Titre", "Corps");
    expect(await screen.findByText(/Aucun client ne peut encore recevoir de message/)).toBeTruthy();
  });

  it("prévient AVANT l'envoi quand le groupe choisi est vide", async () => {
    await render(<MessagesScreen />);
    await screen.findByText("Tous mes clients");

    await fireEvent.press(screen.getByTestId("audience-inactif"));
    expect(screen.getByText("Personne dans ce groupe pour l'instant.")).toBeTruthy();
  });

  it("affiche l'erreur du serveur telle quelle (ex. quota d'envois)", async () => {
    mockApi.post.mockRejectedValue(new Error("Trop d'envois. Réessayez plus tard."));
    await render(<MessagesScreen />);
    await screen.findByText("Tous mes clients");

    await fillAndSend("Titre", "Corps");
    expect(await screen.findByText("Trop d'envois. Réessayez plus tard.")).toBeTruthy();
  });

  it("sans résumé (erreur de chargement) : le formulaire reste utilisable, sans tailles", async () => {
    mockApi.get.mockRejectedValue(new Error("Connexion impossible. Vérifiez votre réseau."));
    mockApi.post.mockResolvedValue({ pushed: 1, reachable: 1 });
    await render(<MessagesScreen />);

    expect(await screen.findByText("Tous mes clients")).toBeTruthy();
    expect(screen.queryByText("7 clients")).toBeNull();
    await fillAndSend("Titre", "Corps");
    expect(await screen.findByText("Message envoyé à 1 client. (1 a la carte dans son téléphone.)")).toBeTruthy();
  });

  it("les audiences offrent une cible tactile d'au moins 44 pt", async () => {
    await render(<MessagesScreen />);
    await screen.findByText("Tous mes clients");
    const style = Object.assign(
      {},
      ...[screen.getByTestId("audience-vip").props.style].flat(Infinity).filter(Boolean),
    );
    expect(style.minHeight as number).toBeGreaterThanOrEqual(44);
  });
});
