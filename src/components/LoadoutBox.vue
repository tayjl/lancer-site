<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import { useManufacturers } from '../archive'
import type { Info } from '../info'
import { makerGroup, type PickOption } from '../pickerRows'
import { plainText } from '../rulesText'
import { useRestriction } from '../restriction'
import ItemCard from './ItemCard.vue'
import ItemStats from './ItemStats.vue'
import PickList from './PickList.vue'
import RulesText from './RulesText.vue'

// A loadout section (bionics): the chosen items as item cards (pilot colour, the cost at the right, any stats with
// their symbols, the description), and an edit button that opens a picker to add or remove them.
// Only items from the catalogue can be added. With "limit", each item's cost counts against a cap
// (e.g. bionics against the mod limit), and the picker won't add anything that goes over it. An item with a "price"
// can't be added when it costs more than "balance" (manna left).
type Id = string | number
type Item = { id: Id; name: string; facts?: string[]; source?: string; stats?: { label: string; value: string; icon?: string }[]; description?: string | null; slot?: string; effect?: string; price?: number; cost?: number; retired?: boolean; gmOnly?: boolean; exotic?: boolean; info?: () => Info }

const props = defineProps<{
  title: string
  items: Item[]
  chosen: Id[]
  editable: boolean
  limit?: { label: string; unit: string; max: number }
  balance?: number
  save: (ids: Id[]) => Promise<string | null>
}>()

const dialog = useTemplateRef('dialog')
const filter = ref('')
const error = ref('')
const saving = ref(false)

const byId = computed(() => new Map(props.items.map((item) => [item.id, item])))
const chosenItems = computed(() =>
  props.chosen.map((id) => byId.value.get(id) ?? { id, name: `Unknown item (${id})` }),
)
const used = computed(() => chosenItems.value.reduce((sum, item) => sum + (item.cost ?? 0), 0))

// Retired items stay on sheets that have them, but can't be newly picked. The picker's rows are visual (PickList.vue):
// a box per manufacturer, the slot, the stat bonuses with their symbols, mod points and price; the effect and
// description are only searched. HORUS and NHC biomods are blocked for players, Exotic ones outside a GM's edit mode.
const manufacturers = useManufacturers()
const offered = computed(() => {
  const words = filter.value.trim().toLowerCase().split(/\s+/).filter(Boolean)
  return props.items
    .filter((item) => !item.retired || props.chosen.includes(item.id))
    .map((item): PickOption & { item: Item } => {
      const picked = props.chosen.includes(item.id)
      const group = makerGroup(item.source, manufacturers.value)
      return {
        item,
        id: item.id,
        name: item.name,
        info: item.info,
        picked,
        blocked: picked ? '' : blockedBy(item),
        exotic: item.exotic,
        look: { type: 'pilot', icon: 'generic_item' },
        stats: [
          ...(item.stats ?? []).map((stat) => ({ ...stat, icon: stat.icon ?? null, kind: 'bonus' })),
          ...(item.cost != null ? [{ kind: 'cost', label: 'mod points', value: String(item.cost), icon: null }] : []),
          ...(item.price != null ? [{ kind: 'price', label: 'manna', value: String(item.price), icon: null }] : []),
        ],
        chips: item.slot ? [{ label: item.slot }] : [],
        group,
        search: [item.facts?.join(' '), plainText(item.effect ?? ''), item.description, group.title, group.name].join(' '),
      }
    })
    .filter((row) => words.every((word) => `${row.name} ${row.search}`.toLowerCase().includes(word)))
})

const restricted = useRestriction()
const tooCostly = (item: Item) => !!props.limit && used.value + (item.cost ?? 0) > props.limit.max
// Why an item can't be added, or '' if it can.
const blockedBy = (item: Item) => restricted(item) || (tooCostly(item) ? 'Not enough mod points' : props.balance != null && (item.price ?? 0) > props.balance ? 'Not enough manna' : '')

async function toggle(item: Item) {
  const next = props.chosen.includes(item.id) ? props.chosen.filter((id) => id !== item.id) : [...props.chosen, item.id]
  saving.value = true
  error.value = (await props.save(next)) ?? ''
  saving.value = false
}

function open() {
  filter.value = ''
  error.value = ''
  dialog.value?.showModal()
}
</script>

<template>
  <section class="loadout">
    <header class="head sheet-head">
      <h2 class="sheet-label">{{ title }}</h2>
      <span v-if="limit" class="meter-inline" :class="{ over: used > limit.max }">
        {{ limit.label }} <span class="num">{{ used }}</span> / <span class="num">{{ limit.max }}</span>
      </span>
      <button v-if="editable" type="button" class="small" @click="open">Edit {{ title.toLowerCase() }}</button>
    </header>

    <ul v-if="chosenItems.length" class="slot-grid">
      <li v-for="item in chosenItems" :key="item.id">
        <ItemCard type="pilot" icon="generic_item" :name="item.name" :info="item.info" :meta="item.cost ? String(item.cost) : ''" :unit="limit?.unit">
          <p v-if="item.source || item.slot || item.price != null" class="facts sep"><span v-if="item.source">{{ item.source }}</span><span v-if="item.slot">{{ item.slot }}</span><span v-if="item.price != null">{{ item.price }} manna</span></p>
          <ItemStats v-if="item.stats?.length" :stats="item.stats" />
          <RulesText v-if="item.effect" :html="item.effect" />
          <p v-if="item.description" class="description">{{ item.description }}</p>
        </ItemCard>
      </li>
    </ul>
    <p v-else class="empty">No {{ title.toLowerCase() }} yet.</p>

    <dialog ref="dialog" class="dialog" :aria-label="`Choose ${title.toLowerCase()}`">
      <header class="dialog-head">
        <h2>Choose {{ title.toLowerCase() }}</h2>
        <span v-if="limit" class="meter-inline" :class="{ over: used > limit.max }">
          {{ limit.label }} <span class="num">{{ used }}</span> / <span class="num">{{ limit.max }}</span>
        </span>
        <button type="button" class="small" @click="dialog?.close()">Done</button>
      </header>
      <div class="dialog-bar">
        <label class="field">
          <span>Search</span>
          <input v-model="filter" type="search" autofocus />
        </label>
        <p class="dim count" aria-live="polite"><span class="num">{{ offered.length }}</span> of <span class="num">{{ items.length }}</span></p>
        <p v-if="error" class="notice warn" role="alert">Not saved: {{ error }}</p>
      </div>

      <div class="dialog-body">
        <PickList v-if="offered.length" :options="offered">
          <template #action="{ option }">
            <button v-if="chosen.includes(option.id)" type="button" class="small danger" :disabled="saving" @click="toggle(byId.get(option.id)!)">Remove</button>
            <template v-else>
              <button type="button" class="small" :disabled="saving || !!option.blocked" :aria-describedby="option.blocked ? `why-${option.id}` : undefined" @click="toggle(byId.get(option.id)!)">Add</button>
              <span v-if="option.blocked" :id="`why-${option.id}`" class="pick-reason">{{ option.blocked }}</span>
            </template>
          </template>
        </PickList>
        <p v-else class="empty">{{ filter ? 'Nothing matches that search.' : 'No options.' }}</p>
      </div>
    </dialog>
  </section>
</template>

<style scoped>
.head > * {
  white-space: nowrap;
}

/* Flavour, drawn like lore (dim, italic) so it reads apart from the effect's rules. */
.description {
  margin: 0;
  color: var(--text-dim);
  font-size: var(--fs-s);
  font-style: italic;
}
</style>
