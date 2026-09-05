/* eslint-disable @typescript-eslint/no-require-imports -- les fabriques jest.mock
   sont hissées avant les imports ES : elles ne peuvent utiliser que require(). */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import { ApiError } from "@/lib/api";

// ── Aucun appel réel : ni caméra, ni réseau, ni Supabase. ─────────────────────
const mockPost = jest.fn();
const mockDemanderPermission = jest.fn();
let mockPermission: { granted: boolean; canAskAgain: boolean } | null = {
  granted: true,
  canAskAgain: true,
};

jest.mock("expo-camera", () => {
  const React = require("react");
  const { Pressable } = require("react-native");
  return {
    useCameraPermissions: () => [mockPermission, mockDemanderPermission],
    // La caméra est remplacée par un bouton : « appuyer » = « un QR est lu ».
    CameraView: ({ onBarcodeScanned }: { onBarcodeScanned: (r: { data: string }) => void }) =>
      React.createElement(Pressable, {
        testID: "camera-simulee",
        onPress: () => onBarcodeScanned({ data: "QR-CARTE-1" }),
      }),
  };
});

jest.mock("expo-haptics", () => ({
  notificationAsync: jest.fn().mockResolvedValue(undefined),
  NotificationFeedbackType: { Success: "success", Warning: "warning", Error: "error" },
}));

jest.mock("expo-router", () => {
  const React = require("react");
  return {
    useFocusEffect: (callback: () => void | (() => void)) => {
      React.useEffect(callback, [callback]);
    },
  };
});

jest.mock("@/lib/api", () => {
  const actual = jest.requireActual("@/lib/api");
  return { ...actual, api: () => ({ post: mockPost, get: jest.fn(), patch: jest.fn(), del: jest.fn(), request: jest.fn() }) };
});

jest.mock("@/lib/supabase", () => ({
  getSupabase: () => {
    const query = {
      select: () => query,
      eq: () => query,
      or: () => query,
      gte: () => query,
      then: (resolve: (r: { count: number; error: null }) => unknown) =>
        Promise.resolve({ count: 7, error: null }).then(resolve),
    };
    return { from: () => query };
  },
}));

jest.mock("@/lib/auth/AuthContext", () => ({
  useAuth: () => ({
    status: "signed-in",
    merchant: { id: "marchand-1", shopName: "Café du Rhône", role: "merchant", email: null },
    pendingEmail: null,
    signIn: jest.fn(),
    verifyTotp: jest.fn(),
    signOut: jest.fn(),
  }),
}));

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");
  return { SafeAreaView: ({ children }: { children: ReactNode }) => React.createElement(View, null, children) };
});

// Importé APRÈS les mocks (les écrans les résolvent à l'import).
// eslint-disable-next-line import/first
import { ComptoirScreen } from "../ComptoirScreen";

const CREDIT = {
  success: true,
  added: true,
  rewardReady: false,
  loyaltyType: "stamp_card",
  stampGoal: 8,
  card: { stamps_count: 4, customers: { full_name: "Marie Favre" } },
};

const scanner = async () => {
  await fireEvent.press(screen.getByTestId("camera-simulee"));
};

beforeEach(() => {
  jest.clearAllMocks();
  mockPermission = { granted: true, canAskAgain: true };
});

describe("ComptoirScreen — permission caméra", () => {
  it("explique à quoi sert la caméra avant de la demander", async () => {
    mockPermission = { granted: false, canAskAgain: true };
    await render(<ComptoirScreen />);

    expect(screen.getByTestId("demande-permission")).toBeTruthy();
    expect(screen.queryByTestId("viseur")).toBeNull();

    await fireEvent.press(screen.getByTestId("bouton-autoriser"));
    expect(mockDemanderPermission).toHaveBeenCalled();
  });

  it("renvoie vers les réglages quand l'accès est refusé pour de bon", async () => {
    mockPermission = { granted: false, canAskAgain: false };
    await render(<ComptoirScreen />);

    expect(screen.getByTestId("bouton-reglages")).toBeTruthy();
  });
});

describe("ComptoirScreen — scan", () => {
  it("affiche les chiffres du jour au-dessus du viseur", async () => {
    await render(<ComptoirScreen />);

    await waitFor(() => expect(screen.getAllByText("7")).toHaveLength(2));
    expect(screen.getByTestId("viseur")).toBeTruthy();
  });

  it("crédite la carte lue et affiche le résultat en grand", async () => {
    mockPost.mockResolvedValue(CREDIT);
    await render(<ComptoirScreen />);

    await scanner();

    await waitFor(() => expect(screen.getByTestId("resultat-titre").props.children).toBe("+1 tampon"));
    expect(mockPost).toHaveBeenCalledWith("/api/scan", { cardId: "QR-CARTE-1" });
    expect(screen.getByTestId("resultat-detail").props.children).toBe("4 / 8");
  });

  it("ne crédite qu'une fois même si la caméra relit le code aussitôt", async () => {
    mockPost.mockResolvedValue(CREDIT);
    await render(<ComptoirScreen />);

    await scanner();
    await scanner();
    await scanner();

    await waitFor(() => expect(screen.getByTestId("resultat-scan")).toBeTruthy());
    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it("propose d'annuler le tampon qui vient d'être posé", async () => {
    mockPost.mockResolvedValue(CREDIT);
    await render(<ComptoirScreen />);

    await scanner();

    await waitFor(() => expect(screen.getByTestId("bandeau-annuler")).toBeTruthy());
    expect(screen.getByText("Annuler ce tampon")).toBeTruthy();
  });

  it("ne propose jamais d'annuler un crédit en points", async () => {
    mockPost.mockResolvedValue({
      success: true,
      added: true,
      rewardReady: false,
      loyaltyType: "points",
      pointsAdded: 10,
      currentValue: 130,
      maxThreshold: 200,
    });
    await render(<ComptoirScreen />);

    await scanner();

    await waitFor(() => expect(screen.getByTestId("resultat-titre").props.children).toBe("+10 points"));
    expect(screen.queryByTestId("bandeau-annuler")).toBeNull();
  });

  it("annule via la route serveur et confirme", async () => {
    mockPost.mockResolvedValueOnce(CREDIT).mockResolvedValueOnce({ success: true });
    await render(<ComptoirScreen />);
    await scanner();
    await waitFor(() => expect(screen.getByTestId("bandeau-annuler")).toBeTruthy());

    await fireEvent.press(screen.getByTestId("bandeau-annuler"));

    await waitFor(() => expect(screen.getByTestId("note-annulation")).toBeTruthy());
    expect(mockPost).toHaveBeenCalledWith("/api/scan/revert", { cardId: "QR-CARTE-1" });
    expect(screen.getByText("Tampon annulé")).toBeTruthy();
  });

  it("montre le refus du serveur si la fenêtre est passée", async () => {
    mockPost
      .mockResolvedValueOnce(CREDIT)
      .mockRejectedValueOnce(
        new ApiError("Trop tard pour annuler : plus de 5 minutes se sont écoulées depuis ce tampon.", 409),
      );
    await render(<ComptoirScreen />);
    await scanner();
    await waitFor(() => expect(screen.getByTestId("bandeau-annuler")).toBeTruthy());

    await fireEvent.press(screen.getByTestId("bandeau-annuler"));

    await waitFor(() =>
      expect(screen.getByText(/Trop tard pour annuler/)).toBeTruthy(),
    );
  });

  it("affiche un doublon sans proposer d'annulation", async () => {
    mockPost.mockRejectedValue(
      new ApiError("Carte déjà scannée à l'instant. Patientez quelques secondes.", 429, { cooldown: true }),
    );
    await render(<ComptoirScreen />);

    await scanner();

    await waitFor(() =>
      expect(screen.getByTestId("resultat-titre").props.children).toBe("Déjà scanné il y a un instant"),
    );
    expect(screen.queryByTestId("bandeau-annuler")).toBeNull();
  });

  it("affiche l'état hors ligne quand le réseau manque", async () => {
    mockPost.mockRejectedValue(new ApiError("Connexion impossible. Vérifiez votre réseau.", 0));
    await render(<ComptoirScreen />);

    await scanner();

    await waitFor(() => expect(screen.getByTestId("resultat-titre").props.children).toBe("Pas de réseau"));
  });

  it("garde la récompense à l'écran : elle appelle un geste du commerçant", async () => {
    jest.useFakeTimers();
    try {
      mockPost.mockResolvedValue({ ...CREDIT, rewardReady: true, card: { stamps_count: 8 } });
      await render(<ComptoirScreen />);
      await scanner();
      await waitFor(() => expect(screen.getByTestId("resultat-titre").props.children).toBe("Récompense atteinte"));

      await act(async () => {
        jest.advanceTimersByTime(5000);
      });

      expect(screen.getByTestId("resultat-scan")).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it("rend la main au viseur tout seul après un crédit", async () => {
    jest.useFakeTimers();
    try {
      mockPost.mockResolvedValue(CREDIT);
      await render(<ComptoirScreen />);
      await scanner();
      await waitFor(() => expect(screen.getByTestId("resultat-scan")).toBeTruthy());

      await act(async () => {
        jest.advanceTimersByTime(1600);
      });

      expect(screen.queryByTestId("resultat-scan")).toBeNull();
      expect(screen.getByTestId("viseur")).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it("se referme aussi au toucher, sans attendre", async () => {
    mockPost.mockResolvedValue(CREDIT);
    await render(<ComptoirScreen />);
    await scanner();
    await waitFor(() => expect(screen.getByTestId("resultat-scan")).toBeTruthy());

    await fireEvent.press(screen.getByTestId("resultat-scan"));

    expect(screen.queryByTestId("resultat-scan")).toBeNull();
  });
});
