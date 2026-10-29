<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { isGm, profile, session } from '../auth'
import { changeDiff, PUBLIC_COLUMNS, type PublicCard } from '../changeDiff'
import PageHeader from '../components/PageHeader.vue'
import RuleCheck from '../components/RuleCheck.vue'
import { useGameData } from '../gameData'
import type { Character, PendingChange, Sheet } from '../myPilot'
import { useMechData } from '../mechData'
import { licenceName, mannaSpent, pilotProblems } from '../rules'
import { supabase } from '../lib/supabaseClient'
import type { PublicMech } from '../pilots'
import { since } from '../time'

// One pending change (opened from gm: changes): what it changes, in plain words, against the approved
// pilot; what it costs in manna; the rule check on the proposed sheet; then approve or reject. GMs approve
// or reject the whole change. Approving runs approve_change (all-or-nothing, in the database), which refuses
// if the pilot changed since the change was started. Rejecting needs a reason the player sees.

const route = useRoute()
const router = useRouter()
const change = shallowRef<PendingChange | null>(null)
const pilot = shallowRef<(Character & { player: { display_name: string } | null }) | null>(null)
const approved = shallowRef<{ sheet: Sheet; level: number; manna: number; updated_at: string } | null>(null)
const loading = ref(true)
const error = ref('')

const { gear, bionics, pilotStats, talents, coreBonuses } = useGameData()
const { frames, weapons, systems, integrated } = useMechData()

async function load() {
  const { data: row, error: loadError } = await supabase.from('pending_changes').select('*').eq('id', Number(route.params.id)).maybeSingle()
  change.value = row
  error.value = loadError?.message ?? (row ? '' : 'no change with that id.')
  if (row) {
    const [card, sheetRow] = await Promise.all([
      supabase.from('characters').select('*, player:profiles(display_name)').eq('id', row.character_id).maybeSingle(),
      supabase.from('character_sheets').select('sheet, level, manna, updated_at').eq('character_id', row.character_id).maybeSingle(),
    ])
    pilot.value = card.data
    approved.value = sheetRow.data
      ? { ...sheetRow.data, sheet: sheetRow.data.sheet as unknown as Sheet }
      : { sheet: {}, level: 0, manna: 0, updated_at: '' }
  }
  loading.value = false
}

watch(isGm, (gm) => gm && load(), { immediate: true })

const proposedSheet = computed(() => (change.value?.proposed_sheet ?? {}) as unknown as Sheet)
const proposedCard = computed(() => (change.value?.proposed_public ?? {}) as PublicCard)
const name = computed(() => pilot.value?.callsign ?? pilot.value?.pilot_name ?? 'a pilot')
const waiting = computed(() => change.value?.status === 'pending' && !!change.value.submitted_at)

// --- What changes, grouped by section in the order changeDiff gives ---
const sections = computed(() => {
  if (!change.value || !pilot.value || !approved.value) return []
  const find = <T extends { id: string | number; name: string }>(list: T[], id: string | number) => list.find((x) => x.id === id)?.name ?? String(id)
  const card = Object.fromEntries(PUBLIC_COLUMNS.map((column) => [column, pilot.value![column]])) as PublicCard
  const lines = changeDiff(
    { card, sheet: approved.value.sheet },
    { card: proposedCard.value, sheet: proposedSheet.value },
    {
      stat: (id) => find(pilotStats.value, id).toLowerCase(),
      licence: (id) => licenceName(frames.value, id),
      talent: (id) => find(talents.value, id),
      coreBonus: (id) => find(coreBonuses.value, id),
      bionic: (id) => find(bionics.value, id),
      gear: (id) => find(gear.value, id),
      frame: (id) => licenceName(frames.value, id),
      weapon: (id) => find(weapons.value, id),
      system: (id) => find(systems.value, id),
    },
  )
  const groups = new Map<string, string[]>()
  for (const line of lines) groups.set(line.section, [...(groups.get(line.section) ?? []), line.text])
  return [...groups]
})

// --- Manna: what the change costs, and what's left after it ---
const spentBefore = computed(() => mannaSpent(approved.value?.sheet ?? {}))
const spentAfter = computed(() => mannaSpent(proposedSheet.value))
const left = computed(() => (approved.value?.manna ?? 0) - spentAfter.value)

// --- The rule check on the proposed sheet, and whether the pilot changed since the change was started ---
const problems = computed(() =>
  frames.value.length && approved.value
    ? pilotProblems(
        proposedSheet.value,
        { level: approved.value.level, manna: approved.value.manna },
        {
          frames: frames.value,
          weapons: new Map(weapons.value.map((w) => [w.id, w])),
          systems: new Map(systems.value.map((s) => [s.id, s])),
          integrated: integrated.value,
          bionicCosts: new Map(bionics.value.map((b) => [b.id, b.mod_point_cost])),
        },
        Object.fromEntries(
          (Array.isArray(proposedCard.value.mechs) ? (proposedCard.value.mechs as unknown as PublicMech[]) : []).map((m) => [m.id, m.name]),
        ),
      )
    : [],
)
const stale = computed(() => {
  if (!change.value || !pilot.value) return false
  const last = [pilot.value.updated_at, approved.value?.updated_at ?? ''].sort().at(-1)!
  return new Date(last) > new Date(change.value.based_on)
})

// --- The decision ---
const reason = ref('')
const busy = ref(false)

async function approve() {
  const warning = problems.value.length ? ` the rule check lists ${problems.value.length} problem(s).` : ''
  if (!window.confirm(`approve this change to ${name.value}? it goes live straight away.${warning}`)) return
  busy.value = true
  const { error: approveError } = await supabase.rpc('approve_change', { change_id: change.value!.id })
  busy.value = false
  error.value = approveError?.message ?? ''
  if (!error.value) router.push({ name: 'gm-changes' })
}

async function reject() {
  if (!reason.value.trim()) {
    error.value = 'write a reason first, so the player knows what to fix.'
    return
  }
  busy.value = true
  const { error: rejectError } = await supabase
    .from('pending_changes')
    .update({ status: 'rejected', review_reason: reason.value.trim(), reviewed_by: session.value!.user.id, reviewed_at: new Date().toISOString() })
    .eq('id', change.value!.id)
  busy.value = false
  error.value = rejectError?.message ?? ''
  if (!error.value) router.push({ name: 'gm-changes' })
}
</script>

<template>
  <main class="page">
    <RouterLink :to="{ name: 'gm-changes' }" class="back">&lt; gm: changes</RouterLink>
    <PageHeader :title="`change: ${name}`" />

    <p v-if="!profile || loading" class="dim">loading change...</p>
    <p v-else-if="!isGm" class="rose">access denied. gm clearance required.</p>
    <p v-else-if="!change" class="rose" role="alert">{{ error }}</p>
    <template v-else>
      <p class="meta dim">
        {{ pilot?.pilot_name }}, played by {{ pilot?.player?.display_name ?? '-' }}.
        <template v-if="waiting">submitted {{ since(change.submitted_at!) }} ago.</template>
        <template v-else-if="change.status === 'pending'">still a draft: the player hasn't submitted it.</template>
        <template v-else>{{ change.status }}{{ change.reviewed_at ? ` ${since(change.reviewed_at)} ago` : '' }}.</template>
        <RouterLink v-if="pilot" :to="{ name: 'gm-review', params: { id: pilot.id } }">approved record and gm controls</RouterLink>
      </p>

      <section>
        <h2 class="sheet-label">what changes</h2>
        <p v-if="!sections.length" class="dim note">nothing: the proposed pilot matches the approved one.</p>
        <div v-else class="changes">
          <div v-for="[section, lines] in sections" :key="section" class="group">
            <h3>{{ section }}</h3>
            <ul>
              <li v-for="line in lines" :key="line">{{ line }}</li>
            </ul>
          </div>
        </div>
      </section>

      <section>
        <h2 class="sheet-label">manna</h2>
        <p class="note">
          this change costs <strong class="lilac">{{ spentAfter - spentBefore }}</strong> manna.
          <span :class="{ rose: left < 0 }">{{ left }} left after it</span>{{ ' ' }}<span class="dim"
            >({{ approved?.manna ?? 0 }} received, level {{ approved?.level ?? 0 }}).</span
          >
        </p>
      </section>

      <section v-if="waiting" class="decision">
        <h2 class="sheet-label">decision<span class="tag"> [gm only]</span></h2>
        <div class="decision-body">
          <p v-if="stale" class="rose">
            this pilot changed after the change was started, so approving would overwrite that. reject it so the player can
            start again.
          </p>
          <RuleCheck :problems="problems" />
          <label>
            <span class="dim">reason (needed to reject)</span>
            <textarea v-model="reason" rows="3"></textarea>
          </label>
          <p v-if="error" class="rose" role="alert">{{ error }}</p>
          <div class="actions">
            <button type="button" :disabled="busy || stale" @click="approve">approve change</button>
            <button type="button" :disabled="busy" @click="reject">reject with reason</button>
          </div>
        </div>
      </section>
      <section v-else-if="change.status === 'rejected'">
        <h2 class="sheet-label">rejected</h2>
        <p class="note">{{ change.review_reason }}</p>
      </section>
    </template>
  </main>
</template>

<style scoped>
.back {
  display: inline-block;
  margin-bottom: 1rem;
  color: var(--text-dim);
  font-size: 0.875rem;
  text-decoration: none;
}

.back:hover {
  color: var(--lilac);
}

.meta {
  margin: -0.5rem 0 1.5rem;
  font-size: 0.875rem;
}

.meta a {
  margin-left: 0.5rem;
}

section {
  margin-bottom: 1.75rem;
}

.note {
  margin: 0.6rem 0 0;
  font-size: 0.875rem;
}

/* Each section of the change as a small list, side by side on wide screens. */
.changes {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
  gap: 0.75rem;
  margin-top: 0.6rem;
}

.group {
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--rule);
}

.group h3 {
  margin: 0 0 0.35rem;
  color: var(--lilac);
  font-size: 0.875rem;
}

.group ul {
  margin: 0;
  padding-left: 1.1rem;
  font-size: 0.875rem;
}

.decision-body {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 0.6rem;
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
textarea {
  width: 100%;
  padding: 0.45rem 0.6rem;
  border: 1px solid var(--rule);
  background: none;
  color: var(--text);
  font: 400 0.9375rem/1.4 var(--mono);
  resize: vertical;
}

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
