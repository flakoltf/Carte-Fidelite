import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";

import { getSupabase } from "@/lib/supabase";

import { fetchComptoirStats, type ComptoirStats, type CountClient } from "./stats";

/**
 * Chiffres du jour : relus à chaque retour sur l'onglet, et après chaque crédit
 * (le compteur de scans doit bouger sous les yeux du commerçant). Les appels
 * concurrents sont coalescés — au comptoir, on scanne vite.
 */
export function useComptoirStats(merchantId: string | null | undefined) {
  const [stats, setStats] = useState<ComptoirStats | null>(null);
  const [chargement, setChargement] = useState(false);
  const enCours = useRef(false);
  const monte = useRef(true);

  const rafraichir = useCallback(async () => {
    if (!merchantId || enCours.current) return;
    enCours.current = true;
    setChargement(true);
    try {
      const client = getSupabase() as unknown as CountClient;
      const valeurs = await fetchComptoirStats(client, merchantId, new Date());
      if (monte.current) setStats(valeurs);
    } catch {
      // Un chiffre indisponible ne doit jamais empêcher de scanner : on garde
      // la dernière valeur connue (ou « — » au premier chargement).
    } finally {
      enCours.current = false;
      if (monte.current) setChargement(false);
    }
  }, [merchantId]);

  useFocusEffect(
    useCallback(() => {
      monte.current = true;
      void rafraichir();
      return () => {
        monte.current = false;
      };
    }, [rafraichir]),
  );

  return { stats, chargement, rafraichir };
}
