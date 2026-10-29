<script setup lang="ts">
import { computed, ref } from 'vue'
import type { NamedBonus } from '../bonuses'
import type { Item } from '../gameData'
import type { MechPrivate, Sheet } from '../myPilot'
import { equipmentDetails } from '../equipment'
import ItemDetails from './ItemDetails.vue'

const props = defineProps<{
  item: Item; sheet: Sheet; details: MechPrivate; bonuses: NamedBonus[]; itemKey: string
  location?: { mount: number; position: number; integrated?: boolean }
  editable: boolean; save: (changes: Partial<MechPrivate>) => Promise<string | null>
}>()
const options = computed(() => props.details.weapon_options?.[props.itemKey] ?? {})
const displayed = computed(() => equipmentDetails(props.item, props.sheet, props.bonuses, options.value, props.location, props.details.core_mounts))
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
  <div class="build-item">
    <div v-if="editable && ((item.profiles?.length ?? 0) > 1 || prototype)" class="choices">
      <label v-if="(item.profiles?.length ?? 0) > 1">profile
        <select aria-label="profile" :value="options.profile ?? 0" :disabled="saving" @change="set('profile', ($event.target as HTMLSelectElement).value)">
          <option v-for="(profile, index) in item.profiles" :key="index" :value="index">{{ profile.name ?? `profile ${index + 1}` }}</option>
        </select>
      </label>
      <template v-if="prototype">
        <label>weapon type <select aria-label="weapon type" :value="options.type ?? 'Rifle'" :disabled="saving" @change="set('type', ($event.target as HTMLSelectElement).value)">
          <option v-for="type in ['Melee', 'CQB', 'Rifle', 'Cannon', 'Launcher', 'Nexus']" :key="type">{{ type }}</option>
        </select></label>
        <label>damage type <select aria-label="damage type" :value="options.damageType ?? 'Kinetic'" :disabled="saving" @change="set('damageType', ($event.target as HTMLSelectElement).value)">
          <option v-for="type in ['Kinetic', 'Explosive', 'Energy']" :key="type">{{ type }}</option>
        </select></label>
        <label v-if="Number(item.id.at(-1)) >= 2">prototype improvements
          <select aria-label="prototype improvements" :value="options.accuracy === false ? 'smart-reactor' : options.smart === false ? 'accuracy-reactor' : 'accuracy-smart'" :disabled="saving" @change="set('tuning', ($event.target as HTMLSelectElement).value)">
            <option value="accuracy-smart">optics + computer</option><option value="accuracy-reactor">optics + reactor shielding</option><option value="smart-reactor">computer + reactor shielding</option>
          </select>
        </label>
      </template>
    </div>
    <ItemDetails :item="displayed" />
    <p v-if="error" class="rose" role="alert">not saved: {{ error }}</p>
  </div>
</template>

<style scoped>
.choices { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 0.75rem; }
label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.8125rem; color: var(--text-dim); max-width: 100%; }
select { max-width: 100%; }
</style>
