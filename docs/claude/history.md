# History, hosting, gotchas, hosted migrations

Covers: the original scope wording, tech stack and Cloudflare/Discord hosting setup, the full Gotchas list, local setup and test accounts, the dated completed-work log and the hosted migrations. Read when deploying, debugging infrastructure or checking what was built when. Current state and next steps: [STATUS.md](../../STATUS.md).

## Scope (original wording)

A website for one big LANCER (tabletop RPG) campaign and roleplay, run on a Discord server with a few GMs and many players. It tracks characters. It is not a VTT (no game board).
- **Players** create and manage their LANCER character.
- Player edits don't go live straight away. They become **pending changes**.
- **GMs** see characters and pending changes, can edit characters, and approve or reject changes. GMs can also have characters of their own.
- The campaign uses a **homebrew** version of LANCER: official content plus custom content the GMs add.
- **Scope (decided by the developer, 2026-10-29): character management only.** Pilots and their content: a clean submission → approval and change → approval pipeline, easy manna spending for players, easy levelling for GMs, and the game content pilots need (LCP import and editors, owners only). Visually clear and simple over stylised. **Reputation came back into scope on 2026-11-19** as a GM-only tracker (see [reputation.md](reputation.md)). (Browsing game content came back into scope on 2026-10-31 as the **archives** tab, see [archives.md](archives.md). **Lore** came back on 2026-11-16: GM-written entries, built as option A, a list + reading pane like the archives, chosen from the mockups in `docs/redesign/lore/`. Drafts are GM-only; published entries are visible to every logged-in user.) Reputation is behind the scenes: players never see or read it.

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
  - **Discord link previews** (2026-11-20): `wrangler.jsonc` has `main` (`worker/index.ts`) and `run_worker_first` for `/registry/*`, so a small Worker adds og tags to pilot links and everything else is served as static files (details: [id-card.md](id-card.md)). The Worker needs a git-ignored `.dev.vars` for local testing: `npm run build`, then `npx wrangler dev --local`.
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

## Local setup and test accounts

- Supabase is set up in the repo: the client is `src/lib/supabaseClient.ts`, the CLI config is in `supabase/`, and real keys go in `.env.local` (see `.env.example`). The hosted project is linked through Supabase's GitHub integration (working directory `.`). TypeScript types are generated into `src/lib/database.types.ts`: run `npm run types` after any database change.
- `supabase test db` runs every file in `supabase/tests/` (pgTAP): it tries to break the rules as a player, GM, owner and logged-out visitor (667 checks at the pilot inventory migration, 2026-11-20).
- **Local Supabase uses ports 553xx**, not the default 543xx, because another local Supabase project on this machine already uses the defaults. Studio is at http://127.0.0.1:55323.
- **Local test accounts:** `supabase/seed.sql` creates local-only password accounts: `test-pilot@hor-os.local` (password `local-test-pilot`, a player) and `test-gm@hor-os.local` (password `local-test-gm`, a GM). The `dev-localdb` launch config (`npm run dev -- --mode localdb --port 5174`) points the app at local Supabase, using the git-ignored `.env.localdb.local`. Sign in from the browser console with `supabase.auth.signInWithPassword`, since the site only has a Discord button.
- **Local game data:** `supabase/seed.sql` also loads LANCER's core pilot gear (from `lancer-data`) and four made-up bionics, and `supabase/seeds/lancer-core.sql` loads lancer-data's core frames, mech weapons, systems, tags, talents and core bonuses (generated from `lib/*.json`, unchanged; `config.toml` runs `./seeds/*.sql` after `seed.sql`), so the pickers work locally. The hosted database starts without game content; owners load it through the LCP importer.
- The developer's hosted profile is set to `owner` for testing.

## Completed-work log

Newest last. Detail for each area is in the topic files linked from [STATUS.md](../../STATUS.md).

- **2026-10-28:** Vue + Vite + TypeScript app, Supabase client and CLI config, the initial schema (`20261028052810_initial_schema.sql`, following `docs/database-sketch.md`), Discord login (a real login works and the hosted database got its first profile), the first pilot manager, approval and the base HOR_OS look. `supabase/tests/security.test.sql` tried every rule as each kind of user.
- **2026-10-29:** scope cut to character management and the first redesign of navigation (top-bar tabs, plain page headers, the gm: pilots roster for levelling and manna, death and the memorial, the owner content page; archive, reputation and gear browsers removed then, the archives and reputation came back later); the logged-in net chat removed; pending changes for approved pilots (approve, reject, stale, buying with manna, withdraw, drafts); level and manna; the LCP importer and core content importer; the LANCER rules configured in `docs/lancer-rules.md`. The hosted schema was verified through `20261029024308_pending_change_drafts` (GM reads and no-op writes checked inside rolled-back transactions after earlier missing-column errors).
- **2026-10-31:** pilot sheet rework, full item information and the archives.
- **2026-11-15 to 2026-11-16:** the site-wide redesign from the approved prototype (branch `ui-redesign`: phases 1 to 6 rebuilt every logged-in page, phase 7 was a consistency pass of legacy colours, sentence-case copy, save status, empty states and dead CSS); hosting moved from Vercel to Cloudflare; the lore page and table (`20261116210000_lore_entries.sql`: published entries readable by everyone logged in, drafts and all writes GM and owner only, `created_by` forced by a trigger; `supabase/tests/lore.test.sql`); approval hardening, GM edit mode and owner delete.
- **2026-11-17:** trustworthy saving (`checkWrite()`, `updated_at` guards, proper error messages), game content past 1,000 rows loaded once per visit, lazy pages, keep-alive, remove unused LCP packs, image uploads, weapon mods, the content editor, profile name fallback, the `hor-os.party` domain.
- **2026-11-18:** content editor forms for every kind (frames last), biomod manufacturer and archives category, NHC logo, GM-only content, licence links to the archives, alternate frames sharing their original's licence, masonry card grids, the boot log pinned to its newest line.
- **2026-11-19:** new pilots stay drafts until submitted, visual pickers, the mech overview, standard site text; send back changes as drafts; Exotic items only in GM edit mode; frame art; rewards and experience; reputation (factions); submit-time picker checks; public backstory toggle; public pilot sheets except backstory and manna; HORUS and NHC biomods GM edit only; grit shown on pilot sheets.
- **2026-11-19 to 2026-11-20:** pilot profile customisation (colour, banner, motto, gallery), service record, commendations and the Union ID card (`27bf5a5`, `689fb2f`); the pilot page as a dossier (cover, numbered sections, file index); filled stat tiles; banner positioning; new pilots start with 2000 manna; the backfill of automatic service-record lines for pilots approved before 2026-11-20; item descriptions and a required damage type for Variable mech weapons.
- **2026-11-20:** Discord link previews through the `worker/` Worker; the pilot inventory (`owned_gear` / `equipped_gear`, `Buy item`, `View inventory`, GM-only `misc_items`, free starting loadout; `pilot_gear_notes` were converted onto owned items; audited three times, replays with `supabase db reset`); GM controls as dossier section 08 with a teal `--gm` for GM entry points; danger zones made consistent; the phone layout of the pilot page redone twice (desktop checked pixel-identical); a damage type picker for Variable pilot weapons (`owned_gear[].damageType`, needed whether equipped or stowed); full-screen dialogs on phones and the grouped Buy item picker (checked in Chromium and WebKit phone emulation and on desktop, a pass at 320, 360 and 390 found no overflow; not checked on a real phone); a frontend code cleanup (about 390 fewer lines across 60+ files, same behaviour; see [STATUS.md](../../STATUS.md)); the documentation split into topic files.

## Hosted migrations

**Rule:** a new migration goes to the hosted project **before** the site is pushed, because the pages read the new columns and tables straight away (Supabase's GitHub integration applies migrations on push; check the hosted project first). **Pending: none.** Every migration through `20261121120000_mech_public_card` is on the hosted project (applied 2026-11-20). What each adds, and what breaks on a project without it:

| Migration | What it adds |
|---|---|
| `20261028052810_initial_schema` | tables, RLS, grants, first functions |
| `20261028085652_rich_text_paragraphs` | appearance, personality and traits become `jsonb` |
| `20261028183456_mod_limit_default`, `20261029022434_level_and_manna` | mod limit default; `level` and `manna` (needed for my pilot) |
| `20261029024308_pending_change_drafts` | change drafts |
| `20261029052117_dismiss_approval_note` | `dismiss_approval_note` |
| `20261029055426_import_lcp` | `import_lcp` |
| `20261116210000_lore_entries` | lore table |
| `20261116225551_approval_hardening` | the approve and reject functions (the GM buttons call them) |
| `20261116235409_pending_changes_updated_at` | `updated_at` on changes (without it draft saves fail) |
| `20261117155935_profile_names` | Discord name fallback |
| `20261117173030_remove_pack` | `pack_usage`, `remove_pack` (the content page calls `pack_usage`) |
| `20261117180750_image_uploads` | public image bucket and its policies |
| `20261117190000_weapon_mods` | weapon mods in `import_lcp` |
| `20261117201816_content_editor` | `content_items.edited`, `draft`, `updated_at` (no game content loads without them), `item_usage`, `delete_content_item`, `save_bionic` |
| `20261118120000_biomod_slot_effect_price`, `20261119090000_biomod_manufacturer` | biomod slot, effect, price, manufacturer |
| `20261119120000_pilot_submission` | `characters.submitted_at`, `send_back_pilot`, locks on a submitted pilot (the pilot pages and Pending tab read it) |
| `20261119130000_send_back_changes` | `reject_change` returns the change as a draft |
| `20261119140000_exotic_tag` | keeps the Exotic Gear rule true for existing items |
| `20261119150000_starting_manna`, `20261121090000_starting_manna_2000` | starting manna (2000 now) |
| `20261119160000_rewards_and_experience` | `pilot_progress`, `pilot_reward_log`, `award`, `level_up` (the roster and GM controls read them) |
| `20261119170000_enforce_picker_rules` | submit-time picker rules (two triggers, no data change) |
| `20261119180000_reputation` | `organisations.updated_at`, the five levels |
| `20261119190000_public_backstory`, `20261119200000_public_sheets` | `pilot_public_backstory`, `pilot_sheet()` |
| `20261120090000_pilot_profile` | `pilot_profiles` and the wave 2 tables (the registry list embeds it) |
| `20261120100000_timeline_milestones` | automatic service-record entries |
| `20261120110000_banner_position_and_public_card` | banner position, `card_version`, `pilot_card()` for link previews |
| `20261121100000_backfill_service_record` | automatic lines for pilots approved before 2026-11-20 |
| `20261121110000_pilot_inventory` | `owned_gear` / `equipped_gear`, `equip_pilot_gear`, `settle_pilot_gear`, prices |
| `20261121120000_mech_public_card` | `mech_card()`, `pilot_profiles.mech_card_versions`, card storage policies for mech card names |
