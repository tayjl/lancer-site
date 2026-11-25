<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { REASON_MAX, loadCommendations, type Commendation, usePilotAwards } from '../commendations'
import { offered } from '../catalogue'
import { confirmAction } from '../confirm'
import { formatDate } from '../time'
import MedalBadge from './MedalBadge.vue'

// GM review: award a commendation (with an optional reason) and take back what the pilot has. GMs and owners only; the
// database refuses anyone else. "awards" is the page's list for this pilot, so the profile's medals update at once;
// "awarded" tells the page to reload the service record too (an award writes an automatic entry there).
const props = defineProps<{ awards: ReturnType<typeof usePilotAwards> }>()
const emit = defineEmits<{ awarded: [] }>()

const choices = ref<Commendation[]>([])
const choicesError = ref('')
const loadedChoices = ref(false)
const chosen = ref('')
const reason = ref('')
const busy = ref(false)
const error = ref('')
const message = ref('')

onMounted(async () => {
  const { rows, error: failed } = await loadCommendations()
  choices.value = offered(rows)
  choicesError.value = failed ?? ''
  loadedChoices.value = true
})

const why = computed(() => (!chosen.value ? 'Pick a commendation first.' : ''))

async function give() {
  if (why.value || busy.value) return
  busy.value = true
  error.value = ''
  message.value = ''
  const failed = await props.awards.award(chosen.value, reason.value)
  busy.value = false
  if (failed) return (error.value = `Not awarded: ${failed}`)
  message.value = `Awarded ${choices.value.find((c) => c.id === chosen.value)?.name ?? 'the commendation'}.`
  chosen.value = ''
  reason.value = ''
  emit('awarded')
}

async function revoke(id: string, name: string) {
  if (!(await confirmAction(`Revoke ${name}? The pilot loses it. This can't be undone.`, { confirmLabel: 'Revoke', danger: true }))) return
  error.value = ''
  message.value = ''
  const failed = await props.awards.revoke(id)
  if (failed) error.value = `Not revoked: ${failed}`
}
</script>

<template>
  <section>
    <h3 class="sheet-label">Commendations<span class="private gm">GM only</span></h3>
    <p v-if="choicesError" class="notice warn" role="alert">The list didn't load: {{ choicesError }}</p>
    <p v-else-if="loadedChoices && !choices.length" class="empty">No commendations exist yet. An owner makes them in the content editor.</p>
    <form v-else class="award" @submit.prevent="give">
      <label class="field">
        <span>Commendation</span>
        <select v-model="chosen">
          <option value="">Choose…</option>
          <option v-for="commendation in choices" :key="commendation.id" :value="commendation.id">{{ commendation.name }}</option>
        </select>
      </label>
      <label class="field reason">
        <span>Reason (optional)</span>
        <input v-model="reason" type="text" :maxlength="REASON_MAX" autocomplete="off" placeholder="Shown with the medal and in the service record" />
      </label>
      <span v-if="why" class="blocked">
        <button type="button" class="primary small" disabled aria-describedby="award-why">Award</button>
        <span id="award-why" class="blocked-reason">{{ why }}</span>
      </span>
      <button v-else type="submit" class="primary small" :disabled="busy">Award</button>
    </form>
    <p v-if="error" class="notice warn" role="alert">{{ error }}</p>
    <p v-else-if="message" class="notice ok" role="status">{{ message }}</p>

    <h4 class="label held-title">This pilot has</h4>
    <p v-if="!awards.awards.value.length" class="empty">No commendations yet.</p>
    <ul v-else class="held">
      <li v-for="award in awards.awards.value" :key="award.id">
        <MedalBadge :icon="award.commendation.icon" :name="award.commendation.name" />
        <span class="dim detail">{{ award.reason ? `${award.reason} · ` : '' }}{{ award.by ?? 'A GM' }}, {{ formatDate(award.awarded_at) }}</span>
        <button type="button" class="quiet small" @click="revoke(award.id, award.commendation.name)">Revoke</button>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.award {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--space-m);
}

.reason {
  flex: 1 1 16rem;
}

/* A long commendation name doesn't widen the list past a phone's screen. */
.award .field,
.award select {
  min-width: 0;
  max-width: 100%;
}

.reason input {
  width: 100%;
}

.held-title {
  margin: var(--space-l) 0 var(--space-s);
  color: var(--text-dim);
  font-size: var(--fs-xs);
}

.held {
  display: grid;
  gap: var(--space-s);
  margin: 0;
  padding: 0;
  list-style: none;
}

.held li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-s) var(--space-m);
  padding-top: var(--space-s);
  border-top: 1px solid var(--rule);
}

.detail {
  flex: 1 1 12rem;
  font-size: var(--fs-s);
  overflow-wrap: anywhere;
}

.notice {
  margin: var(--space-m) 0 0;
}
</style>
