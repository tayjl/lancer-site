<script setup lang="ts">
import { computed, reactive, ref, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { makerColour, makerLogo, useManufacturers } from '../archive'
import { isGm } from '../auth'
import { confirmAction } from '../confirm'
import CoreBonusPanel from '../components/CoreBonusPanel.vue'
import CatalogueNotice from '../components/CatalogueNotice.vue'
import ConflictNotice from '../components/ConflictNotice.vue'
import GmEditBar from '../components/GmEditBar.vue'
import GmReview from '../components/GmReview.vue'
import LoadoutBox from '../components/LoadoutBox.vue'
import PilotLoadout from '../components/PilotLoadout.vue'
import Portrait from '../components/Portrait.vue'
import RankPanel, { type RankStep } from '../components/RankPanel.vue'
import SheetTabs from '../components/SheetTabs.vue'
import RuleCheck from '../components/RuleCheck.vue'
import SheetField from '../components/SheetField.vue'
import Icon from '../components/Icon.vue'
import StatRow from '../components/StatRow.vue'
import { bionicItems, pilotBonuses, pilotVitals, sheetStats, useGameData } from '../gameData'
import type { Json } from '../lib/database.types'
import { useMechData } from '../mechData'
import { bionicInfo, frameInfo, itemInfo, talentInfo } from '../info'
import { mechProblem, useMyPilot, type Sheet } from '../myPilot'
import type { PublicMech } from '../pilots'
import { sectionOverride } from '../router'
import { coreBonusPicks, licenceLevel, licenceName, mannaSpent, modLimit, pilotProblems, personalStatProblems, PERSONAL_STAT_MIN, PERSONAL_STAT_MAX, PERSONAL_STAT_POINTS, PRICES, skillPoints } from '../rules'

// my pilot: your pilot as one sheet. A compact header (portrait, callsign, name, player, status, then level, licence
// level and manna), the "what happens next" bar under it, any notes and the rule check, then a slim sticky row of
// section tabs (profile, stats, equipment, licences, talents, mechs), each a stack of panels. Everything is edited
// in place and saves itself. While a pilot is pending you can edit it directly; once it's approved, changes are
// proposed as a draft that a GM approves (src/myPilot.ts).
// The same page, read-only, is every pilot's record (opened from a card, route param "id"), so a record looks
// just like your own sheet. Private sections show only when the database hands over the sheet (the pilot's
// player, GMs and owners). On the gm-review route (from the gm: pilots tab) GMs also get their controls: level,
// manna and, while pending, the decision.
// Homebrew (src/rules.ts): level (set by GMs) gives HASE points and the mod limit; manna (received from GMs)
// buys licence ranks, biomods and talent ranks; every 3 licence ranks give a free core bonus.

const route = useRoute()
const router = useRouter()
const pilotId = route.params.id ? Number(route.params.id) : undefined
const own = !pilotId
const reviewing = route.name === 'gm-review'
const {
  character,
  sheet,
  gm,
  reviewNote,
  sheetUpdatedAt,
  playerName,
  canSeePrivate,
  loading,
  loadError,
  conflict,
  retry,
  editable,
  gmEditing,
  waiting,
  mechs,
  load,
  create,
  updateCharacter,
  updateSheet,
  resubmit,
  dismissApprovalNote,
  change,
  draft,
  proposeChange,
  submitChange,
  reopenChange,
  withdrawChange,
  markDead,
} = useMyPilot(pilotId, { gmEdit: () => route.query.edit === '1' })

// Your approved pilot: changes are proposed, then a GM approves them (src/myPilot.ts).
const approvedOwn = computed(() => own && character.value?.status === 'approved')

// A GM's note on your last approved change. "Clear note" only hides it on this device (the note stays in the
// change's history), so it's remembered in localStorage, which can be missing or blocked: every access is guarded.
const noteKey = (id: number) => `change-note-cleared:${id}`
const clearedNote = ref<number | null>(null)
const changeNote = computed(() => {
  const c = change.value
  if (!approvedOwn.value || draft.value || c?.status !== 'approved' || !c.review_reason || clearedNote.value === c.id) return null
  try {
    return localStorage.getItem(noteKey(c.id)) ? null : c.review_reason
  } catch {
    return c.review_reason
  }
})
function clearChangeNote() {
  clearedNote.value = change.value!.id
  try {
    localStorage.setItem(noteKey(change.value!.id), '1')
  } catch {
    // Hidden for this visit only.
  }
}
async function confirmDeath() {
  const name = character.value!.callsign ?? character.value!.pilot_name
  if (await confirmAction(`Mark ${name} dead? This can't be undone. They move to the memorial, and you can register a new pilot.`, { confirmLabel: 'Mark dead', danger: true }))
    track(markDead())
}

async function withdraw() {
  if (await confirmAction('Withdraw this change? Everything in it is thrown away; your approved pilot stays as it is.', { confirmLabel: 'Withdraw', danger: true }))
    track(withdrawChange())
}

// Records' breadcrumb leads back to the queue, or to the list the pilot is in.
const back = computed(() =>
  reviewing
    ? { name: 'gm-pilots', label: 'GM pilots' }
    : character.value?.status === 'pending'
      ? { name: 'pending', label: 'Pending' }
      : character.value?.status === 'dead'
        ? { name: 'memorial', label: 'Memorial' }
        : { name: 'registry', label: 'Registry' },
)
// The top bar marks that list too (src/router.ts).
if (route.name === 'pilot-record') watchEffect(() => (sectionOverride.value = back.value.name))
// Your own mechs open for editing; anyone else's open read-only under their record (editable in a GM's edit mode, kept in the url).
const mechLink = (mechId: string) =>
  own ? { name: 'mech', params: { mechId } } : { name: 'record-mech', params: { id: pilotId, mechId }, query: gmEditing.value ? { edit: '1' } : undefined }
// A GM's edit mode (?edit=1) on a living pilot's record or review page; Done leaves it.
const gmCanEdit = computed(() => isGm.value && !own && character.value?.status !== 'dead')
const setEdit = (on: boolean) => router.replace({ query: { ...route.query, edit: on ? '1' : undefined } })
const { gear, bionics, pilotStats, talents, coreBonuses } = useGameData()

// The identity table under the portrait. [column, label]
const IDENTITY = [
  ['age', 'age'],
  ['gender', 'gender'],
  ['sexuality', 'sexuality'],
  ['height', 'height'],
  ['weight', 'weight'],
  ['eye_colour', 'eyes'],
  ['hair_colour', 'hair'],
] as const
type TextColumn = (typeof IDENTITY)[number][0] | 'callsign' | 'pilot_name'

// HASE keeps its own 0–6 range; personal stats use the separate base range and budget in rules.ts.
const STAT_MIN = 0
const STAT_MAX = 6

// --- The save status shown in the next-step bar, for the one-line fields, stats and loadouts ---
const saving = ref(false)
const saved = ref(false)
const saveError = ref('')

async function track(save: Promise<string | null>) {
  saving.value = true
  saveError.value = (await save) ?? ''
  saving.value = false
  saved.value = !saveError.value
  return saveError.value || null
}

// One-line fields save when you leave them (or press enter). A pilot can't lose its name.
function saveText(column: TextColumn, event: Event) {
  const input = event.target as HTMLInputElement
  const value = input.value.trim() || null
  if (column === 'pilot_name' && !value) {
    saveError.value = 'A pilot needs a name.'
    input.value = character.value!.pilot_name
    return
  }
  track(updateCharacter({ [column]: value }))
}

// --- Registering: just a name (and optionally a callsign), then the full sheet opens ---
const newPilot = reactive({ callsign: '', name: '' })
const registerError = ref('')

async function register() {
  const name = newPilot.name.trim()
  if (!name) {
    registerError.value = 'A pilot needs a name.'
    return
  }
  registerError.value = (await create({ pilot_name: name, callsign: newPilot.callsign.trim() || null })) ?? ''
}

// --- Long writing ---
const saveColumn = (column: 'appearance' | 'personality') => (doc: Json | null) => track(updateCharacter({ [column]: doc }))
const saveBackstory = (doc: Json | null) => track(updateSheet({ backstory: doc }))

// --- Stats: personal stats come from the pilot_stats table, piloting stats are LANCER's HASE ---
// Bionics for their box, each opening its full information.
const bionicOptions = computed(() => {
  const statNames = new Map(pilotStats.value.map((stat) => [stat.id, stat.name]))
  return bionicItems(bionics.value, PRICES.bionic).map((item, i) => ({ ...item, info: () => bionicInfo(bionics.value[i], statNames, PRICES.bionic) }))
})
const stats = computed(() => sheetStats(sheet.value, pilotStats.value, bionics.value, pilotBonuses(sheet.value, gear.value, talents.value, coreBonuses.value)))
const vitals = computed(() => pilotVitals(sheet.value, gear.value, talents.value, coreBonuses.value))

// --- Level and manna (set by GMs), what manna buys, and the rule check (src/rules.ts; docs/lancer-rules.md) ---
const { frames, weapons, systems, integrated } = useMechData()
const balance = computed(() => gm.value.manna - mannaSpent(sheet.value))

// Licences: one per licensed frame. Each rank unlocks the frame and gear of that licence level.
const licenceOptions = computed(() =>
  frames.value
    .filter((frame) => frame.licenceLevel > 0)
    .map((frame) => ({ id: frame.id, name: licenceName(frames.value, frame.id), meta: frame.mechtype.join('/'), info: () => frameInfo(frame, frames.value) })),
)
const licenceDetails = (id: string): RankStep[] =>
  [1, 2, 3].map((level) => ({
    unlocks: [
      ...frames.value.filter((f) => f.id === id && f.licenceLevel === level).map((f) => ({ kind: 'frame', name: f.name, info: () => frameInfo(f, frames.value) })),
      ...weapons.value.filter((w) => w.licenceId === id && w.licenceLevel === level).map((w) => ({ kind: 'weapon', name: w.name, info: () => itemInfo(w) })),
      ...systems.value.filter((s) => s.licenceId === id && s.licenceLevel === level).map((s) => ({ kind: 'system', name: s.name, info: () => itemInfo(s) })),
    ],
  }))
// Hangar cards show their frame's manufacturer as its logo and a thin top border, nothing more. Frames are private:
// without the sheet there's no frame, so other players' view of the card stays neutral.
const manufacturers = useManufacturers()
const frameOf = (mechId: string) => frames.value.find((f) => f.id === sheet.value.mechs?.[mechId]?.frame)
const makerOf = (mechId: string) => manufacturers.value.find((m) => m.id === frameOf(mechId)?.source)
const saveLicences = (licences: Record<string, number>) => track(updateSheet({ licences }))

// Talents: each rank's name and rules.
const talentOptions = computed(() => talents.value.map((t) => ({ id: t.id, name: t.name, meta: t.terse, info: () => talentInfo(t) })))
const talentDetails = (id: string): RankStep[] =>
  (talents.value.find((t) => t.id === id)?.ranks ?? []).map((r) => ({ name: r.name, html: r.description }))
const saveTalents = (talentRanks: Record<string, number>) => track(updateSheet({ talents: talentRanks }))

const saveCoreBonuses = (ids: string[]) => track(updateSheet({ core_bonuses: ids }))

// The rule check speaks to whoever can fix it: you, on your own editable sheet (a draft: before you submit it).
const ruleFix = computed(() => (!own || !editable.value ? undefined : draft.value ? 'draft' : 'own'))
// Manna in the header, with thousands separators ("2,900 of 3,000 spent").
const amount = (n: number) => n.toLocaleString('en-GB')
// Your own sheet (and any dead pilot's) has the next-step bar under the header; GMs on a record get a link to review.
const hasNext = computed(() => own || character.value?.status === 'dead')
const gmLink = computed(() => isGm.value && !own && !reviewing)

// The sections, one shown at a time (SheetTabs.vue), remembered in the url as ?tab= so a mech page can link back to
// the hangar. Players without the private sheet only get the public ones; anything else falls back to profile.
const tabs = computed(() => (canSeePrivate.value ? ['profile', 'stats', 'equipment', 'licences', 'talents', 'mechs'] : ['profile', 'mechs']))
const tab = computed({
  get: () => (tabs.value.includes(String(route.query.tab)) ? String(route.query.tab) : 'profile'),
  set: (next: string) => router.replace({ query: { ...route.query, tab: next === 'profile' ? undefined : next } }),
})

// Waits for the catalogues, so mechs don't flash up as "not in the loaded content packs".
const problems = computed(() =>
  frames.value.length
    ? pilotProblems(
        sheet.value,
        gm.value,
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
        Object.fromEntries(mechs.value.map((m) => [m.id, m.name])),
      )
    : personalStatProblems(sheet.value.pilot_stats),
)

// Saves every stat in the row, so the sheet records the defaults too, not just the one that changed.
function setStat(key: 'pilot_stats' | 'mech_skills', stats: { id: string; value: number }[], id: string, value: number) {
  const values: Sheet['pilot_stats'] = Object.fromEntries(stats.map((stat) => [stat.id, stat.value]))
  track(updateSheet({ [key]: { ...values, [id]: value } }))
}

// --- Bionics and the loadout (1 armour, 2 weapons, 3 gear): picked from the catalogues, stored as ids ---
const saveBionics = (ids: (string | number)[]) => track(updateSheet({ bionics: ids as number[] }))
const saveGear = (ids: string[]) => track(updateSheet({ pilot_gear: ids }))

// --- Hangar: a new mech starts with just a name and manufacturer id, then opens its own page ---
const addingMech = ref(false)
const newMech = reactive({ name: '', manufacturerId: '' })
const mechError = ref('')

function openNewMech() {
  Object.assign(newMech, { name: '', manufacturerId: '' })
  mechError.value = ''
  addingMech.value = true
}

async function createMech() {
  const name = newMech.name.trim()
  const manufacturerId = newMech.manufacturerId.trim().toUpperCase()
  mechError.value = mechProblem(name, manufacturerId) ?? ''
  if (mechError.value) return
  // shortcut: duplicate manufacturer ids aren't checked yet. Warn about them once the registry reads real pilots.
  const mech: PublicMech = { id: crypto.randomUUID(), name, manufacturer_id: manufacturerId, appearance: null, image: null }
  mechError.value = (await updateCharacter({ mechs: [...mechs.value, mech] })) ?? ''
  if (!mechError.value) router.push(mechLink(mech.id))
}
</script>

<template>
  <main class="page manage">
    <nav v-if="!own && character" aria-label="Breadcrumb" class="crumbs">
      <ol>
        <li><RouterLink :to="{ name: back.name }">{{ back.label }}</RouterLink></li>
        <li aria-current="page">{{ character.callsign ?? character.pilot_name }}</li>
      </ol>
    </nav>

    <p v-if="loading" class="dim">Loading pilot record…</p>
    <p v-else-if="loadError" class="notice warn" role="alert">{{ loadError }}</p>
    <p v-else-if="!character && !own" class="notice warn" role="alert">No pilot record with that id.</p>

    <!-- No pilot yet: a name registers one, then the full sheet opens. -->
    <section v-else-if="!character" class="register panel">
      <h1 class="sheet-label">Register a pilot</h1>
      <form class="register-form" @submit.prevent="register">
        <p>No pilot on file. A name is all that's needed to start; everything else is filled in on the sheet.</p>
        <label class="field">
          <span>Callsign</span>
          <input v-model="newPilot.callsign" type="text" />
        </label>
        <label class="field">
          <span>Name (required)</span>
          <input v-model="newPilot.name" type="text" required />
        </label>
        <p v-if="registerError" class="notice warn" role="alert">{{ registerError }}</p>
        <button type="submit" class="primary">Register pilot</button>
      </form>
    </section>

    <div v-else class="sheet">
      <!-- The header: who this is and the figures that matter (the prototype's compact header). -->
      <header class="header" :class="{ joined: hasNext || gmEditing }">
        <div class="thumb">
          <img v-if="character.pilot_image" :src="character.pilot_image" :alt="`Portrait of ${character.callsign ?? character.pilot_name}`" />
          <Icon v-else name="pilot" />
        </div>
        <div class="who">
          <!-- While editable the callsign is a field, so the page's heading is for screen readers only. -->
          <h1 v-if="editable" class="sr-only">{{ character.callsign || character.pilot_name || 'My pilot' }}</h1>
          <input
            v-if="editable"
            class="inline callsign"
            type="text"
            aria-label="Callsign"
            placeholder="Callsign"
            :value="character.callsign ?? ''"
            @change="saveText('callsign', $event)"
          />
          <h1 v-else class="callsign">{{ character.callsign ?? character.pilot_name }}</h1>
          <div class="subline sep">
            <span>
              <input
                v-if="editable"
                class="inline name"
                type="text"
                aria-label="Name"
                placeholder="Name"
                :value="character.pilot_name"
                @change="saveText('pilot_name', $event)"
              />
              <template v-else>{{ character.pilot_name }}</template>
            </span>
            <span>Player: {{ playerName || '–' }}</span>
            <span>
              <span v-if="character.status === 'pending' && reviewNote" class="badge rejected">Sent back</span>
              <span v-else class="badge" :class="character.status">{{ character.status }}</span>
            </span>
          </div>
        </div>
        <div v-if="canSeePrivate || gmLink || gmCanEdit" class="header-side">
          <dl v-if="canSeePrivate" class="facts">
            <div class="fact">
              <dt class="label">Level</dt>
              <dd class="fact-value num">{{ gm.level }}</dd>
            </div>
            <div class="fact">
              <dt class="label">Licence level</dt>
              <dd class="fact-value num">{{ licenceLevel(sheet) }}</dd>
            </div>
            <div class="fact">
              <dt class="label">Manna left</dt>
              <dd class="fact-value num" :class="{ over: balance < 0 }">{{ amount(balance) }}</dd>
              <dd class="fact-sub"><span class="num">{{ amount(mannaSpent(sheet)) }}</span> of <span class="num">{{ amount(gm.manna) }}</span> spent</dd>
            </div>
          </dl>
          <div v-if="gmLink || (gmCanEdit && !gmEditing)" class="gm-actions">
            <RouterLink v-if="gmLink" class="gm-link" :to="{ name: 'gm-review', params: { id: character.id } }">
              {{ character.status === 'pending' ? 'GM review' : 'GM controls' }}
            </RouterLink>
            <button v-if="gmCanEdit && !gmEditing" type="button" class="small" @click="setEdit(true)">Edit pilot</button>
          </div>
        </div>
      </header>

      <GmEditBar
        v-if="gmEditing"
        :name="character.callsign ?? character.pilot_name"
        :waiting="waiting"
        :status="saving ? 'Saving…' : saved ? 'Saved' : ''"
        :error="saveError"
        :can-retry="!conflict"
        @retry="track(retry())"
        @done="setEdit(false)"
      />

      <!-- What happens next: a badge, a sentence and the actions that do it (secondary first, the primary last). Your
           own sheet's save status follows the sentence. -->
      <div v-if="hasNext" class="next">
        <p v-if="character.status === 'dead'" class="next-text">This pilot is dead. The record is kept, read-only.</p>
        <template v-else-if="character.status === 'pending' && reviewNote">
          <span class="badge rejected">Sent back</span>
          <p class="next-text">Sent back by a GM. Change what they asked (note below), then resubmit.</p>
        </template>
        <template v-else-if="character.status === 'pending'">
          <span class="badge pending">Waiting for review</span>
          <p class="next-text">Waiting on a GM. You can keep editing.</p>
        </template>
        <template v-else-if="!draft">
          <span v-if="change?.status === 'rejected'" class="badge rejected">Change rejected</span>
          <p class="next-text">{{ change?.status === 'rejected' ? 'Your last change was rejected (reason below).' : 'Approved. Changes go to a GM for review.' }}</p>
        </template>
        <template v-else-if="!draft.submitted_at">
          <span class="badge draft">Draft change</span>
          <p class="next-text">Drafting a change. Your approved pilot stays as it is until a GM approves.</p>
        </template>
        <template v-else>
          <span class="badge pending">Change submitted</span>
          <p class="next-text">Change submitted, waiting on a GM. The sheet shows what you sent.</p>
        </template>

        <p v-if="own" class="save-status" role="status">
          <template v-if="saveError">
            <span class="error">Not saved: {{ saveError }}</span>
            <button v-if="!conflict" type="button" class="small quiet" @click="track(retry())">Retry</button>
          </template>
          <span v-else-if="saving" class="dim">Saving…</span>
          <span v-else-if="saved" class="dim">Saved</span>
        </p>

        <div v-if="own && character.status !== 'dead'" class="next-actions">
          <button v-if="character.status === 'pending' && reviewNote" type="button" class="primary small" @click="track(resubmit())">Resubmit for review</button>
          <button v-else-if="approvedOwn && !draft" type="button" class="primary small" @click="track(proposeChange())">Propose changes</button>
          <template v-else-if="approvedOwn && !draft!.submitted_at">
            <button type="button" class="small" @click="withdraw">Withdraw</button>
            <button type="button" class="primary small" @click="track(submitChange())">Submit for review</button>
          </template>
          <template v-else-if="approvedOwn">
            <button type="button" class="small" @click="track(reopenChange())">Edit change</button>
            <button type="button" class="small" @click="withdraw">Withdraw</button>
          </template>
        </div>
      </div>

      <ConflictNotice v-if="conflict" />
      <CatalogueNotice />

      <!-- Long notes and the rule check sit under the header. -->
      <div v-if="own && reviewNote && character.status === 'pending'" class="notice warn" role="note">
        <p class="notice-title">Note from the GM</p>
        <p class="note-text">{{ reviewNote }}</p>
      </div>
      <div v-else-if="own && reviewNote && character.status === 'approved'" class="notice" role="note">
        <div class="notice-head">
          <p class="notice-title">Note from the GM</p>
          <button type="button" class="small quiet" :disabled="saving" @click="track(dismissApprovalNote())">Clear note</button>
        </div>
        <p class="note-text">{{ reviewNote }}</p>
      </div>
      <div v-if="changeNote" class="notice" role="note">
        <div class="notice-head">
          <p class="notice-title">Note from the GM</p>
          <button type="button" class="small quiet" @click="clearChangeNote">Clear note</button>
        </div>
        <p class="note-text">Your last change was approved.</p>
        <p class="note-text">{{ changeNote }}</p>
      </div>
      <div v-if="approvedOwn && !draft && change?.status === 'rejected'" class="notice warn" role="note">
        <p class="notice-title">A GM rejected your last change</p>
        <p class="note-text">{{ change.review_reason }}</p>
      </div>
      <RuleCheck v-if="canSeePrivate" :problems="problems" :fix="ruleFix" />

      <!-- One section at a time. v-show keeps every panel mounted, so switching never loses an open picker or an
           unsaved field. Only this slim row sticks (under the top bar). -->
      <SheetTabs v-model="tab" :tabs="tabs" class="sheet-tabs" :counts="{ mechs: mechs.length }" />

      <div v-show="tab === 'profile'" class="tab-panel">
        <div class="profile">
          <div class="writing">
            <SheetField class="panel" title="Appearance" :doc="character.appearance" :editable="editable" :save="saveColumn('appearance')" />
            <SheetField class="panel" title="Personality" :doc="character.personality" :editable="editable" :save="saveColumn('personality')" />
            <SheetField
              v-if="canSeePrivate"
              class="panel"
              title="Backstory"
              tag="Private"
              :doc="sheet.backstory ?? null"
              :editable="editable"
              :save="saveBackstory"
            />
          </div>
          <section class="panel">
            <h2 class="sheet-label">Identity</h2>
            <Portrait class="identity-portrait" :src="character.pilot_image" :alt="`Portrait of ${character.callsign ?? character.pilot_name}`" />
            <p v-if="own" class="dim upload">Portrait upload isn't available yet.</p>
            <dl class="kv">
              <template v-for="[column, label] in IDENTITY" :key="column">
                <dt><label v-if="editable" :for="`identity-${column}`">{{ label }}</label><template v-else>{{ label }}</template></dt>
                <dd>
                  <input v-if="editable" :id="`identity-${column}`" type="text" :value="character[column] ?? ''" @change="saveText(column, $event)" />
                  <template v-else>{{ character[column] ?? '–' }}</template>
                </dd>
              </template>
            </dl>
          </section>
        </div>
        <!-- Your approved pilot can die without a GM's approval, after an "are you sure?". -->
        <section v-if="approvedOwn" class="panel danger-zone">
          <h2 class="sheet-label">Danger zone</h2>
          <div class="danger-body">
            <p class="dim">If your pilot dies in the story, mark them dead. This can't be undone.</p>
            <button type="button" class="danger" @click="confirmDeath">Mark pilot dead</button>
          </div>
        </section>
      </div>

      <template v-if="canSeePrivate">
        <div v-show="tab === 'stats'" class="tab-panel section-grid">
          <StatRow class="panel span-all" title="General stats" tag="Private" :stats="vitals" :editable="false" :min="0" :max="0" />
          <StatRow
            class="panel"
            title="Piloting stats (HASE)"
            tag="Private"
            :stats="stats.piloting"
            :editable="editable"
            :min="STAT_MIN"
            :max="STAT_MAX"
            :budget="skillPoints(gm.level)"
            @set="(id, value) => setStat('mech_skills', stats.piloting, id, value)"
          />
          <StatRow
            class="panel"
            title="Personal stats"
            tag="Private"
            :stats="stats.personal"
            :editable="editable"
            :min="PERSONAL_STAT_MIN"
            :max="PERSONAL_STAT_MAX"
            :budget="PERSONAL_STAT_POINTS"
            @set="(id, value) => setStat('pilot_stats', stats.personal, id, value)"
          />
        </div>
        <div v-show="tab === 'equipment'" class="tab-panel">
          <LoadoutBox
            class="panel"
            title="bionics"
            tag="Private"
            :items="bionicOptions"
            :chosen="sheet.bionics ?? []"
            :editable="editable"
            :limit="{ label: 'Mod points', unit: 'mod', max: modLimit(gm.level) }"
            :add-blocked="balance < PRICES.bionic ? 'Not enough manna' : ''"
            :save="saveBionics"
          />
          <PilotLoadout class="panel" :items="gear" :chosen="sheet.pilot_gear ?? []" :editable="editable" :save="saveGear" />
        </div>
        <div v-show="tab === 'licences'" class="tab-panel">
          <RankPanel
            class="panel"
            title="licences"
            noun="licence"
            :options="licenceOptions"
            :held="sheet.licences ?? {}"
            :details="licenceDetails"
            columns
            :price="PRICES.licenceRank"
            :balance="balance"
            :editable="editable"
            :save="saveLicences"
          >
            <template #summary>
              <span class="meter-inline">Licence level <span class="num">{{ licenceLevel(sheet) }}</span></span>
            </template>
          </RankPanel>
          <CoreBonusPanel
            class="panel"
            :options="coreBonuses"
            :licences="sheet.licences ?? {}"
            :frames="frames"
            :taken="sheet.core_bonuses ?? []"
            :picks="coreBonusPicks(sheet)"
            :editable="editable"
            :save="saveCoreBonuses"
          />
        </div>
        <div v-show="tab === 'talents'" class="tab-panel">
          <RankPanel
            class="panel"
            title="talents"
            noun="talent"
            :options="talentOptions"
            :held="sheet.talents ?? {}"
            :details="talentDetails"
            tiers
            :price="PRICES.talentRank"
            :balance="balance"
            :editable="editable"
            :save="saveTalents"
          />
        </div>
      </template>

      <div v-show="tab === 'mechs'" class="tab-panel">
        <section class="panel">
          <header class="sheet-head hangar-head">
            <h2 class="sheet-label">Mech hangar</h2>
            <button v-if="editable && !addingMech" type="button" class="small" @click="openNewMech"><Icon name="plus" />New mech</button>
          </header>
          <ul v-if="mechs.length" class="hangar">
            <li v-for="mech in mechs" :key="mech.id">
              <RouterLink :to="mechLink(mech.id)" class="mech-card" :style="makerOf(mech.id) ? { '--mf': makerColour(makerOf(mech.id)) } : undefined">
                <span class="mech-thumb">
                  <img v-if="mech.image" :src="mech.image" :alt="`Image of ${mech.name}`" />
                  <Icon v-else-if="makerLogo(makerOf(mech.id))" :src="makerLogo(makerOf(mech.id))!" class="mech-logo" />
                  <Icon v-else name="frame" />
                </span>
                <span class="mech-about">
                  <span class="mech-name">{{ mech.name }}</span>
                  <template v-if="frameOf(mech.id)">
                    <span class="mech-frame">{{ frameOf(mech.id)!.source }} {{ frameOf(mech.id)!.name }}</span>
                    <span v-if="frameOf(mech.id)!.mechtype.length" class="mech-class dim">{{ frameOf(mech.id)!.mechtype.join(' / ') }}</span>
                  </template>
                  <span class="code dim mech-id">{{ mech.manufacturer_id }}</span>
                </span>
              </RouterLink>
            </li>
          </ul>

          <form v-if="addingMech" class="new-mech" @submit.prevent="createMech">
            <label class="field">
              <span>Mech name (required)</span>
              <input v-model="newMech.name" type="text" required />
            </label>
            <label class="field">
              <span>Manufacturer ID (XXXX-XXXX-XXXX)</span>
              <input v-model="newMech.manufacturerId" type="text" required />
            </label>
            <p v-if="mechError" class="notice warn" role="alert">{{ mechError }}</p>
            <div class="actions">
              <button type="submit" class="primary">Create mech</button>
              <button type="button" @click="addingMech = false">Cancel</button>
            </div>
          </form>
          <p v-else-if="!mechs.length" class="empty">{{ editable ? 'No mechs yet.' : 'No mechs on file.' }}</p>
        </section>
      </div>

      <!-- :key resets the decision box after a decision, so it shows the new status. -->
      <GmReview v-if="reviewing && isGm" :key="character.status" :pilot="character" :sheet-updated-at="sheetUpdatedAt" :problems="problems" @reviewed="load" />
    </div>
  </main>
</template>

<style scoped>
.sheet,
.tab-panel,
.writing {
  display: flex;
  flex-direction: column;
  gap: var(--space-m);
}

/* The stats tab is a .section-grid (style.css), not a column. */
.tab-panel.section-grid {
  display: grid;
}

/* --- Header: portrait, callsign and name, then the figures (the prototype's .header) --- */
.header {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-l);
  padding: var(--space-l);
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  background: var(--panel);
  overflow-wrap: anywhere; /* a long unbroken name wraps instead of widening the page */
}

/* With the next-step bar under it, the two read as one block. */
.header.joined {
  border-radius: var(--radius) var(--radius) 0 0;
}

.thumb {
  display: grid;
  place-items: center;
  width: 84px;
  aspect-ratio: 3 / 4;
  overflow: hidden;
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  background: var(--raised);
  color: var(--text-dim);
}

.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumb .icon {
  width: 28px;
  height: 28px;
}

.who {
  display: flex;
  flex-direction: column;
  align-items: flex-start; /* don't stretch the fields: they size to their text */
  min-width: 0;
}

.callsign {
  margin: 0;
  color: var(--text);
  font: 800 var(--fs-xl) / 1.1 var(--sans);
  letter-spacing: 0.02em;
}

.subline {
  align-self: stretch;
  margin-top: 4px;
  color: var(--text-dim);
  font-size: var(--fs-s);
}

/* Callsign and name: plain text with a faint underline that says they can be edited. */
.inline {
  min-height: 0;
  margin-left: -6px;
  padding: 1px 6px;
  border-color: transparent;
  border-bottom-color: var(--rule);
  background: none;
  /* Hug the text. shortcut: Firefox has no field-sizing and keeps its default ~20ch width; fine until Firefox ships it. */
  width: auto;
  min-width: 8ch;
  max-width: 100%;
  field-sizing: content;
}

.inline:hover {
  border-color: var(--rule);
}

/* The name's item in the dot-separated line keeps the field's full width (it would shrink and clip it otherwise). */
.subline > :first-child {
  flex-shrink: 0;
  max-width: 100%;
}

/* No percentage cap here: against its shrink-to-fit item it would clip the last letters. */
.inline.name {
  max-width: none;
  color: var(--text-dim);
  font-size: var(--fs-s);
}

.header-side {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-m) var(--space-xl);
}

/* Uppercase labels over mono numbers, lined up across the three (a subgrid of label, value, note). */
.facts {
  display: grid;
  grid-template-rows: auto auto auto;
  grid-auto-flow: column;
  gap: 2px var(--space-xl);
  margin: 0;
}

.fact {
  display: grid;
  grid-row: span 3;
  grid-template-rows: subgrid;
  align-content: start;
}

.fact dd {
  margin: 0;
}

.fact-value {
  font-size: 22px;
  font-weight: 700;
  line-height: 1.1;
}

.fact-value.over {
  color: var(--danger);
}

.fact-sub {
  color: var(--text-dim);
  font-size: var(--fs-xs);
}

/* The GM's way to the review page: a link drawn as a small button. */
.gm-actions {
  display: flex;
  align-items: stretch; /* the link and the button match in height */
  gap: var(--space-s);
}

.gm-link {
  display: inline-flex;
  align-items: center;
  min-height: 28px;
  padding: 0 10px;
  border: 1px solid var(--edge);
  border-radius: var(--radius);
  font: 700 var(--fs-xs) / 1.2 var(--sans);
  letter-spacing: 0.06em;
  text-decoration: none;
  text-transform: uppercase;
  white-space: nowrap;
}

.gm-link:hover {
  border-color: var(--lilac);
  background: color-mix(in srgb, var(--lilac) 8%, transparent);
}

/* --- What happens next: a band joined to the header's foot --- */
.next {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-s) var(--space-m);
  margin-top: calc(-1 * var(--space-m)); /* joined to the header: cancels the sheet's gap */
  padding: var(--space-s) var(--space-l);
  border: 1px solid var(--rule);
  border-top: 0;
  border-radius: 0 0 var(--radius) var(--radius);
  background: var(--void);
  font-size: var(--fs-s);
}

.next p {
  max-width: none;
  margin: 0;
}

.next-text {
  flex: 0 1 auto;
}

.save-status .error {
  color: var(--danger);
}

.next-actions {
  display: flex;
  gap: var(--space-s);
  margin-left: auto;
}

.note-text {
  white-space: pre-wrap;
}

/* --- Tabs: the only thing that sticks, under the top bar --- */
.sheet-tabs {
  position: sticky;
  top: var(--topbar-h);
  z-index: 2;
  background: var(--void);
}

/* Anything focused (tabbing through fields) scrolls clear of the top bar and tabs. */
.tab-panel * {
  scroll-margin-top: calc(var(--topbar-h) + var(--tabs-h) + var(--space-l));
}

/* --- Profile: writing on the left, identity on the right; one column on phones (below) --- */
.profile {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(16rem, 1fr);
  align-items: start;
  gap: var(--space-m);
}

.identity-portrait {
  width: 100%;
  max-width: 160px;
}

.upload {
  margin: var(--space-s) 0 0;
  font-size: var(--fs-s);
}

.kv {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  align-items: center;
  gap: 6px var(--space-l);
  margin: var(--space-l) 0 0;
  font-size: var(--fs-s);
}

.kv dt {
  color: var(--text-dim);
  font-size: var(--fs-xs);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.kv dd {
  min-width: 0;
  margin: 0;
}

/* --- Registering --- */
.register {
  max-width: 32rem;
}

.register-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-m);
}

.register-form p {
  margin: 0;
}

.register-form button {
  align-self: flex-start;
}

/* --- Hangar: a card per mech, a showcase, so centred: the cards as a group, and the picture, name, frame and class
   within each. Its maker only as the logo and a thin top border (--mf). --- */
.hangar-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-m);
}

.hangar {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--space-m);
  margin: 0;
  padding: 0;
  list-style: none;
}

.hangar > li {
  flex: 0 1 15rem;
}

.mech-card {
  --mf: var(--rule);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-m);
  height: 100%;
  text-align: center;
  padding: var(--space-m);
  border: 1px solid var(--rule);
  border-top: 3px solid var(--mf);
  border-radius: var(--radius);
  background: var(--void);
  color: var(--text);
  overflow-wrap: anywhere;
  text-decoration: none;
}

.mech-card:hover,
.mech-card:focus-visible {
  border-color: var(--lilac);
  border-top-color: var(--mf);
}

.mech-thumb {
  display: grid;
  place-items: center;
  width: 96px;
  aspect-ratio: 3 / 4;
  overflow: hidden;
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  background: var(--raised);
  color: var(--text-dim);
}

.mech-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mech-thumb .icon {
  width: 36px;
  height: 36px;
}

.mech-logo {
  color: var(--mf);
}

.mech-about {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
}

.mech-name {
  font-size: 17px;
  font-weight: 700;
}

.mech-frame,
.mech-class {
  font-size: var(--fs-s);
}

.mech-id {
  margin-top: 2px;
  font-size: 13px;
}

.new-mech {
  display: flex;
  flex-direction: column;
  gap: var(--space-m);
  width: min(100%, 24rem);
}

.new-mech p {
  margin: 0;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-s);
}

@media (max-width: 56rem) {
  .profile {
    grid-template-columns: minmax(0, 1fr);
  }
}

/* --- Phones: the compact header (56px portrait, the figures on one tight row under it) --- */
@media (max-width: 48rem) {
  .header {
    grid-template-columns: auto minmax(0, 1fr);
    gap: var(--space-s) var(--space-m);
    padding: var(--space-m);
  }

  .thumb {
    width: 56px;
  }

  .callsign {
    font-size: 22px;
  }

  .header-side {
    grid-column: 1 / -1;
    justify-content: space-between;
    padding-top: var(--space-s);
    border-top: 1px solid var(--rule);
  }

  .facts {
    gap: 0 var(--space-l);
  }

  .facts .label {
    letter-spacing: 0.04em;
  }

  .fact-value {
    font-size: 18px;
  }

  .next {
    padding: var(--space-s) var(--space-m);
  }

  .next-text {
    flex-basis: 100%;
  }

  .next-actions {
    flex-basis: 100%;
  }

  .next-actions button {
    flex: 1;
  }
}
</style>
