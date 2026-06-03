import { FRAUD_RULES } from "./config";

// Nombre max d'évènements tombant dans une même fenêtre glissante de `windowMs`.
export function maxInWindow(timestamps: number[], windowMs: number): number {
  if (timestamps.length === 0) return 0;
  const ts = [...timestamps].sort((a, b) => a - b);
  let max = 1, start = 0;
  for (let end = 0; end < ts.length; end++) {
    while (ts[end] - ts[start] >= windowMs) start++;
    max = Math.max(max, end - start + 1);
  }
  return max;
}

export type Flag = { kind: string; label: string; count: number; threshold: number; windowLabel: string; cardId?: string };
export type SignalsInput = {
  scans: { cardId: string; at: number }[];
  redemptions: { at: number }[];
  enrollments: { at: number }[];
};

export function evaluateSignals(input: SignalsInput): Flag[] {
  const flags: Flag[] = [];
  const r = FRAUD_RULES;

  const check = (kind: string, rule: { windowMs: number; threshold: number; label: string; windowLabel: string }, times: number[]) => {
    const peak = maxInWindow(times, rule.windowMs);
    if (peak > rule.threshold)
      flags.push({ kind, label: rule.label, count: peak, threshold: rule.threshold, windowLabel: rule.windowLabel });
  };

  check("scan_burst", r.scanBurst, input.scans.map((s) => s.at));
  check("redeem_burst", r.redeemBurst, input.redemptions.map((s) => s.at));
  check("enroll_burst", r.enrollBurst, input.enrollments.map((s) => s.at));

  const byCard = new Map<string, number[]>();
  for (const s of input.scans) {
    const arr = byCard.get(s.cardId) ?? [];
    arr.push(s.at);
    byCard.set(s.cardId, arr);
  }
  for (const [cardId, times] of byCard) {
    const peak = maxInWindow(times, r.cardFarming.windowMs);
    if (peak > r.cardFarming.threshold)
      flags.push({ kind: "card_farming", label: r.cardFarming.label, count: peak, threshold: r.cardFarming.threshold, windowLabel: r.cardFarming.windowLabel, cardId });
  }

  return flags;
}
