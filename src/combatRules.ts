// The combat guide's text (CombatView.vue). Core LANCER for now; the developer replaces it with the homebrew.
// "text" is rules text: plain words, or the small HTML RulesText.vue allows (<b>, <i>, lists, game icons).
// "activation" is an ActionChip word (Quick, Full, Reaction, Free, Overcharge, Protocol, Quick Tech, Full Tech,
// Invade); leave it out for no chip.
// Section ids are the #hash and the fold key (src/fileSections.ts, shared with the pilot and mech pages), so keep them
// unique and stable. The "combat-" prefix keeps them from clashing with those pages' ids.
export type CombatAction = { name: string; activation?: string; text: string }
export type CombatSection = { id: string; title: string; intro?: string; actions: CombatAction[] }

export const COMBAT_SECTIONS: CombatSection[] = [
  {
    id: 'combat-round',
    title: 'The round',
    intro:
      "Combat runs in rounds. Everyone gets one turn each round.<br>The players pick who goes first. After a player's turn the GM picks an NPC to act, then the players pick who goes next. Sides take turns like this until everyone has acted. If one side runs out, the rest of the other side go in any order.<br>When everyone has acted, a new round starts.",
    actions: [],
  },
  {
    id: 'combat-turn',
    title: 'Your turn',
    intro: 'On your turn you can move and take actions in any order.',
    actions: [
      { name: 'Move', text: 'Move up to your Speed. You can split it around your actions.' },
      { name: 'Two quick actions', activation: 'Quick', text: 'Take two quick actions.' },
      { name: 'Or one full action', activation: 'Full', text: 'Take one full action instead of two quick actions.' },
      { name: 'Any free actions', activation: 'Free', text: "Free actions don't use up your actions. Take as many as you like." },
      { name: 'One reaction a turn', activation: 'Reaction', text: "Each reaction once per round. At most one reaction a turn, yours or anyone else's." },
      { name: 'Push your mech', activation: 'Overcharge', text: 'Once a turn, take one extra quick action and gain heat.' },
    ],
  },
  {
    id: 'combat-quick',
    title: 'Quick actions',
    actions: [
      { name: 'Boost', activation: 'Quick', text: 'Move up to your Speed again.' },
      { name: 'Skirmish', activation: 'Quick', text: 'Attack with one weapon. Not a Superheavy one.' },
      { name: 'Grapple', activation: 'Quick', text: 'Grab an adjacent character to hold them in place or drag them with you.' },
      { name: 'Ram', activation: 'Quick', text: 'Knock an adjacent character your size or smaller Prone, or push them 1 space.' },
      { name: 'Hide', activation: 'Quick', text: 'Out of sight and in cover, you become Hidden.' },
      { name: 'Search', activation: 'Quick', text: 'Look for a Hidden character you might see.' },
      { name: 'Activate', activation: 'Quick', text: 'Use a system, talent or gear item marked Quick.' },
      { name: 'Prepare', activation: 'Quick', text: 'Name a trigger and a quick action. Take it as a reaction when the trigger happens.' },
      { name: 'Bolster', activation: 'Quick Tech', text: 'Give an ally you can see +2 accuracy on their next check or save.' },
      { name: 'Lock on', activation: 'Quick Tech', text: 'Mark a character you can see. The next attack on them gets +1 accuracy.' },
      { name: 'Scan', activation: 'Quick Tech', text: "Learn a character's stats, weapons and systems, or one hidden fact about them." },
      { name: 'Invade', activation: 'Invade', text: 'Make a tech attack. On a hit they take 2 heat and you pick an Invade option.' },
      { name: 'Shut down', activation: 'Quick', text: "Clear all heat and Exposed. You're Stunned until you Boot up." },
      { name: 'Eject', activation: 'Quick', text: 'Your pilot flies 6 spaces clear. The empty mech is Impaired.' },
      { name: 'Self-destruct', activation: 'Quick', text: 'Your reactor goes critical. It explodes at the end of your next turn, or a later turn of yours within two rounds.' },
    ],
  },
  {
    id: 'combat-full',
    title: 'Full actions',
    actions: [
      { name: 'Barrage', activation: 'Full', text: 'Attack with two weapons, or one Superheavy weapon.' },
      { name: 'Full tech', activation: 'Full Tech', text: 'Take two quick tech actions, or use one system marked Full Tech.' },
      { name: 'Improvised attack', activation: 'Full', text: 'Hit an adjacent character with whatever is at hand. Deals 4 kinetic.' },
      { name: 'Disengage', activation: 'Full', text: "Until your next turn, moving doesn't trigger reactions and you ignore engagement." },
      { name: 'Stabilize', activation: 'Full', text: 'Clear all heat and Exposed, or spend 1 Repair to restore all HP. Then end Burn or one condition.' },
      { name: 'Activate', activation: 'Full', text: 'Use a system, talent or gear item marked Full.' },
      { name: 'Boot up', activation: 'Full', text: 'Turn a shut-down mech back on.' },
      { name: 'Mount', activation: 'Full', text: 'Climb into an adjacent mech.' },
      { name: 'Dismount', activation: 'Full', text: 'Climb out of your mech into an adjacent space.' },
    ],
  },
  {
    id: 'combat-reactions',
    title: 'Reactions',
    intro: 'Reactions happen outside your turn, when their trigger happens.',
    actions: [
      { name: 'Brace', activation: 'Reaction', text: "When an attack hits you, take half damage. On your next turn you can only take one quick action. You can't move normally, take full or free actions, or Overcharge." },
      { name: 'Overwatch', activation: 'Reaction', text: 'When a hostile character starts moving inside your Threat, Skirmish them with one weapon.' },
      { name: 'Gear reactions', activation: 'Reaction', text: 'Systems, talents and gear marked Reaction follow the same limits.' },
    ],
  },
  {
    id: 'combat-free',
    title: 'Free actions',
    actions: [
      { name: 'Overcharge', activation: 'Overcharge', text: 'Once a turn, take one extra quick action. Gain 1 heat the first time, then 2, then 4, then 8 each time after, until your next full repair.' },
      { name: 'Protocols', activation: 'Protocol', text: 'Systems marked Protocol are free, but only at the start of your turn.' },
      { name: 'Gear free actions', activation: 'Free', text: 'Systems, talents and gear marked Free cost nothing. Take as many as you like.' },
    ],
  },
  {
    id: 'combat-foot',
    title: 'On foot',
    intro: "Out of your mech you get the same turn: a move, then two quick actions or one full action. You can't Skirmish, Barrage, Brace, Overcharge or take tech actions.",
    actions: [
      { name: 'Move', text: 'Move up to your Speed.' },
      { name: 'Fight', activation: 'Full', text: 'Attack with one pilot weapon.' },
      { name: 'Reload', activation: 'Quick', text: 'Reload one pilot weapon with the Loading tag.' },
      { name: 'Jockey', activation: 'Full', text: 'Climb onto an adjacent mech and harass its pilot.' },
      { name: 'Mount', activation: 'Full', text: 'Climb into an adjacent mech.' },
      { name: 'Also on foot', text: 'Boost, Hide, Search, Grapple, Activate and Prepare work as they do in a mech.' },
    ],
  },
]
