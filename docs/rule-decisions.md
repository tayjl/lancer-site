# Rule decisions (the developer's)

Every game-rule decision the developer has made, newest first, with the date. Check here before writing or changing any rule text, rule code or combat guide content. When the developer decides something new, add a line here in the same change.

Where the full rules live: [combat-handbook.md](combat-handbook.md) (combat, the developer's own sections 1–8 plus the adapted section 9) and [lancer-rules.md](lancer-rules.md) (character building and how the site enforces it).

## How to change a rule
Rules will keep changing. To change one:
1. Add a dated line below saying what changed and why.
2. Change it at its source (table below). Rules text goes in the handbook first, then the site's wording in `src/combatRules.ts`.
3. Run `npm test`. Tests that pin a number tell you what else expects the old value. Update them on purpose, never just to pass.

| Rule | Where it lives |
|---|---|
| Combat guide text (actions, statuses, tags, ranges, rest) | [combat-handbook.md](combat-handbook.md), then `src/combatRules.ts`. Base action and tag wording lives in the content editor (kinds Actions and Tags); `src/baseActions.ts` is the seed and fallback |
| Overcharge steps, Repairs per Structure or Stress | `OVERCHARGE_HEAT`, `REPAIR_COST` in `src/combatRules.ts` (the combat guide and the mech page both read them) |
| Dice to flat damage (rounding) | `flatDamage()` in `src/damage.ts` |
| Pilot HP, armour, Speed, E-defence | `pilotVitals()` in `src/gameData.ts` |
| Mech stats from frame and HASE | `mechStats()` in `src/mechData.ts` |
| Starting manna, levelling, licences | `STARTING_MANNA` and the rest of `src/rules.ts`, described in [lancer-rules.md](lancer-rules.md) |
| One frame, weapon, system or talent | Not code: owners edit it in the content editor (Content tab) |

## 2026-11-22
- **Never say "roll" on screen** (no dice). Say "compare with" or "check against".
- **The combat guide follows the developer's handbook**, [combat-handbook.md](combat-handbook.md): diceless, mapless, for text posts. Change the handbook first, then `src/combatRules.ts`.
- **Dice convert by rounding up, everywhere**, the combat handbook included (1d3 = 2, 1d6 = 4, 2d6 = 7, 3d6 = 11). The handbook's own "1d6 = 3" was overruled.
- **Overcharge costs 1 → 2 → 4 → 6 Heat**, and stays at 6 after the 4th use, until a Full Repair. This is the default on the mech page too (`mechResources()`). A frame or talent's own steps replace it.
- **Rest: 2 Repairs restore 1 Structure or 1 Stress.** 1 Repair restores all HP or fixes one destroyed part. Frames like the Everest lower the Structure cost (`cheap_struct`).
- **Pegasus-specific rules aren't in the handbook.** The developer balances those items on their own content pages.
- **Lock On and Bolster are Quick actions**, as the handbook says.
- **Section 9 of the handbook** (core-book rules adapted by Claude at the developer's request) is adopted. Balance calls made there that the developer hasn't confirmed: the defender picks which part Structure 2 destroys, Obscured gives −2 only beyond Close, and Self-Destruct allows a DC 14 Agility save for half.
- **Grit** is half the licence level, rounded up. It's used in attack totals (handbook formula). Mech stats still don't add it.
- **Attacks against a pilot on foot are compared with a flat 10**, plus bonuses from gear or talents. **10 is the base DC for everything**, changed by stats and bonuses where they apply.

- **Pilots on foot can take** Boost, Hide, Search, Activate, Reload, Skill check, Fight, Jockey, Mount or dismount, Improvised attack and Overwatch. No Overcharge, tech actions or Core Power. Fight is 10 + Grit against Evasion with the pilot weapon's flat damage.
- **Fight is a Quick action too with a Sidearm weapon (Light A/C, Light Signature)**, as the tag says.
- **Pilot Overwatch uses any pilot weapon, not the mech weapon classes.**

## 2026-11-21
- **Starting manna is 2000.**

## 2026-11-19
- **Grit is shown** on the pilot sheet (half the level, rounded up).

## 2026-10-31
- **No dice in the homebrew.** Damage is a flat number, never called an "average". Other dice in game text (movement, Limited, checks) are left for the developer to decide case by case.

## 2026-10-29
- **Damage is the mean of the dice, rounded up once** (`flatDamage()`, see [lancer-rules.md](lancer-rules.md#damage-homebrew-2026-10-29)).
- **Pilot combat stats:** HP 6, armour 0, Speed 4, E-defence 10. **Pilots have no Evasion.** Mechs keep normal Evasion.
- **Players have one living character at a time.** GMs and owners can have several.

## Still open
- Starting pilot stats and starting level (CLAUDE.md, Open questions).
