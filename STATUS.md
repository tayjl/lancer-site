# Status

Short handoff note. Update at the end of each feature or milestone. Finished work moves to the dated log in [docs/claude/history.md](docs/claude/history.md).

## Current state
- Vue + Vite + TypeScript app with Supabase; Discord login works; the new-pilot loop, pending changes, GM review, death and memorial, owner content page (LCP import) and content editor, archives, lore and reputation are built (check `git log` for the latest).
- The pilot page is a "dossier": one scrolling file with a cover header, numbered sections (02 to the end collapsible) and a file index ([dossier-page.md](docs/claude/dossier-page.md)). Pilot inventory, Variable damage types, full-screen dialogs on phones and the grouped Buy picker are live (log: 2026-11-20).
- Discord link previews: `/registry/<id>` runs a small Worker (`worker/`, `wrangler.jsonc` `main` and `run_worker_first`) that adds og tags for approved and dead pilots ([id-card.md](docs/claude/id-card.md)). Local test: `npm run build`, then `npx wrangler dev --local` with the git-ignored `.dev.vars`.
- Branch `main`. Pushing deploys to Cloudflare, so ask before pushing. New migrations go to the hosted project before the site is pushed.

## Latest release (pushed 2026-11-20)
- **Code cleanup (2026-11-20, `b6afba8`, no migration):** audit of the whole frontend, about 390 lines fewer across 60+ files with the same behaviour. Dead code removed (`parseEntries`, `statLine`, unused CSS variables), shared helpers instead of copies, list-pane and `.next` CSS moved to `style.css`, `FactionPane` and `CommendationPane` share `useSimpleEditor.ts`, `RadarChart` has a `wrap` prop for phone labels, the top-bar box class is now `.account`. Bugs fixed: a save that threw left buttons disabled, a thrown save blocked later saves in the pilot and profile queues, a whitespace pack source grouped wrongly in the archives, faction and commendation Enter saved with no changes, the top-bar name picked up the chat's sky colour. 341 tests, build pass; 16 page states compared before and after at 360 and 1280. **Not checked live:** the mech page, the lore list and editor with entries, faction and commendation save and delete.
- **Documentation split** (2026-11-20, `c11e8e9`): the four big docs were split into the topic files listed below.

## Pending hosted migrations
None. Everything through `20261121180000_delete_my_account` is on the hosted project (applied 2026-11-21). The full list is in [docs/claude/history.md](docs/claude/history.md).

## Next steps
- Combat guide (2026-11-22, unpushed): a Mech / Pilot switch (`?mode=pilot`) and chips on Your kit and Actions that open the full text in the info popup. Lookup tabs lost their gist line (the turn summary keeps it). Needs a phone check, and the developer's say on the pilot action set.
- Combat page rebuild (2026-11-22, unpushed, no DB change so no hosted migration): now one page with a turn strip and folding sections. The Posting tab and the tabs are gone. Next: the owner checks it live on phone and desktop.
- Combat tags and statuses (2026-11-22, unpushed): section 02 is now neutral chip cards that open popups, like Rules (Mech: 2 + 3 cards, Pilot: 2 x 2). Not yet checked in a browser.
- Combat page round 2 (2026-11-22, unpushed, no DB change so no hosted migration): connected turn bar, badge-free light chips with the action word in the card header, Overcharge as heat numbers, Rules as four cards of topic chips that open popups. Next: the owner checks it live on phone and desktop.
- Editable base actions and tags (2026-11-22, pushed): new Actions kind in the content editor (`ActionForm.vue`, seed and fallback in `src/baseActions.ts`), the combat guide reads actions and the Tags card from the editor. Hosted migration `20261122100000_import_lcp_actions.sql` applied before the push. **Next: the owner presses 'Update core content' once on the content page** (adds the actions, keeps edits). Checked in the browser locally at 320, 360 and 1280. Not checked: a reworded or hidden action in Pilot mode, the tag form's 'Rules text' label, a frame on the combat page. Local `content_editor.test.sql` fails on leftover homebrew items in the local DB (not this change).
- Combat page sweep (2026-11-22, pushed, no DB change so no hosted migration): Fight is Quick too with a Sidearm weapon, Prepare (mech only), pilot Overwatch (any pilot weapon), Jockey pilot only, Overcharge gear in the Overcharge step, unknown activation words fall back to Free, Core power as a Rules topic, Tags card in pilot mode, more tags listed, reaction expiry and Quick/Full Tech notes, pilot gear limits. Core seed carries campaign wording for Overkill and Knockback. **Next: the owner presses 'Update core content' on the content page** (hosted pack is 'LANCER Core', 440 items; check the preview counts first). Not checked live: the seeding itself, Fight Quick with a Sidearm, Overcharge gear, Prepare. Dice wording still in official text (Reliable, Recharge tags, a few weapons, many systems and talents) waits for the developer. Follow-up (same day): kit tech actions (a system's or gear's Quick Tech, Full Tech, Invade) now sit in the Tech card instead of Your kit. Open question for the developer: how a pilot's own tech attack works (what it compares against, which stat); not yet written in docs/rule-decisions.md.
- Rules editor (2026-11-22, pushed): one 'Rules' tab in the content editor holds every combat rule, the tags and actions (still their own kinds), and the balance numbers. New kind 'rules' (`src/rulesData.ts` seed and fallback, `RuleForm.vue`, `ruleList.ts`). Combat and mech pages read the rows. Balance numbers (starting manna, prices, rank caps, mod points, skill points, personal stat limits, loadout slots) are `rule_num_<key>` rows read by the database through `public.rule_number()` and by the site through `rule()`. **Two hosted migrations, applied before the push:** `20261122110000_import_lcp_rules.sql`, `20261122120000_editable_rule_numbers.sql`. Then the owner presses 'Update core content'. Security audit: no break found, three low findings (re-import bumps updated_at and blocks approvals once, a transaction-start race, deleted rows not seen as stale). Known gaps: loadout slot counts do not change the free starting gear (database `settle_pilot_gear` is fixed), MAX_SKILL and the RequirementListField ranks are still hardcoded, pilot mode on /combat and the phone Preview tab were not browser-tested. Final UX check: no critical issues. Open polish: the content editor header shows 'Owner only' / import actions to non-owners above the access notice, tab counts read 0 for about 2.5s while loading, Discard is disabled on an untouched new rule, 'Made from the name.' hint shows on Tags card rules, Repair cost shows 'Add number', number boxes stack one per line at 320.
- Combat kit clarity (2026-11-22, unpushed): the Frame card groups its chips (Traits, Core system, Core power, Overcharge), kit chips carry an activation tag, and core powers in turn steps read "Core power {name}". Not checked in a browser.
- Combat weapons by mount (2026-11-22, unpushed): Your kit is Frame, then Weapons with a labelled column per mount, then Systems, Talents and Core bonuses in one row of three (Pilot gear is now Pilot mode only, a full-width card grouped Armour, Weapons, Gear, with Talents below). Pilot gear with real gear not yet seen in a browser.
- Combat pilot gear (2026-11-22, unpushed): Pilot mode has a full-width Pilot gear card (Armour, Weapons, Gear side by side) then Talents. Mech mode drops pilot gear and ends with Systems, Talents, Core bonuses in one row of three. Not checked in a browser.
- Untested: the mech page, pilots with long names, Firefox (no `field-sizing` for the centred callsign field), the phone dialogs on a real phone.
- After the first deploy with the Worker: paste an approved pilot's link in Discord to check the preview (a card picture appears once the owner or a GM has opened that pilot's page).
- Local test data: `testy` (1021) has a Medium Signature in its draft change (swapped in by hand for testing).
- Live pilots who already own a Signature weapon show "needs a damage type" until they choose one through a change (the developer decided to leave this, 2026-11-20).
- Open question: starting values for pilot stats and a new pilot's starting level.

## Documentation
Every doc file, by topic. Open one only when the task touches its area.

### Rules and design
- [CLAUDE.md](CLAUDE.md): the project rules, roles and security rules every session follows.
- [README.md](README.md): running the site locally, credits and licences.
- [docs/lancer-rules.md](docs/lancer-rules.md): the LANCER rules the site follows and how each is enforced.
- [docs/database-sketch.md](docs/database-sketch.md): the original database design, plus what was built since.
### Pilots
- [docs/claude/pilots.md](docs/claude/pilots.md): the three tabs, who sees what, death, field list.
- [docs/claude/pilot-profile.md](docs/claude/pilot-profile.md): colour, motto, banner and gallery (saved live).
- [docs/claude/service-record.md](docs/claude/service-record.md): the service record timeline and commendations.
- [docs/claude/id-card.md](docs/claude/id-card.md): the Union ID card, PNG download and Discord link previews.
- [docs/claude/stats.md](docs/claude/stats.md): pilot stats, mech stats, build effects, rules text, no dice.
- [docs/claude/levelling-and-manna.md](docs/claude/levelling-and-manna.md): levelling, manna, licences, core bonuses, experience, reward log.
- [docs/claude/biomods.md](docs/claude/biomods.md): biomods (bionics).
- [docs/claude/backstory.md](docs/claude/backstory.md): the private or public backstory.
- [docs/claude/reputation.md](docs/claude/reputation.md): GM-only reputation and factions.
- [docs/claude/pilot-inventory.md](docs/claude/pilot-inventory.md): pilot gear, Buy item, View inventory, Variable damage types.
### Pilot and mech pages
- [docs/claude/dossier-page.md](docs/claude/dossier-page.md): the pilot page: cover, sections, identity, editing, shared pieces.
- [docs/claude/dossier-sections.md](docs/claude/dossier-sections.md): capabilities, qualifications, rule check, bionics.
- [docs/claude/item-cards.md](docs/claude/item-cards.md): item cards, symbols, tag names.
- [docs/claude/pickers-and-info.md](docs/claude/pickers-and-info.md): pickers, dialogs, full information, frame pickers.
- [docs/claude/mech-page.md](docs/claude/mech-page.md): mechs, hangar and the mech page.
- [docs/claude/mech-loadout.md](docs/claude/mech-loadout.md): the mech loadout and weapon mods.
- [docs/claude/images.md](docs/claude/images.md): portraits, mech images, uploads, bundled frame art.
### Approval and security
- [docs/claude/approval.md](docs/claude/approval.md): drafts, submission, GM review, saving, optimistic locking.
- [docs/claude/security.md](docs/claude/security.md): roles, RLS rules, submit-time checks, GM-only tables.
### Game content
- [docs/claude/game-data.md](docs/claude/game-data.md): game data sources, licences, storage decisions.
- [docs/claude/lcp-import.md](docs/claude/lcp-import.md): LCP import and the owner content page.
- [docs/claude/content-editor.md](docs/claude/content-editor.md): the owner content editor and how it saves.
- [docs/claude/content-editor-forms.md](docs/claude/content-editor-forms.md): the editor forms per content kind, export.
- [docs/claude/archives.md](docs/claude/archives.md): the archives page.
### Look and feel and pages
- [docs/claude/ui-principles.md](docs/claude/ui-principles.md): redesign direction, colour jobs, alignment, density.
- [docs/claude/colours-and-type.md](docs/claude/colours-and-type.md): the terminal look, colour variables, fonts, sharp text.
- [docs/claude/buttons-and-dialogs.md](docs/claude/buttons-and-dialogs.md): shared CSS pieces, buttons, the Are you sure? dialog.
- [docs/claude/layout-and-nav.md](docs/claude/layout-and-nav.md): app layout, top bar, routes, breadcrumbs.
- [docs/claude/pages-home-lore.md](docs/claude/pages-home-lore.md): home, my pilot, pending, memorial, lore, GM page list.
- [docs/claude/registry.md](docs/claude/registry.md): the registry, pilot cards, opening a record, GM edit mode.
- [docs/claude/gm-pages.md](docs/claude/gm-pages.md): gm: pilots, GM review and controls, danger zone, death.
- [docs/claude/login-boot.md](docs/claude/login-boot.md): the login boot scrawl.
### History and references
- [docs/claude/history.md](docs/claude/history.md): hosting setup, gotchas, local test accounts, completed-work log, hosted migrations.
- [docs/archive/copy/text-audit.md](docs/archive/copy/text-audit.md) and [docs/archive/copy/changes.md](docs/archive/copy/changes.md): the site text audit and its changes.
- [docs/redesign/prototype/index.html](docs/redesign/prototype/index.html): the approved UI reference (open via the dev server at `/docs/redesign/prototype/index.html`). Mockups: [dossier](docs/redesign/dossier/index.html) (pilot page), [editor](docs/redesign/editor/index.html) (content editor), [lore](docs/redesign/lore/index.html).
