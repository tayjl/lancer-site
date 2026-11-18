<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { isGm, profile } from '../auth'
import { confirmAction } from '../confirm'
import { changeDiff, PUBLIC_COLUMNS, type PublicCard, type DiffLine } from '../changeDiff'
import Icon from '../components/Icon.vue'
import CatalogueNotice from '../components/CatalogueNotice.vue'
import PageHeader from '../components/PageHeader.vue'
import RuleCheck from '../components/RuleCheck.vue'
import RichText from '../components/RichText.vue'
import { useGameData } from '../gameData'
import type { Character, PendingChange, Sheet } from '../myPilot'
import { useMechData } from '../mechData'
import { licenceName, mannaSpent, pilotProblems, personalStatProblems, formatAmount, useCatalogue } from '../rules'
import { cardImages, deleteImage } from '../images'
import { supabase } from '../lib/supabaseClient'
import type { PublicMech } from '../pilots'
import { since } from '../time'

// One pending change (opened from gm: changes): what it changes, in plain words, against the approved
// pilot; what it costs in manna; the rule check on the proposed sheet; then approve or reject. GMs approve
// or reject the whole change. Approving runs approve_change (all-or-nothing, in the database), which refuses
// if the pilot changed since the change was started or the player edited and resubmitted it since this page loaded it
// (expected_submitted_at, sent back as it came). Rejecting runs reject_change and needs a reason. Either way the
// note is what the player sees.

const route = useRoute()
const router = useRouter()
const change = shallowRef<PendingChange | null>(null)
const pilot = shallowRef<(Character & { player: { display_name: string } | null }) | null>(null)
const approved = shallowRef<{ sheet: Sheet; level: number; manna: number; updated_at: string } | null>(null)
const loading = ref(true)
const error = ref('')

const { gear, bionics, pilotStats, talents, coreBonuses } = useGameData()
const { frames, weapons, systems, mods, integrated } = useMechData()
const catalogue = useCatalogue()

async function load() {
  const { data: row, error: loadError } = await supabase.from('pending_changes').select('*').eq('id', Number(route.params.id)).maybeSingle()
  change.value = row
  error.value = loadError?.message ?? (row ? '' : 'No change with that ID.')
  if (row) {
    const [card, sheetRow] = await Promise.all([
      supabase.from('characters').select('*, player:profiles(display_name)').eq('id', row.character_id).maybeSingle(),
      supabase.from('character_sheets').select('sheet, level, manna, updated_at').eq('character_id', row.character_id).maybeSingle(),
    ])
    pilot.value = card.data
    approved.value = sheetRow.data
      ? { ...sheetRow.data, sheet: sheetRow.data.sheet as unknown as Sheet }
      : null
    error.value = card.error?.message ?? sheetRow.error?.message ?? (!card.data || !sheetRow.data ? 'Could not load the complete pilot record. Reload before reviewing.' : '')
  }
  loading.value = false
}

watch(isGm, (gm) => gm && load(), { immediate: true })

const proposedSheet = computed(() => (change.value?.proposed_sheet ?? {}) as unknown as Sheet)
const proposedCard = computed(() => (change.value?.proposed_public ?? {}) as PublicCard)
const pending = computed(() => change.value?.status === 'pending')
const name = computed(() => pilot.value?.callsign ?? pilot.value?.pilot_name ?? 'A pilot')
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
      stat: (id) => find(pilotStats.value, id),
      licence: (id) => licenceName(frames.value, id),
      talent: (id) => find(talents.value, id),
      coreBonus: (id) => find(coreBonuses.value, id),
      bionic: (id) => find(bionics.value, id),
      gear: (id) => find(gear.value, id),
      frame: (id) => licenceName(frames.value, id),
      weapon: (id) => find([...weapons.value, ...integrated.value.values()], id),
      system: (id) => find([...systems.value, ...integrated.value.values()], id),
      mod: (id) => find(mods.value, id),
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
// Each kind's word, symbol and tone (up = --ok, down = --danger, info = --info); the key line counts them by tone.
const KINDS = {
  added: { label: 'Added', icon: 'plus', tone: 'up' },
  raised: { label: 'Raised', icon: 'plus', tone: 'up' },
  removed: { label: 'Removed', icon: 'minus', tone: 'down' },
  lowered: { label: 'Lowered', icon: 'minus', tone: 'down' },
  updated: { label: 'Updated', icon: '', tone: 'info' },
} as const satisfies Record<DiffLine['kind'], { label: string; icon: string; tone: string }>
const tones = [
  { tone: 'up', icon: 'plus', key: 'added or raised' },
  { tone: 'down', icon: 'minus', key: 'removed or lowered' },
  { tone: 'info', icon: '', key: 'updated' },
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
        catalogue.value,
        Object.fromEntries(
          (Array.isArray(proposedCard.value.mechs) ? (proposedCard.value.mechs as unknown as PublicMech[]) : []).map((m) => [m.id, m.name]),
        ),
      )
    : personalStatProblems(proposedSheet.value.pilot_stats),
)
const stale = computed(() => {
  if (!change.value || !pilot.value) return false
  const last = Math.max(Date.parse(pilot.value.updated_at), Date.parse(approved.value?.updated_at ?? pilot.value.updated_at))
  return last > Date.parse(change.value.based_on)
})

// --- The decision ---
const note = ref('')
const busy = ref(false)

async function approve() {
  const warning = problems.value.length ? ` The rule check lists ${problems.value.length} ${problems.value.length === 1 ? 'problem' : 'problems'}.` : ''
  if (!(await confirmAction(`Approve this change to ${name.value}? It goes live straight away.${warning}`, { confirmLabel: 'Approve change' }))) return
  busy.value = true
  const { error: approveError } = await supabase.rpc('approve_change', {
    change_id: change.value!.id,
    expected_submitted_at: change.value!.submitted_at!,
    note: note.value,
  })
  busy.value = false
  error.value = approveError?.message ?? ''
  if (!error.value) {
    // The approved card's pictures that this change replaced or removed (best effort).
    const kept = cardImages({ ...pilot.value!, ...proposedCard.value })
    cardImages(pilot.value!).forEach((path) => kept.has(path) || deleteImage(path))
    router.push({ name: 'gm-changes' })
  }
}

async function reject() {
  if (!note.value.trim()) {
    error.value = 'Write a reason first, so the player knows what to fix.'
    return
  }
  busy.value = true
  const { error: rejectError } = await supabase.rpc('reject_change', { change_id: change.value!.id, reason: note.value })
  busy.value = false
  error.value = rejectError?.message ?? ''
  if (!error.value) router.push({ name: 'gm-changes' })
}
</script>

<template>
  <main class="page">
    <PageHeader :title="`Change to ${name}`" :crumbs="[{ label: 'GM changes', to: { name: 'gm-changes' } }, { label: name }]" />

    <p v-if="!profile" class="dim">Loading change…</p>
    <p v-else-if="!isGm" class="notice warn" role="alert">Access denied. This page is for GMs.</p>
    <p v-else-if="loading" class="dim">Loading change…</p>
    <p v-else-if="!change || !pilot || !approved" class="notice warn" role="alert">{{ error }}</p>
    <template v-else>
      <!-- The summary strip: whose change, and the manna. Sticks under the top bar on wide, tall screens. -->
      <section class="strip panel" aria-label="Change summary">
        <div>
          <p class="pilot-name">{{ pilot.pilot_name }}</p>
          <p class="sep dim">
            <span>Player: {{ pilot.player?.display_name ?? '–' }}</span>
            <span v-if="waiting">Submitted {{ since(change.submitted_at!) }} ago</span>
            <span v-else-if="pending">Draft: not submitted yet</span>
            <span v-else><span class="badge" :class="change.status">{{ change.status }}</span></span>
          </p>
          <RouterLink :to="{ name: 'gm-review', params: { id: pilot.id } }">Open the record and GM controls</RouterLink>
        </div>
        <div>
          <dl class="figures">
            <div v-if="pending">
              <dt class="label">Balance before</dt>
              <dd class="num">{{ formatAmount(approved.manna - spentBefore) }}</dd>
            </div>
            <div>
              <dt class="label">{{ !pending ? 'Proposal spending' : cost < 0 ? 'Manna refunded' : 'Cost of change' }}</dt>
              <dd class="num" :class="{ 'tone-down': (pending ? cost : spentAfter) > 0, 'tone-up': pending && cost < 0 }">
                {{ pending ? (cost < 0 ? '+' : cost > 0 ? '−' : '') + formatAmount(Math.abs(cost)) : formatAmount(spentAfter) }}
              </dd>
            </div>
            <div>
              <dt class="label">{{ pending ? 'Balance after' : 'Manna left' }}</dt>
              <dd class="num" :class="left < 0 ? 'tone-down' : 'tone-info'">{{ formatAmount(left) }}</dd>
            </div>
          </dl>
          <p class="dim figures-note"><span class="num">{{ formatAmount(approved.manna) }}</span> received · <span class="num">{{ formatAmount(spentAfter) }}</span> spent on the proposed sheet</p>
        </div>
      </section>

      <CatalogueNotice />
      <p v-if="stale && pending" class="notice warn" role="alert">
        This pilot changed after the change was made. Approval is blocked, so the proposal can't overwrite newer edits.
      </p>
      <RuleCheck v-if="pending" :problems="problems" />

      <section v-if="pending" aria-label="Proposed changes">
        <p class="change-key">
          <span v-for="t in tones" :key="t.tone" :class="`tone-${t.tone}`">
            <Icon v-if="t.icon" :name="t.icon" /><span v-else aria-hidden="true">~</span>
            <span class="num">{{ lines.filter((line) => KINDS[line.kind].tone === t.tone).length }}</span> {{ t.key }}
          </span>
        </p>
        <p v-if="!lines.length" class="empty">No changes to the approved record.</p>
        <div v-else class="change-groups">
          <section v-for="[section, items] in sections" :key="section" class="panel">
            <h2 class="sheet-label">{{ section }}</h2>
            <ul>
              <li v-for="(line, i) in items" :key="i">
                <span class="change-kind" :class="`tone-${KINDS[line.kind].tone}`">
                  <Icon v-if="KINDS[line.kind].icon" :name="KINDS[line.kind].icon" /><span v-else aria-hidden="true">~</span>
                  {{ KINDS[line.kind].label }}
                </span>
                <div class="change-content">
                  <p>{{ line.text }}</p>
                  <details v-if="line.doc" class="writing-preview">
                    <summary>View proposed text</summary>
                    <RichText :doc="line.doc" class="prose" />
                  </details>
                </div>
              </li>
            </ul>
          </section>
        </div>
      </section>
      <p v-if="!pending" class="notice info">This change has been reviewed. Its original comparison and cost weren't stored, so the figures above use the proposal and the current manna received.</p>

      <section v-if="waiting" class="panel" aria-labelledby="decision-title">
        <h2 id="decision-title" class="sheet-label">Decision<span class="private">GM only</span></h2>
        <div class="decision">
          <label class="field">
            <span>Note to the player</span>
            <textarea v-model="note" rows="3"></textarea>
            <span class="hint">Optional when approving, required when rejecting.</span>
          </label>
          <p v-if="error" class="notice warn" role="alert">{{ error }}</p>
          <div class="actions">
            <span class="blocked">
              <button type="button" class="primary" :disabled="busy || stale" :aria-describedby="stale ? 'approve-why' : undefined" @click="approve">Approve change</button>
              <span v-if="stale" id="approve-why" class="blocked-reason">The pilot changed after this change was made.</span>
            </span>
            <button type="button" class="danger" :disabled="busy" @click="reject">Reject change</button>
          </div>
        </div>
      </section>
      <section v-else-if="change.status === 'rejected'" class="panel">
        <h2 class="sheet-label">Reason for rejecting</h2>
        <p class="prose">{{ change.review_reason }}</p>
      </section>
    </template>
  </main>
</template>

<style scoped>
main > * + * { margin-top: var(--space-l); }

/* --- The summary strip: whose change, then the manna as labels over numbers, like the pilot sheet's header --- */
.strip {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-m) var(--space-xl);
  overflow-wrap: anywhere;
}

.strip p { max-width: none; margin: 0 0 var(--space-xs); }
.pilot-name { font-size: var(--fs-l); font-weight: 700; }
.sep { font-size: var(--fs-s); }

.figures {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-s) var(--space-xl);
  margin: 0;
}

.figures dd { margin: 0; font-size: 22px; font-weight: 700; line-height: 1.1; }
.figures-note { margin-top: var(--space-xs); font-size: var(--fs-xs); }

/* Sticky only where there's room: wide and tall screens, as on the pilot sheet. */
@media (min-width: 48rem) and (min-height: 40rem) {
  .strip { position: sticky; top: var(--topbar-h); z-index: 2; }
}

/* --- What changes. Colour is never alone: every line keeps its symbol and word. --- */
.tone-up { color: var(--ok); }
.tone-down { color: var(--danger); }
.tone-info { color: var(--info); }
.change-key { display: flex; flex-wrap: wrap; gap: var(--space-xs) var(--space-xl); max-width: none; margin: 0 0 var(--space-m); font-size: var(--fs-s); }
.change-key > span, .change-kind { display: inline-flex; align-items: center; gap: var(--space-xs); }
.change-groups { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--space-m); align-items: start; }
.change-groups ul { margin: 0; padding: 0; list-style: none; }
.change-groups li { display: grid; grid-template-columns: 6.5rem minmax(0, 1fr); gap: var(--space-m); padding: var(--space-s) 0; border-top: 1px solid var(--rule); }
.change-kind { align-self: start; font-size: var(--fs-xs); font-weight: 700; letter-spacing: 0.08em; line-height: 1.6; text-transform: uppercase; }
.change-content { min-width: 0; overflow-wrap: anywhere; }
.change-content p { max-width: none; margin: 0; }
.writing-preview { margin-top: var(--space-s); }
/* A disclosure drawn as a small button, so it reads as something to open. */
.writing-preview summary { display: inline-flex; align-items: center; min-height: 28px; padding: 0 10px; border: 1px solid var(--edge); border-radius: var(--radius); color: var(--lilac); font: 700 var(--fs-xs) / 1 var(--sans); letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; }
.writing-preview summary:hover { border-color: var(--lilac); }
.writing-preview[open] summary { margin-bottom: var(--space-s); }

/* --- The decision --- */
.decision { display: flex; flex-direction: column; gap: var(--space-m); }
.decision p { margin: 0; }
textarea { width: 100%; resize: vertical; }
.actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-s) var(--space-m); }

@media (max-width: 70rem) {
  .change-groups { grid-template-columns: minmax(0, 1fr); }
}

@media (max-width: 35rem) {
  .change-groups li { grid-template-columns: minmax(0, 1fr); gap: var(--space-xs); }
}
</style>
