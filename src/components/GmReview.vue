<script setup lang="ts">
import { computed, ref } from 'vue'
import { confirmAction } from '../confirm'
import { readError, supabase } from '../lib/supabaseClient'
import { plural } from '../text'
import type { Character } from '../myPilot'
import RuleCheck from './RuleCheck.vue'

// GMs and owners only, on the review page (opened from the gm: pilots tab for a pending pilot): the decision and its note.
// Approving moves the pilot to the registry; sending back makes it a draft again for its player. Either decision saves
// the note the player sees on their sheet. "problems" is the rule check, shown above the buttons; approving with
// problems asks first. The database enforces who can do this; the page only hides it from players.
// "sheetUpdatedAt" is the sheet's updated_at from the same load as the pilot on the page (what the GM is looking at).
const props = defineProps<{ pilot: Pick<Character, 'id' | 'status' | 'callsign' | 'pilot_name' | 'updated_at' | 'submitted_at'>; sheetUpdatedAt: string; problems: string[] }>()
const emit = defineEmits<{ reviewed: [] }>()

const note = ref('')
const loading = ref(true)
const error = ref('')
const message = ref('')
const busy = ref(false)

const name = computed(() => props.pilot.callsign ?? props.pilot.pilot_name)
// Only a submitted pilot can be decided on; a draft is still its player's to finish.
const submitted = computed(() => props.pilot.status === 'pending' && !!props.pilot.submitted_at)

async function load() {
  const { data, error: loadError } = await supabase.from('character_sheets').select('review_note').eq('character_id', props.pilot.id).maybeSingle()
  error.value = loadError ? `The decision note didn't load: ${readError(loadError.message)}` : ''
  note.value = data?.review_note ?? ''
  loading.value = false
}

load()

async function approve() {
  error.value = ''
  const warning = props.problems.length ? ` It has ${plural(props.problems.length, 'problem')}.` : ''
  if (!(await confirmAction(`Approve ${name.value}? They join the registry.${warning}`, { confirmLabel: 'Approve pilot' }))) return
  busy.value = true
  // approve_pilot saves the note and approves together, and refuses if the pilot changed since it was loaded. It
  // compares the later of the card's and the sheet's updated_at; the strings are sent back as they came (a Date
  // would drop the microseconds), and Date.parse only picks the later one.
  const expected = [props.pilot.updated_at, props.sheetUpdatedAt].reduce((a, b) => (Date.parse(b) > Date.parse(a) ? b : a))
  const { error: approveError } = await supabase.rpc('approve_pilot', {
    target_character_id: props.pilot.id,
    expected_updated_at: expected,
    note: note.value,
  })
  busy.value = false
  error.value = readError(approveError?.message ?? '')
  if (!error.value) emit('reviewed')
}

async function sendBack() {
  error.value = note.value.trim() ? '' : 'Write a note before sending back.'
  if (error.value) return
  busy.value = true
  // The note and the pilot going back to a draft are saved together.
  const { error: backError } = await supabase.rpc('send_back_pilot', { target_character_id: props.pilot.id, note: note.value })
  busy.value = false
  error.value = readError(backError?.message ?? '')
  message.value = error.value ? '' : 'Sent back.'
  if (!error.value) emit('reviewed')
}
</script>

<template>
  <section>
    <h3 class="sheet-label">Decision<span class="private gm">GM only</span></h3>
    <p v-if="loading" class="dim">Loading…</p>
    <form v-else class="decision" @submit.prevent>
      <p v-if="!submitted" class="dim">Not submitted yet.</p>
      <template v-else>
        <label class="field">
          <span>Note to the player</span>
          <textarea v-model="note" rows="3"></textarea>
          <span class="hint">Required when sending back.</span>
        </label>
        <RuleCheck :problems="problems" />
      </template>
      <p v-if="error" class="notice warn" role="alert">{{ error }}</p>
      <p v-else-if="message" class="notice ok" role="status">{{ message }}</p>
      <div v-if="submitted" class="actions">
        <button type="button" class="primary" :disabled="busy" @click="approve">Approve pilot</button>
        <button type="button" class="danger" :disabled="busy" @click="sendBack">Send back</button>
      </div>
    </form>
  </section>
</template>

<style scoped>
.decision {
  display: flex;
  flex-direction: column;
  gap: var(--space-m);
}

.decision p {
  margin: 0;
}

textarea {
  width: 100%;
  resize: vertical;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-s) var(--space-m);
}

/* Phones: the decision's buttons share a row in equal columns when both fit. */
@media (max-width: 40rem) {
  .actions {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  }
}
</style>
