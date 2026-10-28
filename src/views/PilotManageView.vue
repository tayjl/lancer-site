<script setup lang="ts">
import { computed, reactive, ref, shallowRef } from 'vue'
import { session } from '../auth'
import AddBox from '../components/AddBox.vue'
import GlitchText from '../components/GlitchText.vue'
import Portrait from '../components/Portrait.vue'
import RichText from '../components/RichText.vue'
import RichTextEditor from '../components/RichTextEditor.vue'
import type { Json, Tables, TablesUpdate } from '../lib/database.types'
import { supabase } from '../lib/supabaseClient'
import type { PublicMech } from '../pilots'

// pilot_management: your own pilot, as a page of modular sections. There's no separate sign-up form:
// with no pilot yet the page is empty, and saving the identity section for the first time creates
// your pending pilot. While a pilot is pending, the database lets you edit it directly; once it's
// approved, changes have to go through pending paperwork (not built yet).

type Character = Tables<'characters'>
type Paragraph = 'appearance' | 'personality' | 'traits' | 'backstory'

// Short fields: one-line inputs. [column, label]
const IDENTITY = [
  ['callsign', 'callsign'],
  ['pilot_name', 'name'],
  ['age', 'age'],
  ['gender', 'gender'],
  ['sexuality', 'sexuality'],
  ['height', 'height'],
  ['weight', 'weight'],
  ['eye_colour', 'eyes'],
  ['hair_colour', 'hair'],
] as const
type IdentityField = (typeof IDENTITY)[number][0]

// Paragraph fields: formatted text. Backstory is private, so it lives in the sheet, not the public card.
const PARAGRAPHS: { key: Paragraph; label: string; private?: true }[] = [
  { key: 'appearance', label: 'appearance' },
  { key: 'personality', label: 'personality' },
  { key: 'traits', label: 'traits' },
  { key: 'backstory', label: 'backstory', private: true },
]

// Sections that need LANCER data or undecided rules: shown, but their [ + ] is offline for now.
const OFFLINE_SECTIONS = ['pilot stats', 'licences', 'talents', 'core bonuses', 'pilot gear', 'bionics']

const MANUFACTURER_ID = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/

// Shallow, like the drafts: these are replaced as a whole on every reload.
const character = shallowRef<Character | null>(null)
const sheet = shallowRef<{ [key: string]: Json | undefined }>({})
const loading = ref(true)
// The one section being edited: 'identity', a paragraph key, 'mech-new' or 'mech:<id>'.
const editing = ref<string | null>(null)
const saving = ref(false)
const error = ref('')

const identityDraft = reactive(Object.fromEntries(IDENTITY.map(([key]) => [key, ''])) as Record<IdentityField, string>)
// Shallow: the document is always replaced as a whole, so Vue doesn't need to track inside it.
const docDraft = shallowRef<Json | null>(null)
const mechDraft = reactive({ id: '', name: '', manufacturer_id: '' })
const mechAppearance = shallowRef<Json | null>(null)

const canEdit = computed(() => !character.value || character.value.status === 'pending')
// The mechs column is plain JSON to the database; we always save it in the PublicMech shape.
const mechs = computed(() => (character.value?.mechs ?? []) as unknown as PublicMech[])
const facts = computed(() =>
  IDENTITY.filter(([key]) => key !== 'callsign' && character.value?.[key]).map(([key, label]) => ({
    label,
    value: character.value![key],
  })),
)

async function load() {
  const { data, error: loadError } = await supabase
    .from('characters')
    .select('*')
    .eq('player_id', session.value!.user.id)
    .in('status', ['pending', 'approved'])
    .order('created_at')
    .limit(1)
    .maybeSingle()
  if (loadError) error.value = loadError.message
  character.value = data
  if (data) {
    const { data: sheetRow } = await supabase.from('character_sheets').select('sheet').eq('character_id', data.id).maybeSingle()
    sheet.value = (sheetRow?.sheet ?? {}) as typeof sheet.value
  }
  loading.value = false
}
load()

function open(section: string) {
  error.value = ''
  editing.value = section
}

function openIdentity() {
  for (const [key] of IDENTITY) identityDraft[key] = character.value?.[key] ?? ''
  open('identity')
}

function paragraphValue(key: Paragraph): Json | null {
  return (key === 'backstory' ? sheet.value.backstory : character.value?.[key]) ?? null
}

function openParagraph(key: Paragraph) {
  docDraft.value = paragraphValue(key)
  open(key)
}

function openMech(mech?: PublicMech) {
  Object.assign(mechDraft, { id: mech?.id ?? '', name: mech?.name ?? '', manufacturer_id: mech?.manufacturer_id ?? '' })
  mechAppearance.value = mech?.appearance ?? null
  open(mech ? `mech:${mech.id}` : 'mech-new')
}

function cancel() {
  editing.value = null
  error.value = ''
}

// Runs a save, shows any error, and reloads the pilot when it worked.
async function save(action: () => PromiseLike<{ error: { message: string } | null }>) {
  saving.value = true
  error.value = ''
  const { error: saveError } = await action()
  saving.value = false
  if (saveError) {
    error.value = saveError.message
    return
  }
  editing.value = null
  await load()
}

function saveIdentity() {
  const value = (key: IdentityField) => identityDraft[key].trim() || null
  const pilotName = identityDraft.pilot_name.trim()
  if (!pilotName) {
    error.value = 'a pilot needs a name.'
    return
  }
  const fields = {
    callsign: value('callsign'),
    pilot_name: pilotName,
    age: value('age'),
    gender: value('gender'),
    sexuality: value('sexuality'),
    height: value('height'),
    weight: value('weight'),
    eye_colour: value('eye_colour'),
    hair_colour: value('hair_colour'),
  }
  return save(async () => {
    if (character.value) return supabase.from('characters').update(fields).eq('id', character.value.id)
    // First save: create the pending pilot, then its (empty) private sheet.
    const { data, error: insertError } = await supabase
      .from('characters')
      .insert({ ...fields, player_id: session.value!.user.id })
      .select('id')
      .single()
    if (insertError) return { error: insertError }
    return supabase.from('character_sheets').insert({ character_id: data.id, sheet: {} })
  })
}

function saveParagraph(key: Paragraph) {
  const id = character.value!.id
  if (key === 'backstory') {
    // Upsert, so this also works if the sheet row was never created.
    return save(() => supabase.from('character_sheets').upsert({ character_id: id, sheet: { ...sheet.value, backstory: docDraft.value } }))
  }
  const changes: TablesUpdate<'characters'> = {}
  changes[key] = docDraft.value
  return save(() => supabase.from('characters').update(changes).eq('id', id))
}

function saveMechs(list: PublicMech[]) {
  return save(() => supabase.from('characters').update({ mechs: list }).eq('id', character.value!.id))
}

function saveMech() {
  const name = mechDraft.name.trim()
  const manufacturerId = mechDraft.manufacturer_id.trim().toUpperCase()
  if (!name) {
    error.value = 'a mech needs a name.'
    return
  }
  if (!MANUFACTURER_ID.test(manufacturerId)) {
    error.value = 'the manufacturer id should look like XXXX-XXXX-XXXX (letters and digits).'
    return
  }
  // shortcut: duplicate manufacturer ids aren't checked yet. Warn about them once the registry reads real pilots.
  const mech: PublicMech = {
    id: mechDraft.id || crypto.randomUUID(),
    name,
    manufacturer_id: manufacturerId,
    appearance: mechAppearance.value,
    image: null,
  }
  return saveMechs(mechDraft.id ? mechs.value.map((m) => (m.id === mech.id ? mech : m)) : [...mechs.value, mech])
}

function removeMech(mech: PublicMech) {
  if (window.confirm(`remove ${mech.name}? this can't be undone.`)) saveMechs(mechs.value.filter((m) => m.id !== mech.id))
}

const editingMech = computed(() => editing.value === 'mech-new' || editing.value?.startsWith('mech:'))
const needsIdentity = computed(() => (character.value ? undefined : 'file your identity first'))
</script>

<template>
  <main class="page">
    <h1><span class="prompt" aria-hidden="true">&gt; </span><GlitchText text="pilot_management" /></h1>

    <p v-if="loading" class="dim">loading pilot record...</p>

    <template v-else>
      <p v-if="!character" class="status">no pilot on file. fill in your identity to register one.</p>
      <p v-else-if="character.status === 'pending'" class="status">
        status: <span class="lilac">[pending]</span> waiting on a gm. you can keep editing until then.
      </p>
      <p v-else class="status">
        status: <span class="lilac">[approved]</span> changes to an approved pilot go through pending paperwork (module
        offline).
      </p>

      <!-- Identity: portrait and the short fields. -->
      <section class="module">
        <header>
          <h2>identity</h2>
          <button v-if="character && canEdit && editing !== 'identity'" type="button" @click="openIdentity">edit</button>
        </header>

        <form v-if="editing === 'identity'" class="edit-form" @submit.prevent="saveIdentity">
          <div class="fields">
            <label v-for="[key, label] in IDENTITY" :key="key">
              <span class="dim">{{ label }}<template v-if="key === 'pilot_name'"> (required)</template></span>
              <input v-model="identityDraft[key]" type="text" :required="key === 'pilot_name'" />
            </label>
          </div>
          <p v-if="error" class="rose" role="alert">{{ error }}</p>
          <div class="actions">
            <button type="submit" :disabled="saving">{{ character ? 'save' : 'register pilot' }}</button>
            <button v-if="character" type="button" @click="cancel">cancel</button>
          </div>
        </form>

        <div v-else-if="character" class="identity">
          <Portrait :src="character.pilot_image" :alt="`Portrait of ${character.callsign ?? character.pilot_name}`" />
          <div>
            <p class="callsign">{{ character.callsign ?? character.pilot_name }}</p>
            <dl class="facts">
              <template v-for="fact in facts" :key="fact.label">
                <dt>{{ fact.label }}</dt>
                <dd>{{ fact.value }}</dd>
              </template>
            </dl>
            <p class="dim small">image upload: module offline</p>
          </div>
        </div>

        <AddBox v-else label="register your pilot" @click="openIdentity" />
      </section>

      <!-- Paragraphs: formatted text. -->
      <section v-for="paragraph in PARAGRAPHS" :key="paragraph.key" class="module">
        <header>
          <h2>
            {{ paragraph.label }}
            <span v-if="paragraph.private" class="dim small">private: only you and gms</span>
          </h2>
          <button
            v-if="canEdit && paragraphValue(paragraph.key) && editing !== paragraph.key"
            type="button"
            @click="openParagraph(paragraph.key)"
          >
            edit
          </button>
        </header>

        <form v-if="editing === paragraph.key" class="edit-form" @submit.prevent="saveParagraph(paragraph.key)">
          <RichTextEditor v-model="docDraft" :label="paragraph.label" />
          <p v-if="error" class="rose" role="alert">{{ error }}</p>
          <div class="actions">
            <button type="submit" :disabled="saving">save</button>
            <button type="button" @click="cancel">cancel</button>
          </div>
        </form>
        <RichText v-else-if="paragraphValue(paragraph.key)" :doc="paragraphValue(paragraph.key)" />
        <AddBox
          v-else-if="canEdit"
          :label="`write ${paragraph.label}`"
          :hint="needsIdentity"
          @click="openParagraph(paragraph.key)"
        />
        <p v-else class="dim">nothing on file.</p>
      </section>

      <!-- Mechs: added and edited with a small form. -->
      <section class="module">
        <header><h2>mechs</h2></header>

        <div v-for="mech in mechs" :key="mech.id" class="mech">
          <template v-if="editing !== `mech:${mech.id}`">
            <Portrait :src="mech.image" :alt="`Image of ${mech.name}`" />
            <div>
              <p class="mech-name">{{ mech.name }}</p>
              <p class="dim">{{ mech.manufacturer_id }}</p>
              <RichText v-if="mech.appearance" :doc="mech.appearance" class="mech-appearance" />
              <div v-if="canEdit && !editingMech" class="actions">
                <button type="button" @click="openMech(mech)">edit</button>
                <button type="button" @click="removeMech(mech)">remove</button>
              </div>
            </div>
          </template>
        </div>

        <form v-if="editingMech" class="edit-form" @submit.prevent="saveMech">
          <div class="fields">
            <label>
              <span class="dim">mech name (required)</span>
              <input v-model="mechDraft.name" type="text" required />
            </label>
            <label>
              <span class="dim">manufacturer id (XXXX-XXXX-XXXX)</span>
              <input v-model="mechDraft.manufacturer_id" type="text" required />
            </label>
          </div>
          <span class="dim small">appearance</span>
          <RichTextEditor v-model="mechAppearance" label="mech appearance" />
          <p v-if="error" class="rose" role="alert">{{ error }}</p>
          <div class="actions">
            <button type="submit" :disabled="saving">{{ mechDraft.id ? 'save mech' : 'add mech' }}</button>
            <button type="button" @click="cancel">cancel</button>
          </div>
        </form>
        <AddBox v-else-if="canEdit" label="add a mech" :hint="needsIdentity" @click="openMech()" />
      </section>

      <!-- Everything that needs the LANCER content packs or undecided rules. -->
      <div class="offline-grid">
        <section v-for="title in OFFLINE_SECTIONS" :key="title" class="module">
          <header><h2>{{ title }}</h2></header>
          <AddBox :label="`add ${title}`" offline />
        </section>
      </div>
    </template>
  </main>
</template>

<style scoped>
.page {
  max-width: 52rem;
}

.status {
  margin-bottom: 2rem;
}

.module {
  margin-bottom: 2.25rem;
}

.module header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.6rem;
  padding-bottom: 0.4rem;
  border-bottom: 1px solid var(--rule);
}

.module h2 {
  margin: 0;
  color: var(--text-dim);
  font-size: 0.875rem;
  font-weight: 400;
}

.module header button {
  padding: 0;
  font-size: 0.875rem;
}

.small {
  font-size: 0.75rem;
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.fields {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
  gap: 0.75rem 1rem;
}

.fields label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.8125rem;
}

.edit-form p {
  margin: 0;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
}

.actions button {
  padding-inline: 0;
  font-size: 0.875rem;
}

.identity,
.mech {
  display: grid;
  grid-template-columns: 8rem minmax(0, 1fr);
  gap: 1.25rem;
  align-items: start;
}

.mech {
  margin-bottom: 1.25rem;
}

.mech:empty {
  display: none;
}

.callsign,
.mech-name {
  margin: 0 0 0.5rem;
  color: var(--lilac);
  font-weight: 600;
}

.mech-name {
  margin-bottom: 0;
}

.mech p {
  margin: 0;
}

.mech-appearance {
  margin: 0.5rem 0;
}

.facts {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.2rem 1.25rem;
  margin: 0 0 0.75rem;
}

.facts dt {
  color: var(--text-dim);
}

.facts dd {
  margin: 0;
}

.offline-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(13rem, 1fr));
  gap: 0 1.25rem;
}

@media (max-width: 30rem) {
  .identity,
  .mech {
    grid-template-columns: 5.5rem minmax(0, 1fr);
    gap: 1rem;
  }
}
</style>
