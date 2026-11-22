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
None. Everything through `20261121180000_delete_my_account` is on the hosted project (applied 2026-11-21). The full list is in [docs/claude/history.md](docs/claude/history.md). The full list is in [docs/claude/history.md](docs/claude/history.md).

## Next steps
- **Launch basics (2026-11-21, pushed, migration `20261121180000_delete_my_account` applied):** security headers and a CSP (`public/_headers`, checked with zero violations under `wrangler dev`), a crash screen (`src/crash.ts`: full page if the site never starts, a bottom bar after that; a failed lazy chunk reloads once), a 404 page, favicon, description and og tags, `robots.txt`, `/privacy` with Delete account (players' images are removed first; GMs' aren't, since they upload onto other pilots), CI (`.github/workflows/ci.yml`: tests, build, database tests) and a weekly encrypted backup (`backup.yml`, needs the `SUPABASE_DB_URL` and `BACKUP_PASSPHRASE` secrets, see history.md "Backups"). Open: page titles (`meta.title`) are never applied to the browser tab, an older gap.
- **iPhone fixes (2026-11-21, pushed):** radar stat symbols were drawn in the wrong place by Safari (foreignObject in a scaled SVG); they are now SVG masks like the ID card's. The pilot page's notes grid no longer lets an editor toolbar push the page wider than a phone (`.dossier .notes` `minmax(0, 1fr)`). Touch screens hide SheetTabs' scroll arrows (swipe instead). "Mech image too big" wasn't reproduced (checked with frame art in WebKit). Firefox Android white screen after Discord login: not reproduced in Firefox, cause unknown.
- **Combat guide on the homebrew rules, Privacy page restyled (2026-11-22, pushed in 32e88b7, no migration):** `/combat` now follows `docs/combat-handbook.md` (14 sections, including the handbook's section 9 of core-book additions; dice rounded up as on the rest of the site). `/privacy` uses numbered file sections. InfoRule headings take a `level` (no skipped heading levels). `/combat` is tailored: a "Your loadout" section from the user's own pilot and mech (`src/combatLoadout.ts`, `?mech=`), weapon tags and sizes trimmed to their gear ("Show all rules" restores them) and a keyword search. Mech page Overcharge default is now 1 → 2 → 4 → 6. Developer rule decisions are logged in `docs/rule-decisions.md`. Open for the developer: what attacks against a pilot on foot target (pilots have no Evasion), and the section 9 balance calls.
- **Pithub, one pilot lists page, combat guide (2026-11-21, pushed, migration `20261121170000_pithub_entries` applied):** `/pithub` is a terminal-skinned second lore section (own table, same code via `loreStore()` in `src/lore.ts`), opened by clicking the home HORUS art once the boot finishes. Registry, Pending and Memorial are one `/registry` page with tabs (`?list=`); old links redirect. `/combat` reads `src/combatRules.ts` (core LANCER placeholder until the homebrew text arrives). Also: breadcrumb links are full tap targets on touch screens, and a FileIndex jump moves keyboard focus to the section heading. Not tested: Back from a real pending pilot, a record mech page's tab mark.
- **Hidden COMP/CON copies removed (2026-11-21, pushed, migration `20261121160000_remove_active_effects` applied):** every `active_effects` was stripped from content (102 on 59 live items), the importer and "Load core content" now drop them, and all of them are kept in `docs/data/hidden-effects-backup.json` for the developer to merge into rules text by hand. Earlier the same day:
- **Hidden COMP/CON copies off the archives (2026-11-21, pushed, no migration):** pack items' `active_effects` (short "you can…" rewordings, some with an activation/range) no longer replace or join a trait's text in the archives and full information (`src/info.ts` `rules()`), and on the mech page they replace it only when they carry an activation. They still show for an item with no rules text. Still in the data (95 on 46 live items, 32 with extras). The developer is merging their information into the trait text by hand, ready for a future combat guide screen.
- **Content editor fixes (2026-11-21, pushed, no migration):** rules text no longer drifts to the wrong list entry after a remove or move (RichTextEditor follows its value; RepeatList and BonusListField use stable row keys, `useRowKeys()`). Trimmed from the effect editor: the condition field, damage type and weapon sizes (data kept, not edited). Open: the local "Overkill {VAL}" tag blocks Save on Overkill weapons; check the hosted tag name. Not tested: creating a new item, the weapon editor on phones.
- **Rich-text options (2026-11-21, pushed, no migration):** every editor (pilot, lore, service record and the content editor; the `basic` prop is gone) gains XS size, free hex text colour (developer decision, sanitiser keeps only #rrggbb), a HORUS glitch mark and inline LANCER game icons. Open: the icon picker shows names only (no symbol preview), no contrast guard on colours, pilot-sheet editors and real phones not tested.
- **GM edit mode does everything (2026-11-21, pushed, migration `20261121150000_gm_edit_mode` applied):** rules and prices are off in edit mode (rank III kept), GM additions are free grants (`character_sheets.gm_grants`, GM-only) with a GM grant badge, GM controls moved into edit mode (rewards row in the edit bar, GM only section, danger zone), the GM review page is only the pending decision, GMs edit or delete any service record entry. Not tested: non-owner GM, Level up at 1000 XP, a real pending pilot's review page. Grant badges on duplicate gear, biomods and mechs are approximate (tracked per item id).
- **Homebrew effects (2026-11-21, pushed, migration `20261121140000_homebrew_rules` applied):** every content kind can carry effects (stat, pilot and personal stat bonuses, add or replace mounts, Superheavy mount, structure repair cost, weapon range/threat/damage/tags with filters, resources, drone and deployable stats, conditions), grant built-in or optional equipment (core bonuses, talents, frame traits, systems, biomods, with "Replaces the frame's built-in weapons"), and require talents, licences, core bonuses or items (checked in pickers, the rule check and at submit). The editor lists are grouped by manufacturer. After deploying, tick "Replaces the frame's built-in weapons" on B.I.G. GUN. Known gap: an item granted only by a biomod still appears in mech pickers (`shortcut:` in `useMechData()`).
- **Borderless list cards and Copy link (2026-11-21, pushed, no migration):** the pilot lists' cards have no panel around them (lilac glow on hover and focus). The pilot and mech ID cards have `Copy link`, which copies the shareable `/registry/...` address: links copied from My pilot (`/pilot/...`) never get a Discord preview and show other people their own pilot.
- **Pilot lists show ID cards (2026-11-21, pushed, migration `20261121130000_pilot_cards` applied):** Registry, Pending and Memorial show each pilot's ID card (a link, no download or save) with "Player: x" under it, one per row on phones. Search no longer matches mech names. Open: the card's small text is about 6–9px on 320–390px phones (left as is unless the developer decides otherwise). Not tested with real pending or dead pilots, portraits, medals or long names.
- **Mech file redesign (2026-11-20, pushed, no migration):** the mech page keeps its own spec-sheet head (registration plate joined to the at-a-glance overview, radar of every stat that differs between frames), then numbered foldable sections and the file index like the pilot dossier, no tabs. The maker colour now also tints the plate band, the radar shape and the mech page's section dashes (decoration only). Single-action danger zones site-wide centre their button. Both radars (mech card and Frame details) share `radarAxes()`: every stat that differs between frames, size included, with symbols. ID card: no department name, serial `UNI-…` moved under "PILOT LICENCE".
- **Mech registration card and editor cleanup (2026-11-20, pushed, migration `20261121120000_mech_public_card` applied):** `MechIdCard.vue` (shared frame `IdCardFrame.vue` with the pilot card), folded "05 Registration card" section, Discord previews for `/registry/<id>/mechs/<mech>`. Content editor: wide shell on desktop (`meta.wide`), every form folds (`FoldPanel`, remembered), far fewer hints, `Official` badge, preview sticky only when it fits. Not tested: a mech with real frame art on the card, the live Discord preview. Not tested: your own mech with an open change (cover badge and joined bar), image upload, Firefox. Later: nested h2s inside sections (StatRow / MechLoadout titles) on both pages.
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
- [docs/copy/text-audit.md](docs/copy/text-audit.md) and [docs/copy/changes.md](docs/copy/changes.md): the site text audit and its changes.
- [docs/redesign/prototype/index.html](docs/redesign/prototype/index.html): the approved UI reference (open via the dev server at `/docs/redesign/prototype/index.html`). Mockups: [dossier](docs/redesign/dossier/index.html) (pilot page), [editor](docs/redesign/editor/index.html) (content editor), [lore](docs/redesign/lore/index.html).
