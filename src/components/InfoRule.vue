<script setup lang="ts">
import type { InfoStat } from '../info'
import ActionChip from './ActionChip.vue'
import ItemStats from './ItemStats.vue'
import RulesText from './RulesText.vue'

// One rule or action as it reads in the full information and on cards: an optional small label ("Passive"), then the
// action's chip, its name and frequency, its own numbers and its rules text. With no heading and no activation (a
// trait's own rules under its card's header) it's just the numbers and text. Anything extra goes in the slot. `level` is
// the heading's level (2 to 6): one below whatever heading the rule sits under, so screen readers never skip a level.
withDefaults(defineProps<{ label?: string; heading?: string; activation?: string; frequency?: string; stats?: InfoStat[]; html?: string; level?: 2 | 3 | 4 | 5 | 6 }>(), { level: 4 })
</script>

<template>
  <div class="info-rule">
    <p v-if="label" class="label">{{ label }}</p>
    <component :is="`h${level}`" v-if="heading || activation" class="rule-head">
      <ActionChip :activation="activation" />
      <span v-if="heading" class="rule-name">{{ heading }}</span>
      <span v-if="frequency" class="dim frequency">{{ frequency }}</span>
    </component>
    <ItemStats v-if="stats?.length" :stats="stats" />
    <RulesText v-if="html" :html="html" />
    <slot />
  </div>
</template>

<style scoped>
.info-rule {
  display: grid;
  gap: var(--space-s);
}

.label {
  margin: 0;
}

.rule-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-s);
  margin: 0;
  font-size: var(--fs-m);
}

/* Headings come lower case from info.ts ("on hit", "rank I: Acrobatics"): sentence case here. */
.rule-name::first-letter {
  text-transform: uppercase;
}

.frequency {
  font-size: var(--fs-s);
  font-weight: 400;
}
</style>
