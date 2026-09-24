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
```

## Content

Curriculum lives in `for_the_king_content1.md`. Regenerate JSON with `npm run content`.

## Flows

- **Out of huddle:** Join (invite code) or Create (pathway + optional meeting time/location).
- **In huddle:** This Week, Progress (accountability), Settings.
- **Leader:** advance week, Leader Materials / Guide / pool, dissolve, meeting time & location.
- **Calendar sync:** native iOS/Android only (not in the browser).

## Store checklist

- [ ] EAS project id in `app.json` / `eas.json`
- [ ] Sign in with Apple (optional for this prototype; email auth is enough for web feedback)
- [ ] Account deletion (Settings; Edge Function for remote auth user delete)
- [ ] Privacy policy URL
- [ ] Replace placeholder icon / splash

```bash
npx eas build --platform all --profile preview
```
