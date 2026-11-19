<script setup lang="ts">
import { formatAmount } from '../rules'
import type { Tone } from '../changeDiff'
import Icon from './Icon.vue'

// What a section of a change review adds up to: how many lines were added or raised (+), removed or lowered (−) and
// updated (~), then the manna it costs (red, with a minus) or refunds (green, with a plus). Either part can be left
// out; zeros are hidden. Colour is never alone: every figure keeps its symbol, and screen readers get the words.
defineProps<{ counts?: Record<Tone, number>; manna?: number }>()

const TONES = [
  { tone: 'up', word: 'added or raised', icon: 'plus' },
  { tone: 'down', word: 'removed or lowered', icon: 'minus' },
  { tone: 'info', word: 'updated', icon: '' },
] as const
</script>

<template>
  <span class="tally">
    <template v-if="counts">
      <template v-for="t in TONES" :key="t.tone">
        <span v-if="counts[t.tone]" :class="`tone-${t.tone}`">
          <Icon v-if="t.icon" :name="t.icon" /><span v-else aria-hidden="true">~</span>
          <span class="num">{{ counts[t.tone] }}</span><span class="sr-only"> {{ t.word }}</span>
        </span>
      </template>
    </template>
    <span v-if="manna" class="num manna" :class="manna > 0 ? 'tone-down' : 'tone-up'">
      {{ manna > 0 ? '−' : '+' }}{{ formatAmount(Math.abs(manna)) }}<span class="sr-only"> manna {{ manna > 0 ? 'cost' : 'refund' }}</span>
    </span>
  </span>
</template>

<style scoped>
.tally { display: inline-flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: var(--space-xs) var(--space-m); font-size: var(--fs-s); }
.tally > span { display: inline-flex; align-items: center; gap: var(--space-xs); }
.manna { font-weight: 700; }
.tone-up { color: var(--ok); }
.tone-down { color: var(--danger); }
.tone-info { color: var(--info); }
</style>
