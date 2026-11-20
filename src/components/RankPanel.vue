<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import { sourceOf } from '../gameData'
import { MAX_LICENCE_RANK, rankName } from '../rules'
import { useRestriction } from '../restriction'
import { framePick } from '../pickerRows'
import { frameRanges } from '../mechData'
import { makerColour, makerLogo, useManufacturers } from '../archive'
import { chosenFrame, useMechData } from '../mechData'
import { frameArt } from '../images'
import { plural } from '../text'
import type { Info, Unlock } from '../info'
import MechImage from './MechImage.vue'
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
// An option marked "gmOnly" (HORUS, NHC) can't be bought by players (blocked), "GM only"; one marked "exotic" only in a GM's
// edit mode, "GM edit only"; Exotic ones are listed last. One marked
// "stale" is only shown while held (a licence that has since become part of another), never offered.
const props = defineProps<{
  title: string
  noun: string
  options: { id: string; name: string; meta?: string; info?: () => Info; gmOnly?: boolean; exotic?: boolean; stale?: boolean }[]
  held: Record<string, number>
  details: (id: string) => RankStep[]
  columns?: boolean
  tiers?: boolean
  // Compact rows (the pilot file) instead of an item card per one held: the same buying, refunds and frame choice.
  rows?: boolean
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
const reasonFor = useRestriction()
const restricted = (id: string) => reasonFor(optionOf(id) ?? {})
// Licences are frame-purple, talents brown (the --type-* tokens).
const look = computed(() => (props.columns ? { type: 'frame' as const, icon: 'license' } : { type: 'talent' as const, icon: 'talent' }))
// What a rank's box says about it: held, the next one to buy, or locked behind it. Prices only while editable.
const status = (i: number, rank: number) => (i < rank ? 'held' : !props.editable ? '' : i === rank ? 'next' : 'locked')

const error = ref('')
const saving = ref(false)

async function store(next: Record<string, number>) {
  saving.value = true
  try {
    error.value = (await props.save(next)) ?? ''
  } finally {
    saving.value = false
  }
  return !error.value
}

// With a frame choice the frames are the radios (or the chosen one), so the unlock list leaves them out.
const gear = (step: RankStep) => (step.choice ? step.unlocks?.filter((unlock) => unlock.kind !== 'frame') : step.unlocks) ?? []
const chosen = (step: RankStep) => step.choice!.options.find((option) => option.value === step.choice!.value) ?? step.choice!.options[0]

async function choose(id: string, value: string) {
  saving.value = true
  try {
    error.value = (await props.choose?.(id, value)) ?? ''
  } finally {
    saving.value = false
  }
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
// --- Rows: what a licence unlocks across its three ranks, and its maker ---
const stepsOf = computed(() => Object.fromEntries(ranks.value.map(([id]) => [id, props.details(id)])))
const choiceOf = (id: string) => stepsOf.value[id]?.find((step) => step.choice)?.choice
const NOUNS = { frame: 'frame', weapon: 'weapon', system: 'system', mod: 'mod' } as const
const unlockLine = (id: string) => {
  const all = (stepsOf.value[id] ?? []).flatMap((step) => step.unlocks ?? [])
  const parts = (Object.keys(NOUNS) as (keyof typeof NOUNS)[])
    .map((kind) => ({ kind, n: all.filter((u) => u.kind === kind).length }))
    .filter(({ n }) => n)
    .map(({ kind, n }) => (kind === 'frame' && n === 1 ? 'the frame' : plural(n, NOUNS[kind])))
  return parts.length ? `Unlocks ${parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0]}.` : 'Unlocks nothing yet.'
}
const makerOf = (id: string) => manufacturers.value.find((m) => m.id === frames.value.find((f) => f.id === id)?.source)
const chosenOption = (id: string) => choiceOf(id)!.options.find((o) => o.value === choiceOf(id)!.value) ?? choiceOf(id)!.options[0]
// A licence card shows the art of the frame the licence gives (the pilot's choice among its alternates).
const licenceArt = (id: string) => {
  if (!props.columns) return null
  const original = frames.value.find((f) => f.id === id)
  if (!original) return null
  const choice = props.details(id).find((step) => step.choice)?.choice?.value
  return frameArt(chosenFrame(original, frames.value, choice ? { [id]: choice } : undefined), frames.value)
}
// The licence's maker logo, for the picture's placeholder when its frame has no art.
const licenceLogo = (id: string) => makerLogo(manufacturers.value.find((m) => m.id === frames.value.find((f) => f.id === id)?.source))
const offered = computed(() =>
  props.options
    .filter((option) => !props.held[option.id] && !option.stale)
    .map((option) => {
      const frame = props.columns ? frames.value.find((f) => f.id === option.id) : undefined
      const blocked = restricted(option.id) || (affordable.value ? '' : 'Not enough manna')
      return frame
        ? { ...option, name: option.name.startsWith(`${frame.source} `) ? option.name.slice(frame.source.length + 1) : option.name, ...framePick(frame, ranges.value, manufacturers.value, false, frames.value), meta: undefined, blocked }
        : { ...option, look: { type: 'talent' as const, icon: 'talent' }, chips: [{ label: `${MAX_LICENCE_RANK} ranks` }], blocked }
    })
    .sort((a, b) => Number(!!optionOf(a.id)?.exotic) - Number(!!optionOf(b.id)?.exotic) || Number(!!restricted(a.id)) - Number(!!restricted(b.id))),
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
      <h2 class="sheet-label">{{ title }}</h2>
      <slot name="summary" />
      <span v-if="editable" class="blocked">
        <button type="button" class="small" :disabled="saving || !affordable" :aria-describedby="affordable ? undefined : `${noun}-why`" @click="open">
          <Icon name="plus" />Add {{ noun }} · <span class="num">{{ price }}</span>
        </button>
        <span v-if="!affordable" :id="`${noun}-why`" class="blocked-reason">Not enough manna</span>
      </span>
    </header>

    <ul v-if="ranks.length && rows" class="rows">
      <li v-for="[id, rank] in ranks" :key="id" class="row" :class="columns ? 'lic' : 'tal'" :style="columns ? { '--mf': makerColour(makerOf(id)) } : undefined">
        <MechImage v-if="columns" class="thumb" size="pick" :art="licenceArt(id)" :logo="licenceLogo(id)" :art-alt="`${nameOf(id)} frame`" />
        <span v-else class="tile"><Icon name="talent" /></span>
        <div class="about">
          <p class="row-name">
            <InfoButton v-if="optionOf(id)?.info" :label="nameOf(id)" :info="optionOf(id)!.info" />
            <template v-else>{{ nameOf(id) }}</template>
            <span v-if="columns && makerOf(id)" class="mf-code"><Icon v-if="makerLogo(makerOf(id))" :src="makerLogo(makerOf(id))!" />{{ makerOf(id)!.id }}</span>
          </p>
          <p class="row-sub">{{ columns ? unlockLine(id) : optionOf(id)?.meta }}</p>
          <fieldset v-if="editable && choiceOf(id)" class="frame-choice">
            <legend class="label">Frame</legend>
            <label v-for="option in choiceOf(id)!.options" :key="option.value" class="frame-option">
              <input type="radio" :name="`${id}-frame`" :checked="choiceOf(id)!.value === option.value" :disabled="saving" @change="choose(id, option.value)" />
              <Icon name="frame" />{{ option.name }}
            </label>
          </fieldset>
          <p v-else-if="choiceOf(id)" class="frame-chosen">
            <Icon name="frame" /><span class="dim">Chosen frame:</span>
            <InfoButton :label="chosenOption(id).name" :info="chosenOption(id).info" />
          </p>
        </div>
        <span class="rankpips" role="img" :aria-label="`Rank ${rankName(rank)} of ${rankName(MAX_LICENCE_RANK)}`">
          <span v-for="n in MAX_LICENCE_RANK" :key="n" class="rp" :class="{ held: n <= rank }">{{ rankName(n) }}</span>
        </span>
        <div v-if="editable" class="row-actions">
          <button type="button" class="small" :disabled="saving" @click="setRank(id, rank - 1)">{{ rank > 1 ? 'Lower rank' : `Remove ${noun}` }}</button>
          <span v-if="rank < MAX_LICENCE_RANK" class="blocked">
            <button type="button" class="small" :disabled="saving || !affordable" :aria-describedby="affordable ? undefined : `${id}-why`" @click="setRank(id, rank + 1)">
              Raise rank · <span class="num">{{ price }}</span>
            </button>
            <span v-if="!affordable" :id="`${id}-why`" class="blocked-reason">Not enough manna</span>
          </span>
        </div>
      </li>
    </ul>
    <div v-else-if="ranks.length" class="list">
      <ItemCard v-for="[id, rank] in ranks" :key="id" :type="look.type" :icon="look.icon" :name="nameOf(id)" :info="optionOf(id)?.info" :source="sourceOf(id)">
        <template #meta>Rank {{ rankName(rank) }}</template>
        <div class="rank-wrap" :class="{ 'with-art': columns }">
          <MechImage v-if="columns" size="licence" :art="licenceArt(id)" :logo="licenceLogo(id)" :art-alt="`${nameOf(id)} frame`" />
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
        </div>
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
.head .icon {
  width: 16px;
  height: 16px;
}

.list {
  display: grid;
  gap: var(--space-m);
}

/* A licence's frame art beside its ladder (above it on phones); it's whole and never cropped. */
.with-art {
  display: grid;
  grid-template-columns: 11rem minmax(0, 1fr);
  align-items: start;
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

/* --- Rows: parted by a thin rule, on the page's own surface --- */
.rows {
  margin: 0;
  padding: 0;
  list-style: none;
}

.row {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-s) var(--space-m);
  padding: var(--space-m) 0;
  border-top: 1px solid var(--rule);
}

.row:last-child {
  border-bottom: 1px solid var(--rule);
}

.row.tal {
  grid-template-columns: 40px minmax(0, 1fr) auto;
}

/* The maker's colour is only the picture's thin top border (and its logo). */
.row .thumb {
  height: 54px;
  border: 1px solid var(--rule);
  border-top: 3px solid var(--mf, var(--rule));
  border-radius: 2px;
  background: var(--raised);
}

.tile {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 2px;
  background: var(--type-talent);
  color: #fff;
}

.tile .icon {
  width: 22px;
  height: 22px;
}

.row p {
  max-width: none;
  margin: 0;
}

.row-name {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-xs) var(--space-s);
  font-size: 17px;
  font-weight: 700;
  line-height: 1.2;
}

.mf-code {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--text-dim);
  font-size: var(--fs-xs);
  font-weight: 700;
  letter-spacing: 0.06em;
}

.mf-code .icon {
  width: 18px;
  height: 18px;
  color: var(--mf);
}

.row-sub {
  margin-top: 2px;
  color: var(--text-dim);
  font-size: var(--fs-s);
}

.about .frame-choice,
.about .frame-chosen {
  margin-top: var(--space-s);
}

/* Held ranks are filled; the numeral is always shown, so it never relies on fill alone. */
.rankpips {
  display: inline-flex;
  gap: 4px;
}

.rp {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  border: 1px solid var(--rule);
  border-radius: 2px;
  color: var(--text-dim);
  font: 700 var(--fs-xs) / 1 var(--mono);
}

.rp.held {
  border-color: var(--text);
  background: var(--text);
  color: var(--void);
}

.row-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  grid-column: 2 / -1;
  gap: var(--space-s);
}

@media (max-width: 40rem) {
  .row {
    grid-template-columns: 56px minmax(0, 1fr);
  }

  .row.tal {
    grid-template-columns: 40px minmax(0, 1fr);
  }

  .row .rankpips {
    grid-column: 2;
  }

  .row .thumb {
    height: 42px;
  }

  .ladder {
    grid-template-columns: minmax(0, 1fr);
  }

  .with-art {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
