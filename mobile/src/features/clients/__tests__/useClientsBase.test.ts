import { act, renderHook, waitFor } from "@testing-library/react-native";

import type { ClientsBase } from "../loadClientsBase";
import { useClientsBase } from "../useClientsBase";

const base = (n: number): ClientsBase => ({
  summary: {
    total: n,
    stages: {
      nouveau: { count: n, pct: 100 }, regulier: { count: 0, pct: 0 }, vip: { count: 0, pct: 0 },
      en_train_de_partir: { count: 0, pct: 0 }, inactif: { count: 0, pct: 0 },
    },
    flags: { recompense_prete: 0, joignable_push: 0 },
  },
  rows: [],
});

describe("useClientsBase", () => {
  it("« loading » tant que le serveur n'a pas répondu", async () => {
    const loader = jest.fn(() => new Promise<ClientsBase>(() => {}));
    const { result } = await renderHook(() => useClientsBase(loader));
    expect(result.current.state.status).toBe("loading");
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("charge au montage puis expose la base", async () => {
    const loader = jest.fn(async () => base(1));
    const { result } = await renderHook(() => useClientsBase(loader));

    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it("tirer-pour-rafraîchir : recharge SANS masquer la liste, puis remplace la base", async () => {
    const loader = jest.fn().mockResolvedValueOnce(base(1)).mockResolvedValueOnce(base(2));
    const { result } = await renderHook(() => useClientsBase(loader));
    await waitFor(() => expect(result.current.state.status).toBe("ready"));

    await act(async () => {
      await result.current.refresh();
    });

    expect(loader).toHaveBeenCalledTimes(2);
    expect(result.current.refreshing).toBe(false);
    expect(result.current.state).toMatchObject({ status: "ready", base: { summary: { total: 2 } } });
  });

  it("erreur au chargement → message ; Réessayer repasse par l'indicateur puis réussit", async () => {
    const loader = jest.fn().mockRejectedValueOnce(new Error("Connexion impossible.")).mockResolvedValueOnce(base(1));
    const { result } = await renderHook(() => useClientsBase(loader));
    await waitFor(() => expect(result.current.state).toEqual({ status: "error", message: "Connexion impossible." }));

    await act(async () => {
      await result.current.retry();
    });
    expect(result.current.state.status).toBe("ready");
  });
});
