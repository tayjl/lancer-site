<script setup lang="ts">
import { useId } from 'vue'
import type { CombatEntry } from '../combatEntries'
import { showInfo } from '../info'
import { activationOf } from '../itemDetails'
import ActionChip from './ActionChip.vue'
import Icon from './Icon.vue'
import ItemStats from './ItemStats.vue'
import RulesText from './RulesText.vue'

// A card of the combat guide: a header in the colour of what it holds (a --act-* or --type-* variable; none is
// neutral), then compact rows. A row with "info" is a button that opens the full information (your kit), a "plain" one is
// short text, and any other opens in place (rules). The default slot holds a card's own body (tables, formulas) above
// the rows. "mine" is your kit's own actions under a "Your kit" label; "groupActivation" (an --act-* name) leaves the
// chip off rows that the card's colour already says.
const props = defineProps<{
  title: string
  icon: string
  colour?: string
  meta?: string
  note?: string
  entries?: CombatEntry[]
  mine?: CombatEntry[]
  groupActivation?: string
}>()
const id = useId()
const chips = (entry: CombatEntry) => (entry.activations ?? (entry.activation ? [entry.activation] : [])).filter((word) => activationOf(word)?.colour !== props.groupActivation)
const key = (entry: CombatEntry, n: number) => `${entry.name ?? entry.value ?? entry.text}:${n}`
</script>

<template>
  <section class="group" :class="{ neutral: !colour, core: colour === '--type-core' }" :style="colour ? { '--c': `var(${colour})` } : undefined" :aria-labelledby="id">
    <header class="group-head">
      <Icon :name="icon" />
      <h3 :id="id">{{ title }}</h3>
      <span v-if="meta" class="meta">{{ meta }}</span>
    </header>
    <p v-if="note" class="group-note">{{ note }}</p>
    <slot />
    <template v-for="(list, n) in [mine ?? [], entries ?? []]" :key="n">
      <p v-if="n === 0 && list.length" class="label group-sub">Your kit</p>
      <ul v-if="list.length" class="entries">
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
                  <ActionChip v-for="word in chips(entry)" :key="word" :activation="word" />
                  <Icon v-if="entry.icon" :name="entry.icon" class="area-icon" />
                  <span v-if="entry.tag" class="chip">{{ entry.tag }}</span>
                  <span v-if="entry.name" class="name">{{ entry.name }}</span>
                  <span v-if="entry.heat" class="heat-cost"><Icon name="heat" />{{ entry.heat }}</span>
                  <span v-if="entry.frequency" class="freq">{{ entry.frequency }}</span>
                </span>
                <ItemStats v-if="entry.stats?.length" :stats="entry.stats" />
                <span v-if="entry.gist" class="entry-gist">{{ entry.gist }}</span>
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
  overflow: hidden;
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  background: var(--panel);
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
