import { render, screen } from "@testing-library/react-native";

import { _resetSessionNotice, markSessionExpired } from "@/lib/sessionNotice";

jest.mock("expo-router", () => ({ Redirect: () => null }));
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
