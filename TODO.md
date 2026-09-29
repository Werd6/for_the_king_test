# For The King — Launch To-Do

Work top to bottom. Each phase should be done before the next unless noted.

---

## Phase 1 — Security & compliance (before wider sharing)

SQL: `supabase/migrations/001_phase1_security.sql` · App code: `lib/api.ts` (already updated)

- [x] **Run the migration** in Supabase → SQL Editor, then push the app code right after
- [ ] **Lock down huddle reads**
  - [x] `join_huddle_by_code(code)` function joins server-side
  - [x] Removed `huddles_select_by_invite_for_join` policy
  - [x] `memberships_insert_self` limited to a leader joining their own new huddle
  - [x] `joinHuddleByCode` calls the RPC
  - [ ] Verify: Account B (not in a huddle) can't see Account A's huddle, but can join with the code
- [ ] **Real account deletion**
  - [x] `delete_my_account()` function deletes led huddles, then the auth user (cascades profile, membership, progress)
  - [x] `deleteAccount` calls the RPC
  - [ ] Verify: the user disappears from Supabase → Authentication → Users
- [ ] **RLS audit**
  - [x] Leaders can't rewrite `leader_id`; checkmark upserts have an update policy; picks stay attributed to the leader
  - [ ] Verify with two accounts in different huddles: neither sees the other's members, progress, or huddle

---

## Phase 2 — Polish & branding

- [ ] **App icon** — replace `assets/images/icon.png` (1024×1024, no transparency)
- [ ] **Android adaptive icon** — replace foreground/background/monochrome PNGs
  - [x] Background color set to palette `#DEE5E5`
- [ ] **Splash screen** — replace `splash-icon.png`
  - [x] Background `#DEE5E5` light / `#082D0F` dark
- [ ] **Favicon** for web — replace `assets/images/favicon.png` (48×48)
- [ ] **Forgot password**
  - [x] "Forgot password?" link on sign-in + `/reset-password` screen
  - [x] Recovery links that land on `/` are routed to `/reset-password`; email links always use the public site URL on web
  - [ ] Supabase → Authentication → URL Configuration: Site URL `https://for-the-king-test.vercel.app`; Redirect URLs `https://for-the-king-test.vercel.app/**`, `http://localhost:8081/**`, `fortheking://**`
  - [ ] Test: request reset on the live site, open the email link, set a new password
- [ ] **Auth emails**
  - [ ] Customize Supabase confirm/reset email templates (Authentication → Email Templates)
  - [x] Custom SMTP via Resend (`mail.bespokeit.llc`)
  - [x] Sign-up with an existing email says so instead of "check your email"
- [x] **Remove dev-only text** — Settings content label, "Run npm run publish:pathway" messages
- [x] **Error states** — friendly error messages; "Couldn't load / Try again" on week + progress screens
- [ ] **Content review** — proofread every week in `content/` and `for_the_king_content1.md`
- [ ] **Accessibility pass**
  - [x] Screen-reader headings, input/checkbox/row labels, disabled states, email/password autofill
  - [x] Light-mode secondary text darkened to pass 4.5:1 contrast
  - [ ] Test with VoiceOver (iOS) and large text sizes once native builds exist

---

## Phase 3 — Native builds & beta

- [ ] **Accounts**
  - [ ] Apple Developer Program ($99/yr)
  - [ ] Google Play Console ($25 one-time)
- [ ] **Bundle ID** — decide final ID (e.g. `com.yourname.fortheking`) and update `app.json` iOS + Android
- [ ] **EAS setup**
  - [ ] `npm i -g eas-cli && eas login`
  - [ ] `eas init` (replaces `replace-with-eas-project-id` in `app.json`)
  - [ ] Add `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` as EAS env vars
- [ ] **Preview build** — `eas build --profile preview --platform ios` (and android)
- [ ] **Test native-only features** — Apple sign-in, calendar sync, date picker, share sheet
- [ ] **Beta**
  - [ ] TestFlight (iOS)
  - [ ] Play Internal Testing (Android)
  - [ ] Collect feedback via the feedback form; fix blockers

---

## Phase 4 — Store submission

- [ ] **Privacy policy** — host `PRIVACY.md` at a public URL (e.g. a page on the Vercel site)
- [ ] **Support URL / contact email**
- [ ] **Store listing** — name, subtitle, description, keywords, category
- [ ] **Screenshots** — required iPhone sizes + Android phone
- [ ] **Age rating questionnaire**
- [ ] **App Privacy / Data Safety forms** (email, name, usage data)
- [ ] **Demo account** for Apple reviewers (put credentials in review notes)
- [ ] `eas build --profile production` → `eas submit`
- [ ] Respond to review feedback

---

## Phase 5 — Professional polish (post-launch OK)

- [ ] **Crash reporting** — Sentry (`@sentry/react-native`)
- [ ] **OTA updates** — EAS Update for JS-only fixes
- [ ] **Separate environments** — staging Supabase project vs. production
- [ ] **Custom domain** on Vercel for the web version
- [ ] **Automated tests** — E2E happy path: sign up → create huddle → join → check in → advance week
- [ ] **CI** — typecheck + tests on every push (GitHub Actions)
- [ ] **Analytics** (optional, privacy-respecting) — weekly active huddles, retention
- [ ] **Push notifications** (optional) — meeting reminders, weekly check-in nudges

---

## Feature — Pathway theming

Each pathway brings its own look; the platform default ("For The King") is the fallback everywhere.

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
- [ ] Test on a native build (Phase 3) — Expo Go can't switch icons

**Follow-ups**
- [x] Tab bar icons — book / checkmark / gear (SF Symbols on iOS, Material Symbols on web + Android)
- [x] Platform default logo — crown shows on sign-in and for pathways without their own logo


---

## Notes

- Never commit `.env` / `.env.publish`; never put the service role key in Vercel or any `EXPO_PUBLIC_*` var.
- `EXPO_PUBLIC_*` vars are baked in at build time — redeploy after changing them.
- Feedback form: https://forms.gle/NGM9MmfJ2y9hmstp6
