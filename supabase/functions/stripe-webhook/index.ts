// Records Huddle Passes bought through the Stripe Payment Links. Deploy with --no-verify-jwt:
// Stripe signs each request instead. Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET.
// Stripe events: checkout.session.completed, checkout.session.async_payment_succeeded, charge.refunded.
import Stripe from 'npm:stripe@^22';
import { createClient } from 'npm:@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
const cryptoProvider = Stripe.createSubtleCryptoProvider();
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

type PassKind = 'leader' | 'member';

/** Same for leaders and members. Keep in sync with lib/pricing.ts and the Stripe Payment Link price ($9.99 for 20 weeks). */
function passPriceCents(weeks: number): number {
  return 50 * weeks - 1;
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
/** The app adds client_reference_id=<huddle id>__<user id> to the Payment Link. */
const REFERENCE = new RegExp(`^(${UUID})__(${UUID})$`, 'i');

async function refund(paymentIntent: string | null, sessionId: string, reason: string) {
  if (!paymentIntent) return;
  await stripe.refunds.create(
    { payment_intent: paymentIntent, reason: reason === 'already_has_pass' ? 'duplicate' : 'requested_by_customer' },
    { idempotencyKey: `huddle-pass-refund-${sessionId}` }
  );
  console.log(`Refunded session ${sessionId}: ${reason}`);
}

async function recordPass(session: Stripe.Checkout.Session) {
  // 100%-off promotion codes complete as 'no_payment_required' with no PaymentIntent.
  if (session.payment_status !== 'paid' && session.payment_status !== 'no_payment_required') return;
  const match = REFERENCE.exec(session.client_reference_id ?? '');
  if (!match) {
    console.warn(`Session ${session.id} has no Huddle Pass reference; ignoring.`);
    return;
  }
  const [, huddle_id, user_id] = match;
  const paymentIntent =
    typeof session.payment_intent === 'string' ? session.payment_intent : (session.payment_intent?.id ?? null);

  // Leader vs. member comes from the database, not from which link was used.
  const { data: huddle } = await admin
    .from('huddles')
    .select('leader_id, pathway_version_id')
    .eq('id', huddle_id)
    .maybeSingle();
  if (!huddle) {
    await refund(paymentIntent, session.id, 'gone');
    return;
  }
  const { data: version } = await admin
    .from('pathway_versions')
    .select('total_weeks')
    .eq('id', huddle.pathway_version_id)
    .maybeSingle();
  const kind: PassKind = huddle.leader_id === user_id ? 'leader' : 'member';
  const expected = version?.total_weeks ? passPriceCents(version.total_weeks) : null;
  // Promotion codes lower the total, not the subtotal.
  if (expected === null || (session.amount_subtotal ?? 0) < expected) {
    console.warn(`Session ${session.id} subtotal ${session.amount_subtotal} is below the price ${expected}.`);
    await refund(paymentIntent, session.id, 'wrong_price');
    return;
  }

  const { data: result, error } = await admin.rpc('record_stripe_pass', {
    p_session_id: session.id,
    p_payment_intent: paymentIntent,
    p_huddle_id: huddle_id,
    p_user_id: user_id,
    p_kind: kind,
    p_amount_cents: session.amount_total ?? 0,
  });
  if (error) throw error;

  // Paid twice, or the huddle/account is gone: give the money back.
  if (result === 'already_has_pass' || result === 'gone') await refund(paymentIntent, session.id, result);
}

Deno.serve(async (req) => {
  const signature = req.headers.get('Stripe-Signature');
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature ?? '',
      Deno.env.get('STRIPE_WEBHOOK_SECRET')!,
      undefined,
      cryptoProvider
    );
  } catch (e) {
    return new Response(`Invalid signature: ${(e as Error).message}`, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        await recordPass(event.data.object as Stripe.Checkout.Session);
        break;
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntent =
          typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
        // Partial refunds keep the pass.
        if (charge.refunded && paymentIntent) {
          const { error } = await admin.rpc('refund_stripe_pass', { p_payment_intent: paymentIntent });
          if (error) throw error;
        }
        break;
      }
    }
    return Response.json({ received: true });
  } catch (e) {
    // A 500 makes Stripe retry later.
    console.error(`stripe-webhook ${event.type} failed`, e);
    return new Response('Webhook handler failed', { status: 500 });
  }
});
