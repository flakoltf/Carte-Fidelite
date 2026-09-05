import { ACTIVE_CARD_DAYS, fetchComptoirStats, type CountClient } from "../stats";

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

const NOW = new Date("2026-09-05T18:00:00.000Z");

describe("fetchComptoirStats", () => {
  it("compte les cartes actives et les scans du jour", async () => {
    const { client } = fakeClient({ loyalty_cards: { count: 128 }, scan_history: { count: 17 } });

    expect(await fetchComptoirStats(client, "marchand-1", NOW)).toEqual({
      activeCards: 128,
      scansToday: 17,
    });
  });

  it("pose le filtre de tenant sur chaque requête (invariant tenancy)", async () => {
    const { client, calls } = fakeClient({});

    await fetchComptoirStats(client, "marchand-1", NOW);

    expect(calls).toHaveLength(2);
    for (const call of calls) expect(call.filters).toContain("eq:merchant_id=marchand-1");
  });

  it("« carte active » = installée OU scannée dans les 90 derniers jours", async () => {
    const { client, calls } = fakeClient({});

    await fetchComptoirStats(client, "marchand-1", NOW);

    const cards = calls.find((c) => c.table === "loyalty_cards");
    const cutoff = new Date("2026-06-07T18:00:00.000Z").toISOString();
    expect(ACTIVE_CARD_DAYS).toBe(90);
    expect(cards?.filters).toContain(`or:last_scan.gte.${cutoff},created_at.gte.${cutoff}`);
  });

  it("« scans aujourd'hui » = fenêtre glissante de 24 heures", async () => {
    const { client, calls } = fakeClient({});

    await fetchComptoirStats(client, "marchand-1", NOW);

    const scans = calls.find((c) => c.table === "scan_history");
    expect(scans?.filters).toContain(`gte:scanned_at=${new Date("2026-09-04T18:00:00.000Z").toISOString()}`);
  });

  it("une erreur de lecture vaut zéro — le comptoir ne s'arrête jamais sur un chiffre", async () => {
    const { client } = fakeClient({
      loyalty_cards: { error: { message: "rls" } },
      scan_history: { count: 5 },
    });

    expect(await fetchComptoirStats(client, "marchand-1", NOW)).toEqual({
      activeCards: 0,
      scansToday: 5,
    });
  });

  it("un compte absent vaut zéro", async () => {
    const { client } = fakeClient({ loyalty_cards: { count: null }, scan_history: { count: null } });

    expect(await fetchComptoirStats(client, "marchand-1", NOW)).toEqual({
      activeCards: 0,
      scansToday: 0,
    });
  });
});
