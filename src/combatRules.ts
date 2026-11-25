// The combat guide's seed text, from the campaign's handbook (docs/combat-handbook.md). The page reads it through src/rulesData.ts
// (content kind 'rules', editable), so only rulesData.ts and baseActions.ts import this file.
// An action's "text" is rules text: plain words, or the small HTML RulesText.vue allows (<b>, <i>, lists). Table and
// glossary strings are plain text. "activation" is an ActionChip word (Quick, Full, Reaction, Free, Overcharge,
// Protocol, Quick Tech, Full Tech, Invade); leave it out for no chip.
// "gist" is the one short line a collapsed row shows; a row without one shows its text's first sentence.
// Which card an action sits in under the "1 full" and "2 quick" steps. "move" (Boost, Disengage) is for the Movement step.
// Core Power and reactions have none.
export type ActionGroup = 'attack' | 'tech' | 'other' | 'move'
export type CombatAction = { name: string; activation?: string; frequency?: string; gist?: string; group?: ActionGroup; text: string }
// short: a narrower value for the
// value column of a row list, where "7 or less" wouldn't fit.
export type CombatRow = { value: string; short?: string; name?: string; gist?: string; text: string; icon?: string } // tables and lists
export type CombatFormula = { formula: string; note?: string; example: string }

// Rules text that was written in the page's template, here so the search can reach it.
export const RESOURCES_NOTE = 'They reset every combat or scene.'
export const REACTIONS_NOTE = 'Reactions you declare expire at the start of your next turn.'
export const RESULTS_NOTE = "Compare your total with the target's Evasion (attacks) or E-defence (tech attacks)."
export const PILOT_CHECKS_NOTE = 'Out of the mech, pilots use narrative triggers (+2, +4 or +6). Compare 10 + trigger with the DC.'
export const PUSHING_THROUGH = "Spend {action:act_lancer_s_edge} or take 1 narrative stress to close a gap of 1 or 2."
export const STRUCTURE_TRIGGERS: { name: string; icon: string; text: string }[] = [
  { name: 'Structure', icon: 'structure', text: 'When your HP hits 0, take 1 structure damage. Your HP resets to full, and leftover damage carries over.' },
  { name: 'Stress', icon: 'reactor', text: 'When your Heat goes over your Heat cap, take 1 stress damage. Your Heat resets to 0, and leftover Heat carries over.' },
]
export const MOVEMENT_NOTE = "There's no grid. You describe where you are, and Speed and range decide what you can reach."
export const KNOCKBACK_NOTE = 'Only on a full hit or crit, never a grazing hit.'
export const SENSORS_NOTE = 'Sensors set the reach of tech attacks, {action:act_lock_on_quick_tech} and {action:act_bolster_quick_tech}.'
export const AURAS_NOTE = 'For anything that works within a range.'
export const COVER_NOTE = 'Terrain cover gives no defence bonus in player vs player combat. Cover from deployables still counts. Screened, Barrier-protected and Obscured still apply.'
export const CONVERSIONS_NOTE = 'For talents, traits and frames written for dice.'
export const TECH_NOTE = "Quick Tech actions are {action:act_invade}, {action:act_scan_quick_tech}, {action:act_lock_on_quick_tech}, {action:act_bolster_quick_tech}, or a system's own Quick Tech option."
export const DICE_NOTE = 'Always rounded up.'

export const TURN_STEPS: (CombatAction & { activations: string[] })[] = [
  { name: 'Protocol', activations: ['Protocol'], frequency: 'Optional', text: 'Turn on a protocol system at the very start of your turn, before you move or act.' },
  { name: 'Movement', activations: [], text: 'Move using your Speed.' },
  { name: '1 full', activations: ['Full'], text: "Take 1 full action instead of 2 quick actions. You can't take the same action twice in a turn, unless an ability or {action:act_overcharge} lets you." },
  { name: '2 quick', activations: ['Quick'], text: "Take 2 quick actions instead of 1 full action." },
  { name: 'Overcharge', activations: ['Overcharge'], frequency: 'Once a turn', text: 'Use {action:act_overcharge}.' },
  { name: 'Free', activations: ['Free'], text: 'Free actions cost no action. Core powers, systems and some gear use them.' },
  { name: 'Reaction', activations: ['Reaction'], frequency: 'End of your turn', text: 'Declare 1 reaction at the end of your turn. You commit to it in advance instead of interrupting another post. See {action:act_brace_reaction} and {action:act_overwatch_reaction}.' },
]

export const SCENE_RESOURCES: CombatAction[] = [
  { name: "Lancer's Edge", frequency: '2 a scene', text: 'Add +2 (1 Accuracy) to any attack, tech attack, check or save.' },
  { name: "Lancer's Precision", frequency: '1 a scene', text: "Declare it before an attack resolves. It turns a grazing hit (1 to 3 under) or a full hit (equal or over) into a critical hit. It's used up whether the attack hits or misses." },
]

export const QUICK_ACTIONS: CombatAction[] = [
  { name: 'Skirmish', activation: 'Quick', group: 'attack', text: 'Attack with 1 weapon, plus a second Auxiliary weapon on the same mount if it has one.' },
  { name: 'Boost', activation: 'Quick', group: 'move', text: "Move again. Use it to cover more ground or reach a Speed gateway your Speed can't." },
  { name: 'Reload', activation: 'Quick', group: 'other', text: 'Reload one Loading weapon, or one mount holding Loading weapons.' },
  { name: 'Invade', activation: 'Invade', group: 'tech', text: 'Make a tech attack against E-defence. On a hit, deal 2 Heat plus a hacking effect. The basic option, Fragment signal, leaves the target Impaired and Slowed until the end of its next turn. Systems and talents add other options.' },
  { name: 'Lock on', activation: 'Quick Tech', group: 'tech', text: 'Mark a target you can see as Locked on. No check needed.' },
  { name: 'Bolster', activation: 'Quick Tech', group: 'tech', text: 'Give an ally +2 (1 Accuracy) on their next check or save.' },
  { name: 'Hide', activation: 'Quick', group: 'other', text: "Become Hidden if you're out of direct sight, Obscured or Invisible, and not Engaged." },
  { name: 'Search', activation: 'Quick', group: 'other', text: 'Find a Hidden target. Compare your 10 + Systems with their 10 + Agility. On a tie, the hider may take 1 Heat to stay Hidden.' },
  { name: 'Prepare', activation: 'Quick', group: 'other', text: "Ready a Quick action and give it a trigger, worded as 'When X, then Y'. Until the start of your next turn, you take it as a reaction when the trigger happens. It counts as taking the action, so the usual limits apply (no Skirmish twice, no Ordnance after moving). You can't move or take other actions or reactions while holding it. Dropping it frees your reactions. If the trigger never happens, it's lost." },
  { name: 'Ram', activation: 'Quick', group: 'attack', text: 'Melee attack on an adjacent target. On a full hit or crit, knock them Prone and Knockback 1.' },
  { name: 'Grapple', activation: 'Quick', group: 'attack', text: "Melee attack on an adjacent target. On a hit, a bigger mech holds a smaller one in place, and the smaller mech can't move on its own. Between mechs of the same size, the higher Hull is in control. Breaking free costs the grappled mech 1 quick action and 1 Heat." },
  { name: 'Scan', activation: 'Quick Tech', group: 'tech', text: 'No check needed. Learn one thing about a target in Sensors range:<ul><li>Its HP, Structure and Heat.</li><li>Its defences.</li><li>Its weapons and systems.</li><li>Its statuses.</li></ul>' },
  { name: 'Activate', activation: 'Quick', group: 'other', text: 'Use a system with the Quick tag.' },
  { name: 'Skill check', activation: 'Quick', group: 'other', text: 'Make a check for Hull, Agility, Systems or Engineering when the GM calls for one.' },
  { name: 'Shut down', activation: 'Quick', group: 'other', text: 'Clear all Heat and Exposed, and end any condition a tech attack caused. You gain Shutdown until you {action:act_boot_up_full}.' },
  { name: 'Eject', activation: 'Quick', group: 'other', frequency: 'Once a scene', text: "The pilot is thrown clear to Close range. The empty mech is Impaired and can't act." },
  { name: 'Self-destruct', activation: 'Quick', group: 'other', text: 'At the end of your next turn your mech explodes: Burst 2, 14 explosive damage. Anyone caught can make an Agility save (DC 14) for half. The mech is destroyed, and a pilot still inside dies.' },
]

export const FULL_ACTIONS: CombatAction[] = [
  { name: 'Barrage', activation: 'Full', group: 'attack', text: 'Attack with 2 weapons, or 1 Superheavy weapon.' },
  { name: 'Disengage', activation: 'Full', group: 'move', text: 'Move safely, without triggering Overwatch or Engagement penalties.' },
  { name: 'Stabilize', activation: 'Full', group: 'other', text: 'Cool down, reload and patch up. Choose one from each line:<ol><li>Clear all Heat to 0, or spend 1 Repair (see Rest).</li><li>Reload all Loading weapons, clear all Burn, or clear one condition (such as Impaired or Jammed) on yourself or an Engaged ally.</li></ol>' },
  { name: 'Boot up', activation: 'Full', group: 'other', text: "Turn your mech back on after Shutdown. It's the one full action you can still take while in Shutdown." },
  { name: 'Full tech', activation: 'Full Tech', group: 'tech', text: "Two Quick Tech actions, which may both be {action:act_invade} at the same or different targets, or a system's own Full Tech option." },
  { name: 'Activate', activation: 'Full', group: 'other', text: "Use a system with the Full tag. Overcharge's extra quick action can't pay for it." },
  { name: 'Mount or dismount', activation: 'Full', group: 'other', text: "Get into or out of a mech you're Engaged with. An empty mech can't act." },
  { name: 'Core power rules', frequency: 'Once a mission', text: 'Use the activation and duration the power gives. It returns at Full Repair. Passive core effects are always on.' },
]

export const OVERCHARGE: CombatAction = {
  name: 'Overcharge',
  activation: 'Overcharge',
  frequency: 'Once a turn',
  text: 'Gain 1 extra quick action straight away. Each use costs more Heat, until your next Full Repair. After the last step, the cost stays at {overcharge_heat} Heat.',
}
// Balance numbers the mech page shares (mechResources). Change them here, and log the change in docs/rule-decisions.md.
export const OVERCHARGE_HEAT = [1, 2, 4, 6]
export const REPAIR_COST = 2 // Repairs to restore 1 Structure or 1 Stress at a Rest. Frames like the Everest lower it.

export const REACTIONS: CombatAction[] = [
  { name: 'Brace', activation: 'Reaction', text: "The first damaging attack on you before your next turn deals half damage and half Heat. On your next turn you can't take reactions or move, and you can take only 1 quick action (no full actions or Overcharge)." },
  { name: 'Overwatch', activation: 'Reaction', text: 'Name a Melee or CQB weapon (not Heavy) and a target. If that target moves away from you before your next turn, you get a free attack on them on your next turn.' },
  { name: 'Reaction systems', activation: 'Reaction', text: 'Systems and talents with the Reaction tag that change a total are declared at the end of your turn too. They add +2 (1 Accuracy) or −2 (1 Difficulty) to the total when it happens.' },
]

export const ATTACK_FORMULAS: CombatFormula[] = [
  { formula: 'Attack = 10 + Grit (or NPC bonus) + accuracy − difficulty', example: 'Grit 2, target Locked on: 10 + 2 + 2 = 14' },
  { formula: 'Tech attack = 10 + Tech attack + accuracy − difficulty', example: "Tech attack 1, you're Impaired: 10 + 1 − 2 = 9" },
  { formula: '1 Accuracy = +2 · 1 Difficulty = −2', note: 'At most 2 of either on one attack or check (±4), from weapon tags, statuses and reactions combined.', example: 'Accurate weapon against a Prone target: 2 Accuracy, +4' },
]

export const ATTACK_RESULTS: { margin: string; note?: string; physical: [string, string]; tech: [string, string] }[] = [
  { margin: '3 or more over', note: 'Or {action:act_lancer_s_precision} on a full hit or grazing hit', physical: ['Critical hit', 'Damage × 1.25, rounded up, plus on-hit and crit effects.'], tech: ['Critical hack', 'Full Heat, full effects and crit effects.'] },
  { margin: 'Equal, up to 2 over', physical: ['Full hit', 'Full damage plus on-hit effects.'], tech: ['Full hack', 'Full Heat and full effects.'] },
  { margin: '1 to 3 under', physical: ['Grazing hit', 'Half damage, rounded up. No on-hit effects.'], tech: ['Partial hack', '1 Heat (or Impaired until the end of next turn). No full hack effects.'] },
  { margin: '4 or more under', physical: ['Miss', 'No damage, unless the weapon is Reliable.'], tech: ['Fail', 'No effect.'] },
]

export const DAMAGE_FORMULAS: CombatFormula[] = [
  { formula: 'Critical hit = (weapon damage + flat bonuses) × 1.25, rounded up', example: '3 becomes 4 · 5 becomes 7 · 6 becomes 8' },
  { formula: 'Grazing hit = damage ÷ 2, rounded up', example: '5 damage: 3' },
  { formula: 'Damage taken = damage − armour', note: 'Armour (usually 0 to 4) only counts against kinetic, explosive and energy. Armour piercing (AP) or being Shredded ignores it. Burn always ignores it.', example: '6 kinetic against armour 2: 4' },
]
export const ATTACK_EXTRAS: CombatRow[] = [
  { value: 'Grit', text: "Half your licence level, rounded up. It's on your pilot sheet. Pilots on foot use it too." },
  { value: 'Bonus damage', text: "Flat damage from Overkill, talents and systems. It's added before the crit multiplier. The second Auxiliary weapon on a mount doesn't get it." },
  { value: 'Damage resistance', text: 'Halves damage of the named type, rounded up, after armour. You lose it while Shredded.' },
  { value: 'Heat as damage', text: "Heat you deal goes straight onto the target's Heat. Armour doesn't reduce it. Resistance to Heat halves it." },
]
export const IMPROVISED: CombatAction = {
  name: 'Improvised attack',
  activation: 'Full',
  group: 'attack',
  text: 'A melee attack (Range 1) with a fist, a rifle butt or a lump of wreckage. It deals 4 kinetic damage and is resolved like any other attack.',
}
export const DEFENCES: { mech: string; evasion: string; edef: string }[] = [
  { mech: 'Light or nimble', evasion: '12–14', edef: '10–12' },
  { mech: 'Medium or standard', evasion: '10–12', edef: '10–12' },
  { mech: 'Heavy or superheavy', evasion: '8–10', edef: '10–14' },
]

export const CHECK_FORMULAS: CombatFormula[] = [
  { formula: 'Check or save = 10 + Hull, Agility, Systems or Engineering', example: 'Agility 2 against DC 12: 10 + 2 = 12, a tie' },
]
export const CHECK_RESULTS: CombatRow[] = [
  { value: 'Over the DC', text: 'Success' },
  { value: 'Under the DC', text: 'Fail' },
  { value: 'Equal to the DC', text: 'The defender takes 1 Heat to succeed, or chooses to fail.' },
]
export const PILOT_DCS: CombatRow[] = [
  { value: '12', text: 'Routine or trained' },
  { value: '14', text: 'Risky or expert' },
  { value: '16', text: 'Heroic or near impossible' },
]

export const STRUCTURE_STRESS: { n: number; structure: string; stress: string }[] = [
  { n: 1, structure: 'Impaired until the end of your next turn.', stress: 'Impaired until the end of your next turn.' },
  { n: 2, structure: 'Destroy one eligible weapon mount or system.', stress: 'Gain Exposed.' },
  { n: 3, structure: 'Stunned until the end of your next turn.', stress: 'Stunned until the end of your next turn.' },
  { n: 4, structure: 'Blow up. The mech is wrecked.', stress: 'Melt down. The reactor goes critical and explodes.' },
]

export const STRUCTURE_NOTE = "On Structure 2 with nothing left to destroy, you're Stunned until the end of your next turn instead. The defender chooses which weapon or system is destroyed."

export const REPAIRS: CombatRow[] = [
  { value: 'Rest', text: `A short break between scenes. Clear all Heat and statuses. Spend Repairs: 1 restores all HP, 1 fixes one destroyed weapon or system, and {repair_cost} restore 1 Structure or 1 Stress. Some frames cost less, as shown on your mech page.` },
  { value: 'Full Repair', text: 'Downtime between missions, when the GM calls it. Everything returns: HP, Structure, Stress, Repairs, Limited uses, destroyed parts and your Core Power. Overcharge goes back to {overcharge_first} Heat.' },
]

// Said once: the Engaged status and the Engaged range tier both use it.
const ENGAGED_TEXT = "You're Engaged with anyone at Range 1. It ends when either of you moves away, is knocked back or Disengages. You can be Engaged with several enemies at once. While Engaged, Range 6+ attacks get −2 (1 Difficulty)."

const STATUS_ROWS: CombatRow[] = [
  { value: 'Barrier-protected', text: "From a Shield. Ranged attacks against you get −2 (1 Difficulty). Melee isn't affected. It doesn't stack with Screened." },
  { value: 'Burn X', text: 'Take X burn damage at the end of your turn, ignoring armour. Then Burn goes down by 1 + half your Engineering (rounded down) until it reaches 0. {action:act_stabilize_full} clears it at once.' },
  { value: 'Danger zone', text: "Your Heat is at least half your Heat cap. Danger zone tags work while you're in it." },
  { value: 'Down and out (pilot status)', text: "A pilot at 0 HP. You're Stunned and die if you take any more damage. An ally Engaged with you can use the second choice of {action:act_stabilize_full} to bring you back to 1 HP." },
  { value: 'Engaged', text: ENGAGED_TEXT },
  { value: 'Exposed', text: 'Kinetic, explosive and energy damage you take is doubled, until you clear it with {action:act_stabilize_full}.' },
  { value: 'Hidden', text: "Enemies know your rough area, but can't target you with attacks. It ends when you attack, lose your cover or obscurement, or someone finds you with {action:act_search_quick}." },
  { value: 'Immobilized', text: "You can't move or {action:act_boost_quick} by choice, and you fail Agility checks and saves. Knockback can still move you." },
  { value: 'Impaired', text: '−2 (1 Difficulty) on all attacks, tech attacks, checks and saves.' },
  { value: 'Intangible', text: "You can't affect or be affected by physical attacks, tech attacks, objects or characters until it ends. You can still move as normal." },
  { value: 'Invisible', text: "Attacks against you get −2 (1 Difficulty). You can {action:act_hide_quick} in the open without cover or Obscured terrain (unless Engaged). Your movement doesn't trigger {action:act_overwatch_reaction}. You get +1 Speed toward Speed gateways." },
  { value: 'Jammed', text: "You can't make normal ranged or tech attacks, use systems, take reactions or talk over comms. You can only Move, {action:act_boost_quick}, {action:act_improvised_attack_full}, {action:act_grapple_quick} or {action:act_ram_quick}." },
  { value: 'Lock on', text: 'The next attacker can use it up to get +2 (1 Accuracy) on their attack against you.' },
  { value: 'Obscured', text: "From smoke, darkness or a system's cloud. Attacks against you from beyond Close get −2 (1 Difficulty), and you can {action:act_hide_quick}. Seeking weapons can't hit you. Smart weapons ignore it." },
  { value: 'Prone', text: 'Attacks against you get +2 (1 Accuracy). You count as Slowed, and standing up uses your Movement.' },
  { value: 'Screened', text: "From a system or a deployable. Plain terrain gives nothing in player vs player combat. Ranged attacks against you get −2 (1 Difficulty). Melee isn't affected. It doesn't stack with Barrier-protected." },
  { value: 'Shredded', text: "Armour and resistance don't protect you. All damage hits at full value." },
  { value: 'Shutdown', text: "You're Stunned, lose all active system effects, and are immune to tech attacks, until you spend a full action to {action:act_boot_up_full}." },
  { value: 'Slowed', text: "You can't use Speed gateways (only Standard repositioning) and can't {action:act_boost_quick}." },
  { value: 'Stunned', text: 'Until the end of your next turn you can take only 1 quick action (no full actions, Movement, {action:act_overcharge} or reactions). Attacks against you get +2 (1 Accuracy).' },
]

// Grouped by what they do, as the seed of the status rules. "Conditions" is the word Stabilize and Shut down use.
const statuses = (...names: string[]) => names.map((name) => STATUS_ROWS.find((row) => row.value.startsWith(name))!)
export const STATUS_SEED: [group: string, rows: CombatRow[]][] = [
  ['cover', statuses('Barrier-protected', 'Screened', 'Obscured', 'Hidden', 'Invisible', 'Intangible')],
  ['conditions', statuses('Immobilized', 'Impaired', 'Jammed', 'Lock on', 'Shredded', 'Slowed', 'Stunned')],
  ['other', statuses('Burn X', 'Danger zone', 'Down and out', 'Engaged', 'Exposed', 'Prone', 'Shutdown')],
]

export const SPEED_GATEWAYS: CombatRow[] = [
  { value: 'Any', name: 'Standard repositioning', text: 'Move around your local area. Take cover, change angle, engage an adjacent target or step back a little.' },
  { value: '5+', name: 'Cross-field maneuver', text: 'Cross the main battlefield to reach a distant target, get behind a front line or make a big change in height, in one move. At Speed 4 or less you need a Boost.' },
  { value: '6+', name: 'Extreme dash', text: 'Break out of a brawl and cross the field to a new position, in one turn. At Speed 5 or less you need a Boost.' },
]
export const TERRAIN: CombatRow[] = [
  { value: 'Difficult terrain', text: 'Rubble, deep mud or wreckage. Crossing it takes 2 off your Speed for that turn.' },
  { value: 'Dangerous terrain', text: 'Plasma vents, acid pools or collapsing debris. Entering it or ending your turn in it costs a flat penalty (such as 2 Heat or 3 damage), unless you pass a flat Agility or Engineering check.' },
]
export const KNOCKBACK: CombatRow[] = [
  { value: '1', text: 'Breaks Engagement. The target is pushed to Close range.' },
  { value: '2', text: 'Slams the target into nearby terrain or walls, or off a low ledge.' },
  { value: '3+', text: 'Launches the target across the battlefield or into dangerous terrain.' },
]

export const RANGE_TIERS: CombatRow[] = [
  { value: '1', name: 'Engaged (melee)', text: ENGAGED_TEXT },
  { value: '2+', name: 'Close', text: 'Anyone in the brawl or nearby cover, without entering Engagement.' },
  { value: '6+', name: 'Medium', text: 'Anywhere across the central firefight with a clear sightline.' },
  { value: '11+', name: 'Far', text: 'Rear lines, ridges or distant targets along long sightlines.' },
  { value: '21+', name: 'Extreme', text: 'Anywhere on the battlefield, unless the target is completely cut off from line of sight.' },
]
export const AREAS: CombatRow[] = [
  { value: 'Burst', icon: 'burst', text: 'Everyone Engaged with you (Burst 1), or everyone in your immediate area at Close range (Burst 2+).' },
  { value: 'Blast', icon: 'blast', text: 'The target plus 1 or 2 nearby targets around the same cover, objective or squad.' },
  { value: 'Cone', icon: 'cone', text: 'Up to 2 or 3 targets in a forward arc toward your target.' },
  { value: 'Line', icon: 'line', text: 'The target plus 1 or 2 targets directly behind them in the same firing lane.' },
]
export const RANGE_BONUSES: CombatRow[] = [
  { value: '+1 to +4 Range', text: 'Ignores partial sightline or angle penalties within your range tier, or lets a Close (2+) weapon reach Medium (6+) from a strong vantage point.' },
  { value: '+5 Range or more', text: 'Moves the weapon up one full range tier (for example Medium 6+ to Far 11+).' },
  { value: '+1 to +2 Threat', text: 'Melee only. Make melee attacks and declare {action:act_overwatch_reaction} against targets at Close range (2+) without entering Engagement.' },
]
export const SENSORS: CombatRow[] = [
  { value: '7 or less', short: '≤7', name: 'Short range', text: 'Engaged or Close range only.' },
  { value: '8–14', name: 'Tactical', text: 'Anywhere in the central firefight (Medium range).' },
  { value: '15 or more', short: '15+', name: 'Battlefield-wide', text: 'Anywhere in the scene. Ignores Obscured for {action:act_lock_on_quick_tech} and {action:act_search_quick}.' },
]
export const AURAS: CombatRow[] = [
  { value: '1–2', text: 'Anyone Engaged with you or sharing your immediate cover.' },
  { value: '3–7', text: 'Anyone in your local Close range area, or 1 ally or enemy you tether to at the start of your turn.' },
  { value: '8+', text: 'Anyone in sight across the central firefight.' },
]
export const RANGE_TALENTS: CombatRow[] = [
  { value: 'Within range 3', text: 'Engaged or Close range (2+).' },
  { value: 'Beyond range 5 or 8+', text: 'Medium, Far or Extreme range, while not Engaged and without using a Cross-field maneuver.' },
]

export const FOOT_RULES: CombatRow[] = [
  { value: 'Pilot stats', text: 'HP, E-defence, armour and Speed are on your pilot sheet. Pilots have no Evasion.' },
  { value: 'Pilot attacks', text: "10 + Grit against the target's Evasion. Use the flat damage on the pilot weapon." },
  { value: 'Attacks on a pilot', text: 'Compare the attack with a flat 10, plus any bonuses from gear or talents.' },
  { value: 'Mech destroyed', text: 'When your mech blows up, the pilot survives. They are thrown clear to Close range, Prone and Stunned until the end of their next turn.' },
  { value: 'Melt down', text: 'The reactor explodes at the end of your next turn, like {action:act_self_destruct_quick}. The pilot must {action:act_eject_quick} before then or dies.' },
  { value: 'Pilot gear', text: 'Up to {loadout_weapons} pilot weapons, {loadout_armour} armour and {loadout_gear} gear.' },
]
export const JOCKEY: CombatAction = {
  name: 'Jockey',
  activation: 'Full',
  group: 'attack',
  text: "Climb onto a mech you're Engaged with. Compare 10 + Grit with the mech's 10 + Hull. On a success, choose one each turn you stay on:<ul><li><b>Distract:</b> Impaired and Slowed until the end of its next turn.</li><li><b>Shred:</b> 2 Heat.</li><li><b>Damage:</b> 4 kinetic, ignoring armour.</li></ul>The mech can shake you off with a successful Hull check on its turn.",
}
export const FIGHT: CombatAction = {
  name: 'Fight',
  activation: 'Full',
  group: 'attack',
  text: "Attack with a pilot weapon. Compare 10 + Grit with the target's Evasion. Use the flat damage on the weapon.",
}
export const PILOT_OVERWATCH: CombatAction = {
  name: 'Overwatch',
  activation: 'Reaction',
  text: 'Name a pilot weapon and a target. If the target moves away from you before your next turn, you get a free attack with that weapon on your next turn.',
}
// What a pilot on foot can do, reusing the mech action objects. It throws if a name goes missing.
const pick = (list: CombatAction[], name: string, activation?: string) => {
  const found = list.find((a) => a.name === name && (!activation || a.activation === activation))
  if (!found) throw new Error(`Pilot action not found: ${name}`)
  return found
}
export const PILOT_ACTIONS: CombatAction[] = [
  ...['Boost', 'Hide', 'Search'].map((n) => pick(QUICK_ACTIONS, n)),
  pick(QUICK_ACTIONS, 'Activate', 'Quick'),
  ...['Reload', 'Skill check'].map((n) => pick(QUICK_ACTIONS, n)),
  pick(FULL_ACTIONS, 'Mount or dismount'),
  FIGHT,
  JOCKEY,
  IMPROVISED,
  PILOT_OVERWATCH,
]
export const DRONES_NOTE = 'Unless the system says otherwise: Size ½, HP 5, Evasion 10, E-defence 10 and armour 0. Note their location and HP at the end of each post.'
export const SIZE_NOTE = 'Every frame has a Size on its sheet (½, 1, 2 or 3). Grapple compares Sizes.'

export const WEAPON_SIZES: CombatRow[] = [
  { value: 'Auxiliary', text: 'Light weapons. A mount holding two Auxiliary weapons (Flex or Aux/Aux) fires both with one {action:act_skirmish_quick} or {action:act_barrage_full}. The second one deals its base damage only, without bonus damage.' },
  { value: 'Main', text: 'Standard mech weapons. One fires per Skirmish.' },
  { value: 'Heavy', text: "High-impact weapons. They can't be fired with {action:act_overwatch_reaction} unless a talent says so." },
  { value: 'Superheavy', text: "Takes up two mounts and needs a full action ({action:act_barrage_full}) to fire. It can't be used with {action:act_skirmish_quick} or {action:act_overwatch_reaction}." },
]
export const DICE: CombatRow[] = [
  { value: '1d3', text: '2 damage' },
  { value: '1d6', text: '4 damage' },
  { value: '2d6', text: '7 damage' },
  { value: '3d6', text: '11 damage' },
]
export const RECHARGE: CombatRow[] = [
  { value: 'Recharge 4+ or 50%', text: 'A 1-turn cooldown (usable every other turn), or triggers on a full hit.' },
  { value: 'Recharge 5+', text: 'A 2-turn cooldown, or triggers on a critical hit.' },
  { value: 'Recharge 6', text: 'A 3-turn cooldown, or once a scene.' },
]

// Gists (see CombatRow.gist), set by name or value so the arrays above keep the handbook's wording.
const gists = (rows: { name?: string; value?: string; gist?: string }[], map: Record<string, string>) =>
  rows.forEach((row) => { row.gist = map[(row.name ?? row.value)!] ?? row.gist })
gists(TURN_STEPS, { Protocol: 'Turn on a protocol at the very start of your turn.', Movement: 'Move using your Speed.', '1 full': 'Take 1 full action.', '2 quick': 'Take 2 quick actions.', Overcharge: 'Gain 1 extra quick action for Heat.', Free: 'Free actions cost no action.', Reaction: 'Declare 1 reaction in advance.' })
gists(SCENE_RESOURCES, { "Lancer's Edge": 'Add +2 to any attack, check or save.', "Lancer's Precision": 'Turn a hit into a critical hit.' })
gists(QUICK_ACTIONS, {
  Skirmish: 'Attack with 1 weapon.', Prepare: 'Ready a Quick action to take as a reaction.', Reload: 'Reload one Loading weapon or mount.', 'Lock on': 'Mark a target as Locked on.', Bolster: 'Give an ally +2 on their next check or save.',
  Hide: "Become Hidden if you're out of sight and not Engaged.", Search: 'Find a Hidden target.', Ram: 'Knock an adjacent target Prone.', Grapple: 'Hold an adjacent target in place.',
  'Skill check': 'Make a check when the GM calls for one.', 'Shut down': 'Clear all Heat and Exposed, then gain Shutdown.', Eject: 'Throw the pilot clear to Close range.',
  'Self-destruct': 'Your mech explodes at the end of your next turn.', Invade: 'Tech attack for 2 Heat plus a hacking effect.',
  Scan: 'Learn one thing about a target. No check needed.',
})
gists(FULL_ACTIONS, { Barrage: 'Attack with 2 weapons, or 1 Superheavy.', Disengage: 'Move without triggering Overwatch or Engagement.', 'Mount or dismount': 'Get into or out of a mech.', 'Full tech': "Take two Quick Tech actions, or a system's option.", 'Core power rules': "Use your frame's core power." })
gists([IMPROVISED, JOCKEY, OVERCHARGE, FIGHT, PILOT_OVERWATCH], { Overwatch: 'Get a free attack on a target that moves away.', Fight: 'Attack with a pilot weapon.', 'Improvised attack': 'A melee attack that deals 4 kinetic damage.', Jockey: "Climb onto a mech you're Engaged with.", Overcharge: 'Gain 1 extra quick action for Heat.' })
gists(REACTIONS, { Brace: 'Halve the next damaging attack on you.', Overwatch: 'Get a free attack on a target that moves away.', 'Reaction systems': 'Declare them at the end of your turn too.' })
gists(STATUS_ROWS, {
  'Barrier-protected': 'Ranged attacks against you get −2.', Screened: 'Ranged attacks against you get −2.', Obscured: 'Attacks from beyond Close get −2. You can Hide.',
  Invisible: 'Attacks against you get −2. You can Hide in the open.', Intangible: "Physical and tech attacks can't affect you.", Impaired: '−2 on all attacks, checks and saves.',
  Jammed: 'You can only Move, Boost, Improvised attack, Grapple or Ram.', 'Lock on': 'The next attacker gets +2 against you.', Slowed: "You can't use Speed gateways or Boost.",
  Stunned: 'You can take only 1 quick action. Attacks against you get +2.', 'Danger zone': 'Your Heat is at least half your Heat cap.', 'Down and out (pilot status)': 'A pilot at 0 HP dies from any more damage.',
  Engaged: "You're Engaged with anyone at Range 1.", Exposed: 'Kinetic, explosive and energy damage you take is doubled.', Prone: 'Attacks against you get +2. You count as Slowed.',
  Shutdown: 'Stunned and immune to tech attacks until you Boot up.',
})
gists(SPEED_GATEWAYS, { 'Standard repositioning': 'Move around your local area.', 'Cross-field maneuver': 'Cross the main battlefield in one move.', 'Extreme dash': 'Break out of a brawl and cross the field.' })
gists(TERRAIN, { 'Difficult terrain': 'Crossing it takes 2 off your Speed.', 'Dangerous terrain': 'Entering it or ending your turn in it costs a penalty.' })
gists(AREAS, { Burst: 'Everyone around you.', Blast: 'The target plus 1 or 2 nearby targets.', Cone: 'Up to 2 or 3 targets in a forward arc.', Line: 'The target plus 1 or 2 targets behind them.' })
gists(REPAIRS, { Rest: 'A short break between scenes.', 'Full Repair': 'Downtime between missions. Everything returns.' })
gists(WEAPON_SIZES, { Auxiliary: 'Light weapons. Two on a mount fire together.' })
