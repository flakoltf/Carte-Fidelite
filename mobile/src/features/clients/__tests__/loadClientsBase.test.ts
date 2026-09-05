import type { ApiClient } from "@/lib/api";

import { loadClientsBase } from "../loadClientsBase";

const summary = {
  total: 2,
  stages: {
    nouveau: { count: 1, pct: 50 }, regulier: { count: 0, pct: 0 }, vip: { count: 1, pct: 50 },
    en_train_de_partir: { count: 0, pct: 0 }, inactif: { count: 0, pct: 0 },
  },
  flags: { recompense_prete: 0, joignable_push: 1 },
};

function fakeClient(routes: Record<string, unknown>): ApiClient & { calls: string[] } {
  const calls: string[] = [];
  const get = jest.fn(async (path: string) => {
    calls.push(path);
    if (!(path in routes)) throw new Error(`route inattendue : ${path}`);
    return routes[path];
  });
  return { calls, get, post: jest.fn(), patch: jest.fn(), del: jest.fn(), request: jest.fn() } as unknown as ApiClient & { calls: string[] };
}

describe("loadClientsBase — la base clients à partir des routes segments", () => {
  it("lit le résumé et les 5 segments en une passe, et fusionne en lignes", async () => {
    const client = fakeClient({
      "/api/segments": { data: summary },
      "/api/segments/nouveau": { data: [{ customerId: "b", name: "Bruno", lastScan: null, visits: 1, stamps: 1 }] },
      "/api/segments/regulier": { data: [] },
      "/api/segments/vip": { data: [{ customerId: "a", name: "Anna", lastScan: "2026-09-04T09:00:00.000Z", visits: 12, stamps: 3 }] },
      "/api/segments/en_train_de_partir": { data: [] },
      "/api/segments/inactif": { data: [] },
    });

    const base = await loadClientsBase(client);

    expect(base.summary).toEqual(summary);
    expect(base.rows.map((r) => [r.id, r.stage])).toEqual([["a", "vip"], ["b", "nouveau"]]);
    expect([...client.calls].sort()).toEqual([
      "/api/segments",
      "/api/segments/en_train_de_partir",
      "/api/segments/inactif",
      "/api/segments/nouveau",
      "/api/segments/regulier",
      "/api/segments/vip",
    ]);
  });

  it("une route en échec fait échouer le chargement (jamais une base partielle présentée comme complète)", async () => {
    const client = fakeClient({ "/api/segments": { data: summary } });
    await expect(loadClientsBase(client)).rejects.toThrow(/route inattendue/);
  });

  it("tolère une réponse sans data (défensif) en la traitant comme vide", async () => {
    const client = fakeClient({
      "/api/segments": { data: summary },
      "/api/segments/nouveau": {}, "/api/segments/regulier": {}, "/api/segments/vip": {},
      "/api/segments/en_train_de_partir": {}, "/api/segments/inactif": {},
    });
    const base = await loadClientsBase(client);
    expect(base.rows).toEqual([]);
  });
});
