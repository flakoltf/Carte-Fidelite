// Mock racine d'expo-router pour les tests : hors navigateur, un écran est
// considéré comme AU FOCUS (useFocusEffect exécute son effet), les redirections
// ne rendent rien. Les suites qui pilotent le focus posent leur propre
// jest.mock("expo-router", fabrique) — il prime sur ce fichier.
import { useEffect } from "react";

export function useFocusEffect(callback: () => void | (() => void)) {
  useEffect(callback, [callback]);
}

export function Redirect() {
  return null;
}

export const useRouter = () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() });
export const usePathname = () => "/";
