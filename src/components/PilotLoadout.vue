<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import { loadoutSlots, tagNames, type Item, type Slot } from '../gameData'
import { itemDetails, statLine } from '../itemDetails'
import { itemInfo } from '../info'
import { plainText } from '../rulesText'
import ItemDetails from './ItemDetails.vue'
import ItemPicker from './ItemPicker.vue'
import SlotCard from './SlotCard.vue'

// The pilot's loadout, laid out like COMP/CON's: one armour slot, two weapon slots and three gear slots,
// each a card that shows the item's stats, rules text and tags. Empty slots say so. Each slot only takes
// items of its type, picked from the catalogue (sheet.pilot_gear holds the ids; the slot comes from the type).
const props = defineProps<{
  items: Item[]
  chosen: string[]
  editable: boolean
  save: (ids: string[]) => Promise<string | null>
}>()

const byId = computed(() => new Map(props.items.map((item) => [item.id, item])))
const layout = computed(() => loadoutSlots(props.chosen, (id) => byId.value.get(id)?.type))
const nameOf = (id: string) => byId.value.get(id)?.name ?? id
// Read-only sheets skip empty slots: six "// empty //" cards are a lot of scrolling past nothing.
const shownSlots = computed(() => layout.value.slots.filter((slot) => props.editable || (slot.id && byId.value.get(slot.id))))

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

function unequip(slot: Slot) {
  if (window.confirm(`remove ${nameOf(slot.id!)}?`)) store(slot, null)
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
    <h2 class="sheet-label">loadout<span class="tag"> private</span></h2>

    <ul v-if="shownSlots.length" class="slot-grid">
      <SlotCard
        v-for="slot in shownSlots"
        :key="`${slot.type}-${slot.index}`"
        :title="slot.label"
        :empty="!slot.id || !byId.get(slot.id)"
      >
        <template v-if="editable" #tools>
          <button type="button" :disabled="saving" @click="open(slot)">{{ slot.id ? 'swap' : 'equip' }}</button>
          <button v-if="slot.id" type="button" :disabled="saving" @click="unequip(slot)">remove</button>
        </template>
        <ItemDetails :item="byId.get(slot.id!)!" />
      </SlotCard>
    </ul>
    <p v-else class="dim note">no gear equipped.</p>

    <p v-if="error" class="rose note" role="alert">not saved: {{ error }}</p>
    <p v-if="layout.overflow.length" class="rose note">
      no free slot for: {{ layout.overflow.map(nameOf).join(', ') }}. they're dropped at the next loadout change.
    </p>
    <p v-if="items.length && layout.unknown.length" class="dim note">
      also on file: {{ layout.unknown.length }} item(s) from content packs that aren't loaded.
    </p>

    <ItemPicker
      ref="picker"
      :title="`choose ${target?.label}`"
      :options="options"
      :current="target?.id"
      :saving="saving"
      :error="error"
      @choose="equip"
    />
  </section>
</template>

<style scoped>
.pilot-loadout {
  container-type: inline-size;
}

.note {
  margin: 0.6rem 0 0;
  font-size: 0.8125rem;
}
</style>
