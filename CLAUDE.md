# LANCER Campaign Site

## What this is
Character tracker for one big homebrew LANCER campaign run on Discord (few GMs, many players). Not a VTT.
- Players build and edit their pilot; edits become **pending changes** a GM approves or sends back. GMs can also own pilots.
- **Scope (2026-10-29): character management only**: submission → approval and change → approval, easy manna spending, easy GM levelling, LCP import and owner content editor. Also: archives, lore, pithub (hidden lore), combat guide (rules reference, no board), reputation (GM only). Clear and simple over stylised. No deadline: quality over speed.

## Working with me
- Write code directly when I ask for work. Explain or mentor only when I ask.
- Code goals: efficient, minimal, readable. Smallest complete change: reuse what exists, no abstractions, options or "for later" code nobody asked for. Deletion beats addition. Comment only the why.
- Replies: short and plain. End with what you skipped or didn't check.
- When I ask for work: main Claude plans, briefs and reviews; a custom subagent builds. Small edits stay in the main session.

## Subagent orchestration
- Custom agents in `~/.claude/agents/` only (never Explore/Plan/general-purpose when one fits). Don't pass `model`/`effort`. Routing: explorer (find), database-architect (migrations/RLS/types), ts-developer (logic + tests), ui-designer (new features or major redesigns only), ui-implementer (build UI), security-auditor (after DB/auth/RLS), ux-reviewer (after UI). Fallback: general-purpose with `model: sonnet`.
- **opusplan**: Opus plans, Sonnet executes. Don't change model or effort otherwise mid-session (breaks the cache).
- **Vague prompts:** run explorer first (subagents can't launch subagents), ask 1-2 questions if ambiguous, write a concrete plan, then delegate.
- **No duplicated design:** the plan is feature/architecture level. Don't write a UI spec if ui-designer will. Small UI tweak: skip ui-designer, give ui-implementer a 2-sentence brief.
- **Order:** database-architect, ts-developer and ui-implementer in parallel when files don't overlap. Then security-auditor after any DB/auth/RLS change, ux-reviewer after any UI change. Reviewers own verification.
- **Handoff:** self-contained brief: exact paths, explorer findings (file:line), scratchpad path, dev server URL. One batched brief per agent. Never paste chat history.
- One brief = one reviewable step (aim under ~100 turns). Split big phases into agents run one after another, each starting fresh from the files.
- Smallest complete diff, reuse existing code. Run commands quietly (`| tail -n 30` / `| Select-Object -Last 30`).
- End of a feature: update [STATUS.md](STATUS.md) (state, unpushed work, hosted migrations, next steps).

## Stack and commands
- Vue + Vite + TypeScript. Supabase (free tier: DB, Discord login, RLS). Cloudflare Worker serves static files, deployed on every push to GitHub (`wrangler.jsonc`, `worker/` for link previews). Domain `hor-os.party`.
- **No backend API:** the app calls Supabase via `supabase-js`. All-or-nothing actions are SQL functions via `supabase.rpc()`.
- `npm run dev` (5173) · `npm run local` (Docker + local DB + dev on 5174) · `npm test` · `npm run build` (also the typecheck) · `npm run types` after any DB change · `npx supabase migration up` · `npx supabase test db`.
- **Pushing = going live: ask first.** New migrations go to the hosted DB **before** pushing (list in STATUS.md).

## Roles
- One campaign, no campaigns table. Discord login only, anyone can sign up as a player; GM/owner set by hand in the dashboard. A `profiles` row holds name and role.
- **Player:** own pilot via pending changes; **one living pilot**, enforced in the DB (insert policy + per-player lock trigger).
- **GM:** everything except LCP content; edits any pilot directly, approves/sends back, may own several pilots; can't delete pilots.
- **Owner:** GM + LCP content + deleting pilots.

## Security (non-negotiable; detail in docs/claude/security.md)
- Players never update `characters` directly, only add pending changes for their own. Players can't change their own role.
- RLS is per row: private data (backstory, manna, review notes, reputation, experience) lives in separate tables or behind `security definer` functions.
- Every `.update()`/`.upsert()`/`.delete()` ends in `.select()` and goes through `checkWrite()` (RLS refusals return 0 rows, no error).
- New tables: RLS on + explicit `grant` to `authenticated`. `service_role` key never in frontend or git; only `VITE_` vars reach the browser.
- Test rules by breaking them as a player (`npx supabase test db`).

## Code gotchas (full list: docs/claude/history.md)
- Max 1,000 rows per request: growing lists use `fetchAll()` (`src/lib/supabaseClient.ts`, ordered by a unique column).
- Game content goes through `cached()` / `loadKind()` (`src/catalogue.ts`), never straight from Supabase. `invalidateCatalogues()` after writes.
- Routes are lazy (`() => import(...)`) except login.
- Free tier pauses after a week idle (keep-alive Action). No charging players, no ads.

## Design rules (full: docs/claude/ui-principles.md; reference: `/docs/redesign/prototype/index.html`)
- Readability first; terminal styling is flavour. Phone and desktop equally. CSS variables from `src/style.css` only, no new hex.
- One job per colour, never colour alone. Lilac = interactive only. Game meanings follow COMP/CON.
- Left-align read text, lists and tables; centre showcase items (hangar mechs, stat tiles, empty states).
- No dice: flat damage (dice rounded up), never "average", never "roll" ("compare with" / "check against").
- `--pilot` is decoration only, read through `displayColour()`. `--pilot`/`--mf` colour only the header, section-title dashes and stat-tile top strip.
- **Site text:** sentence case, short and plain, no semicolons or em-dashes, never explain internals. Full rules load from `.claude/rules/site-text.md` when editing `src/`.

## Docs
- Every doc file is indexed in STATUS.md → Documentation. Open one only when the task touches it.
- **Game rules: check docs/rule-decisions.md first and add new decisions to it.** Homebrew combat: docs/combat-handbook.md. Base rules: docs/lancer-rules.md.
