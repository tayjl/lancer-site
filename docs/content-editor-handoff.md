# Content editor cleanup: handoff

Covers: everything left undone, unchecked or unreviewed after the 2026-11-24 session that built phases 0 to 7 of [content-editor-cleanup.md](content-editor-cleanup.md). Work through it top to bottom. Nothing is pushed. Nothing was checked on the hosted database.

State at the end of the session: all phases committed on `main` (about 20 local commits, last is "Editor ticks: 44px tap target"), `npm run build` clean, `npm test` 532 passing. `CLAUDE.md` still has the developer's own uncommitted change: leave it alone.

Scratchpad files from the session (may be gone): `content-audit.md` (phase 0 audit) and `definitions-spec.md` (UI spec for Definitions and the tab groups).

## 1. Before pushing (blocking)
1. **Apply four migrations to the hosted database in this order**, then run `npm run types` against hosted and diff the result against the hand-edited `src/lib/database.types.ts` (two migrations' types were written by hand because `npm run types` reads hosted):
   - `20261124100000_rule_number_limits.sql`
   - `20261124110000_content_editor_cleanup_data.sql`
   - `20261124120000_game_definitions.sql`
   - `20261124130000_hidden_and_last_save.sql`
2. **Replay all four from an empty database** (`npx supabase db reset` on a throwaway or after backing up local data). Two of them were edited in place after being applied locally, and the local table had a leftover constraint (`game_definitions_frame_size_numeric`) from an earlier draft. Nobody has proven the final files build the same schema as the local database.
3. **Check hosted data before the data migration** (`..._content_editor_cleanup_data`): it reads the live `tag_list` rows to set the combat-page flag, rewrites 7 rules and 2 actions rows, deletes 35 `rule_tag_list_*` rows and groups the number rows. Look for owner-edited rows (`edited` not null) on hosted. Locally none of the rewritten text rows were edited, so no owner text was overwritten.
4. **Confirm hosted has seeded `rules` and `actions` rows.** Phase 1 removed the code fallback, so a database with none now shows empty lists.
5. **Fix or explain the failing pgTAP files.** `npx supabase test db` fails in about seven older files: `gm_edit`, `pilot_inventory`, `rule_numbers`, `security`, `submit_rules`, `homebrew_rules`, and `content_editor` (aborts at line 20: pack 27 "Campaign homebrew" still has 2 items). Every agent blamed local owner-edited rows (`rule_num_starting_manna` = 2500, `rule_num_licence_rank_price` = 650) or local data, but **nobody ran the suite on a clean baseline**, so "none are new" is unproven. Run it on a fresh database and on `git stash`-ed or pre-session commit `2ebe70e` to compare. `rule_numbers.test.sql` also inserts `rule_num_*` rows that already exist and counts all rules rows: make it hermetic.
6. Local data cleanup: `tg_ap` has a leftover `edited.description` "REWORDED tag text for AP.". `test-gm` is set to owner locally. `damage_types/Variable` has a bumped `updated_at`. Pilot 1032's Lodestar mount was restored by hand (backups in the old scratchpad). Nine content items have effective `hidden=true`: six were hidden tags, three were never identified.

## 2. Bugs and suspect behaviour to investigate
- **Frame-size id counted twice.** A bad frame-size id (for example `01`) made the Definitions banner say "Fix 2 problems" and list one line twice. The agent deduplicated the output (`definitionProblems` in `src/definitionEditor.ts`) without finding the cause. Find the second source, then drop the dedupe if it hides a real double check.
- **Conflict Reload leaves a "Leave site?" prompt in `EditorPane`.** Fixed in `DefinitionPane` only. `EditorPane`'s conflict Reload (`ConflictNotice`, a plain `window.location.reload()`) has the same `beforeunload` guard and probably prompts too.
- **Owner's first pack import stamps every row** in `content_saves` as an editor save. An import isn't an editor save. Decide: skip stamping on insert for pack imports, or accept.
- **Trigger raises if the signed-in user has no profile row** (`private.stamp_save` foreign key). Unreachable for real owners; matters only for a service-role call carrying a user JWT.
- **Pilot Overwatch is not folded into Overwatch.** An action has one `text` and mech/pilot flags and no way to keep the "uses any pilot weapon" wording. Needs a version field or a separate approach (decision in the cleanup doc: link, don't merge; the Reaction step now links Brace and Overwatch).
- **Seed ids are positional** (`SEED_IDS`, `ACTION_IDS`): a new seed row needs an id placed to match its `add()` call. Snapshot tests fail until updated on purpose. Consider keyed ids.
- **Frame size error text is fixed** ("Size is ½, 1, 2 or 3.") and goes stale if the owner adds a size.
- **Duplicate carries built-in core checks** for official frames (fixed, tested) but the first edit of an official frame's core checks writes a full copy that no longer follows `CORE_CHECK_BONUSES`. Never confirmed that the first edit saves its own copy (the reviewer could not tell).
- **Hidden official value shows its raw id** in an item's picker (for example "Heat") instead of its label.
- **Used by** matches exact strings, so a manufacturer code can match a weapon's `license` text. It does not scan biomods. "Used by" reads oddly for licences ("Licence unlocks 7 items" counts one more than the six listed).
- **Delete of a faction or commendation in use cascades** to pilot reputation and awarded commendations (unchanged from before, the confirm text warns). Decide whether to block it (restrictive policy or `on delete restrict`).
- A very long faction name is accepted (only unique, no length check).
- **Phase 2 leftovers:** the Full Repair text still says "Overcharge goes back to 1 Heat" (no placeholder for the first step). `REACTIONS_NOTE` still repeats the Reaction step's general rule. The Engaged status and range rows share one string in code but the database holds two copies. The Range row title reads "Engaged (melee) (1)" with doubled parentheses (probably old). Combat guide "damage type" rows still come from `DAMAGE_TYPES` in `src/combatRules.ts` and do not follow Definitions.
- Tag preview in the editor does not show the "Show on combat page" flag.
- Old wording in core text: "Reliable X" says "rolls less damage" (dice wording the developer is deciding), tags use US spelling ("Armor-Piercing", "Personal Armor", "E-Defense") against the site's "armour" and "E-defence".
- `pilot_foo` effects with no registry entry are treated as the pilot's but never shown as a reminder on the pilot sheet (needs a pilot reminder in `src/gameData.ts`).
- A brand-new effect type that changes anything other than a mech or personal stat still needs code in `src/mechData.ts`.
- `lcp.ts` now imports `contentEditor.ts` at runtime: check the bundle size of the content/import page.
- LCP import validates actions and rules with an empty tag and stat context, so unknown tags or stats warn at most.
- Hidden in `loadKind`: **not filtered centrally** (it would break lookups). Pickers call `offered(list, keep)` in `src/catalogue.ts:42`. A new picker must call it or hidden items leak. Nothing in the database blocks awarding a hidden commendation.
- Retry button is wired on the Combat page only; other pages' load-error notices have none.
- Before `pilot_stats` loads, `isPilotBonus` treats personal stats as mech bonuses (corrects on load).

## 3. Not built (decided or offered, left out)
- **Phase 4 building blocks:** grant a pilot weapon or gear, grant a talent rank or licence, change a pilot or mech skill, a new stat with its own sheet row, conditional effects with a shown reminder. Need engine code.
- **Grants on mods and pilot gear:** the sheet never reads them (equipped grants cover weapons and systems only). Needs engine support first.
- **Actions on biomods:** the `bionics` table has no actions column. Needs a migration.
- **Requirements on core systems:** the engine never reads `core_system.requires`; the frame's own `requires` already gates both. Needs engine support first if wanted.
- **Mech skills (HASE) and personal stats as Definitions** (decided: allowed, not urgent). `MAX_SKILL` and the RequirementListField ranks are still hardcoded.
- **Definitions leftovers in code on purpose:** the `Flex` rule in `allowedSizes`, `DATA_ONLY_MOUNTS`, `DATA_ONLY_WEAPON_TYPES`, pilot gear group titles and the Armor/Armour label tweak in `archive.ts`/`GearForm`/`SystemForm`, the `Integrated Auxiliary`/`Main/Aux`/`Superheavy` ids in `mechData.ts`, `bracingMount()` in `src/rules.ts`. `weapon_mounts` is an allowed kind with no rows (the code uses one list for sizes and mounts, seeded as `weapon_sizes`). Data-only values (`Ship-class`, `Special`, `Spool Weapon`, `???`) are not seeded.
- **Fields with no editor input** (audit): `skirmish`, `no_mods`, `synergies`, deployable `activation`, frame `y_pos`, `image_url`, `counters`, `other_art`, core `active_synergies`. The audit also did not compare `database.types.ts` column by column against the forms, and did not triage `src/info.ts`, `src/rulesData.ts`, `src/itemDetails.ts:123` constants.
- **Rare kinds that don't exist:** reserves, backgrounds and NPCs are not content kinds (out of scope until they exist).
- **Used-by counts before delete** on Definitions rows (the refusal appears only after trying).
- **Duplicate** is not offered for manufacturers, rules or site kinds (ids typed, fixed or database-made).
- Pilot Overwatch fold, see section 2.
- "What changed" history beyond the last save (decided: last save only).

## 4. Never browser-checked (code and tests only)
- Commendations on the shared pane: create, edit, icon picker, medal preview, delete.
- Faction delete confirm and faction preview tab; duplicate-name error.
- Phase 1: Retry button styling inside `.notice`; the catalogue error and Retry behaviour with the rules request blocked.
- Phase 2: the Overcharge action's own text; rule and action previews in the editor; a populated pilot gear line; the Tech note after `fill()` fix.
- Phase 5a at 320px after the number-box fix (3rem input) and the fold-title fix; Discard on an untouched new rule enabling after typing.
- Phase 6a: saving a draft with the new manufacturer and licence fields; tap target of the Licence rank radios (42px input, label not measured).
- Definitions: delete-unused on mount types, activations and uses; swatch contrast; the action form's use of the Uses list; mech pages reading mount types; the Definitions tab itself at 320px; adding a mount slot to a real mech; a new mount type used on a real mech; the 1280 layout after the last CSS tweaks; focus return after the unsaved-changes dialog's Discard; stale-edit conflict from two real tabs.
- Phase 3: the whole definitions loader against the local DB in a mech sheet with an owner-added row (damage type icon and colour on sheet, archive, combat page).
- Phase 4: the effect picker on a system and a frame; Equipment fold grant showing on the pilot mech sheet; optional equipment grant and system grant; Duplicate hidden for manufacturers, rules and site kinds; the Used by line on a manufacturer and a tag; core power checks fold at 320 and "first edit of an official frame writes its own copy"; effect picker buttons at 1280 are 28 to 37px (below 44px on a touch laptop).
- Phase 7: the commendation award picker and the reputation list with a hidden row (the GM edit view showed no `.gm-controls`); the licence ladder dead-link fix; the Definitions "Saved by" line against the real database (it assumes the stamp key starts with the list's kind, `kind/id`); packs and import preview with an actions/rules file; hide and restore of items other than a weapon, manufacturer and biomod (frames, systems, mods, gear, talents, core bonuses); an LCP import through the browser or against the database; hide behaviour at 320; the tick's tap target at 320 (now 44px by CSS, unmeasured); the biomod tick tap target; the "Add weapon" button sitting at the bottom edge at 390 may be covered (a normal click timed out).
- `ReputationPanel` is a list with a level select, not an add picker: re-check the intended behaviour for hidden factions.

## 5. Reviews that were partial or skipped
- Security-auditor ran on: rule_number_limits, factions/commendations writes (6b), game_definitions (twice), save_definitions, hidden and last save. **Not audited:** the `content_editor_cleanup_data` migration (data only, skipped on purpose), the final edited `game_definitions` migration after its last hardening round (the hardened version was only tested by its own pgTAP file), and the front-end hide filters.
- UX reviewers ran out of turns several times (phase 2, 6, 4, 7); their reports are partial. Items they could not reach are listed in section 4.
- No audit of concurrent sessions, deadlocks, real two-tab races, hosted behaviour or large incompressible payloads.
- `delete_definition` and `save_definitions` use a text-match in-use guard and take share locks on `character_sheets` and `pending_changes`: a delete can briefly stall pilot writes. Real concurrency not tested.
- A rejected pending change that a player resubmits could bring back a deleted definition id; approval-time checks may not validate against `game_definitions`.
- Hidden definitions are readable by players (RLS does not enforce `hidden`): fine if hidden only means not offered. Change the select policy if they should be secret.
- Ids differing only by case or whitespace are distinct definition rows; lookups are case-insensitive, so a mount `main` counts as `Main`.

## 6. Housekeeping
- Update `STATUS.md` (state, unpushed work, hosted migrations, next steps) and [claude/content-editor.md](claude/content-editor.md) after the next round. The agents added entries per phase; read both once for contradictions.
- Delete `docs/content-editor-cleanup.md` sections that are now history, or mark phases done.
- Use `npm run types` after the hosted migrations to replace the hand-edited `src/lib/database.types.ts`.
- Untracked `.playwright-cli/` is gitignored. Reviewers left test pilots, rows and stamps locally; the leftover `content_saves` row for `mf_drake` pre-dates them.
- Reviewers' turn limits: give a UX review one narrow job and tell it to report by turn 45.
