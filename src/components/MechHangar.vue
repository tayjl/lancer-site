<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter, type RouteLocationRaw } from 'vue-router'
import { makerColour, makerLogo, useManufacturers } from '../archive'
import { imageUrl } from '../images'
import { useMechData } from '../mechData'
import { mechProblem } from '../myPilot'
import type { PublicMech } from '../pilots'
import Icon from './Icon.vue'

// The pilot sheet's mechs tab: a card per mech (opening its page), and, while editable, a small form for a new one.
// "frameId" is a mech's frame (private, so none for viewers without the sheet); "save" stores the new list of mechs
// and resolves to an error message, or null.
const props = defineProps<{
  mechs: PublicMech[]
  editable: boolean
  link: (mechId: string) => RouteLocationRaw
  frameId: (mechId: string) => string | undefined
  save: (mechs: PublicMech[]) => Promise<string | null>
}>()
const router = useRouter()
const { frames } = useMechData()

// Hangar cards show their frame's manufacturer as its logo and a thin top border, nothing more. Frames are private:
// without the sheet there's no frame, so other players' view of the card stays neutral.
const manufacturers = useManufacturers()
const frameOf = (mechId: string) => frames.value.find((f) => f.id === props.frameId(mechId))
const makerOf = (mechId: string) => manufacturers.value.find((m) => m.id === frameOf(mechId)?.source)

// A new mech starts with just a name and manufacturer id, then opens its own page.
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
  mechError.value = (await props.save([...props.mechs, mech])) ?? ''
  if (!mechError.value) router.push(props.link(mech.id))
}
</script>

<template>
  <section class="panel">
    <header class="sheet-head hangar-head">
      <h2 class="sheet-label">Mech hangar</h2>
      <button v-if="editable && !addingMech" type="button" class="small" @click="openNewMech"><Icon name="plus" />New mech</button>
    </header>
    <ul v-if="mechs.length" class="hangar">
      <li v-for="mech in mechs" :key="mech.id">
        <RouterLink :to="link(mech.id)" class="mech-card" :style="makerOf(mech.id) ? { '--mf': makerColour(makerOf(mech.id)) } : undefined">
          <span class="mech-thumb">
            <img v-if="imageUrl(mech.image)" :src="imageUrl(mech.image)!" :alt="`Image of ${mech.name}`" />
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
        <span>Mech name</span>
        <input v-model="newMech.name" type="text" required />
      </label>
      <label class="field">
        <span>Manufacturer ID</span>
        <input v-model="newMech.manufacturerId" type="text" placeholder="XXXX-XXXX-XXXX" required />
      </label>
      <p v-if="mechError" class="notice warn" role="alert">{{ mechError }}</p>
      <div class="actions">
        <button type="submit" class="primary">Create mech</button>
        <button type="button" @click="addingMech = false">Cancel</button>
      </div>
    </form>
    <p v-else-if="!mechs.length" class="empty">{{ editable ? 'No mechs yet.' : 'No mechs.' }}</p>
  </section>
</template>

<style scoped>
/* A card per mech, a showcase, so centred: the cards as a group, and the picture, name, frame and class within each.
   Its maker only as the logo and a thin top border (--mf). */
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
</style>
