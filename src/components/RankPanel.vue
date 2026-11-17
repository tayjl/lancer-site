<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import { sourceOf } from '../gameData'
import { MAX_LICENCE_RANK, rankName } from '../rules'
import type { Info } from '../info'
import Icon from './Icon.vue'
import InfoButton from './InfoButton.vue'
import ItemCard from './ItemCard.vue'
import ItemPicker from './ItemPicker.vue'
import RulesText from './RulesText.vue'

// What one rank gives: a talent rank's name and rules text, or the gear a licence rank unlocks.
export type RankStep = { name?: string; html?: string; unlocks?: { kind: string; name: string; info?: () => Info }[] }

// Things bought by rank with manna (licences and talents; src/rules.ts): an item card per one held, its rank in the
// header, and what each rank gives ("details", one step per rank); and a button in the heading to buy a new one from
// "options". Licences ("columns") lay ranks I to III side by side like COMP/CON's ladder, each with its unlocks and
// their symbols; talents ("tiers") stack them, a big numeral beside the rank's name and rules. Held ranks are bright,
// later ones dimmed, with "Next: 600 manna" or "Locked" while editable. Each rank costs "price"; buying stops when
// the manna "balance" can't cover it (the button stays, disabled, with the reason beside it). Lowering refunds it.
const props = defineProps<{
  title: string
  noun: string
  options: { id: string; name: string; meta?: string; info?: () => Info }[]
  held: Record<string, number>
  details: (id: string) => RankStep[]
  columns?: boolean
  tiers?: boolean
  price: number
  balance: number
  editable: boolean
  save: (next: Record<string, number>) => Promise<string | null>
}>()

const optionOf = (id: string) => props.options.find((option) => option.id === id)
const nameOf = (id: string) => optionOf(id)?.name ?? id
const ranks = computed(() => Object.entries(props.held).filter(([, rank]) => rank > 0))
const affordable = computed(() => props.balance >= props.price)
// Licences are frame-purple, talents brown (the --type-* tokens).
const look = computed(() => (props.columns ? { type: 'frame' as const, icon: 'license' } : { type: 'talent' as const, icon: 'talent' }))
// What a rank's box says about it: held, the next one to buy, or locked behind it. Prices only while editable.
const status = (i: number, rank: number) => (i < rank ? 'held' : !props.editable ? '' : i === rank ? 'next' : 'locked')

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
    .map((option) => ({ ...option, blocked: affordable.value ? '' : 'Not enough manna' })),
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
    <header class="head sheet-head">
      <h2 class="sheet-label">{{ title }}<span class="private">Private</span></h2>
      <slot name="summary" />
      <span v-if="editable" class="blocked">
        <button type="button" class="small" :disabled="saving || !affordable" :aria-describedby="affordable ? undefined : `${noun}-why`" @click="open">
          <Icon name="plus" />Add {{ noun }} · <span class="num">{{ price }}</span>
        </button>
        <span v-if="!affordable" :id="`${noun}-why`" class="blocked-reason">Not enough manna</span>
      </span>
    </header>

    <div v-if="ranks.length" class="list">
      <ItemCard v-for="[id, rank] in ranks" :key="id" :type="look.type" :icon="look.icon" :name="nameOf(id)" :info="optionOf(id)?.info" :source="sourceOf(id)">
        <template #meta>Rank {{ rankName(rank) }}</template>
        <ol :class="columns ? 'ladder' : 'tiers'">
          <li v-for="(step, i) in details(id).slice(0, MAX_LICENCE_RANK)" :key="i" class="rank" :class="{ locked: i >= rank }">
            <span class="numeral">{{ rankName(i + 1) }}</span>
            <div class="rank-body">
              <p v-if="step.name || status(i, rank)" class="rank-head">
                <span v-if="step.name" class="rank-name">{{ step.name }}</span>
                <span v-if="status(i, rank) === 'held'" class="status held"><Icon name="check" />Held</span>
                <span v-else-if="status(i, rank) === 'next'" class="status">Next: <span class="num">{{ price }}</span> manna</span>
                <span v-else-if="status(i, rank) === 'locked'" class="status">Locked</span>
              </p>
              <RulesText v-if="step.html" :html="step.html" />
              <ul v-if="step.unlocks?.length" class="unlocks">
                <li v-for="item in step.unlocks" :key="`${item.kind}:${item.name}`">
                  <Icon :name="item.kind" />
                  <span class="sr-only">{{ item.kind }}:</span>
                  <InfoButton v-if="item.info" :info="item.info" :label="item.name" />
                  <template v-else>{{ item.name }}</template>
                </li>
              </ul>
              <p v-else-if="!step.html" class="dim nothing">Nothing new at this rank.</p>
            </div>
          </li>
        </ol>
        <template v-if="editable" #foot>
          <button type="button" class="small" :disabled="saving" @click="setRank(id, rank - 1)">{{ rank > 1 ? 'Lower rank' : `Remove ${noun}` }}</button>
          <span v-if="rank < MAX_LICENCE_RANK" class="blocked">
            <button type="button" class="small" :disabled="saving || !affordable" :aria-describedby="affordable ? undefined : `${id}-why`" @click="setRank(id, rank + 1)">
              Raise rank · <span class="num">{{ price }}</span>
            </button>
            <span v-if="!affordable" :id="`${id}-why`" class="blocked-reason">Not enough manna</span>
          </span>
        </template>
      </ItemCard>
    </div>
    <p v-else class="empty">No {{ title.toLowerCase() }} yet.</p>

    <p v-if="error" class="notice warn note" role="alert">Not saved: {{ error }}</p>

    <ItemPicker ref="picker" :title="`Add a ${noun} (rank I, ${price} manna)`" :options="offered" :saving="saving" :error="error" @choose="buy" />
  </section>
</template>

<style scoped>
.head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-s) var(--space-m);
}

.head .icon {
  width: 16px;
  height: 16px;
}

.list {
  display: grid;
  gap: var(--space-m);
}

/* Licences: ranks I to III side by side (one column on phones). Talents: stacked tiers, numeral on the left. */
.ladder,
.tiers {
  display: grid;
  gap: var(--space-s);
  margin: 0;
  padding: 0;
  list-style: none;
}

.ladder {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

/* No dark fill: the ranks sit on the card's own surface. */
.rank.locked {
  opacity: 0.6;
}

.numeral {
  font-weight: 800;
}

.locked .numeral {
  color: var(--text-dim);
}

.rank-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px var(--space-s);
  max-width: none;
  margin: 0;
}

.rank-name {
  font-weight: 700;
}

.status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--text-dim);
  font-size: var(--fs-s);
}

.status.held {
  color: var(--text);
}

.status .icon {
  width: 16px;
  height: 16px;
}

.nothing {
  margin: 0;
  font-size: var(--fs-s);
}

/* A licence rank: a thin outlined column (brighter while held), the numeral and its status on one line, then its
   unlocks. */
.ladder .rank {
  border: 1px solid var(--edge);
  border-radius: var(--radius);
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-content: start;
  gap: var(--space-s);
  padding: var(--space-s) var(--space-m) var(--space-m);
}

.ladder .rank.locked {
  border-color: var(--rule);
}

.ladder .numeral {
  font-size: 18px;
  line-height: 1.4;
}

.ladder .rank-body {
  display: contents;
}

.ladder .rank-head {
  min-height: 25px;
}

.ladder .unlocks,
.ladder .nothing {
  grid-column: 1 / -1;
}

.unlocks {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  font-size: var(--fs-s);
  list-style: none;
}

.unlocks li {
  display: flex;
  align-items: center;
  gap: 6px;
}

.unlocks .icon {
  width: 18px;
  height: 18px;
  color: var(--text-dim);
}

/* A talent rank: a big numeral in its own column, then the rank's name and rules, left-aligned. Ranks are parted by a
   thin rule, not boxed. */
.tiers {
  gap: 0;
}

.tiers .rank {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr);
  gap: var(--space-m);
  padding: var(--space-m) 0;
}

.tiers .rank + .rank {
  border-top: 1px solid var(--rule);
}

.tiers .rank:first-child {
  padding-top: 0;
}

.tiers .rank:last-child {
  padding-bottom: 0;
}

.tiers .numeral {
  font-size: 22px;
  text-align: center;
}

.tiers .rank-body {
  display: grid;
  gap: 2px;
}

.note {
  margin: var(--space-m) 0 0;
  font-size: var(--fs-s);
}

@media (max-width: 40rem) {
  .ladder {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
