# Go and Make

A discipleship huddle platform (Expo + React Native / web) that gives huddles access to content pathways. For The King is the first pathway; Focuses (PC3) is the second (web app only for now; see below). Each pathway can bring its own theme; the Go and Make default is Paper, Stone, Ink, Sage and Clay with Instrument Serif and DM Sans, in light and dark mode.

## Quick start

```bash
cd ~/dev/For_The_King   # use this copy (not iCloud Desktop)
npm install
cp .env.example .env    # fill Supabase anon URL + key
npm run web
```

Without Supabase env vars the app runs in **local prototype mode** (AsyncStorage). Multi-device sync needs Supabase.

## Marketing site

The public site at https://goandmake.online (home, join, privacy, support, delete account) is a separate static site in [Werd6/Go_and_Make](https://github.com/Werd6/Go_and_Make). Its `privacy.html` is the published copy of [`PRIVACY.md`](PRIVACY.md); change both together. Settings → Privacy policy links to it.

## Deploy web (Vercel)

The web app is for testers only and will be retired once the store apps are live (see TODO → Phase 8).

1. Push **this folder** as its own GitHub repo (a local `git` repo was initialized here — do **not** push from your home directory).
2. In Vercel, set env vars (must be present at **build** time):
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
3. Build uses [`vercel.json`](vercel.json) → `npx expo export --platform web` → `dist/`.
4. In Supabase → Authentication → URL Configuration, add your Vercel URL to **Site URL** and **Redirect URLs**.

Never put `SUPABASE_SERVICE_ROLE_KEY` in Vercel or any `EXPO_PUBLIC_*` var.

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Run [`supabase/schema.sql`](supabase/schema.sql) in the SQL editor.
3. Copy `.env.example` → `.env` and set:
   - `EXPO_PUBLIC_SUPABASE_URL`
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
4. Put the **service_role** key only in `.env.publish` (gitignored):
   - `SUPABASE_SERVICE_ROLE_KEY=…`
5. Enable Email auth. For store builds, enable Apple Sign In if desired.

### Publish curriculum to the cloud

```bash
npm run content          # optional: regenerate JSON from the markdown
npm run publish:pathway  # needs .env + .env.publish
npm run publish:pathway -- --pathway pc3-focuses  # another pathway
```

## Content

Curriculum lives in `for_the_king_content1.md`. Regenerate JSON with `npm run content`.

Other pathways live in `content/pathways/<id>/` (`pathway.json`, `theme.json`, `assets/`, optional `leader-guide.json` / `challenge-pool.json`). Focuses (PC3) is authored in `content/pathways/pc3-focuses/source.md`; regenerate with `npm run content:pc3`. Register new pathways in `BUNDLED_PATHWAYS` (`lib/content.ts`) and `BUNDLED_THEMES` (`lib/themeAssets.ts`).

**Web-only pathways.** Pathways in `lib/webOnlyContent.web.ts` are bundled into the web app only; the iPhone/Android builds use the empty `lib/webOnlyContent.ts`. In Supabase, `pathways.in_apps = false` keeps a published pathway out of Create Huddle in the phone apps while the web app still lists it (`supabase/migrations/009_pathways_in_apps.sql`). Focuses is set up this way while its licensing is settled; TODO.md has the steps to bring it back.

Weeks with `study` content (quotes, article) and pathways with `resources` (guide pages) get a **Study** tab. Guide pages need `supabase/migrations/003_pathway_resources.sql`.

Items that take journal notes have `requiresNote: true`. The converters tag For The King journaling items and Focuses SOAP passages automatically; tag any other item by ending its line in the markdown with `[note]`.

Daily items get one check box per day (Day 1…N), and each day counts as 1/N of the item in Progress. The converters set N from the wording ("each day" / "every day" → 7, "at least 4 days", "at least 5 nights", "for 7 days"); override with a trailing `[days N]` (or `[days 0]` to turn it off). After changing tags on a pathway that huddles already use, republish into the same version (item ids don't change), e.g. `npm run publish:pathway -- --version 1`.

## Journal notes

Members can attach typed notes and photos (or scans, in native builds) to tagged items. Leaders control two huddle settings in Settings → Journal notes:

- **Optional / Required** (default Optional). When required, tagged items can't be checked off without 10+ non-space characters or a photo. The database enforces this too.
- **Private / Shared with huddle** (default Private). Each note keeps the setting from when it was last saved. Shared notes can be read from the Progress tab.

Needs `supabase/migrations/004_journaling.sql` (tables, row-level security, the private `journal` storage bucket, and the check-off rule). Until it's run, the app works as before without notes.

## Pathway theme

Each pathway's look lives in `content/theme.json` (light + dark colors, corner radii, spacing scale, fonts, logos, browser tab icon/title, home-screen icon key). Image files go in `content/assets/`.

- The huddle's pathway theme applies after sign-in; signed out uses the Go and Make default (`lib/theme.ts`).
- `"fonts"`: `"system"` (the default for pathways, so existing themes keep their look) or `"go-and-make"` (Instrument Serif titles and quotes, DM Sans interface). Components read `fonts` and `typography` from `useTheme()`.
- Themes are stored on the device with the content, so they work offline.
- `npm run publish:pathway -- --theme-only` publishes just the theme (validates colors/contrast, embeds images, bumps `theme_version`). Requires `supabase/migrations/002_pathway_theme.sql`.
- Home-screen icons: add a 1024×1024 icon + Android foreground to `assets/images/`, register it in the `expo-alternate-app-icons` plugin in `app.json`, add its name to `BUNDLED_ICONS` in `lib/appIcon.native.ts`, and set `iconKey` in the theme. Takes effect in the next native build. On Android the icon changes once the user leaves the app, because Android closes an app whose launcher icon is switched while it's open.
- Android notification icons: add a 96×96 white-on-transparent PNG to `assets/images/` and list it under the pathway id in the `./plugins/withPathwayNotificationIcons` entry in `app.json`. Takes effect in the next native build; until then that pathway's pushes use the default Go and Make icon.

## Notifications

Native builds only (not the browser). Members get:

- **Huddle has started the next week** when the leader advances the week (or jumps ahead with Change week; going back doesn't notify).
- **{name} has done 3 of 7 days of “{item}”. Send encouragement!** each time someone checks off another day of a multi-day item. Tapping it opens their progress.
- **{name} has finished “{item}”! Send encouragement!** when someone fully checks off any item (the last day, for multi-day items). Tapping it opens their progress.
- **Huddle is tomorrow at {time}**, 24 hours before the weekly meeting. Scheduled on the device, so it works without Firebase.

Someone signed in to several accounts (Settings → Swap account, e.g. a leader who is also a member of another huddle) gets notifications for all of them. Tapping one switches to the account it was sent to. Each account keeps its own meeting reminder, and signing out of one account stops only that account's notifications. Saved sign-ins are kept in the device keychain/keystore (`lib/authStorage.ts`); on the web they stay in the browser.

The first two are sent from the database through Expo's push service and use the huddle's pathway: week titles and item text come from its pinned content, and on Android the icon comes from its pathway. The reminder uses the pathway's icon and accent color. expo-notifications only applies a per-notification icon while the app is open because of `patches/expo-notifications+57.0.24.patch` (applied by `patch-package` on install); when upgrading expo-notifications, regenerate it with `npx patch-package expo-notifications` or drop it.

Setup:

1. Run `supabase/migrations/005_push_notifications.sql`, then `007_multi_account_notifications.sql`, `008_neutral_defaults.sql` and `013_day_progress_notifications.sql`, in Supabase → SQL Editor.
2. Android push needs Firebase: create a Firebase project, add an Android app with package `com.goandmake.app`, and put its `google-services.json` in the project root (gitignored; [`app.config.js`](app.config.js) picks it up). EAS builds read it from the secret file variable `GOOGLE_SERVICES_JSON` instead. Then upload an FCM V1 service account key with `eas credentials` → Android → Push Notifications.
3. iOS push needs an Apple push key, which `eas build` offers to create.
4. Rebuild the native app.

## Paid app

Go and Make is a **$4.99 paid app** on the App Store and Google Play. Buying the app gives full access to every huddle someone leads or joins, with nothing else to buy. Apple and Google handle the purchase, so the apps have no prices, purchase links or Stripe code. The tester web app is free until it's retired (TODO Phase 8).

Earlier builds sold per-huddle **Huddle Passes** through Stripe ([`006_huddle_passes.sql`](supabase/migrations/006_huddle_passes.sql)). That's switched off by [`011_paid_app.sql`](supabase/migrations/011_paid_app.sql): every huddle, existing and new, is free (`billing_exempt`), so `huddle_access()` returns `exempt` for every member. The pass tables, functions and the `pathways.*_pass_link` columns are still in the database, unused; the Stripe webhook is in git history (removed after commit `fea785c`). To bring passes back, see the header of migration 011.

## Moderation

Shared notes are user-generated content, so App Store guideline 1.2 requires reporting, blocking and a timely response. Needs [`012_moderation.sql`](supabase/migrations/012_moderation.sql).

- **Report:** the note viewer (Progress → View notes) has **Report this note** with a reason (offensive or abusive, spam, something else) and optional details. Reports go to `note_reports` with a copy of the note's text and photo paths; only the dashboard / SQL editor can read them.
- **Block:** **Block {name}** in the note viewer hides that person's shared notes and photos from you (enforced by row-level security). They aren't told. Unblock in Settings → Blocked.
- **Remove a member:** leaders use Settings → Members → Remove. It deletes the member's notes, photos and checkmarks in the huddle, and they can't rejoin with the invite code.

Check open reports at least daily (we promise review within 24 hours), in Supabase → SQL Editor:

```sql
-- Open reports, newest first
select r.created_at, r.reason, r.details, r.note_body, r.photo_paths,
       author.display_name as author, reporter.display_name as reporter, h.name as huddle, r.id, r.note_id, r.author_id
from public.note_reports r
left join public.profiles author on author.id = r.author_id
left join public.profiles reporter on reporter.id = r.reporter_id
left join public.huddles h on h.id = r.huddle_id
where r.resolved_at is null
order by r.created_at desc;

-- Remove the note (its photos' files stay in Storage → journal; delete them there by path)
delete from public.journal_notes where id = '<note_id>';

-- Close the report
update public.note_reports set resolved_at = now(), resolution = 'removed note' where id = '<report id>';
```

For serious or repeated abuse, delete the author's account in Supabase → Authentication → Users.

## Flows

- **Out of huddle:** Join (invite code) or Create (pathway + optional meeting time/location).
- **In huddle:** This Week, Study (when the pathway has it), Progress (accountability), Settings.
- **Leader:** advance week, change to any week (Progress → Leader → Change week, e.g. to undo an accidental advance), view any past week's progress, Leader Materials / Guide / pool, journaling settings, remove a member, dissolve, meeting time & location.
- **Calendar sync:** native iOS/Android only (not in the browser).
- **Notifications:** native iOS/Android only; see Notifications above.

## Store checklist

- [ ] EAS project id in `app.json` / `eas.json`
- [ ] Sign in with Apple (optional for this prototype; email auth is enough for web feedback)
- [ ] Account deletion (Settings; Edge Function for remote auth user delete)
- [ ] Privacy policy URL
- [ ] Replace placeholder icon / splash

```bash
npx eas build --platform all --profile preview
```
