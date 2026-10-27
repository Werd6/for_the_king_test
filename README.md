# For The King

Men’s discipleship huddle companion (Expo + React Native / web). Mint–forest theme with light/dark mode.

## Quick start

```bash
cd ~/dev/For_The_King   # use this copy (not iCloud Desktop)
npm install
cp .env.example .env    # fill Supabase anon URL + key
npm run web
```

Without Supabase env vars the app runs in **local prototype mode** (AsyncStorage). Multi-device sync needs Supabase.

## Deploy web (Vercel)

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

Weeks with `study` content (quotes, article) and pathways with `resources` (guide pages) get a **Study** tab. Guide pages need `supabase/migrations/003_pathway_resources.sql`.

Items that take journal notes have `requiresNote: true`. The converters tag For The King journaling items and Focuses SOAP passages automatically; tag any other item by ending its line in the markdown with `[note]`.

Daily items get one check box per day (Day 1…N), and each day counts as 1/N of the item in Progress. The converters set N from the wording ("each day" / "every day" → 7, "at least 4 days", "at least 5 nights", "for 7 days"); override with a trailing `[days N]` (or `[days 0]` to turn it off). After changing tags on a pathway that huddles already use, republish into the same version (item ids don't change), e.g. `npm run publish:pathway -- --version 1`.

## Journal notes

Members can attach typed notes and photos (or scans, in native builds) to tagged items. Leaders control two huddle settings in Settings → Journal notes:

- **Optional / Required** (default Optional). When required, tagged items can't be checked off without 10+ non-space characters or a photo. The database enforces this too.
- **Private / Shared with huddle** (default Private). Each note keeps the setting from when it was last saved. Shared notes can be read from the Progress tab.

Needs `supabase/migrations/004_journaling.sql` (tables, row-level security, the private `journal` storage bucket, and the check-off rule). Until it's run, the app works as before without notes.

## Pathway theme

Each pathway's look lives in `content/theme.json` (light + dark colors, corner radii, spacing scale, logos, browser tab icon/title, home-screen icon key). Image files go in `content/assets/`.

- The huddle's pathway theme applies after sign-in; signed out uses the platform default (`lib/theme.ts`).
- Themes are stored on the device with the content, so they work offline.
- `npm run publish:pathway -- --theme-only` publishes just the theme (validates colors/contrast, embeds images, bumps `theme_version`). Requires `supabase/migrations/002_pathway_theme.sql`.
- Home-screen icons: add a 1024×1024 icon + Android foreground to `assets/images/`, register it in the `expo-alternate-app-icons` plugin in `app.json`, add its name to `BUNDLED_ICONS` in `lib/appIcon.native.ts`, and set `iconKey` in the theme. Takes effect in the next native build.
- Android notification icons: add a 96×96 white-on-transparent PNG to `assets/images/` and list it under the pathway id in the `./plugins/withPathwayNotificationIcons` entry in `app.json`. Takes effect in the next native build; until then that pathway's pushes use the default (crown) icon.

## Notifications

Native builds only (not the browser). Members get:

- **Huddle has started the next week** when the leader advances the week.
- **{name} has finished “{item}”! Send encouragement!** when someone fully checks off any item (every day, for daily items). Tapping it opens his progress.
- **Huddle is tomorrow at {time}**, 24 hours before the weekly meeting. Scheduled on the device, so it works without Firebase.

The first two are sent from the database through Expo's push service and use the huddle's pathway: week titles and item text come from its pinned content, and on Android the icon comes from its pathway. The reminder is tinted with the pathway's accent color.

Setup:

1. Run `supabase/migrations/005_push_notifications.sql` in Supabase → SQL Editor.
2. Android push needs Firebase: create a Firebase project, add an Android app with package `com.fortheking.app`, put its `google-services.json` in the project root, set `"googleServicesFile": "./google-services.json"` under `android` in `app.json`, and upload an FCM V1 service account key with `eas credentials` → Android → Push Notifications.
3. iOS push needs an Apple push key, which `eas build` offers to create.
4. Rebuild the native app.

## Flows

- **Out of huddle:** Join (invite code) or Create (pathway + optional meeting time/location).
- **In huddle:** This Week, Study (when the pathway has it), Progress (accountability), Settings.
- **Leader:** advance week, view any past week's progress, Leader Materials / Guide / pool, journaling settings, dissolve, meeting time & location.
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
