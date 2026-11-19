<script setup lang="ts">
import { computed } from 'vue'
import { WEAPON_MOUNTS, WEAPON_TYPES, lockedTags, setProfiles, splitProfiles, type BonusType, type Data } from '../../contentEditor'
import RichTextEditor from '../RichTextEditor.vue'
import ActionListField from './ActionListField.vue'
import BonusListField from './BonusListField.vue'
import ChoiceField from './ChoiceField.vue'
import DamageField from './DamageField.vue'
import DeployableListField from './DeployableListField.vue'
import Field from './Field.vue'
import ItemBasics from './ItemBasics.vue'
import RepeatList from './RepeatList.vue'
import TagListField from './TagListField.vue'
import { latest, useFields } from './useFields'

// The form for a mech weapon. A weapon has one set of range, damage and rules, or several "profiles" (modes the pilot
// chooses between, each with its own range and damage and optionally its own tags, rules and actions). With profiles
// the weapon's own tags, rules text and actions are shared: a profile's own replace them while it's in use
// (src/equipment.ts selectWeaponProfile). Fields with no input here (skirmish, no_mods, and so on) stay as they are.
const modelProp = defineModel<Data>({ required: true })
const model = latest(modelProp)
defineProps<{ tags: { id: string; name: string }[]; bonusTypes: BonusType[]; locked: boolean; manufacturers: { id: string; name: string }[]; licences: { id: string; name: string; source: string }[] }>()
type Entry = { type: string; val: string | number }
type TagEntry = { id: string; val?: string | number }
const f = useFields(model)
const mount = f.text('mount')
const type = f.text('type')
const effect = f.text('effect')
const onAttack = f.text('on_attack')
const onHit = f.text('on_hit')
const onCrit = f.text('on_crit')
const description = f.text('description')
const range = f.list<Entry>('range')
const damage = f.list<Entry>('damage')
const tagList = f.list<TagEntry>('tags')
const bonuses = f.list<Data>('bonuses')
const actions = f.list<Data>('actions')
const deployables = f.list<Data>('deployables')
const profiles = f.list<Data>('profiles')

const mounts = computed(() => (WEAPON_MOUNTS.includes(mount.value) || !mount.value ? WEAPON_MOUNTS : [...WEAPON_MOUNTS, mount.value]).map((value) => ({ value, label: value })))
const types = computed(() => (WEAPON_TYPES.includes(type.value) || !type.value ? WEAPON_TYPES : [...WEAPON_TYPES, type.value]))

// A profile's own tags, rules and actions are left out while empty, so the weapon's own apply.
const clean = <T,>(value: T[]) => (value.length ? value : undefined)
const text = (value: unknown) => (value as string) || undefined
const listOf = <T,>(value: unknown) => (Array.isArray(value) ? (value as T[]) : [])
const input = (event: Event) => (event.target as HTMLInputElement).value
const numbers = (entries: Entry[]) => entries.map((entry) => `${entry.type} ${entry.val}`).join(', ')
const summary = (profile: Data) => [numbers(listOf<Entry>(profile.range)), numbers(listOf<Entry>(profile.damage))].filter(Boolean).join(' · ')
</script>

<template>
  <ItemBasics v-model="model" id-prefix="weapon" :locked="locked" :manufacturers="manufacturers" :licences="licences">
    <Field block class="span2" label="Mount size" path="mount">
      <ChoiceField v-model="mount" label="Mount size" :options="mounts" />
    </Field>
    <Field label="Weapon type" path="type">
      <select v-model="type">
        <option value="" disabled>Choose…</option>
        <option v-for="option in types" :key="option" :value="option">{{ option }}</option>
      </select>
    </Field>
  </ItemBasics>

  <section v-if="!profiles.length" class="panel" aria-labelledby="weapon-numbers">
    <h3 id="weapon-numbers" class="sheet-label">Range and damage</h3>
    <Field block label="Range"><DamageField v-model="range" kind="range" /></Field>
    <Field block label="Damage" hint="A number or dice, like 1d6+2.">
      <DamageField v-model="damage" kind="damage" />
    </Field>
    <div class="profiles-note">
      <p class="hint">One set of numbers. Split into profiles for modes.</p>
      <button type="button" class="small" @click="model = splitProfiles(model)">Split into profiles</button>
    </div>
  </section>

  <section v-else class="panel" aria-labelledby="weapon-profiles">
    <h3 id="weapon-profiles" class="sheet-label">Profiles</h3>
    <p class="hint">The pilot picks one profile.</p>
    <RepeatList :model-value="profiles" noun="profile" path="profiles" :make="() => ({ name: `Mode ${profiles.length + 1}`, range: [], damage: [] })" @update:model-value="model = setProfiles(model, $event)">
      <template #title="{ item, index }">Profile {{ index + 1 }}<span v-if="item.name" class="dim"> · {{ item.name }}</span></template>
      <template #summary="{ item }">{{ summary(item) }}</template>
      <template #default="{ item, index, change }">
        <Field label="Profile name" :path="`profiles.${index}.name`">
          <input type="text" :value="item.name" autocomplete="off" @input="change({ name: input($event) })" />
        </Field>
        <Field block label="Range">
          <DamageField :model-value="listOf<Entry>(item.range)" kind="range" :path="`profiles.${index}.range`" @update:model-value="change({ range: $event })" />
        </Field>
        <Field block label="Damage">
          <DamageField :model-value="listOf<Entry>(item.damage)" kind="damage" :path="`profiles.${index}.damage`" @update:model-value="change({ damage: $event })" />
        </Field>
        <Field block label="Tags" hint="Empty uses the weapon's tags.">
          <TagListField :model-value="listOf<TagEntry>(item.tags)" :tags="tags" :path="`profiles.${index}.tags`" @update:model-value="change({ tags: clean($event) })" />
        </Field>
        <Field block label="Rules text" hint="Empty uses the weapon's rules text.">
          <RichTextEditor :label="`Profile ${index + 1} rules text`" html basic :model-value="String(item.effect ?? '')" @update:model-value="change({ effect: text($event) })" />
        </Field>
        <Field block label="On attack">
          <RichTextEditor :label="`Profile ${index + 1} on attack`" html basic :model-value="String(item.on_attack ?? '')" @update:model-value="change({ on_attack: text($event) })" />
        </Field>
        <Field block label="On hit">
          <RichTextEditor :label="`Profile ${index + 1} on hit`" html basic :model-value="String(item.on_hit ?? '')" @update:model-value="change({ on_hit: text($event) })" />
        </Field>
        <Field block label="On critical hit">
          <RichTextEditor :label="`Profile ${index + 1} on critical hit`" html basic :model-value="String(item.on_crit ?? '')" @update:model-value="change({ on_crit: text($event) })" />
        </Field>
        <Field block label="Actions" hint="Empty uses the weapon's actions.">
          <ActionListField :model-value="listOf<Data>(item.actions)" :path="`profiles.${index}.actions`" @update:model-value="change({ actions: clean($event) })" />
        </Field>
      </template>
    </RepeatList>
  </section>

  <section class="panel" aria-labelledby="weapon-actions">
    <h3 id="weapon-actions" class="sheet-label">Actions</h3>
    <ActionListField v-model="actions" />
  </section>

  <section class="panel" aria-labelledby="weapon-deployables">
    <h3 id="weapon-deployables" class="sheet-label">Deployables</h3>
    <DeployableListField v-model="deployables" />
  </section>

  <section class="panel" aria-labelledby="weapon-tags">
    <h3 id="weapon-tags" class="sheet-label">Tags</h3>
    <TagListField v-model="tagList" :tags="tags" :locked="lockedTags(model)" />
  </section>

  <section class="panel" aria-labelledby="weapon-bonuses">
    <h3 id="weapon-bonuses" class="sheet-label">Bonuses when equipped</h3>
    <BonusListField v-model="bonuses" :types="bonusTypes" />
  </section>

  <section class="panel" aria-labelledby="weapon-text">
    <h3 id="weapon-text" class="sheet-label">Text</h3>
    <Field block label="Rules text"><RichTextEditor label="Rules text" html basic v-model="effect" /></Field>
    <template v-if="!profiles.length">
      <Field block label="On attack"><RichTextEditor label="On attack" html basic v-model="onAttack" /></Field>
      <Field block label="On hit"><RichTextEditor label="On hit" html basic v-model="onHit" /></Field>
      <Field block label="On critical hit"><RichTextEditor label="On critical hit" html basic v-model="onCrit" /></Field>
    </template>
    <Field label="Lore" hint="Flavour text.">
      <textarea v-model="description" rows="3"></textarea>
    </Field>
  </section>
</template>

<style scoped>
.profiles-note { display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-s) var(--space-m); }
.profiles-note .hint { flex: 1 1 18rem; margin: 0; }
</style>
