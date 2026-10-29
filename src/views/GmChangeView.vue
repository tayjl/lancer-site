<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { isGm, profile, session } from '../auth'
import { changeDiff, PUBLIC_COLUMNS, type PublicCard } from '../changeDiff'
import PageHeader from '../components/PageHeader.vue'
import RuleCheck from '../components/RuleCheck.vue'
import { useGameData } from '../gameData'
import type { Character, PendingChange, Sheet, PilotSnapshot } from '../myPilot'
import { useMechData } from '../mechData'
import { licenceName, mannaSpent, pilotProblems } from '../rules'
import { supabase } from '../lib/supabaseClient'
import type { PublicMech } from '../pilots'
import { since } from '../time'
import PilotManageView from './PilotManageView.vue'
import MechView from './MechView.vue'

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
      : null
    error.value = card.error?.message ?? sheetRow.error?.message ?? (!card.data || !sheetRow.data ? 'could not load the complete pilot record. reload before reviewing.' : '')
  }
  loading.value = false
}

watch(isGm, (gm) => gm && load(), { immediate: true })

const proposedSheet = computed(() => (change.value?.proposed_sheet ?? {}) as unknown as Sheet)
const proposedCard = computed(() => (change.value?.proposed_public ?? {}) as PublicCard)
const approvedSnapshot = computed<PilotSnapshot | undefined>(() => pilot.value && approved.value ? {
  character: pilot.value, sheet: approved.value.sheet,
  gm: { level: approved.value.level, manna: approved.value.manna },
  playerName: pilot.value.player?.display_name ?? '-',
} : undefined)
const proposedSnapshot = computed<PilotSnapshot | undefined>(() => {
  if (!approvedSnapshot.value) return undefined
  // Only public sheet fields come from a proposal; ids, ownership and status stay with the live record.
  const fields = Object.fromEntries(PUBLIC_COLUMNS.filter(key => Object.hasOwn(proposedCard.value, key)).map(key => [key, proposedCard.value[key]]))
  return {
    ...approvedSnapshot.value,
    character: { ...approvedSnapshot.value.character, ...fields } as Character,
    sheet: proposedSheet.value,
  }
})
const proposedMechs = computed(() => Array.isArray(proposedSnapshot.value?.character.mechs) ? proposedSnapshot.value.character.mechs as unknown as PublicMech[] : [])
const approvedMechs = computed(() => Array.isArray(approvedSnapshot.value?.character.mechs) ? approvedSnapshot.value.character.mechs as unknown as PublicMech[] : [])
const showApproved = ref(false)
const comparison = computed(() => change.value?.status === 'pending' ? approvedSnapshot.value : undefined)
const name = computed(() => pilot.value?.callsign ?? pilot.value?.pilot_name ?? 'a pilot')
const waiting = computed(() => change.value?.status === 'pending' && !!change.value.submitted_at)

// --- What changes, grouped by section in the order changeDiff gives ---
const sections = computed(() => {
  if (!change.value || !pilot.value || !approved.value) return []
  const find = <T extends { id: string | number; name: string }>(list: T[], id: string | number) => list.find((x) => x.id === id)?.name ?? String(id)
  const card = Object.fromEntries(PUBLIC_COLUMNS.map((column) => [column, pilot.value![column]])) as PublicCard
  const lines = changeDiff(
    { card, sheet: approved.value.sheet },
    { card: proposedSnapshot.value?.character as unknown as PublicCard ?? proposedCard.value, sheet: proposedSheet.value },
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
  <main class="page change-page">
    <RouterLink :to="{ name: 'gm-changes' }" class="back">&lt; gm: changes</RouterLink>
    <PageHeader :title="`change: ${name}`" />

    <p v-if="!profile" class="dim">loading change...</p>
    <p v-else-if="!isGm" class="rose">access denied. gm clearance required.</p>
    <p v-else-if="loading" class="dim">loading change...</p>
    <p v-else-if="!change || !pilot || !approved" class="rose" role="alert">{{ error }}</p>
    <template v-else>
      <p class="meta dim">
        {{ pilot?.pilot_name }}, played by {{ pilot?.player?.display_name ?? '-' }}.
        <template v-if="waiting">submitted {{ since(change.submitted_at!) }} ago.</template>
        <template v-else-if="change.status === 'pending'">still a draft: the player hasn't submitted it.</template>
        <template v-else>{{ change.status }}{{ change.reviewed_at ? ` ${since(change.reviewed_at)} ago` : '' }}.</template>
        <RouterLink v-if="pilot" :to="{ name: 'gm-review', params: { id: pilot.id } }">approved record and gm controls</RouterLink>
      </p>

      <section class="manna-summary">
        <h2>manna</h2>
        <p v-if="comparison">
          this change costs <strong class="lilac">{{ spentAfter - spentBefore }}</strong> manna.
          <span :class="{ rose: left < 0 }">{{ left }} left after it</span>
          <span class="dim"> ({{ approved?.manna ?? 0 }} received, {{ spentBefore }} spent before, {{ spentAfter }} spent after; level {{ approved?.level ?? 0 }}).</span>
        </p>
        <p v-else>this proposal spends <strong class="lilac">{{ spentAfter }}</strong> manna in total. The original cost of this reviewed change is not stored.</p>
      </section>

      <template v-if="proposedSnapshot">
        <h2>full proposed character</h2>
        <p v-if="comparison" class="legend">
          <span class="sky">underlined blue text is added</span>;
          <span class="rose">struck-through red text is removed</span>.
          A blue edge marks changed sections. Expand the current approved character below to compare equipment and stats.
        </p>
        <p v-else class="dim">this is the reviewed proposal. the current record may include later edits; the original pre-review version is not stored.</p>
        <details v-if="comparison" class="change-summary">
          <summary>changes at a glance</summary>
          <p v-if="!sections.length" class="dim">nothing: the proposed pilot matches the current one.</p>
          <div v-else class="changes">
            <div v-for="[section, lines] in sections" :key="section" class="group">
              <h3>{{ section }}</h3>
              <ul><li v-for="line in lines" :key="line">{{ line }}</li></ul>
            </div>
          </div>
        </details>
        <p v-if="stale && comparison" class="rose">this proposal is compared with the current record, which has changed since submission. approval is blocked.</p>
        <PilotManageView :key="`proposed-${change.id}`" :snapshot="proposedSnapshot" :before="comparison" />
        <section v-for="mech in proposedMechs" :id="`review-mech-${mech.id}`" :key="mech.id" class="mech-review">
          <h2>mech: {{ mech.name }}</h2>
          <p v-if="comparison && !approvedMechs.some(old => old.id === mech.id)" class="sky">new mech</p>
          <MechView :snapshot="proposedSnapshot" :before="comparison" :preview-mech-id="mech.id" />
        </section>
        <p v-for="mech in approvedMechs.filter(old => !proposedMechs.some(next => next.id === old.id))" :key="`removed-${mech.id}`" class="rose">
          removed mech: {{ mech.name }}. Its previous sheet is in the current approved character below.
        </p>
        <details v-if="approvedSnapshot" class="approved-record" @toggle="showApproved = ($event.target as HTMLDetailsElement).open">
          <summary>view current approved character</summary>
          <template v-if="showApproved">
            <PilotManageView :snapshot="approvedSnapshot" mech-anchor-prefix="approved-mech" />
            <section v-for="mech in approvedMechs" :id="`approved-mech-${mech.id}`" :key="mech.id" class="mech-review">
              <h2>mech: {{ mech.name }}</h2>
              <MechView :snapshot="approvedSnapshot" :preview-mech-id="mech.id" />
            </section>
          </template>
        </details>
      </template>

      <section v-if="waiting" class="decision">
        <h2>decision <span class="dim">[gm only]</span></h2>
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
        <h2>rejected</h2>
        <p class="note">{{ change.review_reason }}</p>
      </section>
    </template>
  </main>
</template>

<style scoped>
.change-page { min-width: 0; max-width: none; }
h2 { font-size: clamp(1.5rem, 2.5vw, 2rem); }
.manna-summary { padding: 1.25rem; border: 1px solid var(--rule); }
.manna-summary p, .legend { max-width: none; margin: 0; }
.legend { margin-bottom: 1.25rem; }
.change-summary { margin: 1.25rem 0; }
summary { cursor: pointer; color: var(--lilac); font: 600 1.125rem/1.5 var(--mono); }
.approved-record { margin: 2rem 0; padding: 1.25rem; border: 1px solid var(--rule); }
.approved-record > summary { margin-bottom: 1.25rem; }
.mech-review { margin-top: 2rem; scroll-margin-top: 5rem; }

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
  max-width: none;
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
