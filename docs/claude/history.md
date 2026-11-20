# History, hosting, gotchas, hosted migrations

Purpose: the original scope wording, full tech stack and Cloudflare/Discord hosting setup, the full Gotchas list, the completed-work log and the long list of migrations the hosted database needs. Read when deploying, debugging infrastructure or checking what was built when.

## Scope (original wording)

A website for one big LANCER (tabletop RPG) campaign and roleplay, run on a Discord server with a few GMs and many players. It tracks characters. It is not a VTT (no game board).
- **Players** create and manage their LANCER character.
- Player edits don't go live straight away. They become **pending changes**.
- **GMs** see characters and pending changes, can edit characters, and approve or reject changes. GMs can also have characters of their own.
- The campaign uses a **homebrew** version of LANCER: official content plus custom content the GMs add.
- **Scope (decided by the developer, 2026-10-29): character management only.** Pilots and their content: a clean submission → approval and change → approval pipeline, easy manna spending for players, easy levelling for GMs, and the game content pilots need (LCP import and editors, owners only). Visually clear and simple over stylised. **Reputation came back into scope on 2026-11-19** as a GM-only tracker (below). (Browsing game content came back into scope on 2026-10-31 as the **archives** tab, below. **Lore** came back on 2026-11-16: GM-written entries, built as option A, a list + reading pane like the archives, chosen from the mockups in `docs/redesign/lore/`. Drafts are GM-only; published entries are visible to every logged-in user.) Reputation is behind the scenes: players never see or read it.

## How the pieces fit (original)

- The browser (Vue app hosted on Cloudflare) talks to Supabase. There's nothing in between.
- Security is enforced **in the database** with Row Level Security (RLS), never only in the frontend code, because anyone can tamper with code running in their browser.
- The one exception to "no backend": small **database functions inside Supabase** (written in SQL) for actions that must happen all-or-nothing, such as approving a change. Vue calls them with `supabase.rpc()`. They're not a server, and there should only be one or two.

## Tech stack (full)

- **Frontend:** Vue + Vite (I already know Vue), with **TypeScript**.
- **Database, logins and security rules:** Supabase (free tier).
- **Hosting:** Cloudflare (decided by the developer, 2026-11-16). **Cloudflare builds and deploys from the GitHub repo on every push**, so pushing is going live: ask before pushing.
  - **Set up as a Cloudflare Worker serving static files** (Workers & Pages → Create → Import a repository). `wrangler.jsonc` serves `dist/` and sends unknown paths to `index.html` (`not_found_handling: "single-page-application"`); `.node-version` pins Node 24 for the build (Vite 8 needs 20.19+).
  - **Build settings in the dashboard:** build command `npm run build`, deploy command `npx wrangler deploy` (the default).
  - **Build variables:** `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` must be set under the Worker's Settings → Build → Variables and secrets (build-time, not runtime: Vite bakes them into the files). Never the secret key.
  - **Discord login:** the login sends people back to the page's own address (`redirectTo: window.location.origin`), so add the Cloudflare address (`https://lancer-site.<account>.workers.dev`, and any custom domain) to Supabase → Authentication → URL Configuration (Site URL and Redirect URLs). Otherwise login returns to the old address or fails.
  - After the first deploy: refresh a deep link like `/registry` (should not 404) and log in once.
  - **The site's domain is `hor-os.party`** (the developer, 2026-11-17), attached to the Worker as a custom domain (Settings → Domains & Routes). Supabase's Site URL is `https://hor-os.party`, and its Redirect URLs list `https://hor-os.party` and `https://hor-os.party/**` (plus localhost for local testing).
- **No custom backend API.** The Vue app talks straight to Supabase using `supabase-js`. Keep it simple.

## Gotchas (full)

- **Vite environment variables:** only variables starting with `VITE_` reach the browser, and those are public. Only the public Supabase key goes in a `VITE_` variable. Keep `.env` files out of git.
- **Hosting + Vue Router:** with clean URLs like `/characters/42`, refreshing the page can show a 404 unless the host sends every unknown path to `index.html`. That's `not_found_handling` in `wrangler.jsonc`.
- **Supabase free tier pauses projects after 1 week of inactivity.** No data is lost, and you restore it from the dashboard. Expect this during campaign breaks. Limits: 2 active free projects and a 500 MB database, which is plenty for this.
  - **Keep-alive** (`.github/workflows/keep-alive.yml`): every 3 days (and by hand from the Actions tab) a GitHub Action reads one row of `content_items` through the REST API with the publishable key, so the project never idles for a week. A permission-denied answer counts (it still comes from a running Postgres); a 5xx or no answer fails the job. It needs two repository **variables** (Settings → Secrets and variables → Actions → Variables): `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. GitHub switches scheduled workflows off after 60 days without repo activity.
- **Supabase returns at most 1,000 rows per request** (`max_rows` in `supabase/config.toml`), silently cutting longer lists. Any list that can grow (game content, packs) is read with `fetchAll()` in `src/lib/supabaseClient.ts`: it pages with `.range()` (the query must `.order()` by something unique) and returns all the rows or an error, never a partial list (tested in `supabaseClient.test.ts`).
- **Game content is read once per browser session** (`src/catalogue.ts`): `loadKind(kind)` gives every `content_items` row of one kind through `fetchAll()`, and `cached(key, load)` keeps the promise, so `useGameData()`, `useMechData()`, `useManufacturers()` and the tag names share one fetch each across pages (bionics and pilot stats too). A failed read is not kept, so the next page that asks retries. `invalidateCatalogues()` (`gameData.ts`) clears the cache after an owner imports or updates a pack (`ContentView.vue`), so new content shows without a reload. A failure sets `catalogueError`; the pilot sheet, mech page, archives and GM change page each show it once as `<CatalogueNotice />` ("Game content didn't load: …", a `.notice.warn`), so an empty picker is never silent. New catalogue reads go through `cached()`/`loadKind()`, not straight to Supabase.
- **Pages load on demand** (`src/router.ts`): every route is `component: () => import('./views/X.vue')` except the login view, which stays eager for first paint. Keep new routes lazy.
- **Don't charge players or add ads.**
- **New tables may not be reachable from the app automatically.** Depending on the project's Data API settings, each new table needs an explicit `grant` to the `authenticated` role, on top of RLS. Every migration that creates a table should enable RLS and grant only what's needed.

## Current status and next step

- Vite + Vue + TypeScript app.
- Supabase is set up in the repo: the client is in `src/lib/supabaseClient.ts`, the CLI config is in `supabase/`, and real keys go in `.env.local` (see `.env.example`). The hosted project is linked through Supabase's GitHub integration (working directory `.`).
- **The database is built** in `supabase/migrations/20261028052810_initial_schema.sql`, following `docs/database-sketch.md`. It hasn't been pushed to the hosted project yet.
- `supabase test db` runs `supabase/tests/security.test.sql`. It tries to break every rule as a player, GM, owner and logged-out visitor. All 51 checks pass locally.
- **Local Supabase uses ports 553xx**, not the default 543xx, because another local Supabase project on this machine already uses the defaults. Studio is at http://127.0.0.1:55323.
- **Discord login is built.**
  - `src/auth.ts` holds the session and the logged-in user's profile.
  - `src/router.ts` sends anyone who isn't logged in to `/login`.
  - The pages are in `src/views/`, and `wrangler.jsonc` sends clean URLs to `index.html`.
  - Checked up to Discord's login page. A real login hasn't been tested yet.
- A real Discord login works: the hosted database has the first profile.
- TypeScript types are generated into `src/lib/database.types.ts`. Run `npm run types` after any database change.
- The HOR_OS base look is built (see "Look and feel").
- Tay's hosted profile is set to `owner` for testing.
  - **Local test data:** `supabase/seed.sql` also loads LANCER's core pilot gear (from `lancer-data`) and four made-up bionics, and `supabase/seeds/lancer-core.sql` loads lancer-data's core frames, mech weapons, systems, tags, talents and core bonuses (generated from `lib/*.json`, unchanged; `config.toml` runs `./seeds/*.sql` after `seed.sql`), so the pickers work locally. The hosted database starts without game content; owners can now load it through the LCP importer.
  - **Database:** migration `20261028085652_rich_text_paragraphs.sql` changes appearance, personality and traits to `jsonb`. **The hosted database needs this migration, `20261028183456_mod_limit_default.sql` and `20261029022434_level_and_manna.sql` (push `main`) before my pilot works there, and `20261116225551_approval_hardening.sql` before the GM approve and reject buttons work there (they call its new functions), `20261117180750_image_uploads.sql` before image uploads work there (it makes the bucket public and swaps its policies; run it before pushing the site), and `20261117173030_remove_pack.sql` before the content page loads and its Remove button works there (the page calls `pack_usage`; Supabase's GitHub integration applies it on push), and `20261119120000_pilot_submission.sql` before the site is pushed (it adds `characters.submitted_at`, which the pilot pages, the GM queue and the Pending tab read; plus `send_back_pilot` and the locks on a submitted pilot), `20261119130000_send_back_changes.sql` before the GM's `Send back change` button is used (it makes `reject_change` return the proposal to the player as a draft and backfills drafts for earlier rejections; without it a rejection still loses the player's draft view), and `20261119140000_exotic_tag.sql` (a no-op on data that already has the tag; it keeps the Exotic Gear rule true for existing Exotic items), and `20261119160000_rewards_and_experience.sql` before the roster and GM controls work (they read `pilot_progress` and `pilot_reward_log` and call `award` and `level_up`), and `20261120100000_timeline_milestones.sql` for the automatic service-record entries (it needs the profile migration first), and `20261120090000_pilot_profile.sql` before the site is pushed (the registry list embeds `pilot_profiles`; also the profile customisation and the wave 2 tables), and `20261117201816_content_editor.sql` before the site is pushed (it adds `content_items.edited`, `draft` and `updated_at`, which `loadKind()` reads, so **no game content loads without it**; plus `updated_at` on `bionics` and `pilot_stats`, and `item_usage`, `delete_content_item` and `save_bionic`), and `20261119170000_enforce_picker_rules.sql` (the submit-time rules for players, below; it adds only two triggers and changes no data, so nothing breaks if it is late, the rules just aren't enforced yet), `20261119180000_reputation.sql` (before the Factions tab and the Reputation panel work there: it adds `organisations.updated_at` and seeds the five levels) and `20261119190000_public_backstory.sql` (before the backstory toggle works there: the pilot page reads `pilot_public_backstory`, and a missing table only leaves the toggle at Private).**
- **Testing locally with a login:**
  - `supabase/seed.sql` creates local-only password accounts: `test-pilot@hor-os.local` (password `local-test-pilot`, a player) and `test-gm@hor-os.local` (password `local-test-gm`, a GM).
  - The `dev-localdb` launch config (`npm run dev -- --mode localdb --port 5174`) points the app at local Supabase, using the git-ignored `.env.localdb.local`.
  - Sign in from the browser console with `supabase.auth.signInWithPassword`, since the site only has a Discord button.
- **The new-pilot loop works locally:** register, fill in the sheet, GM sends back or approves, pilot appears in the registry. Checked as both test accounts, including a player trying to approve themselves from the console (the database refuses).
- **Pending changes for approved pilots are built** and tested locally as a player and a GM (approve, reject, stale, buying with manna, withdraw). The hosted database also needs `20261029022434_level_and_manna.sql` and `20261029024308_pending_change_drafts.sql`.
- **Scope cut and redesign done** (2026-10-29): top-bar tabs, plain page headers, the gm: pilots roster for levelling and manna, death and the memorial, the owner content page. Archive, reputation and gear browsers removed.
- **The site-wide redesign is complete** (2026-11-16, branch `ui-redesign`): phases 1–6 rebuilt every logged-in page from the approved prototype, and phase 7 was a consistency pass (legacy colours, sentence-case copy, save status, empty states, dead CSS).
- Next: image uploads. LCP imports and pack updates are built; no real campaign pack was added during development tests.

- **Hosted schema verified (2026-10-29):** the hosted project has all five migrations through `20261029024308_pending_change_drafts`, including `character_sheets.level`, `character_sheets.manna` and `pending_changes.submitted_at`. GM reads and no-op writes were verified inside rolled-back transactions after the earlier missing-column errors.

- **Lore table exists** (migration `20261116210000_lore_entries.sql`, not yet on the hosted database, so push `main` before the lore pages work there): `public.lore_entries` is readable by everyone logged in when published, drafts and all writes are GM and owner only, and `created_by` is forced by a trigger; tested in `supabase/tests/lore.test.sql`.
