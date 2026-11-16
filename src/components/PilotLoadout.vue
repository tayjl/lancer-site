<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import { confirmAction } from '../confirm'
import { loadoutSlots, tagNames, type Item, type Slot } from '../gameData'
import { itemDetails, statLine } from '../itemDetails'
import { itemInfo } from '../info'
import { plainText } from '../rulesText'
import ItemDetails from './ItemDetails.vue'
import ItemPicker from './ItemPicker.vue'
import SlotCard from './SlotCard.vue'

// The pilot's loadout, laid out like COMP/CON's: one armour slot, two weapon slots and three gear slots, each named
// above its item card. Empty slots say so, with a button to equip one. Each slot only takes items of its type, picked
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
const shownSlots = computed(() => layout.value.slots.filter((slot) => props.editable || (slot.id && byId.value.get(slot.id))))

// Each slot's name over its card ("Armour", "Weapon 1"), and the word for what it holds.
const KINDS: Record<string, string> = { Armor: 'armour', Weapon: 'weapon', Gear: 'gear' }
const slotName = (slot: Slot) => (slot.type === 'Armor' ? 'Armour' : `${slot.type} ${slot.index + 1}`)
const emptyText = (slot: Slot) => (slot.id && byId.value.get(slot.id) ? '' : `No ${KINDS[slot.type]} in this slot.`)

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
  if (await confirmAction(`Remove ${nameOf(slot.id!)}?`, { confirmLabel: 'Remove', danger: true })) store(slot, null)
}

// --- The picker: items of the slot's type ---
const picker = useTemplateRef('picker')
const target = ref<Slot | null>(null)

const options = computed(() =>
  props.items
    .filter((item) => item.type === target.value?.type)
    .map((item) => {
      const details = itemDetails(item, tagNames.value)
      return { id: item.id, name: item.name, meta: statLine(details), text: plainText(details.text), info: () => itemInfo(item) }
    }),
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
    <h2 class="sheet-label">Loadout<span class="private">Private</span></h2>

    <ul v-if="shownSlots.length" class="slot-grid">
      <SlotCard v-for="slot in shownSlots" :key="`${slot.type}-${slot.index}`" :label="slotName(slot)" :empty="emptyText(slot)">
        <template #action>
          <button type="button" class="small" :disabled="saving" @click="open(slot)">Equip {{ KINDS[slot.type] }}</button>
        </template>
        <ItemDetails :item="byId.get(slot.id!)!">
          <template v-if="editable" #foot>
            <button type="button" class="small" :disabled="saving" @click="open(slot)">Swap</button>
            <button type="button" class="small quiet" :disabled="saving" @click="unequip(slot)">Remove</button>
          </template>
        </ItemDetails>
      </SlotCard>
    </ul>
    <p v-else class="empty">No gear equipped.</p>

    <p v-if="error" class="notice warn note" role="alert">Not saved: {{ error }}</p>
    <p v-if="layout.overflow.length" class="notice warn note">
      No free slot for {{ layout.overflow.map(nameOf).join(', ') }}. They're dropped at the next loadout change.
    </p>
    <p v-if="items.length && layout.unknown.length" class="dim note">
      Also on file: {{ layout.unknown.length }} item(s) from content packs that aren't loaded.
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
.note {
  margin: var(--space-m) 0 0;
  font-size: var(--fs-s);
}
</style>
