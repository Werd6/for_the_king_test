import { Body, Card, PrimaryButton, SecondaryButton } from '@/components/ui';
import { startCheckout, startHuddle } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { useContent } from '@/lib/ContentContext';
import { confirmAction, showAlert } from '@/lib/dialogs';
import { friendlyError } from '@/lib/errors';
import { accessEndsAt, accessWeeks, formatCents, passPriceCents } from '@/lib/pricing';
import { useState } from 'react';
import { Platform } from 'react-native';

function formatDate(date: Date) {
  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

/**
 * Huddle Pass status at the top of This Week, shown until access is active.
 * Passes are bought through Stripe Checkout: in the same tab on web, in an in-app browser on
 * the phone apps. Testers and App Review enter a 100%-off promotion code on the Stripe page.
 */
export function HuddlePassCard() {
  const { huddle, access, isLeader, checkoutReturn, dismissCheckoutReturn, confirmCheckout, refresh } =
    useAuth();
  const { pathway } = useContent();
  const [busy, setBusy] = useState(false);

  if (!huddle || !pathway || access === 'active' || access === 'exempt' || access === 'none') {
    return null;
  }

  const weeks = pathway.totalWeeks;
  const endsAt = accessEndsAt(huddle.started_at, huddle.access_weeks);
  const isWeb = Platform.OS === 'web';

  async function buy() {
    if (!huddle) return;
    setBusy(true);
    dismissCheckoutReturn();
    try {
      const result = await startCheckout(huddle.id);
      if (result === 'left') return;
      setBusy(false);
      if (result === 'closed') await confirmCheckout(true);
    } catch (e) {
      showAlert('Huddle Pass', friendlyError(e, 'Could not start checkout. Try again.'));
      setBusy(false);
    }
  }

  async function begin() {
    if (!huddle) return;
    const ok = await confirmAction(
      'Start Week 1?',
      `Your ${weeks}-week pathway includes ${accessWeeks(weeks)} weeks of access for the whole huddle, starting now.`,
      'Start'
    );
    if (!ok) return;
    setBusy(true);
    try {
      await startHuddle(huddle.id);
      await refresh();
    } catch (e) {
      showAlert('Error', friendlyError(e, 'Could not start Week 1.'));
    } finally {
      setBusy(false);
    }
  }

  if (access === 'expired') {
    return (
      <Card title="Huddle Pass">
        <Body>
          This huddle&apos;s access ended{endsAt ? ` on ${formatDate(endsAt)}` : ''}. Your progress and
          journal stay available to view.
        </Body>
      </Card>
    );
  }

  if (access === 'not_started') {
    return (
      <Card title="Huddle Pass">
        {isLeader ? (
          <>
            <Body>
              Your Leader Pass is active. Start Week 1 when your huddle is ready. Your {weeks}-week
              pathway includes {accessWeeks(weeks)} weeks of access, starting when you tap Start.
            </Body>
            <PrimaryButton
              title={busy ? 'Starting…' : 'Start Week 1'}
              onPress={begin}
              disabled={busy}
            />
          </>
        ) : (
          <Body>Your pass is ready. Check-ins open when your leader starts Week 1.</Body>
        )}
      </Card>
    );
  }

  // unpaid
  if (checkoutReturn === 'confirming') {
    return (
      <Card title="Huddle Pass">
        <Body>{isWeb ? 'Payment received. Activating your pass…' : 'Checking for your pass…'}</Body>
      </Card>
    );
  }

  const kind = isLeader ? 'leader' : 'member';
  const price = formatCents(passPriceCents(kind, weeks));
  const accessText = endsAt
    ? `This huddle has started; access runs until ${formatDate(endsAt)}.`
    : `Includes ${accessWeeks(weeks)} weeks of access, starting when ${
        isLeader ? 'you start' : 'your leader starts'
      } Week 1.`;

  return (
    <Card title="Huddle Pass">
      {checkoutReturn === 'delayed' ? (
        <Body>
          We&apos;re still confirming your payment. This can take a minute; tap Check again shortly.
        </Body>
      ) : null}
      {checkoutReturn === 'cancelled' ? (
        <Body>Checkout was cancelled. You haven&apos;t been charged.</Body>
      ) : null}
      {checkoutReturn === 'unconfirmed' ? (
        <Body>
          Finished checking out? Your pass can take a minute to show up; tap Check again. If you
          closed checkout early, you haven&apos;t been charged.
        </Body>
      ) : null}
      <Body>
        Pay once for the entire pathway. Leader access is $1/week and participant access is
        50¢/week. Every Huddle includes an additional 20% of time for breaks and missed weeks.
      </Body>
      <Body>
        {isLeader ? 'Leader Pass' : 'Your pass'} for this {weeks}-week pathway: {price}. {accessText}
      </Body>
      {checkoutReturn === 'delayed' || checkoutReturn === 'unconfirmed' ? (
        <SecondaryButton title="Check again" onPress={() => confirmCheckout(!isWeb)} />
      ) : null}
      <PrimaryButton
        title={busy ? 'Opening checkout…' : `Get Huddle Pass (${price})`}
        onPress={buy}
        disabled={busy}
      />
      <Body>Have an access code? Enter it on the checkout page.</Body>
    </Card>
  );
}
