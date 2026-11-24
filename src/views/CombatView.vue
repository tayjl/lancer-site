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
import { actionKey, firstSentence, rowEntry, rulesTopics, stepActions, type CombatEntry, type KitAction } from '../combatEntries'
import { combatLoadout, frameGroups, gearGroups, weaponGroups, type LoadoutBlock, type LoadoutRow } from '../combatLoadout'
import { onFootRows, ruleRows, statusGroups, turnSteps } from '../rulesData'
import { baseActionsLoaded, combatTags, hiddenTags, loadBaseActions, loadRules, loadTagNames, rulesLoaded, pilotVitals, tagDescriptions, tagNames, tagNamesLoaded, useGameData } from '../gameData'
import { itemInfo, type Info } from '../info'
import { activationOf } from '../itemDetails'
import { useMyPilot } from '../myPilot'
import type { PublicMech } from '../pilots'
import { useCatalogue } from '../rules'
import { plainText } from '../rulesText'

// The combat guide: what you can do on your turn, read-only. The text is editable content (src/rulesData.ts). A summary of your mech
// (CombatTurn.vue), then the turn bar (CombatStrip.vue: one step open, its actions as light chips that open the full text),
// then three folding sections of cards (CombatGroup.vue): your kit (a fixed grid of cards in the item colours), tags and
// statuses, and the rules (four neutral cards of topic chips, each opening its text in the information popup, from
// rulesTopics in src/combatEntries.ts). Your own kit opens its full information (src/combatLoadout.ts, the same as the mech
// page). A Mech / Pilot switch (?mode=pilot) trims everything to what you can do in your mech or on foot. One search box
// looks through the current mode's rows: the bar gives way to the matching actions and every section with a match opens.
const route = useRoute()
const router = useRouter()
const loadContent = () => { loadBaseActions(); loadRules(); loadTagNames() }
loadContent()
// The action, rule and tag wording is editable content, only the database has it: show nothing of it until all have loaded.
const contentReady = computed(() => baseActionsLoaded.value && rulesLoaded.value && tagNamesLoaded.value)
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
// The mech's numbers for the summary (a 4 x 3 grid, related ones together), with the pilot's Grit. System points are a
// build number, left out. None without a frame.
const vitals = computed(() => {
  const l = loadout.value
  if (!l?.frame) return []
  const stats = ['structure', 'stress', 'hp', 'heat', 'armour', 'evasion', 'edef', 'tech_attack', 'speed', 'repair', 'size'].map((id) => l.stats.find((stat) => stat.id === id)!)
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

// A card: its rows (a title, an icon, an optional colour and meta, and its entries), and "empty", the line it shows with none.
type Group = { title: string; icon: string; colour?: string; meta?: string; note?: string; entries?: CombatEntry[]; mine?: CombatEntry[]; empty?: string; chips?: boolean; tagged?: boolean; gist?: boolean; across?: boolean }
const size = (g: Group) => (g.entries?.length ?? 0) + (g.mine?.length ?? 0)

// Rows that matched only in their hidden text start open, so you see why.
const find = (g: Group, whole: boolean, on: boolean): Group | null => {
  if (!on || whole || hit(g.title, g.note)) return size(g) || (!on && g.empty) ? g : null
  const keep = (list?: CombatEntry[]) => list?.filter((e) => hit(shownText(e), e.text)).map((e) => ({ ...e, open: !!e.text && !hit(shownText(e)) }))
  const found = { ...g, entries: keep(g.entries), mine: keep(g.mine) }
  return size(found) ? found : null
}

type Column = Group[]
const kitBlocks: { key: LoadoutBlock; title: string; icon: string; colour: string }[] = [
  { key: 'weapons', title: 'Weapons', icon: 'weapon', colour: '--type-weapon' },
  { key: 'systems', title: 'Systems', icon: 'system', colour: '--type-system' },
  { key: 'frame', title: 'Frame', icon: 'frame', colour: '--type-frame' },
  { key: 'talents', title: 'Talents', icon: 'talent', colour: '--type-talent' },
  { key: 'core-bonuses', title: 'Core bonuses', icon: 'corebonus', colour: '--type-core' },
  { key: 'gear', title: 'Pilot gear', icon: 'pilot', colour: '--type-pilot' },
]
// A kit row opens the item's full information; a trait, talent or core bonus has no item, so its text is the card.
const kitInfo = (row: LoadoutRow): Info =>
  row.item
    ? itemInfo(row.item)
    : { kind: row.label ?? '', name: row.name, facts: [], stats: [], groups: [{ cards: [{ heading: '', html: row.html, activation: row.activation }] }] }
const kitEntries = (block: LoadoutBlock): CombatEntry[] => {
  const rows = (loadout.value?.rows ?? []).filter((row) => row.block === block)
  const named = block === 'frame' ? frameGroups(rows).map((g) => ({ title: g.title, rows: g.rows })) : block === 'weapons' ? weaponGroups(rows, frame.value).map((g) => ({ title: g.sub ? `${g.title} · ${g.sub}` : g.title, rows: g.rows })) : block === 'gear' ? gearGroups(rows) : []
  const grouped: { row: LoadoutRow; group?: string }[] = named.length
    ? [...named.flatMap((g) => g.rows.map((row) => ({ row, group: g.title }))), ...rows.filter((row) => !named.some((g) => g.rows.includes(row))).map((row) => ({ row }))] // a row with no mount still shows, unlabelled
    : rows.map((row) => ({ row }))
  return grouped.flatMap(({ row, group }) => {
    // An item's actions come from its rules; a trait or core power has its own activation.
    const activations = row.activation ? [row.activation] : [...new Set(row.rules.map((rule) => rule.activation).filter((a): a is string => !!a && !!activationOf(a)))]
    return [
      { label: row.label, name: row.name, activation: row.activation, activations, group, stats: row.stats, tags: row.tags, gist: firstSentence(row.html) || undefined, info: () => kitInfo(row) },
      ...row.mods.map((m) => ({ label: 'Mod', name: m.name, tags: m.tags, gist: firstSentence(m.html) || undefined, mod: true, info: () => itemInfo(m.item) })),
    ]
  })
}
// Your kit's own actions (a system's, a trait's, a core power's), for the turn strip.
// An unknown activation word still counts (it lands in the Free step), but "None" is passive.
const acts = (word?: string) => !!word && word.trim().toLowerCase() !== 'none'
const kitActions = computed<KitAction[]>(() =>
  (loadout.value?.rows ?? []).flatMap((row) => [
    ...(acts(row.activation) ? [{ label: row.label, name: row.name, activation: row.activation, text: row.html, value: row.kind === 'core-power' ? 'Core power' : undefined }] : []),
    ...row.rules.filter((rule) => acts(rule.activation)).map((rule) => ({ label: row.name, name: rule.name, activation: rule.activation, frequency: rule.frequency, stats: rule.stats, text: rule.text })),
  ].map((entry) => ({ ...entry, block: row.block }))).map((entry) => ({ ...entry, key: actionKey(entry.activation), gist: firstSentence(entry.text) || undefined })),
)
// An equipped Sidearm weapon lets a pilot Fight as a Quick action.
const sidearm = computed(() => (loadout.value?.rows ?? []).some((row) => row.block === 'gear' && row.item?.tags.some((t) => t.id === 'tg_sidearm')))
// Everest: "Lodestar: 1 Repair restores 1 Structure."
const repairLine = computed(() => {
  const n = loadout.value?.structureRepairs
  return loadout.value?.frame && mech.value ? `${mech.value.name}: ${n} ${n === 1 ? 'Repair restores' : 'Repairs restore'} 1 Structure.` : undefined
})

// The three sections. "on" applies the search; "trim" cuts the tags to your gear. A block is columns of cards, or with "grid"
// a fixed grid of equal cards that all keep their place.
type Block = { columns: Column[]; grid?: 'one' | 'two' | 'three' | 'status' }
type Content = { id: string; no: string; title: string; folded?: boolean; blocks: Block[]; count: number }
function build(on: boolean, trim: boolean, pilot = mode.value === 'pilot'): Content[] {
  const l = loadout.value
  const sizes = trim ? ruleRows('sizes').filter((row) => l!.sizes.has(row.value)) : ruleRows('sizes')
  // Tag wording comes from the content editor. Trimmed (always in Pilot mode): every visible tag on your gear, homebrew too.
  const tagRows = [...(pilot ? l?.gearTagIds ?? [] : trim ? l!.tagIds : combatTags.value)].sort((a, b) => (tagNames.value.get(a) ?? a).localeCompare(tagNames.value.get(b) ?? b))
    .filter((id) => tagNames.value.has(id) && !hiddenTags.value.has(id))
    .map((id) => ({ tag: tagNames.value.get(id)!.replaceAll('{VAL}', 'X'), text: (tagDescriptions.value.get(id) ?? '').replaceAll('{VAL}', 'X') }))
  const block = (b: (typeof kitBlocks)[number]): Group => ({ title: b.title, icon: b.icon, colour: b.colour, chips: true, empty: 'None.', entries: kitEntries(b.key), across: b.key === 'frame' || b.key === 'weapons' || b.key === 'gear', meta: b.key === 'frame' && l?.frame ? `${l.frame.source} ${l.frame.name}` : undefined })
  const [weapons, systems, frameCard, talents, core, gear] = kitBlocks.map(block)
  // In Pilot mode "Down and out" is only in On foot.
  const [cover, conditions, other] = statusGroups().map((g): Group => ({ title: g.title, icon: g.icon, chips: true, entries: g.rows.filter((row) => !pilot || row.group !== 'pilot').map((row) => rowEntry(row)) }))
  const rows = (list: Parameters<typeof rowEntry>[0][]) => list.map((row) => rowEntry(row))
  const tags: Group = { title: trim || pilot ? 'Tags on your gear' : 'Tags', icon: 'generic_item', chips: true, empty: 'None.', entries: tagRows.map((row) => ({ ...row, gist: firstSentence(row.text) })) }
  const topics = rulesTopics(pilot, repairLine.value).map((card): Group => ({ title: card.title, icon: card.icon, chips: true, entries: card.topics.map((t) => ({ name: t.name, text: t.text, info: t.info })) }))

  const content: [string, string, string, boolean, Block[]][] = [
    ['combat-kit', '01', 'Your kit', false, pilot ? [{ grid: 'one', columns: [[gear]] }, { grid: 'one', columns: [[talents]] }] : [{ grid: 'one', columns: [[frameCard]] }, { grid: 'one', columns: [[weapons]] }, { grid: 'three', columns: [[systems, talents, core]] }]],
    ['combat-tags', '02', 'Tags and statuses', false, pilot
      ? [{ grid: 'two', columns: [[tags, cover, conditions, other, { title: 'On foot', icon: 'pilot', chips: true, entries: rows(onFootRows()) }]] }]
      : [
          { grid: 'two', columns: [[
            tags,
            { title: trim ? 'Weapon sizes on your gear' : 'Weapon sizes', icon: 'weapon', chips: true, entries: rows(sizes) },
          ]] },
          { grid: 'status', columns: [[cover, conditions, other]] },
        ]],
    ['combat-rules', '03', 'Rules', true, [{ grid: 'two', columns: [topics] }]],
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
  const entries = turnSteps().flatMap((s) => stepActions(s.key, kitActions.value, mode.value === 'pilot', overcharge.value, sidearm.value))
    .flatMap((g) => g.entries)
    .filter((e) => !seen.has(`${e.name}|${e.activation}`) && seen.add(`${e.name}|${e.activation}`))
  return find({ title: 'Actions', icon: 'list', chips: true, tagged: true, entries }, false, on)
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
    <CatalogueNotice :retry="loadContent" />
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

      <p v-if="!contentReady" class="dim" role="status">Loading…</p>
      <p v-else-if="searching && !matches" class="empty">Nothing matches that search.</p>
      <template v-else>
        <CombatStrip v-if="!searching" :kit-actions="kitActions" :pilot="mode === 'pilot'" :overcharge="overcharge" :speed="speed" :sidearm="sidearm" />
        <div v-else-if="actions" class="columns">
          <div class="column"><CombatGroup v-bind="actions" /></div>
        </div>
        <template v-for="s in sections" :key="s.id">
          <FileSection v-if="!searching || s.count" :id="s.id" :no="s.no" :title="s.title" :folded="s.folded" :show="searching">
            <label v-if="s.id === 'combat-tags' && canTrim && mode === 'mech' && !searching" class="show-all"><input v-model="showAll" type="checkbox" /> Show all tags</label>
            <div v-for="(b, n) in s.blocks" :key="n" class="block">
              <div v-if="b.grid" class="card-grid" :class="b.grid">
                <CombatGroup v-for="g in b.columns.flat()" :key="g.title" v-bind="g" />
              </div>
              <div v-else class="columns">
                <div v-for="(column, c) in b.columns" :key="c" class="column">
                  <CombatGroup v-for="g in column" :key="g.title" v-bind="g" />
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

.show-all + .block {
  margin-top: var(--space-s);
}

.block + .block {
  margin-top: var(--space-m);
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

/* A fixed grid of equal cards: two columns from 40rem (the status cards three), three columns from 77rem. */
.card-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-m);
}

@media (min-width: 40rem) {
  .card-grid:not(.one) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .card-grid.status {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  /* Three cards: the third spans both columns until there is room for three. */
  .card-grid.three > :last-child {
    grid-column: span 2;
  }
}

@media (min-width: 77rem) {
  .card-grid.three {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .card-grid.three > :last-child {
    grid-column: auto;
  }
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

</style>
