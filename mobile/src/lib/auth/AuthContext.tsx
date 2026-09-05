import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { loginErrorMessage, totpErrorMessage, type AuthStatus } from "../authFlow";
import type { AuthGateway, MerchantProfile } from "./gateway";

export interface AuthContextValue {
  status: AuthStatus;
  merchant: MerchantProfile | null;
  /** Adresse saisie à l'étape mot de passe — affichée sur l'écran du code. */
  pendingEmail: string | null;
  signIn(email: string, password: string): Promise<void>;
  verifyTotp(code: string): Promise<void>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  gateway,
  children,
}: {
  gateway: AuthGateway;
  children: ReactNode;
}) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [merchant, setMerchant] = useState<MerchantProfile | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const mounted = useRef(true);

  const applyStatus = useCallback(
    async (next: AuthStatus) => {
      if (!mounted.current) return;
      setStatus(next);
      if (next === "signed-in") {
        const profile = await gateway.loadMerchant().catch(() => null);
        if (mounted.current) setMerchant(profile);
      } else if (next === "signed-out") {
        setMerchant(null);
        setPendingEmail(null);
      }
    },
    [gateway],
  );

  useEffect(() => {
    mounted.current = true;
    void gateway.resolveStatus().then(applyStatus).catch(() => applyStatus("signed-out"));
    const unsubscribe = gateway.subscribe(() => {
      void gateway.resolveStatus().then(applyStatus).catch(() => applyStatus("signed-out"));
    });
    return () => {
      mounted.current = false;
      unsubscribe();
    };
  }, [gateway, applyStatus]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      try {
        const next = await gateway.signInWithPassword(email, password);
        setPendingEmail(email.trim());
        await applyStatus(next);
      } catch (error) {
        throw new Error(loginErrorMessage(error instanceof Error ? error.message : null));
      }
    },
    [gateway, applyStatus],
  );

  const verifyTotp = useCallback(
    async (code: string) => {
      try {
        await gateway.verifyTotp(code);
      } catch (error) {
        throw new Error(totpErrorMessage(error instanceof Error ? error.message : null));
      }
      await applyStatus(await gateway.resolveStatus());
    },
    [gateway, applyStatus],
  );

  const signOut = useCallback(async () => {
    await gateway.signOut();
    await applyStatus("signed-out");
  }, [gateway, applyStatus]);

  const value = useMemo<AuthContextValue>(
    () => ({ status, merchant, pendingEmail, signIn, verifyTotp, signOut }),
    [status, merchant, pendingEmail, signIn, verifyTotp, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth doit être appelé dans un <AuthProvider>.");
  return value;
}
