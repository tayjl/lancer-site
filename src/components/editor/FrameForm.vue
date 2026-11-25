<script setup lang="ts">
import { computed } from 'vue'
import { FRAME_STATS, type BonusType, type Data } from '../../contentEditor'
import { coreCheckBonuses } from '../../coreRules'
import { defIds, defLabel, defList, mountHint } from '../../definitions'
import { frameArt } from '../../images'
import { itemInfo } from '../../info'
import { alternateOf, toFrame, useMechData } from '../../mechData'
import { plural } from '../../text'
import MechImage from '../MechImage.vue'
import Icon from '../Icon.vue'
import ImageUpload from '../ImageUpload.vue'
import InfoButton from '../InfoButton.vue'
import RichTextEditor from '../RichTextEditor.vue'
import ActionListField from './ActionListField.vue'
import BonusListField from './BonusListField.vue'
import CoreSystemFields from './CoreSystemFields.vue'
import DeployableListField from './DeployableListField.vue'
import Field from './Field.vue'
import ManufacturerField from './ManufacturerField.vue'
import LicenceField from './LicenceField.vue'
import FieldError from './FieldError.vue'
import FoldPanel from './FoldPanel.vue'
import GrantFields from './GrantFields.vue'
import RequirementListField from './RequirementListField.vue'
import RepeatList from './RepeatList.vue'
import ToggleChips from './ToggleChips.vue'
import { clean, input, latest, list, useFields, useProblems } from './useFields'

// The form for a frame, in lancer-data's own shape (frames.json), in folding sections: Identity and Stats (open), Weapon
// mounts, Traits, Core system and Licence unlocks. A frame is its own licence, so its licence id is its own id and the
// licence's unlocks are the weapons, systems and mods that name it (read here, set on each of those). Fields with no
// input (y_pos, image_url, counters, other_art) stay as they are.
const modelProp = defineModel<Data>({ required: true })
const model = latest(modelProp)
const props = defineProps<{ bonusTypes: BonusType[]; locked: boolean; manufacturers: { id: string; name: string }[] }>()
const f = useFields(model)
const { invalid } = useProblems()
const name = f.text('name')
const source = f.text('source')
const description = f.text('description')
const roles = f.list<string>('mechtype')
const mounts = f.list<string>('mounts')
const traits = f.list<Data>('traits')
const requires = f.list<{ kind: 'talent' | 'licence' | 'core_bonus' | 'item'; id: string; rank?: number }>('requires')
const rank = computed(() => Number(model.value.license_level) || 0)

const entry = (value: unknown): Data => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Data) : {})
// Bonuses on a frame can only be the mech's own.
const mechBonuses = computed(() => props.bonusTypes.filter((type) => type.scope === 'mech'))

const stats = computed(() => entry(model.value.stats))
const setStat = (key: string, text: string) => (model.value = { ...model.value, stats: { ...stats.value, [key]: text.trim() === '' ? '' : Number(text) } })
const sizes = computed(() => {
  const list = defList('frame_sizes').map((size) => ({ value: Number(size.id), label: size.label }))
  const own = Number(stats.value.size)
  return list.some((size) => size.value === own) || stats.value.size === undefined ? list : [...list, { value: own, label: String(own) }]
})

const setMount = (index: number, value: string) => (mounts.value = mounts.value.map((mount, i) => (i === index ? value : mount)))
const moveMount = (index: number, by: number) => {
  const next = [...mounts.value]
  ;[next[index], next[index + by]] = [next[index + by], next[index]]
  mounts.value = next
}

const core = computed(() => entry(model.value.core_system))
// The checks a core power can change. A row is { id, accuracy, val: 0 }, the shape the sheet already reads. Official frames
// show their built-in list until it is edited, which then writes the frame's own.
const CHECKS = [['hull', 'Hull'], ['agility', 'Agility'], ['systems', 'Systems'], ['engineering', 'Engineering'], ['tech_attack', 'Tech attack']]
const checks = computed(() => coreCheckBonuses(String(model.value.id ?? ''), core.value) as Data[])
const setChecks = (rows: Data[]) => (model.value = { ...model.value, core_system: { ...core.value, check_bonuses: rows } })
const changeCheck = (index: number, changes: Data) => setChecks(checks.value.map((row, i) => (i === index ? { ...row, ...changes } : row)))
const checksSummary = computed(() => (checks.value.length ? plural(checks.value.length, 'check') : 'No checks'))
const roman =(level: number) => ['None', 'I', 'II', 'III'][level] ?? String(level)

const { frames, weapons, systems, mods } = useMechData()
// An alternate frame (Worldkiller, an alternate Genghis) shares its original's licence: license_id is the original's id and
// variant its name, as the packs write them. None means this frame is its own licence.
const alternate = computed({
  get: () => alternateOf(toFrame(String(model.value.id ?? ''), model.value), frames.value)?.id ?? '',
  set: (id: string) => {
    const { variant: _variant, ...rest } = model.value
    const original = frames.value.find((frame) => frame.id === id)
    model.value = original ? { ...rest, license_id: original.id, variant: original.name } : { ...rest, license_id: rest.id }
  },
})
const originals = computed(() => frames.value.filter((frame) => frame.id !== model.value.id && !alternateOf(frame, frames.value)))
const unlocks = computed(() => {
  const mine = [...weapons.value.map((item) => ({ kind: 'Weapon', item })), ...systems.value.map((item) => ({ kind: 'System', item })), ...mods.value.map((item) => ({ kind: 'Mod', item }))]
    .filter(({ item }) => item.licenceId === model.value.id)
  return [1, 2, 3].map((level) => ({ level, frame: rank.value === level, items: mine.filter(({ item }) => item.licenceLevel === level) }))
})
const unlockCount = computed(() => unlocks.value.reduce((sum, rung) => sum + rung.items.length + (rung.frame ? 1 : 0), 0))

// The picture the frame shows now: an upload, else COMP/CON's bundled art. The upload goes in the frame's own `image` field
// (a bucket path; the pack's image_url stays as it was and is ignored). Removing it brings the bundled art back.
// shortcut: a replaced or removed upload stays in the bucket; a clean-up would need to know every other frame that uses it.
const art = computed(() => frameArt(toFrame(String(model.value.id ?? ''), model.value), frames.value))
const saveImage = async (path: string | null) => {
  const { image: _image, ...rest } = model.value
  model.value = path ? { ...rest, image: path } : rest
  return null
}

const identitySummary = computed(() => [String(model.value.name ?? ''), source.value, roles.value.join(' / ')].filter(Boolean).join(' · '))
const traitsSummary = computed(() => (traits.value.length ? `${plural(traits.value.length, 'trait')}: ${traits.value.map((trait) => trait.name || 'Unnamed').join(', ')}` : 'No traits yet'))
const coreSummary = computed(() => {
  const parts = [core.value.passive_name || core.value.passive_effect ? '1 passive' : '', core.value.active_name || core.value.active_effect ? '1 power' : ''].filter(Boolean)
  return `${core.value.name || 'Unnamed'}${parts.length ? `: ${parts.join(', ')}` : ''}`
})
const mountsSummary = computed(() => mounts.value.join(', ') || 'No mounts yet')
</script>

<template>
  <FoldPanel title="Identity" open :summary="identitySummary" :paths="['name', 'id', 'source', 'license_level', 'license_id', 'mechtype', 'image']">
    <div class="grid">
      <Field class="span2" label="Name" path="name"><input v-model="name" type="text" autocomplete="off" /></Field>
      <Field
        class="span2"
        label="ID"
        path="id"
        :hint="locked ? 'Fixed once created.' : 'Made from the name.'"
      >
        <input class="code" :value="String(model.id ?? '')" type="text" readonly />
      </Field>
      <ManufacturerField v-model="source" :manufacturers="manufacturers" />
      <Field class="span2" label="Alternate of" path="license_id">
        <select v-model="alternate">
          <option value="">None</option>
          <option v-for="frame in originals" :key="frame.id" :value="frame.id">{{ frame.source }} {{ frame.name }}</option>
        </select>
      </Field>
      <LicenceField v-model="model" />
    </div>
    <Field block label="Mech type" path="mechtype">
      <ToggleChips v-model="roles" :options="defIds('frame_roles')" label="Mech type" />
    </Field>
    <Field block label="Image" path="image">
      <div class="art-edit">
        <MechImage size="editor" :art="art" :art-alt="`${String(model.name ?? 'Frame')} image`" />
        <ImageUpload :path="typeof model.image === 'string' ? model.image : null" :save="saveImage" />
      </div>
    </Field>
    <Field block label="Description" hint="Flavour text.">
      <RichTextEditor label="Frame description" html v-model="description" />
    </Field>
  </FoldPanel>

  <FoldPanel title="Stats" open :paths="['stats']">
    <div class="stats">
      <Field v-for="stat in FRAME_STATS" :key="stat.key" :label="stat.unused ? `${stat.label} (not used)` : stat.label" :path="`stats.${stat.key}`" :class="{ unused: stat.unused }">
        <select v-if="stat.key === 'size'" class="num" :value="String(stats.size ?? 1)" @change="setStat('size', input($event))">
          <option v-for="size in sizes" :key="size.value" :value="size.value">{{ size.label }}</option>
        </select>
        <input v-else class="num" type="number" step="1" :min="stat.key === 'tech_attack' ? undefined : 0" :value="stats[stat.key] ?? ''" @input="setStat(stat.key, input($event))" />
      </Field>
    </div>
  </FoldPanel>

  <FoldPanel title="Weapon mounts" :summary="mountsSummary" :paths="['mounts']">
    <FieldError path="mounts" />
    <ol v-if="mounts.length" class="mounts">
      <li v-for="(mount, index) in mounts" :key="index">
        <select :value="mount" :aria-label="`Mount ${index + 1}`" :aria-invalid="invalid(`mounts.${index}`) || undefined" @change="setMount(index, input($event))">
          <option v-if="!defIds('mount_types').includes(mount)" :value="mount">{{ mount ? defLabel('mount_types', mount) : 'Choose…' }}</option>
          <option v-for="option in defList('mount_types')" :key="option.id" :value="option.id">{{ option.label }}</option>
        </select>
        <span class="dim mount-hint">{{ mountHint(mount) ?? '' }}</span>
        <span class="tools">
          <button type="button" class="icon-btn" :disabled="index === 0" :aria-label="`Move mount ${index + 1} up`" @click="moveMount(index, -1)"><Icon name="chevron-up" /></button>
          <button type="button" class="icon-btn" :disabled="index === mounts.length - 1" :aria-label="`Move mount ${index + 1} down`" @click="moveMount(index, 1)"><Icon name="chevron-down" /></button>
          <button type="button" class="icon-btn remove" :aria-label="`Remove mount ${index + 1}`" @click="mounts = mounts.filter((_, i) => i !== index)"><Icon name="close" /></button>
        </span>
        <FieldError :path="`mounts.${index}`" />
      </li>
    </ol>
    <div><button type="button" class="small" @click="mounts = [...mounts, 'Main']"><Icon name="plus" />Add mount</button></div>
  </FoldPanel>

  <FoldPanel title="Traits" :summary="traitsSummary" :paths="['traits']">
    <RepeatList v-model="traits" noun="trait" path="traits" :make="() => ({ name: '', description: '' })">
      <template #title="{ item, index }">Trait {{ index + 1 }}<span v-if="item.name" class="dim"> · {{ item.name }}</span></template>
      <template #summary="{ item }">{{ [item.use, list(item.actions).length ? plural(list(item.actions).length, 'action') : ''].filter(Boolean).join(' · ') }}</template>
      <template #default="{ item, index, change }">
        <div class="pair">
          <Field label="Name" :path="`traits.${index}.name`">
            <input type="text" :value="item.name" autocomplete="off" @input="change({ name: input($event) })" />
          </Field>
          <Field label="Use limit" >
            <select :value="String(item.use ?? '')" @change="change({ use: input($event) || undefined })">
              <option value="">None</option>
              <option v-if="item.use && !defIds('uses').includes(String(item.use))" :value="item.use">{{ defLabel('uses', String(item.use)) }}</option>
              <option v-for="use in defList('uses')" :key="use.id" :value="use.id">{{ use.label }}</option>
            </select>
          </Field>
        </div>
        <Field block label="Rules text">
          <RichTextEditor :label="`Trait ${index + 1} rules text`" html :model-value="String(item.description ?? '')" @update:model-value="change({ description: $event })" />
        </Field>
        <Field block label="Actions">
          <ActionListField :model-value="list<Data>(item.actions)" :path="`traits.${index}.actions`" @update:model-value="change({ actions: clean($event) })" />
        </Field>
        <Field block label="Effects">
          <BonusListField :model-value="list<Data>(item.bonuses)" :types="mechBonuses" :path="`traits.${index}.bonuses`" @update:model-value="change({ bonuses: clean($event) })" />
        </Field>
        <GrantFields :data="item" :owner="`Trait ${index + 1}`" :path="`traits.${index}`" @change="change($event)" />
        <Field block label="Deployables">
          <DeployableListField :model-value="list<Data>(item.deployables)" :path="`traits.${index}.deployables`" @update:model-value="change({ deployables: clean($event) })" />
        </Field>
      </template>
    </RepeatList>
  </FoldPanel>

  <FoldPanel title="Core system" :summary="coreSummary" :paths="['core_system']">
    <CoreSystemFields :model-value="core" :bonus-types="mechBonuses" @update:model-value="model = { ...model, core_system: $event }" />
  </FoldPanel>

  <FoldPanel title="Core power checks" :summary="checksSummary" :paths="['core_system.check_bonuses']">
    <FieldError path="core_system.check_bonuses" />
    <ul v-if="checks.length" class="checks">
      <li v-for="(row, index) in checks" :key="index">
        <select :value="String(row.id)" :aria-label="`Check ${index + 1}`" :aria-invalid="invalid(`core_system.check_bonuses.${index}.id`) || undefined" @change="changeCheck(index, { id: input($event) })">
          <option v-if="!CHECKS.some(([id]) => id === row.id)" :value="row.id">{{ row.id }}</option>
          <option v-for="[id, label] in CHECKS" :key="id" :value="id">{{ label }}</option>
        </select>
        <select :value="String(row.accuracy ?? '')" :aria-label="`Check ${index + 1} accuracy`" :aria-invalid="invalid(`core_system.check_bonuses.${index}.accuracy`) || undefined" @change="changeCheck(index, { accuracy: Number(input($event)) })">
          <option v-if="row.accuracy === undefined" value="">Choose…</option>
          <option value="1">+1 accuracy</option>
          <option value="-1">-1 accuracy</option>
        </select>
        <button type="button" class="icon-btn remove" :aria-label="`Remove check ${index + 1}`" @click="setChecks(checks.filter((_, i) => i !== index))"><Icon name="close" /></button>
        <FieldError :path="`core_system.check_bonuses.${index}`" deep />
      </li>
    </ul>
    <div><button type="button" class="small" @click="setChecks([...checks, { id: 'hull', accuracy: 1, val: 0 }])"><Icon name="plus" />Add check</button></div>
  </FoldPanel>

  <FoldPanel title="Licence unlocks" :summary="unlockCount ? plural(unlockCount, 'item') : 'No unlocks'">
    <ul class="ranks">
      <li v-for="rung in unlocks" :key="rung.level">
        <b class="label">Rank {{ roman(rung.level) }}</b>
        <ul v-if="rung.frame || rung.items.length" class="unlock">
          <li v-if="rung.frame"><span class="dim kind">Frame</span>{{ String(model.name || 'This frame') }}</li>
          <li v-for="{ kind, item } in rung.items" :key="item.id"><span class="dim kind">{{ kind }}</span><InfoButton :label="item.name" :info="() => itemInfo(item)" /></li>
        </ul>
        <p v-else class="dim">No unlocks.</p>
      </li>
    </ul>
  </FoldPanel>

  <FoldPanel title="Requirements" :summary="plural(requires.length, 'requirement')" :paths="['requires']">
    <RequirementListField v-model="requires" />
  </FoldPanel>
</template>

<style scoped>
.stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(7.5rem, 1fr)); gap: var(--space-m); }
.unused { opacity: 0.7; }
.art-edit { display: grid; justify-items: start; gap: var(--space-s); }
.art-edit p { margin: 0; }
.pair { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: var(--space-m); }
.mounts { display: grid; gap: var(--space-s); margin: 0; padding: 0; list-style: none; }
.mounts li { display: grid; grid-template-columns: minmax(8rem, 12rem) minmax(0, 1fr) auto; gap: var(--space-s) var(--space-m); align-items: center; }
.mounts li > :last-child:not(.tools) { grid-column: 1 / -1; }
.mount-hint { font-size: var(--fs-s); }
.tools { display: flex; }
.checks { display: grid; gap: var(--space-s); margin: 0; padding: 0; list-style: none; }
.checks li { display: grid; grid-template-columns: minmax(0, 12rem) minmax(0, 10rem) auto; gap: var(--space-s); align-items: center; }
.checks li > :last-child:not(.icon-btn) { grid-column: 1 / -1; }
.ranks { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: var(--space-m); margin: 0; padding: 0; list-style: none; }
.ranks > li { display: grid; align-content: start; gap: var(--space-xs); }
.ranks p { margin: 0; }
.unlock { display: grid; gap: var(--space-xs); margin: 0; padding: 0; list-style: none; }
.kind { display: inline-block; min-width: 4.5em; font-size: var(--fs-xs); font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
@media (max-width: 40rem) {
  .mounts li { grid-template-columns: minmax(0, 1fr) auto; }
  .mount-hint { grid-column: 1 / -1; grid-row: 2; }
}
</style>
