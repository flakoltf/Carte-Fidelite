"use client";
import { useReducedMotion } from "framer-motion";

/** Renvoie true si l'utilisateur demande moins de mouvement. */
export function useHaloMotion() {
  const reduced = useReducedMotion();
  return { reduced: !!reduced };
}
