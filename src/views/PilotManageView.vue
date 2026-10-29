<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { isGm } from '../auth'
import AddBox from '../components/AddBox.vue'
import CoreBonusPanel from '../components/CoreBonusPanel.vue'
import GmReview from '../components/GmReview.vue'
import LoadoutBox from '../components/LoadoutBox.vue'
import PilotLoadout from '../components/PilotLoadout.vue'
import Portrait from '../components/Portrait.vue'
import RankPanel from '../components/RankPanel.vue'
import RuleCheck from '../components/RuleCheck.vue'
import ReviewText from '../components/ReviewText.vue'
import { sameContent } from '../textDiff'
import SheetField from '../components/SheetField.vue'
import StatRow from '../components/StatRow.vue'
import { bionicItems, sheetStats, useGameData } from '../gameData'
import type { Json } from '../lib/database.types'
import { useMechData } from '../mechData'
import { mechProblem, useMyPilot, type Sheet, type PilotSnapshot } from '../myPilot'
import type { PublicMech } from '../pilots'
import { coreBonusPicks, licenceLevel, licenceName, mannaSpent, modLimit, pilotProblems, PRICES, rankName, skillPoints } from '../rules'

// my pilot: your pilot as one sheet, laid out like COMP/CON. The important bits across the top,
// long writing on the left, the portrait and identity table on the right (above the writing on phones),
// then stats, bionics, gear, the mech hangar, licences, core bonuses and talents. Everything is edited in place and saves itself.
// While a pilot is pending you can edit it directly; once it's approved, changes go through pending
// paperwork (not built yet), so the sheet turns read-only.
// The same page, read-only, is every pilot's record (opened from a card, route param "id"), so a record looks
// just like your own sheet. Private sections show only when the database hands over the sheet (the pilot's
// player, GMs and owners). On the gm-review route (from the gm: pilots tab) GMs also get their controls: level,
// manna and, while pending, the decision.
// Homebrew (src/rules.ts): level (set by GMs) gives HASE points and the mod limit; manna (received from GMs)
// buys licence ranks, biomods and talent ranks; every 3 licence ranks give a free core bonus.

const props = defineProps<{ snapshot?: PilotSnapshot; before?: PilotSnapshot; mechAnchorPrefix?: string }>()
const sectionChanged = (key: keyof Sheet) => !!props.before && !sameContent(props.before.sheet[key], sheet.value[key])
const route = useRoute()
const router = useRouter()
const pilotId = props.snapshot?.character.id ?? (route.params.id ? Number(route.params.id) : undefined)
const own = !props.snapshot && !pilotId
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
  change,
  draft,
  proposeChange,
  submitChange,
  reopenChange,
  withdrawChange,
  markDead,
} = useMyPilot(pilotId, props.snapshot)

// Your approved pilot: changes are proposed, then a GM approves them (src/myPilot.ts).
const approvedOwn = computed(() => own && character.value?.status === 'approved')
function confirmDeath() {
  const name = character.value!.callsign ?? character.value!.pilot_name
  if (window.confirm(`mark ${name} dead? this can't be undone. they move to the memorial, and you can register a new pilot.`))
    track(markDead())
}

function withdraw() {
  if (window.confirm('withdraw this change? everything in it is thrown away; your approved pilot stays as it is.')) track(withdrawChange())
}

// Records lead back to the queue, or to the list the pilot is in.
const back = computed(() =>
  reviewing
    ? { name: 'gm-pilots', label: 'gm: pilots' }
    : character.value?.status === 'pending'
      ? { name: 'pending', label: 'pending pilots' }
      : character.value?.status === 'dead'
        ? { name: 'memorial', label: 'memorial' }
        : { name: 'registry', label: 'pilot registry' },
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

// 0 to 6 for every stat. Mech skills (HASE) start at 0 and share 2 + level points; personal stats start at 1. shortcut: personal stats use HASE's range until their rules are decided.
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
const stats = computed(() => sheetStats(sheet.value, pilotStats.value, bionics.value))

// --- Level and manna (set by GMs), what manna buys, and the rule check (src/rules.ts; docs/lancer-rules.md) ---
const { frames, weapons, systems, integrated } = useMechData()
const balance = computed(() => gm.value.manna - mannaSpent(sheet.value))
// Rules text without its HTML (shown as plain text).
const plain = (html: string) => html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()

// Licences: one per licensed frame. Rank II unlocks the frame; each rank unlocks its gear of that level.
const licenceOptions = computed(() =>
  frames.value
    .filter((frame) => frame.licenceLevel > 0)
    .map((frame) => ({ id: frame.id, name: licenceName(frames.value, frame.id), meta: frame.mechtype.join('/').toLowerCase() })),
)
const licenceDetails = (_id: string, rank: number) => [
  `${rank >= 2 ? 'frame unlocked' : 'frame unlocks at rank II'}; gear up to rank ${rankName(rank)} is free to print.`,
]
const saveLicences = (licences: Record<string, number>) => track(updateSheet({ licences }))

// Talents: each rank's name and rules, up to the rank held.
const talentOptions = computed(() => talents.value.map((t) => ({ id: t.id, name: t.name, meta: t.terse })))
const talentDetails = (id: string, rank: number) =>
  (talents.value.find((t) => t.id === id)?.ranks ?? []).slice(0, rank).map((r, i) => `${rankName(i + 1)} ${r.name}: ${plain(r.description)}`)
const saveTalents = (talentRanks: Record<string, number>) => track(updateSheet({ talents: talentRanks }))

const saveCoreBonuses = (ids: string[]) => track(updateSheet({ core_bonuses: ids }))

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
        },
        Object.fromEntries(mechs.value.map((m) => [m.id, m.name])),
      )
    : [],
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
  <component :is="props.snapshot ? 'section' : 'main'" class="page manage" :class="{ preview: props.snapshot }">
    <nav v-if="!own && !props.snapshot" class="links">
      <RouterLink :to="{ name: back.name }">&lt; {{ back.label }}</RouterLink>
      <RouterLink v-if="isGm && !reviewing && character" :to="{ name: 'gm-review', params: { id: pilotId } }">
        {{ character.status === 'pending' ? 'gm review' : 'gm controls: level and manna' }}
      </RouterLink>
    </nav>

    <p v-if="loading" class="dim">loading pilot record...</p>
    <p v-else-if="loadError" class="rose" role="alert">{{ loadError }}</p>
    <p v-else-if="!character && !own" class="rose">no pilot record with that id.</p>

    <!-- No pilot yet: a name registers one, then the full sheet opens. -->
    <section v-else-if="!character" class="register">
      <h1 class="sheet-label">register a pilot</h1>
      <form class="register-form" @submit.prevent="register">
        <p>no pilot on file. a name is all that's needed to start; everything else is filled in on the sheet.</p>
        <label>
          <span class="dim">callsign</span>
          <input v-model="newPilot.callsign" type="text" />
        </label>
        <label>
          <span class="dim">name (required)</span>
          <input v-model="newPilot.name" type="text" required />
        </label>
        <p v-if="registerError" class="rose" role="alert">{{ registerError }}</p>
        <button type="submit">register pilot</button>
      </form>
    </section>

    <div v-else class="sheet">
      <!-- At a glance: callsign, name, player, status. -->
      <header class="glance">
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
          <h1 v-else class="callsign"><ReviewText v-if="props.before" :before="props.before.character.callsign ?? props.before.character.pilot_name" :after="character.callsign ?? character.pilot_name" /><template v-else>{{ character.callsign ?? character.pilot_name }}</template></h1>
          <input
            v-if="editable"
            class="inline name"
            type="text"
            aria-label="name"
            placeholder="name"
            :value="character.pilot_name"
            @change="saveText('pilot_name', $event)"
          />
          <p v-else class="name"><ReviewText v-if="props.before" :before="props.before.character.pilot_name" :after="character.pilot_name" /><template v-else>{{ character.pilot_name }}</template></p>
        </div>
        <div class="glance-side">
          <dl class="glance-facts">
            <div>
              <dt>player</dt>
              <dd>{{ playerName || '-' }}</dd>
            </div>
            <div>
              <dt>status</dt>
              <dd class="badge" :class="character.status">{{ character.status }}</dd>
            </div>
            <template v-if="canSeePrivate">
              <div>
                <dt>level</dt>
                <dd>{{ gm.level }}</dd>
              </div>
              <div :title="`${gm.manna} received, ${mannaSpent(sheet)} spent`">
                <dt>manna</dt>
                <dd :class="{ rose: balance < 0 }">{{ balance }}</dd>
              </div>
            </template>
          </dl>
          <p v-if="own" class="save-status" role="status">
            <span v-if="saveError" class="rose">not saved: {{ saveError }}</span>
            <span v-else class="dim">{{ status }}</span>
          </p>
        </div>
        <div v-if="own && reviewNote" class="gm-note" role="note">
          <p v-if="character.status === 'pending'" class="rose">sent back by a gm. change what they asked, then resubmit to rejoin the review queue.</p>
          <p v-else class="lilac">note from the gm</p>
          <p>{{ reviewNote }}</p>
          <button v-if="character.status === 'pending'" type="button" @click="track(resubmit())">resubmit for review</button>
        </div>

        <!-- Your approved pilot: propose a change, write it, submit it, wait for a GM. -->
        <div
          v-if="approvedOwn"
          class="change-note"
          :class="{ rejected: !draft && change?.status === 'rejected', plain: !draft && change?.status !== 'rejected' }"
          role="note"
        >
          <template v-if="!draft">
            <template v-if="change?.status === 'rejected'">
              <p class="rose">a gm rejected your last change.</p>
              <p>{{ change.review_reason }}</p>
            </template>
            <div class="actions">
              <button type="button" @click="track(proposeChange())">propose changes</button>
            </div>
          </template>
          <template v-else-if="!draft.submitted_at">
            <p>proposing changes. edit the sheet as normal, then submit it. your approved pilot stays as it is until a gm approves.</p>
            <div class="actions">
              <button type="button" @click="track(submitChange())">submit for review</button>
              <button type="button" @click="withdraw">withdraw</button>
            </div>
          </template>
          <template v-else>
            <p>change submitted, waiting on a gm. the sheet shows what you submitted.</p>
            <div class="actions">
              <button type="button" @click="track(reopenChange())">edit change</button>
              <button type="button" @click="withdraw">withdraw</button>
            </div>
          </template>
        </div>
        <RuleCheck v-if="canSeePrivate" class="full" :problems="problems" />
      </header>

      <!-- Right on wide screens; between the top strip and appearance on phones. -->
      <aside class="side">
        <Portrait :class="{ 'review-changed': props.before && props.before.character.pilot_image !== character.pilot_image }" :src="character.pilot_image" :alt="`Portrait of ${character.callsign ?? character.pilot_name}`" />
        <p v-if="own" class="dim small">image upload: module offline</p>
        <table class="identity">
          <tbody>
            <tr v-for="[column, label] in IDENTITY" :key="column">
              <th scope="row">{{ label }}</th>
              <td>
                <input
                  v-if="editable"
                  class="inline"
                  type="text"
                  :aria-label="label"
                  :value="character[column] ?? ''"
                  @change="saveText(column, $event)"
                />
                <ReviewText v-else-if="props.before" :before="props.before.character[column]" :after="character[column]" />
                <template v-else>{{ character[column] ?? '-' }}</template>
              </td>
            </tr>
          </tbody>
        </table>
      </aside>

      <div class="writing">
        <SheetField :comparison="props.before ? { doc: props.before.character.appearance } : undefined" title="appearance" :doc="character.appearance" :editable="editable" :save="saveColumn('appearance')" />
        <SheetField :comparison="props.before ? { doc: props.before.character.personality } : undefined" title="personality" :doc="character.personality" :editable="editable" :save="saveColumn('personality')" />
        <SheetField
          v-if="canSeePrivate"
          title="backstory"
          :comparison="props.before ? { doc: props.before.sheet.backstory } : undefined"
          tag="private"
          :doc="sheet.backstory ?? null"
          :editable="editable"
          :save="saveBackstory"
        />
      </div>

      <div class="wide">
        <template v-if="canSeePrivate">
          <StatRow
            title="personal stats"
            :class="{ 'review-changed': sectionChanged('pilot_stats') || sectionChanged('bionics') }"
            tag="private"
            :stats="stats.personal"
            :editable="editable"
            :min="STAT_MIN"
            :max="STAT_MAX"
            @set="(id, value) => setStat('pilot_stats', stats.personal, id, value)"
          />
          <StatRow
            title="piloting stats"
            :class="{ 'review-changed': sectionChanged('mech_skills') }"
            tag="private"
            :stats="stats.piloting"
            :editable="editable"
            :min="STAT_MIN"
            :max="STAT_MAX"
            :budget="{ label: 'hase points', total: skillPoints(gm.level) }"
            @set="(id, value) => setStat('mech_skills', stats.piloting, id, value)"
          />
          <LoadoutBox
            title="bionics"
            :class="{ 'review-changed': sectionChanged('bionics') }"
            tag="private"
            :items="bionicItems(bionics, PRICES.bionic)"
            :chosen="sheet.bionics ?? []"
            :editable="editable"
            :limit="{ label: 'mod limit', unit: 'mod points', max: modLimit(gm.level) }"
            :add-blocked="balance < PRICES.bionic ? 'not enough manna' : ''"
            :save="saveBionics"
          />
          <PilotLoadout :class="{ 'review-changed': sectionChanged('pilot_gear') }" :items="gear" :chosen="sheet.pilot_gear ?? []" :editable="editable" :save="saveGear" />
        </template>

        <section class="hangar" :class="{ 'review-changed': props.before && !sameContent(props.before.character.mechs, character.mechs) }">
          <header class="hangar-head">
            <h2 class="sheet-label">mech hangar</h2>
            <button v-if="editable && mechs.length && !addingMech" type="button" @click="openNewMech">new mech</button>
          </header>
          <div class="hangar-body">
            <ul v-if="mechs.length" class="mechs">
              <li v-for="mech in mechs" :key="mech.id">
                <component :is="props.snapshot ? 'a' : RouterLink" :to="props.snapshot ? undefined : mechLink(mech.id)" :href="props.snapshot ? `#${props.mechAnchorPrefix ?? 'review-mech'}-${mech.id}` : undefined" class="mech-card">
                  <Portrait :src="mech.image" :alt="`Image of ${mech.name}`" />
                  <span class="mech-name">{{ mech.name }}</span>
                  <span class="dim">{{ mech.manufacturer_id }}</span>
                </component>
              </li>
            </ul>

            <form v-if="addingMech" class="new-mech" @submit.prevent="createMech">
              <label>
                <span class="dim">mech name (required)</span>
                <input v-model="newMech.name" type="text" required />
              </label>
              <label>
                <span class="dim">manufacturer id (XXXX-XXXX-XXXX)</span>
                <input v-model="newMech.manufacturerId" type="text" required />
              </label>
              <p v-if="mechError" class="rose" role="alert">{{ mechError }}</p>
              <div class="actions">
                <button type="submit">create mech</button>
                <button type="button" @click="addingMech = false">cancel</button>
              </div>
            </form>
            <AddBox v-else-if="editable && !mechs.length" label="new mech" class="add-mech" @click="openNewMech" />
            <p v-else-if="!mechs.length" class="dim">no mechs on file.</p>
          </div>
        </section>

        <template v-if="canSeePrivate">
          <RankPanel
            title="licences"
            :class="{ 'review-changed': sectionChanged('licences') }"
            noun="licence"
            :options="licenceOptions"
            :held="sheet.licences ?? {}"
            :details="licenceDetails"
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
            :class="{ 'review-changed': sectionChanged('core_bonuses') }"
            :options="coreBonuses"
            :taken="sheet.core_bonuses ?? []"
            :picks="coreBonusPicks(sheet)"
            :editable="editable"
            :save="saveCoreBonuses"
          />
          <RankPanel
            title="talents"
            :class="{ 'review-changed': sectionChanged('talents') }"
            noun="talent"
            :options="talentOptions"
            :held="sheet.talents ?? {}"
            :details="talentDetails"
            :price="PRICES.talentRank"
            :balance="balance"
            :editable="editable"
            :save="saveTalents"
          />
        </template>

        <!-- Your approved pilot can die without a GM's approval, after an "are you sure?". -->
        <section v-if="approvedOwn" class="death">
          <h2 class="sheet-label">death</h2>
          <div class="death-body">
            <p class="dim">if your pilot dies in the story, mark them dead. this can't be undone.</p>
            <button type="button" @click="confirmDeath">mark pilot dead</button>
          </div>
        </section>

        <!-- :key resets the decision box after a decision, so it shows the new status. -->
        <GmReview v-if="reviewing && isGm" :key="character.status" :pilot="character" :problems="problems" @reviewed="load" />
      </div>
    </div>
  </component>
</template>

<style scoped>
/* Full width: the sheet uses the whole content area, not a centred column. */
.preview {
  padding: 0;
}

.manage {
  max-width: none;
}

/* On a record: back to the list, and (for GMs, on a pending pilot) on to the review. */
.links {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.5rem 1.5rem;
  margin-bottom: 1rem;
}

.links a {
  color: var(--text-dim);
  font-size: 0.875rem;
  text-decoration: none;
}

.links a:hover {
  color: var(--lilac);
}

.small {
  font-size: 0.75rem;
}

/* --- Layout: top strip across, writing left, portrait right, then full-width sections --- */
.sheet {
  display: grid;
  grid-template-areas:
    'glance glance'
    'writing side'
    'wide wide';
  grid-template-columns: minmax(0, 1fr) clamp(16rem, 24vw, 22rem);
  gap: 1.5rem 2rem;
  align-items: start;
}

.glance {
  grid-area: glance;
}

.gm-note,
.full {
  flex-basis: 100%;
}

/* Your approved pilot's change: lilac while you write or wait, rose once rejected. */
.change-note {
  flex-basis: 100%;
  padding: 0.6rem 0.9rem;
  border-left: 3px solid var(--lilac);
  background: var(--panel);
  font-size: 0.875rem;
  text-align: left;
}

.change-note.rejected {
  border-left-color: var(--rose);
}

/* Nothing to say yet: just the button. */
.change-note.plain {
  padding: 0;
  border: 0;
  background: none;
}

.change-note.plain .actions {
  margin-top: 0;
}

.change-note p {
  margin: 0;
  white-space: pre-wrap;
}

.change-note .actions {
  margin-top: 0.5rem;
}

.change-note button {
  padding-inline: 0;
  font-size: 0.8125rem;
}

.gm-note {
  padding: 0.6rem 0.9rem;
  border-left: 3px solid var(--rose);
  background: var(--panel);
  font-size: 0.875rem;
  text-align: left;
}

.gm-note p {
  margin: 0;
  white-space: pre-wrap;
}

.gm-note button {
  margin-top: 0.5rem;
  padding-inline: 0;
  font-size: 0.8125rem;
}

.writing {
  grid-area: writing;
}

.side {
  grid-area: side;
}

.wide {
  grid-area: wide;
}

.writing,
.wide {
  display: flex;
  flex-direction: column;
  gap: 1.75rem;
}

/* --- One-line fields: plain text until you point at them --- */
.inline {
  padding: 0.15rem 0.35rem;
  border-color: transparent;
}

.inline:hover {
  border-color: var(--rule);
}

/* --- Top strip --- */
.glance {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem 2.5rem;
  padding-bottom: 1.25rem;
  border-bottom: 1px solid var(--rule);
}

.names {
  display: flex;
  flex: 1 1 22rem;
  flex-direction: column;
  min-width: 0;
}

.callsign {
  margin: 0;
  color: var(--lilac);
  font: 700 2.5rem/1.1 var(--mono);
}

.name {
  margin: 0;
  color: var(--text-dim);
  font-size: 1.125rem;
}

input.callsign,
input.name {
  margin-left: -0.35rem;
}

/* Player and status (or pilot and frame) on the right, centred against the callsign and name. The save
   status hangs just below without taking up room, so it doesn't pull them off centre. */
.glance-side {
  position: relative;
}

.glance-facts {
  display: flex;
  gap: 2.5rem;
  margin: 0;
}

.glance-facts dt {
  color: var(--text-dim);
  font-size: 0.8125rem;
}

.glance-facts dd {
  margin: 0;
  font-size: 1.125rem;
}

/* The status as a small outlined badge: rose while pending, sky once approved. */
.badge {
  width: fit-content;
  padding: 0 0.4rem;
  border: 1px solid currentColor;
}

.badge.pending {
  color: var(--rose);
}

.badge.approved {
  color: var(--sky);
}

.badge.dead {
  color: var(--text-dim);
}

.death-body {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 1.5rem;
  padding: 0.75rem;
  border: 1px solid var(--rule);
}

.death-body p {
  margin: 0;
}

.death-body button {
  padding-inline: 0;
  color: var(--rose);
}

.save-status {
  position: absolute;
  top: calc(100% + 0.2rem);
  right: 0;
  margin: 0;
  font-size: 0.8125rem;
  white-space: nowrap;
}

/* --- Portrait and identity table --- */
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
  padding: 0.2rem 0;
  border-bottom: 1px solid var(--rule);
  text-align: left;
  vertical-align: middle;
}

.identity th {
  width: 6.5rem;
  color: var(--text-dim);
  font-size: 0.8125rem;
  font-weight: 400;
}

/* --- Registering --- */
.register {
  max-width: 32rem;
}

.register-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid var(--rule);
}

.register-form p {
  margin: 0;
}

.register-form label,
.new-mech label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.8125rem;
}

.register-form button {
  align-self: flex-start;
  padding-inline: 0;
}

/* --- Hangar: mechs centred, so a single mech sits in the middle --- */
.hangar-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.hangar-head button {
  padding: 0;
  font-size: 0.8125rem;
}

.hangar-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
  border: 1px solid var(--rule);
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
  width: 11rem;
  padding: 0.6rem;
  border: 1px solid var(--rule);
  color: var(--text);
  font-size: 0.75rem;
  text-decoration: none;
}

.mech-card:hover,
.mech-card:focus-visible {
  border-color: var(--lilac);
}

.mech-name {
  margin-top: 0.35rem;
  color: var(--lilac);
  font-size: 0.9375rem;
  font-weight: 600;
}

.add-mech {
  max-width: 16rem;
}

.new-mech {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: min(100%, 24rem);
}

.new-mech p,
.hangar-body > p {
  margin: 0;
}

.actions {
  display: flex;
  gap: 1rem;
}

.actions button {
  padding-inline: 0;
  font-size: 0.875rem;
}

/* --- Narrow screens: one column, with the portrait between the top strip and appearance --- */
@media (max-width: 56rem) {
  .glance-side {
    max-width: 100%;
  }

  .glance-facts {
    flex-wrap: wrap;
    justify-content: center;
    gap: 1rem 1.5rem;
  }

  .sheet {
    grid-template-areas: 'glance' 'side' 'writing' 'wide';
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

  .callsign {
    font-size: 1.875rem;
  }

  /* The top strip, centred. */
  .glance {
    flex-direction: column;
    align-items: center;
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

  .glance-facts dd {
    margin-inline: auto;
  }

  .save-status {
    position: static;
    min-height: 1.25rem;
    margin-top: 0.35rem;
    text-align: center;
    white-space: normal;
  }
}
</style>
