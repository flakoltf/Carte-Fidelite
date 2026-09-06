import { render, screen } from "@testing-library/react-native";

import { _resetSessionNotice, markSessionExpired } from "@/lib/sessionNotice";

jest.mock("expo-router");
jest.mock("@/lib/auth/AuthContext", () => ({
  useAuth: () => ({
    status: "signed-out",
    merchant: null,
    pendingEmail: null,
    signIn: jest.fn(),
    verifyTotp: jest.fn(),
    signOut: jest.fn(),
  }),
}));

// eslint-disable-next-line import/first
import ConnexionScreen from "../index";

beforeEach(() => _resetSessionNotice());

describe("Écran de connexion — session expirée", () => {
  it("affiche la notice posée par le client API après un 401, puis la consomme", async () => {
    markSessionExpired();
    await render(<ConnexionScreen />);

    expect(screen.getByTestId("notice-session").props.children).toBe("Votre session a expiré. Reconnectez-vous.");
  });

  it("n'affiche rien sans 401 préalable", async () => {
    await render(<ConnexionScreen />);
    expect(screen.queryByTestId("notice-session")).toBeNull();
  });
});

describe("Écran de connexion — clavier", () => {
  it("la touche « suivant » de l'e-mail passe au mot de passe sans fermer le clavier", async () => {
    await render(<ConnexionScreen />);
    const email = screen.getByTestId("champ-email");
    expect(email.props.returnKeyType).toBe("next");
    expect(email.props.submitBehavior).toBe("submit");
    expect(typeof email.props.onSubmitEditing).toBe("function");
    // Le mot de passe valide le formulaire depuis le clavier.
    expect(screen.getByTestId("champ-mot-de-passe").props.returnKeyType).toBe("go");
  });
});
