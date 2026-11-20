<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { sourceOf } from '../gameData'
import type { Info, InfoCard } from '../info'
import MechImage from './MechImage.vue'
import Icon from './Icon.vue'
import InfoRule from './InfoRule.vue'
import ItemCard from './ItemCard.vue'
import ItemStats from './ItemStats.vue'
import RadarChart from './RadarChart.vue'
import RulesText from './RulesText.vue'
import UnlockList from './UnlockList.vue'

// The full information on one thing (src/info.ts), under its name: shared by the information dialog (InfoDialog.vue)
// and the archives' detail pane. Left-aligned: its facts, its numbers (a frame's as a radar chart against every frame,
// with a grid of every stat; anything else's as symbols and numbers), its lore, and groups of rules: actions with their
// chip, tags as chips with what each one means, and a frame's traits and core system as item cards.
const props = defineProps<{ info: Info }>()

// Stats that differ between frames go on the radar, placed between the lowest and highest any frame has. Size
// isn't better or worse, and stats every frame shares (structure, stress) say nothing there. Every stat's number
// sits beside the radar in a grid.
const onRadar = computed(() => props.info.stats.filter((stat) => stat.range && stat.range.max > stat.range.min && stat.label !== 'size'))
const radar = computed(() =>
  onRadar.value.length >= 3
    ? onRadar.value.map((stat) => ({ label: stat.label, value: stat.value, at: (stat.range!.at - stat.range!.min) / (stat.range!.max - stat.range!.min) }))
    : [],
)
const summary = computed(() => `Stats compared with every frame: ${radar.value.map((axis) => `${axis.label} ${axis.value}`).join(', ')}`)
// Phones: the radar's labels bigger (about 12px or more on screen) and one word to a line, so they fit beside it.
const phoneQuery = window.matchMedia('(max-width: 40rem)')
const phone = ref(phoneQuery.matches)
const onPhoneChange = (event: MediaQueryListEvent) => (phone.value = event.matches)
phoneQuery.addEventListener('change', onPhoneChange)
onUnmounted(() => phoneQuery.removeEventListener('change', onPhoneChange))
// A card's parts as InfoRule draws them (not its tone, nor a trait's actions, which are drawn separately).
const rule = ({ heading, activation, frequency, stats, html }: InfoCard) => ({ heading, activation, frequency, stats, html })
const sp = computed(() => props.info.stats.find((stat) => stat.kind === 'sp'))
const source = computed(() => sourceOf(props.info.id ?? ''))
</script>

<template>
  <div class="info-body">
    <!-- A frame's or licence's picture (null: it has none, so the placeholder): a showcase, so centred, whole and never cropped. -->
    <MechImage v-if="info.art !== undefined" size="info" :art="info.art" :art-alt="`${info.name} frame art`" />

    <p v-if="info.facts.length" class="facts sep">
      <span v-for="(fact, i) in info.facts" :key="i">{{ fact.text }}</span>
    </p>

    <div v-if="radar.length" class="compare">
      <RadarChart :axes="radar" :summary="summary" :label-size="phone ? 23 : undefined" :wrap="phone" />
      <ul class="stat-grid">
        <li v-for="(stat, i) in info.stats" :key="i">
          <Icon v-if="stat.icon" :src="stat.icon" />
          <span class="num">{{ stat.value }}</span>
          <span class="stat-label">{{ stat.label }}</span>
        </li>
      </ul>
    </div>
    <ItemStats v-else :stats="info.stats.filter((stat) => stat.kind !== 'sp')" />
    <p v-if="sp" class="dim sp">Costs <span class="num">{{ sp.value }}</span> system {{ Number(sp.value) === 1 ? 'point' : 'points' }}.</p>

    <RulesText v-if="info.lore" class="lore" :html="info.lore" />

    <template v-for="(group, g) in info.groups" :key="g">
      <!-- A frame's traits: a card each in the frame colour, its rules (chip first), then its other actions. -->
      <ul v-if="group.look === 'traits'" class="traits">
        <li v-for="(card, c) in group.cards" :key="c">
          <ItemCard type="frame" icon="trait" :name="card.heading">
            <InfoRule :activation="card.activation" :frequency="card.frequency" :stats="card.stats" :html="card.html" />
            <InfoRule v-for="(action, a) in card.actions" :key="a" class="ruled" v-bind="rule(action)" />
          </ItemCard>
        </li>
      </ul>
      <!-- A frame's core system: one card in the core colour, its lore, then its passive and its power. -->
      <ItemCard v-else-if="group.look === 'core'" type="core" icon="corebonus" :name="group.title ?? 'Core system'">
        <RulesText v-if="group.lore" class="lore" :html="group.lore" />
        <InfoRule v-for="(card, c) in group.cards" :key="c" :class="{ ruled: c > 0 || group.lore }" v-bind="rule(card)" />
      </ItemCard>
      <section v-else class="group">
        <h3 v-if="group.title" class="label">{{ group.title }}</h3>
        <RulesText v-if="group.lore" class="lore" :html="group.lore" />
        <dl v-if="group.tags" class="tags">
          <template v-for="(card, c) in group.cards" :key="c">
            <dt><span class="chip">{{ card.heading }}</span></dt>
            <dd><RulesText v-if="card.html" :html="card.html" /></dd>
          </template>
        </dl>
        <ul v-else class="cards" :class="{ stack: group.stack }">
          <li v-for="(card, c) in group.cards" :key="c" class="card">
            <InfoRule v-bind="rule(card)"><UnlockList v-if="card.unlocks?.length" :items="card.unlocks" links /></InfoRule>
          </li>
        </ul>
      </section>
    </template>

    <p v-if="!info.stats.length && !info.groups.length && !info.lore" class="dim">No information.</p>
    <p v-if="source" class="pack-source">Source: {{ source }}</p>
  </div>
</template>

<style scoped>
/* max-content rows: in a body taller than its box, auto rows would squash the clipped .sep facts line to nothing. */
.info-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr); /* a wide child can never widen the column */
  grid-auto-rows: max-content;
  align-content: start;
  gap: var(--space-l);
}

.facts {
  margin: 0;
  color: var(--text-dim);
  font-size: var(--fs-s);
}

.sp {
  margin: 0;
  font-size: var(--fs-s);
}

/* Lore: flavour, so small, quiet and italic next to the rules. */
.lore {
  color: var(--text-dim);
  font-size: var(--fs-s);
  font-style: italic;
}

.lore :deep(p) {
  max-width: none;
}

/* A frame's stats: the radar, and beside it every number in two columns (stacked on narrow screens). */
.compare {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(15rem, 1fr);
  align-items: center;
  gap: var(--space-l) var(--space-xl);
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin: 0;
  padding: 0;
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  list-style: none;
}

.stat-grid li {
  display: grid;
  grid-template-columns: 22px auto minmax(0, 1fr);
  align-items: center;
  gap: var(--space-s);
  padding: 6px var(--space-s);
  border-bottom: 1px solid var(--rule);
}

.stat-grid li:nth-child(odd) {
  border-right: 1px solid var(--rule);
}

.stat-grid li:nth-last-child(-n + 2) {
  border-bottom: 0;
}

.stat-grid .icon {
  width: 20px;
  height: 20px;
  color: var(--text-dim);
}

.stat-grid .num {
  font-weight: 700;
}

.stat-label {
  color: var(--text-dim);
  font-size: var(--fs-xs);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

@media (max-width: 44rem) {
  .compare {
    grid-template-columns: minmax(0, 1fr);
  }
}

/* Phones: the numbers come before the radar, and the radar loses the empty bands above and below its labels
   (16% of its width each, from its square viewBox). */
@media (max-width: 40rem) {
  .info-body {
    gap: var(--space-m);
  }

  .stat-grid {
    order: -1;
  }

  .compare :deep(.radar) {
    margin-block: calc(min(100%, 30rem) * -0.16);
  }
}

/* Frame traits: equal-height cards in a grid, as many 16rem columns as fit. */
.traits {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));
  gap: var(--space-m);
  margin: 0;
  padding: 0;
  list-style: none;
}

.traits > li {
  display: grid;
}

/* Inside a card, each further rule or action under a thin rule on the card's own surface. */
.ruled {
  padding-top: var(--space-m);
  border-top: 1px solid var(--rule);
}

.group {
  display: grid;
  gap: var(--space-s);
}

.group > .label {
  margin: 0;
}

/* Rules, actions and traits: no box each, they sit on the surface, a thin rule above each one, then its name (after
   the action's chip) over its rules. Side by side unless the group reads in order ("stack"). */
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));
  align-items: start;
  gap: var(--space-m) var(--space-xl);
  margin: 0;
  padding: 0;
  list-style: none;
}

.cards.stack {
  grid-template-columns: minmax(0, 1fr);
}

.card {
  padding-top: var(--space-s);
  border-top: 1px solid var(--rule);
}

/* Tags: the chip, then what it means. */
.tags {
  display: grid;
  gap: var(--space-xs);
  margin: 0;
}

.tags dd {
  margin: 0 0 var(--space-s);
  color: var(--text-dim);
}

.tags dd .rules-text {
  color: inherit;
  font-size: var(--fs-s);
}
</style>
