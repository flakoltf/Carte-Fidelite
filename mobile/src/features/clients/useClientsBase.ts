import { useCallback, useEffect, useRef, useState } from "react";

import { loadClientsBase, type ClientsBase } from "./loadClientsBase";

export type ClientsBaseState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; base: ClientsBase };

/** Charge la base au montage ; `refresh` la recharge (tirer-pour-rafraîchir), `retry` repasse par l'indicateur. */
export function useClientsBase(loader: () => Promise<ClientsBase> = loadClientsBase) {
  const [state, setState] = useState<ClientsBaseState>({ status: "loading" });
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);

  // Les mises à jour d'état n'ont lieu qu'à la résolution de la promesse,
  // jamais de façon synchrone dans l'effet (règle react-hooks).
  const fetchBase = useCallback(
    () =>
      loader()
        .then(
          (base) => {
            if (mounted.current) setState({ status: "ready", base });
          },
          (error: unknown) => {
            const message =
              error instanceof Error && error.message ? error.message : "Impossible de charger vos clients.";
            if (mounted.current) setState({ status: "error", message });
          },
        )
        .finally(() => {
          if (mounted.current) setRefreshing(false);
        }),
    [loader],
  );

  useEffect(() => {
    mounted.current = true;
    void fetchBase();
    return () => {
      mounted.current = false;
    };
  }, [fetchBase]);

  return {
    state,
    refreshing,
    refresh: () => {
      setRefreshing(true);
      return fetchBase();
    },
    retry: () => {
      setState({ status: "loading" });
      return fetchBase();
    },
  };
}
