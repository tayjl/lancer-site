# Status

Short handoff note. Update at the end of each feature or milestone. Finished work moves to the dated log in [docs/history.md](docs/history.md).

## Current state
- Vue + Vite + TypeScript app with Supabase; Discord login works; the new-pilot loop, pending changes, GM review, death and memorial, owner content page (LCP import) and content editor, archives, lore and reputation are built (check `git log` for the latest).
- The pilot page is a "dossier": one scrolling file with a cover header, numbered sections (02 to the end collapsible) and a file index ([pilot-and-mech-pages.md](docs/pilot-and-mech-pages.md#pilot-page-dossier)). Pilot inventory, Variable damage types, full-screen dialogs on phones and the grouped Buy picker are live (log: 2026-11-20).
- Discord link previews: `/registry/<id>` runs a small Worker (`worker/`, `wrangler.jsonc` `main` and `run_worker_first`) that adds og tags for approved and dead pilots ([pilots.md](docs/pilots.md#id-cards-and-link-previews)). Local test: `npm run build`, then `npx wrangler dev --local` with the git-ignored `.dev.vars`.
- Branch `main`. Pushing deploys to Cloudflare, so ask before pushing. New migrations go to the hosted project before the site is pushed.

## Latest release
Pushed 2026-11-24 (`e92c73f`): the content editor cleanup (database is the only copy of rules, actions and numbers; Definitions tab; tab groups; effect registry; Hidden from players on every kind; Saved by; actions and rules in LCP packs). Its four migrations were applied to hosted before the push. Details in the completed-work log in [docs/history.md](docs/history.md); what is left in [docs/content-editor-handoff.md](docs/content-editor-handoff.md).

## Pending hosted migrations
None. Everything through `20261124130000_hidden_and_last_save` is on the hosted project (applied 2026-11-24). The full list is in [docs/history.md](docs/history.md).

## Next steps
- **Check live first (2026-11-24 deploy):** the combat page (Tags card lists 35 tags, no raw `{...}` text, Overcharge and Reaction read once), the content editor as owner (tab groups, Definitions, Hidden from players, Saved by), a player login (hidden items gone from pickers, owned items still show). The checklist is in [docs/content-editor-handoff.md](docs/content-editor-handoff.md).
- **Check live, not browser-tested yet:** the combat page on phone and desktop in both modes (Pilot mode with real gear, Fight as Quick with a Sidearm, Overcharge gear, Prepare, the phone Preview tab), a reworded or hidden action in Pilot mode, the seeding itself.
- **Check live after the 2026-11-22 usability pass:** a plain player login, the GM pilots row cards with real rows, the GM change page on phone, 320px. Known gaps: the archives header count wraps to its own line on phone, the content pack table clips a cell inside its scroll, the GM pilots cards drop table semantics for screen readers, the GM changes queue loads every pending sheet (fine now, grows with the queue), item and tab names under 44px elsewhere were not swept.
- **Rules editor polish:** Low audit findings: a re-import bumps updated_at and blocks approvals once, a transaction-start race, deleted rows are not seen as stale.
- **Known gaps:** loadout slot counts do not change the free starting gear (`settle_pilot_gear` is fixed), MAX_SKILL and the RequirementListField ranks are hardcoded.
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
