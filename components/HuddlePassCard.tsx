import { Body, Card, PrimaryButton, SecondaryButton } from '@/components/ui';
import { getPassLinks, openPassCheckout, startHuddle, type PassLinks } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { useContent } from '@/lib/ContentContext';
import { confirmAction, showAlert } from '@/lib/dialogs';
import { friendlyError } from '@/lib/errors';
import { accessEndsAt, accessWeeks, formatCents, passPriceCents } from '@/lib/pricing';
import { useEffect, useState } from 'react';

function formatDate(date: Date) {
  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

/**
 * Huddle Pass status at the top of This Week, shown until access is active.
 * Get Huddle Pass opens the pathway's Stripe Payment Link (new tab on web, in-app browser on the
 * phone apps). Testers and App Review enter a 100%-off promotion code on the Stripe page.
 */
export function HuddlePassCard() {
  const {
    userId,
    profile,
    huddle,
    access,
    isLeader,
    checkoutReturn,
    dismissCheckoutReturn,
    checkoutOpened,
    confirmCheckout,
    refresh,
  } = useAuth();
  const { pathway } = useContent();
  const [busy, setBusy] = useState(false);
  const [links, setLinks] = useState<PassLinks | null>(null);

  const pathwayId = huddle?.pathway_id;
  const needsPass = access === 'unpaid';
  useEffect(() => {
    if (!pathwayId || !needsPass) return;
    let cancelled = false;
    getPassLinks(pathwayId)
      .then((next) => {
        if (!cancelled) setLinks(next);
      })
      .catch(() => {
        if (!cancelled) setLinks({ leader: null, member: null });
      });
    return () => {
      cancelled = true;
    };
  }, [pathwayId, needsPass]);

  if (!huddle || !pathway || access === 'active' || access === 'exempt' || access === 'none') {
    return null;
  }

  const weeks = pathway.totalWeeks;
  const endsAt = accessEndsAt(huddle.started_at, huddle.access_weeks);
  const link = isLeader ? links?.leader : links?.member;

  async function buy() {
    if (!huddle || !userId || !link) return;
    dismissCheckoutReturn();
    setBusy(true);
    try {
      const result = await openPassCheckout(link, huddle.id, userId, profile?.email);
      setBusy(false);
      if (result === 'closed') await confirmCheckout();
      else checkoutOpened();
    } catch (e) {
      showAlert('Huddle Pass', friendlyError(e, 'Could not open checkout. Try again.'));
      setBusy(false);
    }
  }

  async function begin() {
    if (!huddle) return;
    const ok = await confirmAction(
      'Start Week 1?',
      `Your ${weeks}-week pathway includes ${accessWeeks(weeks)} weeks of access (${
        accessWeeks(weeks) - weeks
      } extra for breaks and missed weeks). The clock starts now for everyone in the huddle; members still need their own Member Pass to check in.`,
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
        <Body>Checking for your pass…</Body>
      </Card>
    );
  }

  const price = formatCents(passPriceCents(weeks));
  const accessText = endsAt
    ? `This huddle has started; access runs until ${formatDate(endsAt)}.`
    : `Includes ${accessWeeks(weeks)} weeks of access, starting when ${
        isLeader ? 'you start' : 'your leader starts'
      } Week 1.`;

  return (
    <Card title="Huddle Pass">
      {checkoutReturn === 'unconfirmed' ? (
        <Body>
          Finished checking out? Your pass can take a minute to show up; tap Check again. If you
          closed checkout early, you haven&apos;t been charged.
        </Body>
      ) : null}
      <Body>
        Pay once for the entire pathway: 50¢/week for everyone in the huddle, leader included. Every
        Huddle includes an additional 20% of time for breaks and missed weeks.
      </Body>
      <Body>
        {isLeader ? 'Leader Pass' : 'Your pass'} for this {weeks}-week pathway: {price}. {accessText}
      </Body>
      {checkoutReturn === 'unconfirmed' ? (
        <SecondaryButton title="Check again" onPress={() => confirmCheckout()} />
      ) : null}
      {link ? (
        <>
          <PrimaryButton
            title={busy ? 'Opening checkout…' : `Get Huddle Pass (${price})`}
            onPress={buy}
            disabled={busy}
          />
          <Body>Have an access code? Enter it on the checkout page.</Body>
        </>
      ) : (
        <Body>{links ? 'Huddle Passes for this pathway aren’t available yet.' : 'Loading…'}</Body>
      )}
    </Card>
  );
}
