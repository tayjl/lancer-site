# Status

Short handoff note. Update at the end of each feature or milestone. Finished work moves to the dated log in [docs/history.md](docs/history.md).

## Current state
- **Content editor cleanup steps 2, 3, 4a, 4b and 4c are pushed** (`origin/main` `5f3f1ef`, 2026-11-25; Cloudflare deploy not yet confirmed). **Batch built, not pushed:** handoff steps 2 to 8 and 12, the 4b browser check (pass) and the 0.3 close-out. Its four migrations go to hosted first, then the batch is committed and pushed together (ask first). Resume from [docs/content-editor-handoff.md](docs/content-editor-handoff.md#next-session-start-here).
- Vue + Vite + TypeScript app with Supabase; Discord login works; the new-pilot loop, pending changes, GM review, death and memorial, owner content page (LCP import) and content editor, archives, lore and reputation are built (check `git log` for the latest).
- The pilot page is a "dossier": one scrolling file with a cover header, numbered sections (02 to the end collapsible) and a file index ([pilot-and-mech-pages.md](docs/pilot-and-mech-pages.md#pilot-page-dossier)). Pilot inventory, Variable damage types, full-screen dialogs on phones and the grouped Buy picker are live (log: 2026-11-20).
- Discord link previews: `/registry/<id>` runs a small Worker (`worker/`, `wrangler.jsonc` `main` and `run_worker_first`) that adds og tags for approved and dead pilots ([pilots.md](docs/pilots.md#id-cards-and-link-previews)). Local test: `npm run build`, then `npx wrangler dev --local` with the git-ignored `.dev.vars`.
- Branch `main`. Pushing deploys to Cloudflare, so ask before pushing. New migrations go to the hosted project before the site is pushed.

## Unpushed work
- Batch 2026-11-25 (handoff steps 2 to 8 and 12, 4b check, 0.3 close-out): built and checked locally (`npm test` 570, `npx supabase test db` 1090, build clean), uncommitted. Details: [handoff, 0.3 batch block](docs/content-editor-handoff.md#03-statuses-conditions-and-the-remaining-definitions).

## Latest release
Pushed 2026-11-25 (`origin/main` `5f3f1ef`): content editor cleanup step 4c (`5f3f1ef`; migration `20261125130000_content_cleanup_4c` applied to hosted before the push). Before it, step 4b (code `f7207ff`, docs `a8fc866`, migration `20261125120000_content_cleanup_4b`). Step 4a (code `17f91be`, docs `6f35d38`, migration `20261125110000_content_cleanup_4a`). Earlier, steps 2 and 3 (`c7ff4b7`, migration `20261125100000_content_cleanup_3b`). The 2026-11-24 release is in [docs/history.md](docs/history.md). What is left is in [docs/content-editor-handoff.md](docs/content-editor-handoff.md).

## Not yet on hosted
- Apply in this order, then push the batch together: `20261125140000_biomod_delete`, `20261125150000_block_used_delete`, `20261125160000_pack_imports_dont_stamp`, `20261125170000_biomod_actions_effects` (`npx supabase migration up --remote --yes`).
- **Deploy window:** after `170000` and before the Cloudflare build finishes, live biomod bonuses count twice and owner biomod saves fail. Migrate and push back to back. Back up hosted `bionics` and `bionic_bonuses` first.
- Everything through `20261125130000_content_cleanup_4c` is on the hosted project (4c applied 2026-11-25, before the push). The full list is in [docs/history.md](docs/history.md).

## Next steps
1. **Check live:** confirm the Cloudflare deploy of `5f3f1ef`, then of the batch push. After the batch: biomod bonuses count once and an owner can save a biomod. Then the combat page after step 3 (not browser-checked since 0.2), then the 2026-11-24 deploy checks below. Also check whether 3b touched owner-edited rows: the CLI printed no NOTICE, so look at hosted `content_items` rows with an `edited` value.
2. **Content editor cleanup, in order:** step 9 (drop `bionic_bonuses`, only after step 8 is live and checked), step 10 (commendation requirements, high risk), step 11 (grants on mods and pilot gear, big SQL function), step 13 (0.7 audit and browser jobs). Then the developer questions. Resume list: [handoff, Next session: start here](docs/content-editor-handoff.md#next-session-start-here).
- **Open for the developer:** nothing from step 3. The 4a open list (editor button sizes, unlinked hint, and others) is in [docs/content-editor-handoff.md](docs/content-editor-handoff.md) 0.3. Faction and commendation delete (blocked while in use) and pack imports (no `content_saves` stamp) are built in the batch ([docs/rule-decisions.md](docs/rule-decisions.md), 2026-11-25). Still open for the developer: granting pilot gear, talent ranks or licences; export and import for Definitions, factions, commendations and biomods.
- **Check live first (2026-11-24 deploy, postponed 2026-11-25):** the combat page (Tags card lists 35 tags, no raw `{...}` text, Overcharge and Reaction read once), the content editor as owner (tab groups, Definitions, Hidden from players, Saved by), a player login (hidden items gone from pickers, owned items still show). The checklist is in [docs/content-editor-handoff.md](docs/content-editor-handoff.md).

- **Check live, not browser-tested yet:** the combat page on phone and desktop in both modes (Pilot mode with real gear, Fight as Quick with a Sidearm, Overcharge gear, Prepare, the phone Preview tab), a reworded or hidden action in Pilot mode, the seeding itself.
- **Check live after the 2026-11-22 usability pass:** a plain player login, the GM pilots row cards with real rows, the GM change page on phone, 320px. Known gaps: the archives header count wraps to its own line on phone, the content pack table clips a cell inside its scroll, the GM pilots cards drop table semantics for screen readers, the GM changes queue loads every pending sheet (fine now, grows with the queue), item and tab names under 44px elsewhere were not swept.
- **Rules editor polish:** Low audit findings: a re-import bumps updated_at and blocks approvals once, a transaction-start race, deleted rows are not seen as stale.
- **Known gaps:** MAX_SKILL and the RequirementListField ranks are hardcoded.
- **Waiting for the developer:** the pilot action set, how a pilot's own tech attack works (what it compares against, which stat; not yet in docs/rule-decisions.md), dice wording still in official text (Reliable, Recharge tags, a few weapons, many systems and talents), starting values for pilot stats and a new pilot's starting level.
- Untested: the mech page, pilots with long names, Firefox (no `field-sizing` for the centred callsign field), the phone dialogs on a real phone.
- After the first deploy with the Worker: paste an approved pilot's link in Discord to check the preview (a card picture appears once the owner or a GM has opened that pilot's page).
- Local test data: `testy` (1021) has a Medium Signature in its draft change (swapped in by hand for testing).
- Live pilots who already own a Signature weapon show "needs a damage type" until they choose one through a change (the developer decided to leave this, 2026-11-20).

## Documentation
Every doc file, by topic. Open one only when the task touches its area.

### Rules and design
- [.hermes.md](.hermes.md): the project rules, roles and security rules every session follows.
- [README.md](README.md): running the site locally, credits and licences.
- [docs/testing-locally.md](docs/testing-locally.md): start the local site and sign in with the seed accounts.
- [docs/lancer-rules.md](docs/lancer-rules.md): the LANCER rules the site follows and how each is enforced.
- [docs/rule-decisions.md](docs/rule-decisions.md): the developer's rule decisions. Check it first for any game rule.
- [docs/combat-handbook.md](docs/combat-handbook.md): the homebrew combat rules the combat page follows.
- [docs/site-text.md](docs/site-text.md): the wording rules for every site string.
- [docs/database-sketch.md](docs/database-sketch.md): the original database design, plus what was built since.
### Topic docs
- [docs/pilots.md](docs/pilots.md): pilot basics, profile, service record, ID cards and link previews, stats, levelling and manna, biomods, backstory, reputation, inventory.
- [docs/pilot-and-mech-pages.md](docs/pilot-and-mech-pages.md): the pilot page (dossier), item cards, pickers, the mech page and loadout, images.
- [docs/approval-and-security.md](docs/approval-and-security.md): drafts, submission, GM review, saving, roles, RLS rules, GM-only tables.
- [docs/game-content.md](docs/game-content.md): game data, LCP import, the owner content editor and its forms, archives.
- [docs/content-editor-cleanup.md](docs/content-editor-cleanup.md): plan to clean up the content editor (duplicates, tabs, gaps). Phases 0 to 7 built 2026-11-24.
- [docs/content-editor-handoff.md](docs/content-editor-handoff.md): what the cleanup left undone, unchecked or unreviewed. Read before pushing.
- [docs/look-and-feel.md](docs/look-and-feel.md): redesign direction, colours and type, buttons and dialogs, layout and navigation.
- [docs/pages.md](docs/pages.md): home, pilot lists, lore, registry, GM pages, login boot.
### History and references
- [docs/history.md](docs/history.md): hosting setup, gotchas, local test accounts, completed-work log, hosted migrations.
- [docs/archive/copy/text-audit.md](docs/archive/copy/text-audit.md) and [docs/archive/copy/changes.md](docs/archive/copy/changes.md): the site text audit and its changes.
- [docs/redesign/prototype/index.html](docs/redesign/prototype/index.html): the approved UI reference (open via the dev server at `/docs/redesign/prototype/index.html`). Mockups: [dossier](docs/redesign/dossier/index.html) (pilot page), [editor](docs/redesign/editor/index.html) (content editor), [lore](docs/redesign/lore/index.html).
