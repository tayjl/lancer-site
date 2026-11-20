<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { isOwner } from '../auth'
import { confirmAction } from '../confirm'
import type { usePilotAwards } from '../commendations'
import { cardImages, deleteImage } from '../images'
import { supabase } from '../lib/supabaseClient'
import { EXPERIENCE_MAX, award, levelUp, rewardsProblem } from '../rewards'
import { plural } from '../text'
import type { Character } from '../myPilot'
import CommendationAward from './CommendationAward.vue'
import ReputationPanel from './ReputationPanel.vue'
import RewardHistory from './RewardHistory.vue'
import RuleCheck from './RuleCheck.vue'

// GMs and owners only, on the review page (opened from the gm: pilots tab or any record): a pilot's level and manna received
// (homebrew; src/rules.ts) and experience (0 to 1000, GM only, in its own table), which only GMs set, after review; every
// change is logged with an optional reason (src/rewards.ts), and the log is listed below. Pending pilots only get the decision and note.
// Approving moves the pilot to the registry; sending back makes it a draft again for its player. Either decision saves
// the note the player sees on their sheet. "problems" is the rule check, shown above the buttons; approving with
// problems asks first. The database enforces who can do this; the page only hides it from players.
// "sheetUpdatedAt" is the sheet's updated_at from the same load as the pilot on the page (what the GM is looking at).
const props = defineProps<{ pilot: Pick<Character, 'id' | 'status' | 'callsign' | 'pilot_name' | 'updated_at' | 'submitted_at'>; sheetUpdatedAt: string; problems: string[]; awards: ReturnType<typeof usePilotAwards> }>()
const emit = defineEmits<{ reviewed: []; awarded: [] }>()
const router = useRouter()

const level = ref(0)
const manna = ref(0)
const experience = ref(0)
const reason = ref('')
// What the database held when the fields were filled, so only the fields the GM changed are sent.
const loaded = ref({ level: 0, manna: 0, experience: 0 })
const historyKey = ref(0)
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
  const [{ data, error: loadError }, { data: progress, error: progressError }] = await Promise.all([
    supabase.from('character_sheets').select('level, manna, review_note').eq('character_id', props.pilot.id).maybeSingle(),
    supabase.from('pilot_progress').select('experience').eq('character_id', props.pilot.id).maybeSingle(),
  ])
  error.value = loadError?.message ?? progressError?.message ?? ''
  level.value = data?.level ?? 0
  manna.value = data?.manna ?? 0
  experience.value = progress?.experience ?? 0
  loaded.value = { level: level.value, manna: manna.value, experience: experience.value }
  note.value = data?.review_note ?? ''
  loading.value = false
}

load()

// Rewards save on their own button only; approving and sending back never need them.
// GMs can mark an approved pilot dead too (mark_dead in the database). It can't be undone.
const dangerError = ref('') // the danger zone's own error, shown under its buttons
async function markDead() {
  if (!(await confirmAction(`Mark ${name.value} dead? They move to the memorial. This can't be undone.`, { confirmLabel: 'Mark dead', danger: true }))) return
  busy.value = true
  const { error: deathError } = await supabase.rpc('mark_dead', { target_character_id: props.pilot.id })
  busy.value = false
  dangerError.value = deathError ? `Not saved: ${deathError.message}` : ''
  if (!dangerError.value) emit('reviewed')
}

// Owners only (the database enforces it): deleting a character also deletes its sheet, changes and reputation. The
// returned row proves something was deleted, since RLS turns a refused delete into "0 rows" rather than an error.

async function deletePilot() {
  if (!(await confirmAction(`Delete ${name.value}? This removes their sheet, mechs and changes. This can't be undone.`, { confirmLabel: 'Delete pilot', danger: true }))) return
  busy.value = true
  const { data, error: removeError } = await supabase.from('characters').delete().eq('id', props.pilot.id).select('id, pilot_image, mechs')
  busy.value = false
  dangerError.value = removeError ? `Not deleted: ${removeError.message}` : (data?.length ? '' : 'Not deleted: Only owners can delete pilots.')
  if (data?.length) cardImages(data[0]).forEach(deleteImage)
  if (!dangerError.value) router.push({ name: 'gm-pilots' })
}

// After a reward change: show what the database now holds and refresh the history.
async function rewarded(failure: string | null, done: string) {
  error.value = failure ?? ''
  message.value = failure ? '' : done
  if (failure) return
  reason.value = ''
  await load()
  historyKey.value++
  emit('reviewed')
}

async function saveRewards() {
  const changes = {
    ...(level.value !== loaded.value.level && { level: level.value }),
    ...(manna.value !== loaded.value.manna && { manna: manna.value }),
    ...(experience.value !== loaded.value.experience && { experience: experience.value }),
  }
  error.value = rewardsProblem({ level: level.value, manna: manna.value, experience: experience.value }) || (Object.keys(changes).length ? '' : 'Nothing has changed.')
  message.value = ''
  if (error.value) return
  busy.value = true
  await rewarded(await award(props.pilot.id, changes, reason.value), 'Saved')
  busy.value = false
}

// Spends 1000 experience on one level (level_up in the database), logged with the reason or "Level up".
async function levelUpNow() {
  if (!(await confirmAction(`Level ${name.value} up to level ${loaded.value.level + 1}? This spends ${EXPERIENCE_MAX} experience.`, { confirmLabel: 'Level up' }))) return
  busy.value = true
  await rewarded(await levelUp(props.pilot.id, reason.value), 'Levelled up')
  busy.value = false
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
  <section>
    <h3 class="sheet-label">{{ pending ? 'Decision' : 'Rewards' }}<span class="private gm">GM only</span></h3>
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
        <label class="field">
          <span>Experience</span>
          <input v-model.number="experience" type="number" min="0" :max="EXPERIENCE_MAX" step="1" />
        </label>
        <label class="field reason">
          <span>Reason</span>
          <input v-model="reason" type="text" maxlength="200" placeholder="Optional, e.g. Mission 3" />
        </label>
        <button type="button" :disabled="busy" @click="saveRewards">Save rewards</button>
        <button v-if="loaded.experience >= EXPERIENCE_MAX" type="button" :disabled="busy" @click="levelUpNow">Level up</button>
        <span v-if="loaded.experience >= EXPERIENCE_MAX" class="badge">Ready to level</span>
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
    </form>
  </section>

  <ReputationPanel v-if="pilot.status !== 'dead'" :character-id="pilot.id" />
  <CommendationAward :awards="awards" @awarded="emit('awarded')" />

  <RewardHistory :character-id="pilot.id" :refresh="historyKey" />

  <!-- Last of the GM controls: marking dead (GMs) and deleting (owners only). -->
  <section v-if="isOwner || pilot.status === 'approved'" class="panel danger-zone">
    <h3 class="sheet-label">Danger zone<span class="private gm">{{ pilot.status === 'approved' ? 'GM only' : 'Owner only' }}</span></h3>
    <div v-if="pilot.status === 'approved'" class="danger-body">
      <p class="dim">Mark {{ name }} dead if they die in the story. This can't be undone.</p>
      <button type="button" class="danger" :disabled="busy" @click="markDead">Mark pilot dead</button>
    </div>
    <div v-if="isOwner" class="danger-body">
      <p class="dim">
        Deleting {{ name }} removes their sheet, mechs and changes. This can't be undone.<span v-if="pilot.status === 'approved'" class="private gm">Owner only</span>
      </p>
      <button type="button" class="danger" :disabled="busy" @click="deletePilot">Delete pilot</button>
    </div>
    <p v-if="dangerError" class="notice warn" role="alert">{{ dangerError }}</p>
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

.reason {
  flex: 1 1 16rem;
}

.reason input {
  width: 100%;
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

/* Phones: "Manna received" can't fit a third of the width, so every field and button takes the full width, one under
   another. The decision's buttons share a row in equal columns when both fit. */
@media (max-width: 40rem) {
  .numbers {
    display: grid;
  }

  input[type='number'] {
    width: 100%;
  }

  .numbers > .badge {
    justify-self: start;
  }

  .actions {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
  }
}
</style>
