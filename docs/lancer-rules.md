# LANCER rules the site follows

The character rules from the LANCER core book that the site needs, how each one is handled, and where in the code.
House rules from CLAUDE.md win where they differ (no grit in mech stats, custom pilot stats, bionics, no skill triggers and so on). Every developer rule decision, dated: [rule-decisions.md](rule-decisions.md).

**Status key:**
- **Enforced:** the page won't let you break it. The pickers and buttons block it, and the rule check flags it if it breaks anyway (for example, a GM lowers your licence level).
- **Rule check:** not blocked, but listed in the rule check that players and GMs see.
- **GM:** left to GMs when approving.
- **Not built:** the feature isn't on the site yet. The rule is noted for when it is.

All of this is checked by the page, not the database. The private sheet is one JSON column that the database can't validate (see CLAUDE.md). A player who edits their sheet with developer tools can break any of these rules. The rule check in the GM review is there to catch that before approval.

The rules live in `src/rules.ts` (pure functions, tested in `src/rules.test.ts`) and `src/mechData.ts` (mount rules and mech stats).

## Levelling and manna (homebrew)

This campaign replaces LANCER's licence level with two things, decided by the developer on 2026-10-29.

| Rule | Status |
|---|---|
| **Level** is gained narratively only. Only GMs and owners set it. | Enforced by the database (`character_sheets.level`, GM-only trigger) |
| Level gives **HASE points: 2 + level**. | Enforced |
| Level gives **biomod capacity, the mod limit: 6 + level**. | Enforced |
| **Manna** buys everything else. GMs record how much a pilot has received. | Enforced by the database (`character_sheets.manna`, GM-only trigger) |
| What's spent is worked out from the sheet: **licence ranks 600, biomods each at their own price (set in the content editor), talent ranks 300, owned pilot gear that isn't free (its `manna_cost`, 100 when unset; a new pilot's first 1 armour, 2 weapons and 3 gear are free), and mechs: the first is free, each one after it 500** (`mannaSpent(sheet, bionicPrices, mechs, gear, live)`; the mech count is the card's `mechs` list, so scrapping a mech refunds it). Balance = received − spent. Lowering a rank, removing a biomod or scrapping a mech refunds it. | Enforced (the pickers and the hangar's `New mech` block what the balance can't cover; the rule check flags a negative balance) |
| **GMS gear** is free to print. **Licensed gear** (frames, weapons, systems) is free once you hold the licence rank. | Enforced |
| Manna spent outside the sheet (bribes, repairs, anything narrative) isn't tracked. GMs lower "manna received" for it. | GM |
| **New pilots start with 2000 manna received** (the column default; existing pilots keep what they have). | Enforced by the database default; the GM-only trigger accepts it on a player's first sheet insert and refuses any other value |
| Starting level for a new pilot. | GM (entered by hand; open question in CLAUDE.md) |

Prices are `PRICES` in `src/rules.ts`. Changing them re-prices everything already bought, because spending is worked out, not stored.

## Licences

| Rule | Status |
|---|---|
| A **licence** belongs to one frame (in the data, a frame's id is its licence id). It has ranks I to III, bought one at a time with manna. | Enforced |
| **Licence level** is the total licence ranks bought. | Enforced (worked out) |
| **Alternate frames** (an alternate Genghis, "Worldkiller"; the packs mark one with `variant`, the original's name, and usually `license_id`, the original's id) share their original's licence: only originals are licences (the picker, the archives, the manufacturer counts), and the alternate unlocks at its own rank in the original's ladder. The pilot chooses which one the licence gives (`sheet.frame_choices`, free, unset = the original); the mech page blocks the other ("Licence gives X"). Gear naming an alternate's licence counts under the original's. | Enforced (picker); rule-checked (a mech on the other frame; a licence still held under an alternate's own id: a GM moves its ranks, its manna stays spent until removed) |
| **Frames** need rank II in their licence. GMS frames (licence level 0, e.g. the Everest) need none. | Enforced |
| **Mech weapons and systems** need a rank in their frame's licence at least equal to their licence level (I, II or III). GMS items (licence level 0) need none. | Enforced |
| **GM-only content:** anything from the HORUS or NHC (Nidhogg Collective) manufacturers, and anything whose licence is a frame from one of those (`gmOnly()` in `src/rules.ts`, matched by name, ignoring case). Players can't add it: the frame, weapon, system, mod, gear, biomod (by its manufacturer), licence and core bonus pickers show it blocked ("GM only", listed last), and players can't gain such a licence, but once a pilot holds one (a GM granted it) they can `Raise rank` on it with manna like any other. GMs and owners are unrestricted, on their own pilots and on any pilot in GM edit mode. **Exotic** content (`isExotic()`: source `EXOTIC`, or the Exotic Gear tag `tg_exotic`) is stricter: every picker blocks it ("GM edit only") unless the page is in a GM's edit mode, even for GMs and owners on their own pilots (they reach edit mode on their own pilot from `Edit pilot`). Exotic is listed last. Items a GM added stay usable and aren't flagged as rule problems. | Enforced in the pickers, **and by the database when a player submits** (a new pilot or a change: newly added GM-only or Exotic items are refused, "Exotic items need a GM to add them: …", see below). Not enforced for GMs and owners (so Exotic for a GM's own character outside edit mode is the picker alone: a GM writing is a GM writing). GM review is the backstop. |

**Checked by the database at submit, for players only** (`private.guard_submit_rules()`, migration `20261119170000_enforce_picker_rules.sql`, `supabase/tests/submit_rules.test.sql`; drafts save freely, GMs and owners are never checked):

| Rule | Status |
|---|---|
| A submit may not **newly add** GM-only (HORUS, NHC, or a licence/item of such a frame) or Exotic (source EXOTIC, `tg_exotic`, EXOTIC biomod) content: in the proposed sheet but not the approved one. Items a GM granted can stay; a held GM-only licence can be raised. | Enforced at submit. Ids are matched as quoted strings in the sheet text, so a false match is possible and only blocks |
| A submit may not **spend more manna than was received** (the same sum as `mannaSpent()`, including the extra-mech price). | Enforced at submit. Prices are in the function and in `PRICES`; `rules.test.ts` keeps them equal |
| Licence requirements, slots, mounts, system points, Unique, AI capacity, core bonus eligibility. | Page only (rule check and GM review), not in the database |

## Pilot skills and stats

| Rule | Status |
|---|---|
| **Mech skills (HASE)**: hull, agility, systems, engineering. Each is 0 to 6. They start at 0. | Enforced |
| HASE points: **2 + level** (above). | Enforced |
| **Pilot HP** starts at 6, armour at 0 and speed at 4. Equipped gear bonuses apply; replacement values replace the base before additive bonuses. No grit. | Calculated by `pilotVitals()` and shown privately on the pilot sheet. Missing gear makes totals unavailable; overflowing slots do not stack. |
| **Pilot e-defence** starts at 10; permanent equipment/talent bonuses apply. **Pilots have no evasion.** | Latest developer correction, 2026-10-29: ignore pilot evasion bonuses and omit them from equipment cards; keep pilot e-defence and normal mech evasion. |
| Skill triggers, backgrounds, bonds, reserves. | Not used (house rules) |
| **Personal stats**: base 2 in each, with 4 shared extra points; base values stay within 2–4. No extra points from level. | Enforced by the controls and checked in `personalStatProblems()`; existing invalid allocations are flagged, not rewritten. |
| **Biomods** modify personal totals after allocation. They can take totals below 2 or above 4; their modifiers do not consume allocation points. | Applied separately by `sheetStats()`; totals and base/modifier breakdown are displayed. Mod limit and manna cost apply as above. |

## Talents and core bonuses

| Rule | Status |
|---|---|
| **Talents**: ranks I to III, taken in order, each rank bought for 300 manna. | Enforced |
| **Core bonuses**: one free pick for every 3 licence ranks bought. Each non-GMS bonus requires another 3 licence ranks in its manufacturer, spread across any of its licences. GMS has no manufacturer requirement. Each bonus can only be taken once. | Picker blocks ineligible choices; rule check flags existing violations in pilot sheets and GM reviews. GMs can override warnings. |
| Equipment, talents, frame traits, passive core powers and core bonuses that change builds. | Permanent structured effects apply with named sources. Weapon filters are matched to the equipped weapon/profile. Supported arithmetic uses a safe parser with known build variables. Conditional/active combat abilities and unsupported effects stay readable reminders. No combat tracking. |
| Talent-only items (Engineer, Nuclear Cavalier, Walking Armory, Technophile). | Integrated equipment appears automatically; optional special equipment becomes selectable. Exclusive grants replace earlier exclusive ranks. Losing a grant flags previously installed gear. |
| Improved Armament, Integrated Weapon and Mount Retrofitting. | Extra/modified mounts are calculated; Retrofitting requires a selected normal mount. Lost mounts keep saved weapons visible as unfitted until cleared. |
| Auto-Stabilizing Hardpoints and Overpower Caliber. | Per-mech target selection; permanent mount accuracy is displayed. Once-per-round bonus damage stays a reminder and is excluded from base damage. |

## Pilot gear

| Rule | Status |
|---|---|
| **1 armour, 2 weapons, 3 gear equipped.** Only LANCER pilot gear, no free text (a GM can add free-text misc items). | Enforced |
| Gear is **owned** once bought, and equipping owned gear needs no approval. Buying costs manna, with no refunds for players. | Enforced (database function `equip_pilot_gear`; see `docs/claude/pilot-inventory.md`) |
| A **Variable** damage weapon needs a chosen damage type, equipped or stowed. | Rule check |
| Each slot only takes its kind of item. | Enforced |

## Mechs

| Rule | Status |
|---|---|
| A mech has **one frame**, which needs a licence (above). | Enforced |
| **Mech stats** come from the frame plus HASE: hp + 2 per hull, repair cap + 1 per 2 hull, evasion + agility, speed + 1 per 2 agility, e-defence + systems, tech attack + systems, heat cap + engineering, system points + 1 per 2 systems. No grit (house rule). | Enforced (worked out, never stored); normal evasion retained by developer decision. |
| Save target and sensors. | Excluded by house rule. Size is displayed; Fomorian Frame increments it up to 3. |
| **Mounts** come from the frame. A **Main** mount takes a Main or Auxiliary weapon; **Heavy** takes a Heavy, Main or Auxiliary; **Main/Aux** takes a Main and an Auxiliary; **Aux/Aux** two Auxiliary; **Flex** one Main or two Auxiliary. | Enforced |
| A **Superheavy** weapon takes a Heavy or Superheavy mount **and one more mount**, which must be empty. In a Superheavy mount it braces on the frame's Heavy mount if it has one, otherwise any other empty mount; in a Heavy mount, any other empty mount. The site shows that mount as bracing the weapon. The `superheavy_mounting` bonus (core bonus Superheavy Mounting) adds a Superheavy mount when the mech has fewer than 3 mounts, not counting integrated ones. | Enforced |
| Any content may carry `bonuses`; a bonus may carry a `condition` (up to 120 characters). A conditional bonus is never counted: it shows as a reminder ("+2 hp, only when exposed."), on the pilot's stat and in a weapon's sources too. Mech ids count on the mech from the frame, traits, core system, core bonuses, talent ranks, equipped weapons, systems and mods, and equipped pilot gear; pilot ids (`pilot_*`, the five personal stats, `mod_points`) count on the pilot from gear, talent ranks, core bonuses and installed biomods. | Calculated |
| `replace_mount` (val = the new mount type) lets the player choose which normal mount it replaces. The choice is stored in the mech's `core_mounts`, keyed by the source's id (a second `replace_mount` in one source adds `#1`). Mount Retrofitting is the same thing with its old key `cb_mount_retrofitting`. A missing or invalid choice is a problem ("{Source} needs a normal mount."). | Calculated, Rule-checked |
| `integrated` / `special_equipment` / `replace_integrated` work on core bonuses, talent ranks, equipped weapons and systems, and installed biomods (not chained: a granted item grants nothing further). Equipment whose source is gone is a problem ("{Item} needs {source}."). | Calculated, Rule-checked |
| A weapon bonus (`range`, `threat`, `damage`, `add_tags`) from any source, aimed with `weapon_types`, `weapon_sizes`, `range_types` and `damage_types`. `damage` with `damage_type` adds that much of that type (a new entry if the weapon has none). `add_tags` val is a list of `{ id, val? }`. Each change is named in the weapon's sources. | Calculated |
| `cheap_struct`: val is the structure repair cost (a whole number, 0 or more; the lowest wins; 2 without it). `drone_*` and `deployable_*` (`hp`, `armor`, `evasion`, `edef`, `size`): `deployable_*` applies to every deployable the equipped weapon or system places, `drone_*` only to those of type Drone. `mod_points` raises the biomod limit. | Calculated |
| `requires` on weapons, systems, mods, pilot gear, core bonuses, talents, frames and biomods: a list of `{ kind: 'talent' \| 'licence', id, rank }`, `{ kind: 'core_bonus', id }` or `{ kind: 'item', id }` (an item must be equipped on this mech, or owned as pilot gear). Pickers say "Needs Brawler II"; a saved build that no longer meets one is a problem ("{Item} needs {thing}."). | Calculated, Rule-checked |
| **System points**: weapons and systems that cost SP can't go over the mech's total. | Enforced |
| **Stat modifier stacking**: additive bonuses stack; replacement bonuses replace the base with their sum; the highest overwrite bonus replaces other additions; a bonus with both flags sets the final stat. Armour is capped at 4. | Shared calculation for displayed stats, picker capacity and pilot/GM rule checks. Each stat can show its applied sources; discarded overrides are not credited. |
| **Unique** weapons and systems: one of each per mech. | Enforced |
| **AI capacity**: one per mech, plus permanent capacity bonuses (The Lesson of Shaping). | Shared rule and picker checks, including integrated systems; Technophile III is exempt because its item has no AI-count tag. |
| Limited capacity, weapon range/damage filters, selected weapon profiles, prototype type/damage/improvements and Hunter II Thrown. | Calculated on equipment cards and in choices. Limited uses gain floor(Engineering/2) plus permanent bonuses. No expended-use tracking. |
| Drone/deployable stats; frame check modifiers and passive effects. | Structured permanent bonuses apply. Drone Commander/Hydra affect drone HP, not mech HP. Explicit supplements cover core check modifiers left in prose; actions and conditions remain references. |
| **Integrated** weapons and systems (built into a frame, e.g. the Sherman's): always on the mech, take no mount, cost no SP, can't be removed. | Enforced (shown, not pickable) |
| Changing frame takes the weapons off the mounts, because the mounts differ. Systems stay, and are rule-checked against the new frame's SP. | Enforced |
| **Weapon mods** (lancer-data's `mods.json`; an owner imports them like any content). **One mod per weapon**, kept by the weapon's place (`sheet.mechs[id].weapon_mods`, `"mount:place"` to mod id). A mod costs **system points** like a system, and is **licensed like one** (free once you hold its licence rank; GMS mods need none, and no manna is spent). | Enforced: the picker blocks a mod the licences don't cover, one over the system points, a second Unique copy and an AI over capacity; the rule check flags the same. |
| A mod only goes on a weapon whose **type and size** it allows (`allowed_types`, `allowed_sizes`, `restricted_types`, `restricted_sizes`; an empty list allows all). A Prototype weapon counts as the type its player chose. | Enforced (picker, rule check) |
| A weapon with `no_mods` (the Mimic Gun, the Gravity Gun) and the **Integrated Weapon** core bonus's mount take **no mod**. Weapons built into a frame or granted by a talent show no mod section at all. | Enforced |
| A mod's **added range** joins the weapon's range of that type (or is a new range), its **added tags** join the weapon's, and a modded weapon gets the Modded tag. The mod's own `bonuses` go through `mechEffects()` like other equipment. Each change is named under "Where these numbers come from". | Calculated (`equipmentDetails()`). A mod's **added damage** is not counted: it's conditional (Thermal Charge needs a hit and a charge), so it stays in the mod's rules text (developer, 2026-11-17). |
| A mod's actions, effect and Limited uses (plus the Engineering bonus) are shown in full on its weapon's card. | Reminders only: no expended-use tracking |
| Removing or swapping a weapon, or changing frame, takes its mod with it. | Enforced by the page |
| A mod whose place no longer holds a weapon (a lost mount, a lost talent grant), a mod missing from the packs, or one on a weapon it doesn't fit. | Rule-checked, never silently deleted. A mod with no weapon counts for no system points and shows under "Mods without a weapon", where it can be cleared. |
| Mods whose own rules need the game's state (UNCLE's AI attack, Throughbolt Rounds, Paracausal's Overkill and unreducible damage, Phase-Ready's cover rules). | GM. Shown as rules text; the AI tag counts towards AI capacity. |
| Several mechs per pilot. Which one is active doesn't matter for a roleplay. | No limit |

## When rules break anyway

Some changes make existing choices illegal without the page noticing at the time:
- A GM lowers a pilot's level or manna received.
- A content pack is updated.
- Someone edits the sheet with developer tools.

The **rule check** (`pilotProblems()` in `src/rules.ts`) lists everything wrong, mech by mech. It shows:
- at the top of the pilot's own sheet, and for that mech on its page
- in the GM decision box, above the approve button

Nothing is removed automatically. The player fixes it, or the GM sends it back.

## Damage (homebrew, 2026-10-29)

- Damage is the mean of the full dice expression, rounded up once: `1d6 = 4`, `2d6+1 = 8`, `1d6+1d6 = 7`. Flat damage is unchanged.
- `flatDamage()` uses an arithmetic parser, never JavaScript evaluation. Shared item details apply it to pilot and mech weapon damage, including the displayed weapon profile.
- Explicit damage phrases in item, talent and core-bonus rules text are converted too. Movement, healing, checks and limited-use dice are not damage rolls and stay unchanged.
- Variable damage on a weapon is chosen by the player (a damage type on the item), not resolved from the text. Variable expressions and unusual prose elsewhere cannot be resolved automatically and remain for GM interpretation. Other weapon profiles and actions not yet displayed by the existing item UI remain outside the current UI.
