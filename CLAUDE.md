# LANCER Campaign Site

## What this is
A small website for a LANCER (tabletop RPG) campaign.
- **Players** create and manage their LANCER characters.
- Player edits don't go live straight away. They become **pending changes**.
- **GMs** see a list of characters and pending changes, can edit characters, and approve or reject changes.

## How to work with me (the developer)
- I'm a junior developer. Act as a senior developer mentoring me.
- **Don't write code or do the work for me unless I explicitly ask.** Explain, review, and point me in the right direction instead.
- Explain things in plain English. Avoid jargon, or explain any term I'm unlikely to have met before.

## Tech stack (decided)
- **Frontend:** Vue + Vite (I already know Vue). JavaScript. TypeScript was suggested as an option but hasn't been decided.
- **Database, logins and security rules:** Supabase (free tier).
- **Hosting:** Vercel (free Hobby plan).
- **No custom backend API.** The Vue app talks straight to Supabase using `supabase-js`. Keep it simple.

## How the pieces fit
- The browser (Vue app hosted on Vercel) talks to Supabase. There's nothing in between.
- Security is enforced **in the database** with Row Level Security (RLS), never only in the frontend code, because anyone can tamper with code running in their browser.
- The one exception to "no backend": small **database functions inside Supabase** (written in SQL) for actions that must happen all-or-nothing, such as approving a change. Vue calls them with `supabase.rpc()`. They're not a server, and there should only be one or two.

## Pending approval workflow (decided: option 2)
- The approved character stays **untouched** while a change is pending.
- Proposed changes are stored **separately** (a pending-changes table) until a GM approves or rejects them.
- Players keep a usable sheet while they wait, and the GM can see exactly what changed.
- Approving means (1) applying the change to the character and (2) marking the pending change as approved or removing it. Both must happen in **one database function** (all-or-nothing), so a failed request can't leave half-applied data.

## Security rules (critical)
- **Players must NOT be able to update the characters table directly.** They can only add pending changes for their own characters. Otherwise anyone could skip GM approval using browser developer tools.
- Only GMs (or the approval function) can change approved characters.
- Players can only see and edit their own things. GMs can see everything in their campaign.
- Test the rules by trying to break them while logged in as a player.
- Supabase has two keys. The **public** one ("anon" or "publishable") is safe in the browser. The **secret** one ("service_role" or "secret") bypasses every rule. It must never go in the frontend or be committed to git.

## Gotchas
- **Vite environment variables:** only variables starting with `VITE_` reach the browser, and those are public. Only the public Supabase key goes in a `VITE_` variable. Keep `.env` files out of git.
- **Vercel + Vue Router:** with clean URLs like `/characters/42`, refreshing the page can show a 404. Vercel needs a rewrite (in `vercel.json`) that sends every path to `index.html`.
- **Supabase free tier pauses projects after 1 week of inactivity.** No data is lost, and you restore it from the dashboard. Expect this during campaign breaks. Limits: 2 active free projects and a 500 MB database, which is plenty for this.
- **Vercel Hobby is for non-commercial use only.** Don't charge players or add ads.

## LANCER game data
- Don't hand-type frames, weapons and talents. I want to use **Massif Press's own GitHub repositories** (https://github.com/massif-press):
  - **Core data:** `lancer-data` (https://github.com/massif-press/lancer-data), also on npm as `@massif/lancer-data`. Its wiki documents the JSON format.
  - **Expansion data**, such as Long Rim. The exact repo names are on the Massif Press GitHub page.
  - **LCP editors:** `cc-lcp-editor` (a tool for making LCPs) and `vscode-comp-con-content-authoring` (a VS Code extension that checks LCP data is formatted correctly).
- Check each repo's licence before using its data.
- **Decided: characters store item IDs, not copies of items.** A character saves the ID of each frame, weapon, talent and so on (the IDs used in `lancer-data` and LCPs), and the site looks up names and stats from the game data when showing the sheet. Don't copy names or stats into the character. This keeps LCP import possible later and means rules fixes in the data show up automatically.
- Character sheets are deeply nested (pilot, then mechs, then loadouts, then mounts). Consider storing the sheet as a JSON column (`jsonb`) rather than splitting it across many tables. Not decided yet.
- COMP/CON (the official LANCER companion app) is built with Vue, so it's a useful reference for how to structure characters. It's GPL licensed, though: read it for ideas, but don't copy code wholesale.

## .LCP file import (wanted eventually, not yet)
- I want the option to import `.lcp` files (Lancer Content Packages) eventually, so the campaign can use expansions and homebrew content.
- An `.lcp` file is just a renamed `.zip` of JSON files, in the same format as `lancer-data`. It must contain an `lcp_manifest.json` at the top level, and subfolders are ignored.
- Things to plan for:
  - COMP/CON-style data refers to items by **ID**. If an LCP's data goes missing, any character using its items breaks. So imported LCP data needs to be **kept** (e.g. stored in Supabase), not just read once.
  - Unzipping can happen in the browser, so this still doesn't need a backend.
  - Still to decide: who can import LCPs (GMs only? per campaign?).
- This is why characters store item IDs (see "LANCER game data" above).

## Ideas (not decided)
- "Log in with Discord" via Supabase Auth, since most LANCER groups already use Discord.

## Current status and next step
- No app code yet.
- Next: sketch the tables (e.g. users, campaigns, characters, pending changes) and write down who can see or edit what for each role (player, GM). Review that sketch before building anything.
