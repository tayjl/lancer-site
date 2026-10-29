# LANCER rules the site follows

The character rules from the LANCER core book that the site needs, how each one is handled, and where in the code.
House rules from CLAUDE.md win where they differ (no grit, custom pilot stats, bionics, no skill triggers and so on).

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
| What's spent is worked out from the sheet: **licence ranks 600, biomods 500, talent ranks 300**. Balance = received − spent. Lowering a rank or removing a biomod refunds it. | Enforced (pickers block what the balance can't cover; the rule check flags a negative balance) |
| **GMS gear** is free to print. **Licensed gear** (frames, weapons, systems) is free once you hold the licence rank. | Enforced |
| Manna spent outside the sheet (bribes, repairs, anything narrative) isn't tracked. GMs lower "manna received" for it. | GM |
| Starting level and manna for a new pilot. | GM (entered by hand; open question in CLAUDE.md) |

Prices are `PRICES` in `src/rules.ts`. Changing them re-prices everything already bought, because spending is worked out, not stored.

## Licences

| Rule | Status |
|---|---|
| A **licence** belongs to one frame (in the data, a frame's id is its licence id). It has ranks I to III, bought one at a time with manna. | Enforced |
| **Licence level** is the total licence ranks bought. | Enforced (worked out) |
| **Frames** need rank II in their licence. GMS frames (licence level 0, e.g. the Everest) need none. | Enforced |
| **Mech weapons and systems** need a rank in their frame's licence at least equal to their licence level (I, II or III). GMS items (licence level 0) need none. | Enforced |
| Exotic or GM-granted gear outside licences. | Not supported. GMs can't grant it yet. |

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
| **1 armour, 2 weapons, 3 gear.** Only LANCER pilot gear, no free text. | Enforced |
| Each slot only takes its kind of item. | Enforced |

## Mechs

| Rule | Status |
|---|---|
| A mech has **one frame**, which needs a licence (above). | Enforced |
| **Mech stats** come from the frame plus HASE: hp + 2 per hull, repair cap + 1 per 2 hull, evasion + agility, speed + 1 per 2 agility, e-defence + systems, tech attack + systems, heat cap + engineering, system points + 1 per 2 systems. No grit (house rule). | Enforced (worked out, never stored); normal evasion retained by developer decision. |
| Save target and sensors. | Excluded by house rule. Size is displayed; Fomorian Frame increments it up to 3. |
| **Mounts** come from the frame. A **Main** mount takes a Main or Auxiliary weapon; **Heavy** takes a Heavy, Main or Auxiliary; **Main/Aux** takes a Main and an Auxiliary; **Aux/Aux** two Auxiliary; **Flex** one Main or two Auxiliary. | Enforced |
| A **Superheavy** weapon takes a Heavy mount **and one more mount**, which must be empty. The site uses the first other empty mount, and shows it as bracing the weapon. | Enforced |
| **System points**: weapons and systems that cost SP can't go over the mech's total. | Enforced |
| **Stat modifier stacking**: additive bonuses stack; replacement bonuses replace the base with their sum; the highest overwrite bonus replaces other additions; a bonus with both flags sets the final stat. Armour is capped at 4. | Shared calculation for displayed stats, picker capacity and pilot/GM rule checks. Each stat can show its applied sources; discarded overrides are not credited. |
| **Unique** weapons and systems: one of each per mech. | Enforced |
| **AI capacity**: one per mech, plus permanent capacity bonuses (The Lesson of Shaping). | Shared rule and picker checks, including integrated systems; Technophile III is exempt because its item has no AI-count tag. |
| Limited capacity, weapon range/damage filters, selected weapon profiles, prototype type/damage/improvements and Hunter II Thrown. | Calculated on equipment cards and in choices. Limited uses gain floor(Engineering/2) plus permanent bonuses. No expended-use tracking. |
| Drone/deployable stats; frame check modifiers and passive effects. | Structured permanent bonuses apply. Drone Commander/Hydra affect drone HP, not mech HP. Explicit supplements cover core check modifiers left in prose; actions and conditions remain references. |
| **Integrated** weapons and systems (built into a frame, e.g. the Sherman's): always on the mech, take no mount, cost no SP, can't be removed. | Enforced (shown, not pickable) |
| Changing frame takes the weapons off the mounts, because the mounts differ. Systems stay, and are rule-checked against the new frame's SP. | Enforced |
| **Weapon mods**. | Not used (house rule) |
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

- Damage is the average of the full dice expression, rounded up once: `1d6 = 4`, `2d6+1 = 8`, `1d6+1d6 = 7`. Flat damage is unchanged.
- `averageDamage()` uses an arithmetic parser, never JavaScript evaluation. Shared item details apply it to pilot and mech weapon damage, including the displayed weapon profile.
- Explicit damage phrases in item, talent and core-bonus rules text are converted too. Movement, healing, checks and limited-use dice are not damage rolls and stay unchanged.
- Variable expressions and unusual prose cannot be resolved automatically and remain for GM interpretation. Other weapon profiles and actions not yet displayed by the existing item UI remain outside the current UI.
