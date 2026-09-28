# For The King — Launch To-Do

Work top to bottom. Each phase should be done before the next unless noted.

---

## Phase 1 — Security & compliance (before wider sharing)

SQL: `supabase/migrations/001_phase1_security.sql` · App code: `lib/api.ts` (already updated)

- [ ] **Run the migration** in Supabase → SQL Editor, then push the app code right after
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
- [ ] **Android adaptive icon** — replace foreground/background/monochrome PNGs; set `android.adaptiveIcon.backgroundColor` to a palette color
- [ ] **Splash screen** — replace `splash-icon.png`; set splash `backgroundColor` in `app.json` (currently `#ffffff`)
- [ ] **Favicon** for web
- [ ] **Forgot password** flow on sign-in (`supabase.auth.resetPasswordForEmail` + reset screen)
- [ ] **Auth emails**
  - [ ] Customize Supabase confirm/reset email templates
  - [ ] Set up custom SMTP (Resend, Postmark, etc.) — built-in sender is rate-limited
- [ ] **Remove dev-only text** — "Local mode / Cloud content / Bundled content" label in Settings
- [ ] **Error & empty states** — offline message, failed-load retry, no-huddle state
- [ ] **Content review** — proofread every week in `content/` and `for_the_king_content1.md`
- [ ] **Accessibility pass** — labels on buttons/checkboxes, text scaling, contrast in both themes

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

## Notes

- Never commit `.env` / `.env.publish`; never put the service role key in Vercel or any `EXPO_PUBLIC_*` var.
- `EXPO_PUBLIC_*` vars are baked in at build time — redeploy after changing them.
- Feedback form: https://forms.gle/NGM9MmfJ2y9hmstp6
