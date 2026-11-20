<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, type Ref } from 'vue'
import { confirmAction } from '../confirm'
import { equippedGear, loadoutSlots, tagNames, type Item, type Slot } from '../gameData'
import { itemInfo, showInfo } from '../info'
import { DAMAGE_CHOICES, equipmentDetails, variableDamage } from '../equipment'
import { itemCard } from '../itemDetails'
import type { MiscItem, OwnedGear, Sheet } from '../myPilot'
import { formatAmount, freeGear, gearPrice, restrictionOf } from '../rules'
import { useRestriction } from '../restriction'
import { itemPick, type PickOption } from '../pickerRows'
import { NOTE_MAX } from '../itemNotes'
import { capitalise, plural } from '../text'
import Icon from './Icon.vue'
import ItemDetails from './ItemDetails.vue'
import ItemNote from './ItemNote.vue'
import ItemPicker from './ItemPicker.vue'
import SlotCard from './SlotCard.vue'

// The pilot's loadout: one armour slot, two weapon slots and three gear slots, in a three-column grid (Armour, Weapon,
// Weapon, then Gear, Gear, Gear); phones get one column in the same order. Pilot gear is owned once bought
// (sheet.owned_gear, one entry per copy with its own key and description) and equipped by key (sheet.equipped_gear); each
// type's slots fill in equipped order.
// An approved pilot ("live" is its approved sheet) equips and unequips its owned items at once, with no approval ("equip",
// the whole equipped list); buying ("Buy item") and descriptions go into the open change. A pilot never approved ("live"
// null) is still being built: a slot picks from the whole catalogue and removing takes the item off, and its first full
// loadout is free (rules.ts freeGear).
const props = defineProps<{
  items: Item[]
  owned: OwnedGear[]
  equipped: string[]
  live: Sheet | null
  canEquip: boolean
  editable: boolean
  // A GM's edit mode: owned items can be taken off.
  canRemove: boolean
  balance: number
  equip: (keys: string[]) => Promise<string | null>
  saveOwned: (owned: OwnedGear[], equipped?: string[]) => Promise<string | null>
  // A GM's free-text items (Misc, under Stowed); added and removed only in a GM's edit mode ("canRemove").
  misc: MiscItem[]
  saveMisc: (items: MiscItem[]) => Promise<string | null>
}>()

const byId = computed(() => new Map(props.items.map((item) => [item.id, item])))
const typeOf = (id: string) => byId.value.get(id)?.type
const nameOf = (id: string) => byId.value.get(id)?.name ?? id
const building = computed(() => !props.live)

// The word for what a slot holds, and for several.
const KINDS: Record<string, string> = { Armor: 'armour', Weapon: 'weapon', Gear: 'gear' }
const KINDS_PLURAL: Record<string, string> = { Armor: 'armour', Weapon: 'weapons', Gear: 'gear' }
// An owned item that fits a slot: a known Armor, Weapon or Gear item (equip_pilot_gear refuses anything else).
const fits = (entry: OwnedGear) => !!KINDS[typeOf(entry.id) ?? '']

const equippedEntries = computed(() => equippedGear({ owned_gear: props.owned, equipped_gear: props.equipped }))
const layout = computed(() => loadoutSlots(equippedEntries.value.map((entry) => entry.id), typeOf))
// The Nth slot of a type holds the Nth equipped entry of that type.
const entryAt = (slot: Slot) => equippedEntries.value.filter((entry) => typeOf(entry.id) === slot.type)[slot.index]
// Read-only sheets skip empty slots: six empty states are a lot of scrolling past nothing.
const slots = computed(() => layout.value.slots.filter((slot) => props.canEquip || (slot.id && byId.value.get(slot.id))))
// Types with more equipped than slots (sheets from before the slots).
const overflowTypes = computed(() => [...new Set(layout.value.overflow.map((id) => typeOf(id) ?? ''))])
const emptyText = (slot: Slot) => (slot.id && byId.value.get(slot.id) ? '' : `No ${KINDS[slot.type]} yet.`)

// Owned items not equipped (known ones; unknown ones are counted in the note under the slots).
const spare = computed(() => props.owned.filter((entry) => !props.equipped.includes(entry.key) && byId.value.has(entry.id)))
const isEquipped = (entry: OwnedGear) => props.equipped.includes(entry.key)
// Stowed, under the slots and folded by default: an approved pilot's owned items that aren't equipped, a plain text row
// each under Armour, Weapons or Gear (Gear also takes other types and items in no loaded pack), then the GM's Misc items.
// A row opens in place: its description, price, Info and, in a GM's edit mode, Remove.
const CATEGORIES = [
  { type: 'Armor', title: 'Armour' },
  { type: 'Weapon', title: 'Weapons' },
  { type: 'Gear', title: 'Gear' },
]
const categoryOf = (entry: OwnedGear) => (fits(entry) ? typeOf(entry.id) : 'Gear')
const stowed = computed(() => props.owned.filter((entry) => !isEquipped(entry)))
const stowedGroups = computed(() =>
  CATEGORIES.map((category) => ({ ...category, entries: stowed.value.filter((entry) => categoryOf(entry) === category.type) })).filter((group) => group.entries.length),
)
const iconOf = (entry: OwnedGear) => (byId.value.has(entry.id) ? itemCard(byId.value.get(entry.id)!).icon : 'generic_item')
const rowName = (entry: OwnedGear) => byId.value.get(entry.id)?.name ?? `Unknown item (${entry.id})`
// The dim text after a row's name: a bought item's price, else its description.
const rowHint = (entry: OwnedGear) => (bought(entry) ? `Bought in this change · ${priceText(entry)}` : entry.notes ? `"${entry.notes}"` : '')

const stowOpen = ref(false)
const stowToggle = useTemplateRef('stowToggle')
// The one row opened in place (an owned key or a misc key).
const expanded = ref('')
function toggleRow(key: string) {
  expanded.value = expanded.value === key ? '' : key
  error.value = ''
  failedKey.value = ''
}
// After a remove its row is gone, so focus goes to the toggle rather than the page body.
function afterRemove() {
  expanded.value = ''
  stowToggle.value?.focus()
}

// --- Misc items: a GM in edit mode adds one (a name, an optional description) or removes one ---
const MISC_NAME_MAX = 60
const adding = ref(false)
const miscName = ref('')
const miscNotes = ref('')
const miscError = ref('')
const miscSaveError = ref('')

// The form takes the add button's place, so focus moves into it and back.
const miscInput = useTemplateRef('miscInput')
const miscAdd = useTemplateRef('miscAdd')

function startMisc() {
  miscName.value = ''
  miscNotes.value = ''
  miscError.value = ''
  miscSaveError.value = ''
  adding.value = true
  nextTick(() => miscInput.value?.focus())
}

function stopMisc() {
  adding.value = false
  nextTick(() => miscAdd.value?.focus())
}

async function addMisc() {
  const name = miscName.value.trim()
  miscError.value = !name ? 'A misc item needs a name.' : name.length > MISC_NAME_MAX ? `Name must be ${MISC_NAME_MAX} characters or fewer.` : ''
  if (miscError.value) return miscInput.value?.focus()
  const notes = miscNotes.value.trim().slice(0, NOTE_MAX) || undefined
  if (await run(() => props.saveMisc([...props.misc, { key: crypto.randomUUID(), name, notes }]), miscSaveError)) stopMisc()
}

async function removeMisc(item: MiscItem) {
  if (!(await confirmAction(`${item.name} will be taken off this pilot. This can't be undone.`, { confirmLabel: 'Remove item', danger: true }))) return
  if (await run(() => props.saveMisc(props.misc.filter((other) => other.key !== item.key)), error, item.key)) afterRemove()
}
const unknownCount = computed(() => props.owned.filter((entry) => !byId.value.has(entry.id)).length)
// Bought in the open change: not on the approved sheet yet, so it can't be equipped.
const bought = (entry: OwnedGear) => !!props.live && !props.live.owned_gear?.some((was) => was.key === entry.key)
const free = computed(() => freeGear(props.owned, typeOf, props.live))
const priceOf = (id: string) => (byId.value.has(id) ? gearPrice(byId.value.get(id)!) : 0)
// The price line on a card: while building, whether it's part of the free loadout; afterwards, only for items bought in the change.
const priceText = (entry: OwnedGear) =>
  building.value ? (free.value[props.owned.indexOf(entry)] ? 'Free' : `${formatAmount(priceOf(entry.id))} manna`) : bought(entry) ? `${formatAmount(priceOf(entry.id))} manna` : ''

// --- Saving: every change goes through run(), which shows its error under the slots, or in the picker for a choice there ---
const error = ref('')
const pickerError = ref('')
const saving = ref(false)
// The stowed or misc item a failed remove was for: its error shows in its row, not under the slots.
const failedKey = ref('')

async function run(save: () => Promise<string | null>, shown: Ref<string> = error, key = '') {
  saving.value = true
  failedKey.value = key
  shown.value = ''
  try {
    shown.value = (await save()) ?? ''
  } catch (thrown) {
    shown.value = thrown instanceof Error ? thrown.message : String(thrown)
  } finally {
    saving.value = false
  }
  return !shown.value
}

// The equipped keys with the slot's key replaced by "key" (or taken out with null; added when the slot is empty).
function keysWith(slot: Slot, key: string | null) {
  const current = entryAt(slot)?.key
  const keys = equippedEntries.value.map((entry) => entry.key)
  const next = current ? keys.map((k) => (k === current ? key : k)) : [...keys, key]
  return next.filter((k): k is string => !!k)
}
// What an approved pilot sends: only keys that fit a slot (sheets from before the inventory can have unknown items equipped).
const equipKeys = (keys: string[]) => keys.filter((key) => props.owned.some((entry) => entry.key === key && fits(entry)))

const withNotes = (key: string, text: string) => props.owned.map((entry) => (entry.key === key ? { ...entry, notes: text.slice(0, NOTE_MAX) || undefined } : entry))
const saveNote = (key: string) => (text: string) => props.saveOwned(withNotes(key, text))
// A Variable weapon shows its chosen damage type (Variable until one is chosen).
const shown = (entry: OwnedGear) => (entry.damageType ? equipmentDetails(byId.value.get(entry.id)!, {}, [], { damageType: entry.damageType }) : byId.value.get(entry.id)!)
const isVariable = (entry: OwnedGear) => typeOf(entry.id) === 'Weapon' && variableDamage(byId.value.get(entry.id)!)
const setDamage = (key: string, damageType: string) => run(() => props.saveOwned(props.owned.map((entry) => (entry.key === key ? { ...entry, damageType } : entry))))

// Remove on an equipped item: back to owned for an approved pilot; off the sheet while building.
async function unequip(slot: Slot) {
  const entry = entryAt(slot)!
  if (!building.value) return run(() => props.equip(equipKeys(keysWith(slot, null))))
  if (await confirmAction(`${nameOf(entry.id)} will be taken off this pilot.`, { confirmLabel: 'Remove item', danger: true }))
    run(() => props.saveOwned(props.owned.filter((o) => o.key !== entry.key), keysWith(slot, null)))
}

async function removeOwned(entry: OwnedGear) {
  if (!(await confirmAction(`${nameOf(entry.id)} will be taken off this pilot. This can't be undone.`, { confirmLabel: 'Remove item', danger: true }))) return
  if (await run(() => props.saveOwned(props.owned.filter((o) => o.key !== entry.key)), error, entry.key)) afterRemove()
}

// --- The picker: a slot's options (owned items of its type, or the catalogue while building), or everything to buy ---
const picker = useTemplateRef('picker')
const target = ref<Slot | null>(null)
const buying = ref(false)

// HORUS and NHC gear is GM-only (blocked for players), Exotic gear GM-edit-only (blocked outside a GM's edit mode); both listed last.
const reasonFor = useRestriction()
const catalogueRow = (item: Item) => {
  const restriction = restrictionOf(item)
  return { id: item.id, name: item.name, ...itemPick(item, tagNames.value, []), info: () => itemInfo(item), blocked: reasonFor(restriction), exotic: restriction.exotic }
}
const byRestriction = (a: PickOption, b: PickOption) => Number(!!a.exotic) - Number(!!b.exotic) || Number(!!a.blocked) - Number(!!b.blocked)
// Each row shows its price the way the biomod picker does (LoadoutBox.vue).
const priceStat = (free: boolean, price: number) => (free ? { kind: 'price', label: '', value: 'Free', icon: null } : { kind: 'price', label: 'manna', value: String(price), icon: null })
// What a list of owned gear costs (what mannaSpent counts for it).
const gearCost = (list: OwnedGear[]) => {
  const flags = freeGear(list, typeOf, props.live)
  return list.reduce((total, entry, n) => total + (flags[n] ? 0 : priceOf(entry.id)), 0)
}

const options = computed((): PickOption[] => {
  if (buying.value)
    return props.items
      .map((item) => {
        const row = catalogueRow(item)
        const price = gearPrice(item)
        return { ...row, stats: [...(row.stats ?? []), priceStat(false, price)], blocked: row.blocked || (price > props.balance ? 'Not enough manna' : '') }
      })
      .sort(byRestriction)
  const slot = target.value
  if (!slot) return []
  // While building: free while the starting loadout has room, else its price (a swapped item's cost comes back).
  if (building.value) {
    const old = entryAt(slot)?.key
    const kept = props.owned.filter((o) => o.key !== old)
    const before = gearCost(props.owned)
    return props.items
      .filter((item) => item.type === slot.type)
      .map((item) => {
        const row = catalogueRow(item)
        const after = [...kept, { key: '', id: item.id }]
        const free = freeGear(after, typeOf, null)[after.length - 1]
        return { ...row, stats: [...(row.stats ?? []), priceStat(free, gearPrice(item))], blocked: row.blocked || (gearCost(after) - before > props.balance ? 'Not enough manna' : '') }
      })
      .sort(byRestriction)
  }
  return spare.value
    .filter((entry) => typeOf(entry.id) === slot.type)
    .map((entry) => {
      const item = byId.value.get(entry.id)!
      return { id: entry.key, name: item.name, ...itemPick(item, tagNames.value, []), meta: entry.notes, info: () => itemInfo(item), blocked: bought(entry) ? 'Needs GM approval' : '' }
    })
    .sort(byRestriction)
})

const pickerTitle = computed(() => (buying.value ? 'Buy item' : `Choose ${target.value ? KINDS[target.value.type] : 'pilot gear'}`))
const pickerEmpty = computed(() => (!buying.value && !building.value && target.value ? `No unequipped ${KINDS_PLURAL[target.value.type]}.` : undefined))

function open(slot: Slot | null) {
  target.value = slot
  buying.value = !slot
  pickerError.value = ''
  picker.value?.open()
}

// Buying adds a new copy, unequipped. While building, a slot's item is a new copy too (a swapped one leaves the sheet).
// An approved pilot's slot equips the chosen owned key.
async function choose(id: string) {
  const slot = target.value
  let save: () => Promise<string | null>
  if (buying.value) save = () => props.saveOwned([...props.owned, { key: crypto.randomUUID(), id }])
  else if (!slot) return
  else if (building.value) {
    const key = crypto.randomUUID()
    const old = entryAt(slot)?.key
    save = () => props.saveOwned([...props.owned.filter((o) => o.key !== old), { key, id }], keysWith(slot, key))
  } else save = () => props.equip(equipKeys(keysWith(slot, id)))
  if (await run(save, pickerError)) picker.value?.close()
}
</script>

<template>
  <section class="pilot-loadout">
    <header class="head sheet-head">
      <h3 class="sheet-label">Loadout</h3>
      <button v-if="editable && live" type="button" class="small" :disabled="saving" @click="open(null)">Buy item</button>
    </header>

    <ul v-if="slots.length" class="slots">
      <SlotCard v-for="slot in slots" :key="`${slot.type}-${slot.index}`" :class="{ gear: slot.type === 'Gear' }" :label="capitalise(KINDS[slot.type])" :empty="emptyText(slot)">
        <template #action>
          <button type="button" class="small" :disabled="saving" @click="open(slot)">Add {{ KINDS[slot.type] }}</button>
        </template>
        <ItemDetails :item="shown(entryAt(slot))">
          <p v-if="priceText(entryAt(slot))" class="facts">{{ priceText(entryAt(slot)) }}</p>
          <ItemNote :text="entryAt(slot).notes" :editable="editable" :save="saveNote(entryAt(slot).key)" />
          <label v-if="editable && isVariable(entryAt(slot))" class="field"><span>Damage type</span><select aria-label="damage type" :value="entryAt(slot).damageType ?? ''" :disabled="saving" @change="setDamage(entryAt(slot).key, ($event.target as HTMLSelectElement).value)">
            <option v-if="!entryAt(slot).damageType" value="" disabled>Choose…</option>
            <option v-for="type in DAMAGE_CHOICES" :key="type">{{ type }}</option>
          </select></label>
          <template v-if="canEquip" #foot>
            <button type="button" class="small" :disabled="saving" @click="open(slot)">Swap</button>
            <button type="button" class="small quiet" :disabled="saving" @click="unequip(slot)">Remove</button>
          </template>
        </ItemDetails>
      </SlotCard>
    </ul>
    <p v-else class="empty">No pilot gear.</p>

    <p v-if="error && !failedKey" class="notice warn note" role="alert">Not saved: {{ error }}</p>
    <p v-for="type in overflowTypes" :key="type" class="notice warn note">
      No empty {{ KINDS[type] }} slot for {{ layout.overflow.filter((id) => typeOf(id) === type).map(nameOf).join(', ') }}.
    </p>
    <p v-if="unknownCount" class="dim note">
      {{ plural(unknownCount, 'item') }} {{ unknownCount === 1 ? "isn't" : "aren't" }} in any loaded pack.
    </p>

    <!-- An approved pilot's stowed items and misc items (a pilot being created has only its slots), folded by default. -->
    <div v-if="live && (stowed.length || misc.length || canRemove)" class="stowed">
      <button ref="stowToggle" type="button" class="stow-toggle" :aria-expanded="stowOpen" aria-controls="stowed-list" @click="stowOpen = !stowOpen">
        <Icon :name="stowOpen ? 'chevron-down' : 'chevron-right'" />
        Stowed {{ stowed.length }} · Misc {{ misc.length }}
      </button>
      <div v-show="stowOpen" id="stowed-list" class="stow-list">
        <section v-for="group in stowedGroups" :key="group.type" class="stow-group" :aria-labelledby="`stowed-${group.type}`">
          <h4 :id="`stowed-${group.type}`" class="label">{{ group.title }}</h4>
          <ul class="rows">
            <li v-for="entry in group.entries" :key="entry.key">
              <button type="button" class="row" :aria-expanded="expanded === entry.key" @click="toggleRow(entry.key)">
                <Icon :name="iconOf(entry)" />
                <span class="row-name">{{ rowName(entry) }}</span>
                <span v-if="rowHint(entry) && expanded !== entry.key" class="row-hint">{{ rowHint(entry) }}</span>
              </button>
              <div v-if="expanded === entry.key" :id="`more-${entry.key}`" class="row-more">
                <p v-if="bought(entry)" class="facts">Bought in this change · {{ priceText(entry) }}</p>
                <ItemNote :text="entry.notes" :editable="editable" :save="saveNote(entry.key)" />
                <label v-if="editable && isVariable(entry)" class="field"><span>Damage type</span><select aria-label="damage type" :value="entry.damageType ?? ''" :disabled="saving" @change="setDamage(entry.key, ($event.target as HTMLSelectElement).value)">
                  <option v-if="!entry.damageType" value="" disabled>Choose…</option>
                  <option v-for="type in DAMAGE_CHOICES" :key="type">{{ type }}</option>
                </select></label>
                <div class="row-actions">
                  <button v-if="byId.has(entry.id)" type="button" class="small" @click="showInfo(itemInfo(byId.get(entry.id)!))">Info</button>
                  <button v-if="canRemove" type="button" class="small quiet" :disabled="saving" @click="removeOwned(entry)">Remove</button>
                </div>
                <p v-if="error && failedKey === entry.key" class="notice warn" role="alert">Not removed: {{ error }}</p>
              </div>
            </li>
          </ul>
        </section>

        <section v-if="misc.length || canRemove" class="stow-group" aria-labelledby="stowed-misc">
          <h4 id="stowed-misc" class="label">Misc</h4>
          <div>
            <ul v-if="misc.length" class="rows">
              <li v-for="item in misc" :key="item.key">
                <button type="button" class="row" :aria-expanded="expanded === item.key" @click="toggleRow(item.key)">
                  <Icon name="generic_item" />
                  <span class="row-name">{{ item.name }}</span>
                  <span v-if="item.notes && expanded !== item.key" class="row-hint">"{{ item.notes }}"</span>
                </button>
                <div v-if="expanded === item.key" :id="`more-${item.key}`" class="row-more">
                  <ItemNote :text="item.notes" :editable="false" :save="async () => null" />
                  <div v-if="canRemove" class="row-actions">
                    <button type="button" class="small quiet" :disabled="saving" @click="removeMisc(item)">Remove</button>
                  </div>
                  <p v-if="error && failedKey === item.key" class="notice warn" role="alert">Not removed: {{ error }}</p>
                </div>
              </li>
            </ul>
            <button v-if="canRemove && !adding" ref="miscAdd" type="button" class="small quiet add-misc" :disabled="saving" @click="startMisc">Add misc item</button>
            <form v-if="adding" class="misc-form" novalidate @submit.prevent="addMisc">
              <label class="field">
                <span>Name</span>
                <input
                  ref="miscInput"
                  v-model="miscName"
                  type="text"
                  :maxlength="MISC_NAME_MAX"
                  autocomplete="off"
                  required
                  :aria-invalid="!!miscError"
                  :aria-describedby="miscError ? 'misc-error' : undefined"
                />
              </label>
              <label class="field">
                <span>Description</span>
                <input v-model="miscNotes" type="text" :maxlength="NOTE_MAX" autocomplete="off" />
              </label>
              <p v-if="miscError" id="misc-error" class="field-error" role="alert">{{ miscError }}</p>
              <p v-if="miscSaveError" class="notice warn" role="alert">Not saved: {{ miscSaveError }}</p>
              <div class="misc-actions">
                <button type="submit" class="small primary" :disabled="saving">Add item</button>
                <button type="button" class="small quiet" :disabled="saving" @click="stopMisc">Discard changes</button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </div>

    <ItemPicker
      ref="picker"
      :title="pickerTitle"
      :options="options"
      :current="building && target ? entryAt(target)?.id : undefined"
      :saving="saving"
      :error="pickerError"
      :empty="pickerEmpty"
      @choose="choose"
    />
  </section>
</template>

<style scoped>
/* Two rows of three (armour and two weapons, then three gear); a tall card never stretches the others. */
.slots {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  align-items: start;
  gap: var(--space-l);
  margin: 0;
  padding: 0;
  list-style: none;
}

/* Gear always starts the second row, even when a read-only sheet skips empty armour or weapon slots. */
.slots > :not(.gear) + .gear {
  grid-column-start: 1;
}

@media (max-width: 64rem) {
  .slots {
    grid-template-columns: minmax(0, 1fr);
  }
}

.note {
  margin: var(--space-m) 0 0;
  font-size: var(--fs-s);
}

.misc-form {
  display: grid;
  gap: var(--space-m);
  max-width: 32rem;
}

.misc-form input {
  width: 100%;
}

.misc-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-s);
}

.field-error {
  margin: 0;
  color: var(--danger);
  font-size: var(--fs-s);
}

/* Stowed: a folding toggle like a file section's (lilac only on hover and focus), then plain text rows, no boxes. */
.stowed {
  margin-top: var(--space-l);
}

.stow-toggle,
.row {
  display: flex;
  align-items: center;
  gap: var(--space-s);
  padding: 0;
  border: 0;
  background: none;
  color: var(--text);
  font: inherit;
  letter-spacing: normal;
  text-align: left;
  text-transform: none;
}

.stow-toggle {
  display: inline-flex;
  font-weight: 700;
}

.stow-toggle:hover:not(:disabled),
.stow-toggle:focus-visible,
.row:hover .row-name,
.row:focus-visible .row-name {
  background: none;
  color: var(--lilac);
}

.stow-list {
  display: grid;
  gap: var(--space-m);
  margin-top: var(--space-s);
}

/* A category's label in a narrow column, its rows beside it; on phones the label sits above. */
.stow-group {
  display: grid;
  grid-template-columns: 6rem minmax(0, 1fr);
  gap: 0 var(--space-m);
}

.stow-group > .label {
  align-self: start; /* stays level with the first row when a row below opens */
  display: flex;
  align-items: center;
  min-height: 36px;
  margin: 0;
}

@media (max-width: 36rem) {
  .stow-group {
    grid-template-columns: minmax(0, 1fr);
  }
}

.rows {
  margin: 0;
  padding: 0;
  list-style: none;
}

/* One line: symbol, name, then the dim hint cut off with an ellipsis. */
.row {
  justify-content: flex-start;
  width: 100%;
  min-height: 36px;
}

.row > .icon {
  flex: none;
  width: 18px;
  height: 18px;
  color: var(--text-dim);
}

.row-hint {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Names wrap rather than cut off: the hint beside them is what gives way. */
.row-name {
  flex: 0 1 auto;
  min-width: 0;
  overflow-wrap: anywhere;
}

.row:focus-visible {
  outline: 2px solid var(--lilac);
  outline-offset: 2px;
}

.row-hint {
  flex: 1 1 0;
  color: var(--text-dim);
  font-size: var(--fs-s);
}

/* An opened row: indented under its name. */
.row-more {
  display: grid;
  gap: var(--space-s);
  max-width: 36rem;
  padding: 0 0 var(--space-m) calc(18px + var(--space-s));
}

.row-more > .notice,
.misc-form .notice {
  margin: 0;
}

.row-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-s);
}

.add-misc {
  margin-top: var(--space-xs);
}

@media (pointer: coarse) {
  .row {
    min-height: var(--tap);
  }
}

/* Phones: the hint on a line of its own under the name, never cut off. */
@media (max-width: 40rem) {
  .row {
    flex-wrap: wrap;
    row-gap: 0;
    padding-block: var(--space-xs);
  }

  .row-hint {
    flex-basis: 100%;
    padding-left: calc(18px + var(--space-s));
    overflow: visible;
    white-space: normal;
  }
}

/* The price line, like a card's source line (ItemBody.vue). */
.facts {
  margin: 0;
  color: var(--text-dim);
  font-size: var(--fs-s);
}
</style>
