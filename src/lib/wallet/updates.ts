export function filterUpdatedSerials(
  cards: { serial: string; updatedAt: number }[],
  sinceTag?: string
): { serials: string[]; lastUpdated: string } {
  const since = sinceTag ? Number(sinceTag) : 0;
  const serials = cards.filter((c) => c.updatedAt > since).map((c) => c.serial);
  const lastUpdated = String(cards.reduce((m, c) => Math.max(m, c.updatedAt), since));
  return { serials, lastUpdated };
}
