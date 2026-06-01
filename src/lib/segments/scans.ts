export function tallyScansByCard(rows: { card_id: string }[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rows) m.set(r.card_id, (m.get(r.card_id) ?? 0) + 1);
  return m;
}
