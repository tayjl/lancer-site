# Status

Short handoff note. Update at the end of each feature or milestone. Finished work moves to the dated log in [docs/history.md](docs/history.md).

## Current state
- **Content editor cleanup steps 2 and 3 are pushed and live** (`origin/main` `c7ff4b7`, 2026-11-25). Step 3 (handoff 0.2, remove data duplication) is done, with migration `20261125100000_content_cleanup_3b` applied to hosted first. Step 4a (handoff 0.3, status groups as Definitions and damage type guide text) is done, uncommitted. Next is 4b, then 4c; resume from [docs/content-editor-handoff.md](docs/content-editor-handoff.md#03-statuses-conditions-and-the-remaining-definitions).
- Vue + Vite + TypeScript app with Supabase; Discord login works; the new-pilot loop, pending changes, GM review, death and memorial, owner content page (LCP import) and content editor, archives, lore and reputation are built (check `git log` for the latest).
- The pilot page is a "dossier": one scrolling file with a cover header, numbered sections (02 to the end collapsible) and a file index ([pilot-and-mech-pages.md](docs/pilot-and-mech-pages.md#pilot-page-dossier)). Pilot inventory, Variable damage types, full-screen dialogs on phones and the grouped Buy picker are live (log: 2026-11-20).
- Discord link previews: `/registry/<id>` runs a small Worker (`worker/`, `wrangler.jsonc` `main` and `run_worker_first`) that adds og tags for approved and dead pilots ([pilots.md](docs/pilots.md#id-cards-and-link-previews)). Local test: `npm run build`, then `npx wrangler dev --local` with the git-ignored `.dev.vars`.
- Branch `main`. Pushing deploys to Cloudflare, so ask before pushing. New migrations go to the hosted project before the site is pushed.

## Unpushed work
- **Step 4a is uncommitted** (not committed, not pushed). Code: status groups are a Definitions kind (`status_groups`), damage type guide text is `damage_types` `data.text`, and `STATUS_CARDS`, `STATUS_GROUPS`, `DAMAGE_TYPES`, `ON_FOOT_ROWS` are removed. Migration `20261125110000_content_cleanup_4a.sql` exists locally only. Checks: `npm test` 555 pass, `npm run build` ok, `npx supabase test db` 33 files 1037 tests pass, reviewer no blocking issues, browser (360 and 1280) pass.
- Steps 2 and 3 are pushed (`origin/main` `c7ff4b7`).

## Latest release
Pushed 2026-11-25 (`c7ff4b7`): content editor cleanup steps 2 and 3 (commits `1f028ba`, `e899ecf`, `b0e4bf9`, `c7ff4b7`). Migration `20261125100000_content_cleanup_3b` was applied to hosted first. The 2026-11-24 release is in [docs/history.md](docs/history.md). What is left is in [docs/content-editor-handoff.md](docs/content-editor-handoff.md).

## Pending hosted migrations
- `20261125110000_content_cleanup_4a` (local only, not applied). Before applying, run `select distinct data->>'group' from content_items where kind='rules' and data->>'section'='statuses'`. Every value must be `cover`, `conditions`, `other` or `pilot`, or that status vanishes from the combat page. Then apply and read the NOTICEs (owner text on the four deleted rule rows is copied into the damage type).
- Everything through `20261125100000_content_cleanup_3b` is on the hosted project (applied 2026-11-25, before the push). The full list is in [docs/history.md](docs/history.md).

## Next steps
1. **Check live:** the combat page after step 3 (not browser-checked since 0.2), then the 2026-11-24 deploy checks below. Also check whether 3b touched owner-edited rows: the CLI printed no NOTICE, so look at hosted `content_items` rows with an `edited` value.
2. **Step 4a, then commit and push** (ask first). Apply the 4a migration to hosted before the push (pre-apply check above).
3. **Step 4b** (mount flags, `DATA_ONLY_MOUNTS`, `DATA_ONLY_WEAPON_TYPES`, unused `weapon_mounts`), then **4c** (`PILOT_TYPES` vs `gear_types`, `HIDDEN_TAGS` as a tag flag, pilot gear group titles, Armor/Armour label). Handoff 0.3 has the open list.
- **Open for the developer:** nothing from step 3. The 4a open list (editor button sizes, unlinked hint, and others) is in [docs/content-editor-handoff.md](docs/content-editor-handoff.md) 0.3. Faction and commendation delete (blocked while in use) and pack imports (no `content_saves` stamp) are decided in [docs/rule-decisions.md](docs/rule-decisions.md) (2026-11-25).
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
