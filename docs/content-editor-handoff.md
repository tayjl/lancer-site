# Content editor cleanup: handoff

Covers: everything left undone, unchecked or unreviewed after the 2026-11-24 session that built phases 0 to 7 of [content-editor-cleanup.md](content-editor-cleanup.md). Work through it top to bottom. Everything is pushed and the four migrations are on the hosted project (section 1).

State at the end of the session: all commits are on `origin/main` (`e92c73f` plus a docs commit), `npm run build` clean, `npm test` 532 passing, the full pgTAP suite passes on a clean database. `CLAUDE.md` still has the developer's own uncommitted change: leave it alone.

Scratchpad files from the session (may be gone): `content-audit.md` (phase 0 audit) and `definitions-spec.md` (UI spec for Definitions and the tab groups).

## 0. Remaining objectives from the original plan (the developer wants ALL of this done)
The goal in [content-editor-cleanup.md](content-editor-cleanup.md) is that every kind of content is fully editable without code, including things LANCER has never done, and each fact lives in one place. Phases 0 to 7 were built, but the items below were skipped, deferred or only partly met. Treat each as in scope. Suggested order: 0.1 first (it decides the rest), then 0.2, 0.3, 0.4, 0.5, 0.6, 0.7. Follow the project's agent routing (CLAUDE.md), and finish each with the reviewers, a browser pass and the docs.

**Out of scope (the only exclusion, the developer, 2026-11-24):** entirely new mechanics, meaning a brand-new kind of calculation the engine has never done. The developer will hardcode those: a registry entry plus a code change in `mechData.ts` or the rules code is acceptable for them. Everything that only configures an existing mechanic stays in scope (a new damage type, status, mount, stat, skill, grant, requirement, action or effect built from what the engine can already count). When unsure, treat it as in scope and put the question in the report.

**0.1 Finish the Phase 0 audit** (explorer, read-only; the first pass was partial)
- Compare every column in `src/lib/database.types.ts` and every LANCER data field against the form field that edits it. Known gaps with no input: `skirmish`, `no_mods`, `synergies`, deployable `activation`, frame `y_pos`, `image_url`, `counters`, `other_art`, core `active_synergies`.
- Triage constants not yet looked at: `src/info.ts`, `src/rulesData.ts`, `src/itemDetails.ts` (marked content or engine).
- Rebuild the capability matrix (kind by effects, grants, requirements, actions) from runtime behaviour, not form imports.
- Done when: a report lists every gap and each gets an editor field or a written reason it stays code.

**0.2 Phase 2 leftovers: one fact, one entry**
- Fold Pilot Overwatch into Overwatch as a "Pilot" version. Needs a version or variant field on actions that keeps "uses any pilot weapon" (docs/rule-decisions.md). Remove `PILOT_OVERWATCH`.
- `REACTIONS_NOTE` must stop repeating the Reaction step's general rule.
- Full Repair text: replace "Overcharge goes back to 1 Heat" with a placeholder for the first Overcharge step.
- Engaged: one database entry, with the range tier linking the status (a `{status:...}` placeholder, or one shared row).
- Done when: no rules text states a number held in Numbers, names an action by copy, or exists twice.

**0.3 Phase 3 leftovers: every game list is content**
- Move to Definitions: statuses and conditions, personal stats (with icons), tag groups, stat icons, mech skills (HASE, add `MAX_SKILL` and the RequirementListField ranks), and `weapon_mounts` if it needs to differ from sizes.
- Remove or move the code special cases: the `Flex` rule in `allowedSizes`, `DATA_ONLY_MOUNTS`, `DATA_ONLY_WEAPON_TYPES`, pilot gear group titles in `archive.ts`, the Armor/Armour label tweak, hardcoded mount ids in `mechData.ts` and `bracingMount()` in `rules.ts`. Where a rule truly needs code, put the id in the Definition's data (a flag) so the owner can still add a new one.
- Make the combat guide's damage types (`src/combatRules.ts` `DAMAGE_TYPES` and the four rule rows) follow the Definitions.
- Frame size error text must follow the Definition rows.
- Show "Used by n" on each Definitions row before trying to delete.
- Done when: an owner can add a damage type, status, mount type, personal stat or skill in the editor and it works on the sheet, archive and combat page with no code change.

**0.4 Phase 4: every kind carries every building block**
- Grants on mods and pilot gear: the sheet (`src/mechData.ts`, pilot code) must read them first (today only weapons and systems are read), then add the form field.
- Requirements on core systems: not needed (decided by the developer, 2026-11-24). A core system comes with its mech, and the frame's own `requires` already gates both.
- Actions on biomods: required (decided by the developer). Needs a migration for the storage (`bionics` has no actions column; see `save_bionic`, `bionic_bonuses`), the form field (the existing ActionListField), and the sheet reading biomod actions the way it reads actions on other kinds. Update the database types, tests and the security review.
- Tags, manufacturers, actions, rules, factions and commendations stay simple (decided by the developer, 2026-11-24): they are labels or small text, and they don't need effects, grants, requirements or actions. Leave them as they are.
- New building blocks built from existing mechanics: grant a pilot weapon or gear, grant a talent rank or licence, change a pilot or mech skill, add a stat with its own sheet row (a stat the engine already adds up, like a personal stat), conditional effects shown as a reminder. If one of these truly needs a new kind of calculation, skip it and say so in the report.
- Registry: every effect the engine can already count must work from a registry entry alone, with no code change (check the list in `BONUS_REGISTRY` against what `mechData.ts` handles). An entirely new calculation is out of scope and may need code. Add the missing pilot-side reminder for undeclared `pilot_*` effects (`src/gameData.ts`).
- Duplicate for manufacturers, rules and the site kinds; Used by that also scans biomods and reads sensibly for licences.
- Done when: the capability matrix's empty cells are only the ones the developer ruled out (core system requirements; every block on tags, manufacturers, actions, rules, factions and commendations), and a homebrew variation "never done before" (anything short of an entirely new calculation) can be built from the editor alone.

**0.5 Phase 7 leftovers: nothing is out of reach**
- Export every kind: Definitions, factions, commendations and biomods (not LCP kinds) so the campaign's content can be backed up and restored. Import them back.
- Biomods can be deleted, not only hidden (guard against in-use, like `delete_content_item`).
- Decide and build the faction and commendation delete safety (block when in use, or keep the warning).
- Hidden filtering must cover any picker added later: add a test that fails if a picker reads a content list without `offered(...)`.

**0.6 Missing editor inputs and consistency**
- Add the editor fields found in 0.1.
- A hidden value on an existing item shows its label, not the raw id, in the picker.
- Tag preview shows the "Show on combat page" flag.
- Old text fixes: the Range row title "Engaged (melee) (1)" doubled parentheses, "Reliable X" dice wording and US spellings in tag text (ask the developer which wording first).
- Retry button on every page's load-error notice, not only Combat.

**0.7 Verify everything that was never opened in a browser**
- Work through section 4 below. Run each UX review as a narrow job with a report-by-turn-45 limit.
- Security-audit what was skipped: the final `game_definitions` migration after its last hardening round, and the front-end hide filters.

## 1. Deployed (2026-11-24): what was done and what to check live
Done, in this order:
1. Replayed every migration from an empty local database (`npx supabase db reset`). This found a real bug (a string-replace had turned the `$$` quotes in `rule_number_limits.sql` into `$`); fixed and committed.
2. Ran the full pgTAP suite on that clean database: every file passes. So the earlier failures in `gm_edit`, `pilot_inventory`, `rule_numbers`, `security`, `submit_rules`, `homebrew_rules` and `content_editor` were my local test data, not the migrations. One data-dependent test (the tag flag) was dropped from `content_editor_cleanup_data.test.sql`.
3. Read hosted state (read-only): 35 actions, 181 rules (6 owner-edited, none of the rewritten text rows except `rule_notes_tech`, which the owner had blanked and which stays blank), 61 tags, all 35 `rule_tag_list_*` names match real tags. No hosted game_definitions or content_saves yet.
4. Dry-ran the data migration in a rolled-back transaction on a copy of the hosted rules, actions and tags: 181 to 145 rules, 35 tags flagged, 7 rule and 2 action texts updated, 17 number rows grouped.
5. Backed up the hosted rows the data migration touches (`hosted-rules-actions-tags-before.json` in the old session scratchpad, may be gone) and applied the four migrations to hosted with `npx supabase migration up --remote --yes`. Verified after: 145 rules, 0 tag_list rows, 35 flagged tags, 72 definitions, 8 limits, migration list matches.
6. `npm run types` against hosted produced the same types as the hand-edited file.
7. Pushed 17 commits to `main` (`2ebe70e..e92c73f`); Cloudflare builds from the push.
Note: for a few minutes between the migrations and the Cloudflare build, the old site ran on the migrated data (raw `{repair_cost}` text, an empty Tags card). Nothing to do now.

Rollback if needed: restore the backed-up rows (content_items kinds rules, actions, tags) and re-add the 35 `rule_tag_list_*` rows; the new tables and columns can stay.

**Check live first (not done yet, needs a login):**
- Combat page, Mech and Pilot modes: Tags card lists 35 tags with no empty card; no raw `{...}` text anywhere; Overcharge, Reaction, Engaged and the pilot gear line read once and correctly; the Quick Tech note is blank (the owner's own edit) so check it is acceptable.
- Content editor as owner: tab groups and the Tags, Actions, Rules and Definitions tabs; Definitions lists 72 rows in 12 kinds; hide and restore a test item and see the Saved by line; Duplicate; the effect picker.
- Player login: hidden items gone from pickers and the archive, owned items still shown.
- `npm run build` output has no `lcp.ts`/`contentEditor.ts` bundle surprise on the content page.
- Hosted `content_saves` fills as the owner edits; the first pack import stamps every row (see section 2).

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
- **Actions on biomods:** required, see 0.4.
- **Requirements on core systems:** not needed (developer decision, 2026-11-24).
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
- (done) the failing pgTAP files were local data; the suite is clean.
- `delete_definition` and `save_definitions` use a text-match in-use guard and take share locks on `character_sheets` and `pending_changes`: a delete can briefly stall pilot writes. Real concurrency not tested.
- A rejected pending change that a player resubmits could bring back a deleted definition id; approval-time checks may not validate against `game_definitions`.
- Hidden definitions are readable by players (RLS does not enforce `hidden`): fine if hidden only means not offered. Change the select policy if they should be secret.
- Ids differing only by case or whitespace are distinct definition rows; lookups are case-insensitive, so a mount `main` counts as `Main`.

## 6. Housekeeping
- Update `STATUS.md` and [claude/content-editor.md](claude/content-editor.md) after the next round (STATUS and history.md were updated at deploy). The agents added an entry per phase to content-editor.md; read it once for contradictions and merge the per-phase entries into one description.
- Delete `docs/content-editor-cleanup.md` sections that are now history, or mark phases done.
- Types: regenerated against hosted after the migrations; identical to the hand-edited file.
- Untracked `.playwright-cli/` is gitignored. Reviewers left test pilots, rows and stamps locally; the leftover `content_saves` row for `mf_drake` pre-dates them.
- Reviewers' turn limits: give a UX review one narrow job and tell it to report by turn 45.
