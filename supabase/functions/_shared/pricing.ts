// Huddle Pass pricing. Keep in sync with lib/pricing.ts (the app only displays it).

export type PassKind = 'leader' | 'member';

export function passPriceCents(kind: PassKind, weeks: number): number {
  return (kind === 'leader' ? 100 : 50) * weeks;
}

/** ceil(weeks x 1.2) in whole numbers; 20 * 1.2 in floating point would round up to 25. */
export function accessWeeks(weeks: number): number {
  return Math.ceil((weeks * 6) / 5);
}
