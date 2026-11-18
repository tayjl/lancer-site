<script setup lang="ts">
import { computed, ref } from 'vue'
import type { NamedBonus } from '../bonuses'
import { sourceOf, type Item } from '../gameData'
import type { MechPrivate, Sheet } from '../myPilot'
import { equipmentDetails } from '../equipment'
import ItemDetails from './ItemDetails.vue'
import ModSection from './ModSection.vue'

const props = defineProps<{
  item: Item; sheet: Sheet; details: MechPrivate; bonuses: NamedBonus[]; itemKey: string
  location?: { mount: number; position: number; integrated?: boolean }
  editable: boolean; save: (changes: Partial<MechPrivate>) => Promise<string | null>
  // Built into the frame or granted by a talent: marked on the card (ItemDetails).
  integrated?: boolean
  // A weapon on a mount of its own can have a mod ("moddable"): its mod, if any, and why it takes none (empty: it takes
  // one). Adding, swapping and removing it is MechLoadout's.
  moddable?: boolean; mod?: Item; modRefusal?: string
}>()
const emit = defineEmits<{ pickMod: []; removeMod: [] }>()
const options = computed(() => props.details.weapon_options?.[props.itemKey] ?? {})
const displayed = computed(() => equipmentDetails(props.item, props.sheet, props.bonuses, options.value, props.location, props.details.core_mounts, props.mod))
// Only the Limited bonus applies to a mod itself (more uses), so the weapon's attack bonuses aren't listed on it.
const shownMod = computed(() => props.mod && equipmentDetails(props.mod, props.sheet, props.bonuses.filter(entry => entry.bonus.id === 'limited_bonus')))
const prototype = computed(() => props.item.id.startsWith('mw_prototype_'))
const error = ref(''), saving = ref(false)
async function set(key: string, value: string) {
  if (!props.editable || saving.value) return
  const changes = key === 'tuning' ? { accuracy: value !== 'smart-reactor', smart: value !== 'accuracy-reactor' }
    : key === 'profile' ? { profile: Number(value) } : { [key]: value }
  saving.value = true
  error.value = (await props.save({ weapon_options: { ...props.details.weapon_options, [props.itemKey]: { ...options.value, ...changes } } })) ?? ''
  saving.value = false
}
</script>

<template>
  <ItemDetails :item="displayed" :integrated="integrated">
    <div v-if="editable && ((item.profiles?.length ?? 0) > 1 || prototype)" class="choices">
      <label v-if="(item.profiles?.length ?? 0) > 1">Profile
        <select aria-label="profile" :value="options.profile ?? 0" :disabled="saving" @change="set('profile', ($event.target as HTMLSelectElement).value)">
          <option v-for="(profile, index) in item.profiles" :key="index" :value="index">{{ profile.name ?? `profile ${index + 1}` }}</option>
        </select>
      </label>
      <template v-if="prototype">
        <label>Weapon type <select aria-label="weapon type" :value="options.type ?? 'Rifle'" :disabled="saving" @change="set('type', ($event.target as HTMLSelectElement).value)">
          <option v-for="type in ['Melee', 'CQB', 'Rifle', 'Cannon', 'Launcher', 'Nexus']" :key="type">{{ type }}</option>
        </select></label>
        <label>Damage type <select aria-label="damage type" :value="options.damageType ?? 'Kinetic'" :disabled="saving" @change="set('damageType', ($event.target as HTMLSelectElement).value)">
          <option v-for="type in ['Kinetic', 'Explosive', 'Energy']" :key="type">{{ type }}</option>
        </select></label>
        <label v-if="Number(item.id.at(-1)) >= 2">Prototype improvements
          <select aria-label="prototype improvements" :value="options.accuracy === false ? 'smart-reactor' : options.smart === false ? 'accuracy-reactor' : 'accuracy-smart'" :disabled="saving" @change="set('tuning', ($event.target as HTMLSelectElement).value)">
            <option value="accuracy-smart">optics + computer</option><option value="accuracy-reactor">optics + reactor shielding</option><option value="smart-reactor">computer + reactor shielding</option>
          </select>
        </label>
      </template>
    </div>
    <p v-if="error" class="notice warn" role="alert">Not saved: {{ error }}</p>
    <template v-if="moddable && (mod || editable)" #mod>
      <ModSection :mod="shownMod" :editable="editable" :refusal="modRefusal" :weapon-source="sourceOf(item.id)" @pick="emit('pickMod')" @remove="emit('removeMod')" />
    </template>
    <template v-if="$slots.foot" #foot><slot name="foot" /></template>
  </ItemDetails>
</template>

<style scoped>
.choices { display: flex; flex-wrap: wrap; gap: var(--space-m); }
label { display: flex; flex-direction: column; gap: var(--space-xs); font-size: var(--fs-s); color: var(--text-dim); max-width: 100%; }
select { max-width: 100%; }
</style>
