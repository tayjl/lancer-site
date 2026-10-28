# LANCER Campaign Site

## What this is
A website for one big LANCER (tabletop RPG) campaign and roleplay, run on a Discord server with a few GMs and many players. It tracks characters. It is not a VTT (no game board).
- **Players** create and manage their LANCER character.
- Player edits don't go live straight away. They become **pending changes**.
- **GMs** see characters and pending changes, can edit characters, and approve or reject changes. GMs can also have characters of their own.
- The campaign uses a **homebrew** version of LANCER: official content plus custom content the GMs add.

## How to work with me (the developer)
- I'm a junior developer. Act as a senior developer mentoring me.
- **Don't write code or do the work for me unless I explicitly ask.** Explain, review, and point me in the right direction instead.
- Explain things in plain English. Avoid jargon, or explain any term I'm unlikely to have met before.

## Tech stack (decided)
- **Frontend:** Vue + Vite (I already know Vue), with **TypeScript**.
- **Database, logins and security rules:** Supabase (free tier).
- **Hosting:** Vercel (free Hobby plan).
- **No custom backend API.** The Vue app talks straight to Supabase using `supabase-js`. Keep it simple.

## How the pieces fit
- The browser (Vue app hosted on Vercel) talks to Supabase. There's nothing in between.
- Security is enforced **in the database** with Row Level Security (RLS), never only in the frontend code, because anyone can tamper with code running in their browser.
- The one exception to "no backend": small **database functions inside Supabase** (written in SQL) for actions that must happen all-or-nothing, such as approving a change. Vue calls them with `supabase.rpc()`. They're not a server, and there should only be one or two.

## Users and roles (decided)
- **No campaigns table.** Everything belongs to the one campaign.
- Anyone can sign up, using **"Log in with Discord"** through Supabase Auth.
- A **profiles** table holds one row per user: Discord name and role. New users are players. GMs and owners are set by hand in the Supabase dashboard.
- **Three roles:**
  - **Player:** manages their own character through pending changes.
  - **GM:** everything except managing LCP content. Edits any character, approves or rejects changes, and can have their own characters, which they edit directly without approval.
  - **Owner:** everything a GM can do, plus managing LCP content (importing, updating and removing packs).
- Players have **one living character** at a time. When it dies, they can make a new one. GMs and owners can have several. Enforce this in the database, not just the page.

## Characters (decided unless marked)
- Three tabs: **Pending**, **Approved** and **Dead**.
- **New character:** the player fills in a template and submits it, and it shows as pending. When a GM approves it, it moves to Approved.
  - Suggested in `docs/database-sketch.md`: a new character is a normal character with status pending, which the player edits directly until a GM approves it. Pending changes are only for approved characters.
- **Every logged-in user can see every character (pending, approved and dead), but only the public parts:**
  - Pilot: name, callsign, age, gender, sexuality, height, weight, eye colour, hair colour, appearance description and image, personality, and traits (narrative: what the character is good at).
  - Mech: name, appearance, image, manufacturer ID.
  - Everything else (stats, loadouts and so on) is for the character's player and GMs only. It must be **really secret** (enforced by the database, not just hidden on the page), but it isn't critical, so keep the solution simple.
- **Death:** GMs, owners, or the character's own player can mark a character dead. Everyone can see the Dead tab. Dead characters can't come back.
  - A player marking their own character dead needs **no GM approval**, just a "are you sure?" confirmation on the page.
  - Players can't update the characters table directly, so this needs a small database function. It checks that the caller owns the character (or is a GM or owner), and refuses to change a dead character back. A flash clone counts as a new character, which the player submits for approval as usual.
- **Images:** store uploads in Supabase Storage (1 GB on the free tier). Discord attachment links expire after about a day, so pasted Discord links won't work. Pending characters are visible to everyone, so an uploaded image is public before a GM has reviewed it.
- **COMP/CON import:** wanted, if it's not too hard. It only pre-fills the new-character form, and the result still goes through normal approval. Build it after the core features work.

## Character sheet contents
- **The full field list** (from the developer, 2026-10-28):
  - Profile: name, callsign, age, gender, eye colour, height, weight, sexuality, hair colour, personality, appearance description, appearance image, and traits.
  - Pilot stats: physicality, dexterity, perception, acuity, tech-fluency.
  - Mech skills: hull, systems, agility, engineering.
  - Also: licences, weapons and equipment (pilot gear only), bionics/bodymods, backstory.
  - Mechs (added in a follow-up answer): several per pilot, each with a name, appearance description, image, weapons on the frame's mounts, a manufacturer ID, and systems with system points.
  - Confirmed as staying, though not on the list: talents, core bonuses, licence level, pilot HP, manna and mod points.
- **It's a general character manager, not a combat tracker.** It doesn't track current HP, structure, stress or heat.
- **Mech stats:** standard LANCER, minus **grit, save target, evasion, e-defense, tech attack and sensors**. It's a Discord roleplay with little or no dice rolling, so stats that only matter for rolls don't apply. Grit is removed everywhere it normally appears (pilot HP, mech HP, attack bonus). Assumed: pilot evasion and e-defense go too. Calculate them from the character's choices and the game data (frame, licence levels, talents, core bonuses and so on). Don't store them, for the same reason item names and stats aren't stored.
- **Pilot stats are custom.** LANCER's skill triggers ("narrative triggers") are replaced by five homebrew stats: **physicality, dexterity, perception, acuity and tech-fluency**.
  - They're set when the character is made and **don't grow** with level. Bionics are the only way to raise them.
  - They're **private**: players see only their own.
- **Mech skills** (Hull, Agility, Systems, Engineering) and **pilot HP** work as in normal LANCER, including going up on level-up.
- **Bionics / enhancements raise pilot stats.** Decided: they're the **site's own content**, not LCP content. They're stored in Supabase next to the list of custom pilot stats.
  - Each bionic has a name, a description, the stat bonuses it gives, a **manna cost** and a **mod-point cost**. A bonus can only point at a stat that exists in the list.
  - **Mod points:** each pilot has a mod-point total, like a mech's system points, and installed bionics can't cost more than it. Only GMs raise it, and rarely. The sheet shows points used against the total, and GMs check it when approving.
  - Installing a bionic is a normal pending change: add the bionic and pay the manna. Once installed, a bionic can only be swapped for a similar one. That rule isn't coded; GMs judge it when approving.
  - Bionics are **private**, like stats.
  - Characters store bionic IDs, like any other item. Only owners can add or change bionics or stats. One that's in use can't be deleted.
  - To start, owners can add them in the Supabase dashboard's table editor. Anyone with dashboard access can change *everything*, so only trusted people get it. An owner-only form in the site can come later.
  - Why not LCP: `cc-lcp-editor` has no bonus that targets a specific stat, reusing an existing bonus ID would clash with official items, and a custom ID would have to be typed into the JSON by hand.
- **Mechs:** a pilot can have **several**. Each mech has:
  - a frame
  - a name, appearance description and image (all public)
  - a **manufacturer ID** the player makes up, in the format `XXXX-XXXX-XXXX` (assumed: letters and digits). It's **public**, and should be unique. Uniqueness isn't critical, so the site checks for duplicates and warns, rather than the database enforcing it.
  - weapons on the **mounts its frame provides** (for example, Blackbeard has Flex, Main and Heavy)
  - systems, shown as system points used against the total. System points are calculated, not stored.
- **Licence levels:** the pilot's licence level, plus their licence ranks in each frame.
- **Talents and core bonuses:** included.
- **Pilot equipment:** only LANCER pilot gear (armour, weapons, kit) from the game data. No free-text items.
- **Background:** a private backstory the player writes as free text. LANCER's ready-made backgrounds aren't used.
- **Not used:** skill triggers (replaced by custom pilot stats), grit, save target, evasion, e-defense, tech attack, sensors, LANCER backgrounds, bonds, and (not on the field list) reserves and weapon mods.
- **Manna:** the in-universe currency. It isn't in LANCER's data, so it's a plain number on the character. Players can only change it through a pending change, never directly. It's private: other players can't see it.
- **GM-only: reputation.** Each character has a reputation level with each organisation. Even the character's own player can't see it, and players can read their own sheet, so reputation can't live in the sheet. It needs its own table, plus a list of organisations. Owners manage the organisations. GMs and owners set the levels. Levels are names, not numbers (the list of names isn't settled yet).

## Pending approval workflow (decided: option 2)
- The approved character stays **untouched** while a change is pending.
- Proposed changes are stored **separately** (a pending-changes table) until a GM approves or rejects them.
- Players keep a usable sheet while they wait, and the GM can see exactly what changed.
- **One pending change per character at a time.** The player can **edit or withdraw** it until a GM reviews it.
- **Watch out:** if a GM edits a character directly while the player has a pending change, approving that change could overwrite the GM's edit, because the change was based on the older sheet. The approval function should catch this, for example by checking that the character hasn't changed since the pending change was made.
- GMs approve or reject a **whole** change, with no partial approval. Rejecting needs a **reason**, and the player then submits a new change.
- Approving means (1) applying the change to the character and (2) marking the pending change as approved. Both must happen in **one database function** (all-or-nothing), so a failed request can't leave half-applied data.
- **History** is wanted, kept simple. Suggested: don't delete reviewed changes. Keep each one with its status (approved or rejected), who reviewed it, when, and the reason. Those rows are the history.

## Security rules (critical)
- **Players must NOT be able to update the characters table directly.** They can only add pending changes for their own characters. Otherwise anyone could skip GM approval using browser developer tools.
- Only GMs (or the approval function) can change approved characters.
- **Players must NOT be able to change their own role** in the profiles table, or anyone could make themselves a GM.
- **Only owners can add, change or remove LCP content.**
- **Reputation is GM-only.** Only GMs and owners can read reputation or change its levels, and only owners can change the list of organisations. The character's own player can't see it either.
- Players can see and edit their own things, and can see only the public parts of other characters. GMs and owners can see everything.
- **RLS works on whole rows, not fields.** If a player can read a character's row, they can read every field in it with developer tools, even the ones the page doesn't show. The private parts must be secret, so the public parts have to be stored apart from them (for example, in their own table).
- Test the rules by trying to break them while logged in as a player.
- Supabase has two keys. The **public** one ("anon" or "publishable") is safe in the browser. The **secret** one ("service_role" or "secret") bypasses every rule. It must never go in the frontend or be committed to git.

## Gotchas
- **Vite environment variables:** only variables starting with `VITE_` reach the browser, and those are public. Only the public Supabase key goes in a `VITE_` variable. Keep `.env` files out of git.
- **Vercel + Vue Router:** with clean URLs like `/characters/42`, refreshing the page can show a 404. Vercel needs a rewrite (in `vercel.json`) that sends every path to `index.html`.
- **Supabase free tier pauses projects after 1 week of inactivity.** No data is lost, and you restore it from the dashboard. Expect this during campaign breaks. Limits: 2 active free projects and a 500 MB database, which is plenty for this.
- **Vercel Hobby is for non-commercial use only.** Don't charge players or add ads.
- **New tables may not be reachable from the app automatically.** Depending on the project's Data API settings, each new table needs an explicit `grant` to the `authenticated` role, on top of RLS. Every migration that creates a table should enable RLS and grant only what's needed.

## LANCER game data
- Don't hand-type frames, weapons and talents. Use **Massif Press's own data** (https://github.com/massif-press).
- **Official content to enable** (each is a GitHub repo and an npm package):

  | Content | npm package |
  |---|---|
  | Core | `@massif/lancer-data` (its wiki documents the JSON format) |
  | Karrakin Trade Baronies | `@massif/ktb-data` |
  | Long Rim | `@massif/long-rim-data` |
  | Wallflower | `@massif/wallflower-data` |
  | Dustgrave | `@massif/dustgrave-data` |
  | Operation Solstice Rain | `@massif/osr-data` |
  | Operation Winter Scar | `@massif/ows-data` |
  | Shadow of the Wolf | `@massif/sotw-data` |
  | Siren's Song, A Mountain's Remorse | `@massif/ssmr-data` |

- **Licence:** every package above is **GPL-3.0-or-later** (checked in each repo's `package.json` on 2026-10-28). You can use the data freely, but software built on it that you share must also be shared as source under the same licence. This repo is public and is licensed **GPL-3.0-or-later** to match (see `LICENSE`).
- **LCP tools:** `cc-lcp-editor` (a tool for making LCPs) and `vscode-comp-con-content-authoring` (a VS Code extension that checks LCP data is formatted correctly).
- **Decided: characters store item IDs, not copies of items.** A character saves the ID of each frame, weapon, talent and so on (the IDs used in `lancer-data` and LCPs), and the site looks up names and stats from the game data when showing the sheet. Don't copy names or stats into the character. This makes homebrew and LCP import work, and means rules fixes in the data show up automatically.
- **Decided: the private character sheet is one JSON column (`jsonb`)**, not split across many tables.
  - Why: sheets are deeply nested (pilot, then mechs, then loadouts, then mounts). One column means fewer tables, one read and one write per sheet, and a pending change can hold a full proposed sheet in the same shape. COMP/CON exports are JSON too, which helps with import.
  - The cost: the database can't check that the item IDs inside it exist or that the shape is right, so the app has to validate it.
  - The public info (name, callsign, images and so on) stays in normal columns, apart from the sheet, because it has different visibility.
- COMP/CON (the official LANCER companion app) is built with Vue, so it's a useful reference for how to structure characters. It's GPL licensed, though: read it for ideas, but don't copy code wholesale.

## Homebrew and .LCP import
- **Decided:** owners add custom content by writing it in `cc-lcp-editor` and importing the `.lcp`. There's no item editor in the site. Homebrew is mostly **new content** (frames, weapons, talents and so on). The rule changes are custom pilot stats, bionics, and no grit or save target (see "Character sheet contents"). Otherwise mech maths is standard LANCER. Bionics are not LCP content (see "Character sheet contents"). Because content is added while the site is running, it has to be **stored in Supabase**, not only in the app's code.
- An `.lcp` file (Lancer Content Package) is just a renamed `.zip` of JSON files, in the same format as `lancer-data`. It must contain an `lcp_manifest.json` at the top level, and subfolders are ignored.
- Things to plan for:
  - Characters refer to items by **ID**. If an item goes missing, every character using it breaks. So imported data must be **kept**, and deleting items that characters use must be blocked.
  - Unzipping can happen in the browser, so this still doesn't need a backend.
- Suggested, not decided: import the official packs through the same LCP import as homebrew. One feature then covers official content, homebrew and future expansions.

## Look and feel
- The site is styled as an **in-universe COMP/CON terminal operated by HORUS on HOR_OS**, similar to LANCER's existing in-universe material. I'll suggest styling ideas as they come.
- Don't copy COMP/CON's styling code or Massif's logos. Massif has a third-party licence for fan projects that asks for a notice on the site. Read it before launch.

## Priorities
- No deadline. Getting the style right and making it work matter more than speed.

## Open questions
1. **Starting values** for pilot stats, and starting mod points. (To be worked out later.)
2. **Reputation level names.** (To be worked out later.)

## Current status and next step
- Vite + Vue + TypeScript scaffold, tidied down to a placeholder page. No tables or app features yet.
- Supabase is set up in the repo: the client is in `src/lib/supabaseClient.ts`, the CLI config is in `supabase/`, and real keys go in `.env.local` (see `.env.example`). The hosted project is linked through Supabase's GitHub integration (working directory `.`).
- **The database is built** in `supabase/migrations/20261028052810_initial_schema.sql`, following `docs/database-sketch.md`. It hasn't been pushed to the hosted project yet.
- `supabase test db` runs `supabase/tests/security.test.sql`. It tries to break every rule as a player, GM, owner and logged-out visitor. All 51 checks pass locally.
- **Local Supabase uses ports 553xx**, not the default 543xx, because another local Supabase project on this machine already uses the defaults. Studio is at http://127.0.0.1:55323.
- **Discord login is built.**
  - `src/auth.ts` holds the session and the logged-in user's profile.
  - `src/router.ts` sends anyone who isn't logged in to `/login`.
  - The pages are in `src/views/`, and `vercel.json` has the rewrite for clean URLs.
  - Checked up to Discord's login page. A real login hasn't been tested yet.
- Next: log in once and set your role to owner in the dashboard, then generate TypeScript types, then the HOR_OS styling.
