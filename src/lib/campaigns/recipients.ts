import { DAY_MS } from "@/lib/segments/types";

// Garde les cartes jamais notifiées ou notifiées il y a plus de `cooldownDays`.
export function selectRecurringRecipients(
  cardIds: string[],
  lastSentByCard: Map<string, Date>,
  cooldownDays: number,
  now: Date,
): string[] {
  const cutoff = now.getTime() - cooldownDays * DAY_MS;
  return cardIds.filter((id) => {
    const last = lastSentByCard.get(id);
    return !last || last.getTime() <= cutoff;
  });
}
