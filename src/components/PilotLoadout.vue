<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import { confirmAction } from '../confirm'
import { loadoutSlots, tagNames, type Item, type Slot } from '../gameData'
import { itemInfo } from '../info'
import { restrictionOf } from '../rules'
import { useRestriction } from '../restriction'
import { itemPick } from '../pickerRows'
import { plural } from '../text'
import ItemDetails from './ItemDetails.vue'
import ItemPicker from './ItemPicker.vue'
import SlotCard from './SlotCard.vue'

// The pilot's loadout: one armour slot, two weapon slots and three gear slots, in three fixed columns (Armour, Weapons,
// Gear) that never reflow because one card is taller than another; each column stacks its slots from the top, and phones
// stack the columns. Empty slots say so, with a button to equip one. Each slot only takes items of its type, picked
// from the catalogue (sheet.pilot_gear holds the ids; the slot comes from the type).
const props = defineProps<{
  items: Item[]
  chosen: string[]
  editable: boolean
  save: (ids: string[]) => Promise<string | null>
}>()

const byId = computed(() => new Map(props.items.map((item) => [item.id, item])))
const layout = computed(() => loadoutSlots(props.chosen, (id) => byId.value.get(id)?.type))
const nameOf = (id: string) => byId.value.get(id)?.name ?? id
// Read-only sheets skip empty slots: six empty states are a lot of scrolling past nothing.
const COLUMNS = [
  { type: 'Armor', title: 'Armour', none: 'No armour.' },
  { type: 'Weapon', title: 'Weapons', none: 'No weapons.' },
  { type: 'Gear', title: 'Gear', none: 'No gear.' },
]
const columns = computed(() =>
  COLUMNS.map((column) => ({ ...column, slots: layout.value.slots.filter((slot) => slot.type === column.type && (props.editable || (slot.id && byId.value.get(slot.id)))) })),
)

// The word for what a slot holds.
const KINDS: Record<string, string> = { Armor: 'armour', Weapon: 'weapon', Gear: 'gear' }
const emptyText = (slot: Slot) => (slot.id && byId.value.get(slot.id) ? '' : `No ${KINDS[slot.type]} yet.`)

// --- Changing a slot: rebuilds the whole list from the slots ---
const error = ref('')
const saving = ref(false)

async function store(target: Slot, id: string | null) {
  const ids = layout.value.slots.map((slot) => (slot.type === target.type && slot.index === target.index ? id : slot.id))
  saving.value = true
  error.value = (await props.save([...ids.filter((x): x is string => !!x), ...layout.value.unknown])) ?? ''
  saving.value = false
  return !error.value
}

async function unequip(slot: Slot) {
  if (await confirmAction(`Remove ${nameOf(slot.id!)}? It leaves the slot empty.`, { confirmLabel: 'Remove gear', danger: true })) store(slot, null)
}

// --- The picker: items of the slot's type ---
const picker = useTemplateRef('picker')
const target = ref<Slot | null>(null)

// HORUS and NHC gear is GM-only (blocked for players), Exotic gear GM-edit-only (blocked outside a GM's edit mode); both listed last.
const reasonFor = useRestriction()
const options = computed(() =>
  props.items
    .filter((item) => item.type === target.value?.type)
    .map((item) => {
      const restriction = restrictionOf(item)
      return { id: item.id, name: item.name, ...itemPick(item, tagNames.value, []), info: () => itemInfo(item), blocked: reasonFor(restriction), exotic: restriction.exotic }
    })
    .sort((a, b) => Number(a.exotic) - Number(b.exotic) || Number(!!a.blocked) - Number(!!b.blocked)),
)

function open(slot: Slot) {
  target.value = slot
  error.value = ''
  picker.value?.open()
}

async function equip(id: string) {
  if (await store(target.value!, id)) picker.value?.close()
}
</script>

<template>
  <section class="pilot-loadout">
    <h3 class="sheet-label">Loadout</h3>

    <div class="columns">
      <div v-for="column in columns" :key="column.type" class="column">
        <h4 class="label">{{ column.title }}</h4>
        <ul v-if="column.slots.length" class="stack">
          <SlotCard v-for="slot in column.slots" :key="`${slot.type}-${slot.index}`" :empty="emptyText(slot)">
            <template #action>
              <button type="button" class="small" :disabled="saving" @click="open(slot)">Add {{ KINDS[slot.type] }}</button>
            </template>
            <ItemDetails :item="byId.get(slot.id!)!">
              <template v-if="editable" #foot>
                <button type="button" class="small" :disabled="saving" @click="open(slot)">Swap</button>
                <button type="button" class="small quiet" :disabled="saving" @click="unequip(slot)">Remove</button>
              </template>
            </ItemDetails>
          </SlotCard>
        </ul>
        <p v-else class="empty">{{ column.none }}</p>
      </div>
    </div>

    <p v-if="error" class="notice warn note" role="alert">Not saved: {{ error }}</p>
    <p v-if="layout.overflow.length" class="notice warn note">
      No free slot for {{ layout.overflow.map(nameOf).join(', ') }}.
    </p>
    <p v-if="items.length && layout.unknown.length" class="dim note">
      {{ plural(layout.unknown.length, 'item') }} not in any loaded pack.
    </p>

    <ItemPicker
      ref="picker"
      :title="`Choose ${target ? KINDS[target.type] : 'pilot gear'}`"
      :options="options"
      :current="target?.id"
      :saving="saving"
      :error="error"
      @choose="equip"
    />
  </section>
</template>

<style scoped>
.columns {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: start;
  gap: var(--space-l);
}

.column {
  min-width: 0;
}

.column .label {
  margin: 0 0 var(--space-s);
  color: var(--text);
}

.stack {
  display: grid;
  gap: var(--space-m);
  margin: 0;
  padding: 0;
  list-style: none;
}

@media (max-width: 64rem) {
  .columns {
    grid-template-columns: minmax(0, 1fr);
  }
}

.note {
  margin: var(--space-m) 0 0;
  font-size: var(--fs-s);
}
</style>
