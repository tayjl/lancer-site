<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import gritIcon from '../assets/icons/skill.svg'
import { catalogueError } from '../catalogue'
import CatalogueNotice from '../components/CatalogueNotice.vue'
import CombatGroup from '../components/CombatGroup.vue'
import CombatStrip from '../components/CombatStrip.vue'
import CombatTurn from '../components/CombatTurn.vue'
import FileSection from '../components/FileSection.vue'
import Icon from '../components/Icon.vue'
import PageHeader from '../components/PageHeader.vue'
import ChoiceField from '../components/editor/ChoiceField.vue'
import { searchWords } from '../archive'
import { actionEntry, actionKey, firstSentence, plainEntry, rowEntry, stepActions, type CombatEntry, type KitAction } from '../combatEntries'
import { combatLoadout, type LoadoutBlock, type LoadoutRow } from '../combatLoadout'
import {
  ATTACK_EXTRAS, ON_FOOT_ROWS, AREAS, ATTACK_FORMULAS, ATTACK_RESULTS, AURAS, AURAS_NOTE, CHECK_FORMULAS, CHECK_RESULTS, CONVERSIONS_NOTE, COVER_NOTE, DAMAGE_FORMULAS, DAMAGE_TYPES,
  DEFENCES, DICE, DICE_NOTE, DRONES_NOTE, FOOT_RULES, KNOCKBACK, KNOCKBACK_NOTE, MOVEMENT_NOTE,
  PILOT_CHECKS_NOTE, PILOT_DCS, PUSHING_THROUGH, RANGE_BONUSES, RANGE_TALENTS, RANGE_TIERS, RECHARGE, REPAIRS,
  RESULTS_NOTE, SCENE_RESOURCES, SENSORS, SENSORS_NOTE, SIZE_NOTE, SPEED_GATEWAYS, STATUS_GROUPS, STRUCTURE_NOTE, STRUCTURE_STRESS, STRUCTURE_TRIGGERS, TAGS, TERRAIN, TURN_STEPS, WEAPON_SIZES,
} from '../combatRules'
import { pilotVitals, tagNames, useGameData } from '../gameData'
import { itemInfo, type Info } from '../info'
import { activationOf } from '../itemDetails'
import { useMyPilot } from '../myPilot'
import type { PublicMech } from '../pilots'
import { useCatalogue } from '../rules'
import { plainText } from '../rulesText'

// The combat guide: what you can do on your turn, read-only. The text is in src/combatRules.ts. A summary of your mech
// (CombatTurn.vue), then the turn strip (CombatStrip.vue: one step open, its actions as chips that open the full text),
// then three folding sections of cards (CombatGroup.vue): your kit, tags and statuses, and the rules. Rules open in place,
// your own kit opens its full information (src/combatLoadout.ts, the same as the mech page). A Mech / Pilot switch
// (?mode=pilot) trims everything to what you can do in your mech or on foot. One search box looks through the current mode's
// rows: the strip gives way to the matching actions and every section with a match opens.
const route = useRoute()
const router = useRouter()
// The last track step is "Blow up. The mech is wrecked.": its first sentence is shown bold.
const lead = (text: string) => text.split('. ')[0] + '.'
const rest = (text: string) => text.slice(lead(text).length).trim()

// Your living pilot as a GM approved it: what's in play, not a change still in draft.
const { character, sheet, approved, loading, loadError, load, gm } = useMyPilot()
const catalogue = useCatalogue()
const live = computed(() => approved.value ?? { character: character.value, sheet: sheet.value })
const mechList = computed(() => (Array.isArray(live.value.character?.mechs) ? live.value.character.mechs : []) as unknown as PublicMech[])
// A stale or made-up ?mech falls back to the first mech.
const mech = computed(() => mechList.value.find((m) => m.id === route.query.mech) ?? mechList.value[0])
const chooseMech = (id: string) => router.replace({ query: { ...route.query, mech: id === mechList.value[0].id ? undefined : id }, hash: route.hash })
const loadout = computed(() =>
  live.value.character && catalogue.value.frames.length
    ? combatLoadout((mech.value && live.value.sheet.mechs?.[mech.value.id]) || {}, live.value.sheet, catalogue.value, tagNames.value)
    : null,
)
const frame = computed(() => loadout.value?.frame ?? null)
// The mech's key numbers for the summary, with the pilot's Grit. None without a frame.
const vitals = computed(() => {
  const l = loadout.value
  if (!l?.frame) return []
  const stats = ['hp', 'heat', 'armour', 'evasion', 'speed', 'edef', 'tech_attack'].map((id) => l.stats.find((stat) => stat.id === id)!)
  return [...stats, { id: 'grit', name: 'Grit', icon: gritIcon, value: Math.ceil(gm.value.level / 2) }]
})
// The pilot's own key numbers, for Pilot mode.
const { gear, talents, coreBonuses, bionics } = useGameData()
const pilotStats = computed(() => [
  ...pilotVitals(live.value.sheet, gear.value, talents.value, coreBonuses.value, bionics.value),
  { id: 'grit', name: 'Grit', icon: gritIcon, value: Math.ceil(gm.value.level / 2) },
])
const overcharge = computed(() => (loadout.value?.frame ? loadout.value.overcharge : null))

// Mech or Pilot: ?mode=pilot, left out for Mech.
const mode = computed<'mech' | 'pilot'>(() => (route.query.mode === 'pilot' ? 'pilot' : 'mech'))
const modeChoice = computed<'mech' | 'pilot'>({
  get: () => mode.value,
  set: (value) => router.replace({ query: { ...route.query, mode: value === 'pilot' ? 'pilot' : undefined }, hash: route.hash }),
})

// Search: every word must appear somewhere in a row. A matching card title or note keeps the whole card; otherwise only
// the matching rows.
const query = ref('')
const searchBox = useTemplateRef<HTMLInputElement>('searchBox')
const words = computed(() => searchWords(query.value))
const searching = computed(() => words.value.length > 0)
const flat = (value: unknown): string[] => (Array.isArray(value) ? value.flatMap(flat) : value && typeof value === 'object' ? Object.values(value).flatMap(flat) : typeof value === 'string' || typeof value === 'number' ? [String(value)] : [])
const hit = (...parts: unknown[]) => {
  const text = plainText(flat(parts).join(' ')).toLowerCase()
  return words.value.every((word) => text.includes(word))
}
const shownText = (e: CombatEntry) => [e.name, e.value, e.label, e.gist, e.tag, e.tags, e.frequency, e.heat]

// Trimming: with a mech and its frame loaded, only the weapon sizes and tags on your gear. "Show all tags" lifts it,
// and so does searching.
const showAll = ref(false)
const canTrim = computed(() => !!loadout.value?.frame)
const trimmed = computed(() => canTrim.value && !showAll.value && !searching.value)

// A card: its rows, and "data" for the body the template draws (formulas, tables), each datum tagged with its kind "k".
type Datum = { k: string } & Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
type Group = { title: string; icon: string; colour?: string; meta?: string; note?: string; entries?: CombatEntry[]; mine?: CombatEntry[]; data?: Datum[]; groupActivation?: string; chips?: boolean; gist?: boolean }
const data = (k: string, rows: object[]): Datum[] => rows.map((row) => ({ k, ...row }))
const size = (g: Group) => (g.entries?.length ?? 0) + (g.mine?.length ?? 0) + (g.data?.length ?? 0)
const ofKind = (g: Group, k: string) => g.data?.filter((d) => d.k === k) ?? []

// Rows that matched only in their hidden text start open, so you see why.
const find = (g: Group, whole: boolean, on: boolean): Group | null => {
  if (!on || whole || hit(g.title, g.note)) return size(g) ? g : null
  const keep = (list?: CombatEntry[]) => list?.filter((e) => hit(shownText(e), e.text)).map((e) => ({ ...e, open: !!e.text && !hit(shownText(e)) }))
  const found = { ...g, entries: keep(g.entries), mine: keep(g.mine), data: g.data?.filter((d) => hit(d)) }
  return size(found) ? found : null
}

type Column = Group[]
const kitBlocks: { key: LoadoutBlock; title: string; icon: string; colour: string }[] = [
  { key: 'weapons', title: 'Weapons', icon: 'weapon', colour: '--type-weapon' },
  { key: 'systems', title: 'Systems', icon: 'system', colour: '--type-system' },
  { key: 'gear', title: 'Pilot gear', icon: 'pilot', colour: '--type-pilot' },
  { key: 'frame', title: 'Frame', icon: 'frame', colour: '--type-frame' },
  { key: 'talents', title: 'Talents', icon: 'talent', colour: '--type-talent' },
  { key: 'core-bonuses', title: 'Core bonuses', icon: 'corebonus', colour: '--type-core' },
]
// A kit row opens the item's full information; a trait, talent or core bonus has no item, so its text is the card.
const kitInfo = (row: LoadoutRow): Info =>
  row.item
    ? itemInfo(row.item)
    : { kind: row.label ?? '', name: row.name, facts: [], stats: [], groups: [{ cards: [{ heading: '', html: row.html, activation: row.activation }] }] }
const kitEntries = (block: LoadoutBlock): CombatEntry[] =>
  (loadout.value?.rows ?? []).filter((row) => row.block === block).flatMap((row) => [
    { label: row.label, name: row.name, activation: row.activation, stats: row.stats, tags: row.tags, gist: firstSentence(row.html) || undefined, info: () => kitInfo(row) },
    ...row.mods.map((m) => ({ label: 'Mod', name: m.name, tags: m.tags, gist: firstSentence(m.html) || undefined, mod: true, info: () => itemInfo(m.item) })),
  ])
// Your kit's own actions (a system's, a trait's, a core power's), for the turn strip.
const kitActions = computed<KitAction[]>(() =>
  (loadout.value?.rows ?? []).flatMap((row) => [
    ...(activationOf(row.activation) ? [{ label: row.label, name: row.name, activation: row.activation, text: row.html }] : []),
    ...row.rules.filter((rule) => activationOf(rule.activation)).map((rule) => ({ label: row.name, name: rule.name, activation: rule.activation, frequency: rule.frequency, stats: rule.stats, text: rule.text })),
  ].map((entry) => ({ ...entry, block: row.block }))).map((entry) => ({ ...entry, key: actionKey(entry.activation), gist: firstSentence(entry.text) || undefined })),
)
// Everest: "Lodestar: 1 Repair restores 1 Structure."
const repairLine = computed(() => {
  const n = loadout.value?.structureRepairs
  return loadout.value?.frame && mech.value ? [plainEntry(`${mech.value.name}: ${n} ${n === 1 ? 'Repair restores' : 'Repairs restore'} 1 Structure.`)] : []
})

// The three sections. "on" applies the search; "trim" cuts the tags to your gear. A block is a heading and its columns of cards.
type Block = { title?: string; columns: Column[]; tags?: boolean }
type Content = { id: string; no: string; title: string; folded?: boolean; blocks: Block[]; count: number }
function build(on: boolean, trim: boolean, pilot = mode.value === 'pilot'): Content[] {
  const l = loadout.value
  const sizes = trim ? WEAPON_SIZES.filter((row) => l!.sizes.has(row.value)) : WEAPON_SIZES
  const tags = trim ? TAGS.filter((row) => row.tags?.some((id) => l!.tagIds.has(id))) : TAGS
  const block = (b: (typeof kitBlocks)[number]): Group => ({ title: b.title, icon: b.icon, colour: b.colour, chips: true, entries: kitEntries(b.key), meta: b.key === 'frame' && l?.frame ? `${l.frame.source} ${l.frame.name}` : undefined })
  const [weapons, systems, gear, frameCard, talents, core] = kitBlocks.map(block)
  const [cover, conditions, other] = STATUS_GROUPS.map((g): Group => ({ title: g.title, icon: g.icon, entries: g.rows.map((row) => rowEntry(row)) }))
  const rows = (list: Parameters<typeof rowEntry>[0][], options?: Parameters<typeof rowEntry>[1]) => list.map((row) => rowEntry(row, options))
  const plain = (list: Parameters<typeof rowEntry>[0][]) => list.map((row) => plainEntry(row.text, row.value))

  // Mech mode: with the first column, which is shorter; on foot there is no dice card, so with the second.
  const attackTerms: Group = { title: 'Attack terms', icon: 'book-open', entries: rows(pilot ? [...ATTACK_EXTRAS, ...FOOT_RULES.filter((row) => ['Pilot attacks', 'Attacks on a pilot'].includes(row.value))] : ATTACK_EXTRAS) }
  const content: [string, string, string, boolean, Block[]][] = [
    ['combat-kit', '01', 'Your kit', false, [{ columns: pilot ? [[gear], [talents]] : [[weapons, systems, gear], [frameCard, talents, core]] }]],
    ['combat-tags', '02', 'Tags and statuses', false, [{ tags: true, columns: pilot ? [[cover, conditions], [other, { title: 'On foot', icon: 'pilot', entries: rows(ON_FOOT_ROWS) }]] : [[
      { title: trim ? 'Tags on your gear' : 'Tags', icon: 'generic_item', chips: true, entries: tags.map((row) => ({ tag: row.value, gist: row.gist ?? firstSentence(row.text), text: row.text })) },
      { title: trim ? 'Weapon sizes on your gear' : 'Weapon sizes', icon: 'weapon', entries: rows(sizes) },
    ], [cover, conditions, other]] }]],
    ['combat-rules', '03', 'Rules', true, [
      { title: 'Checks and resources', columns: [[
        { title: 'Checks and saves', icon: 'systems', data: [...data('f', CHECK_FORMULAS), ...data('chk', CHECK_RESULTS)] },
      ], [
        { title: "Lancer's Edge and Precision", icon: 'star', gist: true, note: 'They reset every combat or scene.', entries: SCENE_RESOURCES.map(actionEntry) },
        { title: 'Pushing through', icon: 'star', entries: [plainEntry(PUSHING_THROUGH)] },
        ...(pilot ? [{ title: 'Pilot checks', icon: 'pilot', note: PILOT_CHECKS_NOTE, data: data('dc', PILOT_DCS) }] : []),
      ]] },
      { title: 'Attacks and damage', columns: [[
        { title: 'Attack totals', icon: 'crosshair', data: data('f', ATTACK_FORMULAS) },
        { title: 'Results', icon: 'approved', note: RESULTS_NOTE, data: data('m', ATTACK_RESULTS) },
        ...(pilot ? [] : [attackTerms]),
      ], [
        { title: 'Damage', icon: 'explosive', data: [...data('type', DAMAGE_TYPES), ...data('f', DAMAGE_FORMULAS)] },
        ...(pilot ? [] : [
          { title: 'Dice conversions', icon: 'list', note: `${CONVERSIONS_NOTE} ${DICE_NOTE}`, data: [...data('dice', DICE), ...data('recharge', RECHARGE)] },
          { title: 'Defence baselines', icon: 'evasion', data: data('def', DEFENCES) },
        ]),
        ...(pilot ? [attackTerms] : []),
      ]] },
      { title: 'Movement and range', columns: [[
        { title: 'Speed', icon: 'speed', note: MOVEMENT_NOTE, entries: rows(SPEED_GATEWAYS, { column: true }) },
        { title: 'Terrain', icon: 'map-pin', entries: rows(TERRAIN) },
        { title: 'Knockback', icon: 'arrow-left', note: KNOCKBACK_NOTE, entries: plain(KNOCKBACK) },
        { title: 'Areas', icon: 'blast', entries: rows(AREAS) },
        { title: 'Range in talents', icon: 'talent', entries: plain(RANGE_TALENTS) },
        { title: 'Cover', icon: 'shield', entries: [plainEntry(COVER_NOTE)] },
      ], [
        { title: 'Range', icon: 'range', entries: rows(RANGE_TIERS, { column: true, gist: false }) },
        { title: 'Sensors', icon: 'perception', note: SENSORS_NOTE, entries: rows(SENSORS, { column: true, gist: false }) },
        { title: 'Auras', icon: 'info', note: AURAS_NOTE, entries: plain(AURAS) },
        { title: 'Range and Threat bonuses', icon: 'crosshair', entries: plain(RANGE_BONUSES) },
      ]] },
      ...(pilot ? [] : [{ title: 'Structure and repairs', columns: [[
        { title: 'Structure and stress', icon: 'structure', data: [...data('tr', STRUCTURE_TRIGGERS), ...data('track', STRUCTURE_STRESS), { k: 'note', text: STRUCTURE_NOTE }] },
      ], [
        { title: 'Rest and Full Repair', icon: 'repair', entries: [...rows(REPAIRS), ...repairLine.value] },
        { title: 'Pilots and drones', icon: 'pilot', entries: [...rows(FOOT_RULES), plainEntry(DRONES_NOTE), plainEntry(SIZE_NOTE)] },
      ]] }]),
    ]],
  ]
  return content.map(([id, no, title, folded, blocks]) => {
    const sift = (cols: Column[]) => cols.map((col) => col.map((g) => find(g, false, on)).filter((g): g is Group => !!g)).filter((col) => col.length)
    const found = blocks.map((b) => ({ ...b, columns: sift(b.columns) })).filter((b) => b.columns.length)
    return { id, no, title, folded, blocks: found, count: found.reduce((n, b) => n + b.columns.flat().reduce((m, g) => m + size(g), 0), 0) }
  })
}

// The turn's actions as one card, for search (the strip hides then). Each action once, however many steps it is in.
const actionsCard = (on: boolean) => {
  const seen = new Set<string>()
  const entries = TURN_STEPS.flatMap((s) => stepActions(s.name, kitActions.value, mode.value === 'pilot', overcharge.value))
    .flatMap((g) => g.entries)
    .filter((e) => !seen.has(`${e.name}|${e.activation}`) && seen.add(`${e.name}|${e.activation}`))
  return find({ title: 'Actions', icon: 'list', chips: true, entries }, false, on)
}
const sections = computed(() => build(searching.value, trimmed.value))
const actions = computed(() => (searching.value ? actionsCard(true) : null))
// Every row, to count the search's matches against.
const total = computed(() => build(false, false).reduce((n, s) => n + s.count, 0) + size(actionsCard(false) ?? { title: '', icon: '' }))
const matches = computed(() => sections.value.reduce((n, s) => n + s.count, 0) + (actions.value ? size(actions.value) : 0))
// The strip's Speed: the mech's, or the pilot's on foot.
const speed = computed(() => (mode.value === 'pilot' ? pilotStats.value : vitals.value).find((v) => v.id === 'speed' || v.id === 'pilot_speed')?.value ?? null)

const clear = () => {
  query.value = ''
  searchBox.value?.focus()
}
</script>

<template>
  <main class="page">
    <PageHeader title="Combat" summary="What you can do on your turn, and the rules to look up." />
    <CatalogueNotice />
    <div class="combat">
      <div class="tools">
        <div class="mode">
          <span class="label">Viewing as</span>
          <ChoiceField v-model="modeChoice" label="Viewing as" :options="[{ value: 'mech', label: 'Mech' }, { value: 'pilot', label: 'Pilot' }]" />
        </div>
        <div class="search">
          <label class="field">
            <span>Search</span>
            <input ref="searchBox" v-model="query" type="search" placeholder="Action, status or tag" @keydown.esc="query = ''" />
          </label>
          <button v-if="query" type="button" class="small" @click="clear">Clear</button>
        </div>
        <p v-if="searching" class="dim count" role="status"><span class="num">{{ matches }}</span> of <span class="num">{{ total }}</span></p>
      </div>

      <CombatTurn
        :loading="loading"
        :mode="mode"
        :pilot-name="live.character?.pilot_name"
        :load-error="loadError"
        :has-pilot="!!live.character"
        :mech-list="mechList"
        :mech="mech"
        :ready="!!loadout || !!catalogueError"
        :frame="frame"
        :frames="catalogue.frames"
        :vitals="mode === 'pilot' ? pilotStats : vitals"
        @choose-mech="chooseMech"
        @retry="load()"
      />

      <p v-if="searching && !matches" class="empty">Nothing matches that search.</p>
      <template v-else>
        <CombatStrip v-if="!searching" :kit-actions="kitActions" :pilot="mode === 'pilot'" :overcharge="overcharge" :speed="speed" />
        <div v-else-if="actions" class="columns">
          <div class="column"><CombatGroup v-bind="actions" /></div>
        </div>
        <template v-for="s in sections" :key="s.id">
          <FileSection v-if="!searching || s.count" :id="s.id" :no="s.no" :title="s.title" :folded="s.folded" :show="searching">
            <p v-if="!searching && mode === 'pilot' && s.id === 'combat-kit' && !s.blocks.length" class="empty">No pilot gear or talents yet.</p>
            <label v-if="s.id === 'combat-tags' && canTrim && mode === 'mech' && !searching" class="show-all"><input v-model="showAll" type="checkbox" /> Show all tags</label>
            <div v-for="b in s.blocks" :key="b.title ?? ''" class="block">
              <div v-if="b.title" class="sheet-head">
                <h3 class="sheet-label">{{ b.title }}</h3>
              </div>
              <div class="columns">
                <div v-for="(column, c) in b.columns" :key="c" class="column">
                  <CombatGroup
                    v-for="g in column"
                    :key="g.title"
                    :title="g.title"
                    :icon="g.icon"
                    :colour="g.colour"
                    :meta="g.meta"
                    :note="g.note"
                    :entries="g.entries"
                    :mine="g.mine"
                    :group-activation="g.groupActivation"
                    :chips="g.chips"
                    :gist="g.gist"
                  >
                  <ul v-if="ofKind(g, 'type').length" class="damage-types">
                    <li v-for="d in ofKind(g, 'type')" :key="d.name" class="damage-type" :style="{ '--c': `var(--dmg-${d.icon})` }"><Icon :name="d.icon" />{{ d.name }}</li>
                  </ul>
                  <ul v-if="ofKind(g, 'f').length" class="rows-plain">
                    <li v-for="f in ofKind(g, 'f')" :key="f.formula">
                      <p class="formula-line">{{ f.formula }}</p>
                      <p v-if="f.note">{{ f.note }}</p>
                      <p class="example"><span class="label">Example</span>{{ f.example }}</p>
                    </li>
                  </ul>
                  <ul v-if="ofKind(g, 'm').length" class="rows-plain">
                    <li v-for="row in ofKind(g, 'm')" :key="row.margin">
                      <p class="result-margin">{{ row.margin }}<span v-if="row.note" class="dim result-note">{{ row.note }}</span></p>
                      <p class="result-line"><span class="label">Attack</span><span><b>{{ row.physical[0] }}</b> {{ row.physical[1] }}</span></p>
                      <p class="result-line"><span class="label">Tech attack</span><span><b>{{ row.tech[0] }}</b> {{ row.tech[1] }}</span></p>
                    </li>
                  </ul>
                  <table v-if="ofKind(g, 'dice').length" class="table">
                    <thead>
                      <tr><th scope="col">Dice</th><th scope="col">Becomes</th></tr>
                    </thead>
                    <tbody>
                      <tr v-for="row in ofKind(g, 'dice')" :key="row.value"><th scope="row">{{ row.value }}</th><td>{{ row.text }}</td></tr>
                    </tbody>
                  </table>
                  <table v-if="ofKind(g, 'recharge').length" class="table">
                    <thead>
                      <tr><th scope="col">Written as</th><th scope="col">Becomes</th></tr>
                    </thead>
                    <tbody>
                      <tr v-for="row in ofKind(g, 'recharge')" :key="row.value"><th scope="row">{{ row.value }}</th><td>{{ row.text }}</td></tr>
                    </tbody>
                  </table>
                  <table v-if="ofKind(g, 'def').length" class="table">
                    <thead>
                      <tr><th scope="col">Mech</th><th scope="col">Evasion</th><th scope="col">E-defence</th></tr>
                    </thead>
                    <tbody>
                      <tr v-for="row in ofKind(g, 'def')" :key="row.mech"><th scope="row">{{ row.mech }}</th><td class="num">{{ row.evasion }}</td><td class="num">{{ row.edef }}</td></tr>
                    </tbody>
                  </table>
                  <table v-if="ofKind(g, 'chk').length" class="table">
                    <thead>
                      <tr><th scope="col">Your total</th><th scope="col">Result</th></tr>
                    </thead>
                    <tbody>
                      <tr v-for="row in ofKind(g, 'chk')" :key="row.value"><th scope="row">{{ row.value }}</th><td>{{ row.text }}</td></tr>
                    </tbody>
                  </table>
                  <table v-if="ofKind(g, 'dc').length" class="table">
                    <thead>
                      <tr><th scope="col">DC</th><th scope="col">Task</th></tr>
                    </thead>
                    <tbody>
                      <tr v-for="row in ofKind(g, 'dc')" :key="row.value"><th scope="row" class="num">{{ row.value }}</th><td>{{ row.text }}</td></tr>
                    </tbody>
                  </table>
                  <ul v-if="ofKind(g, 'tr').length" class="rows-plain">
                    <li v-for="row in ofKind(g, 'tr')" :key="row.name" class="trigger"><Icon :name="row.icon" class="dim" /><span><b>{{ row.name }}</b> {{ row.text }}</span></li>
                  </ul>
                  <table v-if="ofKind(g, 'track').length" class="table track">
                    <thead>
                      <tr>
                        <th scope="col">Damage</th>
                        <th scope="col"><Icon name="structure" /> Structure</th>
                        <th scope="col"><Icon name="reactor" /> Stress</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="row in ofKind(g, 'track')" :key="row.n">
                        <th scope="row"><span class="pips" aria-hidden="true"><i v-for="p in 4" :key="p" :class="{ on: p <= row.n }"></i></span><span class="num">{{ row.n }}</span></th>
                        <td v-if="row.n === 4"><b>{{ lead(row.structure) }}</b> {{ rest(row.structure) }}</td>
                        <td v-else>{{ row.structure }}</td>
                        <td v-if="row.n === 4"><b>{{ lead(row.stress) }}</b> {{ rest(row.stress) }}</td>
                        <td v-else>{{ row.stress }}</td>
                      </tr>
                    </tbody>
                  </table>
                  <ul v-if="ofKind(g, 'note').length" class="rows-plain">
                    <li v-for="row in ofKind(g, 'note')" :key="row.text"><p>{{ row.text }}</p></li>
                  </ul>
                  </CombatGroup>
                </div>
              </div>
            </div>
            <p v-for="id in !searching && s.id === 'combat-kit' ? (loadout?.missing ?? []) : []" :key="id" class="note dim missing"><Icon name="warning" />Unknown item ({{ id }})</p>
          </FileSection>
        </template>
      </template>
    </div>
  </main>
</template>

<style scoped>
/* One column of sections: summary, strip, then the three file sections. */
.combat {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-l);
}

/* A section's sub-heading and its cards. */
.block + .block {
  margin-top: var(--space-l);
}

.show-all + .block,
.empty + .block {
  margin-top: var(--space-s);
}

/* Search and the mode switch */
.mode {
  display: grid;
  gap: var(--space-xs);
}

.tools {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--space-s) var(--space-m);
}

.search {
  display: flex;
  flex: 0 1 36rem;
  align-items: flex-end;
  gap: var(--space-s);
  min-width: 0;
}

.search .field {
  flex: 1;
}

.search input {
  width: 100%;
  font-size: 1rem;
}

.count {
  align-self: center;
  margin: 0;
  font-size: var(--fs-s);
}

@media (max-width: 40rem) {
  .search {
    flex-basis: 100%;
  }
}

/* A tab's columns of cards: side by side when there's room. A column is a plain stack, so opening a row only moves the
   cards under it. */
.columns {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
  gap: var(--space-m);
  align-items: start;
}

.column {
  display: grid;
  gap: var(--space-m);
  min-width: 0;
}

.show-all {
  display: inline-flex;
  align-items: center;
  gap: var(--space-s);
  min-height: var(--tap);
  font-size: var(--fs-s);
  cursor: pointer;
}

.show-all input {
  width: 18px;
  height: 18px;
  accent-color: var(--lilac);
}

.missing {
  display: flex;
  align-items: center;
  gap: var(--space-s);
  margin: var(--space-m) 0 0;
  font-size: var(--fs-s);
}

/* Bodies inside a card: lookup tables, formulas and results */
.table {
  margin: 0;
  border: 0;
}

.table + .table {
  border-top: 1px solid var(--rule);
}

.table th,
.table td {
  vertical-align: top;
  white-space: normal;
}

/* Short headers stay on one line, so "E-defence" doesn't break at its hyphen. */
.table thead th {
  white-space: nowrap;
}

.table tbody th {
  color: var(--text);
  font-size: var(--fs-s);
  letter-spacing: 0;
  text-transform: none;
}

.rows-plain {
  margin: 0;
  padding: 0;
  list-style: none;
}

.rows-plain > li {
  display: grid;
  gap: 4px;
  padding: var(--space-s) var(--space-m);
}

.rows-plain > li + li,
.damage-types + .rows-plain,
.rows-plain + .rows-plain,
.table + .rows-plain {
  border-top: 1px solid var(--rule);
}

.rows-plain p {
  margin: 0;
}

.formula-line,
.result-margin {
  font-weight: 700;
}

.result-note {
  display: block;
  font-size: var(--fs-s);
  font-weight: 400;
}

.example {
  color: var(--text-dim);
  font-size: var(--fs-s);
}

.example .label {
  margin-right: var(--space-s);
}

.result-line {
  display: grid;
  grid-template-columns: 6.5rem minmax(0, 1fr);
  gap: var(--space-s);
  font-size: var(--fs-s);
}

.result-line .label {
  padding-top: 2px;
}

/* Structure and stress */
.trigger {
  display: flex;
  gap: var(--space-s);
}

.trigger .icon {
  width: 20px;
  height: 20px;
}

.pips {
  display: inline-flex;
  gap: 3px;
  margin-right: var(--space-s);
  vertical-align: middle;
}

.pips i {
  width: 8px;
  height: 8px;
  border: 1px solid var(--edge);
}

.pips i.on {
  border-color: var(--text-dim);
  background: var(--text-dim);
}

/* Damage-type icons keep COMP/CON's colours */
.damage-types {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs) var(--space-l);
  margin: 0;
  padding: var(--space-s) var(--space-m);
  border-bottom: 1px solid var(--rule);
  list-style: none;
}

.damage-type {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  font-weight: 700;
}

.damage-type .icon {
  color: var(--c);
}
</style>
