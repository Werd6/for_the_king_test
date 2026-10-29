// Huddle Pass pricing. Keep in sync with lib/pricing.ts and the Stripe Payment Link prices.

export type PassKind = 'leader' | 'member';

/** $1 (leader) or 50¢ (member) per week, minus 1¢: For The King is $19.99 / $9.99. */
export function passPriceCents(kind: PassKind, weeks: number): number {
  return (kind === 'leader' ? 100 : 50) * weeks - 1;
}

/** ceil(weeks x 1.2) in whole numbers; 20 * 1.2 in floating point would round up to 25. */
export function accessWeeks(weeks: number): number {
  return Math.ceil((weeks * 6) / 5);
}
