<script setup lang="ts">
import { computed, ref } from 'vue'
import { stepActions, type KitAction } from '../combatEntries'
import { OVERCHARGE_HEAT } from '../combatRules'
import CombatGroup from './CombatGroup.vue'
import Icon from './Icon.vue'
import RulesText from './RulesText.vue'

// The turn as one connected bar of steps (chevrons mean "then", the straight join with "or" means "choose one"). One step is
// open at a time (2 quick to begin with) and its cards sit under the bar. "1 full" and "2 quick" show four equal cards, every
// other step two: how it works, and its actions (or, for Overcharge, the Heat numbers). A card's header carries the action's
// colour and word, so its chips are name only. A pilot on foot has no protocol or overcharge.
const props = defineProps<{ kitActions: KitAction[]; pilot: boolean; overcharge: string | null; speed: number | null; sidearm?: boolean }>()

const open = ref('2 quick')

// c is the step's --act-* colour key; Movement has no activation, so no colour.
const STEPS = [
  { key: 'Protocol', icon: 'protocol', c: 'protocol' },
  { key: 'Movement', icon: 'speed' },
  { key: '1 full', icon: 'activation_full', c: 'full' },
  { key: '2 quick', icon: 'activation_quick', c: 'quick' },
  { key: 'Overcharge', icon: 'overcharge', c: 'overcharge' },
  { key: 'Free', icon: 'free_action', c: 'free' },
  { key: 'Reaction', icon: 'reaction', c: 'reaction' },
]
const steps = computed(() => STEPS.filter((s) => !props.pilot || (s.key !== 'Protocol' && s.key !== 'Overcharge')))
const step = computed(() => steps.value.find((s) => s.key === open.value) ?? steps.value[0])
// The bar's segments: the two action steps share one.
const bar = computed(() => {
  const list = steps.value.filter((s) => s.key !== '1 full' && s.key !== '2 quick').map((s) => [s])
  list.splice(list.findIndex((s) => s[0].key === 'Overcharge' || s[0].key === 'Free'), 0, steps.value.filter((s) => s.key === '1 full' || s.key === '2 quick'))
  return list
})
const segClass = (item: typeof STEPS) => (item.length > 1 ? 'seg-choice' : `seg-${item[0].key.toLowerCase()}`)

const RULE: Record<string, string> = {
  '2 quick': 'Take 2 different quick actions, or 1 full action instead.',
  '1 full': 'Take 1 full action, or 2 quick actions instead.',
}

// The two-card steps. The right card's look; the left card is always neutral.
const RIGHT: Record<string, { title: string; icon: string; colour?: string; meta?: string }> = {
  Protocol: { title: 'Your protocols', icon: 'protocol', colour: '--act-protocol', meta: 'Protocol' },
  Movement: { title: 'Move further', icon: 'speed' },
  Overcharge: { title: 'Heat cost', icon: 'overcharge', colour: '--act-overcharge', meta: 'Overcharge' },
  Free: { title: 'Free actions', icon: 'free_action', colour: '--act-free', meta: 'Free' },
  Reaction: { title: 'Reactions', icon: 'reaction', colour: '--act-reaction', meta: 'Reaction' },
}
const LEFT_META: Record<string, string> = { Protocol: 'Optional', Overcharge: 'Once a turn', Reaction: 'End of your turn' }

const four = computed(() => step.value.key === '1 full' || step.value.key === '2 quick')
const groups = computed(() => stepActions(step.value.key, props.kitActions, props.pilot, props.overcharge, props.sidearm))
const word = computed(() => (step.value.key === '1 full' ? 'Full' : 'Quick'))
const FOUR_ICON: Record<string, string> = { Attacks: 'crosshair', Other: 'list', 'Your kit': 'generic_item' }
const cards = computed(() =>
  groups.value.map((g) => ({
    title: g.title,
    icon: g.title === 'Tech' ? (step.value.key === '1 full' ? 'tech_full' : 'tech_quick') : FOUR_ICON[g.title],
    colour: `--act-${g.colour}`,
    meta: g.title === 'Tech' ? `${word.value} tech` : word.value,
    note: g.text,
    empty: g.empty,
    entries: g.entries,
    chips: true,
  })),
)
const left = computed(() => groups.value[0])
const right = computed(() => ({ ...RIGHT[step.value.key], entries: groups.value[1]?.entries ?? [], empty: groups.value[1]?.empty, chips: true }))
const heat = computed(() => groups.value[1]?.heat)
</script>

<template>
  <section class="turn-strip" aria-labelledby="turn-title">
    <h2 id="turn-title" class="label">Your turn</h2>
    <ol class="bar" :class="{ pilot }" aria-labelledby="turn-title">
      <li v-for="item in bar" :key="item[0].key" :class="segClass(item)">
        <div :class="item.length > 1 ? 'choice' : 'single'" :role="item.length > 1 ? 'group' : undefined" :aria-label="item.length > 1 ? '1 full or 2 quick' : undefined">
          <template v-for="(s, n) in item" :key="s.key">
            <span v-if="n" class="or" aria-hidden="true">or</span>
            <button type="button" class="seg" :class="s.key === '1 full' ? 'full' : s.key === '2 quick' ? 'quick' : undefined" :aria-pressed="step.key === s.key" aria-controls="step-panel" :style="s.c ? { '--c': `var(--act-${s.c})` } : undefined" @click="open = s.key">
              <span class="tile" :class="{ neutral: !s.c }" aria-hidden="true"><Icon :name="s.icon" /></span>
              <span class="seg-name">{{ s.key }}</span>
            </button>
          </template>
        </div>
      </li>
    </ol>

    <div id="step-panel" class="step-panel" role="region" :aria-label="step.key">
      <template v-if="four">
        <p class="step-rule">{{ RULE[step.key] }}</p>
        <div class="step-cards">
          <CombatGroup v-for="g in cards" :key="g.title" v-bind="g" />
        </div>
      </template>
      <div v-else-if="left" class="step-pair">
        <CombatGroup title="How it works" icon="book-open" :meta="LEFT_META[step.key]" :entries="left.entries" chips>
          <div class="how">
            <p v-if="step.key === 'Movement' && speed !== null" class="speed-line"><Icon name="speed" /><span class="num">{{ speed }}</span><span class="label">Speed</span></p>
            <RulesText v-if="left.text" :html="left.text" />
            <p v-if="left.entries.length" class="label">Speed gateways</p>
          </div>
        </CombatGroup>
        <CombatGroup v-bind="right">
          <template v-if="heat" #default>
          <ol v-if="heat" class="heat-track">
            <li v-for="(n, i) in heat.steps" :key="i">
              <Icon v-if="i" name="chevron-right" class="heat-arrow" aria-hidden="true" />
              <span class="label">{{ ['Use 1', 'Use 2', 'Use 3', 'Use 4+'][i] }}</span>
              <span class="heat-n"><Icon name="heat" /><span class="num">{{ n }}</span><span class="sr-only"> Heat</span></span>
              <span v-if="Number(n) !== OVERCHARGE_HEAT[i]" class="heat-base">Base: {{ OVERCHARGE_HEAT[i] }}</span>
            </li>
          </ol>
          </template>
        </CombatGroup>
      </div>
    </div>
  </section>
</template>

<style scoped>
.turn-strip h2 {
  margin: 0;
}

/* The bar. Each segment's shape is on ::before, so the focus ring isn't clipped. Segments overlap by their notch minus a
   3px gap of page background that follows each chevron. */
.bar {
  --notch: 8px;
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 3px 0;
  margin: var(--space-xs) 0 0;
  padding: 0;
  list-style: none;
}

.bar li {
  display: grid;
  margin-left: calc(3px - var(--notch));
}

.single,
.choice {
  display: grid;
}

.choice {
  position: relative;
  grid-template-columns: 1fr 1fr;
  column-gap: 3px;
}

.seg {
  --l: var(--notch); /* left notch depth, 0 = flat */
  --r: var(--notch); /* right point depth, 0px = flat (keep the unit: a bare 0 breaks the calc below) */
  --fill: var(--panel);
  position: relative;
  isolation: isolate;
  display: grid;
  justify-items: center;
  align-content: center;
  gap: 6px;
  width: 100%;
  height: 100%;
  min-height: 56px;
  padding: var(--space-s) calc(var(--notch) + 4px);
  border: 0;
  border-radius: 0;
  background: none;
  color: var(--text-dim);
}

.seg::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  background: var(--fill);
  clip-path: polygon(0 0, calc(100% - var(--r)) 0, 100% 50%, calc(100% - var(--r)) 100%, 0 100%, var(--l) 50%);
}

.seg:hover:not(:disabled) {
  --fill: color-mix(in srgb, var(--lilac) 8%, var(--panel));
  background: none;
  color: var(--text);
}

.seg[aria-pressed='true'] {
  --fill: var(--raised);
  color: var(--lilac);
}

.seg[aria-pressed='true']::before {
  background: linear-gradient(var(--lilac) 0 0) bottom / 100% 3px no-repeat, var(--raised);
}

.seg:focus-visible {
  z-index: 1;
}

.seg-name {
  font: 700 var(--fs-xs) / 1.2 var(--sans);
  letter-spacing: 0.06em;
  white-space: nowrap;
}

/* A straight join, "or" on it: choose one. */
.seg.full {
  --r: 0px;
}

.seg.quick {
  --l: 0px;
}

.or {
  position: absolute;
  top: 50%;
  left: 50%;
  z-index: 2;
  translate: -50% -50%;
  padding: 2px 6px;
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  background: var(--void);
  color: var(--text-dim);
  font: 700 var(--fs-xs) / 1 var(--sans);
  text-transform: uppercase;
  pointer-events: none;
}

/* The bar ends in the site's clipped corner. */
.seg-reaction .seg {
  --r: 0px;
}

.seg-reaction .seg::before {
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - 7px), calc(100% - 7px) 100%, 0 100%, var(--l) 50%);
}

/* Below 64rem: three balanced rows, with flat row ends. */
@media (max-width: 63.999rem) {
  .seg-protocol {
    grid-column: span 3;
  }

  .seg-movement {
    grid-column: span 3;
  }

  .seg-choice {
    grid-column: span 6;
  }

  .seg-overcharge,
  .seg-free,
  .seg-reaction {
    grid-column: span 2;
  }

  .seg-protocol,
  .seg-choice,
  .seg-overcharge,
  .pilot .seg-movement,
  .pilot .seg-free {
    margin-left: 0;
  }

  .seg-protocol .seg,
  .seg-overcharge .seg,
  .pilot .seg-movement .seg,
  .pilot .seg-free .seg {
    --l: 0px;
  }

  .seg-movement .seg {
    --r: 0px;
  }

  .seg-choice .seg {
    --l: 0px;
    --r: 0px;
  }

  .pilot .seg-movement {
    grid-column: span 6;
  }

  .pilot .seg-free,
  .pilot .seg-reaction {
    grid-column: span 3;
  }
}

/* From 64rem: one row, every segment the same width (the choice takes two). */
@media (min-width: 64rem) {
  .bar {
    --notch: 10px;
    grid-template-columns: 1fr 1fr 2fr 1fr 1fr 1fr;
  }

  .bar.pilot {
    grid-template-columns: 1fr 2fr 1fr 1fr;
  }

  .bar li:first-child {
    margin-left: 0;
  }

  .bar li:first-child .seg {
    --l: 0px;
  }

  .seg {
    min-height: 64px;
  }
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

/* The open step */
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

.step-cards,
.step-pair {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-m);
}

@media (min-width: 40rem) {
  .step-cards,
  .step-pair {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 64rem) {
  .step-cards {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

.how {
  display: grid;
  gap: var(--space-s);
  padding: var(--space-s) var(--space-m) var(--space-m);
}

.how:has(+ .chip-row) {
  padding-bottom: 0;
}

.how :deep(.rules-text) {
  display: grid;
  gap: var(--space-s);
}

.how :deep(p) {
  max-width: 68ch;
  margin: 0;
  font-size: var(--fs-m);
}

.how .label {
  margin: var(--space-s) 0 0;
}

.speed-line {
  display: flex;
  align-items: baseline;
  gap: var(--space-s);
  margin: 0;
}

.speed-line .icon {
  align-self: center;
  width: 20px;
  height: 20px;
  color: var(--text-dim);
}

.speed-line .num {
  font: 700 var(--fs-xl) var(--mono);
}

/* The Heat track sits on the card, no boxes. */
.heat-track {
  display: grid;
  flex: 1;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  align-items: center;
  margin: 0;
  padding: var(--space-m);
  list-style: none;
}

.heat-track li {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 4px;
}

.heat-arrow {
  position: absolute;
  top: 50%;
  left: -8px;
  translate: 0 -50%;
  width: 16px;
  height: 16px;
  color: var(--text-dim);
}

.heat-n {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font: 700 var(--fs-xl) var(--mono);
}

.heat-n .icon {
  width: 20px;
  height: 20px;
  color: var(--dmg-heat);
}

.heat-base {
  color: var(--text-dim);
  font-size: var(--fs-s);
}
</style>
