# Roles and security detail

Purpose: the full wording of the roles and the security rules (RLS, submit-time picker rules, GM-only tables). The short critical rules are in CLAUDE.md. Read when a task touches roles, RLS, grants or database rules.

## Users and roles (decided, full)

- **No campaigns table.** Everything belongs to the one campaign.
- Anyone can sign up, using **"Log in with Discord"** through Supabase Auth. New accounts need no GM approval (decided by the developer, 2026-11-17); email signup should be off in the hosted dashboard so Discord is the only way in.
- A **profiles** table holds one row per user: Discord name and role. New users are players. The name is the first non-blank of Discord's display name, username and name, else "Unknown pilot" (`private.discord_name()`, migration `20261117155935_profile_names.sql`, tested in `supabase/tests/profiles.test.sql`): Discord sends an empty display name for accounts without one. GMs and owners are set by hand in the Supabase dashboard.
- **Three roles:**
  - **Player:** manages their own character through pending changes.
  - **GM:** everything except managing LCP content. Edits any character, approves or rejects changes, and can have their own characters, which they edit directly without approval. GMs can't delete characters.
  - **Owner:** everything a GM can do, plus managing LCP content (importing, updating and removing packs) and deleting any character.
- Players have **one living character** at a time. When it dies, they can make a new one. GMs and owners can have several. Enforce this in the database, not just the page: the insert policy checks it, and a trigger takes a per-player lock so two requests at once can't both pass.

## Security rules (critical, full)

- **Players must NOT be able to update the characters table directly.** They can only add pending changes for their own characters. Otherwise anyone could skip GM approval using browser developer tools.
- Only GMs (or the approval function) can change approved characters.
- **Only owners can delete characters** (it cascades to their sheet, changes and reputation). Players can still withdraw their own pending pilot. GMs can't delete any.
- **Players must NOT be able to change their own role** in the profiles table, or anyone could make themselves a GM.
- **Only owners can add, change or remove LCP content.**
- **Picker rules checked at submit** (2026-11-19, migration `20261119170000_enforce_picker_rules.sql`, `private.guard_submit_rules()`, tested in `supabase/tests/submit_rules.test.sql`). When a **player** submits (a new pilot: `characters.submitted_at` null to set; a change: `pending_changes.submitted_at` null to set) the database refuses it if:
  - it **newly adds GM-only content** (HORUS or NHC source, or an item or licence of a HORUS or NHC frame; biomods by `bionics.source`) or **Exotic content** (source `EXOTIC`, the `tg_exotic` tag, biomod source `EXOTIC`; any case). "Newly" means in the proposed sheet but not in the approved sheet (a new pilot has no approved sheet, so everything is new), so items a GM granted can stay and a held GM-only licence can be raised. Content is read as `coalesce(edited, data)` like `loadKind()`. Ids are found by matching them as quoted strings in the sheet text (as `pack_usage` does), which also catches licence and talent keys; biomods are numbers in `sheet->'bionics'`. A false match (an id typed as a whole quoted string) only blocks.
  - it **overspends manna**: spending is more than `character_sheets.manna` received. SQL mirrors `mannaSpent()`: licence ranks, talent ranks, each biomod's `manna_cost` (a repeated one twice), and mechs after the first, counted from the proposed card for a change and `characters.mechs` for a pilot. The three prices are constants at the top of the function and `PRICES` in `src/rules.ts` points at them (`rules.test.ts` reads the SQL and compares).
  - **Pilot gear** (2026-11-21, migration `20261121110000_pilot_inventory.sql`): the spend also counts every owned pilot gear item that isn't free (`default_gear_price` 100, `GEAR_PRICE_DEFAULT` in `src/rules.ts`; free worked out server-side by `settle_pilot_gear`, never from the sheet's own `free` flags), and a player's change must keep every live owned entry with the same key and id (no refunds: "Owned pilot gear can't be removed: {Item}."). Unknown ids and missing or repeated keys are refused too. **Equipping** is `equip_pilot_gear(target_character_id, keys)` (security definer): the pilot's player or any GM, approved pilots only, keys must be owned known Armor/Weapon/Gear items within the slot limits; it writes only `equipped_gear`.
  - Errors reach the page as "Not submitted: Exotic items need a GM to add them: Plasma Maul." / "GM-only items need a GM to add them: …" / "This spends 2,100 manna, but only 1,500 was received." (`NOT_SUBMITTED` in `src/saveStatus.ts`; `SaveStatus.vue` shows it as written, without Retry). Several problems come in one message.
  - Drafts save freely. **GMs and owners are never checked** (their submits, direct edits and approvals), nor are writes by the database owner.
  - **Still page-only** (the sheet is one JSON column; these need the rules from game data): licence requirements, loadout slots, mounts, system points, Unique, AI capacity, core bonus eligibility and the rule check generally. Also page-only: **Exotic for a GM on their own character outside GM edit mode**. The database can't tell a GM's edit mode from a GM writing, so it is the picker alone. GM review remains the backstop for everything above.
  - Known edge: a pilot a GM edited directly while it was still pending, then sent back, counts everything as new when the player resubmits, so GM-granted restricted items would block it until a GM removes them or approves it from their side.
- **Experience and the reward log are GM-only** (`pilot_progress`, `pilot_reward_log`, see "Homebrew levelling and gear"): players can't read or write them, even for their own pilot, and they live in their own tables because RLS works on whole rows and players read their own sheet.
- **Reputation is GM-only.** Only GMs and owners can read reputation or change its levels, and only owners can change the list of organisations. The character's own player can't see it either.
- Players can see and edit their own things, and can see only the public parts of other characters. GMs and owners can see everything.
- **RLS works on whole rows, not fields.** If a player can read a character's row, they can read every field in it with developer tools, even the ones the page doesn't show. The private parts must be secret, so the public parts have to be stored apart from them (for example, in their own table).
- Test the rules by trying to break them while logged in as a player.
- Supabase has two keys. The **public** one ("anon" or "publishable") is safe in the browser. The **secret** one ("service_role" or "secret") bypasses every rule. It must never go in the frontend or be committed to git.
