# Handoff: pilot inventory (in progress, 2026-11-21)

Read CLAUDE.md first. Work rules that matter here: the main session plans and reviews, custom agents build
(`database-architect`, `ui-designer`, `ux-reviewer`, `security-auditor`, `explorer`; fallback `general-purpose` with
`model: sonnet`). Graphify first. Ask the developer before pushing (pushing deploys) and before applying a migration to the
hosted database. The hosted database must get a migration **before** the site code that needs it is pushed.

## Where things stand

- Last commit: `9bd7d8f` (item descriptions and variable damage), pushed and deployed. Every migration through
  `20261121100000_backfill_service_record` is on the hosted database.
- **Uncommitted, database side done:**
  - `supabase/migrations/20261121110000_pilot_inventory.sql` (applied to the **local** database only)
  - `supabase/tests/pilot_inventory.test.sql` (40 tests; the whole suite was 19 files / 627 tests, all passing)
  - `src/lib/database.types.ts` (hand-added `equip_pilot_gear` returning `string` and `settle_pilot_gear` returning `Json`;
    `npm run types` reads the hosted DB, so rerun it after the hosted migration)
- **Frontend: not started.** No source files have been changed for the inventory yet.
- **The local site is currently broken for pilot loadouts:** the local migration converted every sheet from `pilot_gear`
  to `owned_gear`/`equipped_gear`, but the frontend still reads `pilot_gear`. Expect empty loadouts and type/test failures
  once the frontend work starts, until it's finished. The hosted site is unaffected (migration not applied there).
- **Security audit of the migration: not done.** It was started and stopped before reporting. Run it again (brief below).
- Untracked `docs/copy/` is the developer's own; never commit it.

## The feature (decided by the developer)

- Pilot items (content kind `pilot_gear`: armour, weapons, gear) are **owned** once bought.
- **Equipping and swapping owned items needs no GM approval**, including while a change is open.
- **Buying goes through a change** (normal pending change → GM approval) and spends manna.
- **Price per item**, set by owners in the content editor; **100** when unset.
- A new pilot's **first full loadout is free**: 1 armour, 2 weapons, 3 gear. Anything else costs its price.
- **Existing pilots own what they had equipped, free** (done by the migration's backfill).
- **No refunds.** A player can't remove an owned item in a change. GMs can remove items.
- **Descriptions** (140 characters, the "ItemNote" feature from `9bd7d8f`) now belong to the **owned item**, so they follow
  it when swapped. Editing one still needs approval (it's part of the sheet).
- Duplicates allowed (two copies of one item, each with its own key and description).
- Mech parts are unchanged.

## Database design (as built, in 20261121110000_pilot_inventory.sql)

- **Sheet JSON:** `owned_gear: { key: string; id: string; notes?: string; free?: boolean }[]` (key = per-copy uuid) and
  `equipped_gear: string[]` (owned keys). `pilot_gear` and `pilot_gear_notes` are removed.
- **Price:** `manna_cost` read from `coalesce(edited, data)` (`edited` is a full replacement, like `loadKind`'s
  `edited ?? data`). Valid = JSON whole number, 0 or more; anything else = 100. Unknown or missing content ids cost 0.
- **`public.settle_pilot_gear(proposed jsonb, live jsonb, first_approval boolean) returns jsonb`:** sets each owned
  entry's `free` and rebuilds `equipped_gear`. In `public` (not `private`) because `guard_submit_rules` runs as the player.
  Execute granted to `authenticated` only.
  - First approval: walking `owned_gear` in order, the first 1 Armor, 2 Weapon, 3 Gear (by content type) are free;
    everything else (unknown ids, other types) is not.
  - Approving a change: free only if the live sheet has the same key with the same id and `free=true`; a repeated key is
    free at most once; new keys aren't free.
- **`private.settle_gear_on_approval()` + trigger `characters_settle_gear`:** after `status` changes pending → approved
  (covers `approve_pilot` and a GM setting status by hand). Security definer.
- **`public.approve_change`:** copied from `20261116225551_approval_hardening.sql`; now locks the live sheet and writes
  `settle_pilot_gear(proposed_sheet, live, false)`. The result's `equipped_gear` is the **live** list filtered to keys
  still owned: proposals can't change what's equipped, and newly bought items arrive unequipped.
- **`private.guard_submit_rules`:** copied from `20261121090000_starting_manna_2000.sql`; adds
  `default_gear_price constant integer := 100`, the gear spend (every non-free owned item's price, free worked out the same
  server-side way), and a no-refund check: a player's change must keep every live owned entry with the same key and id,
  else "Owned pilot gear can't be removed: {Item}." GMs aren't checked. The restricted-content id check still finds ids
  inside `owned_gear`.
- **`public.equip_pilot_gear(target_character_id bigint, keys text[]) returns timestamptz`:** security definer,
  `search_path ''`, revoked from public/anon, granted to authenticated. Caller: the pilot's player or any GM/owner; the
  pilot must be `approved`. Keys must be live owned, no duplicates, ≤1 Armor / ≤2 Weapon / ≤3 Gear (an item that isn't known
  Armor/Weapon/Gear is refused). Null keys = unequip all. Writes only `sheet.equipped_gear`. Returns the sheet's `updated_at`. Errors (P0001):
  `Not your pilot.`, `Only an approved pilot can change equipped gear.`, `Not owned.`, `Equipped twice.`,
  `Only 1 pilot armour fits.`, `Only 2 pilot weapons fit.`, `Only 3 pilot gear fit.`, `Not pilot gear.`
- **`character_sheets_updated_at` trigger recreated:** ignores `equipped_gear`-only changes, so equipping doesn't move
  `updated_at` (otherwise a player's own pending change would go stale on every equip).
- **Backfill** (`private.gear_to_owned`, `private.backfill_owned_gear()`, execute revoked): every sheet without
  `owned_gear` gets one entry per old `pilot_gear` id (new uuid key), all equipped; approved/dead pilots get `free=true`,
  pending pilots leave `free` unset for first approval. Notes move from `pilot_gear_notes` by recomputing the slot key
  ("Type:index" within its type, in `pilot_gear` order). Every `pending_changes.proposed_sheet` is converted too; matching
  id + occurrence reuses the live key and free flag; extra ids get new keys, `free=false`. Re-runnable (skips rows that
  already have `owned_gear`). The `updated_at` triggers are switched off while it runs.
- **`pilot_sheet()`** unchanged: it now also exposes `owned_gear` and `equipped_gear` (nothing private).
- Audit fixes (2026-11-20): first approval trims equipped_gear to 1/2/3 by type; a pilot approved before (`approved_at` set) moved back to pending by a GM keeps only items already free, capped 1/2/3; the guard adds `Unknown item ({id}).` for new owned entries not in `pilot_gear` and `Owned pilot gear has a missing or repeated key.`; the price read is a nested case (a string `manna_cost` costs 100).
- Follow-up fix: trigger `private.guard_sheet_free_flags` (players only) strips `free` on insert, restores it from the saved sheet by key+id on update, and refuses dropping an entry that already had a `free` flag. `settle_gear_on_approval` also treats any existing `free` flag as "approved before". Known leftover (GM moving an approved pilot back to pending by hand only): the submit check prices that pilot as brand new.

## Frontend work to do (one batch for `ui-designer`; it has no shell, so the main session runs tests/builds)

1. **Logic in `src/rules.ts` (pure, unit-tested):** `GEAR_PRICE_DEFAULT = 100` (comment points at the new migration), a
   `gearPrice(item)` helper, `freeGear(owned, typeOf, live | null)` mirroring the server rules exactly, and gear in
   `mannaSpent` (non-free owned items' prices). Update every caller: `PilotManageView.vue`, `GmChangeView.vue`,
   `GmPilotsView.vue`, the GM change review's balance and cost. Approved pilots need the live sheet for free flags.
   `src/rules.test.ts`: change the prices-check import to `../supabase/migrations/20261121110000_pilot_inventory.sql?raw`,
   add a check that `default_gear_price` equals `GEAR_PRICE_DEFAULT`, and add tests for `freeGear` (both cases,
   duplicates, a swapped key) and `mannaSpent` with gear.
2. **Replace `sheet.pilot_gear` / `pilot_gear_notes` everywhere** (the content kind name `'pilot_gear'` stays). Known
   readers: `src/myPilot.ts:48-50` (Sheet type), `src/gameData.ts:147,214,225` (`loadoutSlots`, `pilotVitals`, stats),
   `src/mechData.ts:269`, `src/rules.ts:348`, `src/changeDiff.ts:131,147` (+ tests), `src/components/PilotLoadout.vue`,
   `src/itemNotes.ts` (slot notes become dead: delete what's no longer used), `src/views/PilotManageView.vue:635`,
   `build.test.ts`, `gameData.test.ts`. Equipped items = `equipped_gear` keys mapped through `owned_gear` to content ids;
   keep the slot layout by type from `loadoutSlots`.
3. **Equipment section** (`PilotLoadout.vue` in `PilotManageView.vue`; keep the two-row grid Armour, Weapon, Weapon /
   Gear, Gear, Gear):
   - A slot's Add/Swap opens `ItemPicker` with **owned, unequipped** items of that type (description shown). Choosing
     equips; `Remove` on an equipped item unequips it (back to owned).
   - **Approved pilot:** equip/unequip always calls `supabase.rpc('equip_pilot_gear', ...)` on the live sheet, even
     with a change open and in GM edit mode; show `Saving…` / `Saved` / `Not saved: {Reason.}`.
   - **Pilot being created** (pending, never approved): equip edits the sheet being built (`owned_gear` /
     `equipped_gear` through the existing `updateSheet` path); a slot's Add opens the full catalogue and adds + equips
     in one step (their free starting loadout); removing is allowed. **Dead pilots:** read-only.
   - **Owned items** block under the slots: every owned item not equipped. In change/draft mode each owned item's
     Description is editable with `ItemNote` (edits `owned_gear[n].notes` in the draft, so it needs approval). Items
     bought in the open change show the label `Bought in this change` and can't be equipped yet (blocked reason
     `Needs GM approval`).
   - **Buying:** in change/draft mode, a `Buy item` button opens `ItemPicker` with all pilot gear, each row showing its
     price the way licences/biomods show cost (the stopped agent was checking how `LoadoutBox` builds its picker's price
     line), blocked reason `Not enough manna` when the remaining manna after this draft is too low, and the existing
     Exotic / GM-only restrictions. Choosing appends `{ key: crypto.randomUUID(), id }` to the draft's `owned_gear`,
     unequipped.
   - Players never get a remove action for owned items in a change (submit would refuse it). GMs in GM edit mode can
     remove one: confirm "Are you sure?" / "{Item} will be taken off this pilot. This can't be undone." / `Remove item`.
   - The cover's `Manna left` and spend figures include gear.
4. **GM review** (`changeDiff.ts`, `GmChangeView.vue`): "Bought {Item}" lines with the price (follow the existing line
   style and cost display); description changes keyed by owned key (reuse the existing description diff). No equipped
   diffs for approved pilots. A new pilot's first review still shows the loadout as part of the full sheet.
5. **Content editor:** pilot gear gets a `Manna cost` field stored as `manna_cost`: whole number, 0 or more, blank means
   100, validation "Manna cost must be a whole number, 0 or more." Copy the biomods price field pattern
   (`src/components/editor/BionicForm.vue:23,58`, `src/contentEditor.ts:400`), but check how pilot gear's editor fields
   map into `data`/`edited`.
6. **GM edit mode race:** a GM's whole-sheet save carries `equipped_gear` and could overwrite a player's equip made after
   the GM loaded the page (equipping doesn't move `updated_at`). In GM edit mode, equip through the RPC too, and either
   leave `equipped_gear` out of the GM's sheet save or take it from the latest live value.
7. **Docs:** update `docs/claude/pilot-sheet.md`, `characters.md`, `approval.md`, `security.md` briefly.

## After the frontend

1. `npm test -- --reporter=dot 2>&1 | tail -n 15`, `npm run build 2>&1 | tail -n 15`, `npx supabase test db 2>&1 | tail -n 5`.
2. Browser checks with `preview_start` `dev-localdb` (port 5174; Docker must be running; sign in from the console with
   `(await import('/src/lib/supabaseClient.ts')).supabase.auth.signInWithPassword(...)`, accounts
   `test-pilot@hor-os.local` / `local-test-pilot` and `test-gm@hor-os.local` / `local-test-gm`). Local test pilot is id 42
   "WARDEN" (approved, test player); it may need re-creating after a `supabase db reset`. Check as the player: equip,
   swap, unequip instantly; buy in a change, submit; as the GM: review shows "Bought …", approve; the bought item appears
   in Owned items and equips. Check a new pilot's free loadout and manna totals. Phone width 375px, no sideways scroll.
3. **Security audit** (`security-auditor`): re-run on the migration. Brief: try to get gear without paying (claim `free`
   in a proposal, forge or reuse a live key with another id, duplicate a free key, swap an owned item's id keeping its
   key, remove a bought item to lower spend, be sent back and resubmit to reuse first-approval rules, GM toggling status);
   equip things not owned / on others' pilots / dead or pending pilots; overfill slots; use `settle_pilot_gear` or
   `equip_pilot_gear` to write anything else; whether the `updated_at` trigger change weakens optimistic locking for other
   fields; search_path, grants, security definer necessity; that the backfill can't fail on real data and abort the
   migration. Also `ux-reviewer` after the UI.
4. Ask the developer, then apply to hosted: `npx supabase migration list --linked`, then
   `npx supabase db push --linked --yes` (the CLI requires `--yes` in agent mode; only with the developer's yes), then
   `npm run types`, then commit (attribution line from the session reminder) and push (with the developer's yes).
5. Update `STATUS.md` (remove the "in progress" line, record the migration as hosted).
