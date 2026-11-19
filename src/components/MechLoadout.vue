<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import { isGm } from '../auth'
import { confirmAction } from '../confirm'
import { tagNames, toItem, type Item } from '../gameData'
import type { NamedBonus } from '../bonuses'
import { itemInfo } from '../info'
import { itemPick } from '../pickerRows'
import { useManufacturers } from '../archive'
import { modBlockedBy, modsRefused } from '../equipment'
import { allowedSizes, fittedMods, MOUNT_HINTS, mountSize, type Frame } from '../mechData'
import type { MechPrivate, Sheet } from '../myPilot'
import { bracingMount, gmOnly, GM_ONLY_REASON, isLicensed, licenceName, rankName, superheavyMount } from '../rules'
import ItemPicker from './ItemPicker.vue'
import SlotCard from './SlotCard.vue'
import BuildItem from './BuildItem.vue'
import Icon from './Icon.vue'

// A mech's loadout, in the pilot loadout's card style: a card for each of the frame's mounts, holding the
// weapons that fit it (one or two places, by LANCER's mount rules in src/mechData.ts), then the systems.
// Weapons and systems both cost system points; the total comes from the frame and the pilot's Systems skill,
// and the pickers won't go over it. The pickers also follow LANCER's other rules (src/rules.ts): licences,
// a Superheavy weapon bracing against a second empty mount, one of each Unique item, one AI. Weapons and
// systems built into the frame show as their own cards and can't be removed. A weapon on a mount can carry one mod
// (in its own card, stored by the weapon's place); it costs system points too and goes with its weapon.
const props = defineProps<{
  frame: Frame | null
  frames: Frame[]
  licences: Record<string, number>
  weapons: Item[]
  systems: Item[]
  mods: Item[]
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

const manufacturers = useManufacturers()
const weaponsById = computed(() => new Map(props.weapons.map((item) => [item.id, item])))
const systemsById = computed(() => new Map(props.systems.map((item) => [item.id, item])))
const modsById = computed(() => new Map(props.mods.map((item) => [item.id, item])))
// An id missing from the catalogue (e.g. its pack was removed) still shows, by its id.
const find = (byId: Map<string, Item>, id: string) => byId.get(id) ?? props.integrated.get(id) ?? toItem(id, { name: `Unknown item (${id})` })

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

// The mods on weapons that are there ("mount:place" → mod id); the rest are stray (see below).
const liveMods = computed(() => Object.fromEntries(fittedMods(props.details, props.frame)))
const modOn = (m: number, i: number) => {
  const id = liveMods.value[`${m}:${i}`]
  return id ? find(modsById.value, id) : undefined
}
const withoutMod = (key: string) => Object.fromEntries(Object.entries(props.details.weapon_mods ?? {}).filter(([place]) => place !== key))

const spUsed = computed(
  () =>
    props.mounts.flat().reduce((sum, id) => sum + (id ? (weaponsById.value.get(id)?.sp ?? 0) : 0), 0) +
    props.installed.reduce((sum, id) => sum + (systemsById.value.get(id)?.sp ?? 0), 0) +
    Object.values(liveMods.value).reduce((sum, id) => sum + (modsById.value.get(id)?.sp ?? 0), 0),
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

async function unequip(m: number, i: number, id: string) {
  const mod = modOn(m, i)
  if (await confirmAction(`Remove ${find(weaponsById.value, id).name}${mod ? ` and its mod, ${mod.name}` : ''}? It leaves the mount empty.`, { confirmLabel: 'Remove weapon', danger: true }))
    store({ mounts: withWeapon(m, i, null), weapon_mods: withoutMod(`${m}:${i}`) })
}

async function removeMod(m: number, i: number) {
  if (await confirmAction(`Remove ${modOn(m, i)!.name}? The weapon keeps no mod.`, { confirmLabel: 'Remove mod', danger: true })) store({ weapon_mods: withoutMod(`${m}:${i}`) })
}

async function uninstall(index: number) {
  if (await confirmAction(`Remove ${find(systemsById.value, props.installed[index]).name}? It frees its system points.`, { confirmLabel: 'Remove system', danger: true }))
    store({ systems: props.installed.filter((_, k) => k !== index) })
}

// --- The picker: weapons that fit a place, systems, or mods that fit a weapon ---
const picker = useTemplateRef('picker')
type Target = { kind: 'weapon'; m: number; i: number; id: string | null; allowed: string[]; label: string } | { kind: 'system' } | { kind: 'mod'; m: number; i: number; id: string | null; weapon: Item }
const target = ref<Target | null>(null)

const options = computed(() => {
  const t = target.value
  if (!t) return []
  const list = t.kind === 'weapon' ? props.weapons.filter((item) => t.allowed.includes(item.mount)) : t.kind === 'mod' ? props.mods : props.systems
  const key = t.kind === 'system' ? '' : `${t.m}:${t.i}`
  const onMech = [...props.installed, ...props.mounts.flat().filter((id): id is string => !!id), ...builtIn.value.map(item => item.id), ...Object.values(liveMods.value)]
  // What this choice replaces leaves the mech: the weapon (and its mod), or the mod.
  const leaving = t.kind === 'weapon' ? [t.id, liveMods.value[key]] : t.kind === 'mod' ? [t.id] : []
  for (const id of leaving) if (id && onMech.includes(id)) onMech.splice(onMech.indexOf(id), 1)
  const aiCount = onMech.filter(id => (systemsById.value.get(id) ?? weaponsById.value.get(id) ?? modsById.value.get(id) ?? props.integrated.get(id))?.tags.some(tag => tag.id === 'tg_ai')).length
  const blockedBy = (item: Item) => {
    const has = (tag: string) => item.tags.some((t) => t.id === tag)
    const changes = t.kind === 'weapon' ? { mounts: withWeapon(t.m, t.i, item.id), weapon_options: { ...props.details.weapon_options, [key]: {} }, weapon_mods: withoutMod(key) }
      : t.kind === 'mod' ? { weapon_mods: { ...props.details.weapon_mods, [key]: item.id } } : { systems: [...props.installed, item.id] }
    const capacity = props.capacityFor(changes)
    const swapped = leaving.reduce((sum, id) => sum + (id ? (weaponsById.value.get(id) ?? modsById.value.get(id))?.sp ?? 0 : 0), 0)
    if (!isLicensed(item, props.licences)) return `Needs ${licenceName(props.frames, item.licenceId)} ${rankName(item.licenceLevel)}`
    if (t.kind === 'mod') { const why = modBlockedBy(item, t.weapon, props.frame?.mounts[t.m] ?? '', props.details.weapon_options?.[key]); if (why) return why }
    if (has('tg_unique') && onMech.includes(item.id)) return 'Already on this mech'
    if (has('tg_ai') && aiCount >= capacity.ai) return 'Not enough AI capacity'
    if (item.mount === 'Superheavy' && t.kind === 'weapon' && !props.superheavyMounting && !canBrace(t.m)) return 'Needs an empty mount'
    if (spUsed.value - swapped + item.sp > capacity.sp) return 'Not enough system points'
    return ''
  }
  // The picker puts what can be chosen first in each manufacturer's box (PickList.vue). GM-only ones (HORUS, NHC, Exotic)
  // are blocked for players.
  return list.map((item) => ({
    id: item.id,
    name: item.name,
    ...itemPick(item, tagNames.value, manufacturers.value),
    info: () => itemInfo(item),
    blocked: !isGm.value && gmOnly(item, props.frames) ? GM_ONLY_REASON : blockedBy(item),
  }))
})

const pickerTitle = computed(() => {
  const t = target.value
  return t?.kind === 'weapon' ? `Choose ${t.label}` : t?.kind === 'mod' ? `Choose a mod for ${t.weapon.name}` : 'Add a system'
})

function openWeapon(m: number, i: number, id: string | null, allowed: string[]) {
  target.value = { kind: 'weapon', m, i, id, allowed, label: placeLabel(allowed) }
  error.value = ''
  picker.value?.open()
}

function openMod(m: number, i: number, weapon: Item) {
  target.value = { kind: 'mod', m, i, id: liveMods.value[`${m}:${i}`] ?? null, weapon }
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
  if (!offered || offered.blocked) { error.value = offered?.blocked ?? 'That item is unavailable.'; return }
  const t = target.value!
  const key = t.kind === 'system' ? '' : `${t.m}:${t.i}`
  const saved = t.kind === 'weapon' ? await store({ mounts: withWeapon(t.m, t.i, id), weapon_options: { ...props.details.weapon_options, [key]: {} }, weapon_mods: withoutMod(key) })
    : t.kind === 'mod' ? await store({ weapon_mods: { ...props.details.weapon_mods, [key]: id } }) : await store({ systems: [...props.installed, id] })
  if (saved) picker.value?.close()
}

// "main or auxiliary weapon"; a Heavy mount takes any size, so it just says so.
const placeLabel = (allowed: string[]) => (allowed.length >= 4 ? 'any weapon' : `${allowed.join(' or ').toLowerCase()} weapon`)
// What an empty mount takes, in its empty state; one not listed says what its first place takes.
const placeHint = (allowed: string[]) => `Takes ${allowed.length >= 4 ? 'a weapon of any size' : `one ${allowed.join(' or ')} weapon`}.`
const mountHint = (mount: string, allowed: string[]) => (MOUNT_HINTS[mount] ?? placeHint(allowed))
// The system points meter: how full, and what's left.
const spNote = computed(() => {
  const left = (props.spTotal ?? 0) - spUsed.value
  return left < 0 ? `${-left} over` : left === 0 ? 'All used' : `${left} left`
})
const coreChoices = [
  { id: 'cb_mount_retrofitting', name: 'Mount Retrofitting' },
  { id: 'cb_auto_stabilizing_hardpoints', name: 'Auto-Stabilizing Hardpoints' },
  { id: 'cb_overpower_caliber', name: 'Overpower Caliber' },
]
function targets(id: string) {
  return (props.frame?.mounts ?? []).flatMap((mount, m) => id === 'cb_overpower_caliber'
    ? (props.mounts[m] ?? []).flatMap((weapon, i) => weapon ? [{ value: m * 2 + i, name: `Mount ${m + 1} · ${find(weaponsById.value, weapon).name}` }] : [])
    : mount === 'Integrated Auxiliary' ? [] : [{ value: m, name: `Mount ${m + 1} · ${mount}` }])
}
async function setCore(id: string, event: Event) {
  const value = Number((event.target as HTMLSelectElement).value)
  if (!props.editable || !targets(id).some(target => target.value === value)) return
  await store({ core_mounts: { ...props.details.core_mounts, [id]: value } })
}
// Mods whose weapon is gone (the rule check says so too): they count for nothing, and can be cleared like unfitted weapons.
const strayMods = computed(() => Object.entries(props.details.weapon_mods ?? {}).filter(([key]) => !(key in liveMods.value)))
const orphaned = computed(() => props.mounts.flatMap((places, index) => places.slice(props.frame?.mounts[index] ? mountSize(props.frame.mounts[index]) : 0)).filter((id): id is string => !!id))
const clearOrphans = () => store({ mounts: (props.frame?.mounts ?? []).map((mount, index) => (props.mounts[index] ?? []).slice(0, mountSize(mount))), weapon_mods: liveMods.value })
</script>

<template>
  <div class="mech-loadout">
    <section v-if="frame && spTotal != null" class="panel">
      <div class="meter" :class="{ full: spUsed === spTotal, over: spUsed > spTotal }">
        <div class="meter-head">
          <span class="label">System points</span>
          <span class="meter-value num">{{ spUsed }} / {{ spTotal }}</span>
        </div>
        <div class="meter-bar"><span :style="{ '--fill': `${spTotal ? Math.min(100, (spUsed / spTotal) * 100) : 100}%` }"></span></div>
        <div class="meter-note">{{ spNote }}</div>
      </div>
    </section>
    <section v-if="frame && coreChoices.some(choice => sheet.core_bonuses?.includes(choice.id))" class="panel">
      <h2 class="sheet-label">Core bonus assignments<span class="private">Private</span></h2>
      <div v-for="choice in coreChoices.filter(choice => sheet.core_bonuses?.includes(choice.id))" :key="choice.id" class="core-choice">
        <label :for="choice.id">{{ choice.name }}</label>
        <select :id="choice.id" :value="details.core_mounts?.[choice.id] ?? -1" :disabled="!editable || saving" @change="setCore(choice.id, $event)">
          <option :value="-1" disabled>Choose…</option>
          <option v-for="target in targets(choice.id)" :key="target.value" :value="target.value">{{ target.name }}</option>
        </select>
      </div>
    </section>
    <div v-if="orphaned.length || strayMods.length" class="notice warn">
      <div class="notice-head">
        <div>
          <p v-if="orphaned.length">Unfitted weapons: {{ orphaned.map(id => find(weaponsById, id).name).join(', ') }}.</p>
          <p v-if="strayMods.length">Mods without a weapon: {{ strayMods.map(([, id]) => find(modsById, id).name).join(', ') }}.</p>
        </div>
        <button v-if="editable" type="button" class="small" :disabled="saving" @click="clearOrphans">Clear unfitted</button>
      </div>
    </div>
    <section class="panel">
      <h2 class="sheet-label">Weapon mounts<span class="private">Private</span></h2>
      <p v-if="!frame" class="empty">Choose a frame first.</p>
      <ul v-else class="slot-grid">
        <SlotCard v-for="weapon in builtInWeapons" :key="weapon.id" label="Integrated mount">
          <BuildItem :item="weapon" :sheet="sheet" :details="details" :bonuses="bonuses" :item-key="`integrated:${weapon.id}`" :editable="editable" :save="save" integrated />
        </SlotCard>
        <SlotCard
          v-for="card in mountCards"
          :key="card.m"
          :label="`${card.mount} mount`"
          :empty="card.bracing ? 'Bracing the Superheavy weapon.' : card.places.every((place) => !place.id) ? mountHint(card.mount, card.places[0]?.allowed ?? []) : ''"
        >
          <template v-if="editable && !card.bracing && card.places[0]" #action>
            <button type="button" class="small" :disabled="saving" @click="openWeapon(card.m, 0, null, card.places[0].allowed)">Add weapon</button>
          </template>
          <div class="places">
            <template v-for="place in card.places" :key="place.index">
              <BuildItem
                v-if="place.id"
                :item="find(weaponsById, place.id)"
                :sheet="sheet"
                :details="details"
                :bonuses="bonuses"
                :item-key="`${card.m}:${place.index}`"
                :location="{ mount: card.m, position: place.index, integrated: card.mount === 'Integrated Auxiliary' }"
                :editable="editable"
                :save="save"
                moddable
                :mod="modOn(card.m, place.index)"
                :mod-refusal="modsRefused(find(weaponsById, place.id), card.mount)"
                @pick-mod="openMod(card.m, place.index, find(weaponsById, place.id))"
                @remove-mod="removeMod(card.m, place.index)"
              >
                <template v-if="editable" #foot>
                  <button type="button" class="small" :disabled="saving" @click="openWeapon(card.m, place.index, place.id, place.allowed)">Swap</button>
                  <button type="button" class="small quiet" :disabled="saving" @click="unequip(card.m, place.index, place.id)">Remove</button>
                </template>
              </BuildItem>
              <div v-else class="empty">
                <p>{{ placeHint(place.allowed) }}</p>
                <button v-if="editable" type="button" class="small" :disabled="saving" @click="openWeapon(card.m, place.index, null, place.allowed)">Add weapon</button>
              </div>
            </template>
          </div>
        </SlotCard>
      </ul>
    </section>

    <section class="panel">
      <header class="sheet-head systems-head">
        <h2 class="sheet-label">Systems<span class="private">Private</span></h2>
        <button v-if="frame && editable" type="button" class="small" :disabled="saving" @click="openSystem"><Icon name="plus" />Add system</button>
      </header>
      <p v-if="!frame" class="empty">Choose a frame first.</p>
      <ul v-else-if="installed.length || builtInSystems.length" class="slot-grid">
        <SlotCard v-for="system in builtInSystems" :key="system.id" label="Integrated system">
          <BuildItem :item="system" :sheet="sheet" :details="details" :bonuses="bonuses" :item-key="`integrated:${system.id}`" :editable="editable" :save="save" integrated />
        </SlotCard>
        <SlotCard v-for="(id, index) in installed" :key="`${id}-${index}`">
          <BuildItem :item="find(systemsById, id)" :sheet="sheet" :details="details" :bonuses="bonuses" :item-key="id" :editable="editable" :save="save">
            <template v-if="editable" #foot>
              <button type="button" class="small quiet" :disabled="saving" @click="uninstall(index)">Remove</button>
            </template>
          </BuildItem>
        </SlotCard>
      </ul>
      <p v-else class="empty">No systems yet.</p>
    </section>

    <p v-if="error" class="notice warn" role="alert">Not saved: {{ error }}</p>

    <ItemPicker
      ref="picker"
      :title="pickerTitle"
      :options="options"
      :current="target && 'id' in target ? target.id : null"
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
  gap: var(--space-l);
}

.core-choice {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-m);
  margin-top: var(--space-m);
  font-size: var(--fs-s);
}

.core-choice select {
  max-width: 100%;
}

/* A mount's weapons (two on a Flex, Main/Aux or Aux/Aux mount), one under the other. */
.places {
  display: grid;
  gap: var(--space-s);
}

.places .empty p {
  margin: 0;
}

.systems-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-s) var(--space-m);
}

.systems-head .icon {
  width: 16px;
  height: 16px;
}
</style>
