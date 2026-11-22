<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import gritIcon from '../assets/icons/skill.svg'
import { catalogueError } from '../catalogue'
import CatalogueNotice from '../components/CatalogueNotice.vue'
import CombatGroup from '../components/CombatGroup.vue'
import CombatTurn from '../components/CombatTurn.vue'
import Icon from '../components/Icon.vue'
import PageHeader from '../components/PageHeader.vue'
import SheetTabs from '../components/SheetTabs.vue'
import { searchWords } from '../archive'
import { actionEntry, firstSentence, plainEntry, rowEntry, turnEntries, type CombatEntry } from '../combatEntries'
import { combatLoadout, type LoadoutBlock, type LoadoutRow } from '../combatLoadout'
import {
  ATTACK_EXTRAS, AREAS, ATTACK_FORMULAS, ATTACK_RESULTS, AURAS, AURAS_NOTE, CHECK_FORMULAS, CHECK_RESULTS, COMBAT_TABS, CONVERSIONS_NOTE, COVER_NOTE, DAMAGE_FORMULAS, DAMAGE_TYPES,
  DEFENCES, DICE, DICE_NOTE, DRONES_NOTE, FOOT_RULES, FULL_ACTIONS, IMPROVISED, JOCKEY, KNOCKBACK, KNOCKBACK_NOTE, MOVEMENT_NOTE, OVERCHARGE, OVERCHARGE_HEAT, OVERCHARGE_LATER,
  PILOT_CHECKS_NOTE, PILOT_DCS, POST_FOOTER, POST_NOTES, PUSHING_THROUGH, QUICK_ACTIONS, RANGE_BONUSES, RANGE_TALENTS, RANGE_TIERS, REACTIONS, REACTIONS_NOTE, RECHARGE, REPAIRS,
  RESULTS_NOTE, SENSORS, SENSORS_NOTE, SIZE_NOTE, SPEED_GATEWAYS, STATUS_GROUPS, STRUCTURE_NOTE, STRUCTURE_STRESS, STRUCTURE_TRIGGERS, TAGS, TERRAIN, TURN_ORDER, WEAPON_SIZES,
  type CombatAction,
} from '../combatRules'
import { tagNames } from '../gameData'
import { itemInfo, type Info } from '../info'
import { activationOf } from '../itemDetails'
import { useMyPilot } from '../myPilot'
import type { PublicMech } from '../pilots'
import { useCatalogue } from '../rules'
import { plainText } from '../rulesText'

// The combat guide: what you can do on your turn, read-only. The text is in src/combatRules.ts. A summary of your turn
// (CombatTurn.vue) sits beside the tabs on a desktop and on the first two tabs on a phone. Each tab is cards of rows
// (CombatGroup.vue): rules open in place, your own kit opens its full information (src/combatLoadout.ts, the same
// as the mech page). One search box looks through every row of every tab.
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
const overcharge = computed(() => (loadout.value?.frame ? loadout.value.overcharge : null))

// The tabs. The url holds the tab (?tab=actions, left out for the first) beside ?mech=.
const urlTab = computed(() => COMBAT_TABS.find((tab) => tab.id === route.query.tab) ?? COMBAT_TABS[0])
const tabBar = useTemplateRef<HTMLElement>('tabBar')
const panel = useTemplateRef<HTMLElement>('panel')
// Searching shows "All" until a tab is picked.
const picked = ref(false)
const view = computed<string>({
  get: () => (searching.value && !picked.value ? 'All' : urlTab.value.label),
  set: (label) => {
    picked.value = label !== 'All'
    const id = COMBAT_TABS.find((tab) => tab.label === label)?.id
    if (id) router.replace({ query: { ...route.query, tab: id === COMBAT_TABS[0].id ? undefined : id }, hash: route.hash })
    // A new tab starts at its top, not wherever the last one was scrolled to.
    nextTick(() => {
      const gap = (panel.value?.getBoundingClientRect().top ?? 0) - (tabBar.value?.getBoundingClientRect().bottom ?? 0)
      if (gap < 0) window.scrollBy({ top: gap })
    })
  },
})

// Search: every word must appear somewhere in a row. A matching tab label keeps the whole tab, a matching card title or
// note the whole card; otherwise only the matching rows.
const query = ref('')
const searchBox = useTemplateRef<HTMLInputElement>('searchBox')
const words = computed(() => searchWords(query.value))
const searching = computed(() => words.value.length > 0)
watch(searching, () => (picked.value = false))
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
type Group = { title: string; icon: string; colour?: string; meta?: string; note?: string; entries?: CombatEntry[]; mine?: CombatEntry[]; data?: Datum[]; groupActivation?: string }
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
type TabContent = { id: string; label: string; columns: Column[]; tags: Column[] }
const ACTIONS = [
  { key: 'quick', title: 'Quick actions', icon: 'activation_quick' },
  { key: 'protocol', title: 'Protocols', icon: 'protocol' },
  { key: 'full', title: 'Full actions', icon: 'activation_full' },
  { key: 'tech', title: 'Tech actions', icon: 'tech_quick' },
  { key: 'free', title: 'Free actions', icon: 'free_action' },
  { key: 'reaction', title: 'Reactions', icon: 'reaction' },
]
// Overcharge is a free action, and so is a power with no chip (Core Power).
const actionKey = (activation?: string) => {
  const colour = activationOf(activation)?.colour
  return !colour || colour === 'overcharge' ? 'free' : colour
}
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
// Your kit's own actions (a system's, a trait's, a core power's), for the Actions cards.
const kitActions = computed<(CombatEntry & { key: string })[]>(() =>
  (loadout.value?.rows ?? []).flatMap((row) => [
    ...(activationOf(row.activation) ? [{ label: row.label, name: row.name, activation: row.activation, text: row.html }] : []),
    ...row.rules.filter((rule) => activationOf(rule.activation)).map((rule) => ({ label: row.name, name: rule.name, activation: rule.activation, frequency: rule.frequency, stats: rule.stats, text: rule.text })),
  ]).map((entry) => ({ ...entry, key: actionKey(entry.activation), gist: firstSentence(entry.text) || undefined })),
)
// Everest: "Lodestar: 1 Repair restores 1 Structure."
const repairLine = computed(() => {
  const n = loadout.value?.structureRepairs
  return loadout.value?.frame && mech.value ? [plainEntry(`${mech.value.name}: ${n} ${n === 1 ? 'Repair restores' : 'Repairs restore'} 1 Structure.`)] : []
})

// Every tab's cards. "on" applies the search; "trim" cuts the tags to your gear; "turnCards" adds your turn's cards to
// Actions (the summary hides them while searching).
function build(on: boolean, trim: boolean, turnCards = on): TabContent[] {
  const l = loadout.value
  const heat = l?.frame ? l.overcharge : OVERCHARGE_HEAT.join(' → ')
  const speed = l?.frame ? (l.stats.find((stat) => stat.id === 'speed')?.value ?? null) : null
  const sizes = trim ? WEAPON_SIZES.filter((row) => l!.sizes.has(row.value)) : WEAPON_SIZES
  const tags = trim ? TAGS.filter((row) => row.tags?.some((id) => l!.tagIds.has(id))) : TAGS
  const turn = turnEntries(speed, l?.frame ? l.overcharge : null)
  const general: CombatAction[] = [...QUICK_ACTIONS, OVERCHARGE, ...FULL_ACTIONS, IMPROVISED, JOCKEY, ...REACTIONS]
  const actions = Object.fromEntries(ACTIONS.map((a) => [a.key, [] as CombatEntry[]]))
  for (const action of general) {
    const entry = actionEntry(action)
    if (action === OVERCHARGE) Object.assign(entry, { heat, text: `${action.text}<br>${OVERCHARGE_LATER}` })
    actions[actionKey(action.activation)].push(entry)
  }
  const action = (key: string): Group => {
    const a = ACTIONS.find((x) => x.key === key)!
    return { title: a.title, icon: a.icon, colour: `--act-${key}`, groupActivation: key === 'tech' ? undefined : key, entries: actions[key], mine: kitActions.value.filter((entry) => entry.key === key), note: key === 'reaction' ? REACTIONS_NOTE : undefined }
  }
  const block = (b: (typeof kitBlocks)[number]): Group => ({ title: b.title, icon: b.icon, colour: b.colour, entries: kitEntries(b.key), meta: b.key === 'frame' && l?.frame ? `${l.frame.source} ${l.frame.name}` : undefined })
  const [weapons, systems, gear, frameCard, talents, core] = kitBlocks.map(block)
  const [cover, conditions, other] = STATUS_GROUPS.map((g): Group => ({ title: g.title, icon: g.icon, entries: g.rows.map((row) => rowEntry(row)) }))
  const rows = (list: Parameters<typeof rowEntry>[0][], options?: Parameters<typeof rowEntry>[1]) => list.map((row) => rowEntry(row, options))
  const plain = (list: Parameters<typeof rowEntry>[0][]) => list.map((row) => plainEntry(row.text, row.value))

  const content: [string, Column[], Column[]?][] = [
    ['kit', [[weapons, systems, gear], [frameCard, talents, core]], [[
      { title: trim ? 'Tags on your gear' : 'Tags', icon: 'generic_item', entries: tags.map((row) => ({ tag: row.value, gist: row.gist ?? firstSentence(row.text), text: row.text })) },
    ], [
      { title: trim ? 'Weapon sizes on your gear' : 'Weapon sizes', icon: 'weapon', entries: rows(sizes) },
    ]]],
    ['actions', [[...(turnCards ? [{ title: 'Your turn', icon: 'list', entries: turn.steps }, { title: 'Scene resources', icon: 'star', note: 'They reset every combat or scene.', entries: turn.resources }] : []), action('quick')], ['protocol', 'full', 'tech', 'free', 'reaction'].map(action)]],
    ['attacks', [[
      { title: 'Attack rolls', icon: 'crosshair', data: data('f', ATTACK_FORMULAS) },
      { title: 'Results', icon: 'approved', note: RESULTS_NOTE, data: data('m', ATTACK_RESULTS) },
    ], [
      { title: 'Damage', icon: 'explosive', data: [...data('type', DAMAGE_TYPES), ...data('f', DAMAGE_FORMULAS)] },
      { title: 'Dice conversions', icon: 'list', note: `${CONVERSIONS_NOTE} ${DICE_NOTE}`, data: [...data('dice', DICE), ...data('recharge', RECHARGE)] },
      { title: 'Defence baselines', icon: 'evasion', data: data('def', DEFENCES) },
      { title: 'Attack terms', icon: 'book-open', entries: rows(ATTACK_EXTRAS) },
    ]]],
    ['checks', [[
      { title: 'Checks and saves', icon: 'systems', data: [...data('f', CHECK_FORMULAS), ...data('chk', CHECK_RESULTS)] },
    ], [
      { title: 'Pilot checks', icon: 'pilot', note: PILOT_CHECKS_NOTE, data: data('dc', PILOT_DCS) },
      { title: 'Pushing through', icon: 'star', entries: [plainEntry(PUSHING_THROUGH)] },
    ]]],
    ['statuses', [[cover, conditions], [other]]],
    ['movement', [[
      { title: 'Speed', icon: 'speed', note: MOVEMENT_NOTE, entries: rows(SPEED_GATEWAYS, { column: true }) },
      { title: 'Terrain', icon: 'map-pin', entries: rows(TERRAIN) },
      { title: 'Knockback', icon: 'arrow-left', note: KNOCKBACK_NOTE, entries: plain(KNOCKBACK) },
      { title: 'Areas', icon: 'blast', entries: rows(AREAS) },
    ], [
      { title: 'Range', icon: 'range', entries: rows(RANGE_TIERS, { column: true, gist: false }) },
      { title: 'Sensors', icon: 'perception', note: SENSORS_NOTE, entries: rows(SENSORS, { column: true, gist: false }) },
      { title: 'Auras', icon: 'info', note: AURAS_NOTE, entries: plain(AURAS) },
      { title: 'Range and Threat bonuses', icon: 'crosshair', entries: plain(RANGE_BONUSES) },
      { title: 'Range in talents', icon: 'talent', entries: plain(RANGE_TALENTS) },
      { title: 'Cover', icon: 'shield', entries: [plainEntry(COVER_NOTE)] },
    ]]],
    ['structure', [[
      { title: 'Structure and stress', icon: 'structure', data: [...data('tr', STRUCTURE_TRIGGERS), ...data('track', STRUCTURE_STRESS), { k: 'note', text: STRUCTURE_NOTE }] },
    ], [
      { title: 'Rest and Full Repair', icon: 'repair', entries: [...rows(REPAIRS), ...repairLine.value] },
      { title: 'Pilots and drones', icon: 'pilot', entries: [...rows(FOOT_RULES), plainEntry(DRONES_NOTE), plainEntry(SIZE_NOTE)] },
    ]]],
    ['posting', [[
      { title: 'Turn order', icon: 'list', entries: TURN_ORDER.map((line) => plainEntry(line)) },
    ], [
      { title: 'Your post', icon: 'book-open', data: [...data('note', POST_NOTES.map((text) => ({ text }))), { k: 'footer', text: POST_FOOTER }] },
    ]]],
  ]
  return content.map(([id, columns, tagColumns = []]) => {
    const label = COMBAT_TABS.find((tab) => tab.id === id)!.label
    const whole = on && hit(label)
    const sift = (cols: Column[]) => cols.map((col) => col.map((g) => find(g, whole, on)).filter((g): g is Group => !!g)).filter((col) => col.length)
    return { id, label, columns: sift(columns), tags: sift(tagColumns) }
  })
}
const count = (tabs: TabContent[]) => tabs.map((tab) => [...tab.columns, ...tab.tags].flat().reduce((n, g) => n + size(g), 0))
const tabs = computed(() => build(searching.value, trimmed.value))
// Every row, to count the search's matches against.
const total = computed(() => count(build(false, false, true)).reduce((a, b) => a + b, 0))
const counts = computed(() => count(tabs.value))
const matches = computed(() => counts.value.reduce((a, b) => a + b, 0))
const tabNames = computed(() => (searching.value ? ['All', ...COMBAT_TABS.map((tab) => tab.label)] : COMBAT_TABS.map((tab) => tab.label)))
const tabCounts = computed(() => ({ All: matches.value, ...Object.fromEntries(COMBAT_TABS.map((tab, i) => [tab.label, counts.value[i]])) }))
// The tabs on show: the one picked, or every tab with matches under its own heading.
const showing = computed(() => (view.value === 'All' ? tabs.value.filter((_, i) => counts.value[i]) : tabs.value.filter((tab) => tab.label === view.value)))

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
        <div class="search">
          <label class="field">
            <span>Search</span>
            <input ref="searchBox" v-model="query" type="search" placeholder="Action, status or tag" @keydown.esc="query = ''" />
          </label>
          <button v-if="query" type="button" class="small" @click="clear">Clear</button>
        </div>
        <p v-if="searching" class="dim count" role="status"><span class="num">{{ matches }}</span> of <span class="num">{{ total }}</span></p>
      </div>

      <div v-if="!searching || matches" ref="tabBar" class="tab-bar">
        <SheetTabs v-model="view" :tabs="tabNames" :counts="searching ? tabCounts : undefined" label="Combat rules" />
      </div>

      <CombatTurn
        :loading="loading"
        :load-error="loadError"
        :has-pilot="!!live.character"
        :mech-list="mechList"
        :mech="mech"
        :ready="!!loadout || !!catalogueError"
        :frame="frame"
        :frames="catalogue.frames"
        :vitals="vitals"
        :overcharge="overcharge"
        :tab="urlTab.id"
        :searching="searching"
        @choose-mech="chooseMech"
        @retry="load()"
      />

      <p v-if="searching && !matches" class="empty">Nothing matches that search.</p>
      <div v-else ref="panel" class="tab-panel">
        <p v-if="!showing.length" class="empty">Nothing matches that search.</p>
        <template v-for="t in showing" :key="t.id">
          <h2 :class="view === 'All' ? 'result-tab' : 'sr-only'">{{ t.label }}</h2>
          <template v-for="(columns, part) in [t.columns, t.tags]" :key="part">
            <div v-if="part === 1 && columns.length" class="sheet-head">
              <h3 class="sheet-label">Tags and weapon sizes</h3>
              <label v-if="canTrim && !searching" class="show-all"><input v-model="showAll" type="checkbox" /> Show all tags</label>
            </div>
            <div v-if="columns.length" class="columns">
              <div v-for="(column, c) in columns" :key="c" class="column">
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
                      <tr><th scope="col">Roll</th><th scope="col">Becomes</th></tr>
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
                  <template v-if="ofKind(g, 'footer').length">
                    <p class="label footer-label">Example footer</p>
                    <pre class="footer code">{{ POST_FOOTER }}</pre>
                  </template>
                </CombatGroup>
              </div>
            </div>
          </template>
          <p v-for="id in !searching && t.id === 'kit' ? (loadout?.missing ?? []) : []" :key="id" class="note dim missing"><Icon name="warning" />Unknown item ({{ id }})</p>
        </template>
      </div>
    </div>
  </main>
</template>

<style scoped>
/* Layout: one column on phones and tablets. From 64rem the summary is a column on the left, and the search, tabs and
   cards stack beside it. */
.combat {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-l);
}

@media (min-width: 64rem) {
  .combat {
    grid-template-columns: 21rem minmax(0, 1fr);
    grid-template-rows: auto auto 1fr;
    grid-template-areas:
      'turn tools'
      'turn tabs'
      'turn panel';
    align-items: start;
    column-gap: var(--space-xl);
  }

  .combat > :deep(.turn) {
    grid-area: turn;
  }

  .tools {
    grid-area: tools;
  }

  .tab-bar {
    grid-area: tabs;
  }

  .tab-panel,
  .combat > .empty {
    grid-area: panel;
  }
}

/* It's about 870px tall, so it only sticks where the window can hold it. */
@media (min-width: 64rem) and (min-height: 60rem) {
  .combat > :deep(.turn) {
    position: sticky;
    top: calc(var(--topbar-h) + var(--space-l));
  }
}

/* Search */
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

/* The tabs stick under the top bar, with the page's background so rows don't show through. */
.tab-bar {
  position: sticky;
  top: var(--topbar-h);
  z-index: 2;
  background: var(--void);
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

.result-tab {
  margin: var(--space-xl) 0 var(--space-m);
  font: 700 var(--fs-l) / 1.2 var(--sans);
}

.result-tab:first-child {
  margin-top: 0;
}

.tab-panel > .sheet-head {
  margin-top: var(--space-l);
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

/* The footer example */
.footer-label {
  margin: 0;
  padding: var(--space-s) var(--space-m) 0;
}

.footer {
  margin: 0;
  padding: var(--space-m);
  font-size: var(--fs-s);
  line-height: 1.6;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
</style>
