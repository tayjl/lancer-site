<script setup lang="ts">
import { computed, ref } from 'vue'
import { supabase } from '../lib/supabaseClient'
import type { Character } from '../myPilot'
import RuleCheck from './RuleCheck.vue'

// GMs and owners only, on the review page (opened from the gm: pilots tab or any record): a pilot's level and manna received
// (homebrew; src/rules.ts), which only GMs set, for any pilot. While the pilot is pending, also the decision.
// Level and manna save on their own; approving clears any note and moves the pilot to the registry. Sending back leaves it pending with a note
// the player sees on their sheet. "problems" is the rule check, shown above the buttons; approving with
// problems asks first. The database enforces who can do this; the page only hides it from players.
const props = defineProps<{ pilot: Pick<Character, 'id' | 'status' | 'callsign' | 'pilot_name'>; problems: string[] }>()
const emit = defineEmits<{ reviewed: [] }>()

const level = ref(0)
const manna = ref(0)
const note = ref('')
const loading = ref(true)
const error = ref('')
const message = ref('')
const busy = ref(false)

const name = computed(() => props.pilot.callsign ?? props.pilot.pilot_name)
const pending = computed(() => props.pilot.status === 'pending')

async function load() {
  const { data, error: loadError } = await supabase
    .from('character_sheets')
    .select('level, manna, review_note')
    .eq('character_id', props.pilot.id)
    .maybeSingle()
  error.value = loadError?.message ?? ''
  level.value = data?.level ?? 0
  manna.value = data?.manna ?? 0
  note.value = data?.review_note ?? ''
  loading.value = false
}

load()

function numbersProblem() {
  const whole = (n: number) => Number.isInteger(n) && n >= 0
  return whole(level.value) && whole(manna.value) ? '' : 'level and manna should be whole numbers, 0 or more.'
}

async function saveSheet(changes: { level?: number; manna?: number; review_note?: string | null }) {
  const { error: saveError } = await supabase.from('character_sheets').update(changes).eq('character_id', props.pilot.id)
  return saveError
}

// Level and manna save on their own button only; approving and sending back never need them.
// GMs can mark an approved pilot dead too (mark_dead in the database). It can't be undone.
async function markDead() {
  if (!window.confirm(`mark ${name.value} dead? this can't be undone. they move to the memorial.`)) return
  busy.value = true
  const { error: deathError } = await supabase.rpc('mark_dead', { target_character_id: props.pilot.id })
  busy.value = false
  error.value = deathError?.message ?? ''
  if (!error.value) emit('reviewed')
}

async function saveNumbers() {
  error.value = numbersProblem()
  if (error.value) return
  busy.value = true
  error.value = (await saveSheet({ level: level.value, manna: manna.value }))?.message ?? ''
  busy.value = false
  message.value = error.value ? '' : 'saved.'
  if (!error.value) emit('reviewed')
}

async function approve() {
  error.value = ''
  const warning = props.problems.length ? ` the rule check lists ${props.problems.length} problem(s).` : ''
  if (!window.confirm(`approve ${name.value}? they'll appear in the pilot registry.${warning}`)) return
  busy.value = true
  const sheetError = await saveSheet({ review_note: null })
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
  error.value = note.value.trim() ? '' : 'write a note first, so the player knows what to change.'
  if (error.value) return
  busy.value = true
  error.value = (await saveSheet({ review_note: note.value.trim() }))?.message ?? ''
  busy.value = false
  message.value = error.value ? '' : 'sent back. the player sees your note on their sheet.'
}
</script>

<template>
  <section class="decision">
    <h2 class="sheet-label">{{ pending ? 'decision' : 'gm controls' }}<span class="tag"> [gm only]</span></h2>
    <p v-if="loading" class="dim">loading...</p>
    <form v-else class="decision-body" @submit.prevent>
      <div class="numbers">
        <label>
          <span class="dim">level (gained narratively)</span>
          <input v-model.number="level" type="number" min="0" step="1" />
        </label>
        <label>
          <span class="dim">manna received (in total)</span>
          <input v-model.number="manna" type="number" min="0" step="1" />
        </label>
        <button type="button" :disabled="busy" @click="saveNumbers">save level and manna</button>
      </div>
      <template v-if="pending">
        <label>
          <span class="dim">note to the player (needed to send back)</span>
          <textarea v-model="note" rows="3"></textarea>
        </label>
        <RuleCheck :problems="problems" />
      </template>
      <p v-if="error" class="rose" role="alert">{{ error }}</p>
      <p v-else-if="message" class="dim" role="status">{{ message }}</p>
      <div v-if="pending" class="actions">
        <button type="button" :disabled="busy" @click="approve">approve pilot</button>
        <button type="button" :disabled="busy" @click="sendBack">send back with note</button>
      </div>
      <div v-else-if="pilot.status === 'approved'" class="actions">
        <button type="button" class="rose" :disabled="busy" @click="markDead">mark pilot dead</button>
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
  width: 8rem;
}

.numbers {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 0.75rem 1.5rem;
}

.numbers button {
  padding-inline: 0;
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
