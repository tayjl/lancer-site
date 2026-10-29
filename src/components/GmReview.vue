<script setup lang="ts">
import { computed, ref } from 'vue'
import { supabase } from '../lib/supabaseClient'
import type { Character } from '../myPilot'

// GMs and owners only, on the review page (opened from gm_view's queue): the decision on a pending pilot,
// under its sheet. Approving sets the mod limit, clears any note and moves the pilot to the registry.
// Sending back leaves it pending with a note the player sees on their sheet.
// The database enforces who can do this; the page only hides it from players.
const props = defineProps<{ pilot: Pick<Character, 'id' | 'status' | 'callsign' | 'pilot_name'> }>()
const emit = defineEmits<{ reviewed: [] }>()

const modPoints = ref(6)
const note = ref('')
const loading = ref(true)
const error = ref('')
const message = ref('')
const busy = ref(false)

const name = computed(() => props.pilot.callsign ?? props.pilot.pilot_name)

async function load() {
  const { data, error: loadError } = await supabase
    .from('character_sheets')
    .select('mod_points, review_note')
    .eq('character_id', props.pilot.id)
    .maybeSingle()
  error.value = loadError?.message ?? ''
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
  <section v-if="pilot.status === 'pending'" class="decision">
    <h2 class="sheet-label">decision<span class="tag"> [gm only]</span></h2>
    <p v-if="loading" class="dim">loading...</p>
    <form v-else class="decision-body" @submit.prevent>
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
    </form>
  </section>
</template>

<style scoped>
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
