<script setup lang="ts">
import { computed, ref } from 'vue'
import { stepActions, type KitAction } from '../combatEntries'
import { REACTIONS_NOTE, TURN_STEPS } from '../combatRules'
import CombatGroup from './CombatGroup.vue'
import Icon from './Icon.vue'

// The turn as a row of steps. One is open at a time (the first full action step to begin with) and its actions sit under
// the strip as chip cards. The steps and their order come from TURN_STEPS; a pilot on foot has no protocol or overcharge.
const props = defineProps<{ kitActions: KitAction[]; pilot: boolean; overcharge: string | null; speed: number | null }>()

const FULL = '1 full action or 2 quick actions'
const open = ref(FULL)

type Tile = { c?: string; icon: string }
const INFO: Record<string, { label: string; rule: string; empty?: string; tiles: Tile[] }> = {
  Protocol: { label: 'Protocol', rule: 'Turn on a protocol at the very start of your turn.', empty: 'No protocols.', tiles: [{ c: 'protocol', icon: 'protocol' }] },
  Movement: { label: 'Movement', rule: 'Move using your Speed.', tiles: [{ icon: 'speed' }] },
  [FULL]: { label: 'Full or 2 quick', rule: 'Take 1 full action or 2 quick actions.', tiles: [{ c: 'full', icon: 'activation_full' }, { c: 'quick', icon: 'activation_quick' }] },
  Overcharge: { label: 'Overcharge', rule: 'Gain 1 extra quick action for Heat.', tiles: [{ c: 'overcharge', icon: 'overcharge' }] },
  Free: { label: 'Free', rule: 'Take free actions at any point in your turn.', empty: 'No free actions.', tiles: [{ c: 'free', icon: 'free_action' }] },
  Reaction: { label: 'Reaction', rule: 'Declare 1 reaction in advance.', empty: 'No reactions.', tiles: [{ c: 'reaction', icon: 'reaction' }] },
}
// A card's icon and colour. No colour is neutral, so each chip keeps its own badge.
const LOOK: Record<string, { icon: string; colour?: string; groupActivation?: string }> = {
  Attacks: { icon: 'crosshair' },
  Movement: { icon: 'speed' },
  Tech: { icon: 'tech_quick' },
  Systems: { icon: 'system' },
  'Your mech': { icon: 'structure' },
  'Your kit': { icon: 'generic_item' },
  Protocols: { icon: 'protocol', colour: '--act-protocol', groupActivation: 'protocol' },
  Overcharge: { icon: 'overcharge', colour: '--act-overcharge', groupActivation: 'overcharge' },
  'Free actions': { icon: 'free_action', colour: '--act-free', groupActivation: 'free' },
  Reactions: { icon: 'reaction', colour: '--act-reaction', groupActivation: 'reaction' },
}

const steps = computed(() => TURN_STEPS.filter((s) => !props.pilot || (s.name !== 'Protocol' && s.name !== 'Overcharge')).map((s) => ({ key: s.name, ...INFO[s.name] })))
const step = computed(() => steps.value.find((s) => s.key === open.value) ?? steps.value[0])
const rule = computed(() => (step.value.key === 'Movement' && props.speed !== null ? `Move using your Speed: ${props.speed}.` : step.value.rule))
const groups = computed(() => {
  const list = stepActions(step.value.key, props.kitActions, props.pilot, props.overcharge)
  // The kit card always shows, so the six cards stay a 3 x 2.
  if (step.value.key === FULL && !list.some((g) => g.title === 'Your kit')) list.push({ title: 'Your kit', entries: [] })
  return list.map((g) => ({ ...g, ...LOOK[g.title], chips: true, note: g.title === 'Reactions' ? REACTIONS_NOTE : undefined }))
})
// Four cards make 2 x 2, not 3 + 1.
const cols = computed(() => ({ 1: 1, 2: 2, 3: 3, 4: 2 })[groups.value.length] ?? 3)
</script>

<template>
  <section class="turn-strip" aria-labelledby="turn-title">
    <h2 id="turn-title" class="label">Your turn</h2>
    <ol class="strip" :class="{ pilot }" :style="{ '--n': steps.length }" aria-labelledby="turn-title">
      <li v-for="(s, n) in steps" :key="s.key">
        <Icon v-if="n" name="chevron-right" class="strip-arrow" />
        <button type="button" class="step" :aria-pressed="open === s.key" aria-controls="step-panel" @click="open = s.key">
          <span class="step-top">
            <span class="step-no num" aria-hidden="true">{{ n + 1 }}</span>
            <span class="step-tiles" aria-hidden="true">
              <span v-for="t in s.tiles" :key="t.icon" class="tile" :class="{ neutral: !t.c }" :style="t.c ? { '--c': `var(--act-${t.c})` } : undefined"><Icon :name="t.icon" /></span>
            </span>
          </span>
          <span class="step-name">{{ s.label }}</span>
        </button>
      </li>
    </ol>

    <div id="step-panel" class="step-panel" role="region" aria-labelledby="step-title">
      <p class="step-rule"><b id="step-title">{{ step.label }}</b> {{ rule }}</p>
      <div v-if="groups.length" class="step-groups" :class="{ single: cols === 1 }" :style="{ '--cols': cols }">
        <CombatGroup v-for="g in groups" :key="g.title" v-bind="g">
          <p v-if="g.title === 'Your kit' && !g.entries.length" class="group-empty">No kit actions.</p>
        </CombatGroup>
      </div>
      <p v-else class="empty">{{ step.empty }}</p>
    </div>
  </section>
</template>

<style scoped>
.turn-strip h2 {
  margin: 0;
}

.strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-auto-rows: 1fr; /* rows stay level when a label wraps */
  gap: var(--space-s);
  margin: var(--space-xs) 0 0;
  padding: 0;
  list-style: none;
}

.strip.pilot {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.strip li {
  display: grid;
}

.strip-arrow {
  display: none;
}

.step {
  display: grid;
  align-content: start;
  justify-items: start;
  gap: var(--space-xs);
  height: 100%;
  min-height: 64px;
  padding: var(--space-s) var(--space-m);
  background: var(--panel);
  text-align: left;
}

.step[aria-pressed='true'] {
  border-color: var(--lilac);
  background: var(--raised);
  box-shadow: inset 0 -3px 0 var(--lilac);
}

.step-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.step-no {
  color: var(--text-dim);
  font: 700 var(--fs-s) var(--mono);
}

.step-tiles {
  display: flex;
  gap: 2px;
}

.tile {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  background: var(--c);
  color: #fff;
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%);
}

.tile.neutral {
  background: var(--raised);
  color: var(--text-dim);
  box-shadow: inset 0 0 0 1px var(--rule);
}

.tile .icon {
  width: 16px;
  height: 16px;
}

.step-name {
  line-height: 1.2;
}

@media (min-width: 64rem) {
  .strip,
  .strip.pilot {
    grid-template-columns: repeat(var(--n), minmax(0, 1fr));
    gap: var(--space-xl);
  }

  .strip li {
    position: relative;
  }

  .strip-arrow {
    display: block;
    position: absolute;
    top: 50%;
    left: calc(-1 * var(--space-xl) / 2 - 8px);
    translate: 0 -50%;
    width: 16px;
    height: 16px;
    color: var(--text-dim);
  }
}

.step-panel {
  display: grid;
  gap: var(--space-m);
  margin-top: var(--space-m);
}

.step-rule {
  margin: 0;
  max-width: none;
  color: var(--text-dim);
  font-size: var(--fs-m);
}

.step-rule b {
  color: var(--text);
}

.step-groups {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-m);
}

@media (min-width: 40rem) {
  .step-groups {
    grid-template-columns: repeat(min(var(--cols), 2), minmax(0, 1fr));
  }
}

@media (min-width: 64rem) {
  .step-groups {
    grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
  }
}

/* One card reads as a card, not a 1300px bar. */
.step-groups.single {
  max-width: 40rem;
}

.group-empty {
  margin: 0;
  padding: var(--space-s) var(--space-m) var(--space-m);
  color: var(--text-dim);
  font-size: var(--fs-s);
}
</style>
