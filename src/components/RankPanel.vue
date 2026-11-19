<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import { sourceOf } from '../gameData'
import { isGm } from '../auth'
import { GM_ONLY_REASON, MAX_LICENCE_RANK, rankName } from '../rules'
import { frameRanges, framePick } from '../pickerRows'
import { useManufacturers } from '../archive'
import { useMechData } from '../mechData'
import type { Info, Unlock } from '../info'
import Icon from './Icon.vue'
import InfoButton from './InfoButton.vue'
import ItemCard from './ItemCard.vue'
import ItemPicker from './ItemPicker.vue'
import RulesText from './RulesText.vue'
import UnlockList from './UnlockList.vue'

// What one rank gives: a talent rank's name and rules text, or the gear a licence rank unlocks. A licence with alternate
// frames also asks which frame it gives ("choice", on the rank that unlocks them).
export type RankStep = { name?: string; html?: string; unlocks?: Unlock[]; choice?: { value: string; options: { value: string; name: string; info: () => Info }[] } }

// Things bought by rank with manna (licences and talents; src/rules.ts): an item card per one held, its rank in the
// header, and what each rank gives ("details", one step per rank); and a button in the heading to buy a new one from
// "options". Licences ("columns") lay ranks I to III side by side like COMP/CON's ladder, each with its unlocks and
// their symbols; talents ("tiers") stack them, a big numeral beside the rank's name and rules. Held ranks are bright,
// later ones dimmed, with "Next: 600 manna" or "Locked" while editable. Each rank costs "price"; buying stops when
// the manna "balance" can't cover it (the button stays, disabled, with the reason beside it). Lowering refunds it.
// An option marked "gmOnly" (HORUS, NHC, Exotic) can't be bought by players (blocked), "GM only", listed last; one marked
// "stale" is only shown while held (a licence that has since become part of another), never offered.
const props = defineProps<{
  title: string
  noun: string
  options: { id: string; name: string; meta?: string; info?: () => Info; gmOnly?: boolean; stale?: boolean }[]
  held: Record<string, number>
  details: (id: string) => RankStep[]
  columns?: boolean
  tiers?: boolean
  price: number
  balance: number
  editable: boolean
  save: (next: Record<string, number>) => Promise<string | null>
  // Saves the frame chosen for a licence (RankStep.choice); resolves to an error message or null.
  choose?: (id: string, value: string) => Promise<string | null>
}>()

const optionOf = (id: string) => props.options.find((option) => option.id === id)
const nameOf = (id: string) => optionOf(id)?.name ?? id
const ranks = computed(() => Object.entries(props.held).filter(([, rank]) => rank > 0))
const affordable = computed(() => props.balance >= props.price)
const restricted = (id: string) => !isGm.value && !!optionOf(id)?.gmOnly
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

// With a frame choice the frames are the radios (or the chosen one), so the unlock list leaves them out.
const gear = (step: RankStep) => (step.choice ? step.unlocks?.filter((unlock) => unlock.kind !== 'frame') : step.unlocks) ?? []
const chosen = (step: RankStep) => step.choice!.options.find((option) => option.value === step.choice!.value) ?? step.choice!.options[0]

async function choose(id: string, value: string) {
  saving.value = true
  error.value = (await props.choose?.(id, value)) ?? ''
  saving.value = false
}

// Rank 0 drops it.
function setRank(id: string, rank: number) {
  const next = { ...props.held, [id]: rank }
  if (rank <= 0) delete next[id]
  store(next)
}

// --- Buying a new one at rank I ---
const picker = useTemplateRef('picker')
// Licences are listed by manufacturer, each with its frame's roles, mounts and key stats (the box says who makes it, so
// "HA Genghis" is just "Genghis"); talents show their summary line and a talent symbol (a talent's ranks are in its full
// information).
const { frames } = useMechData()
const manufacturers = useManufacturers()
const ranges = computed(() => frameRanges(frames.value))
const offered = computed(() =>
  props.options
    .filter((option) => !props.held[option.id] && !option.stale)
    .map((option) => {
      const frame = props.columns ? frames.value.find((f) => f.id === option.id) : undefined
      const blocked = restricted(option.id) ? GM_ONLY_REASON : affordable.value ? '' : 'Not enough manna'
      return frame
        ? { ...option, name: option.name.startsWith(`${frame.source} `) ? option.name.slice(frame.source.length + 1) : option.name, ...framePick(frame, ranges.value, manufacturers.value, false), meta: undefined, blocked }
        : { ...option, look: { type: 'talent' as const, icon: 'talent' }, chips: [{ label: `${MAX_LICENCE_RANK} ranks` }], blocked }
    })
    .sort((a, b) => Number(restricted(a.id)) - Number(restricted(b.id))),
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
              <fieldset v-if="step.choice && editable" class="frame-choice">
                <legend class="label">Frame</legend>
                <label v-for="option in step.choice.options" :key="option.value" class="frame-option">
                  <input type="radio" :name="`${id}-frame`" :checked="step.choice.value === option.value" :disabled="saving" @change="choose(id, option.value)" />
                  <Icon name="frame" />{{ option.name }}
                </label>
              </fieldset>
              <p v-else-if="step.choice" class="frame-chosen">
                <Icon name="frame" /><span class="dim">Chosen frame:</span>
                <InfoButton :label="chosen(step).name" :info="chosen(step).info" />
              </p>
              <UnlockList v-if="gear(step).length" :items="gear(step)" />
              <p v-else-if="!step.html && !step.choice" class="dim nothing">No unlocks.</p>
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

    <ItemPicker ref="picker" :title="`Add ${noun} · ${price} manna`" :options="offered" :saving="saving" :error="error" @choose="buy" />
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
.ladder .frame-choice,
.ladder .frame-chosen,
.ladder .nothing {
  grid-column: 1 / -1;
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

/* The frame a licence gives: real radio inputs, one row each, the name opening its information. */
.frame-choice {
  display: grid;
  gap: var(--space-xs);
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
  font-size: var(--fs-s);
}

.frame-choice legend {
  padding: 0;
  margin-bottom: var(--space-xs);
}

.frame-option {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.frame-option .icon,
.frame-chosen .icon {
  width: 18px;
  height: 18px;
  color: var(--text-dim);
}

.frame-option input {
  flex: none;
  margin: 0;
  accent-color: var(--lilac);
}

.frame-chosen {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: var(--fs-s);
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
