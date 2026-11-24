<script setup lang="ts">
import { useId } from 'vue'
import { entryInfo, type CombatEntry } from '../combatEntries'
import { showInfo } from '../info'
import { activationOf } from '../itemDetails'
import ActionChip from './ActionChip.vue'
import Icon from './Icon.vue'
import ItemStats from './ItemStats.vue'
import RulesText from './RulesText.vue'

// A card of the combat guide: a header in the colour of what it holds (a --act-* or --type-* variable; none is
// neutral), then compact rows. A row with "info" is a button that opens the full information (your kit), a "plain" one is
// short text, and any other opens in place (rules). The default slot holds a card's own body (tables, formulas) above
// the rows. "mine" is your kit's own actions under a "Your kit" label. With "chips" the rows are a wrapping row of light
// buttons, name only (a "Mod" or gateway prefix, a Heat cost, and a "cost" tag where an action's cost matters), each
// opening its full text in the information popup; "tagged" ends each chip with its activation word (the search card, which
// mixes them all). "empty" is the line a card with nothing in it shows, so it keeps its place in a row of cards. "gist"
// draws each row's first sentence under its name (the turn's rows).
const props = defineProps<{
  title: string
  icon: string
  colour?: string
  meta?: string
  note?: string
  entries?: CombatEntry[]
  mine?: CombatEntry[]
  empty?: string
  chips?: boolean
  tagged?: boolean
  gist?: boolean
  across?: boolean
}>()
const id = useId()
const badges = (entry: CombatEntry) => entry.activations ?? (entry.activation ? [entry.activation] : [])
// A chip's small tag: its cost ('1 quick'), or on the search card its activation word. Word and symbol, never colour alone.
const tags = (entry: CombatEntry) => {
  const words = entry.cost ? [entry.cost] : entry.info ? (entry.activations ?? []) : props.tagged && entry.activation?.toLowerCase() !== entry.name?.toLowerCase() && entry.activation ? [entry.activation] : []
  return words.flatMap((word) => {
    const look = activationOf(entry.cost ? entry.cost.split(' ').slice(1).join(' ') : word)
    return look ? [{ word, ...look }] : []
  })
}
// A chip list's runs: a Frame-card sub-label starts a new run.
const runs = (list: CombatEntry[]) =>
  list.reduce<{ title?: string; items: CombatEntry[] }[]>((all, entry) => {
    if (all.length && all[all.length - 1].title === entry.group) all[all.length - 1].items.push(entry)
    else all.push({ title: entry.group, items: [entry] })
    return all
  }, [])
const key = (entry: CombatEntry, n: number) => `${entry.name ?? entry.value ?? entry.text}:${n}`
</script>

<template>
  <section class="group" :class="{ neutral: !colour, core: colour === '--type-core', across }" :style="colour ? { '--c': `var(${colour})` } : undefined" :aria-labelledby="id">
    <header class="group-head">
      <Icon :name="icon" />
      <h3 :id="id">{{ title }}</h3>
      <span v-if="meta" class="meta">{{ meta }}</span>
    </header>
    <p v-if="note" class="group-note">{{ note }}</p>
    <slot />
    <p v-if="empty && !entries?.length && !mine?.length && !$slots.default" class="group-empty">{{ empty }}</p>
    <template v-for="(list, n) in [mine ?? [], entries ?? []]" :key="n">
      <p v-if="n === 0 && list.length" class="label group-sub">Your kit</p>
      <template v-if="chips && list.length">
      <div class="runs">
      <div v-for="(run, r) in runs(list)" :key="r" class="run">
      <p v-if="run.title" class="label group-sub">{{ run.title }}</p>
      <ul class="chip-row" :class="{ sub: run.title }">
        <li v-for="(entry, i) in run.items" :key="key(entry, i)">
          <button type="button" class="chip-btn" @click="showInfo(entryInfo(entry, title))">
            <span v-if="entry.mod || (entry.value && entry.name)" class="chip-pre">{{ entry.mod ? 'Mod' : entry.value }}</span>
            <span>{{ entry.name ?? entry.tag ?? entry.value }}</span>
            <span v-if="entry.heat" class="heat-cost"><Icon name="heat" />{{ entry.heat }}</span>
            <span v-for="t in tags(entry)" :key="t.word" class="cost" :style="{ '--c': `var(${t.colour})` }"><Icon :name="t.icon" />{{ t.word }}</span>
          </button>
        </li>
      </ul>
      </div>
      </div>
      </template>
      <ul v-else-if="list.length" class="entries">
        <li v-for="(entry, i) in list" :key="key(entry, i)" :class="{ 'mod-row': entry.mod }">
          <p v-if="entry.plain" class="entry-plain">
            <span v-if="entry.value && entry.value.length <= 4" class="entry-value">{{ entry.value }}</span>
            <span><b v-if="entry.value && entry.value.length > 4" class="plain-label">{{ entry.value }}</b>{{ entry.text }}</span>
          </p>
          <component :is="entry.info ? 'div' : 'details'" v-else class="entry" :class="{ 'has-value': entry.value, 'has-step': entry.step }" :open="entry.info ? undefined : entry.open">
            <component
              :is="entry.info ? 'button' : 'summary'"
              class="entry-row"
              :type="entry.info ? 'button' : undefined"
              :aria-label="entry.info ? `Full information: ${entry.name}` : undefined"
              @click="entry.info && showInfo(entry.info())"
            >
              <span v-if="entry.step" class="step-no" aria-hidden="true">{{ entry.step }}</span>
              <span v-else-if="entry.value" class="entry-value">{{ entry.value }}</span>
              <span class="entry-main">
                <span v-if="entry.label" class="label entry-label">{{ entry.label }}</span>
                <span class="entry-title">
                  <ActionChip v-for="word in badges(entry)" :key="word" :activation="word" />
                  <Icon v-if="entry.icon" :name="entry.icon" class="area-icon" />
                  <span v-if="entry.tag" class="chip">{{ entry.tag }}</span>
                  <span v-if="entry.name" class="name">{{ entry.name }}</span>
                  <span v-if="entry.heat" class="heat-cost"><Icon name="heat" />{{ entry.heat }}</span>
                  <span v-if="entry.frequency" class="freq">{{ entry.frequency }}</span>
                </span>
                <ItemStats v-if="entry.stats?.length" :stats="entry.stats" />
                <span v-if="gist && entry.gist" class="entry-gist">{{ entry.gist }}</span>
                <ul v-if="entry.tags?.length" class="chips">
                  <li v-for="tag in entry.tags" :key="tag" class="chip">{{ tag }}</li>
                </ul>
              </span>
              <Icon :name="entry.info ? 'chevron-right' : 'chevron-down'" class="chev" />
            </component>
            <RulesText v-if="!entry.info && entry.text" class="entry-body" :html="entry.text" />
          </component>
        </li>
      </ul>
    </template>
  </section>
</template>

<style scoped>
.group {
  --c: var(--raised);
  --tint: var(--c);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  background: var(--panel);
}

/* A neutral card's --c is --raised, too close to --panel to tint a chip. */
.neutral {
  --tint: var(--edge);
}

.group-head {
  display: flex;
  align-items: center;
  gap: var(--space-s);
  min-height: 40px;
  padding: 6px var(--space-m);
  background: var(--c);
  color: #fff;
}

.group-head .icon {
  width: 20px;
  height: 20px;
}

.group-head h3 {
  flex: 1;
  min-width: 0;
  margin: 0;
  color: inherit;
  font: 700 14px / 1.3 var(--sans);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.group-head .meta {
  font: 700 var(--fs-s) var(--sans);
  white-space: nowrap;
}

.neutral .group-head {
  color: var(--text);
}

.neutral .group-head .icon {
  color: var(--text-dim);
}

.core .group-head {
  color: var(--void);
}

.group-note {
  max-width: none;
  margin: 0;
  padding: var(--space-s) var(--space-m);
  border-bottom: 1px solid var(--rule);
  color: var(--text-dim);
  font-size: var(--fs-s);
}

.group-sub {
  max-width: none; /* the rule runs the full column, wide or narrow */
  margin: 0;
  padding: var(--space-s) var(--space-m);
  border-bottom: 1px solid var(--rule);
}

/* Rows */
.entries {
  margin: 0;
  padding: 0;
  list-style: none;
}

.entries > li + li,
.entries + .entries {
  border-top: 1px solid var(--rule);
}

.entry-row,
.entry-plain {
  display: flex;
  align-items: center;
  gap: var(--space-m);
  width: 100%;
  min-height: 44px;
  padding: var(--space-s) var(--space-m);
}

.entry-row {
  cursor: pointer;
  list-style: none;
}

.entry-row::-webkit-details-marker {
  display: none;
}

/* The row's own look replaces the global button's. */
button.entry-row {
  border: 0;
  border-radius: 0;
  background: none;
  color: var(--text);
  font: inherit;
  letter-spacing: 0;
  text-align: left;
  text-transform: none;
}

.entry-row:hover:not(:disabled) {
  background: var(--raised);
}

.entry-row:focus-visible {
  outline-offset: -2px;
}

.entry-plain {
  align-items: baseline;
  margin: 0;
  font-size: var(--fs-s);
}

.plain-label {
  display: block;
}

.entry-main {
  display: grid;
  flex: 1;
  gap: 2px;
  min-width: 0;
}

.entry-value {
  flex: none;
  width: 2.75rem;
  color: var(--text);
  font: 700 var(--fs-m) var(--mono);
}

.entry-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px var(--space-s);
  font-weight: 700;
}

.entry-title .name {
  text-decoration: underline 2px transparent;
  text-underline-offset: 0.2em;
}

.entry-row:hover .name,
.entry-row:focus-visible .name {
  text-decoration-color: currentColor;
}

.entry-title .freq {
  color: var(--text-dim);
  font-size: var(--fs-s);
  font-weight: 400;
}

.area-icon {
  color: var(--text-dim);
}

.entry-label {
  margin: 0;
}

/* The first sentence in full: a clamp cut sentences off mid-word. */
.entry-gist {
  display: block;
  color: var(--text-dim);
  font-size: var(--fs-s);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 2px 0 0;
  padding: 0;
  list-style: none;
}

.chips .chip {
  height: 20px;
  padding: 0 6px;
  font-size: 11px;
}

.chev {
  flex: none;
  width: 18px;
  height: 18px;
  color: var(--text-dim);
}

.entry[open] > .entry-row .chev {
  rotate: 180deg;
}

.entry[open] > .entry-row .entry-gist {
  display: none;
}

.entry[open] > .entry-row {
  background: var(--raised);
}

/* An open body lines up with the name, past the value or step. */
.entry-body {
  padding: var(--space-s) var(--space-m) var(--space-m) calc(var(--space-m) + var(--indent, 0px));
}

.entry-body :deep(p) {
  max-width: 68ch;
}

.has-value {
  --indent: calc(2.75rem + var(--space-m));
}

.has-step {
  --indent: calc(1.25rem + var(--space-m));
}

/* The runs are plain wrappers, except in a card that lays its labelled groups side by side. */
.runs,
.run {
  display: contents;
}

.across .runs {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
}

.across .run {
  display: flex;
  flex-direction: column;
}

/* Chip view: a left-aligned wrapping row of light buttons. The shape is on ::before so the focus ring isn't clipped. */
.chip-row {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: var(--space-s);
  margin: 0;
  padding: var(--space-m);
  list-style: none;
}

/* Under a sub-label the chips sit closer to it. */
.chip-row.sub {
  padding-top: var(--space-s);
}

.chip-btn {
  position: relative;
  isolation: isolate;
  min-height: 32px;
  max-width: 100%;
  padding: 6px 14px 6px 10px;
  border: 0;
  border-radius: 0;
  background: none;
  color: var(--text);
  font: 700 var(--fs-xs) / 1.2 var(--sans);
  letter-spacing: 0.04em;
  text-align: left;
  white-space: normal;
}

.chip-btn::before {
  content: '';
  position: absolute;
  inset: 0;
  z-index: -1;
  background: color-mix(in srgb, var(--tint) 22%, var(--panel));
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - 7px), calc(100% - 7px) 100%, 0 100%);
}

.chip-btn:hover:not(:disabled) {
  background: none;
  color: var(--lilac);
}

.chip-btn:hover::before {
  background: color-mix(in srgb, var(--lilac) 18%, var(--panel));
}

@media (pointer: coarse), (max-width: 40rem) {
  .chip-btn {
    min-height: var(--tap);
  }
}

.chip-pre {
  color: var(--text-dim);
  font-family: var(--mono);
}

.cost {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 20px;
  margin-left: 6px;
  padding: 0 8px 0 6px;
  background: var(--c);
  color: #fff;
  font: 700 var(--fs-xs) / 1 var(--sans);
  letter-spacing: 0.06em;
  white-space: nowrap;
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%);
}

.cost .icon {
  width: 14px;
  height: 14px;
}

.group-empty {
  display: grid;
  flex: 1;
  max-width: none; /* centred in the whole card, however wide */
  place-items: center;
  margin: 0;
  padding: var(--space-m);
  color: var(--text-dim);
  font-size: var(--fs-s);
  text-align: center;
}

/* A weapon's mod sits under it, indented. */
.mod-row .entry-row {
  padding-left: calc(var(--space-m) + var(--space-l));
}

.heat-cost {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font: 700 var(--fs-s) var(--mono);
}

.heat-cost .icon {
  width: 16px;
  height: 16px;
  color: var(--dmg-heat);
}

.step-no {
  flex: none;
  width: 1.25rem;
  color: var(--text-dim);
  font: 700 var(--fs-m) var(--mono);
}
</style>
