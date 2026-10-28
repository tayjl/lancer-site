<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import { bionicItems, sheetStats, useGameData } from '../gameData'
import { supabase } from '../lib/supabaseClient'
import type { Sheet } from '../myPilot'
import type { PublicPilot } from '../pilots'
import LoadoutBox from './LoadoutBox.vue'
import SheetField from './SheetField.vue'
import StatRow from './StatRow.vue'

// GMs and owners only: a pilot's private sheet under their public record, and, while the pilot is pending,
// the decision. Approving sets the mod limit, clears any note and moves the pilot to the registry.
// Sending back leaves it pending with a note the player sees on their sheet.
// The database enforces who can do this; the page only hides it from players.
const props = defineProps<{ pilot: PublicPilot }>()
const emit = defineEmits<{ reviewed: [] }>()

const { gear, bionics, pilotStats } = useGameData()
const sheet = shallowRef<Sheet>({})
const modPoints = ref(6)
const note = ref('')
const loading = ref(true)
const error = ref('')
const message = ref('')
const busy = ref(false)

const stats = computed(() => sheetStats(sheet.value, pilotStats.value, bionics.value))
const name = computed(() => props.pilot.callsign ?? props.pilot.pilot_name)
const readOnly = async () => null

async function load() {
  const { data, error: loadError } = await supabase
    .from('character_sheets')
    .select('sheet, mod_points, review_note')
    .eq('character_id', props.pilot.id)
    .maybeSingle()
  error.value = loadError?.message ?? ''
  sheet.value = (data?.sheet ?? {}) as unknown as Sheet
  modPoints.value = data?.mod_points ?? 6
  note.value = data?.review_note ?? ''
  loading.value = false
}

load()

function modLimitProblem() {
  return Number.isInteger(modPoints.value) && modPoints.value >= 0 ? '' : 'the mod limit should be a whole number, 0 or more.'
}

async function approve() {
  error.value = modLimitProblem()
  if (error.value || !window.confirm(`approve ${name.value}? they'll appear in the pilot registry.`)) return
  busy.value = true
  const { error: sheetError } = await supabase
    .from('character_sheets')
    .update({ mod_points: modPoints.value, review_note: null })
    .eq('character_id', props.pilot.id)
  const { error: statusError } = sheetError
    ? { error: sheetError }
    : await supabase
        .from('characters')
        .update({ status: 'approved', approved_at: new Date().toISOString() })
        .eq('id', props.pilot.id)
  busy.value = false
  error.value = statusError?.message ?? ''
  if (!error.value) emit('reviewed')
}

async function sendBack() {
  error.value = note.value.trim() ? modLimitProblem() : 'write a note first, so the player knows what to change.'
  if (error.value) return
  busy.value = true
  const { error: saveError } = await supabase
    .from('character_sheets')
    .update({ mod_points: modPoints.value, review_note: note.value.trim() })
    .eq('character_id', props.pilot.id)
  busy.value = false
  error.value = saveError?.message ?? ''
  message.value = error.value ? '' : 'sent back. the player sees your note on their sheet.'
}
</script>

<template>
  <section class="review">
    <h2 class="sheet-label">gm review<span class="tag"> [gm only]</span></h2>
    <p class="dim small">the private sheet. only gms, owners and this pilot's player can see it.</p>

    <p v-if="loading" class="dim">loading sheet...</p>
    <template v-else>
      <StatRow title="personal stats" tag="private" :stats="stats.personal" :editable="false" :min="0" :max="6" />
      <StatRow title="piloting stats" tag="private" :stats="stats.piloting" :editable="false" :min="0" :max="6" />
      <LoadoutBox
        title="bionics"
        tag="private"
        :items="bionicItems(bionics)"
        :chosen="sheet.bionics ?? []"
        :editable="false"
        :limit="{ label: 'mod limit', unit: 'mod points', max: modPoints }"
        :save="readOnly"
      />
      <LoadoutBox title="gear loadout" tag="private" :items="gear" :chosen="sheet.pilot_gear ?? []" :editable="false" :save="readOnly" />
      <SheetField title="backstory" tag="private" :doc="sheet.backstory ?? null" :editable="false" :save="readOnly" />

      <form v-if="pilot.status === 'pending'" class="decision" @submit.prevent>
        <h3 class="sheet-label">decision</h3>
        <div class="decision-body">
          <label class="mod-limit">
            <span class="dim">mod limit</span>
            <input v-model.number="modPoints" type="number" min="0" step="1" />
          </label>
          <label>
            <span class="dim">note to the player (needed to send back)</span>
            <textarea v-model="note" rows="3"></textarea>
          </label>
          <p v-if="error" class="rose" role="alert">{{ error }}</p>
          <p v-else-if="message" class="dim" role="status">{{ message }}</p>
          <div class="actions">
            <button type="button" :disabled="busy" @click="approve">approve pilot</button>
            <button type="button" :disabled="busy" @click="sendBack">send back with note</button>
          </div>
        </div>
      </form>
      <p v-else-if="error" class="rose" role="alert">{{ error }}</p>
    </template>
  </section>
</template>

<style scoped>
.review {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  margin-top: 2.5rem;
  padding-top: 1.5rem;
  border-top: 1px solid var(--rule);
}

.review > p {
  margin: -1rem 0 0;
}

.small {
  font-size: 0.8125rem;
}

.decision-body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid var(--lilac);
}

.decision-body p {
  margin: 0;
}

label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.8125rem;
}

/* Matches the site's text inputs (style.css). */
input[type='number'],
textarea {
  width: 100%;
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--rule);
  background: none;
  color: var(--text);
  font: 400 0.9375rem/1.4 var(--mono);
}

input[type='number'] {
  width: 6rem;
}

textarea {
  resize: vertical;
}

input:focus,
textarea:focus {
  border-color: var(--lilac);
  outline: none;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.5rem;
}

.actions button {
  padding-inline: 0;
}
</style>
