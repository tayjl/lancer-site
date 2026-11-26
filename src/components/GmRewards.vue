<script setup lang="ts">
import { ref, watch } from 'vue'
import { confirmAction } from '../confirm'
import { readError, supabase } from '../lib/supabaseClient'
import { EXPERIENCE_MAX, award, levelUp, rewardsProblem } from '../rewards'
import { useSaveStatus } from '../saveStatus'
import type { Character } from '../myPilot'
import SaveStatus from './SaveStatus.vue'

// The GM's rewards row in the edit bar: a pilot's level and manna received (homebrew; src/rules.ts) and experience (0 to
// 1000, in its own table). Every change is logged with an optional reason (src/rewards.ts). The database enforces who can do this.
const props = defineProps<{ pilot: Pick<Character, 'id' | 'callsign' | 'pilot_name'> }>()
const emit = defineEmits<{ saved: [] }>()

const level = ref(0)
const manna = ref(0)
const experience = ref(0)
const reason = ref('')
// What the database held when the fields were filled, so only the fields the GM changed are sent.
const loaded = ref({ level: 0, manna: 0, experience: 0 })
const loading = ref(true)
const loadError = ref('')
const status = useSaveStatus()

async function load() {
  const [{ data, error }, { data: progress, error: progressError }] = await Promise.all([
    supabase.from('character_sheets').select('level, manna').eq('character_id', props.pilot.id).maybeSingle(),
    supabase.from('pilot_progress').select('experience').eq('character_id', props.pilot.id).maybeSingle(),
  ])
  const failed = error?.message ?? progressError?.message
  loadError.value = failed ? readError(failed) : ''
  if (!loadError.value) {
    level.value = data?.level ?? 0
    manna.value = data?.manna ?? 0
    experience.value = progress?.experience ?? 0
    loaded.value = { level: level.value, manna: manna.value, experience: experience.value }
  }
  loading.value = false
}

load()

// A refused save's message ("Nothing has changed.") goes once the GM edits a field again.
watch([level, manna, experience, reason], () => (status.error.value = ''))

// After a reward change: show what the database now holds and let the page refresh its figures and the history.
async function finish(failure: string | null) {
  if (failure) return failure
  reason.value = ''
  await load()
  emit('saved')
  return null
}

function saveRewards() {
  const changes = {
    ...(level.value !== loaded.value.level && { level: level.value }),
    ...(manna.value !== loaded.value.manna && { manna: manna.value }),
    ...(experience.value !== loaded.value.experience && { experience: experience.value }),
  }
  const problem = rewardsProblem({ level: level.value, manna: manna.value, experience: experience.value }) || (Object.keys(changes).length ? '' : 'Nothing has changed.')
  if (problem) status.error.value = problem
  else status.track(award(props.pilot.id, changes, reason.value).then(finish))
}

// Spends 1000 experience on one level (level_up in the database), logged with the reason or "Level up".
async function levelUpNow() {
  const name = props.pilot.callsign ?? props.pilot.pilot_name
  if (!(await confirmAction(`Level ${name} up to level ${loaded.value.level + 1}? This spends ${EXPERIENCE_MAX} experience.`, { confirmLabel: 'Level up' }))) return
  status.track(levelUp(props.pilot.id, reason.value).then(finish))
}
</script>

<template>
  <p v-if="loading" class="dim">Loading…</p>
  <p v-else-if="loadError" class="notice warn" role="alert">
    Rewards didn't load: {{ loadError }}
    <button type="button" class="small" @click="load">Retry</button>
  </p>
  <form v-else class="rewards" @submit.prevent="saveRewards">
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
    <div class="actions">
      <button type="submit" class="small" :disabled="status.saving.value">Save rewards</button>
      <button v-if="loaded.experience >= EXPERIENCE_MAX" type="button" class="small" :disabled="status.saving.value" @click="levelUpNow">Level up</button>
      <span v-if="loaded.experience >= EXPERIENCE_MAX" class="badge">Ready to level</span>
      <SaveStatus :saving="status.saving.value" :saved="status.saved.value" :error="status.error.value" :can-retry="false" />
    </div>
  </form>
</template>

<style scoped>
@media (max-width: 48rem) {
  .actions button {
    min-height: var(--tap);
  }
}

.rewards {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--space-s) var(--space-l);
}

input[type='number'] {
  width: 7rem;
}

.reason {
  flex: 1 1 14rem;
}

.reason input {
  width: 100%;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-s) var(--space-m);
}

p {
  margin: 0;
}

@media (max-width: 40rem) {
  .rewards {
    display: grid;
    grid-template-columns: 1fr 1fr;
  }

  input[type='number'] {
    width: 100%;
  }

  .reason,
  .actions {
    grid-column: 1 / -1;
  }

  .actions button {
    flex: 1 1 auto;
  }
}
</style>
