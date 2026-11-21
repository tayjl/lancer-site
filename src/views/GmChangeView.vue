<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { isGm, profile } from '../auth'
import { confirmAction } from '../confirm'
import { changeDiff, kindTone, PUBLIC_COLUMNS, reviewSections, writingSummary, type PublicCard, type DiffLine } from '../changeDiff'
import Icon from '../components/Icon.vue'
import ChangeTally from '../components/ChangeTally.vue'
import CatalogueNotice from '../components/CatalogueNotice.vue'
import PageHeader from '../components/PageHeader.vue'
import RuleCheck from '../components/RuleCheck.vue'
import RichText from '../components/RichText.vue'
import { useGameData } from '../gameData'
import type { Character, PendingChange, Sheet } from '../myPilot'
import { useMechData } from '../mechData'
import { gearPrice, licenceName, mannaSpent, mechCount, pilotProblems, personalStatProblems, formatAmount, useCatalogue, type Grants } from '../rules'
import { cardImages, deleteImage } from '../images'
import type { Json } from '../lib/database.types'
import { supabase } from '../lib/supabaseClient'
import type { PublicMech } from '../pilots'
import { capitalise, plural } from '../text'
import { since } from '../time'

// One pending change (opened from gm: changes): what it changes, in plain words, against the approved
// pilot; what it costs in manna; the rule check on the proposed sheet; then approve or send back. GMs approve
// or send back the whole change. Approving runs approve_change (all-or-nothing, in the database), which refuses
// if the pilot changed since the change was started or the player edited and resubmitted it since this page loaded it
// (expected_submitted_at, sent back as it came). Sending back runs reject_change, needs a note and gives the player their proposal back as a draft
// (the change itself stays as history, status "rejected"). Either way the note is what the player sees.

const route = useRoute()
const router = useRouter()
const change = shallowRef<PendingChange | null>(null)
const pilot = shallowRef<(Character & { player: { display_name: string } | null }) | null>(null)
const approved = shallowRef<{ sheet: Sheet; level: number; manna: number; gm_grants: Json; updated_at: string } | null>(null)
const loading = ref(true)
const error = ref('')

const { gear, bionics, bionicPrices, pilotStats, talents, coreBonuses } = useGameData()
const { frames, weapons, systems, mods, integrated } = useMechData()
const catalogue = useCatalogue()

async function load() {
  const { data: row, error: loadError } = await supabase.from('pending_changes').select('*').eq('id', Number(route.params.id)).maybeSingle()
  change.value = row
  error.value = loadError?.message ?? (row ? '' : 'No change with that ID.')
  if (row) {
    const [card, sheetRow] = await Promise.all([
      supabase.from('characters').select('*, player:profiles(display_name)').eq('id', row.character_id).maybeSingle(),
      supabase.from('character_sheets').select('sheet, level, manna, gm_grants, updated_at').eq('character_id', row.character_id).maybeSingle(),
    ])
    pilot.value = card.data
    approved.value = sheetRow.data
      ? { ...sheetRow.data, sheet: sheetRow.data.sheet as unknown as Sheet }
      : null
    error.value = card.error?.message ?? sheetRow.error?.message ?? (!card.data || !sheetRow.data ? "The pilot record didn't load fully." : '')
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
    // Only "Bought" lines show their price (an item bought in a change is never free; unknown items cost 0, like mannaSpent).
    { bionic: () => 0, gear: (id) => { const item = gear.value.find((x) => x.id === id); return item ? gearPrice(item) : 0 } },
  )
})

const sections = computed(() => reviewSections(lines.value))
// Each kind's word, symbol and tone (up = --ok, down = --danger, info = --info); the key line counts them by tone.
const KINDS = {
  added: { label: 'Added', icon: 'plus' },
  raised: { label: 'Raised', icon: 'plus' },
  removed: { label: 'Removed', icon: 'minus' },
  lowered: { label: 'Lowered', icon: 'minus' },
  updated: { label: 'Updated', icon: '' },
} as const satisfies Record<DiffLine['kind'], { label: string; icon: string }>
const tones = [
  { tone: 'up', icon: 'plus', key: 'added or raised' },
  { tone: 'down', icon: 'minus', key: 'removed or lowered' },
  { tone: 'info', icon: '', key: 'updated' },
] as const

// A mech's frame, by the mech's id: the proposed one, else the approved one.
const mechFrame = (id?: string) => {
  const frame = id && (proposedSheet.value.mechs?.[id]?.frame ?? approved.value?.sheet.mechs?.[id]?.frame)
  return frame ? licenceName(frames.value, frame) : ''
}

// The contents links scroll to a section (instantly, so reduced-motion is respected); the panels keep room for the sticky strip.
const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ block: 'start' })

// --- Manna: what the change costs, and what's left after it ---
// The card holds the mechs (the cost of extra ones counts like any purchase): the approved card now, the proposed one after.
// A change is always to an approved pilot: its live sheet says which owned gear was free.
const live = computed(() => approved.value?.sheet ?? null)
// What a GM gave this pilot free: it stays off both sides of the cost (a player's change can't touch it).
const grants = computed(() => (approved.value?.gm_grants ?? {}) as Grants)
const spentBefore = computed(() => mannaSpent(approved.value?.sheet ?? {}, bionicPrices.value, mechCount(pilot.value?.mechs), gear.value, live.value, grants.value))
const spentAfter = computed(() => mannaSpent(proposedSheet.value, bionicPrices.value, mechCount(proposedCard.value.mechs ?? pilot.value?.mechs), gear.value, live.value, grants.value))
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
        live.value,
        grants.value,
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
  const warning = problems.value.length ? ` It has ${plural(problems.value.length, 'problem')}.` : ''
  if (!(await confirmAction(`Approve the change to ${name.value}? It goes live at once.${warning}`, { confirmLabel: 'Approve change' }))) return
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
    error.value = 'Write a note before sending it back.'
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

    <p v-if="!profile" class="dim">Loading…</p>
    <p v-else-if="!isGm" class="notice warn" role="alert">Only GMs can see this page.</p>
    <p v-else-if="loading" class="dim">Loading…</p>
    <p v-else-if="!change || !pilot || !approved" class="notice warn" role="alert">{{ error }}</p>
    <template v-else>
      <!-- The summary strip: whose change, and the manna. Sticks under the top bar on wide, tall screens. -->
      <section class="strip panel" aria-label="Change summary">
        <div>
          <p class="pilot-name">{{ pilot.pilot_name }}</p>
          <p class="sep dim">
            <span>Player: {{ pilot.player?.display_name ?? 'Unknown player' }}</span>
            <span v-if="waiting">Submitted {{ since(change.submitted_at!) }} ago</span>
            <span v-else-if="pending">Not submitted</span>
            <span v-else><span class="badge" :class="change.status">{{ change.status === 'rejected' ? 'Sent back' : capitalise(change.status) }}</span></span>
          </p>
          <RouterLink :to="{ name: 'pilot-record', params: { id: pilot.id } }">Open pilot record</RouterLink>
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
          <p class="dim figures-note"><span class="num">{{ formatAmount(approved.manna) }}</span> received · <span class="num">{{ formatAmount(spentAfter) }}</span> spent{{ pending ? ' after this change' : '' }}</p>
        </div>
      </section>

      <CatalogueNotice />
      <p v-if="stale && pending" class="notice warn" role="alert">
        This pilot changed after the change was made. Approval is blocked.
      </p>
      <RuleCheck v-if="pending" :problems="problems" />

      <section v-if="pending" class="changes" aria-label="Proposed changes">
        <p v-if="!lines.length" class="empty">No changes.</p>
        <template v-else>
          <!-- Contents: one link per section with its counts and manna, and the key to the symbols, once. -->
          <nav class="panel contents" aria-label="Contents">
            <header class="panel-head sec-head">
              <h2>Contents</h2>
              <div class="sec-meta">
                <p class="change-key">
                  <span v-for="t in tones" :key="t.tone" :class="`tone-${t.tone}`">
                    <Icon v-if="t.icon" :name="t.icon" /><span v-else aria-hidden="true">~</span>
                    {{ t.key }}
                  </span>
                </p>
                <a v-if="waiting" href="#decision" class="jump" @click.prevent="jump('decision')">Jump to decision</a>
              </div>
            </header>
            <ol class="toc">
              <li v-for="(section, i) in sections" :key="section.id">
                <a :href="`#change-${i}`" @click.prevent="jump(`change-${i}`)">
                  <span class="toc-name">{{ section.title }}</span>
                  <ChangeTally :counts="section.counts" :manna="section.manna" />
                </a>
              </li>
            </ol>
          </nav>

          <div class="change-groups">
            <section v-for="(section, i) in sections" :id="`change-${i}`" :key="section.id" class="panel" :aria-labelledby="`change-${i}-title`">
              <header class="panel-head sec-head">
                <h2 :id="`change-${i}-title`">{{ section.title }}</h2>
                <div class="sec-meta">
                  <span v-if="mechFrame(section.mechId)" class="dim">{{ mechFrame(section.mechId) }}</span>
                  <span v-if="section.mechState === 'new'" class="badge">New mech</span>
                  <ChangeTally :counts="section.counts" :manna="section.manna" />
                </div>
              </header>
              <div v-for="group in section.groups" :key="group.title" class="group">
                <h3 v-if="group.title" class="label sub-head">{{ group.title }}</h3>
                <ul>
                  <li v-for="(line, j) in group.lines" :key="j">
                    <span class="change-kind" :class="`tone-${kindTone(line.kind)}`">
                      <Icon v-if="KINDS[line.kind].icon" :name="KINDS[line.kind].icon" /><span v-else aria-hidden="true">~</span>
                      {{ KINDS[line.kind].label }}
                    </span>
                    <div class="change-content">
                      <p>{{ writingSummary(line) ?? line.text }}</p>
                      <details v-if="line.doc" class="writing-preview">
                        <summary><span class="when-closed">Show text</span><span class="when-open">Hide text</span></summary>
                        <div class="versions" :class="{ both: line.before }">
                          <div v-if="line.before">
                            <p class="label dim">Before</p>
                            <RichText :doc="line.before" class="prose" />
                          </div>
                          <div>
                            <p v-if="line.before" class="label">After</p>
                            <RichText :doc="line.doc" class="prose" />
                          </div>
                        </div>
                      </details>
                    </div>
                    <ChangeTally class="change-cost" :manna="line.manna" />
                  </li>
                </ul>
              </div>
            </section>
          </div>
        </template>
      </section>
      <p v-if="!pending" class="notice info">Already reviewed. The figures use the current manna received.</p>

      <section v-if="waiting" id="decision" class="panel" aria-labelledby="decision-title">
        <h2 id="decision-title" class="sheet-label">Decision<span class="private gm">GM only</span></h2>
        <div class="decision">
          <label class="field">
            <span>Note to the player</span>
            <textarea v-model="note" rows="3"></textarea>
            <span class="hint">Required when sending back.</span>
          </label>
          <p v-if="error" class="notice warn" role="alert">{{ error }}</p>
          <div class="actions">
            <span class="blocked">
              <button type="button" class="primary" :disabled="busy || stale" :aria-describedby="stale ? 'approve-why' : undefined" @click="approve">Approve change</button>
              <span v-if="stale" id="approve-why" class="blocked-reason">Pilot changed after this change</span>
            </span>
            <button type="button" class="danger" :disabled="busy" @click="reject">Send back change</button>
          </div>
        </div>
      </section>
      <section v-else-if="change.status === 'rejected'" class="panel">
        <h2 class="sheet-label">Note when sent back</h2>
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
.change-key { display: flex; flex-wrap: wrap; gap: var(--space-xs) var(--space-l); max-width: none; margin: 0; font-size: var(--fs-s); }
.change-key > span, .change-kind { display: inline-flex; align-items: center; gap: var(--space-xs); }
.changes > * + * { margin-top: var(--space-m); }

/* A panel's head: the title at the left, its figures at the right. */
.sec-head { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-xs) var(--space-l); }
.sec-head h2 { flex: 1 1 12rem; min-width: 0; overflow-wrap: anywhere; }
.sec-meta { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: var(--space-xs) var(--space-l); font-size: var(--fs-s); }
.jump { font-size: var(--fs-s); }

/* The contents: a link per section, name at the left and its counts and manna at the right. */
.toc { display: grid; grid-template-columns: repeat(auto-fill, minmax(19rem, 1fr)); gap: 0 var(--space-xl); margin: 0; padding: 0; list-style: none; }
.toc a { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-xs) var(--space-m); min-height: var(--tap); padding: var(--space-xs) 0; border-top: 1px solid var(--rule); }
.toc-name { overflow-wrap: anywhere; }

.change-groups { display: flex; flex-direction: column; gap: var(--space-m); }
.group + .group { margin-top: var(--space-m); }
.sub-head { margin: 0 0 var(--space-xs); color: var(--text-dim); font-size: var(--fs-xs); }
.group ul { margin: 0; padding: 0; list-style: none; }
/* Kind, then the text, then the manna: the same columns on every line. */
.group li { display: grid; grid-template: 'kind text cost' auto / 6.5rem minmax(0, 1fr) 6rem; gap: var(--space-m); padding: var(--space-s) 0; border-top: 1px solid var(--rule); }
.change-kind { grid-area: kind; align-self: start; font-size: var(--fs-xs); font-weight: 700; letter-spacing: 0.08em; line-height: 1.6; text-transform: uppercase; }
.change-content { grid-area: text; min-width: 0; overflow-wrap: anywhere; }
.change-content p { max-width: none; margin: 0; }
.change-cost { grid-area: cost; align-self: start; justify-content: flex-end; line-height: 1.6; }
.writing-preview { margin-top: var(--space-s); }
/* A disclosure drawn as a small button, so it reads as something to open. */
.writing-preview summary { display: inline-flex; align-items: center; min-height: 28px; padding: 0 10px; border: 1px solid var(--edge); border-radius: var(--radius); color: var(--lilac); font: 700 var(--fs-xs) / 1 var(--sans); letter-spacing: 0.08em; text-transform: uppercase; cursor: pointer; }
.writing-preview summary:hover { border-color: var(--lilac); }
.writing-preview[open] summary { margin-bottom: var(--space-s); }
.writing-preview .when-open, .writing-preview[open] .when-closed { display: none; }
.writing-preview[open] .when-open { display: inline; }
/* Old and new text side by side on wide screens, stacked on phones. */
.versions { display: grid; gap: var(--space-m) var(--space-xl); }
.versions.both { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.versions p.label { margin: 0 0 var(--space-xs); }

/* Jumping to a section leaves room for the sticky strip. */
section[id] { scroll-margin-top: calc(var(--topbar-h) + var(--space-m)); }
@media (min-width: 48rem) and (min-height: 40rem) {
  section[id] { scroll-margin-top: calc(var(--topbar-h) + 9rem); }
}

/* --- The decision --- */
.decision { display: flex; flex-direction: column; gap: var(--space-m); }
.decision p { margin: 0; }
textarea { width: 100%; resize: vertical; }
.actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-s) var(--space-m); }

@media (max-width: 47.99rem) {
  .versions.both { grid-template-columns: minmax(0, 1fr); }
}

/* Phones: the kind and the manna share a row, the text takes the full width under them. */
@media (max-width: 35rem) {
  .group li { grid-template: 'kind cost' auto 'text text' auto / minmax(0, 1fr) auto; gap: var(--space-xs) var(--space-m); }
}
</style>
