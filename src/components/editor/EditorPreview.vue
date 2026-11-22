<script setup lang="ts">
import { computed, ref } from 'vue'
import { makerLogo, toManufacturer, useManufacturers } from '../../archive'
import type { Data, EditorKind } from '../../contentEditor'
import { toCoreBonus, toItem, toMod, toTalent, type Bionic } from '../../gameData'
import { bionicInfo, coreBonusInfo, frameInfo, itemInfo, manufacturerInfo, talentInfo, type Info } from '../../info'
import { toFrame, useMechData } from '../../mechData'
import ActionChip from '../ActionChip.vue'
import Icon from '../Icon.vue'
import InfoBody from '../InfoBody.vue'
import ItemCard from '../ItemCard.vue'
import ItemDetails from '../ItemDetails.vue'
import RulesText from '../RulesText.vue'
import SheetTabs from '../SheetTabs.vue'

// The live preview beside the form: what players will see, built with the same code as the rest of the site from the
// data on screen (not yet saved). "Item card" (weapons, systems, mods, pilot gear and core bonuses) is the card as it
// sits on a sheet; "Full information" is the dialog's contents (also the archives' pane). An edited import also has
// "Original": the pack's own version, so the change can be compared.
const props = defineProps<{ kind: EditorKind; id: string; data: Data; original: Data | null; stats: { id: string; name: string }[] }>()
const { frames } = useMechData()
const manufacturers = useManufacturers()

type Built = { info: Info; item?: ReturnType<typeof toItem>; bonus?: ReturnType<typeof toCoreBonus> } | { error: string }
function build(data: Data): Built {
  try {
    const { kind, id } = props
    if (kind === 'weapons' || kind === 'systems' || kind === 'pilot_gear') { const item = toItem(id, data); return { info: itemInfo(item), item } }
    if (kind === 'mods') { const item = toMod(id, data); return { info: itemInfo(item), item } }
    if (kind === 'frames') return { info: frameInfo(toFrame(id, data), frames.value) }
    if (kind === 'talents') return { info: talentInfo(toTalent(id, data)) }
    if (kind === 'core_bonuses') { const bonus = toCoreBonus(id, data); return { info: coreBonusInfo(bonus), bonus } }
    if (kind === 'manufacturers') return { info: manufacturerInfo(toManufacturer(id, data), frames.value) }
    if (kind === 'tags') return { info: { kind: 'Tag', name: String(data.name ?? id), facts: [], stats: [], groups: [{ title: 'Meaning', cards: [{ heading: 'Meaning', html: String(data.description ?? '') }] }] } }
    if (kind === 'actions') return { info: { kind: 'Action', name: String(data.name ?? id), facts: data.frequency ? [{ text: String(data.frequency) }] : [], stats: [], groups: data.detail ? [{ title: 'Rules', cards: [{ heading: 'Rules text', html: String(data.detail) }] }] : [] } }
    if (kind === 'bionics') {
      const bionic: Bionic = { id: 0, name: String(data.name ?? ''), description: String(data.description ?? ''), slot: String(data.slot ?? ''), source: String(data.source ?? '') || null, effect: String(data.effect ?? ''), manna_cost: Number(data.manna_cost) || 0, mod_point_cost: Number(data.mod_point_cost) || 0, retired: data.retired === true, bonuses: Array.isArray(data.bonuses) ? (data.bonuses as Bionic['bonuses']) : [] }
      return { info: bionicInfo(bionic, new Map(props.stats.map((stat) => [stat.id, stat.name]))) }
    }
    return { error: 'No preview for this kind.' }
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Unreadable data' }
  }
}

const now = computed(() => build(props.data))
const was = computed(() => (props.original ? build(props.original) : null))
const maker = computed(() => manufacturers.value.find((m) => 'info' in now.value && m.id === now.value.info.source))
// The manufacturer's own colour (a manufacturer's is the one being typed) for the border and logo, when it's a plain hex colour.
// Never the site's lilac, which means "clickable".
const accent = computed(() => {
  const colour = props.kind === 'manufacturers' ? String(props.data.dark ?? '') : maker.value?.colour
  return colour && /^#[0-9a-f]{3,8}$/i.test(colour) ? colour : undefined
})
const logo = computed(() => makerLogo(props.kind === 'manufacturers' ? toManufacturer(props.id, props.data) : maker.value))
const hasCard = computed(() => 'item' in now.value && !!now.value.item || 'bonus' in now.value && !!now.value.bonus)
const tabs = computed(() => [...(hasCard.value ? ['Item card'] : []), 'Full information', ...(was.value ? ['Original'] : [])])
const chosen = ref('')
const view = computed({ get: () => (tabs.value.includes(chosen.value) ? chosen.value : tabs.value[0]), set: (tab) => (chosen.value = tab) })
</script>

<template>
  <section class="preview" aria-label="Preview" :style="accent ? { '--mf': accent } : undefined">
    <SheetTabs v-if="tabs.length > 1" v-model="view" :tabs="tabs" label="Preview" />
    <p v-else class="label">Preview</p>

    <p v-if="'error' in now" class="notice warn" role="alert">Preview failed: {{ now.error }}</p>
    <template v-else-if="view === 'Item card'">
      <ItemDetails v-if="now.item" :item="now.item" />
      <ItemCard v-else-if="now.bonus" type="core" icon="corebonus" :name="now.bonus.name" :meta="now.bonus.source">
        <RulesText v-if="now.bonus.effect" :html="now.bonus.effect" />
        <RulesText v-if="now.bonus.mounted_effect" :html="String(now.bonus.mounted_effect)" />
      </ItemCard>
    </template>
    <template v-else-if="view === 'Original'">
      <p class="dim note">The pack's version.</p>
      <p v-if="was && 'error' in was" class="notice warn">Original failed: {{ was.error }}</p>
      <InfoBody v-else-if="was" :info="was.info" />
    </template>
    <template v-else>
      <header class="head">
        <Icon v-if="logo" :src="logo" class="logo" />
        <div>
          <p class="label">{{ now.info.kind }}</p>
          <h3>{{ now.info.name || 'Unnamed' }}</h3>
          <ActionChip v-if="kind === 'actions'" :activation="String(data.activation ?? '')" />
        </div>
      </header>
      <InfoBody :info="now.info" />
    </template>
  </section>
</template>

<style scoped>
.preview {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: var(--space-m);
  container-type: inline-size; /* InfoBody stacks a frame's radar and numbers in this narrow box */
  padding: var(--space-m);
  border: 1px solid var(--rule);
  /* A manufacturer's own colour only; never the site's lilac, which means "clickable". */
  border-top: 3px solid var(--mf, var(--rule));
  border-radius: var(--radius);
  background: var(--panel);
}

.preview > .label {
  margin: 0;
}

.preview > :deep(.tabs) {
  margin: 0 calc(var(--space-m) * -1);
  padding: 0 var(--space-m);
}

/* Three tabs fit the narrow column with tighter padding. */
.preview :deep(.tab) {
  min-height: 36px;
  padding: 0 8px;
}

.head {
  display: flex;
  align-items: center;
  gap: var(--space-m);
}

.logo {
  flex: none;
  width: 32px;
  height: 32px;
  color: var(--mf);
}

.head .label,
.head h3 {
  margin: 0;
}

.head h3 {
  font-size: var(--fs-l);
  overflow-wrap: anywhere;
}

.note {
  margin: 0;
  font-size: var(--fs-s);
}
</style>
