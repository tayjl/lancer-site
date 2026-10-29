<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import { MAX_LICENCE_RANK, rankName, sum } from '../rules'
import ItemPicker from './ItemPicker.vue'
import SlotCard from './SlotCard.vue'

// Things bought by rank with manna (licences and talents; src/rules.ts): a card per one held, with its rank
// I to III, - and +, and what the rank gives ("details"); and a card to buy a new one from "options".
// Each rank costs "price"; buying stops when the manna "balance" can't cover it. Lowering a rank refunds it.
const props = defineProps<{
  title: string
  noun: string
  options: { id: string; name: string; meta?: string }[]
  held: Record<string, number>
  details: (id: string, rank: number) => string[]
  price: number
  balance: number
  editable: boolean
  save: (next: Record<string, number>) => Promise<string | null>
}>()

const nameOf = (id: string) => props.options.find((option) => option.id === id)?.name ?? id
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
      <span class="dim">{{ sum(held) }} {{ sum(held) === 1 ? 'rank' : 'ranks' }}, {{ price }} manna each</span>
    </header>

    <ul v-if="ranks.length || editable" class="slot-grid">
      <SlotCard v-for="[id, rank] in ranks" :key="id" :title="nameOf(id)">
        <div class="rank">
          <span class="rank-value">rank {{ rankName(rank) }}</span>
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
        <p v-for="(line, i) in details(id, rank)" :key="i" class="detail">{{ line }}</p>
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

.detail {
  margin: 0;
  color: var(--text-dim);
  font: 400 0.875rem/1.45 var(--read);
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
