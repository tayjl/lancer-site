# Approval and security

## Approval

### Pending approval workflow (decided: option 2)

- The approved character stays **untouched** while a change is pending. Proposed changes live in a separate pending-changes table until a GM approves or rejects them.
- **One pending change per character.** The player can **edit or withdraw** it until a GM reviews it. Once **submitted**, a trigger locks it. Players can only take it back to a draft (`submitted_at` back to null, "Edit change") or withdraw it, and never change its status, review fields or `based_on`.
- GMs approve or **send back** a **whole** change, never part. Sending back needs a **note**. `review_reason` holds the note for either outcome (optional when approving) and the player sees it.
- **Sending back never loses the player's work** (2026-11-19, after a player lost hours of writing). `reject_change(change_id, reason)` marks the change `rejected` (the history row) and in the same transaction inserts a **new draft**: same card, sheet and `submitted_by`, the note in `review_reason`, and `based_on` stamped with the pilot's last change (`private.pilot_last_changed()`). The GM just reviewed against the pilot as it is, so an earlier GM edit can't leave the draft stale for ever, while any later edit still blocks approval.
  - A draft with a `review_reason` is a **sent-back** draft. Submitting it clears the note from the draft (a trigger, the history row keeps it). Players can't set `review_reason` or `based_on`.
  - Migration `20261119130000_send_back_changes.sql` also backfills a draft for every approved pilot whose latest change was rejected and has no open change.
- Approving and marking approved happen in **one database function** (all-or-nothing). Migration `20261116225551_approval_hardening.sql` holds these and the triggers above:
  - `approve_change(change_id, expected_submitted_at, note)` refuses if the player resubmitted since the GM opened it.
  - `reject_change(change_id, reason)` for changes.
  - `approve_pilot(target_character_id, expected_updated_at, note)` for new pilots.
- **New pilots use the same draft → submit flow** (migration `20261119120000_pilot_submission.sql`, tested in `supabase/tests/approval.test.sql`, `submitPilot()` / `reopenPilot()` in `src/myPilot.ts`):
  - The player may only set `characters.submitted_at` null → now() (the database stamps it and clears the GM's sent-back note) or back to null, only while pending.
  - While it is set, the player can't change the card or sheet. GMs and owners can, so GM edit mode works.
  - `approve_pilot` refuses an unsubmitted pilot. A GM sending back (`send_back_pilot`) clears it. A sent-back pilot is a draft with the GM's note.
- **History:** reviewed changes are never deleted. Each keeps status, reviewer, time and reason.

- **Saving is trustworthy** (`useMyPilot` in `src/myPilot.ts`, `checkWrite()` in `src/lib/supabaseClient.ts`, tested in `src/myPilot.test.ts` and `src/lib/supabaseClient.test.ts`):
  - Saves run one at a time, each sending the **whole** card, sheet or draft as on screen when it runs (never a copy taken when queued). Two quick edits can't undo each other and a later save carries an earlier failed one.
  - A failed save never reloads. The edit stays and the status reads red "Not saved: …" with a `Retry` that re-sends what's unsaved (the error stays until a save succeeds). `Submit change` / `Resubmit pilot` refuse while an edit is unsaved.
  - Every `.update()`, `.upsert()` and `.delete()` ends in `.select()` and goes through `checkWrite()`, because RLS turns a refused write into "0 rows, no error" (reported as "Not saved: You don't have permission to change this."). **Never trust a write that doesn't check its rows.**
  - Same shape on the pilot sheet, mech pages, GM edit mode (`GmEditBar` has the Retry too), the lore editor and the GM pilots roster (typed numbers stay in the field).
- **Optimistic locking:**
  - The card (`characters`), sheet (`character_sheets`), draft (`pending_changes`) and lore entries update with `.eq('updated_at', <the raw string this page last loaded or saved>)`. The page stores the `updated_at` each save returns (never re-serialised through `Date`).
  - If no row is touched because the row moved on (a second read tells it from a permission failure), saves stop for that page. `ConflictNotice.vue` shows "Not saved" ("Someone else changed this. Reload to see their version.") with a `Reload` button (a full page reload).
  - The sheet's `updated_at` only moves when `sheet` itself changes (the trigger), so a GM setting level, manna or a note causes no conflicts. The first sheet save (no row yet) is an unguarded upsert.
  - `pending_changes.updated_at` (migration `20261116235409_pending_changes_updated_at.sql`, moddatetime, pgTAP-tested in `approval.test.sql`) is new: on the hosted project.
- **Profile and session** (`src/auth.ts`, `App.vue`): if the profile can't load (network, a paused free Supabase project), the page area shows "Couldn't load your profile" with the paused-project hint and `Retry` (`profileError`, `loadProfile()`). When the session ends while open (signed out elsewhere, expired), `App.vue` sends you to `/login`.
- **Drafts:** a change starts as a draft (`pending_changes.submitted_at` is null, migration `20261029024308_pending_change_drafts.sql`), stored in the database so it works across devices. Only submitted changes reach the GM queue and `approve_change` refuses a draft.
- **Player** (`src/myPilot.ts`, top strip of `PilotManageView.vue`):
  - An approved pilot shows `[ propose changes ]`, which copies the pilot into a new draft. While a draft is open, the pilot and mech pages show it and every save goes into it.
  - `[ submit for review ]` queues it. An approved change shows the GM's note, if any, as a "Note from the GM" notice with a `Clear note` that hides it on this device only (localStorage per change id).
  - Once submitted, the sheet is read-only, with `[ edit change ]` (back to a draft) and `[ withdraw ]` (deletes it). Withdrawing a sent-back draft deletes only the draft. The rejected history row stays and the pilot page shows nothing about it.
  - Buying with manna in a draft spends from the same balance.
- **"Changed since" check:** a trigger sets `based_on` when the draft is created (so players can't fake it) to when the pilot last changed (`private.pilot_last_changed()`: the later of the card's and sheet's `updated_at`). It never changes afterwards. A real edit to the pilot after that makes the review page warn and disable approve, and `approve_change` refuses it too. So a GM's direct edit can't be overwritten on approval.
- **GM** (`gm: changes` `/gm/changes`, `src/views/GmChangesView.vue`): submitted changes, oldest first, in the same "Waiting for review" queue as gm: pilots (`ReviewQueue.vue`), then the 20 latest reviewed changes as a "Reviewed" `.table` (pilot, status badge `Approved` or `Sent back`, reviewer, when, the GM's note). Each opens `/gm/changes/:id` (`GmChangeView.vue`, titled "Change to CALLSIGN", breadcrumb `GM changes / CALLSIGN`):
  - **Summary strip** `.panel`: pilot name, a `.sep` line with player and when, a link to the record, then Balance before / Cost of change / Balance after as uppercase labels over mono numbers. Sticky under the top bar on wide, tall screens. Refunds are labelled as refunds.
  - **Colours** are status tokens: `--ok` for additions, positive deltas and refunds, `--danger` for spending, removals and negative balances, `--info` for remaining manna and neutral updates. Never colour alone: symbol and word stay, and costs keep their sign.
  - **Line kinds** (`changeDiff()` in `src/changeDiff.ts`, tested): **Added** (new) and **Raised** (a number or rank went up) with + in `--ok`, **Removed** and **Lowered** with − in `--danger`, **Updated** (anything else) with ~ in `--info`. Text is sentence case and never repeats the verb ("Acuity 2 → 3", "IPS-N Drake licence, rank I → II").
  - **Contents** `.panel` (a `nav`, built with `reviewSections()`, `writingSummary()` and `wordCount()` in `changeDiff.ts` and `ChangeTally.vue`, all tested): the key line once ("+ added or raised · − removed or lowered · ~ updated"), a `Jump to decision` link (while waiting), and one link per section with its counts (`ChangeTally`: "+3 −1 ~2", words for screen readers) and manna. Links scroll to the section (`scrollIntoView`, with `scroll-margin-top` clearing the sticky strip).
  - **One `.panel` per section in sheet order:** identity, appearance, personality, backstory, personal stats, piloting stats (never merged), biomods, loadout, licences, core bonuses, talents, then one per mech. Each has a `.panel-head` (title left, counts and manna right).
  - Lines are in **aligned columns**: kind symbol and word, text, then manna in mono, right-aligned (red with a minus for spending, green with a plus for refunds, blank when free). On phones kind and manna share a row with the text under them. Order: added or raised, updated, removed or lowered.
  - A line's manna (`DiffLine.manna`) is the sum the strip uses: licence and talent ranks at their prices, biomods at their own price (`changeDiff()` takes `prices`), and every mech after the first (the first into an empty hangar and the last one out are free).
  - A **mech's panel** is headed "Mech: name" with its frame (looked up by the mech's id, carried on each line as `mechId`, so same-named mechs keep their own panels) and a "New mech" badge when new. A scrapped mech has a "Mech scrapped" line carrying the refund and no badge. Identity, frame, appearance, history, weapon mounts and systems are uppercase sub-heads inside the panel.
  - **Long writing** (appearance, personality, backstory, mech appearance and history) shows one line ("Backstory rewritten · 412 → 530 words", or "written · 530 words") with a `Show text` / `Hide text` toggle for the formatted new text and the old text beside it ("Before" / "After", two columns on wide screens, stacked on phones). No inline word highlighting.
  - Ranks and stats show before → after. Unchanged content is omitted. No separate "other changes" split: removals and reductions sit last in each section.
  - Rule checks and stale warnings (a `.notice.warn`) stay visible, then a "Decision" `.panel`: a "Note to the player" `label.field` (hint "Optional when approving, required when rejecting."), `Approve change` (`.primary`, through `confirmAction()`, runs `approve_change` with the note, blocked pattern with its reason beside it when stale) and `Reject change` (`.danger`, runs `reject_change`).
  - Decided 2026-10-29: no full pilot/mech sheet comparison, snapshots or inline word highlighting in review. Reviewed history can't reconstruct the original baseline or cost, so its figures are labelled as proposal spending using current manna received.
- **Pilot gear in changes:**
  - Buying adds an owned copy to the draft. The review shows "Bought {Item}" in the loadout section with its price (`changeDiff()`'s `prices.gear`) and description edits keyed by the owned copy.
  - Equipping is never part of a change. It goes live through `equip_pilot_gear` (which doesn't move the sheet's `updated_at`, so it never makes a change stale). The draft's `equipped_gear` is replaced by the live one on load and `approve_change` keeps the live list.
  - A GM's whole-sheet save on an approved pilot re-reads the live `equipped_gear` first (`write()` in `src/myPilot.ts`), so it can't undo a player's equip.
- **Not in pending:** changes are private and players read only their own, so they stay GM-side. The pending tab lists new pilots only.

## Security

### Users and roles (decided, full)

- **No campaigns table.** Everything belongs to the one campaign.
- Anyone can sign up with **"Log in with Discord"** through Supabase Auth, with no GM approval (decided by the developer, 2026-11-17). Email signup should be off in the hosted dashboard.
- A **profiles** table holds one row per user: Discord name and role. New users are players. GMs and owners are set by hand in the Supabase dashboard.
- The name is the first non-blank of Discord's display name, username and name, else "Unknown pilot" (`private.discord_name()`, migration `20261117155935_profile_names.sql`, tested in `supabase/tests/profiles.test.sql`), because Discord sends an empty display name for some accounts.
- **Three roles:**
  - **Player:** manages their own character through pending changes.
  - **GM:** everything except managing LCP content. Edits any character, approves or rejects changes, and can have their own characters, edited without approval. Can't delete characters.
  - **Owner:** a GM plus managing LCP content (importing, updating, removing packs) and deleting any character.
- Players have **one living character** at a time (a new one once it dies). GMs and owners can have several. Enforced in the database: the insert policy checks it and a trigger takes a per-player lock so two requests at once can't both pass.

### Security rules (critical, full)

- **Players must NOT be able to update the characters table directly.** They can only add pending changes for their own characters, or anyone could skip approval with browser developer tools. Only GMs (or the approval function) can change approved characters.
- **Only owners can delete characters** (it cascades to their sheet, changes and reputation). Players can still withdraw their own pending pilot.
- **Players must NOT be able to change their own role** in profiles, or anyone could make themselves a GM.
- **Only owners can add, change or remove LCP content.**
- **Picker rules checked at submit** (2026-11-19, migration `20261119170000_enforce_picker_rules.sql`, `private.guard_submit_rules()`, tested in `supabase/tests/submit_rules.test.sql`). When a **player** submits (a new pilot: `characters.submitted_at` null to set, a change: `pending_changes.submitted_at` null to set) the database refuses it if:
  - it **newly adds GM-only content** (HORUS or NHC source, or an item or licence of a HORUS or NHC frame, biomods by `bionics.source`) or **Exotic content** (source `EXOTIC`, the `tg_exotic` tag, biomod source `EXOTIC`, any case).
    - "Newly" means in the proposed sheet but not the approved one (a new pilot has none, so all is new). Items a GM granted can stay and a held GM-only licence can be raised.
    - Content is read as `coalesce(edited, data)` like `loadKind()`. Ids are matched as quoted strings in the sheet text (as `pack_usage` does), which also catches licence and talent keys. Biomods are numbers in `sheet->'bionics'`. A false match only blocks.
  - it **overspends manna**: spending is more than `character_sheets.manna` received.
    - SQL mirrors `mannaSpent()`: licence ranks, talent ranks, each biomod's `manna_cost` (a repeated one twice), and mechs after the first, counted from the proposed card for a change and `characters.mechs` for a pilot.
    - The three prices are constants at the top of the function. `PRICES` in `src/rules.ts` points at them (`rules.test.ts` reads the SQL and compares).
  - **Pilot gear** (2026-11-21, migration `20261121110000_pilot_inventory.sql`):
    - The spend also counts every owned pilot gear item that isn't free (`default_gear_price` 100, `GEAR_PRICE_DEFAULT` in `src/rules.ts`). Free is decided server-side by `settle_pilot_gear`, never from the sheet's own `free` flags.
    - A player's change must keep every live owned entry with the same key and id (no refunds: "Owned pilot gear can't be removed: {Item}."). Unknown ids and missing or repeated keys are refused.
    - **Equipping** is `equip_pilot_gear(target_character_id, keys)` (security definer): the pilot's player or any GM, approved pilots only, keys must be owned known Armor/Weapon/Gear items within the slot limits. It writes only `equipped_gear`.
  - Errors reach the page as "Not submitted: Exotic items need a GM to add them: Plasma Maul.", "GM-only items need a GM to add them: …" or "This spends 2,100 manna, but only 1,500 was received." (`NOT_SUBMITTED` in `src/saveStatus.ts`, shown as written by `SaveStatus.vue`, without Retry). Several problems come in one message.
  - **Homebrew rules** (2026-11-21, migration `20261121140000_homebrew_rules.sql`, `public.sheet_rule_problems()`, tested in `supabase/tests/homebrew_rules.test.sql`), mirroring `src/rules.ts`:
    - Unmet `requires` (talents, core bonuses, biomods, owned pilot gear, and each mech's frame, weapons, systems and mods).
    - Granted equipment without a source present.
    - A replace-mount choice that isn't a normal mount of the built frame.
    - Biomods over the mod limit (6 + level + unconditional `mod_points` bonuses).
    - Talent or licence ranks that aren't whole numbers from 0 to III.
    - More than 50 mechs, 200 biomods or 500 owned gear entries ("Sheet too large.").
    - Only problems the approved sheet doesn't already have count. Messages match the page's rule check ("Needy needs Brawler II.", "Rusty: Mount Swap needs a normal mount.").
  - Drafts save freely. **GMs and owners are never checked** (their submits, direct edits and approvals), nor are writes by the database owner.
  - **Still page-only** (the sheet is one JSON column and these need rules from game data): licence requirements, loadout slots, mounts, system points, Unique, AI capacity, core bonus eligibility and the rule check generally. Also **Exotic for a GM on their own character outside GM edit mode**, because the database can't tell GM edit mode from a GM writing. GM review is the backstop.
  - Known edge: a pilot a GM edited directly while pending, then sent back, counts everything as new on resubmit. GM-granted restricted items block it until a GM removes them or approves it.
- **Experience and the reward log are GM-only** (`pilot_progress`, `pilot_reward_log`, see "Homebrew levelling and gear"). Players can't read or write them, even for their own pilot. They live in their own tables because RLS works on whole rows and players read their own sheet.
- **Reputation is GM-only.** Only GMs and owners can read it or change its levels, only owners can change the list of organisations, and the character's own player can't see it.
- Players see and edit their own things and only the public parts of other characters. GMs and owners see everything.
- **RLS works on whole rows, not fields.** A player who can read a row can read every field in it with developer tools, so private parts must be stored apart from public ones (for example, in their own table).
- Test the rules by trying to break them while logged in as a player.
- Supabase has two keys. The **public** one ("anon" or "publishable") is safe in the browser. The **secret** one ("service_role" or "secret") bypasses every rule and must never go in the frontend or git.

### Account deletion (2026-11-21)

`delete_my_account()` (security definer, authenticated only) deletes the caller's pilots and login. Refuses the last owner. Things they wrote for others (lore, service record, reward log, reviews, packs) stay with the author cleared. Storage files can't be removed from SQL, so the site first removes a player's `character-images/<uid>/` files (`deleteAllImages`, paged). GMs and owners skip it because they upload onto other people's pilots. The button is on `/privacy`.
