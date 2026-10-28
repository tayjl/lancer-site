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
- **Mech stats:** standard LANCER, minus **grit, save target, e-defense, tech attack and sensors**. (Evasion was on this list, but the developer asked for it on the mech page on 2026-10-28, so mechs show it.) The mech page shows structure, stress, hp, heat cap, armour, evasion, repair cap and system points. It's a Discord roleplay with little or no dice rolling, so stats that only matter for rolls don't apply. Grit is removed everywhere it normally appears (pilot HP, mech HP, attack bonus). Assumed: pilot evasion and e-defense go too. Calculate them from the character's choices and the game data (frame, licence levels, talents, core bonuses and so on). Don't store them, for the same reason item names and stats aren't stored.
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
- **The pilot page is modular.** Each category (mechs, equipment, talents, licences, core bonuses, mech gear and so on) is a section with a `[ + ]` box to add an item.
  - For game items, `[ + ]` opens a searchable picker of pre-made items from the imported LCPs. This is how most players add things, and the sheet stores only the item's ID.
  - Mechs are added with a small form (name, manufacturer ID, appearance, image).
  - Paragraph fields (appearance, personality, traits, backstory) use a rich-text editor (planned: TipTap, which stores formatting as structured data rather than raw HTML, so players can't inject code into each other's pages). Its toolbar offers bold, italic and underline; small, normal and large font sizes; the palette's accent colours (lilac, rose, sky) only; and bullet lists and small headings. Short fields are plain inputs.
  - **No separate registration form.** `pilot_management` shows an empty modular pilot page when you have no pilot, and every section (identity included) is filled in place. The first save creates the pending pilot.
  - Sections that need LANCER data (equipment, talents, licences and so on) show with their `[ + ]` boxes marked "module offline" until the packs are imported. Mechs work straight away.
  - Pilot stats and mech skills get their own section on the page, added once their starting values are decided.
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
- **Decided base look:** a glitch terminal with a dark grey background, white general text, and pastel purple and red accents. It should be easy on the eyes, stylised but readable, especially on character pages.
  - **Colours** are variables in `src/style.css`: dark grey background `--void`, `--panel`, `--rule`, white text `--text` / `--text-dim`, and the accents `--lilac` (main), `--rose` (second, for warnings) and `--sky` (third, for chat usernames). Use the variables, not new hex values.
  - **Fonts** are bundled with the site (no Google Fonts, for privacy): Cascadia Mono (`--mono`) for headings, labels, buttons and the boot scrawl, and Atkinson Hyperlegible Next (`--read`) for anything read at length. Cascadia Mono is used because it has every block and shade character (`░▒▓█▄▀`), so the ASCII art lines up.
  - **Logged-in pages read like a terminal**, matching the login screen:
    - **Layout** (`src/App.vue`, from the developer's sketch):
      - **Sidebar** on the left: the HORUS logo in lilac, centred at the top (12-line ASCII art in `src/assets/logo.txt`, 6px with 7px lines, linking home), and the menu in four groups with space between them (pilot_management / registry, pending, those_who_passed / archive_viewer / pilot_gear, mech_gear). The top bar matches the logo's height on wide screens.
      - **Top bar:** three slots. The current path (`~/pilot_registry`) on the left, a `[ gm view ]` toggle in the exact centre for GMs and owners only, and `uuid: <name> [role]  [ disconnect ]` on the right.
      - **Content** on the right.
      - **Net chat:** a fake live chat from `src/assets/net-chat.txt`, in the same format as the login chat.
        - On wide screens it's pinned to the bottom of the window under the page, 8 lines tall, with a thin line above it. The 5-line MOTD block at the top comes out quickly (0.3s a line), then a new message arrives every 1.8 seconds (`delay` and `quick-lines` on `ChatFeed` in `App.vue`).
        - On wide screens a small `[ minimise ]` in its top-right corner shrinks it to one line with `[ show chat ]`. The choice is remembered in the browser (localStorage).
        - On phones a `[ chat ]` toggle (left of the logo, mirroring `[ menu ]`) pops it up over the bottom of the screen.
        - Both chats share `src/chat.ts` (parsing, hiding cut-off messages) and `src/components/ChatLine.vue` (colouring). `src/components/ChatFeed.vue` is the panel.
      - **Phones** (under 48rem wide):
        - The header collapses to the logo and a `[ menu ]` toggle. Opening it shows the menu, gm view and the top bar, all centred.
        - Each menu group is a centred row, and the current page reads `> like this <`.
        - The menu closes when you pick a page, or once you've scrolled past the header.
      - **Divider lines are allowed here:** a thin `--rule` line down the sidebar and under the top bar. The brand area and top bar share a height (`--bar-height`), so the line runs straight across. Visual clarity matters more on pages with real information. The login screen stays line-free.
    - **Menu and pages** (each route's `meta.title` and `meta.summary` in `src/router.ts`):
      - `pilot_management` `/pilot`: your own pilot
      - `pilot_registry` `/`: approved pilots' public cards
      - `pending_paperwork` `/pending`: pilots and changes waiting on a GM
      - `those_who_passed` `/memorial`: dead pilots
      - `archive_viewer` `/archive`: server lore, as separate articles (e.g. one per faction or place) that every logged-in user can read. It'll need its own table. GMs and owners write and edit them.
      - `pilot_gear` `/gear/pilot`
      - `mech_gear` `/gear/mech`
      - `gm_view` `/gm`, GMs and owners only
    - **Unbuilt pages** use `src/views/ModuleOffline.vue`, which shows the page's title and summary.
    - **pilot_registry** (`/registry`, `src/views/RegistryView.vue`; `/` redirects here) is a grid of small cards for easy browsing.
      - **The card** (`src/components/PilotCard.vue`) shows only the portrait, callsign, pilot name and mech name. The same card is meant for pending_paperwork and those_who_passed.
      - **Clicking a card** opens the pilot record (`/registry/:id`, `src/views/PilotRecordView.vue`): portrait, every public identity fact, appearance and personality (in `.prose`), traits, and each mech with its image, manufacturer ID and appearance. Private sheet data and the backstory are never shown there, except to GMs (see "GM review" below).
      - **Real data:** `src/pilots.ts` loads pilots from the `characters` table (`fetchPilots`, `fetchPilot`), with the player's display name from `profiles`. It also defines the public pilot shape.
      - **pending_paperwork** uses the same grid (`RegistryView.vue`), listing pending pilots instead. Each route's `meta.status` picks which pilots, and `meta.empty` is the text when there are none (typed in `src/router.ts`). Changes to approved pilots will join this list once pending changes are built.
      - **GM review** (`src/components/GmReview.vue`): GMs and owners see the pilot's private sheet under the record (stats, bionics, gear, backstory, read-only). While the pilot is pending they also get a decision box:
        - **Approve pilot** (after an "are you sure?"): sets the mod limit, clears any note, sets the status to approved and `approved_at`. The pilot moves to the registry and the player's sheet turns read-only.
        - **Send back with note** (a note is required): saves it to `character_sheets.review_note`. The pilot stays pending, and the player sees the note at the top of their sheet until the pilot is approved.
      - **Images:** `src/components/Portrait.vue` is the 3:4 image frame, an empty dashed frame when there's no image.
      - **Menu highlight:** the menu marks an item "current" for its own page, or a page whose route `meta.section` names it (so the record page keeps pilot_registry highlighted).
    - **Menu marker:** the current page gets a `> ` marker like a terminal menu.
    - **This replaces** the Pending, Approved and Dead tabs planned earlier.
    - **Page titles** are prompts: `<h1><span class="prompt" aria-hidden="true">&gt; </span><GlitchText text="page_name" /></h1>`. They're terminal-sized, not huge.
    - **Page text** (`.page`) is Cascadia Mono, like terminal output. Use `.prose` for anything read at length, like backstories, and `.dim` for secondary text.
    - **No filled boxes.** Spacing and colour separate things, plus thin `--rule` lines where they help clarity, like the layout's dividers.
  - **Buttons are terminal options:** `[ like this ]` in lilac. When hovered or selected the brackets become arrows, `> like this <`, in rose, like a terminal menu pointing at the chosen option.
  - **Sharp text matters** (it was blurry on a 2560px monitor once):
    - Font sizes should land on whole pixels. 1rem stays 16px (the body font is set on `body`, not `:root`), and the ASCII art's size is rounded with `round()`.
    - Don't animate `transform` on text, and don't use `mask-image` on it. Both make the browser draw the text as a separate image, which blurs it.
  - **No visible divider lines** between the login screen's sections; spacing separates them.
  - **Glitching** only on the login screen's ASCII art (a colour-split jolt every few seconds) and on page titles (once on load, via `src/components/GlitchText.vue`). Never on body text or anything people read. It switches off for people who prefer reduced motion.
  - **The login page is a boot scrawl** (`src/components/BootSequence.vue`), laid out as a full-screen terminal:
    - **Rows:** the h0r_os ASCII art pinned at the top, the log in the middle, and the `[ uplink with discord ]` option centred at the bottom (`src/views/LoginView.vue`).
    - **Order:**
      1. COMP/CON's HORUS start-up text prints in the log, then the art fills its (reserved) space at the top, then the connection log and MOTD print. Text lines come every 320ms (intro) and 260ms (connection log); art lines every 35ms.
      2. The Uplink button appears, already selected.
      3. A fake HORUS chat keeps arriving in the log under the MOTD, in slightly smaller text, one message every 1.1s.
    - **The log doesn't scroll.** It works like `tail`: its height snaps to a whole number of lines, new lines appear at the bottom, and old ones drop off the top. Every line is the same height (the chat's line height matches the log's), so no line is ever cut in half. A wrapped message that's partly off the top is hidden.
  - **Where to edit it:** the text lives in `src/assets/boot/` (`intro.txt`, `art.txt`, `connect.txt`, `chat.txt`).
    - `chat.txt` is ours to edit freely. Lines are `username: message`, optionally starting with `[ MOD ]` (purple tag) or `[ ADMIN ]` (red tag). The `username:` is sky blue and the message white. Inside a message, `@mentions` are sky blue and `<SYSTEM MESSAGES>` in angle brackets are purple. Ban notices wrapped in `// ... //` are entirely red. The same rules apply to `src/assets/net-chat.txt` (all in `src/chat.ts`).
    - **Small phones** (a column under 28rem) show `art.txt` without the arrow banner at the bottom: everything from the first `>>>>` line on is dropped, worked out in code, so there's only one file to edit. Bigger screens show all 27 lines. The art's size on phones is limited by its 80-column width (about 7px on a 375px phone), so dropping lines frees vertical space rather than enlarging it.
    - An empty line in any of the text files shows as a blank line.
    - The phrases highlighted in rose inside the art are listed in `ART_PARTS` in `BootSequence.vue`. Update that list if those words change in `art.txt`.
  - **Behaviour:** any key or a click skips to the end, and it's instant for reduced motion.
  - **Layout:** one centred column, at most 47rem wide, which matches the art at its 16px maximum. The art scales to fill the column (container query units), so the text and art share edges, and the art shrinks on phones instead of wrapping.
    - On shorter screens the art also shrinks to leave room for the log, and the column narrows with it, but not below 34rem.
    - On very short screens (under 30rem tall, e.g. a phone held sideways) nothing is pinned and the page scrolls normally.
    - Text is slightly larger on wide screens.
    - It comes from COMP/CON (`src/features/main_menu/_components/startup_logs/horus.ts`, GPL-3.0, Massif Press) and is credited in the README. The `∙` character was swapped for `•`, because no bundled font has `∙` and it would break the art's alignment.
  - **In-universe labels** are lowercase HOR_OS-style, like `pilot_registry`, not ALL CAPS. Buttons still say plainly what they do ("Uplink with Discord", "Disconnect").
- Don't copy COMP/CON's styling code or Massif's logos.
- **Massif's Lancer Third Party License** (https://massifpress.com/legal) requires two pieces of text: an acknowledgement that the site isn't an official Lancer product, and "Lancer is copyright Massif Press".
  - Both are in `src/components/ThirdPartyNotice.vue`, which names the site HOR_OS. Keep the wording; only the name may change.
  - It's shown under `[ uplink with discord ]` on the login screen only (the developer's choice), not on the logged-in pages.

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
- A real Discord login works: the hosted database has the first profile.
- TypeScript types are generated into `src/lib/database.types.ts`. Run `npm run types` after any database change.
- The HOR_OS base look is built (see "Look and feel").
- Tay's hosted profile is set to `owner` for testing.
- **pilot_management is built** as a full-width, COMP/CON-style sheet (`src/views/PilotManageView.vue`):
  - **Top strip:** big callsign, name, player and status badge (rose while pending, sky once approved), plus a save status. Centred on phones.
  - **Wide screens:** the long writing on the left, and the portrait with the identity table (age, gender, sexuality, height, weight, eyes, hair) on the right. The right column scrolls with the page (it doesn't follow you down). On phones the portrait and table sit between the top strip and appearance.
  - **Always editable, no edit buttons** (while pending): appearance, personality and backstory [private] are open editors that save themselves 0.8s after you stop typing (`src/components/SheetField.vue`). Callsign, name and the table are inline inputs that save when you leave them. Traits are off the sheet for now (the `traits` column and `EntryList.vue` are kept, and the registry record still shows them).
  - **Below, full width:**
    - **Personal stats** (from the `pilot_stats` table) and **piloting stats** (HASE): one line with - and + under each stat (`src/components/StatRow.vue`); where the row is too narrow (phones, narrow windows) each stat gets its own line instead. Both are tagged [private]. Everything starts at 1; 0 to 6 for now. Bionic bonuses show beside the number in sky. Stored in `sheet.pilot_stats` and `sheet.mech_skills`.
    - **Bionics [private]**, then **gear loadout [private]**: cards with a small `[ edit ]` that opens a picker of existing items only (`src/components/LoadoutBox.vue`). Bionics count their mod-point cost against the **mod limit** (`character_sheets.mod_points`, default 6 since migration `20261028183456_mod_limit_default.sql`), and the picker won't add one that goes over. Stored as ids in `sheet.bionics` and `sheet.pilot_gear`.
    - **Mech hangar** at the bottom: mech cards centred, a `[ + ] new mech` box when there are none, otherwise `[ new mech ]` in its header.
  - **Approved pilots** get the same sheet read-only, with a note that changes go through pending paperwork.
  - **Mechs are separate objects** with their own page at `/pilot/mechs/:mechId` (`src/views/MechView.vue`), laid out like pilot_management: name and manufacturer id edited in place across the top (with pilot and frame), appearance and history [private] on the left, the image on the right, then mech stats [private], an offline loadout, and "scrap mech". Public mech fields live in `characters.mechs`; history (and quirks, off the page for now like traits) in `sheet.mechs[mechId]`.
    - **Mech stats** are a `StatRow` with LANCER's symbols (`mechStats()` in `src/gameData.ts`, SVGs in `src/assets/icons/`, credited in the README). Every value shows "-" until frames are imported, then they're calculated from the frame and HASE.
  - **Shared pieces:**
    - `src/myPilot.ts` loads and saves your own pilot. Saves queue up and run in order, so autosaves can't overtake each other.
    - `src/gameData.ts` loads the catalogues (pilot gear from `content_items`, bionics with their bonuses, pilot stats).
    - `.sheet-label` (in `src/style.css`) is the section tag: a filled block with a lilac edge.
    - `src/components/EditableRichText.vue`, `EntryList.vue` and `Panel.vue` (the older panel style, unused since the mech page moved to the sheet layout), `AddBox.vue`, `RichTextEditor.vue` and `RichText.vue`.
    - `src/richText.ts` (the allowlist sanitiser) and `src/entries.ts` (the list parser) are tested in `src/*.test.ts` (`npm test`).
  - Pages can opt into centring with the `.page.centered` class.
  - **Local test data:** `supabase/seed.sql` also loads LANCER's core pilot gear (from `lancer-data`) and four made-up bionics, so the pickers work locally. The hosted database has no game content until LCP import is built.
  - **Database:** migration `20261028085652_rich_text_paragraphs.sql` changes appearance, personality and traits to `jsonb`. **The hosted database needs this migration and `20261028183456_mod_limit_default.sql` (push `main`) before pilot_management works there.**
- **Testing locally with a login:**
  - `supabase/seed.sql` creates local-only password accounts: `test-pilot@hor-os.local` (password `local-test-pilot`, a player) and `test-gm@hor-os.local` (password `local-test-gm`, a GM).
  - The `dev-localdb` launch config (`npm run dev -- --mode localdb --port 5174`) points the app at local Supabase, using the git-ignored `.env.localdb.local`.
  - Sign in from the browser console with `supabase.auth.signInWithPassword`, since the site only has a Discord button.
- **The new-pilot loop works locally:** register, fill in the sheet, GM sends back or approves, pilot appears in pilot_registry. Checked as both test accounts, including a player trying to approve themselves from the console (the database refuses).
- Next: pending changes for approved pilots (`pending_changes` and `approve_change`), then image uploads, mark dead / those_who_passed, and LCP import.
