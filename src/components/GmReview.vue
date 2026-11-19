<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { isOwner } from '../auth'
import { confirmAction } from '../confirm'
import { cardImages, deleteImage } from '../images'
import { checkWrite, supabase } from '../lib/supabaseClient'
import { plural } from '../text'
import type { Character } from '../myPilot'
import RuleCheck from './RuleCheck.vue'

// GMs and owners only, on the review page (opened from the gm: pilots tab or any record): a pilot's level and manna received
// (homebrew; src/rules.ts), which only GMs set, after review. Pending pilots only get the decision and note.
// Approving moves the pilot to the registry; sending back makes it a draft again for its player. Either decision saves
// the note the player sees on their sheet. "problems" is the rule check, shown above the buttons; approving with
// problems asks first. The database enforces who can do this; the page only hides it from players.
// "sheetUpdatedAt" is the sheet's updated_at from the same load as the pilot on the page (what the GM is looking at).
const props = defineProps<{ pilot: Pick<Character, 'id' | 'status' | 'callsign' | 'pilot_name' | 'updated_at' | 'submitted_at'>; sheetUpdatedAt: string; problems: string[] }>()
const emit = defineEmits<{ reviewed: [] }>()
const router = useRouter()

const level = ref(0)
const manna = ref(0)
const note = ref('')
const loading = ref(true)
const error = ref('')
const message = ref('')
const busy = ref(false)

const name = computed(() => props.pilot.callsign ?? props.pilot.pilot_name)
const pending = computed(() => props.pilot.status === 'pending')
// Only a submitted pilot can be decided on; a draft is still its player's to finish.
const submitted = computed(() => pending.value && !!props.pilot.submitted_at)

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
  return whole(level.value) && whole(manna.value) ? '' : 'Level and manna must be whole numbers, 0 or more.'
}

async function saveSheet(changes: { level?: number; manna?: number; review_note?: string | null }) {
  const { error } = await checkWrite(await supabase.from('character_sheets').update(changes).eq('character_id', props.pilot.id).select('character_id'))
  return error
}

// Level and manna save on their own button only; approving and sending back never need them.
// GMs can mark an approved pilot dead too (mark_dead in the database). It can't be undone.
async function markDead() {
  if (!(await confirmAction(`Mark ${name.value} dead? They move to the memorial. This can't be undone.`, { confirmLabel: 'Mark dead', danger: true }))) return
  busy.value = true
  const { error: deathError } = await supabase.rpc('mark_dead', { target_character_id: props.pilot.id })
  busy.value = false
  error.value = deathError?.message ?? ''
  if (!error.value) emit('reviewed')
}

// Owners only (the database enforces it): deleting a character also deletes its sheet, changes and reputation. The
// returned row proves something was deleted, since RLS turns a refused delete into "0 rows" rather than an error.
const deleteError = ref('')

async function deletePilot() {
  if (!(await confirmAction(`Delete ${name.value}? This removes their sheet, mechs and changes. This can't be undone.`, { confirmLabel: 'Delete pilot', danger: true }))) return
  busy.value = true
  const { data, error: removeError } = await supabase.from('characters').delete().eq('id', props.pilot.id).select('id, pilot_image, mechs')
  busy.value = false
  deleteError.value = removeError?.message ?? (data?.length ? '' : 'Not deleted: Only owners can delete pilots.')
  if (data?.length) cardImages(data[0]).forEach(deleteImage)
  if (!deleteError.value) router.push({ name: 'gm-pilots' })
}

async function saveNumbers() {
  error.value = numbersProblem()
  if (error.value) return
  busy.value = true
  error.value = (await saveSheet({ level: level.value, manna: manna.value })) ?? ''
  busy.value = false
  message.value = error.value ? '' : 'Saved'
  if (!error.value) emit('reviewed')
}

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
  error.value = approveError?.message ?? ''
  if (!error.value) emit('reviewed')
}

async function sendBack() {
  error.value = note.value.trim() ? '' : 'Write a note before sending back.'
  if (error.value) return
  busy.value = true
  // The note and the pilot going back to a draft are saved together.
  const { error: backError } = await supabase.rpc('send_back_pilot', { target_character_id: props.pilot.id, note: note.value })
  busy.value = false
  error.value = backError?.message ?? ''
  message.value = error.value ? '' : 'Sent back.'
  if (!error.value) emit('reviewed')
}
</script>

<template>
  <section class="panel">
    <h2 class="sheet-label">{{ pending ? 'Decision' : 'GM controls' }}<span class="private">GM only</span></h2>
    <p v-if="loading" class="dim">Loading…</p>
    <form v-else class="decision" @submit.prevent>
      <div v-if="!pending" class="numbers">
        <label class="field">
          <span>Level</span>
          <input v-model.number="level" type="number" min="0" step="1" />
        </label>
        <label class="field">
          <span>Manna received</span>
          <input v-model.number="manna" type="number" min="0" step="1" />
        </label>
        <button type="button" :disabled="busy" @click="saveNumbers">Save level and manna</button>
      </div>
      <p v-if="pending && !submitted" class="dim">Not submitted yet.</p>
      <template v-if="submitted">
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
      <div v-else-if="pilot.status === 'approved'" class="actions">
        <button type="button" class="danger" :disabled="busy" @click="markDead">Mark pilot dead</button>
      </div>
    </form>
  </section>

  <section v-if="isOwner" class="panel danger-zone">
    <h2 class="sheet-label">Danger zone<span class="private">Owner only</span></h2>
    <div class="danger-body">
      <p class="dim">Deleting {{ name }} removes their sheet, mechs and changes. This can't be undone.</p>
      <button type="button" class="danger" :disabled="busy" @click="deletePilot">Delete pilot</button>
    </div>
    <p v-if="deleteError" class="notice warn" role="alert">{{ deleteError }}</p>
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

input[type='number'] {
  width: 8rem;
}

.numbers {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--space-m) var(--space-xl);
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-s) var(--space-m);
}
</style>
