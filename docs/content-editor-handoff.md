# Content editor cleanup: handoff

Covers: everything left undone, unchecked or unreviewed after the 2026-11-24 session that built phases 0 to 7 of [content-editor-cleanup.md](content-editor-cleanup.md). Work through it top to bottom. Everything is pushed and the four migrations are on the hosted project (section 1).

State at the end of the session: all commits are on `origin/main` (`e92c73f` plus a docs commit), `npm run build` clean, `npm test` 532 passing, the full pgTAP suite passes on a clean database.

Scratchpad files from the session (may be gone): `content-audit.md` (phase 0 audit) and `definitions-spec.md` (UI spec for Definitions and the tab groups).

## Where we are (2026-11-25)
- Steps 2, 3 and 4a are committed, pushed and live (`origin/main` `6f35d38`; step 4a code `17f91be`, docs `6f35d38`; steps 2 and 3 code `1f028ba`, `e899ecf`, `b0e4bf9`, docs `c7ff4b7`). Pushed 2026-11-25.
- Migration `20261125100000_content_cleanup_3b` (3b) is applied to hosted (2026-11-25, before the push). The CLI printed no NOTICE lines, so check hosted rows with an `edited` value to see whether owner-edited rows were touched.
- **Step 4a is done and pushed** (0.3, status groups and damage type guide text). Migration `20261125110000_content_cleanup_4a` is applied to hosted before the push (2026-11-25).
- **Step 4b is done and pushed** (code `f7207ff`, docs `a8fc866`). Migration `20261125120000_content_cleanup_4b` is on hosted. Browser check passed 2026-11-25.
- **Step 4c is pushed** (`origin/main` `5f3f1ef`, 2026-11-25). Migration `20261125130000_content_cleanup_4c` is on hosted (applied before the push). Tests, reviewer and browser checks passed (see the 4c block, 0.3).
- **Batch 2026-11-25 (steps 2 to 8 and 12, 4b check, 0.3 close-out): pushed as `c5c79c1`.** Migrations `140000` to `170000` were applied to hosted before the push. See the batch block under 0.3.
- **Steps 9 and 10: pushed as `b1071df`.** Migrations `180000`, `190000` and `200000` were applied to hosted before the push. Cloudflare build and CI passed. See 'Steps 9 to 11' under 0.3.
- **Step 11: shipped (`0c7d1cf`, docs `8df78c0`).** Migration `20261125210000` is on hosted.
- **Step 13 (audit and browser sweep): done 2026-11-25.** Its one bug fix (a New button for factions and commendations) is built, pending commit. Results are in 0.7.
- Check live (STATUS.md) stays open.
- Agents can push: `gh` is logged in and `gh auth setup-git` set the credential helper. Pushing goes live, so ask first.

## Next session: start here
State 2026-11-25. Steps 2 to 12 are live (`origin/main` `0c7d1cf`, docs `8df78c0`; migration `20261125210000` on hosted). Step 13 (audit and browser sweep) is done. Remaining, in order:
1. Commit and ship the New button for factions and commendations (`src/views/ContentEditorView.vue`, built, pending commit). Ask first before pushing.
2. Developer decisions: what granting talent ranks or licences means; export and import for Definitions, factions, commendations and biomods (low priority); the phantom mounts server check; a blanket revoke of execute on all functions in schema `private` (see 0.7).

Nothing else is in the plan.

Not fixed (minor, record only): rich-text toolbar buttons in `RichTextEditor.vue` are 34px wide on mobile (under 44). Mount flags `integrated` and `superheavy` have no editor control; keep them on save. The Armour-type system row is unchecked because no Armor-type system exists in local data. 4c: reverting one of the three tags to pack drops the hide flag; pack text changes to those three tags are shadowed by `edited`; `pilotCard` has no editor control; the player check covered pilot gear only, not mech items.

Environment (outside the repo, changed 2026-11-25):
- `hooks/guard.py` in the Hermes home was rewritten, with tests in its hooks folder.
- The cce MCP was removed from the 9 non-default profile configs. The gateway runs multiplex_profiles and started 10 copies. Restart the gateway for that to take effect, then check that only one `cce serve` process runs.

## 0. Remaining objectives from the original plan (the developer wants this done)
The goal in [content-editor-cleanup.md](content-editor-cleanup.md) is that content is fully editable without code, including things LANCER has never done, and each fact lives in one place. Phases 0 to 7 were built, but the items below were skipped, deferred or only partly met. Suggested order: 0.1 first (it decides the rest), then 0.2, 0.3, 0.4, 0.5, 0.6, 0.7. Follow the project's agent routing (`.hermes.md`, Team routing), and finish each with the reviewers, a browser pass and the docs.

### Scope decisions (the developer, 2026-11-24)
**Out of scope**
- Entirely new mechanics (a brand-new kind of calculation the engine has never done). The developer hardcodes those. Anything that only configures an existing mechanic is in scope. When unsure, treat it as in scope and ask in the report.
- **Stats and skills stay as they are:** editing, adding or choosing icons for mech stats, pilot (personal) stats and the HASE skills is out. Do not move `PERSONAL_STATS`, `MECH_SKILLS`, `STAT_ICONS`, `MAX_SKILL` or the RequirementListField ranks into Definitions.
- **Core system requirements:** not needed (a core system comes with its mech; the frame's own `requires` gates both).
- **Simple kinds stay simple:** tags, manufacturers, actions, rules, factions and commendations are labels or small text and need no effects, grants, requirements or actions.
- **Pilot Overwatch stays separate** from Overwatch (no merge, no variant field).
- **The special rules in code stay:** the `Flex` rule in `allowedSizes` and `bracingMount()` in `rules.ts` never change.
- **The Engaged status** is being removed by the developer: do no work on it (no placeholder, no shared row, no doubled-parentheses fix).
- **Exports of site-specific content** (Definitions, factions, commendations, biomods) are low priority: only do them if everything else is finished.

**In scope, stated by the developer**
- The combat guide must reflect what is in the database (so it follows the Definitions, including damage types).
- Statuses and conditions: **editing and adding them is important** (as Definitions or content rows the combat page reads).
- **Remove all data duplication**, `REACTIONS_NOTE` included.
- **Biomods can grant stuff** to a pilot or a mech stat, and **can be deleted**.
- **Conditional effects with a reminder** should exist on most things.

### 0.1 Finish the Phase 0 audit (done 2026-11-25) (explorer, read-only; the first pass was partial)
- Compare every column in `src/lib/database.types.ts` and every LANCER data field against the form field that edits it. Known gaps with no input: `skirmish`, `no_mods`, `synergies`, deployable `activation`, frame `y_pos`, `image_url`, `counters`, `other_art`, core `active_synergies`.
- Triage constants not yet looked at: `src/info.ts`, `src/rulesData.ts`, `src/itemDetails.ts` (content or engine). Leave stats, skills and the two special rules above as engine.
- Rebuild the capability matrix (kind by effects, grants, requirements, actions) from runtime behaviour, not form imports.
- **Duplication sweep:** list every fact that is written in more than one place (rule text copied between rows, notes repeating a turn step, a number in text and in Numbers, a name copied instead of linked, a value in code and in the database). This feeds 0.2.
- Done when: a report lists every gap and each gets an editor field or a written reason it stays code.

### 0.2 Remove all data duplication
**Status: done 2026-11-25 (step 3). Committed, pushed and live (`c7ff4b7`); 3b applied to hosted.** Rule decisions: [rule-decisions.md](rule-decisions.md) 2026-11-25.

What changed:
- **3a (code seed):** duplicate rule text removed from `src/combatRules.ts`, `src/rulesData.ts`, `src/combatEntries.ts` and `src/coreContent.ts`. New `fill()` key `overcharge_first` (first Overcharge step, from the rule numbers) is used by Full Repair. `REACTIONS_NOTE` keeps only the expiry sentence. Tech note drops the Full Tech sentence. The Movement and Free notes are removed (the steps serve). Dice note shortened, DICE table kept. Copied action names are `{action:id}` links. Pilot on-foot stat numbers are dropped from text (`pilotVitals()` is the source; a fill key would be a circular import). Structure 2 note left (not a duplicate). Reliable tag reads "Always deals at least {VAL} damage, even on a miss." `src/rules.ts` `freeGear` reads the `loadout_*` numbers. Repairs item reads "Repairs per Structure or Stress."
- **3b (database):** `supabase/migrations/20261125100000_content_cleanup_3b.sql`. (A) 36 `content_items` text updates and 3 guarded deletes, each only where `data` still equals the old seed. Rows the owner edited get a NOTICE to review (their `edited` override is untouched). `rule_notes_tech` is blank on hosted, so it is skipped. (B) `loadout_armour` 1, `loadout_weapons` 2, `loadout_gear` 3 added to `rule_number_limits` (range 0 to 6). `settle_pilot_gear` and `equip_pilot_gear` read them; the error text is built from the number. pgTAP: `supabase/tests/content_cleanup_3b.test.sql`.
- **Follow-up fixes (done, 550 tests pass):** gists go through `fill()`. A hidden action's `{action:id}` renders its seed name as plain text instead of blanking. Limit: if an action was renamed and then hidden, the seed name shows.
- **Checks:** reviewer found no blocking issues. `npm test` 549 pass. `npm run build` passes. `npx supabase test db` passes except `content_editor.test.sql`, which fails on a leftover local row `hb_tg_ux_probe_tag` in pack 7 (local data; clean it before relying on that test).

Checklist (from the audit, `content-audit/duplication.md`, scratch):
- [x] Reaction rule: `REACTIONS_NOTE` keeps only the expiry sentence. The Reactions section still reads it.
- [x] Full Tech: sentence removed from the Tech note. The Quick Tech list stays.
- [x] Overcharge: the step reads "Use {action:act_overcharge}." (Once a turn). The action is the only source of its text.
- [x] Overcharge first step: Full Repair uses `{overcharge_first}`.
- [x] Movement note and Free note removed (the steps serve).
- [x] Dice note shortened, DICE table kept.
- [x] Copied action names turned into `{action:id}` links.
- [x] Structure 2: note left as is, not a duplicate.
- [x] Pilot HP, Speed and E-defence: numbers dropped from text. `pilotVitals()` is the source.
- [x] Repairs-per-Structure item shortened.
- [x] Rule limits mirror `NUMBER_KEYS`: code copy kept (`rules.test.ts` checks it). Loadout limits added to the DB in 3b.
- [x] Pilot gear room: `rule_num_loadout_*` read by `freeGear`, `settle_pilot_gear` and `equip_pilot_gear`.
- [x] Can't take the same action twice: the rule lives only in the '1 full' step (2 quick drops it).
- [x] Lancer's Edge and Precision: references use `{action:act_lancer_s_edge}` and `{action:act_lancer_s_precision}`. The "(+2)" is dropped.
- [x] Repair restores all HP: Stabilize says "spend 1 Repair (see Rest)". Rest is the source.

Left from 0.2 (for later):
- Gists still hold copied action names in plain text (Shutdown, Disengage and Overwatch gists; the Overcharge step gist duplicates the action gist).
- Copied action names beyond the checklist were not hunted (e.g. Brace mentions Overcharge).
- Pilot mode Free step says "Core powers, systems and some gear use them". That over-states for pilots on foot.
- First submissions priced under the old loadout numbers can be charged differently if the limits change before approval.
- `content_cleanup_3b.test.sql` re-implements the migration loop, so it can drift from the migration.
- Owner-edited rows named in the migration NOTICE need a review on hosted.
- `content_editor.test.sql` fails locally on leftover row `hb_tg_ux_probe_tag` in pack 7. Clean the local data first.

### 0.3 Statuses, conditions and the remaining Definitions
**Resume here: 'Next session: start here' at the top.** Steps 2 to 12 are live (step 11 shipped as `0c7d1cf`). See the 4c, 4b and 4a blocks below.

**Batch 2026-11-25: steps 2 to 8 and 12, the 4b check and the 0.3 close-out (pushed as `c5c79c1`, 2026-11-25).** Built and checked locally. Reviewer pass: steps 6, 7, 8, 9, 10, 11 and 12; steps 2 to 5 were tested only.
- **4b browser check: pass.** Integrated and superheavy flags on a real mech (flag on and off, bracing), the mount type picker, data-only rows hidden from pickers, `weapon_mounts` gone. Minor, judged intended: the Mount types slot chips offer the hidden Ship-class size (`DefinitionPane.vue:49`, `defIds(...,true)`). Mount flags `integrated` and `superheavy` and `pilotCard` have no editor control (kept on save).
- **Step 2:** drone and deployable speed and Heat cap in `BONUS_REGISTRY` (`src/bonuses.ts:83`).
- **Step 3:** 'Only when' field on effects (`BonusListField.vue`), 120-character validation.
- **Step 4:** guard test in `src/hidden.test.ts` that pickers use `offered()`.
- **Step 5:** Used by ignores licence keys and lists biomods.
- **Step 6:** owners can delete unused biomods. Migration `20261125140000_biomod_delete.sql` (`delete_bionic`).
- **Step 7:** factions and commendations can't be deleted while in use. Migration `20261125150000_block_used_delete.sql` (before-delete triggers). `pilot_profile.test.sql` expects the refusal.
- **Step 8:** biomods keep personal stat bonuses in `effect_bonuses` and gain actions. Migration `20261125170000_biomod_actions_effects.sql`. `bionic_bonuses` is kept (step 9 drops it). `save_bionic` lost `new_bonuses` and gained `new_actions`. Combat page has a Biomods card.
- **Step 12:** pack imports no longer stamp `content_saves`. Migration `20261125160000_pack_imports_dont_stamp.sql`.
- **Scouted, nothing to build:** frame core `active_bonuses` has a reader (`src/mechData.ts:373-383`); the undeclared `pilot_*` warning exists (`src/contentEditor.ts:166`).
- **0.3 close-out (decisions, overturnable):**
  - Tag groups need no new Definitions kind: the hidden flag, `hideOnCard` and 'Show on combat page' cover it. `KEY_TAGS` (`src/pickerRows.ts:79`) stays in code. If wanted, the smallest version is a 'Key tag' checkbox on `TagForm`.
  - Core bonus mount hooks `cb_improved_armament`, `cb_mount_retrofitting` and `cb_integrated_weapon` stay in code.
  - Pilot gear group titles stay in code.
  - `pilot_evasion` stays dropped (flat 10, [rule-decisions.md](rule-decisions.md)).
- **Deploy window (closed 2026-11-25):** after `20261125170000` and before the Cloudflare build finishes, live biomod bonuses count twice and owner biomod saves fail. Migrated and pushed back to back, after backing up hosted `bionics` and `bionic_bonuses` (scratch: `hosted-bionics-backup-20261125.json`, `hosted-pre-step9-10-20261125.json`, and a `-functions-` file from the same date).
- **Checks:** `npm test` 570 (47 files), `npx supabase test db` 1090 (39 files), `npm run build` clean.
- **Known minor, not fixed:**
  - (done, step 13) No 'New' button for factions and commendations. Built (`newAbove` in `ContentEditorView.vue`), pending commit. `?cat=...&item=new` worked before.
  - Biomod rich text toolbar buttons are 34px wide on mobile (existing note).
  - The pane header icon is stale until save after changing a commendation icon.
  - `bionicStats` shows replace and overwrite effects as a plain +n.
  - The test copies the migration SQL for 4c and 8: keep each copy in step with its migration.
  - Server validation of biomod actions is only "a list of objects" (owner only).
- **Skipped, ask the developer:** what granting talent ranks or licences means; export and import for Definitions, factions, commendations and biomods (low priority). Pilot gear grants were decided in step 11.

#### Steps 9 to 11 (2026-11-25)
**Steps 9 and 10 pushed as `b1071df`. Step 11 shipped as `0c7d1cf`** (reviewed and browser-checked before the push). Steps 9 and 10 passed the deploy checks (Cloudflare build succeeded, CI green). Scratch backups (may be gone): `hosted-bionics-backup-20261125.json`, `hosted-pre-step9-10-20261125.json` and a `-functions-` file from the same date.

- **Step 9:** `20261125180000_drop_bionic_bonuses.sql` drops `bionic_bonuses`. The site has read biomod stat bonuses from `bionics.effect_bonuses` since `20261125170000`.
- **Step 10:** commendation requirements. `20261125190000_commendation_requirements.sql` extends `unmet_requirements` and `guard_submit_rules`. Awards come from `pilot_commendations`, so hidden commendations count. Client: `'commendation'` in `REQUIREMENT_KINDS`, a picker in `RequirementListField.vue`, validation in `src/contentEditor.ts`. A pilot who loses a commendation keeps the item and gets a `Needs {name}.` rule problem on the sheet; unrelated saves are not blocked. `20261125200000_block_required_commendation.sql` refuses to delete a commendation that an item or biomod requires (hide it instead).
- **Step 11:** `20261125210000_grants_on_mods_and_gear.sql` (on hosted; shipped `0c7d1cf`). `sheet_rule_problems`: equipped pilot gear grants its equipment. A fitted weapon mod grants only if it is attached to an equipped weapon (its key place has a non-draft weapon in `mech.mounts`) and its own requirements are met. `granted_by` names mods and gear. Client mirror: `grantingSources` in `src/mechData.ts` and `src/rules.ts`. Editor: an 'Equipment' fold (GrantFields: integrated, special_equipment, replace_integrated) on `ModForm.vue` and `GearForm.vue`, validated by `checkGrants`. Developer decision: mods grant nothing unless on an equipped weapon (overrides plan question 5). Checks: `npm test` 578, `npx supabase test db` 1130 (42 files). Reviewer and browser check passed.
- **Step 11 known limits (not fixed):**
  - Weapon places are not checked against the built frame on the server. A hand-built sheet can put a weapon in a place the frame lacks and hang a granting mod on it. This was already true for weapon grants; sizes and places are client-only.
  - The combat view (`src/combatLoadout.ts`, `src/views/CombatView.vue:40`) catalogue lacks `awarded`, so a commendation-gated mod's grants are not shown there.
  - The mod-point bonus value in `sheet_rule_problems` (about line 120, `\d{1,9}`, migration area `20261121140000`) uses a Postgres `\d` regex that can match non-ASCII digits and raise a raw error.
  - The remove button on added items in `ItemIdListField` is 41px wide at 360 (3px short).
  - Six copies of the grants computed in forms; they could share one function.

**4c: pushed 2026-11-25** (`5f3f1ef`). Migration applied to hosted before the push (the three tag rows were checked read-only first; the Armour label was not queried).
- **Migration** `supabase/migrations/20261125130000_content_cleanup_4c.sql` (applied to hosted). Test `supabase/tests/content_cleanup_4c.test.sql`. The test pastes the migration's SQL and inserts its own `content_packs` row, so keep the two in step (a comment in the test says so).
- **What it adds:** `pilotCard` on `gear_types` Armor and Gear (Weapon has none); `hideOnCard` on tags `tg_gear`, `tg_pilot_weapon`, `tg_personal_armor` (in `edited`, so a pack re-import keeps it; tags come from LCP import, so the update changes nothing where those rows are missing); the 'Armour' label on `gear_types` and `system_types` Armor (ids stay `Armor`).
- **Code:** `HIDDEN_TAGS` and `PILOT_TYPES` removed from `src/itemDetails.ts`; `cardHiddenTags` in `src/gameData.ts` (read from the tag's loaded data, like `hidden` and `combat_page`); `onPilotCard` in `src/definitions.ts`; 'Hide on item cards' checkbox in `TagForm.vue` (saves `false` rather than omitting the flag, like the other flags; every reader checks `=== true`); `GearForm.vue` and `SystemForm.vue` use `defLabel` for Armour. `src/definitions.ts` DEFAULT_DEFINITIONS and `src/definitions.test.ts` updated. `src/editorStore.ts` `loadList` maps pilot_gear and systems types through `defLabel` (test in `src/hidden.test.ts`). `EditorPane.vue` takes a `knownTags` prop (full tag map) for `ctx.tags`, which removes the false "Tag 'tg_personal_armor' doesn't exist" warning (pickers keep the filtered list).
- **Checks 2026-11-25:** `npx supabase test db` 35 files, 1059 tests pass; `npm test` 560 of 560 (47 files) pass; `npm run build` clean.
- **Reviewer:** no critical issues, no security problems. Important 1: `import_lcp` does `set data = excluded.data` on conflict, so a re-import drops `hideOnCard` from `data`; fixed by storing the flag in `edited` (read as `edited ?? data`, `src/catalogue.ts:60`). Cost: those three tags show an Edited badge (`ContentEditorView.vue:312,338`). Important 2: tags already edited in the editor would miss a data-only flag; the `edited` form covers it. Minor: raw tags may flash before tags load (accepted, as for `hidden`).
- **Browser checks:** owner pass at 320x640, 360x640 and 1280x800: no overflow, 44px touch targets on mobile, contrast passes (hide-on-card label about 7.9:1; Armour text 7.85 to 15.49). Player pass as `test-pilot` at 360x640 and 1280x800: all 5 items passed, pilot gear only. Tag chip rerun against corrected local data passed at 360x640 and 1280x800: gear, pilot weapon and personal armour chips hidden on pilot gear cards and pickers, other tags still shown, no overflow, owner tag form shows 'Hide on item cards' checked for the three tags.
- **Caveat:** all three tags also have `hidden: true` in the DB, so the browser check cannot prove `hideOnCard` alone hides them. The unit test in `src/itemDetails.test.ts` covers that.
- **Known minor points, record only:** reverting one of the three tags to pack drops the hide flag; pack text changes to those three tags are shadowed by `edited`; `pilotCard` has no editor control; the player check covered pilot gear only, not mech items.
- **Next steps:** see 'Next session: start here' at the top of this file.
- Check-live items (section 1 and STATUS.md) stay open.

**4b: done and pushed 2026-11-25** (code `f7207ff`, docs `a8fc866`). Browser check passed 2026-11-25 (see the batch block). Migration `supabase/migrations/20261125120000_content_cleanup_4b.sql` is on hosted (applied before the push).
- **Mount flags:** `integrated` on the 'Integrated Auxiliary' mount type and `superheavy` on 'Superheavy', both in `mount_types` `data`.
- **Data-only rows** (seeded hidden, `dataOnly`): `weapon_sizes` 'Ship-class'; `weapon_types` 'Special', 'Spool Weapon', '???'. `DATA_ONLY_MOUNTS` and `DATA_ONLY_WEAPON_TYPES` are removed from `src/contentEditor.ts`.
- **`weapon_mounts`:** the migration deletes any rows and removes the kind (sizes and mounts share one list, seeded as `weapon_sizes`).
- **Code:** `mountsWith` and `mountIs` in `src/definitions.ts` replace the Integrated Auxiliary and Superheavy literals in `mechData.ts`, `rules.ts`, `equipment.ts`, `combatLoadout.ts` and `MechLoadout.vue`. `ANY_SIZE` is removed from `MechLoadout.vue`.
- **Left in code on purpose:** `Main/Aux` (named core bonus), `Flex` in `allowedSizes`, the `bracingMount()` Heavy rule.
- **Checks:** `npm test` 556 pass, `npm run build` passes, `npx supabase test db` passes (34 files). Reviewer: no critical issues; the two important ones are fixed. Not browser-checked (section 4).
- **Known minor points, not fixed:** weapon sizes and mount types share ids, so unflagging Superheavy changes bracing; with no flagged mount, the integrated and superheavy bonuses add no mount; an owner can untick Hidden on the dataOnly rows in the Definitions pane, which offers them in pickers.

**4a: done and pushed 2026-11-25** (code `17f91be`, docs `6f35d38`). Migration `supabase/migrations/20261125110000_content_cleanup_4a.sql` is applied to hosted before the push.
- **Status groups are a Definitions kind**, `status_groups` (label = card title, `data.icon`, `data.mode` mech or pilot). Seed: cover 'Cover and stealth', conditions 'Conditions', other 'Other statuses' (mech), pilot 'On foot' (pilot). Statuses stay `rules` rows in section `statuses`. The combat page builds mech cards from mech groups and the On foot card(s) from pilot groups. Down and out shows only in pilot mode. A hidden group hides its statuses. `delete_definition` refuses a group used by a status rule (effective group, `coalesce(edited, data)`). Editor: a 'Shown in' select per group row.
- **Damage type guide text** is `damage_types` `data.text` ('Guide text' in Definitions). The combat guide lists every non-hidden damage type, so an owner-added type appears. All six damage types start with empty guide text, which the owner can fill in the editor (developer, 2026-11-25). The four rule rows `rule_attacks_kinetic/explosive/energy/burn` are deleted.
- **Removed code:** `STATUS_CARDS`, `STATUS_GROUPS`, `DAMAGE_TYPES`, `ON_FOOT_ROWS`.
- **Before the hosted apply:** run `select distinct data->>'group' from content_items where kind='rules' and data->>'section'='statuses'`. Every value must be cover, conditions, other or pilot, or that status vanishes from the combat page. Then apply and read the NOTICEs (owner text on the four deleted rule rows is copied into the damage type).
- **pgTAP:** `supabase/tests/content_cleanup_4a.test.sql` holds a copy of the migration's data block. Keep it in step with the migration.
- **Checks:** `npm test` 555 pass, `npm run build` ok, `npx supabase test db` 33 files 1037 tests pass. Reviewer: no blocking issues. Browser (qa, 360 and 1280): pass.
- **Left open from 4a (record, not blocking):**
  - Editor buttons Save, Discard and Delete are 28px at 1280, and dialog buttons 36px (editor-wide, pre-existing).
  - The 'Hidden from players' hint is not linked to its checkbox.
  - New-row problems only show after editing.
  - A new definition id can contain spaces and capitals.
  - The editor gives no warning when a hidden status group still holds statuses.
  - `damageTypesHtml` puts the label into HTML unescaped (owner-only).
  - A small race between the in-use count and delete for status groups.
  - Local `npx supabase db reset` leaves 0 rules rows and test-gm as gm, not owner. Browser tests need the seed and a role change.

Open items from the audits (`content-audit/constants-and-matrix.md`, scratch):
- (done 4a) `STATUS_CARDS` (`src/rulesData.ts:20`) hard-coded the group ids and the `pilot` bucket. Status groups are now a Definitions kind, and a new group can be added in the editor.
- (done 4a) `DAMAGE_TYPES` (`src/combatRules.ts:127`): the guide showed only the 4 rule rows. It now reads every visible `damage_types` row with its text.
- (done 4c, pushed) `PILOT_TYPES` (`src/itemDetails.ts:78`) duplicated `gear_types`. `HIDDEN_TAGS` (`src/itemDetails.ts:~35`) is now the `hideOnCard` tag flag (`combat_page` already exists).
- (done 4a) `ON_FOOT_ROWS` (`src/combatRules.ts:258`) was dead code and is removed.
- (done 4b) `Integrated Auxiliary` and `Superheavy` are flags on the `mount_types` rows, read through `mountIs`/`mountsWith` in `src/definitions.ts`. `Main/Aux` (`src/mechData.ts:153`) is the named core bonus `cb_mount_retrofitting`, left in code.
- (done 4b) `DATA_ONLY_MOUNTS` and `DATA_ONLY_WEAPON_TYPES` are seeded as hidden `dataOnly` rows (`Ship-class`, `Special`, `Spool Weapon`, `???`).
- (done 4a) **Statuses and conditions become editable and addable.** Status groups are Definitions (4a). Statuses are `rules` rows in section `statuses`, so an owner adds, edits, hides and deletes them in the Rules tab, and the combat page reads them from the database. Conditions have no separate kind (they are the `conditions` group). Hidden-group and delete guard are in the 4a block.
- (done 4a) **Combat guide follows the database:** the damage type rows come from the Definitions (`damage_types`, with guide text). Anything else the guide reads from code constants should read the database too (check with the 0.1 sweep).
- Other Definitions work (4b and 4c): tag groups; `weapon_mounts` only if it needs to differ from sizes; the leftovers `DATA_ONLY_MOUNTS`, `DATA_ONLY_WEAPON_TYPES`, pilot gear group titles in `archive.ts`, the Armor/Armour label tweak and the mount ids in `mechData.ts` (not `Flex`, not `bracingMount()`). Where a rule truly needs code and will never change, leave it in code and write that down. Decided in the batch: tag groups stay in code (see the batch block).
- (done) Frame size error text follows the Definition rows. Show "Used by n" on each Definitions row before trying to delete.
- Done when: an owner can add a damage type, a status or a condition, or a mount type in the editor and it works on the sheet, archive and combat page with no code change.

### 0.4 Building blocks on the kinds that need them
Open items from the audits (`content-audit/constants-and-matrix.md`, `content-audit/fields.md`, scratch):
- **Undeclared `pilot_*` effects are silently ignored.** No reminder on the pilot sheet or the mech sheet (`src/bonuses.ts:107`, `src/mechData.ts:354`, `src/gameData.ts:311-326`). The editor does not warn either (`src/contentEditor.ts:170`).
- `pilot_evasion` has no registry entry and no sheet handler (`src/contentEditor.ts:170`).
- `melee`, `deployable_speed`, `deployable_heatcap`, `drone_speed`, `drone_heatcap` are handled in code with no registry entry (`src/equipment.ts:126, 151`).
- Frame core power `active_bonuses` has an editor field (`CoreSystemFields.vue:79`) and no sheet reader.
- Core bonus mount hooks are code: `cb_mount_retrofitting`, `cb_integrated_weapon` (`src/mechData.ts:150-167`). The registry already has `add_mount`, `replace_mount`, `superheavy_mounting`.
- Data-only, stays data-only (no reader, no input): `skirmish`, `synergies`, `counters`, `other_art`, `y_pos`, `image_url`, `active_synergies`, `ammo`, `filter_ignore`, `stats.sensor_range`, `stats.save`. Don't add inputs for them.
- **Biomods** (decided): 
  - (done, step 8) Actions on biomods: migration for the storage (`bionics` has no actions column; see `save_bionic`, `bionic_bonuses`), the form field (the existing ActionListField), and the sheet reading biomod actions the way it reads them on other kinds.
  - **Biomod grants must be as diverse as the biomods are** (developer, 2026-11-24): one biomod might give a pilot a weapon, another +1 to a mech stat, another a pilot stat bonus, a talent rank, an action or a piece of gear. A biomod gets everything the other kinds can carry, through the same shared fields: the full effect registry (mech stats, pilot effects and conditional reminders, with the grouped picker, search and summaries), every grant kind the engine already honours (built-in and optional equipment: pilot weapons, pilot gear, mech weapons and systems, deployables, extra mounts, talent ranks and licences once those grants exist), actions, and requirements. Today a biomod only has the limited stat list in `bionic_bonuses` (plus a few grants): replace it with the same `bonuses`, `grants` and `actions` data shape other kinds use, stored with the biomod (migrate the existing `bionic_bonuses` rows into it, keep pilots' owned biomods working, and keep the mod-point and manna costs). The sheet must read all of it for a pilot who owns the biomod, and the editor shows the same plain summary line per effect or grant. Test with a biomod that grants a pilot weapon, one that grants +1 to a mech stat and one that does both.
  - Deleting biomods: see 0.5.
  - Update database types, tests and the security review for the migration.
- **Conditional effects with a reminder on most things.** The effect editor had a condition field that was hidden from the editor ("Trimmed from the effect editor: the condition field", data kept). Bring it back: an effect can carry a condition text and then shows on the sheet as a named reminder, not counted. Offer it on every kind that carries effects (frames, weapons, systems, mods, gear, talents, core bonuses, biomods). Reuse `bonusReminder`. If it needs a new kind of calculation, that is out of scope: reminder only.
- (done, step 11) **Grants on mods and pilot gear:** the sheet (`src/mechData.ts`, pilot code) must read them first (today only weapons and systems are read), then add the form field. Also: grant a pilot weapon or gear, grant a talent rank or licence.
- **Registry:** every effect the engine can already count must work from a registry entry alone, with no code change (check `BONUS_REGISTRY` against what `mechData.ts` handles). An entirely new calculation is out of scope. Add the missing pilot-side reminder for undeclared `pilot_*` effects (`src/gameData.ts`).
- (done, step 10) **Commendation requirements (decided by the developer, 2026-11-24):** any kind that takes requirements (frames, weapons, systems, mods, gear, talents, core bonuses, biomods) can require a commendation. Add `'commendation'` to `REQUIREMENT_KINDS` (`src/gameData.ts:47`), a commendation picker in `RequirementListField.vue`, and validation in `src/contentEditor.ts` (the commendation must exist). `unmetRequirements` (`src/rules.ts:101`) must receive the pilot's commendation ids (they live in `pilot_commendations`, not on the sheet: see `src/commendations.ts` and `src/pilots.ts`), so every caller that evaluates requirements has to pass them: the pickers, the mech page rule check and the pilot rule problems. Read how the submit-time SQL check evaluates requirements first (`supabase/migrations/20261121140000_homebrew_rules.sql`, `20261122120000_editable_rule_numbers.sql`) and extend it if it checks them, with pgTAP tests and a security review. **Losing a commendation:** a pilot who already owns the item keeps it and it is **flagged on the sheet** as a rule problem (`Needs {commendation name}.`, site-text style) so a GM can see it; it does not block saving unrelated changes, and a picker shows `Needs {name}` for anyone who doesn't have it. Check how existing unmet requirements on owned items surface today (talent, licence, core bonus) and reuse that path. Tests: requirement met, not met, commendation removed after buying, hidden commendation (a hidden commendation must still count for pilots who have it), a deleted commendation (the faction/commendation delete cascade removes the award: decide whether the requirement then reads as unmet or the commendation is blocked from deletion while required; prefer blocking deletion, and add the check to the in-use guard).
- Used by that also scans biomods and reads sensibly for licences. (Duplicate for the simple kinds is not needed.)
- Done when: the capability matrix's empty cells are only the ones ruled out above, biomods can grant stat effects and actions, and a homebrew variation short of an entirely new calculation can be built from the editor alone.

### 0.5 After-launch completeness
- (done, batch step 6) **Biomods can be deleted**, not only hidden (guard against in-use like `delete_content_item`; pilots who own it are the in-use case).
- (done, batch step 7) Decide and build the faction and commendation delete safety (block when in use, or keep the warning); commendations required by an item must block deletion (see commendation requirements).
- (done, batch step 4) Hidden filtering must cover any picker added later: add a test that fails if a picker reads a content list without `offered(...)`.
- Low priority, last: export and import for Definitions, factions, commendations and biomods.

### 0.6 Missing editor inputs and consistency
- (done) Add the editor fields found in 0.1: weapon `no_mods`, deployable activation and range, action range and damage, deployables on pilot gear. Faction description skipped: nothing reads or saves it.
- (done) A hidden value on an existing item shows its label, not the raw id, in the picker.
- (done) Tag preview shows the "Show on combat page" flag.
- Old text fixes, decided 2026-11-25 (see [rule-decisions.md](rule-decisions.md)): "Reliable X" reads "Always deals at least X damage, even on a miss." (no dice or "rolls" wording). Tag text keeps US spelling (Armor-Piercing, Personal Armor, E-Defense). Applied in step 3 (0.2, 2026-11-25).
- (done) Retry button on every page's load-error notice, not only Combat.

### 0.7 Verify everything that was never opened in a browser
- **Done 2026-11-25 (step 13).**
  - Browser sweep passed at 360 for every Campaign and Mech category, Definitions, and the Weapon, Mod, Biomod and Faction forms. A bug was found and fixed: no New button for factions and commendations (built, pending commit).
  - Security audit by the reviewer: no Critical or Security issues. Local suite 1130 pgTAP tests. Hosted: 80 edited rows all valid, every security definer function has a fixed `search_path`, `weapon_mounts` empty, `bionic_bonuses` dropped.
  - Not covered: the commendation form in a browser before the fix; player-role checks of pilot gear, talents, tags, actions and rules tabs; `profile.update` `checkWrite`.
- **Nits, recorded, not fixed:**
  - `src/hidden.test.ts` pattern `offered\(|\.hidden` is loose. Hand-filtered pickers are outside the guard: `RankPanel.vue:136`, `CoreBonusPanel.vue:68`, `ReputationPanel.vue:30`.
  - Faction name has no length limit (commendations do).
  - `game_definitions_freeze_id()` is executable by `anon` and `authenticated` (harmless).
  - Several `private.*` security definer functions are executable by `anon` through default grants, and schema usage blocks them. A blanket `revoke execute on all functions in schema private` would remove that dependence (open developer decision).
  - `private.add_exotic_tag` and `private.backfill_exotic_tag` have no fixed `search_path` (cosmetic).
  - `sheet_rule_problems` is callable by any logged-in user, with size caps.

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

**Check live first (postponed 2026-11-25: the developer can't do it now; still open):**
- Combat page after step 3 (0.2), not opened in a browser since: Overcharge, Full Repair, Reaction, the Movement and Free notes and the Reliable tag should read once and correctly; no raw `{...}`, no blank text. Mech and Pilot modes: Tags card lists 35 tags with no empty card; no raw `{...}` text anywhere; Overcharge, Reaction, Engaged and the pilot gear line read once and correctly; the Quick Tech note is blank (the owner's own edit) so check it is acceptable.
- Content editor as owner: tab groups and the Tags, Actions, Rules and Definitions tabs; Definitions lists 72 rows in 12 kinds; hide and restore a test item and see the Saved by line; Duplicate; the effect picker.
- Player login: hidden items gone from pickers and the archive, owned items still shown.
- `npm run build` output has no `lcp.ts`/`contentEditor.ts` bundle surprise on the content page.
- Hosted `content_saves` fills as the owner edits; the first pack import stamps every row (see section 2).

## 2. Bugs and suspect behaviour to investigate
- (done) **Frame-size id counted twice.** The `definitionProblems` dedupe is removed. The "Fix 2 problems" report couldn't be reproduced; the likely cause is two new rows both typed `01`.
- (done) **Conflict Reload leaves a "Leave site?" prompt.** Reload skips the guard in `EditorPane` and `DefinitionPane` (via `ConflictNotice`'s `reload` event). Closing the tab still asks.
- **Owner's first pack import stamps every row** in `content_saves` as an editor save. Decided 2026-11-25 and built in the batch (step 12).
- **Trigger raises if the signed-in user has no profile row** (`private.stamp_save` foreign key). Unreachable for real owners; matters only for a service-role call carrying a user JWT.
- **Seed ids are positional** (`SEED_IDS`, `ACTION_IDS`): a new seed row needs an id placed to match its `add()` call. Snapshot tests fail until updated on purpose. Consider keyed ids.
- (done) **Frame size error text is fixed** ("Size is ½, 1, 2 or 3.") and goes stale if the owner adds a size. Now built from the `frame_sizes` Definition rows (`contentEditor.ts`), so an added size shows up.
- **Duplicate carries built-in core checks** for official frames (fixed, tested) but the first edit of an official frame's core checks writes a full copy that no longer follows `CORE_CHECK_BONUSES`. Never confirmed that the first edit saves its own copy (the reviewer could not tell).
- (done) **Hidden official value shows its raw id** in an item's picker (for example "Heat") instead of its label.
- (done, step 5) **Used by** matched exact strings, so a manufacturer code could match a weapon's `license` text. It now scans biomods and ignores licence keys. "Used by" still reads oddly for licences ("Licence unlocks 7 items" counts one more than the six listed).
- (done, step 7) **Delete of a faction or commendation in use** is blocked (before-delete triggers). Before this, it cascaded to pilot reputation and awarded commendations.
- A very long faction name is accepted (only unique, no length check).
- **Phase 2 leftovers:** the Full Repair text still says "Overcharge goes back to 1 Heat" (no placeholder for the first step), and `REACTIONS_NOTE` still repeats the Reaction step's general rule: both are in scope (0.2). The combat guide's damage type rows still come from `DAMAGE_TYPES` in `src/combatRules.ts` and do not follow Definitions: in scope (0.3). The Engaged status is being removed by the developer, so its duplicate row and doubled-parentheses title need no work.
- (done) Tag preview shows the "Show on combat page" flag.
- Old wording in core text: "Reliable X" says "rolls less damage" (dice wording the developer is deciding), tags use US spelling ("Armor-Piercing", "Personal Armor", "E-Defense") against the site's "armour" and "E-defence".
- (done) Undeclared `pilot_*` effects show as uncounted reminders, and the editor warns they aren't counted. Pilot gear effects are still not read (step 6).
- A brand-new effect type that changes anything other than a mech or personal stat still needs code in `src/mechData.ts`: out of scope, the developer hardcodes entirely new mechanics.
- `lcp.ts` now imports `contentEditor.ts` at runtime: check the bundle size of the content/import page.
- LCP import validates actions and rules with an empty tag and stat context, so unknown tags or stats warn at most.
- Hidden in `loadKind`: **not filtered centrally** (it would break lookups). Pickers call `offered(list, keep)` in `src/catalogue.ts:42`. A new picker must call it or hidden items leak. Guarded by a test in `src/hidden.test.ts` (batch step 4). Nothing in the database blocks awarding a hidden commendation.
- (done) Retry is on every page's load-error notice (`retryCatalogues()`).
- Before `pilot_stats` loads, `isPilotBonus` treats personal stats as mech bonuses (corrects on load).

## 3. Not built (decided or offered, left out)
Out of scope (developer, 2026-11-24): stats, skills and stat icons (`PERSONAL_STATS`, `MECH_SKILLS`, `STAT_ICONS`, `MAX_SKILL` and the RequirementListField ranks stay in code) and entirely new mechanics. Everything else below that is not marked otherwise is in scope, see section 0.
- **Phase 4 building blocks still to build (0.4):** grant a pilot weapon or gear, grant a talent rank or licence, conditional effects with a shown reminder, biomod actions and biomod effects on pilot and mech stats. Out of scope: changing a pilot or mech skill, a new stat with its own sheet row (stats and skills stay as they are).
- (done, step 11) **Grants on mods and pilot gear:** the sheet reads them now (equipped weapons, systems, pilot gear, and mods on an equipped weapon).
- **Actions on biomods:** done in step 8, see 0.4.
- **Requirements on core systems:** not needed (developer decision, 2026-11-24).
- **Definitions leftovers in code:** the `Flex` rule in `allowedSizes` and `bracingMount()` in `src/rules.ts` stay in code on purpose (the developer: those rules never change). Done in 4c (pushed): the Armor/Armour label (`defLabel` in `GearForm`/`SystemForm`). Left in code on purpose: the plural gear group titles (`GEAR_TITLES` in `archive.ts`, `GEAR_GROUPS` in `combatLoadout.ts`, `CATEGORIES` in `PilotLoadout.vue`). `Main/Aux` stays in code (named core bonus). Done in 4b: `DATA_ONLY_MOUNTS`, `DATA_ONLY_WEAPON_TYPES`, the Integrated Auxiliary and Superheavy ids, `weapon_mounts` removed (the code uses one list for sizes and mounts, seeded as `weapon_sizes`), data-only values seeded.
- (done) **Fields with no editor input** (audit, 2026-11-25): `no_mods`, deployable `activation` and `range` now have inputs. The rest are data-only, with reasons in [game-content.md](game-content.md#content-editor-forms).
- **Rare kinds that don't exist:** reserves, backgrounds and NPCs are not content kinds (out of scope until they exist).
- **Used-by counts before delete** on Definitions rows (the refusal appears only after trying).
- **Duplicate** is not offered for manufacturers, rules or site kinds: not needed, those kinds stay simple.
- Pilot Overwatch stays separate from Overwatch (developer decision, 2026-11-24). Not a task.
- "What changed" history beyond the last save (decided: last save only).

## 4. Never browser-checked (code and tests only)
Step 13 (2026-11-25) passed the browser sweep for every Campaign and Mech category, Definitions, and the Weapon, Mod, Biomod and Faction forms at 360 (see 0.7). The items below that it covers are checked; the rest are not.
- Phase 4c (pushed 2026-11-25): owner and player browser checks and the tag chip rerun passed (see the 4c block). Not yet covered: mech items in the player check, and `hideOnCard` alone without the hidden flag (unit test only).
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
- Update `STATUS.md` and [game-content.md#content-editor](game-content.md#content-editor) after the next round (STATUS and history.md were updated at deploy). The agents added an entry per phase to content-editor.md; read it once for contradictions and merge the per-phase entries into one description.
- Delete `docs/content-editor-cleanup.md` sections that are now history, or mark phases done.
- Types: regenerated against hosted after the migrations; identical to the hand-edited file.
- Untracked `.playwright-cli/` is gitignored. Reviewers left test pilots, rows and stamps locally; the leftover `content_saves` row for `mf_drake` pre-dates them.
- Reviewers' turn limits: give a UX review one narrow job and tell it to report by turn 45.
