// Starts a Stripe Checkout for the caller's Huddle Pass. The pass kind and price are decided
// here from the database, never by the app. Promotion codes (e.g. 100% off for testers and
// App Review) are entered on the Stripe page. Secrets: STRIPE_SECRET_KEY, SITE_URL, and
// optionally APP_RETURN_URL (where the phone apps' in-app browser lands after checkout).
import Stripe from 'npm:stripe@^22';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders, json } from '../_shared/http.ts';
import { accessWeeks, passPriceCents, type PassKind } from '../_shared/pricing.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!);
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});
const SITE_URL = (Deno.env.get('SITE_URL') || 'https://for-the-king-test.vercel.app').replace(/\/+$/, '');
const APP_RETURN_URL = (Deno.env.get('APP_RETURN_URL') || 'https://goandmake.online/pass').replace(/\/+$/, '');

/** Return to the page that started checkout when it's the site itself or local development. */
function returnBase(requested: unknown): string {
  if (typeof requested !== 'string') return SITE_URL;
  try {
    const url = new URL(requested);
    const local = /^(localhost|127\.0\.0\.1)$/.test(url.hostname);
    if (url.origin === new URL(SITE_URL).origin || local) return url.origin;
  } catch {
    // fall through
  }
  return SITE_URL;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const jwt = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    const { data: auth } = jwt ? await admin.auth.getUser(jwt) : { data: { user: null } };
    const user = auth.user;
    if (!user) return json({ error: 'Sign in to get a Huddle Pass.' }, 401);

    const { huddleId, returnUrl } = await req.json().catch(() => ({}));
    if (typeof huddleId !== 'string') return json({ error: 'Missing huddle.' }, 400);

    const { data: huddle } = await admin
      .from('huddles')
      .select('id, leader_id, billing_exempt, started_at, access_weeks, pathway_id, pathway_version_id')
      .eq('id', huddleId)
      .maybeSingle();
    if (!huddle) return json({ error: 'Huddle not found.' }, 404);

    const kind: PassKind = huddle.leader_id === user.id ? 'leader' : 'member';
    if (kind === 'member') {
      const { data: membership } = await admin
        .from('memberships')
        .select('id')
        .eq('huddle_id', huddleId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!membership) return json({ error: 'Join the huddle before getting a pass.' }, 403);
    }
    if (huddle.billing_exempt) return json({ error: 'This huddle is free; no pass needed.' }, 409);
    if (huddle.started_at && huddle.access_weeks) {
      const ends = new Date(huddle.started_at).getTime() + huddle.access_weeks * 7 * 24 * 60 * 60 * 1000;
      if (Date.now() >= ends) return json({ error: "This huddle's access has ended." }, 409);
    }

    const { data: existing } = await admin
      .from('huddle_passes')
      .select('id')
      .eq('huddle_id', huddleId)
      .eq('user_id', user.id)
      .is('refunded_at', null)
      .maybeSingle();
    if (existing) return json({ error: 'You already have a pass for this huddle.' }, 409);

    const [{ data: version }, { data: pathway }] = await Promise.all([
      admin.from('pathway_versions').select('total_weeks').eq('id', huddle.pathway_version_id).single(),
      admin.from('pathways').select('name').eq('id', huddle.pathway_id).single(),
    ]);
    const weeks = version?.total_weeks as number | undefined;
    if (!weeks) return json({ error: 'Could not price this pathway.' }, 500);

    const metadata = { huddle_id: huddle.id, user_id: user.id, kind, weeks: String(weeks) };
    const fromApp = returnUrl === 'app';
    const base = returnBase(returnUrl);
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      client_reference_id: user.id,
      customer_email: user.email ?? undefined,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: passPriceCents(kind, weeks),
            product_data: {
              name: kind === 'leader' ? 'Huddle Pass: Leader' : 'Huddle Pass: Member',
              description: `${pathway?.name ?? 'Pathway'}: ${weeks} weeks, with ${accessWeeks(weeks)} weeks of access`,
            },
          },
        },
      ],
      allow_promotion_codes: true,
      metadata,
      payment_intent_data: { metadata },
      success_url: fromApp ? `${APP_RETURN_URL}?pass=success` : `${base}/?pass=success`,
      cancel_url: fromApp ? `${APP_RETURN_URL}?pass=cancelled` : `${base}/?pass=cancelled`,
    });

    return json({ url: session.url });
  } catch (e) {
    console.error('create-checkout failed', e);
    return json({ error: 'Could not start checkout. Try again.' }, 500);
  }
});
