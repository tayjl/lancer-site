<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import { tagNames, toItem, type Item } from '../gameData'
import type { NamedBonus } from '../bonuses'
import { itemDetails, statLine } from '../itemDetails'
import { plainText } from '../rulesText'
import { allowedSizes, mountSize, type Frame } from '../mechData'
import type { MechPrivate, Sheet } from '../myPilot'
import { bracingMount, isLicensed, licenceName, rankName, superheavyMount } from '../rules'
import ItemPicker from './ItemPicker.vue'
import SlotCard from './SlotCard.vue'
import BuildItem from './BuildItem.vue'

// A mech's loadout, in the pilot loadout's card style: a card for each of the frame's mounts, holding the
// weapons that fit it (one or two places, by LANCER's mount rules in src/mechData.ts), then the systems.
// Weapons and systems both cost system points; the total comes from the frame and the pilot's Systems skill,
// and the pickers won't go over it. The pickers also follow LANCER's other rules (src/rules.ts): licences,
// a Superheavy weapon bracing against a second empty mount, one of each Unique item, one AI. Weapons and
// systems built into the frame show as their own cards and can't be removed.
const props = defineProps<{
  frame: Frame | null
  frames: Frame[]
  licences: Record<string, number>
  weapons: Item[]
  systems: Item[]
  integrated: Map<string, Item>
  mounts: (string | null)[][]
  installed: string[]
  spTotal: number | null
  editable: boolean
  sheet: Sheet
  details: MechPrivate
  bonuses: NamedBonus[]
  superheavyMounting: boolean
  capacityFor: (changes: Partial<MechPrivate>) => { sp: number; ai: number }
  save: (changes: Partial<MechPrivate>) => Promise<string | null>
}>()

const weaponsById = computed(() => new Map(props.weapons.map((item) => [item.id, item])))
const systemsById = computed(() => new Map(props.systems.map((item) => [item.id, item])))
// An id missing from the catalogue (e.g. its pack was removed) still shows, by its id.
const find = (byId: Map<string, Item>, id: string) => byId.get(id) ?? props.integrated.get(id) ?? toItem(id, { name: `unknown item (${id})` })

// A Superheavy weapon's mount, and the empty mount it braces against (-1 when there's none).
const sizeOf = (id: string) => weaponsById.value.get(id)?.mount
const superheavyAt = computed(() => superheavyMount(props.mounts, sizeOf))
const braced = computed(() => (superheavyAt.value < 0 || props.superheavyMounting ? -1 : bracingMount(props.frame?.mounts ?? [], props.mounts, superheavyAt.value)))
// Whether a Superheavy weapon could go on mount m: some other mount must be empty to brace it.
const canBrace = (m: number) => bracingMount(props.frame?.mounts ?? [], props.mounts, m) >= 0

// Each mount with its places: what's in each, and which weapon sizes it takes. A place that can't hold
// anything right now (a Flex mount's second place, under a Main weapon) is left out, and so is every place
// on the mount bracing a Superheavy weapon.
const mountCards = computed(() =>
  (props.frame?.mounts ?? []).map((mount, m) => {
    const ids = Array.from({ length: mountSize(mount) }, (_, i) => props.mounts[m]?.[i] ?? null)
    const sizes = ids.map((id) => (id ? (sizeOf(id) ?? null) : null))
    const places =
      m === braced.value
        ? []
        : ids.map((id, i) => ({ index: i, id, allowed: allowedSizes(mount, i, sizes) })).filter((place) => place.id || place.allowed.length)
    return { mount, m, places, bracing: m === braced.value }
  }),
)

// Built into the frame: weapons get one "integrated mount" card each, systems a card in the systems list.
const builtIn = computed(() => (props.frame?.integrated ?? []).map((id) => props.integrated.get(id)).filter((item): item is Item => !!item))
const builtInWeapons = computed(() => builtIn.value.filter((item) => item.mount))
const builtInSystems = computed(() => builtIn.value.filter((item) => !item.mount))

const spUsed = computed(
  () =>
    props.mounts.flat().reduce((sum, id) => sum + (id ? (weaponsById.value.get(id)?.sp ?? 0) : 0), 0) +
    props.installed.reduce((sum, id) => sum + (systemsById.value.get(id)?.sp ?? 0), 0),
)

// --- Saving ---
const error = ref('')
const saving = ref(false)

async function store(changes: Partial<MechPrivate>) {
  saving.value = true
  error.value = (await props.save(changes)) ?? ''
  saving.value = false
  return !error.value
}

// The whole mounts list, with one place changed.
const withWeapon = (m: number, i: number, id: string | null) =>
  props.frame!.mounts.map((mount, k) =>
    Array.from({ length: mountSize(mount) }, (_, j) => (k === m && j === i ? id : (props.mounts[k]?.[j] ?? null))),
  )

function unequip(m: number, i: number, id: string) {
  if (window.confirm(`remove ${find(weaponsById.value, id).name}?`)) store({ mounts: withWeapon(m, i, null) })
}

function uninstall(index: number) {
  if (window.confirm(`remove ${find(systemsById.value, props.installed[index]).name}?`))
    store({ systems: props.installed.filter((_, k) => k !== index) })
}

// --- The picker: weapons that fit a place, or systems ---
const picker = useTemplateRef('picker')
type Target = { kind: 'weapon'; m: number; i: number; id: string | null; allowed: string[]; label: string } | { kind: 'system' }
const target = ref<Target | null>(null)

const options = computed(() => {
  const t = target.value
  if (!t) return []
  const list = t.kind === 'weapon' ? props.weapons.filter((item) => t.allowed.includes(item.mount)) : props.systems
  const onMech = [...props.installed, ...props.mounts.flat().filter((id): id is string => !!id), ...builtIn.value.map(item => item.id)]
  if (t.kind === 'weapon' && t.id) onMech.splice(onMech.indexOf(t.id), 1)
  const aiCount = onMech.filter(id => (systemsById.value.get(id) ?? weaponsById.value.get(id) ?? props.integrated.get(id))?.tags.some(tag => tag.id === 'tg_ai')).length
  const blockedBy = (item: Item) => {
    const has = (tag: string) => item.tags.some((t) => t.id === tag)
    const changes = t.kind === 'weapon' ? { mounts: withWeapon(t.m, t.i, item.id), weapon_options: { ...props.details.weapon_options, [`${t.m}:${t.i}`]: {} } } : { systems: [...props.installed, item.id] }
    const capacity = props.capacityFor(changes)
    const swapped = t.kind === 'weapon' && t.id ? find(weaponsById.value, t.id).sp : 0
    if (!isLicensed(item, props.licences)) return `needs ${licenceName(props.frames, item.licenceId)} ${rankName(item.licenceLevel)}`
    if (has('tg_unique') && onMech.includes(item.id)) return 'unique'
    if (has('tg_ai') && aiCount >= capacity.ai) return `ai capacity ${capacity.ai}`
    if (item.mount === 'Superheavy' && t.kind === 'weapon' && !props.superheavyMounting && !canBrace(t.m)) return 'needs an empty mount'
    if (spUsed.value - swapped + item.sp > capacity.sp) return 'not enough sp'
    return ''
  }
  // Licensed items first, then the rest (shown, so players can see what a licence would unlock).
  return list
    .map((item) => {
      const details = itemDetails(item, tagNames.value)
      const kind = [item.mount, item.type].filter(Boolean).join(' ').toLowerCase()
      const licence = item.licenceLevel > 0 ? `${licenceName(props.frames, item.licenceId)} ${rankName(item.licenceLevel)}` : 'gms'
      return {
        id: item.id,
        name: item.name,
        meta: [kind, statLine(details), licence].filter(Boolean).join(': '),
        text: plainText(details.text),
        blocked: blockedBy(item),
        licensed: isLicensed(item, props.licences),
      }
    })
    .sort((a, b) => Number(b.licensed) - Number(a.licensed))
})

const pickerTitle = computed(() => (target.value?.kind === 'weapon' ? `choose ${target.value.label}` : 'install a system'))

function openWeapon(m: number, i: number, id: string | null, allowed: string[]) {
  target.value = { kind: 'weapon', m, i, id, allowed, label: placeLabel(allowed) }
  error.value = ''
  picker.value?.open()
}

function openSystem() {
  target.value = { kind: 'system' }
  error.value = ''
  picker.value?.open()
}

async function choose(id: string) {
  if (!props.editable || saving.value) return
  const offered = options.value.find(option => option.id === id)
  if (!offered || offered.blocked) { error.value = offered?.blocked ?? 'item unavailable'; return }
  const t = target.value!
  const saved = t.kind === 'weapon' ? await store({ mounts: withWeapon(t.m, t.i, id), weapon_options: { ...props.details.weapon_options, [`${t.m}:${t.i}`]: {} } }) : await store({ systems: [...props.installed, id] })
  if (saved) picker.value?.close()
}

// "main or auxiliary weapon"; a Heavy mount takes any size, so it just says so.
const placeLabel = (allowed: string[]) => (allowed.length >= 4 ? 'any weapon' : `${allowed.join(' or ').toLowerCase()} weapon`)
const coreChoices = [
  { id: 'cb_mount_retrofitting', name: 'Mount Retrofitting' },
  { id: 'cb_auto_stabilizing_hardpoints', name: 'Auto-Stabilizing Hardpoints' },
  { id: 'cb_overpower_caliber', name: 'Overpower Caliber' },
]
function targets(id: string) {
  return (props.frame?.mounts ?? []).flatMap((mount, m) => id === 'cb_overpower_caliber'
    ? (props.mounts[m] ?? []).flatMap((weapon, i) => weapon ? [{ value: m * 2 + i, name: `mount ${m + 1} · ${find(weaponsById.value, weapon).name}` }] : [])
    : mount === 'Integrated Auxiliary' ? [] : [{ value: m, name: `mount ${m + 1} · ${mount}` }])
}
async function setCore(id: string, event: Event) {
  const value = Number((event.target as HTMLSelectElement).value)
  if (!props.editable || !targets(id).some(target => target.value === value)) return
  await store({ core_mounts: { ...props.details.core_mounts, [id]: value } })
}
const orphaned = computed(() => props.mounts.flatMap((places, index) => places.slice(props.frame?.mounts[index] ? mountSize(props.frame.mounts[index]) : 0)).filter((id): id is string => !!id))
const clearOrphans = () => store({ mounts: (props.frame?.mounts ?? []).map((mount, index) => (props.mounts[index] ?? []).slice(0, mountSize(mount))) })
</script>

<template>
  <div class="mech-loadout">
    <section v-if="frame && coreChoices.some(choice => sheet.core_bonuses?.includes(choice.id))">
      <h2 class="sheet-label">core bonus assignments<span class="tag"> [private]</span></h2>
      <div v-for="choice in coreChoices.filter(choice => sheet.core_bonuses?.includes(choice.id))" :key="choice.id" class="core-choice">
        <label :for="choice.id">{{ choice.name }}</label>
        <select :id="choice.id" :value="details.core_mounts?.[choice.id] ?? -1" :disabled="!editable || saving" @change="setCore(choice.id, $event)">
          <option :value="-1" disabled>choose target</option>
          <option v-for="target in targets(choice.id)" :key="target.value" :value="target.value">{{ target.name }}</option>
        </select>
      </div>
    </section>
    <p v-if="orphaned.length" class="rose note">unfitted weapons: {{ orphaned.map(id => find(weaponsById, id).name).join(', ') }}.
      <button v-if="editable" type="button" :disabled="saving" @click="clearOrphans">clear unfitted mounts</button>
    </p>
    <section>
      <h2 class="sheet-label">weapon mounts<span class="tag"> [private]</span></h2>
      <p v-if="!frame" class="dim note">choose a frame (top right) to fit its mounts.</p>
      <ul v-else class="slot-grid">
        <SlotCard v-for="weapon in builtInWeapons" :key="weapon.id" title="integrated mount">
          <BuildItem :item="weapon" :sheet="sheet" :details="details" :bonuses="bonuses" :item-key="`integrated:${weapon.id}`" :editable="editable" :save="save" />
        </SlotCard>
        <SlotCard v-for="card in mountCards" :key="card.m" :title="`${card.mount.toLowerCase()} mount`">
          <p v-if="card.bracing" class="empty">// bracing the superheavy weapon //</p>
          <div v-for="place in card.places" :key="place.index" class="place">
            <div class="place-head">
              <span class="dim">{{ placeLabel(place.allowed) }}</span>
              <span v-if="editable" class="place-tools">
                <button type="button" :disabled="saving" @click="openWeapon(card.m, place.index, place.id, place.allowed)">
                  {{ place.id ? 'swap' : 'equip' }}
                </button>
                <button v-if="place.id" type="button" :disabled="saving" @click="unequip(card.m, place.index, place.id)">
                  remove
                </button>
              </span>
            </div>
            <BuildItem v-if="place.id" :item="find(weaponsById, place.id)" :sheet="sheet" :details="details" :bonuses="bonuses" :item-key="`${card.m}:${place.index}`" :location="{ mount: card.m, position: place.index, integrated: card.mount === 'Integrated Auxiliary' }" :editable="editable" :save="save" />
            <p v-else class="empty">// empty //</p>
          </div>
        </SlotCard>
      </ul>
    </section>

    <section>
      <header class="systems-head">
        <h2 class="sheet-label">systems<span class="tag"> [private]</span></h2>
        <span v-if="spTotal != null" class="sp" :class="{ rose: spUsed > spTotal }">system points {{ spUsed }}/{{ spTotal }}</span>
      </header>
      <p v-if="!frame" class="dim note">choose a frame (top right) to see its system points.</p>
      <ul v-else-if="installed.length || builtInSystems.length || editable" class="slot-grid">
        <SlotCard v-for="system in builtInSystems" :key="system.id" title="integrated system">
          <BuildItem :item="system" :sheet="sheet" :details="details" :bonuses="bonuses" :item-key="`integrated:${system.id}`" :editable="editable" :save="save" />
        </SlotCard>
        <SlotCard v-for="(id, index) in installed" :key="`${id}-${index}`" :title="find(systemsById, id).type.toLowerCase() || 'system'">
          <template v-if="editable" #tools>
            <button type="button" :disabled="saving" @click="uninstall(index)">remove</button>
          </template>
          <BuildItem :item="find(systemsById, id)" :sheet="sheet" :details="details" :bonuses="bonuses" :item-key="id" :editable="editable" :save="save" />
        </SlotCard>
        <SlotCard v-if="editable" title="new system" empty>
          <template #tools>
            <button type="button" :disabled="saving" @click="openSystem">install</button>
          </template>
        </SlotCard>
      </ul>
      <p v-else class="dim note">no systems installed.</p>
    </section>

    <p v-if="error" class="rose note" role="alert">not saved: {{ error }}</p>

    <ItemPicker
      ref="picker"
      :title="pickerTitle"
      :options="options"
      :current="target?.kind === 'weapon' ? target.id : null"
      :saving="saving"
      :error="error"
      @choose="choose"
    />
  </div>
</template>

<style scoped>
.mech-loadout {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
  container-type: inline-size;
}

.note {
  margin: 0.6rem 0 0;
  font-size: 0.8125rem;
}
.core-choice { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; margin-top: 0.75rem; font-size: 0.875rem; }
.core-choice select { max-width: 100%; }

.systems-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 1rem;
}

.sp {
  color: var(--text-dim);
  font-size: 0.8125rem;
}

/* A place on a mount: what it takes and its buttons, then the weapon. Two places are split by a line. */
.place {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.5rem;
}

.place + .place {
  padding-top: 0.75rem;
  border-top: 1px dashed var(--rule);
}

.place-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.25rem 0.75rem;
  font-size: 0.75rem;
}

.place-tools {
  display: flex;
  gap: 0.75rem;
}

.place-tools button {
  padding: 0;
  font-size: 0.75rem;
}

.empty {
  display: grid;
  flex: 1;
  place-items: center;
  max-width: none;
  min-height: 3rem;
  margin: 0;
  color: var(--text-dim);
  font-size: 0.875rem;
}
</style>
