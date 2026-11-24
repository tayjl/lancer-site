# Content editor cleanup (draft plan)

Covers: What is wrong with the owner content editor today, and the phases to fix it. Nothing here is built yet.
See also: [claude/content-editor.md](claude/content-editor.md), [claude/content-editor-forms.md](claude/content-editor-forms.md), [claude/lcp-import.md](claude/lcp-import.md).

Drafted 2026-11-24 from a read of the code. The editor is for GMs and owners to control site content, not player characters. Lore, archives, pithub and personal stats keep their own pages and are out of scope.

## Goal
One place for each fact. An owner changes it once and every page shows the change. Every kind of content can be added, edited, hidden or removed without code. Screens show each piece of information once.

Added 2026-11-24: **every kind of content on the site must be editable completely, including things LANCER has never done.** Integrated weapons on core bonuses were the first step. The same freedom should exist everywhere, and the editor must stay clean and neat while it grows.

## Design principles for "edit anything"
1. **Content, not code.** If a game fact could ever change (a damage type, a mount, an activation, a status, a stat, a frequency), it is a content row with a default, never a constant in `src/`. Constants stay only for what the engine itself needs to run.
2. **Building blocks on every kind.** Four blocks cover most new ideas: **effects** (change a number or a rule), **grants** (give a weapon, system, action, deployable or mount), **requirements** (what you need first) and **actions** (something you can do). Every kind that a pilot or mech can own should be able to carry every block. The integrated weapon on a core bonus is the model: one block, usable anywhere.
3. **One registry drives everything.** Each effect, grant and requirement type is declared once. The editor form, the validation, the preview and the sheet maths are all built from that one declaration, so adding a new mechanic means adding one entry, not touching five files.
4. **A safe fallback for anything the engine can't count yet.** A named reminder that shows on the sheet but isn't counted (the site already has reminders). Nothing an owner writes is silently dropped, and a warning says when something is shown but not counted.
5. **Clean by default.** Common fields first, the rest behind folds. Pickers are grouped and searchable. Each building block says in one line what it does. No kind shows a field it can't use.
6. **Safe to change.** Referenced content can't be deleted while in use, ids never change, `Used by` works for every reference, and a `Duplicate` action starts a new item from an existing one.

## Where the engine blocks "edit anything" today
Found 2026-11-24 by reading the code. File:line is where the limit lives.
- **Effect types are a fixed list.** `BONUS_TYPES` and `EFFECT_BONUS_TYPES` (`src/contentEditor.ts:129-162`). The code comment says any other bonus is "only reached through the raw-data box and isn't counted". A new stat or mechanic needs code.
- **Mount types are code.** `MOUNT_SLOTS` and `MOUNT_HINTS` (`src/mechData.ts:47-70`) and `FRAME_MOUNTS` (`src/contentEditor.ts:199`). A new mount type (say a "Back" mount) can't be added from the editor.
- **Core power check bonuses are keyed by frame id in code.** `CORE_CHECK_BONUSES` (`src/coreRules.ts:5`, used at `src/mechData.ts:323,356`), so a homebrew frame's core power can't ask for its own required bonuses.
- **Pilot bonus detection is a prefix rule.** `isPilotBonus` (`src/bonuses.ts:48`) uses `pilot_` plus a hardcoded personal stats list, so a new pilot stat isn't treated as one.
- **Option lists are code.** Damage types (`src/contentEditor.ts:110`, with icons in `src/combatRules.ts:129`), range types (`:111`), activations (`:122`, with colours and icons in `src/itemDetails.ts:123`), frame roles, uses and sizes (`:196-200`), gear types, weapon types and sizes, stat icons (`src/gameData.ts:243`).
- **Mech skills (HASE) are fixed** (`src/gameData.ts:235`). Decide if that stays (see questions).
- **Statuses, conditions and the combat page structure** are partly code (`src/combatRules.ts:169`, `src/rulesData.ts` sections and status cards).
- **Not yet checked:** which kinds lack grants (the docs list core bonuses, systems, biomods, frame traits, core systems and talent ranks, so weapons, mods, gear and manufacturers need checking), which lack requirements, and how licences, reserves, backgrounds and NPCs are stored.

## What's wrong today (findings, file:line)
**A. One fact in two places (code vs database)**
- Combat rules: `src/combatRules.ts` constants are turned into `RULES_SEED` (`src/rulesData.ts`) and also seeded into `content_items` kind `rules`. At runtime the database wins, but the code copy is still the fallback (`src/gameData.ts:147-151`). After seeding, a fix made in code doesn't show and a fix made in the editor isn't in code. Two truths.
- Base actions: `BASE_ACTIONS` / `PILOT_ACTIONS` (`src/baseActions.ts:17`, `src/combatRules.ts:281`) work the same way, with the fallback at `src/gameData.ts:121-134`.
- Balance numbers: `NUMBER_KEYS` defaults (`src/rulesData.ts:108-124`) must equal the literals in `public.rule_number()` (migration 20261122120000). Three copies: code, SQL and the row.
- Personal stats: the `pilot_stats` table plus a hardcoded `PERSONAL_STATS` (`src/bonuses.ts:47`). A new stat isn't treated as a pilot bonus.
- Seed rule ids come from slugs of names (`rulesData.ts:38`). Renaming a seed entry in code orphans its database row.

**B. Edit in two places for one change (Rules tab)**
- Overcharge is spread across the turn step "Overcharge", the action "Overcharge", the note `OVERCHARGE_LATER` and the number "Overcharge heat". The cost is described in more than one text.
- Tags card: putting a tag on the combat page needs a `tag_list` rule row (name = tag id) **and** the tag's own text in Tags.
- Quick Tech: `TECH_NOTE` lists Invade, Scan, Lock on and Bolster by name, and they are also separate actions. Renaming or hiding an action leaves the note out of date.
- Reactions: the turn step "Reaction" and the actions Brace and Overwatch describe the same thing. Overwatch also has a pilot copy (`PILOT_OVERWATCH`).
- Text with numbers baked in: "Up to two pilot weapons, one armour and three gear." (`FOOT_RULES`) doesn't follow the `loadout_*` numbers. The same goes for any rule text that states a number held in Numbers (only `{HEAT}` and `{REPAIR}` are filled in today).
- "Engaged" is a status row and also a range tier row ("Engaged (melee)").
- The Numbers section mixes combat numbers (`rule_numbers_*`) with economy and levelling numbers (`rule_num_*`: manna prices, ranks, slots). Two id patterns, one list, hidden inside "Rules".
- One "Rules" tab holds three kinds (rules, actions, tags, `RULES_GROUP` in `src/ruleList.ts:9`), so Tags has no tab of its own.

**C. The same thing shown twice on one screen**
- The sticky bar's badge (Official / Edited) and the "From {pack}." / "Edited from {pack}." line say the same thing, and both offer `Revert to original` (`EditorPane.vue:221-224, 250-251`).
- "Published" uses the green `approved` colour, but it isn't an approval (`EditorPane.vue:222`).
- The form and `Advanced: raw data` edit the same object. Keep it as an escape hatch, but tuck it behind the danger zone. Site kinds don't get it, which contradicts the doc (`EditorPane.vue:277` vs `docs/claude/content-editor.md`).
- The fallback "No form for {kind} yet" is dead code now (`EditorPane.vue:274-276`).
- The "Original failed" notice repeats the Original tab (`EditorPreview.vue:87`).

**D. Repeated fields and uneven kinds**
- The manufacturer select with the Exotic fallback is copied in ItemBasics, FrameForm, CoreBonusForm and BionicForm. Licence and rank are written two ways (ItemBasics vs FrameForm's ChoiceField).
- Option lists are copied: gear types (`contentEditor.ts:109` and `archive.ts:152`), damage types (`contentEditor.ts:110`, `ItemStats.vue:9`, `MechOverview.vue:85`), mounts and sizes (`contentEditor.ts:114-117`, `MechLoadout.vue:55`).
- Three save flows: `EditorPane` for packs, `EditorPane` with `site` for biomods, and `useSimpleEditor` for factions and commendations. Three id rules (generated, typed, database-made). The list grouping differs per kind.
- The code says `bionics` / `BionicForm`, the screen says Biomods.

**E. Gaps for after-launch editing**
- Actions and rules from an LCP are ignored (`IMPORTED_KINDS`, `src/lcp.ts:10`), so a homebrew pack can't ship them.
- Official items can't be hidden (only reverted). Homebrew can be deleted but not unpublished. Biomods can't be deleted (retire only). Check which kinds have no way to take content out of play.
- Mech skills (HASE) are hardcoded (`src/gameData.ts:235`). That's fine, they're fixed by the game. Write it down as intentional.
- Who edits: the editor is owner-only today. CLAUDE.md says GMs do "everything except LCP content". Decide whether GMs may edit rules, actions, factions and commendations.
- Known open polish (STATUS.md "Rules editor polish"): the "Owner only" pill shows to non-owners, tab counts read 0 while loading, Discard is enabled on an untouched new rule, a stray hint on Tags card rules, "Add number" on Repair cost, number boxes at 320.

## Plan, in phases (each phase is a shippable step)
**Phase 0: coverage audit** (explorer, read-only, one short report)
- A table of every field in the LANCER data format (and in the site's own tables) against the form field that edits it. Anything without a field is a gap.
- A table of every constant in `src/` that describes game content, marked **content** (move to the editor) or **engine** (stays in code, and why).
- A capability matrix: which kind can carry effects, grants, requirements and actions, with the empty cells marked.
- This report decides the exact scope of phases 3 and 4.

**Phase 1: one source of truth for rules, actions and numbers** (database-architect + ts-developer)
- The database is the only live copy. The code constants become a **seed file only**, used for the first import and in tests. The runtime fallback goes. If the load fails, show the site's normal load-error notice with Retry (`catalogueError`) and never silently fall back to old text.
- Give seed rows fixed ids, not ones made from the name, so renames don't orphan rows.
- `rule_number()` in SQL reads the default from the row, or from one shared table of defaults, so the numbers aren't written in three places. A pgTAP test checks the SQL and site agree.
- `PERSONAL_STATS` is read from `pilot_stats`, not hardcoded.

**Phase 2: one fact, one entry** (ts-developer + ui-implementer)
- Rule text can use **placeholders for any number** (`{loadout_gear}`, `{overcharge_heat}` and so on), extending today's `fill()` (`rulesData.ts`). Rewrite text that states a number so it uses one. The editor shows the filled-in text in the preview.
- Text that names an action links to it instead of copying it: a placeholder such as `{action:invade}` shows the action's current name, and hides when the action is hidden.
- Overcharge: one action holds the text, the turn step points at it, and the cost comes from the number. Remove the duplicate sentences.
- Tags card: a tick on the tag itself ("Show on combat page"), not a separate rule row. Move the existing `tag_list` rows to the flag, then delete them.
- Merge the reaction turn step with the reaction actions, and the pilot Overwatch into Overwatch with a "Pilot" version flag, if the rules allow. Check docs/rule-decisions.md first.
- Split Numbers into "Combat numbers" and "Economy and levelling" groups, with one id pattern.

**Phase 3: game definitions become content** (database-architect + ts-developer)
- A new **Definitions** area in the editor holds the small lists the game is built from: damage types (with icon and colour), range types, activations, uses (frequencies), mount types (with the slots each takes), frame roles, weapon types and sizes, statuses and conditions, personal stats, and tag groups. Each has a seeded default, so nothing changes for players until an owner edits one.
- Forms read their choices from these rows, not from constants. The sheet, archive and combat page read them too, so a new damage type or mount type works everywhere once added.
- Referenced definitions can't be deleted while used (same pattern as `delete_content_item`).
- Which lists stay in code is decided by the phase 0 report.

**Phase 4: one registry for effects, grants and requirements, on every kind** (ts-developer + ui-implementer)
- Declare each effect, grant and requirement type once (label, what value it takes, filters, how the sheet counts it, how the preview shows it). Build `BonusListField`, `GrantFields`, `RequirementListField`, the validation and the sheet maths from that one list.
- Fill the empty cells of the capability matrix, so any kind a pilot or mech can own can carry effects, grants (integrated weapons, systems, actions, deployables, extra mounts), requirements and actions.
- New building blocks the audit will likely call for: grant a **pilot** weapon or gear, grant a **talent rank** or **licence**, change a **pilot or mech skill**, add a **new stat** with its own sheet row, **conditional** effects with a shown reminder, and custom **core power check bonuses** on a frame (replaces `CORE_CHECK_BONUSES`).
- Uncounted effects keep working as reminders and show a warning that says so.
- Keep it neat: the effect picker is grouped and searchable, rare options sit under `Options`, and each row ends with a one-line plain summary ("Adds an Aux mount, up to 2").
- Add `Duplicate` on every item and show `Used by` for every reference, not just items.

**Phase 5: tabs and screens that say each thing once** (ui-designer for the tab layout, then ui-implementer)
- Tabs: Tags, Actions and Rules each get a tab, or Rules becomes a clear sub-menu. Group the tabs as **Mech content | Pilot content | Combat rules | Campaign** (biomods, factions, commendations).
- Pane bar: one status badge and one sentence. Drop the repeated pack line and the second Revert.
- Published gets a neutral badge colour (one job per colour).
- Raw data moves under the danger zone, folded, with the same rules for every kind (site kinds too, or none, and the doc matches).
- Delete the dead "No form" fallback and the duplicate "Original failed" notice.
- Fix the STATUS.md polish list.

**Phase 6: one way to build a form** (ts-developer + ui-implementer)
- One `ManufacturerField` and one `LicenceField`, used by every form that needs them.
- One home for option lists (gear types, damage types, mounts, sizes, activations), with the sheet and editor importing the same constant.
- Factions and commendations move onto the same pane as everything else (one save flow, one conflict handling, one danger zone). Keep `useSimpleEditor` only if it is the shared core.
- One id rule written down: generated and fixed, except manufacturers (short code) and database rows.
- Rename `bionics` → `biomods` in the editor code where it's cheap. The table name can stay.

**Phase 7: complete for after-launch work** (database-architect + ts-developer + ui-implementer)
- Every kind can be **added, edited, hidden from players and restored**. Official items get "Hide from players" (like rules and actions already have) instead of only Revert. Homebrew deletes stay refused while in use.
- LCP import accepts `actions` and `rules`, so homebrew packs can carry them.
- A short "What changed" list per item (who saved and when, from `updated_at` and the profile), if cheap. Optional.
- Export (already in content-editor-forms.md) covers every kind, so the campaign's content can be backed up.

## Rules for every phase
- Site text follows `.claude/rules/site-text.md`. Colours come from `src/style.css` only. Every write ends in `.select()` and goes through `checkWrite()`. `invalidateCatalogues()` runs after writes.
- New migrations go to the hosted database before pushing. Run `npx supabase test db` after any database or RLS change. The security auditor reviews database changes, and the UX reviewer reviews screen changes.
- Update `docs/claude/content-editor.md` and STATUS.md at the end of each phase.

## Decisions (2026-11-24)
- **Owner only, period.** The whole content editor, including rules, actions, factions, commendations and Definitions, is for owners. GMs get no editor access. (This settles the earlier question about GMs. CLAUDE.md's "GM: everything except LCP content" stays true for pilots, but not for the editor.)
- **Skills and stats can be added.** Owners may add new mech skills (HASE) and personal stats if they want to. It's not urgent, so it goes in phase 3 or 4 after the audit and doesn't block anything else.
- **A small code entry is fine.** A rule that needs a brand-new kind of calculation can need a code entry in the registry. The developer writes those. The editor and the registry cover everything else.

- **Reserves, backgrounds and NPCs are not content kinds and stay out of scope** until they exist (Phase 0 audit, 2026-11-24).
- **Official items get "Hide from players"** on every kind (phase 7).
- **History is the last save only**: who saved and when, one line in the pane bar (phase 7).
- **Reactions: link, don't merge.** The Reaction turn step keeps the general rule and links to Brace and Overwatch. Pilot Overwatch becomes a Pilot version of Overwatch.
- **Phase order:** 0, 5a, 1, 2, 6, 3, 4, 5b, 7. Phase 5 is split: 5a is the small pane fixes (early), 5b is the tab grouping (after Definitions exists). Phase 6 drops "one home for option lists" because phase 3 replaces those constants.
- **Phase 0 findings** (scratchpad `content-audit.md`): grants missing on weapons, mods and gear; requirements missing on core systems; actions missing on biomods; tags, manufacturers, actions, rules, factions and commendations carry none of the four blocks; manufacturers, factions and commendations have no way out of play; `skirmish`, `no_mods`, `synergies` and deployable `activation` have no input.

