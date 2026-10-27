// Records Huddle Passes from Stripe. Deploy with --no-verify-jwt: Stripe signs each request
// instead. Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET.
// Stripe events: checkout.session.completed, checkout.session.async_payment_succeeded, charge.refunded.
import Stripe from 'npm:stripe@^22';
import { createClient } from 'npm:@supabase/supabase-js@2';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
const cryptoProvider = Stripe.createSubtleCryptoProvider();
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

async function recordPass(session: Stripe.Checkout.Session) {
  if (session.payment_status !== 'paid') return;
  const { huddle_id, user_id, kind } = session.metadata ?? {};
  if (!huddle_id || !user_id || (kind !== 'leader' && kind !== 'member')) {
    console.warn(`Session ${session.id} has no Huddle Pass metadata; ignoring.`);
    return;
  }
  const paymentIntent =
    typeof session.payment_intent === 'string' ? session.payment_intent : (session.payment_intent?.id ?? null);

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
  if ((result === 'already_has_pass' || result === 'gone') && paymentIntent) {
    await stripe.refunds.create(
      { payment_intent: paymentIntent, reason: result === 'already_has_pass' ? 'duplicate' : 'requested_by_customer' },
      { idempotencyKey: `huddle-pass-refund-${session.id}` }
    );
    console.log(`Refunded session ${session.id}: ${result}`);
  }
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
