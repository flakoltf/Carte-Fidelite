import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";

import type { AuthStatus } from "../../authFlow";
import { AuthProvider, useAuth } from "../AuthContext";
import type { AuthGateway, MerchantProfile } from "../gateway";

const CAFE: MerchantProfile = {
  id: "m1",
  shopName: "Café du Rhône",
  role: "merchant",
  email: "demo@example.com",
};

/** Passerelle en mémoire : aucun réseau, aucun Supabase. */
function fakeGateway(overrides: Partial<AuthGateway> = {}) {
  const listeners = new Set<() => void>();
  const gateway: AuthGateway = {
    resolveStatus: jest.fn(async () => "signed-out" as AuthStatus),
    signInWithPassword: jest.fn(async () => "signed-in" as AuthStatus),
    verifyTotp: jest.fn(async () => {}),
    signOut: jest.fn(async () => {}),
    loadMerchant: jest.fn(async () => CAFE),
    subscribe: (onChange) => {
      listeners.add(onChange);
      return () => listeners.delete(onChange);
    },
    ...overrides,
  };
  return { gateway, notify: () => listeners.forEach((listener) => listener()) };
}

function mount(gateway: AuthGateway) {
  return renderHook(() => useAuth(), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <AuthProvider gateway={gateway}>{children}</AuthProvider>
    ),
  });
}

describe("AuthProvider", () => {
  it("part de « loading » puis retombe sur la session réelle", async () => {
    const { gateway } = fakeGateway();
    const { result } = await mount(gateway);

    await waitFor(() => expect(result.current.status).toBe("signed-out"));
    expect(gateway.resolveStatus).toHaveBeenCalled();
  });

  it("restaure une session déjà stockée et charge le commerce", async () => {
    const { gateway } = fakeGateway({ resolveStatus: jest.fn(async () => "signed-in") });
    const { result } = await mount(gateway);

    await waitFor(() => expect(result.current.status).toBe("signed-in"));
    await waitFor(() => expect(result.current.merchant?.shopName).toBe("Café du Rhône"));
  });

  it("réclame le second facteur quand le compte a la 2FA", async () => {
    const { gateway } = fakeGateway({ signInWithPassword: jest.fn(async () => "mfa-required") });
    const { result } = await mount(gateway);
    await waitFor(() => expect(result.current.status).toBe("signed-out"));

    await act(async () => {
      await result.current.signIn(" demo@example.com ", "motdepasse");
    });

    expect(result.current.status).toBe("mfa-required");
    // Le commerce n'est pas chargé tant que la session n'est pas complète.
    expect(gateway.loadMerchant).not.toHaveBeenCalled();
    expect(result.current.pendingEmail).toBe("demo@example.com");
  });

  it("ouvre directement la session quand il n'y a pas de 2FA", async () => {
    const { gateway } = fakeGateway();
    const { result } = await mount(gateway);
    await waitFor(() => expect(result.current.status).toBe("signed-out"));

    await act(async () => {
      await result.current.signIn("demo@example.com", "motdepasse");
    });

    expect(result.current.status).toBe("signed-in");
    expect(gateway.signInWithPassword).toHaveBeenCalledWith("demo@example.com", "motdepasse");
  });

  it("traduit un échec de connexion sans recopier Supabase", async () => {
    const { gateway } = fakeGateway({
      signInWithPassword: jest.fn(async () => {
        throw new Error("Invalid login credentials");
      }),
    });
    const { result } = await mount(gateway);
    await waitFor(() => expect(result.current.status).toBe("signed-out"));

    await expect(result.current.signIn("demo@example.com", "faux")).rejects.toThrow(
      "E-mail ou mot de passe incorrect.",
    );
    expect(result.current.status).toBe("signed-out");
  });

  it("passe à « signed-in » une fois le code TOTP validé", async () => {
    const resolveStatus = jest
      .fn<Promise<AuthStatus>, []>()
      .mockResolvedValueOnce("mfa-required")
      .mockResolvedValue("signed-in");
    const { gateway } = fakeGateway({ resolveStatus });
    const { result } = await mount(gateway);
    await waitFor(() => expect(result.current.status).toBe("mfa-required"));

    await act(async () => {
      await result.current.verifyTotp("123456");
    });

    expect(gateway.verifyTotp).toHaveBeenCalledWith("123456");
    expect(result.current.status).toBe("signed-in");
  });

  it("traduit un code refusé", async () => {
    const { gateway } = fakeGateway({
      resolveStatus: jest.fn(async () => "mfa-required"),
      verifyTotp: jest.fn(async () => {
        throw new Error("Invalid TOTP code entered");
      }),
    });
    const { result } = await mount(gateway);
    await waitFor(() => expect(result.current.status).toBe("mfa-required"));

    await expect(result.current.verifyTotp("000000")).rejects.toThrow("Code incorrect. Réessayez.");
    expect(result.current.status).toBe("mfa-required");
  });

  it("oublie le commerce à la déconnexion", async () => {
    const { gateway } = fakeGateway({ resolveStatus: jest.fn(async () => "signed-in") });
    const { result } = await mount(gateway);
    await waitFor(() => expect(result.current.merchant?.shopName).toBe("Café du Rhône"));

    await act(async () => {
      await result.current.signOut();
    });

    expect(result.current.status).toBe("signed-out");
    expect(result.current.merchant).toBeNull();
    expect(gateway.signOut).toHaveBeenCalled();
  });

  it("suit une session révoquée depuis l'extérieur", async () => {
    const resolveStatus = jest
      .fn<Promise<AuthStatus>, []>()
      .mockResolvedValueOnce("signed-in")
      .mockResolvedValue("signed-out");
    const { gateway, notify } = fakeGateway({ resolveStatus });
    const { result } = await mount(gateway);
    await waitFor(() => expect(result.current.status).toBe("signed-in"));

    await act(async () => {
      notify();
    });

    await waitFor(() => expect(result.current.status).toBe("signed-out"));
  });

  it("retombe sur « signed-out » si la passerelle échoue", async () => {
    const { gateway } = fakeGateway({
      resolveStatus: jest.fn(async () => {
        throw new Error("réseau");
      }),
    });
    const { result } = await mount(gateway);

    await waitFor(() => expect(result.current.status).toBe("signed-out"));
  });
});
