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
      <button v-if="editable" type="button" class="edit" @click="open">edit</button>
    </header>

    <div class="body">
      <ul v-if="chosenItems.length" class="cards">
        <li v-for="item in chosenItems" :key="item.id">
          <span class="name"><InfoButton v-if="item.info" :info="item.info" :label="item.name" /><template v-else>{{ item.name }}</template></span>
          <span v-if="item.type || item.cost != null" class="dim meta">
            {{ item.type }}<template v-if="item.cost != null">{{ item.type ? ', ' : '' }}{{ item.cost }} {{ limit?.unit }}</template>
          </span>
          <span v-if="item.description" class="description">{{ item.description }}</span>
        </li>
      </ul>
      <p v-else class="dim empty">none installed.<template v-if="editable"> use edit to add some.</template></p>
    </div>

    <dialog ref="dialog" class="picker" :aria-label="`choose ${title}`">
      <header class="picker-head">
        <h3>choose {{ title }}</h3>
        <span v-if="limit" class="limit">{{ limit.label }} {{ used }}/{{ limit.max }}</span>
        <button type="button" @click="dialog?.close()">done</button>
      </header>
      <input v-model="filter" type="text" :aria-label="`search ${title}`" placeholder="search..." />
      <p v-if="error" class="rose" role="alert">{{ error }}</p>

      <ul v-if="offered.length" class="options">
        <li v-for="item in offered" :key="item.id" :class="{ picked: chosen.includes(item.id) }">
          <div>
            <span class="name"><InfoButton v-if="item.info" :info="item.info" :label="item.name" /><template v-else>{{ item.name }}</template></span>
            <span class="dim meta">
              {{ item.type }}<template v-if="item.cost != null">{{ item.type ? ', ' : '' }}{{ item.cost }} {{ limit?.unit }}</template>
            </span>
            <span v-if="item.description" class="description">{{ item.description }}</span>
          </div>
          <button v-if="chosen.includes(item.id)" type="button" :disabled="saving" @click="toggle(item)">remove</button>
          <button v-else type="button" :disabled="saving || tooCostly(item) || !!addBlocked" @click="toggle(item)">
            {{ tooCostly(item) ? 'over limit' : addBlocked || 'add' }}
          </button>
        </li>
      </ul>
      <p v-else class="dim">nothing to choose from{{ filter ? ' with that search' : ' yet: the content packs may not be imported' }}.</p>
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
  padding: 0;
  font-size: 0.8125rem;
}

.body {
  padding: 0.75rem;
  border: 1px solid var(--rule);
}

.empty {
  margin: 0;
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
  background: var(--panel);
}

.name {
  display: block;
  color: var(--lilac);
  font-weight: 600;
}

.meta {
  display: block;
  font-size: 0.75rem;
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

/* --- The picker --- */
.picker {
  width: min(44rem, calc(100vw - 2rem));
  max-height: 80vh;
  padding: 1rem;
  border: 1px solid var(--lilac);
  background: var(--void);
  color: var(--text);
  font: 400 0.9375rem/1.6 var(--mono);
}

.picker::backdrop {
  background: rgb(0 0 0 / 0.6);
}

.picker-head {
  display: flex;
  align-items: baseline;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.picker-head h3 {
  margin: 0;
  font-size: 1rem;
}

.picker-head button {
  margin-left: auto;
  padding: 0;
  font-size: 0.875rem;
}

.picker p {
  margin: 0.75rem 0 0;
}

.options {
  margin: 0.75rem 0 0;
  padding: 0;
  list-style: none;
}

.options li {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.6rem 0;
  border-top: 1px solid var(--rule);
}

.options li.picked .name::before {
  content: '✓ ' / '';
}

.options > li > button {
  flex-shrink: 0;
  padding: 0;
  font-size: 0.8125rem;
}

.options > li > button:disabled {
  color: var(--text-dim);
  cursor: default;
}
</style>
