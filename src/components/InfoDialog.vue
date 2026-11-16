<script setup lang="ts">
import { computed, shallowRef, useTemplateRef, watch } from 'vue'
import { loadManufacturers, makerColour, makerLogo } from '../archive'
import { shownInfo, type Manufacturer } from '../info'
import ActionChip from './ActionChip.vue'
import ItemStats from './ItemStats.vue'
import RadarChart from './RadarChart.vue'
import RulesText from './RulesText.vue'
import Icon from './Icon.vue'

// The full information on one thing (src/info.ts), mounted once in App.vue and opened with showInfo(). It opens
// on top of a picker, so players can read an option in full before choosing it. Left-aligned: the head (its kind as a
// label, its name, Close), then its facts, its numbers (a frame's as a radar chart against every frame, with a grid
// of every stat; anything else's as symbols and numbers), its lore, and groups of rules: actions with their chip,
// and tags as chips with what each one means.
const dialog = useTemplateRef('dialog')
const closed = () => { shownInfo.value = null }
watch(shownInfo, (info) => {
  if (info && !dialog.value?.open) dialog.value?.showModal()
  if (!info) dialog.value?.close()
})

// Stats that differ between frames go on the radar, placed between the lowest and highest any frame has. Size
// isn't better or worse, and stats every frame shares (structure, stress) say nothing there. Every stat's number
// sits beside the radar in a grid.
const onRadar = computed(() => (shownInfo.value?.stats ?? []).filter((stat) => stat.range && stat.range.max > stat.range.min && stat.label !== 'size'))
const radar = computed(() =>
  onRadar.value.length >= 3
    ? onRadar.value.map((stat) => ({ label: stat.label, value: stat.value, at: (stat.range!.at - stat.range!.min) / (stat.range!.max - stat.range!.min) }))
    : [],
)
const summary = computed(() => `Stats compared with every frame: ${radar.value.map((axis) => `${axis.label} ${axis.value}`).join(', ')}`)

// Something made by a manufacturer shows its logo and takes its colour for the dialog's border (only there: never the
// text). The manufacturers are only fetched once something with one is first shown.
const manufacturers = shallowRef<Manufacturer[]>([])
let asked = false
watch(shownInfo, (info) => {
  if (info?.source && !asked) {
    asked = true
    loadManufacturers().then((list) => (manufacturers.value = list))
  }
})
const maker = computed(() => manufacturers.value.find((entry) => entry.id === shownInfo.value?.source))
const logo = computed(() => makerLogo(maker.value))
</script>

<template>
  <dialog
    ref="dialog"
    class="dialog info"
    :style="maker ? { '--mf': makerColour(maker) } : undefined"
    :aria-label="shownInfo ? `${shownInfo.kind}: ${shownInfo.name}` : 'Full information'"
    @close="closed"
    @click.self="dialog?.close()"
  >
    <!-- The parts fill the dialog, so a click on the dialog itself is a click on the backdrop. -->
    <header v-if="shownInfo" class="dialog-head">
      <div class="title">
        <Icon v-if="logo" class="logo" :src="logo" />
        <div>
          <p class="label">{{ shownInfo.kind }}</p>
          <h2>{{ shownInfo.name }}</h2>
        </div>
      </div>
      <button type="button" class="small" autofocus @click="dialog?.close()">Close</button>
    </header>
    <div v-if="shownInfo" class="dialog-body info-body">
      <p v-if="shownInfo.facts.length" class="facts sep">
        <span v-for="(fact, i) in shownInfo.facts" :key="i">{{ fact.text }}</span>
      </p>

      <div v-if="radar.length" class="compare">
        <RadarChart :axes="radar" :summary="summary" />
        <ul class="stat-grid">
          <li v-for="(stat, i) in shownInfo.stats" :key="i">
            <Icon v-if="stat.icon" :src="stat.icon" />
            <span class="num">{{ stat.value }}</span>
            <span class="stat-label">{{ stat.label }}</span>
          </li>
        </ul>
      </div>
      <ItemStats v-else :stats="shownInfo.stats.filter((stat) => stat.kind !== 'sp')" />
      <p v-if="shownInfo.stats.some((stat) => stat.kind === 'sp')" class="dim sp">
        Costs <span class="num">{{ shownInfo.stats.find((stat) => stat.kind === 'sp')!.value }}</span> system points.
      </p>

      <RulesText v-if="shownInfo.lore" class="lore" :html="shownInfo.lore" />

      <section v-for="(group, g) in shownInfo.groups" :key="g" class="group">
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
            <h4 class="card-head">
              <ActionChip :activation="card.activation" />
              <span class="card-name">{{ card.heading }}</span>
              <span v-if="card.frequency" class="dim frequency">{{ card.frequency }}</span>
            </h4>
            <div class="card-body">
              <ItemStats v-if="card.stats?.length" :stats="card.stats" />
              <RulesText v-if="card.html" :html="card.html" />
            </div>
          </li>
        </ul>
      </section>

      <p v-if="!shownInfo.stats.length && !shownInfo.groups.length && !shownInfo.lore" class="dim">No further information.</p>
    </div>
  </dialog>
</template>

<style scoped>
/* The dialog frame is style.css's .dialog (its border takes --mf), wider here for the radar and cards. */
.info {
  width: min(60rem, calc(100vw - 2rem));
}

.title {
  display: flex;
  flex: 1;
  align-items: center;
  gap: var(--space-m);
  min-width: 0;
}

.logo {
  width: 32px;
  height: 32px;
  color: var(--mf);
}

.title .label,
.title h2 {
  margin: 0;
}

.title h2 {
  font-size: var(--fs-l);
  overflow-wrap: anywhere;
}

/* max-content rows: in a body taller than the dialog, auto rows would squash the clipped .sep facts line to nothing. */
.info-body {
  display: grid;
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

.group {
  display: grid;
  gap: var(--space-s);
}

.group > .label {
  margin: 0;
}

/* Rules, actions and traits: no box each, they sit on the dialog's surface, a thin rule above each one, then its name
   (after the action's chip) over its rules. Side by side unless the group reads in order ("stack"). */
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
  display: grid;
  gap: var(--space-s);
  padding-top: var(--space-s);
  border-top: 1px solid var(--rule);
}

.card-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-s);
  margin: 0;
  font-size: var(--fs-m);
}

/* Headings come lower case from info.ts ("on hit", "rank I: Acrobatics"): sentence case here. */
.card-name::first-letter {
  text-transform: uppercase;
}

.frequency {
  font-size: var(--fs-s);
  font-weight: 400;
}

.card-body {
  display: grid;
  gap: var(--space-s);
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
