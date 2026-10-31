<script setup lang="ts">
import { computed, useTemplateRef, watch } from 'vue'
import { shownInfo } from '../info'
import RadarChart from './RadarChart.vue'
import RulesText from './RulesText.vue'
import StatIcon from './StatIcon.vue'

// The full information on one thing (src/info.ts), mounted once in App.vue and opened with showInfo(). It opens
// on top of a picker, so players can read an option in full before choosing it. Laid out from the developer's
// sketch, centred: name and lore, then stats (a frame's as a radar chart against every frame), then groups of cards.
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
const summary = computed(() => `stats compared with every frame: ${radar.value.map((axis) => `${axis.label} ${axis.value}`).join(', ')}`)
</script>

<template>
  <dialog ref="dialog" class="info" :aria-label="shownInfo ? `${shownInfo.kind}: ${shownInfo.name}` : 'full information'" @close="closed" @click.self="dialog?.close()">
    <!-- The padding lives inside, so a click on the dialog itself is a click on the backdrop. -->
    <div v-if="shownInfo" class="info-body">
      <button type="button" class="close" autofocus @click="dialog?.close()">close</button>

      <header class="part">
        <p class="kind">{{ shownInfo.kind }}</p>
        <h3>{{ shownInfo.name }}</h3>
        <p v-if="shownInfo.facts.length" class="facts">
          <template v-for="(fact, i) in shownInfo.facts" :key="i"><span v-if="i"> · </span><span :class="fact.tone && `toned tone-${fact.tone}`">{{ fact.text }}</span></template>
        </p>
        <RulesText v-if="shownInfo.lore" class="lore" :html="shownInfo.lore" />
      </header>

      <section v-if="shownInfo.stats.length" class="part">
        <div v-if="radar.length" class="compare">
          <RadarChart :axes="radar" :summary="summary" />
          <div>
            <ul class="stat-grid">
              <li v-for="(stat, i) in shownInfo.stats" :key="i">
                <span class="stat-value"><StatIcon v-if="stat.icon" :src="stat.icon" />{{ stat.value }}</span>
                <span class="stat-label">{{ stat.label }}</span>
              </li>
            </ul>
          </div>
        </div>
        <ul v-else class="stats">
          <li v-for="(stat, i) in shownInfo.stats" :key="i">
            <span class="stat-value"><StatIcon v-if="stat.icon" :src="stat.icon" />{{ stat.value }}</span>
            <span class="stat-label">{{ stat.label }}</span>
          </li>
        </ul>
      </section>

      <section v-for="(group, g) in shownInfo.groups" :key="g" class="part">
        <h4 v-if="group.title" class="group-title" :class="`tone-${group.tone ?? 'lilac'}`">{{ group.title }}</h4>
        <RulesText v-if="group.lore" class="lore" :html="group.lore" />
        <ul class="cards" :class="{ stack: group.stack }">
          <li v-for="(card, c) in group.cards" :key="c" class="card" :class="`tone-${card.tone}`">
            <h5>{{ card.heading }}</h5>
            <RulesText v-if="card.html" class="card-text" :html="card.html" />
          </li>
        </ul>
      </section>

      <p v-if="!shownInfo.stats.length && !shownInfo.groups.length && !shownInfo.lore" class="part dim">no further information.</p>
    </div>
  </dialog>
</template>

<style scoped>
.info {
  width: min(60rem, calc(100vw - 2rem));
  max-height: 88vh;
  padding: 0;
  border: 1px solid var(--lilac);
  background: var(--void);
  color: var(--text);
  font: 400 0.9375rem/1.6 var(--mono);
}

.info::backdrop {
  background: rgb(0 0 0 / 0.6);
}

.info-body {
  position: relative;
  padding: 0 1.25rem;
  text-align: center;
}

.close {
  position: absolute;
  top: 0.75rem;
  right: 1rem;
  padding: 0;
  font-size: 0.875rem;
}

/* Each part is separated from the next by a thin line, as in the sketch. */
.part {
  padding: 1.25rem 0;
}

.part + .part {
  border-top: 1px solid var(--rule);
}

.kind {
  max-width: none;
  margin: 0;
  color: var(--sky);
  font-size: 0.8125rem;
}

h3 {
  margin: 0.15rem 0 0;
  color: var(--lilac);
  font-size: 2rem;
  line-height: 1.2;
}

.facts {
  max-width: none;
  margin: 0.35rem 0 0;
  color: var(--text-dim);
  font-size: 0.8125rem;
}

/* Facts that matter most (a frame's classification, the licence) in their tone. */
.toned {
  color: var(--tone);
}

/* Lore: flavour, so small and quiet next to the rules. */
/* Nearly the dialog's full width, so long lore takes fewer lines. */
.lore {
  max-width: none;
  margin: 0.6rem 0.5rem 0;
  color: var(--text-dim);
  font-size: 0.75rem;
  line-height: 1.45;
  opacity: 0.75;
}

.lore :deep(p) {
  max-width: none;
  margin: 0 auto 0.75em;
}

.lore :deep(p:last-child) {
  margin-bottom: 0;
}

/* Stats without a radar (items, bionics): a tile each. */
.stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(6.5rem, 7.5rem));
  justify-content: center;
  gap: 1rem 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.stats li {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--lilac);
  font-size: 1.375rem;
  font-weight: 700;
  line-height: 1.2;
}

.stat-label {
  color: var(--lilac);
  font-size: 0.6875rem;
}

/* A frame's stats: the radar, and beside it every number in two columns of six (stacked on narrow screens). */
.compare {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(15rem, 1fr);
  align-items: center;
  gap: 1rem 1.5rem;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin: 0;
  padding: 0;
  border: 1px solid var(--rule);
  list-style: none;
}

.stat-grid li {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.4rem 0.5rem;
  border-bottom: 1px solid var(--rule);
}

.stat-grid li:nth-child(odd) {
  border-right: 1px solid var(--rule);
}

.stat-grid li:nth-last-child(-n + 2) {
  border-bottom: 0;
}

.stat-grid .stat-value {
  font-size: 1.125rem;
}

.stat-grid .stat-label {
  color: var(--text);
}


@media (max-width: 44rem) {
  .compare {
    grid-template-columns: minmax(0, 1fr);
  }
}

.group-title {
  margin: 0;
  color: var(--tone);
  font-size: 1.375rem;
}

/* Each card and group title takes its tone (src/info.ts) from the site's accents. */
.tone-lilac { --tone: var(--lilac); }
.tone-rose { --tone: var(--rose); }
.tone-sky { --tone: var(--sky); }

/* Rule cards: a thin border, a header bar in the card's tone (dark text on the accent), then the text. */
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  gap: 0.75rem;
  margin: 1rem 0 0;
  padding: 0;
  list-style: none;
}

/* Rules read in order (effect, then on attack, on hit...): one above another. */
.cards.stack {
  grid-template-columns: minmax(0, 1fr);
}

.card {
  border: 1px solid color-mix(in srgb, var(--tone) 35%, var(--rule));
}

h5 {
  margin: 0;
  padding: 0.35rem 0.6rem;
  background: var(--tone);
  color: var(--void);
  font-size: 0.8125rem;
  font-weight: 700;
}

.card-text {
  padding: 0.6rem 0.75rem 0.75rem;
  font-size: 0.875rem;
}

/* Centred, but lists keep their items left-aligned so the bullets line up. */
.info-body :deep(ul:not(.stats, .cards, .stat-grid)),
.info-body :deep(ol) {
  /* Its own centred block (shrink-to-fit), not inline beside the sentence leading into it. */
  display: table;
  margin-inline: auto;
  text-align: left;
}
</style>
