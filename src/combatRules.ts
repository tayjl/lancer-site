// The combat guide's text (CombatView.vue), from the campaign's handbook (docs/combat-handbook.md).
// An action's "text" is rules text: plain words, or the small HTML RulesText.vue allows (<b>, <i>, lists). Table and
// glossary strings are plain text. "activation" is an ActionChip word (Quick, Full, Reaction, Free, Overcharge,
// Protocol, Quick Tech, Full Tech, Invade); leave it out for no chip.
// "gist" is the one short line a collapsed row shows; a row without one shows its text's first sentence.
export type CombatAction = { name: string; activation?: string; frequency?: string; gist?: string; text: string }
// tags: the tag ids a TAGS row explains, so the guide can show only the ones on your gear. short: a narrower value for the
// value column of a row list, where "7 or less" wouldn't fit.
export type CombatRow = { value: string; short?: string; name?: string; gist?: string; text: string; icon?: string; tags?: string[] } // tables and lists
export type CombatFormula = { formula: string; note?: string; example: string }

// The guide's tabs, in order. The id is the url's ?tab=.
export const COMBAT_TABS: { id: string; label: string }[] = [
  { id: 'kit', label: 'Your kit' },
  { id: 'actions', label: 'Actions' },
  { id: 'attacks', label: 'Attacks' },
  { id: 'checks', label: 'Checks' },
  { id: 'statuses', label: 'Statuses' },
  { id: 'movement', label: 'Movement and range' },
  { id: 'structure', label: 'Structure' },
  { id: 'posting', label: 'Posting' },
]

export const TURN_ORDER: string[] = [
  'Players post in any order they agree on. One post is one turn.',
  'After each player turn, the GM takes one NPC turn. Any NPCs left over go once the players are done.',
  'A round ends when everyone has acted once.',
  'Players go first unless the GM calls an ambush.',
  'Reactions you declare expire at the start of your next turn.',
]

// Rules text that was written in the page's template, here so the search can reach it.
export const RESOURCES_NOTE = 'They reset every combat or scene.'
export const POST_NOTES: string[] = [
  'At the end of each post, note your HP, Structure (usually 4), Heat (up to your Heat cap), Stress (usually 4), statuses, Limited charges and Overcharges used.',
  'Note any deployables and drones too, with where they are and the HP they have left.',
]
export const POST_FOOTER = `[STATUS: 18/20 HP | 4/4 Struct | 2/6 Heat | 4/4 Stress | Edge: 2/2 | Precision: 1/1]
[POSITION: Behind comms tower | Engaged: None | Range: Medium to Vanguard, Far to Sniper]
[REACTION DECLARED: Brace (first incoming damaging attack)]`
export const REACTIONS_NOTE = 'Declare 1 reaction at the end of your turn. You commit to it in advance instead of interrupting another post.'
export const RESULTS_NOTE = "Compare your total with the target's Evasion (attacks) or E-defence (tech attacks)."
export const PILOT_CHECKS_NOTE = 'Out of the mech, pilots use narrative triggers (+2, +4 or +6). Compare 10 + trigger with the DC.'
export const PUSHING_THROUGH = "Spend Lancer's Edge (+2) or take 1 narrative stress to close a gap of 1 or 2."
export const STRUCTURE_TRIGGERS: { name: string; icon: string; text: string }[] = [
  { name: 'Structure', icon: 'structure', text: 'When your HP hits 0, take 1 structure damage. Your HP resets to full, and leftover damage carries over.' },
  { name: 'Stress', icon: 'reactor', text: 'When your Heat goes over your Heat cap, take 1 stress damage. Your Heat resets to 0, and leftover Heat carries over.' },
]
export const MOVEMENT_NOTE = "There's no grid. You describe where you are, and Speed and range decide what you can reach."
export const KNOCKBACK_NOTE = 'Only on a full hit or crit, never a grazing hit.'
export const SENSORS_NOTE = 'Sensors set the reach of tech attacks, Lock on and Bolster.'
export const AURAS_NOTE = 'For anything that works within a range.'
export const COVER_NOTE = 'Terrain cover gives no defence bonus in player vs player combat. Cover from deployables still counts. Screened, Barrier-protected and Obscured still apply.'
export const CONVERSIONS_NOTE = 'For talents, traits and frames written for dice.'
export const DICE_NOTE = 'Damage dice become flat damage, rounded up.'

export const TURN_STEPS: (CombatAction & { activations: string[] })[] = [
  { name: 'Protocol', activations: ['Protocol'], frequency: 'Optional', text: 'Turn on a protocol system at the very start of your turn, before you move or act.' },
  { name: 'Movement', activations: [], text: "Move using your mech's Speed." },
  { name: '1 full action or 2 quick actions', activations: ['Full', 'Quick'], text: "You can't take the same action twice in a turn, unless an ability or Overcharge lets you." },
  { name: 'Overcharge', activations: ['Overcharge'], frequency: 'Optional, once a turn', text: 'A free action that gives you 1 extra quick action. It costs Heat, more each time.' },
  { name: 'Reaction', activations: ['Reaction'], frequency: 'End of your turn', text: 'Declare 1 reaction at the end of your turn. You commit to it in advance instead of interrupting another post.' },
]

export const SCENE_RESOURCES: CombatAction[] = [
  { name: "Lancer's Edge", frequency: '2 a scene', text: 'Add +2 (1 Accuracy) to any attack, tech attack, check or save.' },
  { name: "Lancer's Precision", frequency: '1 a scene', text: "Declare it before an attack resolves. It turns a grazing hit (1 to 3 under) or a full hit (equal or over) into a critical hit. It's used up whether the attack hits or misses." },
]

export const QUICK_ACTIONS: CombatAction[] = [
  { name: 'Skirmish', activation: 'Quick', text: 'Attack with 1 weapon, plus a second Auxiliary weapon on the same mount if it has one.' },
  { name: 'Boost', activation: 'Quick', text: "Move again. Use it to cover more ground or reach a Speed gateway your Speed can't." },
  { name: 'Reload', activation: 'Quick', text: 'Reload one Loading weapon, or one mount holding Loading weapons.' },
  { name: 'Invade', activation: 'Invade', text: 'Make a tech attack against E-defence. On a hit, deal 2 Heat plus a hacking effect, such as Impaired or Slowed.' },
  { name: 'Lock on', activation: 'Quick', text: 'Mark a target you can see as Locked on. No roll needed.' },
  { name: 'Bolster', activation: 'Quick', text: 'Give an ally +2 (1 Accuracy) on their next check or save.' },
  { name: 'Hide', activation: 'Quick', text: "Become Hidden if you're out of direct sight, Obscured or Invisible, and not Engaged." },
  { name: 'Search', activation: 'Quick', text: 'Find a Hidden target. Compare your 10 + Systems with their 10 + Agility. On a tie, the hider may take 1 Heat to stay Hidden.' },
  { name: 'Ram', activation: 'Quick', text: 'Melee attack on an adjacent target. On a full hit or crit, knock them Prone and Knockback 1.' },
  { name: 'Grapple', activation: 'Quick', text: "Melee attack on an adjacent target. On a hit, a bigger mech holds a smaller one in place, and the smaller mech can't move on its own. Between mechs of the same size, the higher Hull is in control. Breaking free costs the grappled mech 1 quick action and 1 Heat." },
  { name: 'Quick tech', activation: 'Quick Tech', text: "Invade, Scan, Lock on, Bolster, or a system's own Quick Tech option." },
  { name: 'Scan', activation: 'Quick Tech', text: 'No roll. Learn one thing about a target in Sensors range:<ul><li>Its HP, Structure and Heat.</li><li>Its defences.</li><li>Its weapons and systems.</li><li>Its statuses.</li></ul>' },
  { name: 'Fragment signal', activation: 'Invade', text: 'The basic Invade option. On a full hack, the target is Impaired and Slowed until the end of its next turn. Other Invade options come from systems and talents.' },
  { name: 'Activate', activation: 'Quick', text: 'Use a system with the Quick tag.' },
  { name: 'Skill check', activation: 'Quick', text: 'Make a check for Hull, Agility, Systems or Engineering when the GM calls for one.' },
  { name: 'Shut down', activation: 'Quick', text: 'Clear all Heat and Exposed, and end any condition a tech attack caused. You gain Shutdown until you Boot up.' },
  { name: 'Eject', activation: 'Quick', frequency: 'Once a scene', text: "The pilot is thrown clear to Close range. The empty mech is Impaired and can't act." },
  { name: 'Self-destruct', activation: 'Quick', text: 'At the end of your next turn your mech explodes: Burst 2, 14 explosive damage. Anyone caught can make an Agility save (DC 14) for half. The mech is destroyed, and a pilot still inside dies.' },
]

export const FULL_ACTIONS: CombatAction[] = [
  { name: 'Barrage', activation: 'Full', text: 'Attack with 2 weapons, or 1 Superheavy weapon.' },
  { name: 'Disengage', activation: 'Full', text: 'Move safely, without triggering Overwatch or Engagement penalties.' },
  { name: 'Stabilize', activation: 'Full', text: 'Cool down, reload and patch up. Choose one from each line:<ol><li>Clear all Heat to 0, or spend 1 Repair to heal to full HP.</li><li>Reload all Loading weapons, clear all Burn, or clear one condition (such as Impaired or Jammed) on yourself or an Engaged ally.</li></ol>' },
  { name: 'Boot up', activation: 'Full', text: "Turn your mech back on after Shutdown. It's the one full action you can still take while in Shutdown." },
  { name: 'Full tech', activation: 'Full Tech', text: "Two Quick Tech actions, which may both be Invade at the same or different targets, or a system's own Full Tech option." },
  { name: 'Activate', activation: 'Full', text: "Use a system with the Full tag. Overcharge's extra quick action can't pay for it." },
  { name: 'Mount or dismount', activation: 'Full', text: "Get into or out of a mech you're Engaged with. An empty mech can't act." },
  { name: 'Core Power', frequency: 'Once a mission', text: 'Use the activation and duration the power gives. It returns at Full Repair. Passive core effects are always on.' },
]

export const OVERCHARGE: CombatAction = {
  name: 'Overcharge',
  activation: 'Overcharge',
  frequency: 'Once a turn',
  text: 'Gain 1 extra quick action straight away. Each use costs more Heat, until your next Full Repair.',
}
// Balance numbers the mech page shares (mechResources). Change them here, and log the change in docs/rule-decisions.md.
export const OVERCHARGE_HEAT = [1, 2, 4, 6]
export const REPAIR_COST = 2 // Repairs to restore 1 Structure or 1 Stress at a Rest. Frames like the Everest lower it.
export const OVERCHARGE_LATER = `After the 4th use, the cost stays at ${OVERCHARGE_HEAT.at(-1)} Heat until your next Full Repair.`

export const REACTIONS: CombatAction[] = [
  { name: 'Brace', activation: 'Reaction', text: "The first damaging attack on you before your next turn deals half damage and half Heat. On your next turn you can't take reactions or move, and you can take only 1 quick action (no full actions or Overcharge)." },
  { name: 'Overwatch', activation: 'Reaction', text: 'Name a Melee or CQB weapon (not Heavy) and a target. If that target moves away from you before your next turn, you get a free attack on them on your next turn.' },
  { name: 'Reaction systems', activation: 'Reaction', text: 'Systems and talents with the Reaction tag that change a roll are declared at the end of your turn too. They add +2 (1 Accuracy) or −2 (1 Difficulty) to the roll when it happens.' },
]

export const ATTACK_FORMULAS: CombatFormula[] = [
  { formula: 'Attack = 10 + Grit (or NPC bonus) + accuracy − difficulty', example: 'Grit 2, target Locked on: 10 + 2 + 2 = 14' },
  { formula: 'Tech attack = 10 + Tech attack + accuracy − difficulty', example: "Tech attack 1, you're Impaired: 10 + 1 − 2 = 9" },
  { formula: '1 Accuracy = +2 · 1 Difficulty = −2', note: 'At most 2 of either on one roll (±4), from weapon tags, statuses and reactions combined.', example: 'Accurate weapon against a Prone target: 2 Accuracy, +4' },
]

export const ATTACK_RESULTS: { margin: string; note?: string; physical: [string, string]; tech: [string, string] }[] = [
  { margin: '3 or more over', note: "Or Lancer's Precision on a full hit or grazing hit", physical: ['Critical hit', 'Damage × 1.25, rounded up, plus on-hit and crit effects.'], tech: ['Critical hack', 'Full Heat, full effects and crit effects.'] },
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
  text: 'A melee attack (Range 1) with a fist, a rifle butt or a lump of wreckage. It deals 4 kinetic damage and is resolved like any other attack.',
}
export const DAMAGE_TYPES: { name: string; icon: string }[] = [
  { name: 'Kinetic', icon: 'kinetic' },
  { name: 'Explosive', icon: 'explosive' },
  { name: 'Energy', icon: 'energy' },
  { name: 'Burn', icon: 'burn' },
]
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
  { value: 'Rest', text: `A short break between scenes. Clear all Heat and statuses. Spend Repairs: 1 restores all HP, 1 fixes one destroyed weapon or system, and ${REPAIR_COST} restore 1 Structure or 1 Stress. Some frames cost less, as shown on your mech page.` },
  { value: 'Full Repair', text: 'Downtime between missions, when the GM calls it. Everything returns: HP, Structure, Stress, Repairs, Limited uses, destroyed parts and your Core Power. Overcharge goes back to 1 Heat.' },
]

const STATUS_ROWS: CombatRow[] = [
  { value: 'Barrier-protected', text: "From a Shield. Ranged attacks against you get −2 (1 Difficulty). Melee isn't affected. It doesn't stack with Screened." },
  { value: 'Burn X', text: 'Take X burn damage at the end of your turn, ignoring armour. Then Burn goes down by 1 + half your Engineering (rounded down) until it reaches 0. Stabilize clears it at once.' },
  { value: 'Danger zone', text: "Your Heat is at least half your Heat cap. Danger zone tags work while you're in it." },
  { value: 'Down and out (pilot status)', text: "A pilot at 0 HP. You're Stunned and die if you take any more damage. An ally Engaged with you can use the second choice of Stabilize to bring you back to 1 HP." },
  { value: 'Engaged', text: "You're Engaged with anyone at Range 1. It ends when either of you moves away, is knocked back or Disengages. You can be Engaged with several enemies at once." },
  { value: 'Exposed', text: 'Kinetic, explosive and energy damage you take is doubled, until you clear it with Stabilize.' },
  { value: 'Hidden', text: "Enemies know your rough area, but can't target you with attacks. It ends when you attack, lose your cover or obscurement, or someone finds you with Search." },
  { value: 'Immobilized', text: "You can't move or Boost by choice, and you fail Agility checks and saves. Knockback can still move you." },
  { value: 'Impaired', text: '−2 (1 Difficulty) on all attacks, tech attacks, checks and saves.' },
  { value: 'Intangible', text: "You can't affect or be affected by physical attacks, tech attacks, objects or characters until it ends. You can still move as normal." },
  { value: 'Invisible', text: "Attacks against you get −2 (1 Difficulty). You can Hide in the open without cover or Obscured terrain (unless Engaged). Your movement doesn't trigger Overwatch. You get +1 Speed toward Speed gateways." },
  { value: 'Jammed', text: "You can't make normal ranged or tech attacks, use systems, take reactions or talk over comms. You can only Move, Boost, Improvised attack, Grapple or Ram." },
  { value: 'Lock on', text: 'The next attacker can use it up to get +2 (1 Accuracy) on their attack against you.' },
  { value: 'Obscured', text: "From smoke, darkness or a system's cloud. Attacks against you from beyond Close get −2 (1 Difficulty), and you can Hide. Seeking weapons can't hit you. Smart weapons ignore it." },
  { value: 'Prone', text: 'Attacks against you get +2 (1 Accuracy). You count as Slowed, and standing up uses your Movement.' },
  { value: 'Screened', text: "From a system or a deployable. Plain terrain gives nothing in player vs player combat. Ranged attacks against you get −2 (1 Difficulty). Melee isn't affected. It doesn't stack with Barrier-protected." },
  { value: 'Shredded', text: "Armour and resistance don't protect you. All damage hits at full value." },
  { value: 'Shutdown', text: "You're Stunned, lose all active system effects, and are immune to tech attacks, until you spend a full action to Boot up." },
  { value: 'Slowed', text: "You can't use Speed gateways (only Standard repositioning) and can't Boost." },
  { value: 'Stunned', text: 'Until the end of your next turn you can take only 1 quick action (no full actions, Movement, Overcharge or reactions). Attacks against you get +2 (1 Accuracy).' },
]

// Grouped by what they do. "Conditions" is the word Stabilize and Shut down use.
const statuses = (...names: string[]) => names.map((name) => STATUS_ROWS.find((row) => row.value.startsWith(name))!)
export const STATUS_GROUPS: { title: string; icon: string; rows: CombatRow[] }[] = [
  { title: 'Cover and stealth', icon: 'shield', rows: statuses('Barrier-protected', 'Screened', 'Obscured', 'Hidden', 'Invisible', 'Intangible') },
  { title: 'Conditions', icon: 'warning', rows: statuses('Immobilized', 'Impaired', 'Jammed', 'Lock on', 'Shredded', 'Slowed', 'Stunned') },
  { title: 'Other statuses', icon: 'info', rows: statuses('Burn X', 'Danger zone', 'Down and out', 'Engaged', 'Exposed', 'Prone', 'Shutdown') },
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
  { value: '1', name: 'Engaged (melee)', text: 'You must close into melee Engagement with the target. While Engaged, Range 6+ attacks get −2 (1 Difficulty).' },
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
  { value: '+1 to +2 Threat', text: 'Melee only. Make melee attacks and declare Overwatch against targets at Close range (2+) without entering Engagement.' },
]
export const SENSORS: CombatRow[] = [
  { value: '7 or less', short: '≤7', name: 'Short range', text: 'Engaged or Close range only.' },
  { value: '8–14', name: 'Tactical', text: 'Anywhere in the central firefight (Medium range).' },
  { value: '15 or more', short: '15+', name: 'Battlefield-wide', text: 'Anywhere in the scene. Ignores Obscured for Lock on and Search.' },
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
  { value: 'Pilot stats', text: 'HP 6, E-defence 10, armour 0 and Speed 4, plus gear and talents as on the pilot sheet. Pilots have no Evasion.' },
  { value: 'Pilot attacks', text: "10 + Grit against the target's Evasion. Use the flat damage on the pilot weapon." },
  { value: 'Mech destroyed', text: 'When your mech blows up, the pilot survives. They are thrown clear to Close range, Prone and Stunned until the end of their next turn.' },
  { value: 'Melt down', text: 'The reactor explodes at the end of your next turn, like Self-destruct. The pilot must Eject before then or dies.' },
]
export const JOCKEY: CombatAction = {
  name: 'Jockey',
  activation: 'Full',
  text: "Climb onto a mech you're Engaged with. Compare 10 + Grit with the mech's 10 + Hull. On a success, choose one each turn you stay on:<ul><li><b>Distract:</b> Impaired and Slowed until the end of its next turn.</li><li><b>Shred:</b> 2 Heat.</li><li><b>Damage:</b> 4 kinetic, ignoring armour.</li></ul>The mech can shake you off with a successful Hull check on its turn.",
}
export const DRONES_NOTE = 'Unless the system says otherwise: Size ½, HP 5, Evasion 10, E-defence 10 and armour 0.'
export const SIZE_NOTE = 'Every frame has a Size on its sheet (½, 1, 2 or 3). Grapple compares Sizes.'

export const WEAPON_SIZES: CombatRow[] = [
  { value: 'Auxiliary', text: 'Light weapons. A mount holding two Auxiliary weapons (Flex or Aux/Aux) fires both with one Skirmish or Barrage. The second one deals its base damage only, without bonus damage.' },
  { value: 'Main', text: 'Standard mech weapons. One fires per Skirmish.' },
  { value: 'Heavy', text: "High-impact weapons. They can't be fired with Overwatch unless a talent says so." },
  { value: 'Superheavy', text: "Takes up two mounts and needs a full action (Barrage) to fire. It can't be used with Skirmish or Overwatch." },
]
export const TAGS: CombatRow[] = [
  { value: 'Accurate / Inaccurate', tags: ['tg_accurate', 'tg_inaccurate'], text: '+2 (1 Accuracy) or −2 (1 Difficulty) on attacks with this weapon.' },
  { value: 'AI', tags: ['tg_ai'], text: 'Holds an NHP or COMP/CON unit. The mech can act on its own while the pilot is outside.' },
  { value: 'Armour piercing (AP)', tags: ['tg_ap'], text: "Ignores the target's armour." },
  { value: 'Arcing', tags: ['tg_arcing'], text: 'Lobs shots over obstacles. Ignores cover, Screened and Barrier-protected.' },
  { value: 'Danger zone', tags: ['tg_danger_zone'], text: 'Only works (or gains its bonus) while your Heat is at least half your Heat cap, rounded up.' },
  { value: 'Heat X (self)', tags: ['tg_heat_self'], text: 'Firing it adds X Heat to your own mech straight away.' },
  { value: 'Knockback X', tags: ['tg_knockback'], text: 'Pushes the target back on a full hit or crit. See Knockback above.' },
  { value: 'Limited X', tags: ['tg_limited'], text: 'Usable X times a mission, plus bonus uses from your Engineering, until a Full Repair.' },
  { value: 'Loading', tags: ['tg_loading'], text: 'Fires once, then needs a Reload (quick action) or Stabilize (full action) before it fires again.' },
  { value: 'Mod', tags: ['tg_mod'], text: 'Fits on a weapon mount to add tags or damage.' },
  { value: 'Ordnance', tags: ['tg_ordnance'], text: 'Can only be fired before you move on your turn, and not while Engaged (Range 1).' },
  { value: 'Overkill', tags: ['tg_overkill'], text: 'Before an attack you can take 1 Heat to add +2 damage, once per attack.' },
  { value: 'Overshield X', tags: ['tg_overshield'], text: "X temporary HP that takes damage before your real HP. It doesn't stack. Keep the highest." },
  { value: 'Protocol', tags: ['tg_protocol'], text: 'Only at the start of your turn, before you move or act.' },
  { value: 'Reaction', tags: ['tg_reaction'], text: 'Declared at the end of your turn. It counts toward your 1 reaction a round.' },
  { value: 'Reliable X', tags: ['tg_reliable'], text: 'Deals X damage even on a miss, or on a grazing hit when X is more than half damage.' },
  { value: 'Seeking', tags: ['tg_seeking'], text: "Guided. Ignores cover, Screened and Barrier-protected, but can't hit Obscured targets." },
  { value: 'Shield', tags: ['tg_shield'], text: 'Gives Barrier-protected (−2, 1 Difficulty, on incoming ranged attacks) or puts up cover facing one way.' },
  { value: 'Smart', tags: ['tg_smart'], text: 'Targets E-defence instead of Evasion, and ignores all cover and statuses like Obscured.' },
  { value: 'Thrown', tags: ['tg_thrown'], text: "Leaves your hand on attack. You can't use it again until you pick it up with a quick action." },
  { value: 'Unique', tags: ['tg_unique'], text: 'Only one copy on your mech.' },
]

export const DICE: CombatRow[] = [
  { value: '1d3', text: '2 damage' },
  { value: '1d6', text: '4 damage' },
  { value: '2d6', text: '7 damage' },
  { value: '3d6', text: '11 damage' },
]
export const RECHARGE: CombatRow[] = [
  { value: 'Recharge 4+, 50% or 4+', text: 'A 1-turn cooldown (usable every other turn), or triggers on a full hit.' },
  { value: 'Recharge 5+ or 5+', text: 'A 2-turn cooldown, or triggers on a critical hit.' },
  { value: 'Recharge 6 or 6', text: 'A 3-turn cooldown, or once a scene.' },
]

// Gists (see CombatRow.gist), set by name or value so the arrays above keep the handbook's wording.
const gists = (rows: { name?: string; value?: string; gist?: string }[], map: Record<string, string>) =>
  rows.forEach((row) => { row.gist = map[(row.name ?? row.value)!] ?? row.gist })
gists(TURN_STEPS, { Protocol: 'Turn on a protocol at the very start of your turn.', Movement: "Move using your mech's Speed.", '1 full action or 2 quick actions': 'Take 1 full action or 2 quick actions.', Overcharge: 'Gain 1 extra quick action for Heat.', Reaction: 'Declare 1 reaction in advance.' })
gists(SCENE_RESOURCES, { "Lancer's Edge": 'Add +2 to any attack, check or save.', "Lancer's Precision": 'Turn a hit into a critical hit.' })
gists(QUICK_ACTIONS, {
  Skirmish: 'Attack with 1 weapon.', Reload: 'Reload one Loading weapon or mount.', 'Lock on': 'Mark a target as Locked on.', Bolster: 'Give an ally +2 on their next check or save.',
  Hide: "Become Hidden if you're out of sight and not Engaged.", Search: 'Find a Hidden target.', Ram: 'Knock an adjacent target Prone.', Grapple: 'Hold an adjacent target in place.',
  'Skill check': 'Make a check when the GM calls for one.', 'Shut down': 'Clear all Heat and Exposed, then gain Shutdown.', Eject: 'Throw the pilot clear to Close range.',
  'Self-destruct': 'Your mech explodes at the end of your next turn.', 'Quick tech': "Choose Invade, Scan, Lock on, Bolster or a system's option.", Invade: 'Tech attack for 2 Heat plus a hacking effect.',
  'Fragment signal': 'The basic Invade option.', Scan: 'Learn one thing about a target. No roll.',
})
gists(FULL_ACTIONS, { Barrage: 'Attack with 2 weapons, or 1 Superheavy.', Disengage: 'Move without triggering Overwatch or Engagement.', 'Mount or dismount': 'Get into or out of a mech.', 'Full tech': "Take two Quick Tech actions, or a system's option.", 'Core Power': "Use your frame's core power." })
gists([IMPROVISED, JOCKEY, OVERCHARGE], { 'Improvised attack': 'A melee attack that deals 4 kinetic damage.', Jockey: "Climb onto a mech you're Engaged with.", Overcharge: 'Gain 1 extra quick action for Heat.' })
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
gists(TAGS, { Loading: 'Fires once, then needs a Reload or Stabilize.', 'Reliable X': 'Deals X damage even on a miss.', Seeking: "Ignores cover, but can't hit Obscured targets." })
gists(WEAPON_SIZES, { Auxiliary: 'Light weapons. Two on a mount fire together.' })
