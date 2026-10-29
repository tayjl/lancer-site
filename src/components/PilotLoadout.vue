<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import armourIcon from '../assets/icons/armour.svg'
import blastIcon from '../assets/icons/blast.svg'
import burnIcon from '../assets/icons/burn.svg'
import burstIcon from '../assets/icons/burst.svg'
import coneIcon from '../assets/icons/cone.svg'
import eDefIcon from '../assets/icons/e_def.svg'
import energyIcon from '../assets/icons/energy.svg'
import evasionIcon from '../assets/icons/evasion.svg'
import explosiveIcon from '../assets/icons/explosive.svg'
import heatIcon from '../assets/icons/heat.svg'
import hpIcon from '../assets/icons/hp.svg'
import kineticIcon from '../assets/icons/kinetic.svg'
import lineIcon from '../assets/icons/line.svg'
import rangeIcon from '../assets/icons/range.svg'
import threatIcon from '../assets/icons/threat.svg'
import variableIcon from '../assets/icons/variable.svg'
import { loadoutSlots, type GearItem, type Slot } from '../gameData'
import StatIcon from './StatIcon.vue'

// The pilot's loadout, laid out like COMP/CON's: one armour slot, two weapon slots and three gear slots,
// each a card that shows the item's stats, rules text and tags. Empty slots say so. Each slot only takes
// items of its type, picked from the catalogue (sheet.pilot_gear holds the ids; the slot comes from the type).
const props = defineProps<{
  items: GearItem[]
  chosen: string[]
  editable: boolean
  save: (ids: string[]) => Promise<string | null>
}>()


// Armour bonuses: [label, icon]. Speed has no LANCER symbol.
const BONUSES: Record<string, [string, string | null]> = {
  pilot_armor: ['armour', armourIcon],
  pilot_hp: ['hp', hpIcon],
  pilot_evasion: ['evasion', evasionIcon],
  pilot_edef: ['e-defense', eDefIcon],
  pilot_speed: ['speed', null],
}
// Weapon range and damage types, lower case.
const ICONS: Record<string, string> = {
  threat: threatIcon,
  range: rangeIcon,
  burst: burstIcon,
  blast: blastIcon,
  line: lineIcon,
  cone: coneIcon,
  kinetic: kineticIcon,
  energy: energyIcon,
  explosive: explosiveIcon,
  burn: burnIcon,
  heat: heatIcon,
  variable: variableIcon,
}
// Tags that only repeat the slot's own type.
const HIDDEN_TAGS = ['tg_gear', 'tg_pilot_weapon', 'tg_personal_armor']

const byId = computed(() => new Map(props.items.map((item) => [item.id, item])))

const layout = computed(() => loadoutSlots(props.chosen, (id) => byId.value.get(id)?.type))

// Rules text without its HTML (it's shown as plain text, never as HTML).
const plain = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

// What a card shows for an item: its stats with symbols, its rules text and its tags.
function details(item: GearItem) {
  const stats = [
    ...item.bonuses.map((bonus) => {
      const [label, icon] = BONUSES[bonus.id] ?? [bonus.id.replace('pilot_', ''), null]
      return { label, icon, value: bonus.id === 'pilot_hp' && !bonus.replace ? `+${bonus.val}` : String(bonus.val) }
    }),
    ...[...item.range, ...item.damage].map((entry) => ({
      label: entry.type.toLowerCase(),
      icon: ICONS[entry.type.toLowerCase()] ?? null,
      value: String(entry.val),
    })),
  ]
  const tags = item.tags
    .filter((tag) => !HIDDEN_TAGS.includes(tag.id))
    .map((tag) => `${tag.id.replace(/^tg_/, '').replaceAll('_', ' ')}${tag.val != null ? ` ${tag.val}` : ''}`)
  // Gear often has no rules text, only flavour, so it falls back to the description.
  const text = plain(item.effect) || (item.type === 'Gear' ? item.description : '')
  return { stats, tags, text }
}

const nameOf = (id: string) => byId.value.get(id)?.name ?? id

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
const dialog = useTemplateRef('dialog')
const target = ref<Slot | null>(null)
const filter = ref('')

const offered = computed(() => {
  const words = filter.value.trim().toLowerCase()
  return props.items.filter((item) => item.type === target.value?.type && (!words || item.name.toLowerCase().includes(words)))
})

function open(slot: Slot) {
  target.value = slot
  filter.value = ''
  error.value = ''
  dialog.value?.showModal()
}

async function equip(item: GearItem) {
  if (await store(target.value!, item.id)) dialog.value?.close()
}
</script>

<template>
  <section class="pilot-loadout">
    <h2 class="sheet-label">loadout<span class="tag"> [private]</span></h2>

    <ul class="slots">
      <li v-for="slot in layout.slots" :key="`${slot.type}-${slot.index}`" class="slot">
        <header class="slot-head">
          <h3>{{ slot.label }}</h3>
          <span v-if="editable" class="tools">
            <button type="button" :disabled="saving" @click="open(slot)">{{ slot.id ? 'swap' : 'equip' }}</button>
            <button v-if="slot.id" type="button" :disabled="saving" @click="unequip(slot)">remove</button>
          </span>
        </header>

        <div v-if="slot.id && byId.get(slot.id)" class="slot-body">
          <p class="item-name">{{ byId.get(slot.id)!.name }}</p>
          <template v-for="info in [details(byId.get(slot.id)!)]" :key="slot.id">
            <ul v-if="info.stats.length" class="stats">
              <li v-for="(stat, i) in info.stats" :key="i">
                <span class="stat-value"><StatIcon v-if="stat.icon" :src="stat.icon" />{{ stat.value }}</span>
                <span class="stat-label">{{ stat.label }}</span>
              </li>
            </ul>
            <p v-if="info.text" class="text">{{ info.text }}</p>
            <ul v-if="info.tags.length" class="tags">
              <li v-for="tag in info.tags" :key="tag">{{ tag }}</li>
            </ul>
          </template>
        </div>
        <p v-else class="empty">// empty //</p>
      </li>
    </ul>

    <p v-if="error" class="rose note" role="alert">not saved: {{ error }}</p>
    <p v-if="layout.overflow.length" class="rose note">
      no free slot for: {{ layout.overflow.map(nameOf).join(', ') }}. they're dropped at the next loadout change.
    </p>
    <p v-if="items.length && layout.unknown.length" class="dim note">
      also on file: {{ layout.unknown.length }} item(s) from content packs that aren't loaded.
    </p>

    <dialog ref="dialog" class="picker" :aria-label="`choose ${target?.label}`">
      <header class="picker-head">
        <h3>choose {{ target?.label }}</h3>
        <button type="button" @click="dialog?.close()">cancel</button>
      </header>
      <input v-model="filter" type="text" :aria-label="`search ${target?.label}`" placeholder="search..." />
      <p v-if="error" class="rose" role="alert">{{ error }}</p>

      <ul v-if="offered.length" class="options">
        <li v-for="item in offered" :key="item.id">
          <div v-for="info in [details(item)]" :key="item.id">
            <span class="item-name">{{ item.name }}</span>
            <span v-if="info.stats.length" class="dim option-stats">
              {{ info.stats.map((stat) => `${stat.label} ${stat.value}`).join(', ') }}
            </span>
            <span v-if="info.text" class="text">{{ info.text }}</span>
          </div>
          <button v-if="item.id === target?.id" type="button" disabled>equipped</button>
          <button v-else type="button" :disabled="saving" @click="equip(item)">equip</button>
        </li>
      </ul>
      <p v-else class="dim">nothing to choose from{{ filter ? ' with that search' : ' yet: the content packs may not be imported' }}.</p>
    </dialog>
  </section>
</template>

<style scoped>
.pilot-loadout {
  container-type: inline-size;
}

/* Armour and two weapons on the first row, three gear on the second; fewer columns when narrow. */
.slots {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

@container (min-width: 36rem) {
  .slots {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@container (min-width: 54rem) {
  .slots {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.slot {
  display: flex;
  flex-direction: column;
  min-height: 9rem;
  border: 1px solid var(--rule);
}

.slot-head {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.25rem 0.6rem;
  border-left: 3px solid var(--lilac);
  background: var(--panel);
}

.slot-head h3 {
  margin: 0;
  font-size: 0.8125rem;
  font-weight: 700;
}

.tools {
  display: flex;
  gap: 0.75rem;
  margin-left: auto;
}

.tools button {
  padding: 0;
  font-size: 0.75rem;
}

.slot-body {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  padding: 0.6rem 0.75rem 0.75rem;
}

.slot-body p {
  margin: 0;
}

.item-name {
  display: block;
  color: var(--lilac);
  font-weight: 700;
}

.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.stats li {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--lilac);
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.2;
}

.stat-label {
  color: var(--text-dim);
  font-size: 0.6875rem;
}

.text {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  color: var(--text-dim);
  font: 400 0.875rem/1.45 var(--read);
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.tags li {
  padding: 0 0.4rem;
  border: 1px solid var(--rule);
  color: var(--sky);
  font-size: 0.6875rem;
}

.empty {
  display: grid;
  flex: 1;
  place-items: center;
  margin: 0;
  color: var(--text-dim);
  font-size: 0.875rem;
}

.note {
  margin: 0.6rem 0 0;
  font-size: 0.8125rem;
}

/* --- The picker (as LoadoutBox's) --- */
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

.option-stats {
  display: block;
  font-size: 0.75rem;
}

.options button {
  flex-shrink: 0;
  padding: 0;
  font-size: 0.8125rem;
}

.options button:disabled {
  color: var(--text-dim);
  cursor: default;
}
</style>
