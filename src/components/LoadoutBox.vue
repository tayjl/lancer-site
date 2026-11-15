<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import type { Info } from '../info'
import InfoButton from './InfoButton.vue'

// A loadout section (gear, bionics): the chosen items as cards, and a small edit button that opens a picker.
// Only items from the catalogue can be added. With "limit", each item's cost counts against a cap
// (e.g. bionics against the mod limit), and the picker won't add anything that goes over it. "addBlocked"
// stops all adding and says why (e.g. "not enough manna").
type Id = string | number
type Item = { id: Id; name: string; type?: string; description?: string | null; cost?: number; retired?: boolean; info?: () => Info }

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
const blockedBy = (item: Item) => (tooCostly(item) ? 'over limit' : props.addBlocked || '')

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
      <h2 class="sheet-label">{{ title }}<span v-if="tag" class="tag">{{ ' ' + tag }}</span></h2>
      <span v-if="limit" class="limit" :class="{ rose: used > limit.max }">{{ limit.label }} {{ used }}/{{ limit.max }}</span>
      <button v-if="editable" type="button" class="small edit" @click="open">edit</button>
    </header>

    <div>
      <ul v-if="chosenItems.length" class="cards">
        <li v-for="item in chosenItems" :key="item.id">
          <span class="name"><InfoButton v-if="item.info" :info="item.info" :label="item.name" /><template v-else>{{ item.name }}</template></span>
          <span v-if="item.type || item.cost != null" class="dim meta">
            {{ item.type }}<template v-if="item.cost != null">{{ item.type ? ', ' : '' }}{{ item.cost }} {{ limit?.unit }}</template>
          </span>
          <span v-if="item.description" class="description">{{ item.description }}</span>
        </li>
      </ul>
      <p v-else class="empty">none installed.<template v-if="editable"> use edit to add some.</template></p>
    </div>

    <dialog ref="dialog" class="dialog" :aria-label="`choose ${title}`">
      <header class="dialog-head">
        <h2>choose {{ title }}</h2>
        <span v-if="limit" class="limit" :class="{ rose: used > limit.max }">{{ limit.label }} {{ used }}/{{ limit.max }}</span>
        <button type="button" class="small" @click="dialog?.close()">done</button>
      </header>
      <div class="dialog-bar">
        <label class="field">
          <span>search</span>
          <input v-model="filter" type="search" autofocus />
        </label>
        <p class="dim count" aria-live="polite">{{ offered.length }} shown</p>
        <p v-if="error" class="rose" role="alert">{{ error }}</p>
      </div>

      <div class="dialog-body">
        <ul v-if="offered.length" class="pick-list">
          <li v-for="item in offered" :key="item.id" :class="{ picked: chosen.includes(item.id), blocked: !chosen.includes(item.id) && blockedBy(item) }">
            <div class="pick-about">
              <span class="pick-name"><InfoButton v-if="item.info" :info="item.info" :label="item.name" /><template v-else>{{ item.name }}</template></span>
              <span class="pick-meta">
                {{ item.type }}<template v-if="item.cost != null">{{ item.type ? ', ' : '' }}{{ item.cost }} {{ limit?.unit }}</template>
              </span>
              <span v-if="item.description" class="pick-text">{{ item.description }}</span>
            </div>
            <div class="pick-action">
              <button v-if="chosen.includes(item.id)" type="button" class="small danger" :disabled="saving" @click="toggle(item)">remove</button>
              <template v-else>
                <button type="button" class="small" :disabled="saving || !!blockedBy(item)" @click="toggle(item)">add</button>
                <span v-if="blockedBy(item)" class="pick-reason">{{ blockedBy(item) }}</span>
              </template>
            </div>
          </li>
        </ul>
        <p v-else class="empty">nothing {{ filter ? 'matches that search' : 'to choose from yet: the content packs may not be imported' }}.</p>
      </div>
    </dialog>
  </section>
</template>

<style scoped>
.head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 1rem;
}

.head > * {
  white-space: nowrap;
}

.limit {
  color: var(--text-dim);
  font-size: 0.8125rem;
}

.edit {
  margin-left: auto;
}

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.cards li {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
  padding: 0.6rem 0.75rem;
  border-left: 2px solid var(--lilac);
  background: var(--raised);
}

.name {
  display: block;
  color: var(--lilac);
  font-weight: 600;
}

.meta {
  display: block;
  font-size: 0.8125rem;
}

.description {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  color: var(--text-dim);
  font: 400 0.875rem/1.45 var(--read);
}

/* --- The picker (dialog and option rows from style.css) --- */
.pick-list li.picked .pick-name::before {
  content: '✓ ' / '';
}
</style>
