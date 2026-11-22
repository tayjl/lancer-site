<script setup lang="ts">
import { computed, ref, useTemplateRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ActionChip from '../components/ActionChip.vue'
import { catalogueError } from '../catalogue'
import CatalogueNotice from '../components/CatalogueNotice.vue'
import FileIndex from '../components/FileIndex.vue'
import FileSection from '../components/FileSection.vue'
import Icon from '../components/Icon.vue'
import InfoRule from '../components/InfoRule.vue'
import PageHeader from '../components/PageHeader.vue'
import { searchWords } from '../archive'
import { combatLoadout, type LoadoutBlock, type LoadoutRow } from '../combatLoadout'
import {
  ATTACK_EXTRAS, AREAS, ATTACK_FORMULAS, ATTACK_RESULTS, AURAS, AURAS_NOTE, CHECK_FORMULAS, CHECK_RESULTS, COMBAT_SECTIONS, CONVERSIONS_NOTE, COVER_NOTE, DAMAGE_FORMULAS, DAMAGE_TYPES,
  DEFENCES, DICE, DICE_NOTE, DRONES_NOTE, FOOT_RULES, FULL_ACTIONS, IMPROVISED, JOCKEY, KNOCKBACK, KNOCKBACK_NOTE, MOVEMENT_NOTE, OVERCHARGE, OVERCHARGE_HEAT, OVERCHARGE_LATER,
  PILOT_CHECKS_NOTE, PILOT_DCS, POST_FOOTER, POST_NOTES, PUSHING_THROUGH, QUICK_ACTIONS, RANGE_BONUSES, RANGE_TALENTS, RANGE_TIERS, REACTIONS, REACTIONS_NOTE, RECHARGE, REPAIRS,
  RESOURCES_NOTE, RESULTS_NOTE, SCENE_RESOURCES, SENSORS, SENSORS_NOTE, SIZE_NOTE, SPEED_GATEWAYS, STATUSES, STRUCTURE_NOTE, STRUCTURE_STRESS, STRUCTURE_TRIGGERS, TAGS, TERRAIN,
  TURN_ORDER, TURN_STEPS, WEAPON_SIZES,
} from '../combatRules'
import { tagNames } from '../gameData'
import { useMyPilot } from '../myPilot'
import type { PublicMech } from '../pilots'
import { useCatalogue } from '../rules'
import { plainText } from '../rulesText'

// The combat guide: what you can do on your turn, read-only. The text is in src/combatRules.ts. Sections use the
// pilot file's numbered sections and sticky index. The first section is your own loadout (src/combatLoadout.ts), and
// "Weapons and tags" shows only the sizes and tags on that gear. One search box looks through every rule on the page.
const route = useRoute()
const router = useRouter()
const ordinals = ['1st', '2nd', '3rd', '4th']
// The last track step is "Blow up. The mech is wrecked.": its first sentence is shown bold.
const lead = (text: string) => text.split('. ')[0] + '.'
const rest = (text: string) => text.slice(lead(text).length).trim()

// Your living pilot as a GM approved it: what's in play, not a change still in draft.
const { character, sheet, approved, loading, loadError, load } = useMyPilot()
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
const BLOCKS: { key: LoadoutBlock; title: string }[] = [
  { key: 'weapons', title: 'Weapons' },
  { key: 'systems', title: 'Systems' },
  { key: 'frame', title: 'Frame' },
  { key: 'talents', title: 'Talents' },
  { key: 'core-bonuses', title: 'Core bonuses' },
  { key: 'gear', title: 'Pilot gear' },
]

// Search: every word must appear somewhere in a row. A matching section title shows the whole section, a matching
// block heading or note the whole block, otherwise only the matching rows.
const query = ref('')
const searchBox = useTemplateRef<HTMLInputElement>('searchBox')
const words = computed(() => searchWords(query.value))
const searching = computed(() => words.value.length > 0)
const flat = (value: unknown): string[] => (Array.isArray(value) ? value.flatMap(flat) : value && typeof value === 'object' ? Object.values(value).flatMap(flat) : value == null ? [] : [String(value)])
const hit = (...parts: unknown[]) => {
  const text = plainText(flat(parts).join(' ')).toLowerCase()
  return words.value.every((word) => text.includes(word))
}
const rowsFor = (id: string) => {
  const all = searching.value && hit(COMBAT_SECTIONS.find((sec) => sec.id === id)?.title)
  return <T,>(rows: T[], ...context: unknown[]) => (!searching.value || all || hit(context) ? rows : rows.filter((row) => hit(row)))
}

// Trimming: with a mech and its frame loaded, only the weapon sizes and tags on your gear. "Show all rules" lifts it,
// and so does searching.
const showAll = ref(false)
const canTrim = computed(() => !!loadout.value?.frame)
const trimmed = computed(() => canTrim.value && !showAll.value)
const gearSizes = computed(() => (trimmed.value ? WEAPON_SIZES.filter((row) => loadout.value!.sizes.has(row.value)) : WEAPON_SIZES))
const gearTags = computed(() => (trimmed.value ? TAGS.filter((row) => row.tags?.some((id) => loadout.value!.tagIds.has(id))) : TAGS))
// Everest: "Lodestar: 1 Repair restores 1 Structure."
const repairs = computed(() => {
  const n = loadout.value?.structureRepairs
  return loadout.value?.frame && mech.value ? [...REPAIRS, { value: mech.value.name, text: `${n} ${n === 1 ? 'Repair restores' : 'Repairs restore'} 1 Structure.` }] : REPAIRS
})

// The rows to draw in each block, by section (its id without "combat-").
const shown = computed(() => {
  const turn = rowsFor('combat-turn'), quick = rowsFor('combat-quick'), full = rowsFor('combat-full'), reactions = rowsFor('combat-reactions'), attacks = rowsFor('combat-attacks')
  const checks = rowsFor('combat-checks'), structure = rowsFor('combat-structure'), repair = rowsFor('combat-repair'), statuses = rowsFor('combat-statuses')
  const movement = rowsFor('combat-movement'), range = rowsFor('combat-range'), foot = rowsFor('combat-foot'), weapons = rowsFor('combat-weapons'), conversions = rowsFor('combat-conversions')
  const mine = rowsFor('combat-loadout')
  return {
    loadout: Object.fromEntries(BLOCKS.map(({ key, title }) => [key, mine(loadout.value?.rows.filter((row) => row.block === key) ?? [], title)])) as Record<LoadoutBlock, LoadoutRow[]>,
    turn: {
      order: turn(TURN_ORDER, 'Turn order'),
      steps: turn(TURN_STEPS),
      resources: turn(SCENE_RESOURCES, 'Scene resources', RESOURCES_NOTE),
      post: turn([...POST_NOTES, POST_FOOTER], 'Your post', 'Example footer'),
    },
    quick: { quick: quick(QUICK_ACTIONS) },
    full: { full: full(FULL_ACTIONS), overcharge: full([OVERCHARGE], OVERCHARGE_LATER, 'Heat') },
    reactions: { reactions: reactions(REACTIONS, REACTIONS_NOTE) },
    attacks: {
      formulas: attacks(ATTACK_FORMULAS),
      results: attacks(ATTACK_RESULTS, 'Results', RESULTS_NOTE),
      damage: attacks(DAMAGE_FORMULAS, 'Damage', DAMAGE_TYPES),
      defences: attacks(DEFENCES, 'Defence baselines'),
      extras: attacks(ATTACK_EXTRAS, 'More attack rules'),
      improvised: attacks([IMPROVISED], 'More attack rules'),
    },
    checks: {
      formulas: checks(CHECK_FORMULAS),
      results: checks(CHECK_RESULTS),
      dcs: checks(PILOT_DCS, 'Pilot checks', PILOT_CHECKS_NOTE),
      pushing: checks([PUSHING_THROUGH], 'Pushing through'),
    },
    structure: { triggers: structure(STRUCTURE_TRIGGERS), track: structure(STRUCTURE_STRESS, 'Structure', 'Stress'), note: structure([STRUCTURE_NOTE]) },
    repair: { repairs: repair(repairs.value) },
    statuses: { statuses: statuses(STATUSES) },
    movement: { gateways: movement(SPEED_GATEWAYS, 'Speed', MOVEMENT_NOTE), terrain: movement(TERRAIN, 'Terrain'), knockback: movement(KNOCKBACK, 'Knockback', KNOCKBACK_NOTE) },
    range: {
      tiers: range(RANGE_TIERS, 'Range'),
      areas: range(AREAS, 'Areas'),
      bonuses: range(RANGE_BONUSES, 'Range and Threat bonuses'),
      sensors: range(SENSORS, 'Sensors', SENSORS_NOTE),
      auras: range(AURAS, 'Auras', AURAS_NOTE),
      talents: range(RANGE_TALENTS, 'Range in talents'),
      cover: range([COVER_NOTE], 'Cover'),
    },
    foot: { foot: foot(FOOT_RULES, 'Pilots on foot'), jockey: foot([JOCKEY], 'Pilots on foot'), drones: foot([DRONES_NOTE], 'Drones and deployables'), size: foot([SIZE_NOTE], 'Size') },
    weapons: { sizes: weapons(searching.value ? WEAPON_SIZES : gearSizes.value, 'Weapon sizes'), tags: weapons(searching.value ? TAGS : gearTags.value, 'Tags') },
    conversions: { dice: conversions(DICE, 'Dice damage', DICE_NOTE, CONVERSIONS_NOTE), recharge: conversions(RECHARGE, 'Recharge and chance rolls') },
  }
})

// The index lists the sections you'd see without searching, numbered by position, so a number stays the same while you
// search. The weapons section drops out when trimming leaves it empty.
const visible = (id: string) =>
  (id === 'combat-loadout' && !searching.value) || Object.values((shown.value as Record<string, Record<string, unknown[]>>)[id.slice(7)]).some((rows) => rows.length)
const sections = computed(() =>
  COMBAT_SECTIONS.filter((sec) => visible(sec.id) || sec.id !== 'combat-weapons' || gearSizes.value.length || gearTags.value.length).map((sec, i) => ({ ...sec, no: String(i + 1).padStart(2, '0') })),
)
const listed = computed(() => sections.value.filter((sec) => visible(sec.id)))
const clear = () => {
  query.value = ''
  searchBox.value?.focus()
}
</script>

<template>
  <main class="page">
    <PageHeader title="Combat" summary="What you can do on your turn, and the rules to look up." />
    <CatalogueNotice />
    <div class="tools">
      <div class="search">
        <label class="field">
          <span>Search</span>
          <input ref="searchBox" v-model="query" type="search" placeholder="Action, status or tag" @keydown.esc="query = ''" />
        </label>
        <button v-if="query" type="button" class="small" @click="clear">Clear</button>
      </div>
      <p v-if="searching" class="dim count" role="status"><span class="num">{{ listed.length }}</span> of <span class="num">{{ sections.length }}</span> sections</p>
      <!-- Hidden, not removed, until the loadout loads, so the page doesn't jump down when it appears. -->
      <label class="show-all" :class="{ unready: !canTrim }"><input v-model="showAll" type="checkbox" :disabled="!canTrim" /> Show all rules</label>
    </div>
    <p v-if="searching && !listed.length" class="empty">Nothing matches that search.</p>
    <div v-else class="dossier">
      <FileIndex :sections="listed" />
      <div class="file">
        <FileSection v-for="sec in listed" :id="sec.id" :key="sec.id" :no="sec.no" :title="sec.title" :fixed="searching">
          <template v-if="sec.id === 'combat-loadout'">
            <p v-if="loading" class="dim" role="status">Loading…</p>
            <template v-else-if="loadError">
              <p class="notice warn" role="alert">Your pilot didn't load: {{ loadError }}</p>
              <button type="button" class="small" @click="load()">Retry</button>
            </template>
            <p v-else-if="!live.character" class="empty">No pilot yet.</p>
            <template v-else>
              <p v-if="!mech" class="empty">No mechs yet.</p>
              <div v-else class="mech-pick">
                <label v-if="mechList.length > 1" class="field">
                  <span>Mech</span>
                  <select :value="mech.id" @change="chooseMech(($event.target as HTMLSelectElement).value)">
                    <option v-for="m in mechList" :key="m.id" :value="m.id">{{ m.name }}</option>
                  </select>
                </label>
                <p v-else class="mech-name">{{ mech.name }}</p>
                <p v-if="loadout" class="dim frame-line">{{ loadout.frame ? `${loadout.frame.source} ${loadout.frame.name}` : 'Choose a frame first.' }}</p>
              </div>
              <!-- A failed read shows as the game content notice instead. -->
              <p v-if="!loadout && !catalogueError" class="dim" role="status">Loading…</p>
              <template v-for="b in BLOCKS" :key="b.key">
                <template v-if="shown.loadout[b.key].length">
                  <h3 class="sheet-label">{{ b.title }}</h3>
                  <ul class="actions">
                    <li v-for="(row, n) in shown.loadout[b.key]" :key="`${row.name}:${n}`">
                      <InfoRule :level="4" :label="row.label" :heading="row.name" :activation="row.activation" :stats="row.stats" :html="row.html">
                        <p v-if="row.tags.length" class="chip-row tags"><span v-for="t in row.tags" :key="t" class="chip">{{ t }}</span></p>
                        <InfoRule v-for="r in row.rules" :key="r.name" :level="5" class="ruled" :heading="r.name" :activation="r.activation" :frequency="r.frequency" :stats="r.stats" :html="r.text" />
                        <InfoRule v-for="m in row.mods" :key="m.name" :level="5" class="ruled" label="Mod" :heading="m.name" :html="m.html" />
                      </InfoRule>
                    </li>
                  </ul>
                </template>
              </template>
              <p v-for="id in loadout?.missing ?? []" :key="id" class="note dim missing"><Icon name="warning" />Unknown item ({{ id }})</p>
            </template>
          </template>

          <template v-else-if="sec.id === 'combat-turn'">
            <template v-if="shown.turn.order.length">
              <p class="label">Turn order</p>
              <ul class="order">
                <li v-for="line in shown.turn.order" :key="line">{{ line }}</li>
              </ul>
            </template>
            <ol v-if="shown.turn.steps.length" class="steps">
              <li v-for="step in shown.turn.steps" :key="step.name">
                <span class="step-no num" aria-hidden="true">{{ TURN_STEPS.indexOf(step) + 1 }}</span>
                <InfoRule :level="3" :heading="step.name" :activation="step.activations.length === 1 ? step.activations[0] : undefined" :frequency="step.frequency" :html="step.text">
                  <p v-if="step.activations.length > 1" class="chip-row"><ActionChip v-for="act in step.activations" :key="act" :activation="act" /></p>
                </InfoRule>
              </li>
            </ol>
            <template v-if="shown.turn.resources.length">
              <h3 class="sheet-label">Scene resources</h3>
              <p class="note dim">{{ RESOURCES_NOTE }}</p>
              <ul class="actions">
                <li v-for="res in shown.turn.resources" :key="res.name"><InfoRule :level="4" :heading="res.name" :frequency="res.frequency" :html="res.text" /></li>
              </ul>
            </template>
            <template v-if="shown.turn.post.length">
              <h3 class="sheet-label">Your post</h3>
              <template v-for="row in shown.turn.post" :key="row">
                <template v-if="row === POST_FOOTER">
                  <p class="label">Example footer</p>
                  <pre class="footer code">{{ POST_FOOTER }}</pre>
                </template>
                <p v-else class="note">{{ row }}</p>
              </template>
            </template>
          </template>

          <ul v-else-if="sec.id === 'combat-quick'" class="actions">
            <li v-for="action in shown.quick.quick" :key="action.name"><InfoRule :level="3" :heading="action.name" :activation="action.activation" :frequency="action.frequency" :html="action.text" /></li>
          </ul>

          <ul v-else-if="sec.id === 'combat-full'" class="actions">
            <li v-for="action in shown.full.full" :key="action.name"><InfoRule :level="3" :heading="action.name" :activation="action.activation" :frequency="action.frequency" :html="action.text" /></li>
            <li v-if="shown.full.overcharge.length">
              <InfoRule :level="3" :heading="OVERCHARGE.name" :activation="OVERCHARGE.activation" :frequency="OVERCHARGE.frequency" :html="OVERCHARGE.text">
                <ol class="heat-steps" aria-label="Overcharge Heat cost">
                  <li v-for="(heat, n) in OVERCHARGE_HEAT" :key="n">
                    <span class="label">{{ ordinals[n] }}</span>
                    <span class="num">{{ heat }}</span>
                    <span class="heat-word"><Icon name="heat" />Heat</span>
                  </li>
                </ol>
                <p class="note dim">{{ OVERCHARGE_LATER }}</p>
              </InfoRule>
            </li>
          </ul>

          <template v-else-if="sec.id === 'combat-reactions'">
            <p class="note">{{ REACTIONS_NOTE }}</p>
            <ul class="actions">
              <li v-for="action in shown.reactions.reactions" :key="action.name"><InfoRule :level="3" :heading="action.name" :activation="action.activation" :frequency="action.frequency" :html="action.text" /></li>
            </ul>
          </template>

          <template v-else-if="sec.id === 'combat-attacks'">
            <ul v-if="shown.attacks.formulas.length" class="formulas">
              <li v-for="f in shown.attacks.formulas" :key="f.formula" class="formula">
                <p class="formula-line">{{ f.formula }}</p>
                <p v-if="f.note" class="note">{{ f.note }}</p>
                <p class="example"><span class="label">Example</span>{{ f.example }}</p>
              </li>
            </ul>
            <template v-if="shown.attacks.results.length">
              <h3 class="sheet-label">Results</h3>
              <p class="note">{{ RESULTS_NOTE }}</p>
              <table class="table wrap results">
                <thead>
                  <tr><th scope="col">Your total</th><th scope="col">Attack</th><th scope="col">Tech attack</th></tr>
                </thead>
                <tbody>
                  <tr v-for="row in shown.attacks.results" :key="row.margin">
                    <th scope="row">{{ row.margin }}<span v-if="row.note" class="dim row-note">{{ row.note }}</span></th>
                    <td data-label="Attack"><b>{{ row.physical[0] }}</b> {{ row.physical[1] }}</td>
                    <td data-label="Tech attack"><b>{{ row.tech[0] }}</b> {{ row.tech[1] }}</td>
                  </tr>
                </tbody>
              </table>
            </template>
            <template v-if="shown.attacks.damage.length">
              <h3 class="sheet-label">Damage</h3>
              <ul class="sep damage-types">
                <li v-for="t in DAMAGE_TYPES" :key="t.name" class="damage-type" :style="{ '--c': `var(--dmg-${t.icon})` }"><Icon :name="t.icon" />{{ t.name }}</li>
              </ul>
              <ul class="formulas">
                <li v-for="f in shown.attacks.damage" :key="f.formula" class="formula">
                  <p class="formula-line">{{ f.formula }}</p>
                  <p v-if="f.note" class="note">{{ f.note }}</p>
                  <p class="example"><span class="label">Example</span>{{ f.example }}</p>
                </li>
              </ul>
            </template>
            <template v-if="shown.attacks.defences.length">
              <h3 class="sheet-label">Defence baselines</h3>
              <table class="table wrap">
                <thead>
                  <tr><th scope="col">Mech</th><th scope="col">Evasion</th><th scope="col">E-defence</th></tr>
                </thead>
                <tbody>
                  <tr v-for="row in shown.attacks.defences" :key="row.mech"><th scope="row">{{ row.mech }}</th><td class="num">{{ row.evasion }}</td><td class="num">{{ row.edef }}</td></tr>
                </tbody>
              </table>
            </template>
            <template v-if="shown.attacks.extras.length || shown.attacks.improvised.length">
              <h3 class="sheet-label">More attack rules</h3>
              <dl v-if="shown.attacks.extras.length" class="glossary">
                <div v-for="row in shown.attacks.extras" :key="row.value"><dt>{{ row.value }}</dt><dd>{{ row.text }}</dd></div>
              </dl>
              <ul v-if="shown.attacks.improvised.length" class="actions">
                <li><InfoRule :level="4" :heading="IMPROVISED.name" :activation="IMPROVISED.activation" :html="IMPROVISED.text" /></li>
              </ul>
            </template>
          </template>

          <template v-else-if="sec.id === 'combat-checks'">
            <ul v-if="shown.checks.formulas.length" class="formulas">
              <li v-for="f in shown.checks.formulas" :key="f.formula" class="formula">
                <p class="formula-line">{{ f.formula }}</p>
                <p class="example"><span class="label">Example</span>{{ f.example }}</p>
              </li>
            </ul>
            <table v-if="shown.checks.results.length" class="table wrap">
              <thead>
                <tr><th scope="col">Your total</th><th scope="col">Result</th></tr>
              </thead>
              <tbody>
                <tr v-for="row in shown.checks.results" :key="row.value"><th scope="row">{{ row.value }}</th><td>{{ row.text }}</td></tr>
              </tbody>
            </table>
            <template v-if="shown.checks.dcs.length">
              <h3 class="sheet-label">Pilot checks</h3>
              <p class="note">{{ PILOT_CHECKS_NOTE }}</p>
              <table class="table wrap">
                <thead>
                  <tr><th scope="col">DC</th><th scope="col">Task</th></tr>
                </thead>
                <tbody>
                  <tr v-for="row in shown.checks.dcs" :key="row.value"><th scope="row" class="num">{{ row.value }}</th><td>{{ row.text }}</td></tr>
                </tbody>
              </table>
            </template>
            <p v-if="shown.checks.pushing.length" class="note"><b>Pushing through:</b> {{ PUSHING_THROUGH }}</p>
          </template>

          <template v-else-if="sec.id === 'combat-structure'">
            <p v-for="t in shown.structure.triggers" :key="t.name" class="trigger"><Icon :name="t.icon" class="dim" /><span><b>{{ t.name }}</b> {{ t.text }}</span></p>
            <table v-if="shown.structure.track.length" class="table wrap track">
              <thead>
                <tr>
                  <th scope="col">Damage</th>
                  <th scope="col"><Icon name="structure" /> Structure</th>
                  <th scope="col"><Icon name="reactor" /> Stress</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in shown.structure.track" :key="row.n">
                  <th scope="row"><span class="pips" aria-hidden="true"><i v-for="p in 4" :key="p" :class="{ on: p <= row.n }"></i></span><span class="num">{{ row.n }}</span></th>
                  <td v-if="row.n === 4"><b>{{ lead(row.structure) }}</b> {{ rest(row.structure) }}</td>
                  <td v-else>{{ row.structure }}</td>
                  <td v-if="row.n === 4"><b>{{ lead(row.stress) }}</b> {{ rest(row.stress) }}</td>
                  <td v-else>{{ row.stress }}</td>
                </tr>
              </tbody>
            </table>
            <p v-if="shown.structure.note.length" class="note">{{ STRUCTURE_NOTE }}</p>
          </template>

          <dl v-else-if="sec.id === 'combat-repair'" class="glossary">
            <div v-for="row in shown.repair.repairs" :key="row.value"><dt>{{ row.value }}</dt><dd>{{ row.text }}</dd></div>
          </dl>

          <dl v-else-if="sec.id === 'combat-statuses'" class="glossary">
            <div v-for="row in shown.statuses.statuses" :key="row.value"><dt>{{ row.value }}</dt><dd>{{ row.text }}</dd></div>
          </dl>

          <template v-else-if="sec.id === 'combat-movement'">
            <template v-if="shown.movement.gateways.length">
              <p class="note">{{ MOVEMENT_NOTE }}</p>
              <table class="table wrap">
                <thead>
                  <tr><th scope="col">Speed</th><th scope="col">Move</th></tr>
                </thead>
                <tbody>
                  <tr v-for="row in shown.movement.gateways" :key="row.value"><th scope="row" class="num">{{ row.value }}</th><td><b>{{ row.name }}</b>{{ row.text }}</td></tr>
                </tbody>
              </table>
            </template>
            <template v-if="shown.movement.terrain.length">
              <h3 class="sheet-label">Terrain</h3>
              <dl class="glossary">
                <div v-for="row in shown.movement.terrain" :key="row.value"><dt>{{ row.value }}</dt><dd>{{ row.text }}</dd></div>
              </dl>
            </template>
            <template v-if="shown.movement.knockback.length">
              <h3 class="sheet-label">Knockback</h3>
              <p class="note">{{ KNOCKBACK_NOTE }}</p>
              <table class="table wrap">
                <thead>
                  <tr><th scope="col">Knockback</th><th scope="col">Effect</th></tr>
                </thead>
                <tbody>
                  <tr v-for="row in shown.movement.knockback" :key="row.value"><th scope="row" class="num">{{ row.value }}</th><td>{{ row.text }}</td></tr>
                </tbody>
              </table>
            </template>
          </template>

          <template v-else-if="sec.id === 'combat-range'">
            <table v-if="shown.range.tiers.length" class="table wrap">
              <thead>
                <tr><th scope="col">Range</th><th scope="col">Reaches</th></tr>
              </thead>
              <tbody>
                <tr v-for="row in shown.range.tiers" :key="row.value"><th scope="row" class="num">{{ row.value }}</th><td><b>{{ row.name }}</b>{{ row.text }}</td></tr>
              </tbody>
            </table>
            <template v-if="shown.range.areas.length">
              <h3 class="sheet-label">Areas</h3>
              <dl class="glossary">
                <div v-for="row in shown.range.areas" :key="row.value"><dt><Icon v-if="row.icon" :name="row.icon" class="dim" />{{ row.value }}</dt><dd>{{ row.text }}</dd></div>
              </dl>
            </template>
            <template v-if="shown.range.bonuses.length">
              <h3 class="sheet-label">Range and Threat bonuses</h3>
              <table class="table wrap">
                <thead>
                  <tr><th scope="col">Bonus</th><th scope="col">Effect</th></tr>
                </thead>
                <tbody>
                  <tr v-for="row in shown.range.bonuses" :key="row.value"><th scope="row">{{ row.value }}</th><td>{{ row.text }}</td></tr>
                </tbody>
              </table>
            </template>
            <template v-if="shown.range.sensors.length">
              <h3 class="sheet-label">Sensors</h3>
              <p class="note">{{ SENSORS_NOTE }}</p>
              <table class="table wrap">
                <thead>
                  <tr><th scope="col">Sensors</th><th scope="col">Reach</th></tr>
                </thead>
                <tbody>
                  <tr v-for="row in shown.range.sensors" :key="row.value"><th scope="row" class="num">{{ row.value }}</th><td><b>{{ row.name }}</b>{{ row.text }}</td></tr>
                </tbody>
              </table>
            </template>
            <template v-if="shown.range.auras.length">
              <h3 class="sheet-label">Auras</h3>
              <p class="note">{{ AURAS_NOTE }}</p>
              <table class="table wrap">
                <thead>
                  <tr><th scope="col">Within range</th><th scope="col">Covers</th></tr>
                </thead>
                <tbody>
                  <tr v-for="row in shown.range.auras" :key="row.value"><th scope="row" class="num">{{ row.value }}</th><td>{{ row.text }}</td></tr>
                </tbody>
              </table>
            </template>
            <template v-if="shown.range.talents.length">
              <h3 class="sheet-label">Range in talents</h3>
              <dl class="glossary">
                <div v-for="row in shown.range.talents" :key="row.value"><dt>{{ row.value }}</dt><dd>{{ row.text }}</dd></div>
              </dl>
            </template>
            <template v-if="shown.range.cover.length">
              <h3 class="sheet-label">Cover</h3>
              <p class="note">{{ COVER_NOTE }}</p>
            </template>
          </template>

          <template v-else-if="sec.id === 'combat-foot'">
            <template v-if="shown.foot.foot.length || shown.foot.jockey.length">
              <h3 class="sheet-label">Pilots on foot</h3>
              <dl v-if="shown.foot.foot.length" class="glossary">
                <div v-for="row in shown.foot.foot" :key="row.value"><dt>{{ row.value }}</dt><dd>{{ row.text }}</dd></div>
              </dl>
              <ul v-if="shown.foot.jockey.length" class="actions">
                <li><InfoRule :level="4" :heading="JOCKEY.name" :activation="JOCKEY.activation" :html="JOCKEY.text" /></li>
              </ul>
            </template>
            <template v-if="shown.foot.drones.length">
              <h3 class="sheet-label">Drones and deployables</h3>
              <p class="note">{{ DRONES_NOTE }}</p>
            </template>
            <template v-if="shown.foot.size.length">
              <h3 class="sheet-label">Size</h3>
              <p class="note">{{ SIZE_NOTE }}</p>
            </template>
          </template>

          <template v-else-if="sec.id === 'combat-weapons'">
            <p v-if="trimmed && !searching" class="note dim">Showing the sizes and tags on your gear.</p>
            <template v-if="shown.weapons.sizes.length">
              <h3 class="sheet-label">Weapon sizes</h3>
              <dl class="glossary">
                <div v-for="row in shown.weapons.sizes" :key="row.value"><dt>{{ row.value }}</dt><dd>{{ row.text }}</dd></div>
              </dl>
            </template>
            <template v-if="shown.weapons.tags.length">
              <h3 class="sheet-label">Tags</h3>
              <dl class="glossary">
                <div v-for="row in shown.weapons.tags" :key="row.value"><dt><span class="chip">{{ row.value }}</span></dt><dd>{{ row.text }}</dd></div>
              </dl>
            </template>
          </template>

          <template v-else-if="sec.id === 'combat-conversions'">
            <p class="note">{{ CONVERSIONS_NOTE }}</p>
            <template v-if="shown.conversions.dice.length">
              <h3 class="sheet-label">Dice damage</h3>
              <p class="note">{{ DICE_NOTE }}</p>
              <table class="table wrap">
                <thead>
                  <tr><th scope="col">Dice</th><th scope="col">Becomes</th></tr>
                </thead>
                <tbody>
                  <tr v-for="row in shown.conversions.dice" :key="row.value"><th scope="row">{{ row.value }}</th><td>{{ row.text }}</td></tr>
                </tbody>
              </table>
            </template>
            <template v-if="shown.conversions.recharge.length">
              <h3 class="sheet-label">Recharge and chance rolls</h3>
              <table class="table wrap">
                <thead>
                  <tr><th scope="col">Roll</th><th scope="col">Becomes</th></tr>
                </thead>
                <tbody>
                  <tr v-for="row in shown.conversions.recharge" :key="row.value"><th scope="row">{{ row.value }}</th><td>{{ row.text }}</td></tr>
                </tbody>
              </table>
            </template>
          </template>
        </FileSection>
      </div>
    </div>
  </main>
</template>

<style scoped>
.actions {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr));
  gap: 0 var(--space-xl);
  margin: 0;
  padding: 0;
  list-style: none;
}

.actions li {
  padding: var(--space-m) 0;
  border-top: 1px solid var(--rule);
}

/* Sub-heads and notes inside a section */
.sheet-label {
  margin-top: var(--space-xl);
}

.sheet-label:first-child {
  margin-top: 0;
}

.note {
  max-width: 68ch;
  margin: 0 0 var(--space-m);
}

/* Turn order: plain short lines */
.order {
  max-width: 68ch;
  margin: 0 0 var(--space-m);
  padding-left: var(--space-l);
}

/* Turn steps: number column, one column list */
.steps {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.steps > li {
  display: grid;
  grid-template-columns: 2rem minmax(0, 1fr);
  gap: var(--space-m);
  padding: var(--space-m) 0;
  border-top: 1px solid var(--rule);
}

.step-no {
  color: var(--text-dim);
  font-size: var(--fs-l);
  font-weight: 700;
  line-height: 24px;
}

.chip-row {
  display: flex;
  gap: var(--space-s);
  margin: 0;
}

/* Lookup tables: the global .table, wrapping and top-aligned */
.table.wrap {
  max-width: 60rem;
  margin-bottom: var(--space-m);
}

.table.wrap th,
.table.wrap td {
  vertical-align: top;
  white-space: normal;
}

/* Short headers stay on one line, so "E-defence" doesn't break at its hyphen. */
.table.wrap thead th {
  white-space: nowrap;
}

.table.wrap tbody th {
  color: var(--text);
  font-size: var(--fs-s);
  letter-spacing: 0;
  text-transform: none;
}

.table.wrap td b {
  display: block;
}

.row-note {
  display: block;
  font-weight: 400;
}

/* Name and meaning lists */
.glossary {
  display: grid;
  margin: 0;
}

.glossary > div {
  display: grid;
  grid-template-columns: 12rem minmax(0, 1fr);
  gap: var(--space-m);
  padding: var(--space-s) 0;
  border-top: 1px solid var(--rule);
}

.glossary dt {
  display: flex;
  align-items: center;
  align-self: start;
  gap: var(--space-s);
  font-weight: 700;
}

.glossary dd {
  max-width: 68ch;
  margin: 0;
}

/* Formula boxes with a worked example */
.formulas {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 20rem), 1fr));
  gap: var(--space-m);
  margin: 0 0 var(--space-l);
  padding: 0;
  list-style: none;
}

.formula {
  display: grid;
  align-content: start;
  gap: var(--space-s);
  padding: var(--space-m);
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  background: var(--panel);
}

.formula p {
  margin: 0;
}

.formula-line {
  font-weight: 700;
}

.example {
  color: var(--text-dim);
  font-size: var(--fs-s);
}

.example .label {
  margin-right: var(--space-s);
}

/* Overcharge heat: 4 boxes in a row */
.heat-steps {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--space-s);
  max-width: 24rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.heat-steps li {
  display: grid;
  justify-items: center;
  gap: 2px;
  padding: var(--space-s) var(--space-xs);
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  text-align: center;
}

.heat-steps .num {
  font-size: var(--fs-l);
  font-weight: 700;
}

.heat-word {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: var(--fs-xs);
}

.heat-word .icon {
  color: var(--dmg-heat);
}

/* Structure and stress */
.trigger {
  display: flex;
  gap: var(--space-s);
  max-width: 68ch;
  margin: 0 0 var(--space-m);
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
  margin: 0 0 var(--space-m);
  padding: 0;
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
.footer {
  margin: 0;
  padding: var(--space-m);
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  background: var(--panel);
  font-size: var(--fs-s);
  line-height: 1.6;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

/* Search and "Show all rules" */
.tools {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--space-s) var(--space-l);
  margin-top: var(--space-l);
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

.show-all {
  display: inline-flex;
  align-items: center;
  gap: var(--space-s);
  min-height: var(--tap);
  margin-left: auto;
  cursor: pointer;
}

.show-all.unready {
  visibility: hidden;
}

.show-all input {
  width: 18px;
  height: 18px;
  accent-color: var(--lilac);
}

/* Your loadout */
.tags {
  flex-wrap: wrap;
  margin-top: var(--space-xs);
}

.ruled {
  margin-top: var(--space-s);
  padding-top: var(--space-s);
  border-top: 1px solid var(--rule);
}

.mech-pick {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--space-xs) var(--space-l);
  margin-bottom: var(--space-l);
}

.mech-pick .field {
  flex: 0 1 20rem;
}

.mech-name {
  margin: 0;
  font-size: var(--fs-l);
  font-weight: 700;
}

.frame-line {
  margin: 0;
}

.missing {
  display: flex;
  align-items: center;
  gap: var(--space-s);
}

@media (max-width: 40rem) {
  .search {
    flex-basis: 100%;
  }

  .show-all {
    margin-left: 0;
  }

  .mech-pick .field {
    flex-basis: 100%;
  }

  .glossary > div {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--space-xs);
  }

  /* Results: each row becomes a block, the margin as its head, then Attack and Tech attack labelled */
  .results thead {
    display: none;
  }

  .results tr,
  .results th,
  .results td {
    display: block;
  }

  .results tbody th {
    padding-bottom: 0;
    border-bottom: 0;
  }

  .results td::before {
    display: block;
    content: attr(data-label);
    color: var(--text-dim);
    font-size: var(--fs-xs);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .results td:first-of-type {
    border-bottom: 0;
  }
}
</style>
