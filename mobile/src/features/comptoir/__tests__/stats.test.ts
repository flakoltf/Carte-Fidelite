import { ACTIVE_CARD_DAYS, fetchComptoirStats, fetchRewardsDue, type CountClient, type JsonGetter } from "../stats";

interface Recorded {
  table: string;
  filters: string[];
  count: number | null;
  error: unknown;
}

/** Faux client Supabase : enregistre les filtres posés, ne touche à rien. */
function fakeClient(results: Record<string, { count?: number | null; error?: unknown }>) {
  const calls: Recorded[] = [];
  const client: CountClient = {
    from(table: string) {
      const rec: Recorded = {
        table,
        filters: [],
        count: results[table]?.count ?? 0,
        error: results[table]?.error ?? null,
      };
      calls.push(rec);
      const query = {
        select: () => query,
        eq: (column: string, value: string) => {
          rec.filters.push(`eq:${column}=${value}`);
          return query;
        },
        or: (filter: string) => {
          rec.filters.push(`or:${filter}`);
          return query;
        },
        gte: (column: string, value: string) => {
          rec.filters.push(`gte:${column}=${value}`);
          return query;
        },
        then: (resolve: (r: { count: number | null; error: unknown }) => unknown) =>
          Promise.resolve({ count: rec.count, error: rec.error }).then(resolve),
      };
      return query as unknown as ReturnType<CountClient["from"]>;
    },
  };
  return { client, calls };
}

/** Faux client API : la route Bearer /api/comptoir/rewards-due, sans réseau. */
function fakeApi(reponse: unknown, options: { panne?: boolean } = {}) {
  const paths: string[] = [];
  const apiClient: JsonGetter = {
    get: async <T,>(path: string): Promise<T> => {
      paths.push(path);
      if (options.panne) throw new Error("réseau coupé");
      return reponse as T;
    },
  };
  return { apiClient, paths };
}

const NOW = new Date("2026-09-05T18:00:00.000Z");

describe("fetchComptoirStats", () => {
  it("compte les cartes actives, les scans du jour et les récompenses dues (route serveur)", async () => {
    const { client } = fakeClient({ loyalty_cards: { count: 128 }, scan_history: { count: 17 } });
    const { apiClient, paths } = fakeApi({ rewardsDue: 4 });

    expect(await fetchComptoirStats(client, "marchand-1", NOW, apiClient)).toEqual({
      activeCards: 128,
      scansToday: 17,
      rewardsDue: 4,
    });
    // Le comptage vient de la route Bearer — jamais recalculé côté mobile.
    expect(paths).toEqual(["/api/comptoir/rewards-due"]);
  });

  it("pose le filtre de tenant sur chaque requête (invariant tenancy)", async () => {
    const { client, calls } = fakeClient({});

    await fetchComptoirStats(client, "marchand-1", NOW, fakeApi({ rewardsDue: 0 }).apiClient);

    expect(calls).toHaveLength(2);
    for (const call of calls) expect(call.filters).toContain("eq:merchant_id=marchand-1");
  });

  it("« carte active » = installée OU scannée dans les 90 derniers jours", async () => {
    const { client, calls } = fakeClient({});

    await fetchComptoirStats(client, "marchand-1", NOW, fakeApi({ rewardsDue: 0 }).apiClient);

    const cards = calls.find((c) => c.table === "loyalty_cards");
    const cutoff = new Date("2026-06-07T18:00:00.000Z").toISOString();
    expect(ACTIVE_CARD_DAYS).toBe(90);
    expect(cards?.filters).toContain(`or:last_scan.gte.${cutoff},created_at.gte.${cutoff}`);
  });

  it("« scans aujourd'hui » = fenêtre glissante de 24 heures", async () => {
    const { client, calls } = fakeClient({});

    await fetchComptoirStats(client, "marchand-1", NOW, fakeApi({ rewardsDue: 0 }).apiClient);

    const scans = calls.find((c) => c.table === "scan_history");
    expect(scans?.filters).toContain(`gte:scanned_at=${new Date("2026-09-04T18:00:00.000Z").toISOString()}`);
  });

  it("une erreur de lecture vaut zéro — le comptoir ne s'arrête jamais sur un chiffre", async () => {
    const { client } = fakeClient({
      loyalty_cards: { error: { message: "rls" } },
      scan_history: { count: 5 },
    });

    expect(await fetchComptoirStats(client, "marchand-1", NOW, fakeApi({ rewardsDue: 2 }).apiClient)).toEqual({
      activeCards: 0,
      scansToday: 5,
      rewardsDue: 2,
    });
  });

  it("la route des récompenses dues en panne vaut zéro, sans bloquer les autres chiffres", async () => {
    const { client } = fakeClient({ loyalty_cards: { count: 12 }, scan_history: { count: 3 } });

    expect(await fetchComptoirStats(client, "marchand-1", NOW, fakeApi(null, { panne: true }).apiClient)).toEqual({
      activeCards: 12,
      scansToday: 3,
      rewardsDue: 0,
    });
  });

  it("un compte absent vaut zéro", async () => {
    const { client } = fakeClient({ loyalty_cards: { count: null }, scan_history: { count: null } });

    expect(await fetchComptoirStats(client, "marchand-1", NOW, fakeApi({}).apiClient)).toEqual({
      activeCards: 0,
      scansToday: 0,
      rewardsDue: 0,
    });
  });
});

describe("fetchRewardsDue", () => {
  it("lit le comptage du serveur tel quel", async () => {
    expect(await fetchRewardsDue(fakeApi({ rewardsDue: 7 }).apiClient)).toBe(7);
  });

  it("réponse illisible (absente, négative, non numérique) → zéro", async () => {
    expect(await fetchRewardsDue(fakeApi(null).apiClient)).toBe(0);
    expect(await fetchRewardsDue(fakeApi({}).apiClient)).toBe(0);
    expect(await fetchRewardsDue(fakeApi({ rewardsDue: -3 }).apiClient)).toBe(0);
    expect(await fetchRewardsDue(fakeApi({ rewardsDue: "4" }).apiClient)).toBe(0);
  });
});
