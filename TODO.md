# Go and Make — Launch To-Do

Work top to bottom. Apple comes first because enrollment and review take the longest; Google Play follows.
Feature history is further down; anything still open there has been moved into a phase.

---

## Phase 1 — Start today (longest lead times)

- [x] **Apple Developer Program** ($99/yr)
  - [x] Decide: enroll as an individual or as an organization (Bespoke IT LLC / ministry)
  - [ ] If organization: request a free D-U-N-S number (can take 1–2 weeks)
  - [x] Enroll
- [x] Delete the Firebase service account key from Downloads

---

## Phase 2 — Security & compliance

SQL: `supabase/migrations/001_phase1_security.sql` · App code: `lib/api.ts` (already updated)

- [x] **Run the migration** in Supabase → SQL Editor, then push the app code right after
- [x] **Lock down huddle reads**
  - [x] `join_huddle_by_code(code)` function joins server-side
  - [x] Removed `huddles_select_by_invite_for_join` policy
  - [x] `memberships_insert_self` limited to a leader joining their own new huddle
  - [x] `joinHuddleByCode` calls the RPC
  - [x] Verify: Account B (not in a huddle) can't see Account A's huddle, but can join with the code
- [x] **Real account deletion**
  - [x] `delete_my_account()` function deletes led huddles, then the auth user (cascades profile, membership, progress)
  - [x] `deleteAccount` calls the RPC
  - [ ] Verify: the user disappears from Supabase → Authentication → Users
- [ ] **RLS audit**
  - [x] Leaders can't rewrite `leader_id`; checkmark upserts have an update policy; picks stay attributed to the leader
  - [ ] Verify with two accounts in different huddles: neither sees the other's members, progress, or huddle
- [ ] **Supabase Pro plan** — free projects pause after a week without activity

---

## Phase 3 — Polish & app fixes

- [x] **App icon** — replace `assets/images/icon.png` (1024×1024, no transparency)
- [x] **Android adaptive icon** — replace foreground/background/monochrome PNGs
  - [x] Background color set to palette `#DEE5E5`
- [x] **Splash screen** — replace `splash-icon.png`
  - [x] Background `#DEE5E5` light / `#082D0F` dark
- [x] **Favicon** for web — replace `assets/images/favicon.png` (48×48)
- [x] **Forgot password**
  - [x] "Forgot password?" link on sign-in + `/reset-password` screen
  - [x] Recovery links that land on `/` are routed to `/reset-password`; email links always use the public site URL on web
  - [x] Supabase → Authentication → URL Configuration: Site URL `https://for-the-king-test.vercel.app`; Redirect URLs `https://for-the-king-test.vercel.app/**`, `http://localhost:8081/**`, `fortheking://**`
  - [x] Add `goandmake://**` to the Supabase redirect URLs (Go and Make scheme)
  - [x] Test: request reset on the live site, open the email link, set a new password
  - [x] Test the same from the app (the link should open the app)
- [ ] **Auth emails**
  - [ ] Customize Supabase confirm/reset email templates (Authentication → Email Templates)
  - [x] Custom SMTP via Resend (`mail.bespokeit.llc`)
  - [x] Sign-up with an existing email says so instead of "check your email"
- [x] **Remove dev-only text** — Settings content label, "Run npm run publish:pathway" messages
- [x] **Error states** — friendly error messages; "Couldn't load / Try again" on week + progress screens
- [x] **Dark mode** — Challenge Pool items were black on dark
- [x] **Change week** — leaders can move the huddle to any week (Progress → Leader → Change week) to undo an accidental advance
- [x] **Content review** — proofread every week of For The King (`content/`, `for_the_king_content1.md`) and Focuses
- [ ] **Accessibility pass**
  - [x] Screen-reader headings, input/checkbox/row labels, disabled states, email/password autofill
  - [x] Light-mode secondary text darkened to pass 4.5:1 contrast
  - [ ] Test with VoiceOver (iOS) and large text sizes once native builds exist
- [ ] **New-pathway offline fallback** — if a pathway not built into the app can't load on first open, show "connect to load your pathway" instead of For The King content
- [x] **iPad** — iPhone only (`supportsTablet: false` in `app.json`), so no iPad screenshots
- [x] **Export compliance** — `ios.config.usesNonExemptEncryption: false` in `app.json`, so App Store Connect doesn't ask every build
- [ ] **Sign in with Apple deletion** — revoke the Apple token when someone deletes their account (or be ready to explain if review asks)

---

## Phase 4 — Payments (Huddle Pass)

Required before shipping. Background is in "Feature — Huddle Pass" below and README → Huddle Pass.

- [ ] Stripe account verified (test mode first)
- [ ] Run `supabase/migrations/006_huddle_passes.sql` in Supabase → SQL Editor
- [ ] Supabase CLI: install, link, set secrets, deploy `create-checkout` and `stripe-webhook`
- [ ] Stripe webhook + `STRIPE_WEBHOOK_SECRET`
- [ ] Test: leader pays, starts Week 1, member pays and checks in; refund removes access; expired window (edit `started_at`); exempt huddle
- [ ] Switch to live keys and a live webhook
- [ ] **Decide how Huddle Pass goes through store review** (Apple 3.1.3(b) / Google Play billing)
  - [ ] Option A: submit as-is; review notes explain passes are bought on the website and the apps sell nothing
  - [ ] Option B: add Apple / Google in-app purchase alongside Stripe
  - [ ] Option C: turn off pass checks in the phone apps for launch

---

## Phase 5 — Apple: test builds (TestFlight)

- [x] **Bundle ID** — `com.goandmake.app` (iOS + Android), scheme `goandmake`
- [x] **EAS setup**
  - [x] `npm i -g eas-cli && eas login`
  - [x] `eas init` (replaces `replace-with-eas-project-id` in `app.json`)
  - [x] Add `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` as EAS env vars
- [ ] Create the app in App Store Connect (bundle ID `com.goandmake.app`)
- [ ] iOS push key and Sign in with Apple capability (`eas credentials`, or let `eas build` create them)
- [ ] `eas build --profile production --platform ios`
- [ ] `eas submit --platform ios` → TestFlight
- [ ] **Test on a real iPhone**
  - [ ] Sign up, create or join a huddle, check off items
  - [ ] Sign in with Apple
  - [ ] Notifications: week started, item finished, meeting reminder
  - [ ] Swap account: both accounts get notifications, and tapping one opens the right account
  - [ ] Calendar sync, date picker, share sheet
  - [ ] Photo attach and document scanner on notes
  - [ ] Home-screen icon switches to For The King
  - [ ] Read-only state for a huddle without a pass
- [ ] Invite a few huddle members as TestFlight testers (external testers need a quick beta review)
- [ ] Collect feedback via the feedback form; fix blockers

---

## Phase 6 — Apple: listing & submission

- [ ] **Marketing site** — https://goandmake.online, static site in [Werd6/Go_and_Make](https://github.com/Werd6/Go_and_Make)
  - [x] Domain `goandmake.online` (Namecheap)
  - [x] Pages: home (what Go and Make is, pathways, ministries contact), join, privacy, support, delete account
  - [x] Import the repo into Vercel and point Namecheap DNS at it (steps in that repo's README)
  - [ ] Swap the "Coming soon" badges on the join page for real App Store and Google Play links once the apps are live
  - [ ] Link to the business site eventually
- [x] **Privacy policy** — contact email filled in, "draft" removed, published as `privacy.html` on the marketing site
  - [x] Settings → Privacy policy opens https://goandmake.online/privacy (Apple 5.1.1)
- [x] **Support URL / contact email** — https://goandmake.online/support, bespoke.it.llc@gmail.com
- [ ] **Store listing** — name, subtitle, description, keywords, category (e.g. Lifestyle or Reference)
- [ ] **Screenshots** — iPhone 6.9"; For The King only while Focuses is on hold
- [ ] **App Privacy questionnaire** — email, name, journal text and photos, push tokens, purchase records
- [ ] **Age rating questionnaire** — answer yes to user-generated content (shared huddle notes)
- [ ] **Demo account** for App Review — a leader with a For The King huddle and a comp pass (`grant_comp_pass`)
- [ ] **Review notes** — demo login, how huddles work, how passes are bought (if Option A)
- [ ] Submit for review
- [ ] Respond to review feedback

---

## Phase 7 — Google Play

- [ ] **Google Play Console** ($25 one-time)
  - [ ] Personal account: needs a closed test with 12+ testers for 14 days before production
  - [ ] Organization account: needs a D-U-N-S number, skips the 12-tester rule
- [ ] Create the app (package `com.goandmake.app`)
- [ ] `eas build --profile production --platform android` (AAB)
- [ ] Upload the first AAB by hand in the Play Console (required once)
- [ ] Service account key so `eas submit --platform android` works for later releases
- [ ] Internal testing on real Android phones (same checks as iPhone, plus the icon change after the app is backgrounded)
- [ ] Closed testing track (and the 14 days, if a personal account)
- [ ] **Store listing** — short and full description, 512×512 icon, 1024×500 feature graphic, phone screenshots
- [ ] **Data safety form** — same data as Apple's App Privacy
- [x] **Account deletion URL** — https://goandmake.online/delete-account
- [ ] **Content rating** questionnaire (IARC)
- [ ] Target audience and ads declaration (no ads)
- [ ] Declare photo/camera permissions if Play flags them
- [ ] Promote to production

---

## Phase 8 — After launch

- [ ] **Crash reporting** — Sentry (`@sentry/react-native`)
- [ ] **OTA updates** — EAS Update for JS-only fixes
- [ ] **Separate environments** — staging Supabase project vs. production
- [ ] **Retire the tester web app** (https://for-the-king-test.vercel.app) once testers have moved to the store apps
  - [ ] Huddle Pass checkout lives on the web app today (`SITE_URL` in `create-checkout`, success page `/?pass=success`); give it a new home first, depending on the Phase 4 decision
  - [ ] Password-reset links: Supabase Site URL and redirect URLs, and `EXPO_PUBLIC_SITE_URL` / `lib/siteUrl.ts`, point at the web app; move them before turning it off
  - [ ] Tell testers, then remove the Vercel project
- [ ] **Automated tests** — E2E happy path: sign up → create huddle → join → check in → advance week
- [ ] **CI** — typecheck + tests on every push (GitHub Actions)
- [ ] **Journal photo storage** — watch Supabase → Storage usage; purge old photos periodically if it grows (e.g. groups that finished their pathway)
- [ ] **Analytics** (optional, privacy-respecting) — weekly active huddles, retention
- [ ] **Each content release** — new pathways go live from Supabase; their home-screen and Android notification icons ship in the next app build
- [ ] High-res (1024×1024) PC3 logo for a Focuses home-screen icon
- [x] **Push notifications** — see "Feature — Notifications" below

---

## Feature — Pathway theming

Each pathway brings its own look; the Go and Make default (Paper / Stone / Ink / Sage / Clay, Instrument Serif + DM Sans) is the fallback everywhere.

**Decisions**

- Customizable: light + dark colors, logo (light + dark), browser tab icon + title, corner roundness, spacing. Not fonts, not app name copy.
- Theme lives on the **pathway** (not the version), so branding fixes reach every huddle.
- Users keep the System / Light / Dark picker; the pathway supplies both palettes.
- Authored as a JSON file next to the content, uploaded by the publish script.
- Downloaded with the huddle's content the first time, then stored on the device so it works with no signal. Logos are embedded in the JSON as small images so they're stored with it.

**Step 1 — Theme format + default theme**

- [x] `content/theme.json` — For The King theme (parchment / charcoal / gold, from the inspiration screenshot)
- [x] `lib/pathwayTheme.ts` — merge over default, invalid values fall back, contrast check

**Step 2 — Theme system**

- [x] `ThemeContext` holds the pathway theme; `useTheme()` returns colors, radii, spacing, logo
- [x] UI components + navigation chrome use theme radii/spacing/colors
- [x] Signed out / no huddle → default theme; sign-out resets it

**Step 3 — Load + store offline**

- [x] Migration `supabase/migrations/002_pathway_theme.sql` (`theme`, `theme_version`)
- [x] Run the migration in Supabase → SQL Editor
- [x] Theme loads with pathway content and is stored on the device; bundled theme as fallback
- [x] Last theme applied on launch (no flash); re-downloads only when `theme_version` is newer

**Step 4 — Apply it**

- [x] `PathwayLogo` (crown + accent rule) on week screen, Settings, sign-in
- [x] Web: browser tab favicon, title, `theme-color` update at runtime

**Step 5 — Publishing**

- [x] Publish script validates + embeds images, bumps `theme_version` only on change; `--theme-only` flag
- [x] Run `npm run publish:pathway -- --theme-only` after the migration (theme v1 live)

**Step 6 — Home-screen app icons**

- [x] `expo-alternate-app-icons` installed; `ForTheKing` icon registered (verified with a test prebuild)
- [x] `lib/appIcon.native.ts` switches after the theme settles, skips if already correct; web no-op
- [x] Android: switch only once the app is in the background (Android closes the app when its launcher entry changes)
- Native test: Phase 5

**Follow-ups**

- [x] Tab bar icons — book / checkmark / gear (SF Symbols on iOS, Material Symbols on web + Android)
- [x] Platform default logo — crown shows on sign-in and for pathways without their own logo

---

## Feature — Focuses pathway (PC3) + weekly Study tab

Second pathway from Providence Church. Adds weekly quotes/article reading and pathway guide pages.

- [x] Formatted source: `content/pathways/pc3-focuses/source.md` → `npm run content:pc3` → `pathway.json`
- [x] Theme from the PC3 logo (black / warm paper / gold), logo + favicon
- [x] Schema: optional SOAP passages, choose-one challenges with details, challenge review, weekly `study`, pathway `resources`
- [x] Study tab (only when the week has study content) — preface, definition, quotes, article, guide pages
- [x] This Week: SOAP checklist, "Challenge Options" (choose one counts once), link to the article
- [x] Leader Guide / Challenge Pool hidden for pathways without them; back button on sub-screens
- [x] Run `supabase/migrations/003_pathway_resources.sql` in Supabase → SQL Editor
- [x] `npm run publish:pathway -- --pathway pc3-focuses`
- [x] Confirm permission from Providence Church to adapt the guide into the app
- High-res home-screen icon: Phase 8

**On hold for the phone apps (licensing).** Focuses is web app only for now: the iPhone/Android builds don't bundle its content, logo or notification icon, Create Huddle there doesn't list it, and the marketing site doesn't mention it. The web app still offers it.

- [x] Run `supabase/migrations/009_pathways_in_apps.sql` in Supabase → SQL Editor (until it's run, the apps fall back to their bundled list, which is For The King only)
- [ ] Once licensing is settled, bring it back:
  - Supabase: `update public.pathways set in_apps = true where id = 'pc3-focuses';` (Create Huddle in the apps lists it right away)
  - Move the PC3 entries from `lib/webOnlyContent.web.ts` back into `BUNDLED_PATHWAYS` (`lib/content.ts`) and `BUNDLED_THEMES` / `BUNDLED_THEME_ASSETS` (`lib/themeAssets.ts`) for offline use, and add `"pc3-focuses": "./assets/images/notification-icon-pc3.png"` back to the `withPathwayNotificationIcons` plugin in `app.json` (needs a new build)
  - Marketing site: restore the Focuses card and `assets/focuses-logo.png` (`git revert` the commit that removed them in Werd6/Go_and_Make)

---

## Feature — On-platform journaling

Typed notes and journal photos/scans on journaling and SOAP items, with leader settings.

- [x] `requiresNote` tag on items (auto for journaling / SOAP, `[note]` marker for others); both pathways regenerated
- [x] Migration `supabase/migrations/004_journaling.sql` — huddle `settings`, `journal_notes`, `journal_photos`, RLS, private `journal` bucket, check-off rule
- [x] Notes sheet on This Week (text, photos, scanner in native builds) with the privacy notice
- [x] Leader settings: notes Optional / Required (default Optional), Private / Shared with huddle (default Private)
- [x] Shared notes viewable from Progress (this week and past weeks)
- [x] Photo cleanup on account deletion and huddle dissolve
- [x] Run `supabase/migrations/004_journaling.sql` in Supabase → SQL Editor
- [x] Republish both pathways into their current version so pinned huddles get the tags:
  `npm run publish:pathway -- --version 1` and `npm run publish:pathway -- --pathway pc3-focuses --version 1`
- Scanner test: Phase 5 · App Privacy / Data Safety: Phases 6 and 7

---

## Feature — Notifications

- [x] Week started, item finished (opens their progress), and meeting reminder 24 hours before
- [x] Migration `supabase/migrations/005_push_notifications.sql` — push tokens, triggers, Expo push via `pg_net`
- [x] Branded per pathway: content from the huddle's pinned version, Android icon per pathway, reminder tinted with the pathway accent
- [x] Run `supabase/migrations/005_push_notifications.sql` in Supabase → SQL Editor
- [x] Firebase project + `google-services.json` + FCM V1 key via `eas credentials` (Android push; redo for `com.goandmake.app`, see rebrand)
- [x] Rebuild the Android app and test all three notifications
- [x] Settings → Swap account: stay signed in to several accounts and switch between them
- [x] Migration `supabase/migrations/007_multi_account_notifications.sql` — one device token can belong to several accounts; pushes say which account and huddle they're for
- [x] Run `supabase/migrations/007_multi_account_notifications.sql` in Supabase → SQL Editor
- [x] Run `supabase/migrations/008_neutral_defaults.sql` in Supabase → SQL Editor ("Member" / "Someone" instead of "Brother" / "A brother" when there's no display name)
- Two-account phone test: Phase 5 · Push tokens in App Privacy / Data Safety: Phases 6 and 7

---

## Feature — Go and Make rebrand

Go and Make is the platform; For The King is the first content pathway.

- [x] Name, scheme `goandmake`, IDs `com.goandmake.app`; winding-road icon, splash, favicon and notification icon
- [x] Default theme: Paper `#F7F5F0`, Stone `#E6E2D9`, Ink `#292C29`, Sage `#607666`, Clay `#AE7757`
- [x] Fonts: Instrument Serif (titles, Scripture quotes), DM Sans (interface)
- [x] Firebase: add Android app `com.goandmake.app`, update the EAS file variable `GOOGLE_SERVICES_JSON`
- [x] FCM V1 key for `com.goandmake.app` via `eas credentials`
- [x] Supabase redirect URL `goandmake://**`
- [x] New EAS build; uninstall the old For The King app (different package)

---

## Feature — Huddle Pass (payments)

Leader $1/week, member 50¢/week, access ceil(weeks x 1.2) weeks from Start Week 1. Website checkout only. See README → Huddle Pass.

- [x] Migration `supabase/migrations/006_huddle_passes.sql` — passes, access rule, read-only enforcement, existing huddles free
- [x] Edge Functions `create-checkout` and `stripe-webhook`
- [x] Huddle Pass card (web checkout, neutral message in the apps, Start Week 1, expired), read-only UI, "Pass pending" in Progress
- Setup, testing, going live and the store-review decision: Phase 4

---

## Notes

- Never commit `.env` / `.env.publish`; never put the service role key in Vercel or any `EXPO_PUBLIC_*` var.
- Stripe secret keys and the webhook secret go only in Supabase function secrets.
- `EXPO_PUBLIC_*` vars are baked in at build time — redeploy after changing them.
- Run `eas` / `expo` commands from `~/dev/For_The_King`, not the Desktop copy.
- Feedback form: https://forms.gle/NGM9MmfJ2y9hmstp6
