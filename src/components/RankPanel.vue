<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import { MAX_LICENCE_RANK, rankName, sum } from '../rules'
import ItemPicker from './ItemPicker.vue'
import RulesText from './RulesText.vue'
import SlotCard from './SlotCard.vue'

// What one rank gives: a talent rank's name and rules text, or the gear a licence rank unlocks.
export type RankStep = { name?: string; html?: string; unlocks?: { kind: string; name: string }[] }

// Things bought by rank with manna (licences and talents; src/rules.ts): a card per one held, with its rank
// I to III, - and +, and what each rank gives ("details", one step per rank); and a card to buy a new one from
// "options". Held ranks are bright; while editable, the ranks still to buy are shown dimmed, so players see what
// they'd get. Each rank costs "price"; buying stops when the manna "balance" can't cover it. Lowering refunds it.
const props = defineProps<{
  title: string
  noun: string
  options: { id: string; name: string; meta?: string }[]
  held: Record<string, number>
  details: (id: string) => RankStep[]
  price: number
  balance: number
  editable: boolean
  save: (next: Record<string, number>) => Promise<string | null>
}>()

const optionOf = (id: string) => props.options.find((option) => option.id === id)
const nameOf = (id: string) => optionOf(id)?.name ?? id
const shownSteps = (id: string, rank: number) => props.details(id).slice(0, props.editable ? MAX_LICENCE_RANK : rank)
const ranks = computed(() => Object.entries(props.held).filter(([, rank]) => rank > 0))
const affordable = computed(() => props.balance >= props.price)

const error = ref('')
const saving = ref(false)

async function store(next: Record<string, number>) {
  saving.value = true
  error.value = (await props.save(next)) ?? ''
  saving.value = false
  return !error.value
}

// Rank 0 drops it.
function setRank(id: string, rank: number) {
  const next = { ...props.held, [id]: rank }
  if (rank <= 0) delete next[id]
  store(next)
}

// --- Buying a new one at rank I ---
const picker = useTemplateRef('picker')
const offered = computed(() =>
  props.options
    .filter((option) => !props.held[option.id])
    .map((option) => ({ ...option, blocked: affordable.value ? '' : 'not enough manna' })),
)

function open() {
  error.value = ''
  picker.value?.open()
}

async function buy(id: string) {
  if (await store({ ...props.held, [id]: 1 })) picker.value?.close()
}
</script>

<template>
  <section class="ranks">
    <header class="head">
      <h2 class="sheet-label">{{ title }}<span class="tag"> [private]</span></h2>
      <slot name="summary" />
      <span class="dim">{{ sum(held) }} {{ sum(held) === 1 ? 'rank' : 'ranks' }}<template v-if="editable">, {{ price }} manna each</template></span>
    </header>

    <ul v-if="ranks.length || editable" class="slot-grid">
      <SlotCard v-for="[id, rank] in ranks" :key="id" :title="nameOf(id)">
        <div class="rank">
          <span>
            <span class="rank-value">rank {{ rankName(rank) }}</span>
            <span class="dim"> of {{ rankName(MAX_LICENCE_RANK) }}</span>
            <span v-if="optionOf(id)?.meta" class="meta">{{ optionOf(id)?.meta }}</span>
          </span>
          <span v-if="editable" class="steps">
            <button type="button" :aria-label="`lower ${nameOf(id)}`" :disabled="saving" @click="setRank(id, rank - 1)">-</button>
            <button
              type="button"
              :aria-label="`raise ${nameOf(id)}`"
              :title="affordable ? '' : 'not enough manna'"
              :disabled="saving || rank >= MAX_LICENCE_RANK || !affordable"
              @click="setRank(id, rank + 1)"
            >
              +
            </button>
          </span>
        </div>
        <ol class="steps-list">
          <li v-for="(step, i) in shownSteps(id, rank)" :key="i" class="step" :class="{ locked: i >= rank }">
            <p class="step-head">
              <span class="numeral">{{ rankName(i + 1) }}</span>
              <span v-if="step.name" class="step-name">{{ step.name }}</span>
              <span v-if="i === rank" class="dim step-note">next: {{ affordable ? `${price} manna` : 'not enough manna' }}</span>
              <span v-else-if="i > rank" class="dim step-note">locked</span>
            </p>
            <RulesText v-if="step.html" :html="step.html" />
            <ul v-if="step.unlocks?.length" class="unlocks">
              <li v-for="item in step.unlocks" :key="`${item.kind}:${item.name}`">
                <span class="kind" :class="item.kind">{{ item.kind }}</span> {{ item.name }}
              </li>
            </ul>
            <p v-else-if="!step.html" class="dim step-empty">nothing new at this rank.</p>
          </li>
        </ol>
      </SlotCard>
      <SlotCard v-if="editable" :title="`new ${noun}`" empty>
        <template #tools>
          <button type="button" :disabled="saving" @click="open">buy</button>
        </template>
      </SlotCard>
    </ul>
    <p v-else class="dim note">none.</p>

    <p v-if="error" class="rose note" role="alert">not saved: {{ error }}</p>

    <ItemPicker ref="picker" :title="`buy a ${noun} (rank I, ${price} manna)`" :options="offered" :saving="saving" :error="error" @choose="buy" />
  </section>
</template>

<style scoped>
.ranks {
  container-type: inline-size;
}

.slot-grid {
  grid-template-columns: minmax(0, 1fr);
}

.head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 1.5rem;
  font-size: 0.8125rem;
}

.rank {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.rank-value {
  color: var(--lilac);
  font-size: 1.375rem;
  font-weight: 700;
}

.meta {
  display: block;
  color: var(--text-dim);
  font-size: 0.8125rem;
}

/* One block per rank: a numeral tag, the rank's name, then what it gives. Ranks not yet bought are dimmed. */
.steps-list {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.step {
  padding-left: 0.75rem;
  border-left: 2px solid var(--lilac);
}

.step.locked {
  border-left-color: var(--rule);
  opacity: 0.55;
}

.step-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.25rem 0.6rem;
  max-width: none;
  margin: 0 0 0.35rem;
}

.numeral {
  min-width: 2.25rem;
  padding: 0 0.35rem;
  border: 1px solid var(--lilac);
  color: var(--lilac);
  font-size: 0.8125rem;
  font-weight: 700;
  text-align: center;
}

.locked .numeral {
  border-color: var(--rule);
  color: var(--text-dim);
}

.step-name {
  color: var(--text);
  font-weight: 700;
}

.step-note,
.step-empty {
  margin: 0;
  font-size: 0.8125rem;
}

.unlocks {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
  font: 400 0.875rem/1.45 var(--read);
}

.unlocks li {
  padding: 0.1rem 0.5rem;
  border: 1px solid var(--rule);
}

/* The frame stands out in lilac; gear in sky, the palette's neutral accent. */
.kind {
  color: var(--sky);
  font: 700 0.6875rem var(--mono);
}

.kind.frame {
  color: var(--lilac);
}

.note {
  margin: 0.6rem 0 0;
  font-size: 0.8125rem;
}

/* Small square steppers, as in StatRow. */
.steps {
  display: flex;
  gap: 0.35rem;
}

.steps button {
  width: 1.75rem;
  padding: 0;
  border: 1px solid var(--rule);
  color: var(--text-dim);
  font-weight: 400;
  line-height: 1.4;
}

.steps button::before,
.steps button::after {
  content: none;
}

.steps button:hover:not(:disabled),
.steps button:focus-visible {
  border-color: var(--lilac);
  color: var(--lilac);
}

.steps button:disabled {
  opacity: 0.35;
  cursor: default;
}
</style>
