<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { makerColour, makerLogo, useManufacturers } from '../archive'
import { isGm } from '../auth'
import { confirmAction } from '../confirm'
import AddBox from '../components/AddBox.vue'
import CoreBonusPanel from '../components/CoreBonusPanel.vue'
import GmReview from '../components/GmReview.vue'
import LoadoutBox from '../components/LoadoutBox.vue'
import PilotLoadout from '../components/PilotLoadout.vue'
import Portrait from '../components/Portrait.vue'
import RankPanel, { type RankStep } from '../components/RankPanel.vue'
import SheetTabs from '../components/SheetTabs.vue'
import RuleCheck from '../components/RuleCheck.vue'
import SheetField from '../components/SheetField.vue'
import StatIcon from '../components/StatIcon.vue'
import StatRow from '../components/StatRow.vue'
import { bionicItems, pilotBonuses, pilotVitals, sheetStats, useGameData } from '../gameData'
import type { Json } from '../lib/database.types'
import { useMechData } from '../mechData'
import { bionicInfo, frameInfo, itemInfo, talentInfo } from '../info'
import { mechProblem, useMyPilot, type Sheet } from '../myPilot'
import type { PublicMech } from '../pilots'
import { coreBonusPicks, licenceLevel, licenceName, mannaSpent, modLimit, pilotProblems, personalStatProblems, PERSONAL_STAT_MIN, PERSONAL_STAT_MAX, PERSONAL_STAT_POINTS, PRICES, skillPoints } from '../rules'

// my pilot: your pilot as one sheet. A summary strip across the top (callsign, facts, and what happens next), then
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
  playerName,
  canSeePrivate,
  loading,
  loadError,
  editable,
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
} = useMyPilot(pilotId)

// Your approved pilot: changes are proposed, then a GM approves them (src/myPilot.ts).
const approvedOwn = computed(() => own && character.value?.status === 'approved')
async function confirmDeath() {
  const name = character.value!.callsign ?? character.value!.pilot_name
  if (await confirmAction(`mark ${name} dead? this can't be undone. they move to the memorial, and you can register a new pilot.`, { confirmLabel: 'mark dead', danger: true }))
    track(markDead())
}

async function withdraw() {
  if (await confirmAction('withdraw this change? everything in it is thrown away; your approved pilot stays as it is.', { confirmLabel: 'withdraw', danger: true }))
    track(withdrawChange())
}

// Records' breadcrumb leads back to the queue, or to the list the pilot is in.
const back = computed(() =>
  reviewing
    ? { name: 'gm-pilots', label: 'gm: pilots' }
    : character.value?.status === 'pending'
      ? { name: 'pending', label: 'pending' }
      : character.value?.status === 'dead'
        ? { name: 'memorial', label: 'memorial' }
        : { name: 'registry', label: 'registry' },
)
// Your own mechs open for editing; anyone else's open read-only under their record.
const mechLink = (mechId: string) =>
  own ? { name: 'mech', params: { mechId } } : { name: 'record-mech', params: { id: pilotId, mechId } }
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

// --- The save status shown in the top strip, for the one-line fields, stats and loadouts ---
const status = ref('')
const saveError = ref('')

async function track(save: Promise<string | null>) {
  status.value = 'saving...'
  saveError.value = (await save) ?? ''
  status.value = saveError.value ? '' : 'saved'
  return saveError.value || null
}

// One-line fields save when you leave them (or press enter). A pilot can't lose its name.
function saveText(column: TextColumn, event: Event) {
  const input = event.target as HTMLInputElement
  const value = input.value.trim() || null
  if (column === 'pilot_name' && !value) {
    saveError.value = 'a pilot needs a name.'
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
    registerError.value = 'a pilot needs a name.'
    return
  }
  registerError.value = (await create({ pilot_name: name, callsign: newPilot.callsign.trim() || null })) ?? ''
}

// --- Long writing ---
const saveColumn = (column: 'appearance' | 'personality') => (doc: Json | null) => updateCharacter({ [column]: doc })
const saveBackstory = (doc: Json | null) => updateSheet({ backstory: doc })

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
    .map((frame) => ({ id: frame.id, name: licenceName(frames.value, frame.id), meta: frame.mechtype.join('/').toLowerCase(), info: () => frameInfo(frame, frames.value) })),
)
const licenceDetails = (id: string): RankStep[] =>
  [1, 2, 3].map((level) => ({
    unlocks: [
      ...frames.value.filter((f) => f.id === id && f.licenceLevel === level).map((f) => ({ kind: 'frame', name: f.name, info: () => frameInfo(f, frames.value) })),
      ...weapons.value.filter((w) => w.licenceId === id && w.licenceLevel === level).map((w) => ({ kind: 'weapon', name: w.name, info: () => itemInfo(w) })),
      ...systems.value.filter((s) => s.licenceId === id && s.licenceLevel === level).map((s) => ({ kind: 'system', name: s.name, info: () => itemInfo(s) })),
    ],
  }))
// Hangar cards take their frame's manufacturer colour and logo. Frames are private: without the sheet there's no
// frame, so other players' view of the card stays neutral.
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

// The sections, one shown at a time (SheetTabs.vue), remembered in the url as ?tab= so a mech page can link back to
// the hangar. Players without the private sheet only get the public ones; anything else falls back to profile.
const tabs = computed(() => (canSeePrivate.value ? ['profile', 'stats', 'equipment', 'licences', 'talents', 'mechs'] : ['profile', 'mechs']))
const tab = computed({
  get: () => (tabs.value.includes(String(route.query.tab)) ? String(route.query.tab) : 'profile'),
  set: (next: string) => router.replace({ query: { ...route.query, tab: next === 'profile' ? undefined : next } }),
})

// The tabs stick just under the summary strip, so they need its height (it changes with the next-step line).
const glance = useTemplateRef<HTMLElement>('glance')
const glanceHeight = ref(0)
const glanceObserver = new ResizeObserver(([entry]) => (glanceHeight.value = entry.borderBoxSize[0].blockSize))
watch(glance, (el, old) => {
  if (old) glanceObserver.unobserve(old)
  if (el) glanceObserver.observe(el)
})
onBeforeUnmount(() => glanceObserver.disconnect())

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
const saveBionics = (ids: (string | number)[]) => updateSheet({ bionics: ids as number[] })
const saveGear = (ids: string[]) => updateSheet({ pilot_gear: ids })

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
  if (!mechError.value) router.push({ name: 'mech', params: { mechId: mech.id } })
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

    <p v-if="loading" class="dim">loading pilot record...</p>
    <p v-else-if="loadError" class="rose" role="alert">{{ loadError }}</p>
    <p v-else-if="!character && !own" class="rose">no pilot record with that id.</p>

    <!-- No pilot yet: a name registers one, then the full sheet opens. -->
    <section v-else-if="!character" class="register panel">
      <h1 class="sheet-label">register a pilot</h1>
      <form class="register-form" @submit.prevent="register">
        <p>no pilot on file. a name is all that's needed to start; everything else is filled in on the sheet.</p>
        <label class="field">
          <span>callsign</span>
          <input v-model="newPilot.callsign" type="text" />
        </label>
        <label class="field">
          <span>name (required)</span>
          <input v-model="newPilot.name" type="text" required />
        </label>
        <p v-if="registerError" class="rose" role="alert">{{ registerError }}</p>
        <button type="submit" class="primary">register pilot</button>
      </form>
    </section>

    <div v-else class="sheet" :style="{ '--glance-h': `${glanceHeight}px` }">
      <!-- The summary strip: who this is, the facts, and what happens next. Sticks under the top bar on wide screens. -->
      <header ref="glance" class="glance panel">
        <div class="names">
          <input
            v-if="editable"
            class="inline callsign"
            type="text"
            aria-label="callsign"
            placeholder="callsign"
            :value="character.callsign ?? ''"
            @change="saveText('callsign', $event)"
          />
          <h1 v-else class="callsign">{{ character.callsign ?? character.pilot_name }}</h1>
          <input
            v-if="editable"
            class="inline name"
            type="text"
            aria-label="name"
            placeholder="name"
            :value="character.pilot_name"
            @change="saveText('pilot_name', $event)"
          />
          <p v-else class="name">{{ character.pilot_name }}</p>
          <p v-if="own" class="save-status" role="status">
            <span v-if="saveError" class="rose">not saved: {{ saveError }}</span>
            <span v-else-if="status" class="dim">{{ status }}</span>
          </p>
        </div>
        <div class="glance-side">
          <dl class="glance-facts">
            <div>
              <dt>player</dt>
              <dd>{{ playerName || '-' }}</dd>
            </div>
            <div>
              <dt>status</dt>
              <dd><span class="badge" :class="character.status">{{ character.status }}</span></dd>
            </div>
            <template v-if="canSeePrivate">
              <div>
                <dt>level</dt>
                <dd>{{ gm.level }}</dd>
              </div>
              <div>
                <dt>manna</dt>
                <dd :class="{ rose: balance < 0 }">{{ balance }} left</dd>
                <dd class="dim small">{{ gm.manna }} received · {{ mannaSpent(sheet) }} spent</dd>
              </div>
            </template>
          </dl>
          <RouterLink v-if="isGm && !own && !reviewing" class="gm-link" :to="{ name: 'gm-review', params: { id: character.id } }">
            {{ character.status === 'pending' ? 'gm review' : 'gm controls' }}
          </RouterLink>
        </div>

        <!-- What happens next, and the action that does it. -->
        <div v-if="own && character.status === 'pending'" class="next">
          <template v-if="reviewNote">
            <p class="rose">sent back by a gm: change what they asked (note below), then resubmit.</p>
            <button type="button" class="primary small" @click="track(resubmit())">resubmit for review</button>
          </template>
          <p v-else class="dim">waiting on a gm. you can keep editing.</p>
        </div>
        <div v-else-if="approvedOwn" class="next">
          <template v-if="!draft">
            <p class="dim">approved. to change your pilot, propose changes for a gm to review.</p>
            <button type="button" class="primary small" @click="track(proposeChange())">propose changes</button>
          </template>
          <template v-else-if="!draft.submitted_at">
            <p>proposing changes. edit the sheet as normal, then submit it. your approved pilot stays as it is until a gm approves.</p>
            <button type="button" class="primary small" @click="track(submitChange())">submit for review</button>
            <button type="button" class="small" @click="withdraw">withdraw</button>
          </template>
          <template v-else>
            <p>change submitted, waiting on a gm. the sheet shows what you submitted.</p>
            <button type="button" class="small" @click="track(reopenChange())">edit change</button>
            <button type="button" class="small" @click="withdraw">withdraw</button>
          </template>
        </div>
        <p v-else-if="character.status === 'dead'" class="next dim">this pilot is dead. the record is kept, read-only.</p>
      </header>

      <!-- Long notes sit under the strip, so the sticky part stays short. -->
      <div v-if="own && reviewNote && character.status === 'pending'" class="notice warn" role="note">
        <p class="rose">note from the gm</p>
        <p class="note-text">{{ reviewNote }}</p>
      </div>
      <div v-else-if="own && reviewNote && character.status === 'approved'" class="notice" role="note">
        <p class="lilac">note from the gm</p>
        <p class="note-text">{{ reviewNote }}</p>
        <div><button type="button" class="small" :disabled="status === 'saving...'" @click="track(dismissApprovalNote())">clear note</button></div>
      </div>
      <div v-if="approvedOwn && !draft && change?.status === 'rejected'" class="notice warn" role="note">
        <p class="rose">a gm rejected your last change.</p>
        <p class="note-text">{{ change.review_reason }}</p>
      </div>
      <RuleCheck v-if="canSeePrivate" :problems="problems" />

      <!-- One section at a time. v-show keeps every panel mounted, so switching never loses an open picker or an
           unsaved field. -->
      <SheetTabs v-model="tab" :tabs="tabs" class="tabs" />

      <div v-show="tab === 'profile'" class="tab-panel profile">
        <!-- Right on wide screens; first on phones. -->
        <aside class="side panel">
          <Portrait :src="character.pilot_image" :alt="`Portrait of ${character.callsign ?? character.pilot_name}`" />
          <p v-if="own" class="dim small">image upload: module offline</p>
          <table class="identity">
            <tbody>
              <tr v-for="[column, label] in IDENTITY" :key="column">
                <th scope="row"><label :for="`identity-${column}`">{{ label }}</label></th>
                <td>
                  <input
                    v-if="editable"
                    :id="`identity-${column}`"
                    type="text"
                    :value="character[column] ?? ''"
                    @change="saveText(column, $event)"
                  />
                  <template v-else>{{ character[column] ?? '-' }}</template>
                </td>
              </tr>
            </tbody>
          </table>
        </aside>

        <div class="writing">
          <SheetField class="panel" title="appearance" :doc="character.appearance" :editable="editable" :save="saveColumn('appearance')" />
          <SheetField class="panel" title="personality" :doc="character.personality" :editable="editable" :save="saveColumn('personality')" />
          <SheetField
            v-if="canSeePrivate"
            class="panel"
            title="backstory"
            tag="private"
            :doc="sheet.backstory ?? null"
            :editable="editable"
            :save="saveBackstory"
          />
          <!-- Your approved pilot can die without a GM's approval, after an "are you sure?". -->
          <section v-if="approvedOwn" class="panel danger-zone">
            <h2 class="sheet-label">danger zone</h2>
            <div class="death-body">
              <p class="dim">if your pilot dies in the story, mark them dead. this can't be undone.</p>
              <button type="button" class="danger" @click="confirmDeath">mark pilot dead</button>
            </div>
          </section>
        </div>
      </div>

      <template v-if="canSeePrivate">
        <div v-show="tab === 'stats'" class="tab-panel">
          <StatRow class="panel" title="general stats" tag="private" :stats="vitals" :editable="false" :min="0" :max="0" />
          <StatRow
            class="panel"
            title="personal stats"
            tag="private"
            :stats="stats.personal"
            :editable="editable"
            :min="PERSONAL_STAT_MIN"
            :max="PERSONAL_STAT_MAX"
            :budget="PERSONAL_STAT_POINTS"
            @set="(id, value) => setStat('pilot_stats', stats.personal, id, value)"
          />
          <StatRow
            class="panel"
            title="piloting stats"
            tag="private"
            :stats="stats.piloting"
            :editable="editable"
            :min="STAT_MIN"
            :max="STAT_MAX"
            :budget="skillPoints(gm.level)"
            @set="(id, value) => setStat('mech_skills', stats.piloting, id, value)"
          />
        </div>
        <div v-show="tab === 'equipment'" class="tab-panel">
          <LoadoutBox
            class="panel"
            title="bionics"
            tag="private"
            :items="bionicOptions"
            :chosen="sheet.bionics ?? []"
            :editable="editable"
            :limit="{ label: 'mod limit', unit: 'mod points', max: modLimit(gm.level) }"
            :add-blocked="balance < PRICES.bionic ? 'not enough manna' : ''"
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
              <span>licence level <strong class="lilac">{{ licenceLevel(sheet) }}</strong></span>
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
        <section class="panel hangar">
          <header class="sheet-head hangar-head">
            <h2 class="sheet-label">mech hangar</h2>
            <button v-if="editable && mechs.length && !addingMech" type="button" class="small" @click="openNewMech">new mech</button>
          </header>
          <ul v-if="mechs.length" class="mechs">
            <li v-for="mech in mechs" :key="mech.id">
              <RouterLink :to="mechLink(mech.id)" class="mech-card" :style="{ '--maker': makerColour(makerOf(mech.id)) }">
                <Portrait :src="mech.image" :alt="`Image of ${mech.name}`">
                  <StatIcon v-if="makerLogo(makerOf(mech.id))" :src="makerLogo(makerOf(mech.id))!" class="mech-logo" />
                </Portrait>
                <span class="mech-name">{{ mech.name }}</span>
                <span v-if="frameOf(mech.id)" class="mech-frame">{{ frameOf(mech.id)!.source }} {{ frameOf(mech.id)!.name }}</span>
                <span class="dim">{{ mech.manufacturer_id }}</span>
              </RouterLink>
            </li>
          </ul>

          <form v-if="addingMech" class="new-mech" @submit.prevent="createMech">
            <label class="field">
              <span>mech name (required)</span>
              <input v-model="newMech.name" type="text" required />
            </label>
            <label class="field">
              <span>manufacturer id (XXXX-XXXX-XXXX)</span>
              <input v-model="newMech.manufacturerId" type="text" required />
            </label>
            <p v-if="mechError" class="rose" role="alert">{{ mechError }}</p>
            <div class="actions">
              <button type="submit" class="primary">create mech</button>
              <button type="button" @click="addingMech = false">cancel</button>
            </div>
          </form>
          <AddBox v-else-if="editable && !mechs.length" label="new mech" class="add-mech" @click="openNewMech" />
          <p v-else-if="!mechs.length" class="empty">no mechs on file.</p>
        </section>
      </div>

      <!-- :key resets the decision box after a decision, so it shows the new status. -->
      <GmReview v-if="reviewing && isGm" :key="character.status" :pilot="character" :problems="problems" @reviewed="load" />
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

.small {
  font-size: 0.8125rem;
}

/* --- Summary strip --- */
.glance {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 2.5rem;
  padding-block: 0.9rem;
}

.names {
  display: flex;
  flex: 1 1 18rem;
  flex-direction: column;
  min-width: 0;
}

.callsign {
  margin: 0;
  color: var(--lilac);
  font: 700 2rem/1.15 var(--mono);
}

.name {
  margin: 0;
  color: var(--text-dim);
  font-size: 1rem;
}

/* Callsign and name: plain text with a faint underline that says they can be edited. */
.inline {
  min-height: 0;
  margin-left: -0.35rem;
  padding: 0.1rem 0.35rem;
  border-color: transparent;
  border-bottom-color: var(--rule);
  background: none;
}

.inline:hover {
  border-color: var(--rule);
}

.glance-side {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1.5rem;
}

.glance-facts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 2rem;
  margin: 0;
}

.glance-facts dt {
  color: var(--text-dim);
  font-size: 0.8125rem;
}

.glance-facts dd {
  margin: 0;
  font-size: 1.0625rem;
}

.glance-facts dd.small {
  font-size: 0.8125rem;
}

/* The GM's way to the review page: a link drawn as a small button. */
.gm-link {
  padding: 0.3rem 0.65rem;
  border: 1px solid var(--rule);
  font: 600 0.875rem/1.5 var(--mono);
  text-decoration: none;
}

.gm-link:hover {
  border-color: var(--lilac);
  color: var(--lilac);
}

.save-status {
  min-height: 1.25rem;
  margin: 0;
  font-size: 0.8125rem;
}

.next {
  display: flex;
  flex-basis: 100%;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1rem;
  max-width: none;
  margin: 0;
  padding-top: 0.6rem;
  border-top: 1px solid var(--rule);
  font-size: 0.875rem;
}

.next p {
  flex: 1 1 20rem;
  margin: 0;
}

.note-text {
  margin: 0;
  white-space: pre-wrap;
}

.tabs {
  padding-top: 0.6rem;
}

/* Sticky only where there's room: wide and tall screens. The tabs stick just under the strip. */
@media (min-width: 48rem) and (min-height: 40rem) {
  .glance {
    position: sticky;
    top: var(--topbar-h);
    z-index: 2;
  }

  .tabs {
    position: sticky;
    top: calc(var(--topbar-h) + var(--glance-h));
    z-index: 2;
    background: var(--void);
  }
}

/* --- Profile: writing on the left, portrait and identity on the right --- */
.profile {
  display: grid;
  grid-template-areas: 'writing side';
  grid-template-columns: minmax(0, 1fr) clamp(16rem, 24vw, 22rem);
  align-items: start;
}

.writing {
  grid-area: writing;
}

.side {
  grid-area: side;
}

.side p {
  margin: 0.35rem 0 0;
}

.identity {
  width: 100%;
  margin-top: 1rem;
  border-collapse: collapse;
}

.identity th,
.identity td {
  padding: 0.25rem 0;
  text-align: left;
  vertical-align: middle;
}

.identity th {
  width: 6rem;
  color: var(--text-dim);
  font-size: 0.8125rem;
  font-weight: 400;
}

.danger-zone {
  border-color: var(--rose);
}

.danger-zone .sheet-label {
  color: var(--rose);
}

.death-body {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 1.5rem;
}

.death-body p {
  margin: 0;
}

/* --- Registering --- */
.register {
  max-width: 32rem;
}

.register-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.register-form p {
  margin: 0;
}

.register-form button {
  align-self: flex-start;
}

/* --- Hangar: mechs centred, so a single mech sits in the middle --- */
.hangar {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.hangar-head {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0;
}

.mechs {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 1rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.mech-card {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  width: 13rem;
  padding: 0.6rem;
  border: 1px solid color-mix(in srgb, var(--maker) 45%, var(--rule));
  border-top: 4px solid var(--maker);
  background: color-mix(in srgb, var(--maker) 8%, var(--void));
  color: var(--text);
  font-size: 0.8125rem;
  text-align: center;
  text-decoration: none;
}

.mech-card:hover,
.mech-card:focus-visible {
  border-color: var(--maker);
}

.mech-card :deep(.portrait) {
  border-color: color-mix(in srgb, var(--maker) 35%, var(--rule));
}

.mech-logo {
  display: block;
  margin: 0 auto 0.5rem;
  color: var(--maker);
  font-size: 3.5rem;
  opacity: 0.45;
}

.mech-name {
  margin-top: 0.35rem;
  color: var(--maker);
  font-size: 1rem;
  font-weight: 700;
}

.mech-frame {
  color: var(--text);
}

.add-mech {
  max-width: 16rem;
  margin-inline: auto;
}

.new-mech {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: min(100%, 24rem);
  margin-inline: auto;
}

.new-mech p {
  margin: 0;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
}

/* --- Narrow screens: one column, with the portrait first --- */
@media (max-width: 56rem) {
  .profile {
    grid-template-areas: 'side' 'writing';
    grid-template-columns: minmax(0, 1fr);
  }

  /* A smaller portrait, so the writing isn't pushed a whole screen down. */
  .side :deep(.portrait) {
    width: min(100%, 14rem);
    margin-inline: auto;
  }

  .side p {
    text-align: center;
  }
}

/* --- Phones: the strip stacked and centred --- */
@media (max-width: 48rem) {
  .crumbs ol {
    justify-content: center;
  }

  .glance {
    flex-direction: column;
    text-align: center;
  }

  .names {
    flex: none;
    align-items: center;
    width: 100%;
  }

  .names input {
    margin-left: 0;
    text-align: center;
  }

  .callsign {
    font-size: 1.75rem;
  }

  .glance-side,
  .glance-facts {
    justify-content: center;
  }

  .next {
    justify-content: center;
    text-align: center;
  }

  .next p {
    flex-basis: 100%;
  }
}
</style>
