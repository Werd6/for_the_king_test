// Huddle Pass pricing for display. The real price is set by supabase/functions/create-checkout
// (keep supabase/functions/_shared/pricing.ts in sync).

export type PassKind = 'leader' | 'member';

export function passPriceCents(kind: PassKind, weeks: number): number {
  return (kind === 'leader' ? 100 : 50) * weeks;
}

/** ceil(weeks x 1.2) in whole numbers; 20 * 1.2 in floating point would round up to 25. */
export function accessWeeks(weeks: number): number {
  return Math.ceil((weeks * 6) / 5);
}

export function formatCents(cents: number): string {
  return cents % 100 === 0 ? `$${cents / 100}` : `$${(cents / 100).toFixed(2)}`;
}

/** When a started huddle's access ends, or null if it hasn't started. */
export function accessEndsAt(startedAt: string | null | undefined, weeks: number | null | undefined): Date | null {
  if (!startedAt || !weeks) return null;
  return new Date(new Date(startedAt).getTime() + weeks * 7 * 24 * 60 * 60 * 1000);
}
