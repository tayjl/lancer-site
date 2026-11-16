<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import type { Info } from '../info'
import InfoButton from './InfoButton.vue'
import ItemCard from './ItemCard.vue'
import ItemStats from './ItemStats.vue'

// A loadout section (bionics): the chosen items as item cards (pilot colour, the cost at the right, any stats with
// their symbols, the description), and an edit button that opens a picker to add or remove them.
// Only items from the catalogue can be added. With "limit", each item's cost counts against a cap
// (e.g. bionics against the mod limit), and the picker won't add anything that goes over it. "addBlocked"
// stops all adding and says why (e.g. "not enough manna").
type Id = string | number
type Item = { id: Id; name: string; type?: string; stats?: { label: string; value: string; icon?: string }[]; description?: string | null; cost?: number; retired?: boolean; info?: () => Info }

const props = defineProps<{
  title: string
  items: Item[]
  chosen: Id[]
  editable: boolean
  tag?: string
  limit?: { label: string; unit: string; max: number }
  addBlocked?: string
  save: (ids: Id[]) => Promise<string | null>
}>()

const dialog = useTemplateRef('dialog')
const filter = ref('')
const error = ref('')
const saving = ref(false)

const byId = computed(() => new Map(props.items.map((item) => [item.id, item])))
const chosenItems = computed(() =>
  props.chosen.map((id) => byId.value.get(id) ?? { id, name: `unknown item (${id})`, description: 'its content pack may have been removed.' }),
)
const used = computed(() => chosenItems.value.reduce((sum, item) => sum + (item.cost ?? 0), 0))

// Retired items stay on sheets that have them, but can't be newly picked.
const offered = computed(() => {
  const words = filter.value.trim().toLowerCase()
  return props.items.filter(
    (item) =>
      (!item.retired || props.chosen.includes(item.id)) &&
      (!words || `${item.name} ${item.type ?? ''}`.toLowerCase().includes(words)),
  )
})

const tooCostly = (item: Item) => !!props.limit && used.value + (item.cost ?? 0) > props.limit.max
// Why an item can't be added, or '' if it can.
const blockedBy = (item: Item) => (tooCostly(item) ? 'Over the limit' : props.addBlocked || '')

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
      <h2 class="sheet-label">{{ title }}<span v-if="tag" class="private">{{ tag }}</span></h2>
      <span v-if="limit" class="meter-inline" :class="{ over: used > limit.max }">
        {{ limit.label }} <span class="num">{{ used }}</span> / <span class="num">{{ limit.max }}</span>
      </span>
      <button v-if="editable" type="button" class="small" @click="open">Edit {{ title.toLowerCase() }}</button>
    </header>

    <ul v-if="chosenItems.length" class="slot-grid">
      <li v-for="item in chosenItems" :key="item.id">
        <ItemCard type="pilot" icon="generic_item" :name="item.name" :info="item.info" :meta="item.cost ? String(item.cost) : ''" :unit="limit?.unit">
          <ItemStats v-if="item.stats?.length" :stats="item.stats" />
          <p v-if="item.description" class="description">{{ item.description }}</p>
        </ItemCard>
      </li>
    </ul>
    <p v-else class="empty">No {{ title.toLowerCase() }} installed.</p>

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
        <p class="dim count" aria-live="polite">{{ offered.length }} shown</p>
        <p v-if="error" class="notice warn" role="alert">Not saved: {{ error }}</p>
      </div>

      <div class="dialog-body">
        <ul v-if="offered.length" class="pick-list">
          <li v-for="item in offered" :key="item.id" :class="{ picked: chosen.includes(item.id), blocked: !chosen.includes(item.id) && blockedBy(item) }">
            <div class="pick-about">
              <span class="pick-name"><InfoButton v-if="item.info" :info="item.info" :label="item.name" /><template v-else>{{ item.name }}</template></span>
              <span class="pick-meta sep">
                <span v-if="item.type">{{ item.type }}</span>
                <span v-if="item.cost != null">{{ item.cost }} {{ limit?.unit }}</span>
              </span>
              <span v-if="item.description" class="pick-text">{{ item.description }}</span>
            </div>
            <div class="pick-action">
              <button v-if="chosen.includes(item.id)" type="button" class="small danger" :disabled="saving" @click="toggle(item)">Remove</button>
              <template v-else>
                <button type="button" class="small" :disabled="saving || !!blockedBy(item)" :aria-describedby="blockedBy(item) ? `why-${item.id}` : undefined" @click="toggle(item)">Add</button>
                <span v-if="blockedBy(item)" :id="`why-${item.id}`" class="pick-reason">{{ blockedBy(item) }}</span>
              </template>
            </div>
          </li>
        </ul>
        <p v-else class="empty">Nothing {{ filter ? 'matches that search' : 'to choose from yet: the content packs may not be imported' }}.</p>
      </div>
    </dialog>
  </section>
</template>

<style scoped>
.head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-s) var(--space-m);
}

.head > * {
  white-space: nowrap;
}

.description {
  margin: 0;
  font-size: var(--fs-m);
}

/* --- The picker (dialog and option rows from style.css) --- */
.pick-list li.picked .pick-name::before {
  content: '✓ ' / '';
}
</style>
