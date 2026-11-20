<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { isOwner, session } from '../auth'
import { checkWrite, fetchAll, supabase } from '../lib/supabaseClient'
import SaveStatus from './SaveStatus.vue'

// GM only (RLS refuses everyone else, and no player page reads these tables): a pilot's reputation with each faction.
// The levels are fixed (Hostile to Allied, a migration seeds them); factions are made by owners in the content editor.
// A change saves at once: a level is an upsert, "Not set" deletes the row. Each row has its own save status; a failed
// save leaves the choice on screen with Retry, and a row is locked while it saves so two quick changes can't cross.
const props = defineProps<{ characterId: number }>()

type Faction = { id: number; name: string }
const factions = ref<Faction[]>([])
const levels = ref<{ id: number; name: string }[]>([])
const chosen = reactive<Record<number, string>>({}) // faction id -> level id as text, '' = not set
const state = reactive<Record<number, { saving: boolean; saved: boolean; error: string }>>({})
const loading = ref(true)
const loadError = ref('')

async function load() {
  loading.value = true
  const [orgs, lvls, rep] = await Promise.all([
    fetchAll((from, to) => supabase.from('organisations').select('id, name').order('name').order('id').range(from, to)),
    supabase.from('reputation_levels').select('id, name').order('sort_order'),
    supabase.from('reputation').select('organisation_id, level_id').eq('character_id', props.characterId),
  ])
  loadError.value = orgs.error ?? lvls.error?.message ?? rep.error?.message ?? ''
  factions.value = orgs.rows
  levels.value = lvls.data ?? []
  for (const faction of factions.value) {
    chosen[faction.id] = String(rep.data?.find((row) => row.organisation_id === faction.id)?.level_id ?? '')
    state[faction.id] = { saving: false, saved: false, error: '' }
  }
  loading.value = false
}
watch(() => props.characterId, load, { immediate: true })

// Writes what's on screen for one faction; returns an error message or null.
async function write(factionId: number): Promise<string | null> {
  const level = chosen[factionId]
  if (level) {
    const saved = await checkWrite(await supabase.from('reputation')
      .upsert({ character_id: props.characterId, organisation_id: factionId, level_id: Number(level), updated_by: session.value?.user.id }, { onConflict: 'character_id,organisation_id' }).select('level_id'))
    return saved.error
  }
  const removed = await checkWrite(await supabase.from('reputation').delete().eq('character_id', props.characterId).eq('organisation_id', factionId).select('level_id'))
  if (removed.error === null) return null
  // Zero rows is fine when the row is already gone (another GM cleared it); a refused delete leaves it there.
  const left = await supabase.from('reputation').select('level_id').eq('character_id', props.characterId).eq('organisation_id', factionId).maybeSingle()
  return left.error || left.data ? removed.error : null
}

async function save(factionId: number) {
  const row = state[factionId]
  row.saving = true
  row.error = (await write(factionId)) ?? ''
  row.saving = false
  row.saved = !row.error
}

const none = computed(() => !loading.value && !loadError.value && !factions.value.length)
</script>

<template>
  <section aria-labelledby="reputation-title">
    <h3 id="reputation-title" class="sheet-label">Reputation<span class="private gm">GM only</span></h3>
    <p v-if="loading" class="dim">Loading…</p>
    <p v-else-if="loadError" class="notice warn" role="alert">Couldn't load reputation: {{ loadError }}</p>
    <div v-else-if="none" class="empty">
      <p>No factions yet.</p>
      <RouterLink v-if="isOwner" class="link-button" :to="{ name: 'gm-content-editor', query: { cat: 'factions' } }">Add factions</RouterLink>
    </div>
    <ul v-else>
      <li v-for="faction in factions" :key="faction.id">
        <label :for="`rep-${faction.id}`">{{ faction.name }}</label>
        <select :id="`rep-${faction.id}`" v-model="chosen[faction.id]" :disabled="state[faction.id].saving" @change="save(faction.id)">
          <option value="">Not set</option>
          <option v-for="level in levels" :key="level.id" :value="String(level.id)">{{ level.name }}</option>
        </select>
        <SaveStatus :saving="state[faction.id].saving" :saved="state[faction.id].saved" :error="state[faction.id].error" :can-retry="true" @retry="save(faction.id)" />
      </li>
    </ul>
  </section>
</template>

<style scoped>
ul { display: grid; gap: 0; margin: 0; padding: 0; list-style: none; }
li { display: grid; grid-template-columns: minmax(8rem, 1fr) minmax(10rem, 14rem) minmax(6rem, 1fr); align-items: center; gap: var(--space-s) var(--space-m); padding: var(--space-s) 0; border-top: 1px solid var(--rule); }
li:first-child { border-top: 0; }
label { font-weight: 700; overflow-wrap: anywhere; }
.empty p { margin: 0; }
.empty { display: grid; justify-items: center; gap: var(--space-s); }
@media (max-width: 35rem) { li { grid-template-columns: minmax(0, 1fr); } }
</style>
