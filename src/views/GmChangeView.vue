<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { isGm, profile, session } from '../auth'
import { confirmAction } from '../confirm'
import { changeDiff, PUBLIC_COLUMNS, type PublicCard, type DiffLine } from '../changeDiff'
import PageHeader from '../components/PageHeader.vue'
import RuleCheck from '../components/RuleCheck.vue'
import RichText from '../components/RichText.vue'
import { useGameData } from '../gameData'
import type { Character, PendingChange, Sheet } from '../myPilot'
import { useMechData } from '../mechData'
import { licenceName, mannaSpent, pilotProblems, personalStatProblems } from '../rules'
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
      : null
    error.value = card.error?.message ?? sheetRow.error?.message ?? (!card.data || !sheetRow.data ? 'could not load the complete pilot record. reload before reviewing.' : '')
  }
  loading.value = false
}

watch(isGm, (gm) => gm && load(), { immediate: true })

const proposedSheet = computed(() => (change.value?.proposed_sheet ?? {}) as unknown as Sheet)
const proposedCard = computed(() => (change.value?.proposed_public ?? {}) as PublicCard)
const pending = computed(() => change.value?.status === 'pending')
const name = computed(() => pilot.value?.callsign ?? pilot.value?.pilot_name ?? 'a pilot')
const waiting = computed(() => change.value?.status === 'pending' && !!change.value.submitted_at)

// --- What changes, grouped by section in the order changeDiff gives ---
const lines = computed(() => {
  if (!change.value || !pilot.value || !approved.value) return []
  const find = <T extends { id: string | number; name: string }>(list: T[], id: string | number) => list.find((x) => x.id === id)?.name ?? String(id)
  const card = Object.fromEntries(PUBLIC_COLUMNS.map((column) => [column, pilot.value![column]])) as PublicCard
  return changeDiff(
    { card, sheet: approved.value.sheet },
    { card: { ...card, ...proposedCard.value }, sheet: proposedSheet.value },
    {
      stat: (id) => find(pilotStats.value, id).toLowerCase(),
      licence: (id) => licenceName(frames.value, id),
      talent: (id) => find(talents.value, id),
      coreBonus: (id) => find(coreBonuses.value, id),
      bionic: (id) => find(bionics.value, id),
      gear: (id) => find(gear.value, id),
      frame: (id) => licenceName(frames.value, id),
      weapon: (id) => find([...weapons.value, ...integrated.value.values()], id),
      system: (id) => find([...systems.value, ...integrated.value.values()], id),
    },
  )
})

function grouped(items: DiffLine[]) {
  const groups = new Map<string, DiffLine[]>()
  for (const line of items) groups.set(line.section, [...(groups.get(line.section) ?? []), line])
  return [...groups]
}
const sections = computed(() => {
  const priority = ['personal stats', 'piloting stats', 'licences', 'bionics', 'loadout', 'core bonuses', 'talents']
  const order = (section: string) => {
    const index = priority.indexOf(section)
    return index >= 0 ? index : section.startsWith('mech') ? priority.length : priority.length + 1
  }
  return grouped(lines.value).sort(([a], [b]) => order(a) - order(b))
})
const changeKinds = [
  { kind: 'addition', label: 'added / increased', symbol: '+' },
  { kind: 'removal', label: 'removed / reduced', symbol: '−' },
  { kind: 'edit', label: 'updated', symbol: '~' },
] as const

// --- Manna: what the change costs, and what's left after it ---
const spentBefore = computed(() => mannaSpent(approved.value?.sheet ?? {}))
const spentAfter = computed(() => mannaSpent(proposedSheet.value))
const cost = computed(() => spentAfter.value - spentBefore.value)
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
          coreBonuses: coreBonuses.value,
          talents: talents.value,
          gear: gear.value,
        },
        Object.fromEntries(
          (Array.isArray(proposedCard.value.mechs) ? (proposedCard.value.mechs as unknown as PublicMech[]) : []).map((m) => [m.id, m.name]),
        ),
      )
    : personalStatProblems(proposedSheet.value.pilot_stats),
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
  if (!(await confirmAction(`approve this change to ${name.value}? it goes live straight away.${warning}`, { confirmLabel: 'approve change' }))) return
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
    <PageHeader :title="`change: ${name}`" :crumbs="[{ label: 'gm: changes', to: { name: 'gm-changes' } }, { label: name }]" />

    <p v-if="!profile" class="dim">loading change...</p>
    <p v-else-if="!isGm" class="notice warn" role="alert">access denied. gm clearance required.</p>
    <p v-else-if="loading" class="empty">loading change...</p>
    <p v-else-if="!change || !pilot || !approved" class="notice warn" role="alert">{{ error }}</p>
    <template v-else>
      <!-- The summary strip: whose change, and the manna. Sticks under the top bar on wide, tall screens. -->
      <section class="strip panel" aria-label="Change summary">
        <div class="who">
          <p class="pilot-name">{{ pilot?.pilot_name }}</p>
          <p class="dim">
            played by <span class="rose">{{ pilot?.player?.display_name ?? '-' }}</span>.
            <template v-if="waiting">submitted {{ since(change.submitted_at!) }} ago.</template>
            <template v-else-if="change.status === 'pending'">still a draft: the player hasn't submitted it.</template>
            <template v-else>{{ change.status }}{{ change.reviewed_at ? ` ${since(change.reviewed_at)} ago` : '' }}.</template>
          </p>
          <RouterLink v-if="pilot" :to="{ name: 'gm-review', params: { id: pilot.id } }">approved record and gm controls</RouterLink>
        </div>
        <div class="manna" aria-label="Manna summary">
          <dl class="manna-figures">
            <div v-if="pending">
              <dt>balance before</dt>
              <dd>{{ approved.manna - spentBefore }}</dd>
            </div>
            <div>
              <dt>{{ !pending ? 'proposal spending' : cost < 0 ? 'manna refunded' : 'cost of change' }}</dt>
              <dd :class="{ spending: (pending ? cost : spentAfter) > 0, gain: pending && cost < 0 }">{{ pending ? Math.abs(cost) : spentAfter }}</dd>
            </div>
            <div>
              <dt>{{ pending ? 'balance after' : 'manna left' }}</dt>
              <dd :class="left < 0 ? 'spending' : 'balance'">{{ left }}</dd>
            </div>
          </dl>
          <p class="dim">{{ approved.manna }} received · <span class="spending">{{ spentAfter }}</span> total spent on the proposed sheet</p>
        </div>
      </section>

      <p v-if="stale && pending" class="notice warn" role="alert">
        this pilot changed after submission. approval is blocked so the player's proposal cannot overwrite newer edits.
      </p>
      <RuleCheck v-if="pending" :problems="problems" />

      <section v-if="pending" class="changes" aria-label="Proposed changes">
        <div class="change-key" aria-label="Change summary">
          <span v-for="kind in changeKinds" :key="kind.kind" :class="kind.kind">
            {{ kind.symbol }} {{ lines.filter(line => line.kind === kind.kind).length }} {{ kind.label }}
          </span>
        </div>
        <p v-if="!lines.length" class="empty">no changes to the approved record.</p>
        <div v-else class="change-groups">
          <section v-for="[section, items] in sections" :key="section" class="change-group panel">
            <h2 class="sheet-label">{{ section }}</h2>
            <ul>
              <li v-for="(line, i) in items" :key="i" :class="line.kind">
                <span class="change-kind">
                  {{ changeKinds.find(kind => kind.kind === line.kind)!.symbol }}
                  {{ changeKinds.find(kind => kind.kind === line.kind)!.label }}
                </span>
                <div class="change-content">
                  <p class="item-name">{{ line.text }}</p>
                  <details v-if="line.doc" class="writing-preview">
                    <summary>view proposed text</summary>
                    <RichText :doc="line.doc" class="new-writing prose" />
                  </details>
                </div>
              </li>
            </ul>
          </section>
        </div>
      </section>
      <p v-if="!pending" class="notice info">this change has been reviewed. its original comparison and cost were not stored; the figures above use the proposal and the current manna received.</p>

      <section v-if="waiting" class="decision panel" aria-labelledby="decision-title">
        <h2 id="decision-title" class="sheet-label">decision<span class="tag"> gm only</span></h2>
        <div class="decision-body">
          <label class="field">
            <span>reason (needed to reject)</span>
            <textarea v-model="reason" rows="3"></textarea>
          </label>
          <p v-if="stale" class="rose">approve is off: this pilot changed after the change was submitted.</p>
          <p v-if="error" class="notice warn" role="alert">{{ error }}</p>
          <div class="actions">
            <button type="button" class="primary" :disabled="busy || stale" @click="approve">approve change</button>
            <button type="button" class="danger" :disabled="busy" @click="reject">reject with reason</button>
          </div>
        </div>
      </section>
      <section v-else-if="change.status === 'rejected'" class="panel">
        <h2 class="sheet-label">rejected</h2>
        <p class="prose">{{ change.review_reason }}</p>
      </section>
    </template>
  </main>
</template>

<style scoped>
main > * + * { margin-top: var(--space-l); }

/* --- The summary strip --- */
.strip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-m) var(--space-xl);
  overflow-wrap: anywhere;
}

.who p { max-width: none; margin: 0; }
.pilot-name { color: var(--lilac); font: 700 1.25rem/1.3 var(--mono); }
.manna p { max-width: none; margin: 0.35rem 0 0; font-size: 0.8125rem; }

.manna-figures {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 2.5rem;
  margin: 0;
}

.manna-figures > div { display: flex; flex-direction: column; }
.manna-figures dt { color: var(--text-dim); font-size: 0.8125rem; }
.manna-figures dd { margin: 0; color: var(--lilac); font: 600 1.375rem/1.3 var(--mono); }
.gain, .manna-figures dd.gain { color: var(--mint); }
.spending, .manna-figures dd.spending { color: var(--rose); }
.balance, .manna-figures dd.balance { color: var(--sky); }

/* Sticky only where there's room: wide and tall screens, as on the pilot sheet. */
@media (min-width: 48rem) and (min-height: 40rem) {
  .strip { position: sticky; top: var(--topbar-h); z-index: 2; }
}

/* --- What changes --- */
.change-key { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.5rem 2rem; margin-bottom: var(--space-m); font-size: 0.875rem; }
.addition { color: var(--mint); }
.removal { color: var(--rose); }
.edit { color: var(--sky); }
.change-groups { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-m); align-items: start; }
.change-group { min-width: 0; }
.change-group ul { margin: 0; padding: 0; list-style: none; }
.change-group li { display: grid; grid-template-columns: 10rem minmax(0, 1fr); gap: 0.75rem; padding: 0.75rem 0; border-top: 1px solid var(--rule); }
.change-kind { font-size: 0.8125rem; padding-top: 0.125rem; }
.change-content { min-width: 0; }
.item-name { max-width: none; margin: 0; color: var(--text); overflow-wrap: anywhere; }
.writing-preview { margin-top: 0.5rem; }
/* A boxed disclosure, so it reads as something to open. */
.writing-preview summary { display: inline-block; padding: 0.2rem 0.6rem; border: 1px solid var(--rule); color: var(--lilac); font-size: 0.875rem; cursor: pointer; }
.writing-preview summary:hover { border-color: var(--lilac); }
.writing-preview[open] summary { margin-bottom: 0.5rem; }
.new-writing { color: var(--text); }

/* --- The decision --- */
.decision { border-color: var(--lilac); }
.decision-body { display: flex; flex-direction: column; gap: 0.75rem; }
.decision-body p { margin: 0; }
textarea { width: 100%; resize: vertical; }
.actions { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; }

@media (max-width: 70rem) {
  .change-groups { grid-template-columns: minmax(0, 1fr); }
}

@media (max-width: 35rem) {
  .change-group li { grid-template-columns: minmax(0, 1fr); gap: 0.25rem; }
  .manna-figures { gap: 0.5rem 1.5rem; }
}
</style>
