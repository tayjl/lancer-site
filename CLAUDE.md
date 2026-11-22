# LANCER Campaign Site

## What this is
A website for one big LANCER (tabletop RPG) campaign and roleplay, run on a Discord server with a few GMs and many players. It tracks characters. It is not a VTT (no game board).
- **Players** create and manage their LANCER character. Their edits don't go live straight away: they become **pending changes**.
- **GMs** see characters and pending changes, can edit characters, and approve or reject (send back) changes. GMs can also have characters of their own.
- The campaign uses a **homebrew** version of LANCER: official content plus custom content the GMs add.
- **Scope (decided by the developer, 2026-10-29): character management only.** Pilots and their content: a clean submission → approval and change → approval pipeline, easy manna spending for players, easy levelling for GMs, and the game content pilots need (LCP import and editors, owners only). Visually clear and simple over stylised. Also in scope: the **archives** (browse game content), **lore** (GM-written entries), **pithub** (a hidden, stylised second lore section, added 2026-11-21), a **combat guide** (rules reference for a pilot's turn, no game board, added 2026-11-21) and **reputation** (GM-only, players never see it). Original wording: [docs/claude/history.md](docs/claude/history.md).

## How to work with me (the developer)
- I'm a junior developer. Act as a senior developer mentoring me.
- **Don't write code or do the work for me unless I explicitly ask.** Explain, review, and point me in the right direction instead.
- Explain things in plain English. Avoid jargon, or explain any term I'm unlikely to have met before.
- **When I do ask for work to be done, Claude supervises and a subagent builds** (the developer, 2026-11-16). Coding and other high-token work goes to the matching custom agent, batched (see Token & Architecture Rules). The main Claude plans, writes the subagent's instructions, reviews what comes back (diffs and screenshots), and pushes back on anything messy before it reaches me. Small edits and decisions stay with the main Claude.

## Token & Architecture Rules
Apply to the main session and every subagent; put the same rules in any subagent brief.
- **Model & effort:** the orchestrator runs on Sonnet, or Opus at medium effort at most. Never switch model or effort mid-session (it breaks the prompt cache).
- **Always use the custom agents** defined in `~/.claude/agents/` (`subagent_type` = the file's `name`; each sets its own model and effort, so don't pass `model` or `effort`). Pick the one whose job matches the task. Never use a built-in lookalike (`Explore`, `Plan`, `claude`, `general-purpose`) when a custom agent fits. If the folder has changed, follow the folder and update this list:
  - `explorer` (Haiku, read-only, runs graphify): searching, locating components, tracing state, checking Supabase types, before planning.
  - `database-architect` (Opus, high): migrations, RLS policies, database functions, triggers, pgTAP tests, `npm run types`.
  - `ui-designer` (Opus, high): designs new or reworked screens, components and styles, and writes a spec to the scratchpad (`design-<topic>.md`). It looks at the running page (`playwright-cli`) but doesn't edit the project. Give it the dev server URL and the scratchpad folder.
  - `ui-implementer` (Sonnet, medium): builds the UI from a `ui-designer` spec (or a precise brief for small changes), then runs the build and takes its own phone and desktop screenshots. Give it the spec's path, the dev server URL and the scratchpad folder.
  - `ux-reviewer` (Sonnet, read-only): review after any UI change on the running page with `playwright-cli` (polish, phones at 320/360/390, accessibility, empty states, the Site text rules). Give it the dev server URL, the test login and the scratchpad folder.
  - `security-auditor` (Sonnet, read-only): review after any change to RLS, auth, grants or `security definer` functions. It may prove a hole on the local database inside a rolled-back transaction.
  - `ts-developer` (Sonnet, medium): plain TypeScript logic and unit tests (rules, calculations, helpers). Runs tests and the build itself.
  - Fallback for anything none of these fits: `general-purpose` with `model: sonnet`.
- **Batched subagents:** group related file changes into one detailed brief for one agent, not several small subagents. Small edits stay in the main session.
- **Graphify first:** query `graphify-out/graph.json` (`graphify query "<q>"`, `graphify explain "<X>"`, `graphify path "A" "B"`) before raw Grep/Glob/Read scans, and check it for existing helpers/components before writing new code. Run `graphify update .` after code changes (AST only, free).
- **Ponytail minimalism:** smallest complete diff, reuse existing abstractions, no speculative features.
- **Quiet commands:** run tests/builds/linters quietly or piped, e.g. `npm test -- --reporter=dot 2>&1 | Select-Object -Last 30`, `npm run build 2>&1 | Select-Object -Last 30` (PowerShell), or `| tail -n 30` in Bash.
- **Read docs on demand:** open the `docs/claude/*.md` file for an area only when the task touches it, and read only the section needed.
- **Session handoffs:** at the end of a feature or milestone, update [STATUS.md](STATUS.md) (short: current state, what's unpushed or needs a hosted migration, next steps) so the developer can `/clear` safely.

## Tech stack (decided)
Vue + Vite + **TypeScript**; **Supabase** (free tier: database, Discord login, security rules); hosted on a **Cloudflare Worker** serving static files, built and deployed from the GitHub repo on every push (`wrangler.jsonc`, `.node-version`). **Pushing is going live: ask before pushing.** Domain `hor-os.party`. **No custom backend API:** the Vue app talks straight to Supabase with `supabase-js`. Security is **Row Level Security (RLS) in the database**, never only in the frontend. The few all-or-nothing actions (approving a change) are small SQL **database functions** called with `supabase.rpc()`. Cloudflare/Discord setup steps: [docs/claude/history.md](docs/claude/history.md).

## Users and roles (decided)
- No campaigns table: everything belongs to the one campaign. Anyone can sign up with **"Log in with Discord"** (no GM approval; email signup off). A `profiles` row per user holds name and role; new users are players; GMs and owners are set by hand in the Supabase dashboard.
- **Player:** manages their own character through pending changes. **GM:** everything except managing LCP content; edits any character, approves or rejects changes, can have characters of their own (edited directly, no approval); can't delete characters. **Owner:** everything a GM can, plus managing LCP content and deleting any character.
- Players have **one living character** at a time (GMs and owners can have several); enforced in the database (insert policy plus a per-player lock trigger), not just the page.
- Full wording: [docs/claude/security.md](docs/claude/security.md).

## Security rules (critical; detail in [docs/claude/security.md](docs/claude/security.md))
- **Players must NOT be able to update the characters table directly.** They only add pending changes for their own characters. Only GMs (or the approval function) change approved characters.
- **Players must NOT be able to change their own role** in `profiles`. **Only owners** add, change or remove LCP content, and **only owners can delete characters**.
- **RLS works on whole rows, not fields.** Anything a player can read in a row, they can read with developer tools, so private data (backstory, manna, review notes, reputation, experience) lives in separate tables or behind `security definer` functions.
- **Never trust a write that doesn't check its rows:** RLS turns a refused write into "0 rows, no error", so every `.update()`, `.upsert()` and `.delete()` ends in `.select()` and goes through `checkWrite()`.
- The **secret** Supabase key (`service_role`) never goes in the frontend or git; only the publishable key goes in a `VITE_` variable.
- Test rules by trying to break them while logged in as a player (`supabase test db`).

## Gotchas (full list: [docs/claude/history.md](docs/claude/history.md))
- Only `VITE_` variables reach the browser and are public; keep `.env` files out of git.
- Supabase returns at most 1,000 rows per request: read growing lists with `fetchAll()` (`src/lib/supabaseClient.ts`, query must `.order()` by something unique).
- Game content is read through `cached()` / `loadKind()` (`src/catalogue.ts`), never straight from Supabase; `invalidateCatalogues()` after writes.
- Keep routes lazy (`component: () => import(...)`), except login.
- New tables need RLS enabled plus an explicit `grant` to `authenticated`.
- Run `npm run types` after any database change.
- The hosted database needs new migrations **before** the site is pushed (list in [STATUS.md](STATUS.md) and [docs/claude/history.md](docs/claude/history.md)).
- The free tier pauses after 1 week idle (a keep-alive GitHub Action pings it). Don't charge players or add ads.

## Core design rules (full: [docs/claude/ui-principles.md](docs/claude/ui-principles.md))
- **Readability and usability come first.** Terminal styling is flavour, not structure.
- **One job per colour, never colour alone** (always a symbol or word too). Lilac = interactive only. Game meanings follow COMP/CON's conventions and colours.
- **Left-align** read text, lists, tables; **centre** showcase things (hangar mechs, stat tiles, empty states).
- **No dice:** damage is a flat number (dice mean rounded up), never labelled "average".
- A pilot's `--pilot` colour is decoration only and is always read through `displayColour()`.
- **Identity colour is equal on pilot and mech pages:** `--pilot` / `--mf` colour only the header, the section-title dashes and the stat tiles' top strip, nothing else (rule in [ui-principles.md](docs/claude/ui-principles.md)).
- Use the CSS variables in `src/style.css`, never new hex values. Phone and desktop equally.

## Site text (standardised 2026-11-19)
One wording per kind of message, short text, nothing explaining behind-the-scenes workings. Follow these for every new string. (Login, home boot text and `ThirdPartyNotice.vue` are exempt.)
- **Short and plain.** A hint is one short sentence at most; a notice is a title plus one or two short sentences. Say what the user sees or should do, never how the site stores or works it out (no packs updating, catalogues, databases, conversions, drafts' internals). No semicolons, no em-dashes, no "so that"/"which means" justifications, no hint that repeats its label. Drop a hint rather than pad it.
- **Sentence case** everywhere (CSS uppercases labels and buttons). A full sentence ends with a full stop; a label, badge, status word or blocked reason doesn't. After a colon, a full sentence starts with a capital ("Not saved: A pilot needs a name.").
- **Plurals are worked out in code**, never "(s)". Counts: `{shown} of {total}` in pickers, `{shown} of {total} pilots` in lists.
- **Status:** `Loading…` (never "Loading pilots…"), `Saving…`, `Uploading…`, `Importing…`, `Saved` (no full stop), `Not saved: {Reason.}`, likewise `Not deleted: …`, `Not removed: …`. An edit not sent yet is `Unsaved changes`. `Retry` re-sends or re-loads; `Reload` is only the conflict notice's full reload. Conflict notice: title `Not saved`, body "Someone else changed this. Reload to see their version."
- **Empty states:** `No {things} yet.` where someone is expected to add some; `No {things}.` where they're simply absent; a search miss is always `Nothing matches that search.` A missing frame is always `Choose a frame first.`
- **Badges** are the status word alone, capitalised: pilots `Draft` (not submitted yet), `Pending` (submitted), `Approved`, `Sent back`, `Dead`; changes `Draft`, `Submitted`, `Approved`, `Sent back` (a draft carrying a GM's note; the history status `rejected` is shown as `Sent back` too). The sentence beside a badge explains it. A GM **sends back** a pilot (button `Send back`) and a change (button `Send back change`, note required).
- **Blocked reasons** (beside a disabled button, no full stop): `Needs {thing}` ("Needs IPS-N Drake II", "Needs an empty mount"), `Not enough {resource}` ("Not enough manna", "Not enough system points", "Not enough mod points"), `Already on this mech` (Unique), `Fits {types} only`, `GM only`, `Fix {n} problem first` / `Fix {n} problems first`, `Save your changes first`.
- **Problems:** the word is "problem", never "rule" or "issue". Rule-check titles: `{n} problem(s)`, on your own draft `Fix {n} problem(s) before you submit`; editor: `Fix {n} problem(s) before saving`. Each line is a third-person sentence about the item, capital first, full stop ("LANTERN: Superheavy weapon needs a second empty mount."). Content that isn't loaded: `{Name} isn't in any loaded pack.` / `Unknown item ({id})`; in reminders `Missing {kind}. Its bonuses aren't counted.`
- **Confirms:** the title stays "Are you sure?". The message names the thing without quotes, says what happens in one sentence, and ends `This can't be undone.` when it can't. The confirm button is always verb + noun (`Remove licence`, `Withdraw change`, `Publish entry`, `Delete pilot`, `Mark dead` excepted as it already names the act). Danger-zone sentences use the same pattern and "This can't be undone." (never "for good").
- **Buttons** are verb + noun, except `Swap` / `Remove` on an item card's foot and `Choose` / `Add` on a picker row, where the item is right there. `Add {thing}` puts existing content on the sheet; `New {thing}` creates something; `Remove` takes it off a list; `Delete` destroys it; `Withdraw` takes back a submission; `Clear` empties a field, search or note; `Discard changes` drops unsaved edits; `Revert to original` drops campaign edits to official content; `Close` closes information, `Done` closes something you changed, `Cancel` backs out of a confirm.
- **Words:** licence, armour, biomod (never "bionic" on screen), manufacturer (not "maker" on screen), system points (not "SP" in sentences), Heat cap / Repair cap, HP, E-defence, "Owner only" / "GM only", `Unknown player` for a missing name, `None` for an optional empty select and `Choose…` for a required one. Access denied: "Only GMs can see this page." / "Only owners can see this page." Whole numbers: "{Field} must be a whole number, 0 or more." (or "from 0 to {max}"). Stat sources: `Base: {n}`, `{Source}: +{n}`, `{Source}: sets to {n}`. Editor hints: id fields "Fixed once created."; flavour fields "Flavour text."

## Priorities
No deadline. Getting the style right and making it work matter more than speed.

## Open questions
1. **Starting values** for pilot stats, and what level a new pilot starts with (manna is settled: 2000, 2026-11-21). GMs enter level by hand for now. (To be worked out later.)

## Where things are documented
Open a file only when the task touches its area.
- [docs/claude/pilots.md](docs/claude/pilots.md): pilots, tabs, who sees what, death, field list.
- [docs/claude/pilot-profile.md](docs/claude/pilot-profile.md): colour, motto, banner, gallery (live, no approval). [service-record](docs/claude/service-record.md): timeline and commendations. [id-card](docs/claude/id-card.md): ID card and Discord link previews.
- [docs/claude/stats.md](docs/claude/stats.md): pilot stats, mech stats, build effects, rules text, no dice.
- [docs/claude/levelling-and-manna.md](docs/claude/levelling-and-manna.md): levelling, manna, licences, experience, reward log. [biomods](docs/claude/biomods.md). [backstory](docs/claude/backstory.md). [reputation](docs/claude/reputation.md) (GM only).
- [docs/claude/pilot-inventory.md](docs/claude/pilot-inventory.md): pilot gear: owned and equipped, Buy item, View inventory, Variable damage types.
- [docs/claude/dossier-page.md](docs/claude/dossier-page.md): the pilot page (cover, sections, identity, editing) and [dossier-sections](docs/claude/dossier-sections.md) (stats, qualifications, rule check, bionics).
- [docs/claude/item-cards.md](docs/claude/item-cards.md): item cards, symbols, tags. [pickers-and-info](docs/claude/pickers-and-info.md): pickers, dialogs, full information.
- [docs/claude/mech-page.md](docs/claude/mech-page.md): mechs, hangar, the mech page. [mech-loadout](docs/claude/mech-loadout.md): mounts, systems, weapon mods. [images](docs/claude/images.md): uploads, frame art.
- [docs/claude/approval.md](docs/claude/approval.md): drafts, submission, GM review, approve/send back, optimistic locking, saving.
- [docs/claude/security.md](docs/claude/security.md): full roles and RLS rules, submit-time picker checks, GM-only tables.
- [docs/claude/game-data.md](docs/claude/game-data.md): game data sources and licences. [lcp-import](docs/claude/lcp-import.md). [content-editor](docs/claude/content-editor.md) and [content-editor-forms](docs/claude/content-editor-forms.md): the owner editor. [archives](docs/claude/archives.md).
- [docs/claude/ui-principles.md](docs/claude/ui-principles.md): look and feel, colour jobs, alignment. [colours-and-type](docs/claude/colours-and-type.md). [buttons-and-dialogs](docs/claude/buttons-and-dialogs.md). [layout-and-nav](docs/claude/layout-and-nav.md): top bar, routes.
- [docs/claude/pages-home-lore.md](docs/claude/pages-home-lore.md): home, lore, page list. [registry](docs/claude/registry.md). [gm-pages](docs/claude/gm-pages.md). [login-boot](docs/claude/login-boot.md).
- [docs/claude/history.md](docs/claude/history.md): hosting setup, full gotchas, completed-work log, hosted migrations, local test accounts.
- [docs/rule-decisions.md](docs/rule-decisions.md): **every game-rule decision the developer has made, dated. Check it before touching rules; add new decisions to it.** [docs/combat-handbook.md](docs/combat-handbook.md): the homebrew combat rules. [docs/lancer-rules.md](docs/lancer-rules.md): the LANCER rules the site follows. [docs/database-sketch.md](docs/database-sketch.md): the database design.
- `docs/redesign/prototype/`: the approved UI reference (open via the dev server at `/docs/redesign/prototype/index.html`).
- [STATUS.md](STATUS.md): current state, unpushed work, pending hosted migrations, next steps, and a link to every doc file.
