<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import type { NamedBonus } from '../bonuses'
import { equipmentDetails } from '../equipment'
import { tagNames, type Item } from '../gameData'
import { frameArt } from '../images'
import { itemCard, itemDetails, symbolOf } from '../itemDetails'
import { damageTotals, radarAxes, reach } from '../mechOverview'
import { frameRanges, mountSize, type Frame, type mechStats } from '../mechData'
import type { MechPrivate, Sheet } from '../myPilot'
import Icon from './Icon.vue'
import { defColour } from '../definitions'
import ItemStats from './ItemStats.vue'
import MechImage from './MechImage.vue'
import RadarChart from './RadarChart.vue'

// The mech page's at-a-glance panel: the frame's identity (its picture, or its maker's logo; its roles), a radar of this build's own stats against every frame, a diagram of the
// loadout (a box per mount, a cell per weapon place with its damage and range, empty places dashed, systems as chips,
// the system points meter), and the damage and reach the equipped weapons add up to. Symbols and numbers, not text.
const props = defineProps<{
  frame: Frame
  baseFrame: Frame
  frames: Frame[]
  logo: string | null
  // The mech's own uploaded image (a stored path) and its name: shown in place of the frame's art when there is one.
  image: string | null
  name: string
  stats: ReturnType<typeof mechStats>
  sheet: Sheet
  details: MechPrivate
  bonuses: NamedBonus[]
  weapons: Item[]
  systems: Item[]
  mods: Item[]
  integrated: Map<string, Item>
  spUsed: number
  spTotal: number | null
}>()

const art = computed(() => frameArt(props.baseFrame, props.frames))
// Phones: the radar's labels one word to a line, so they fit beside it (as the frame information's).
const phoneQuery = window.matchMedia('(max-width: 40rem)')
const phone = ref(phoneQuery.matches)
const onPhoneChange = (event: MediaQueryListEvent) => (phone.value = event.matches)
phoneQuery.addEventListener('change', onPhoneChange)
onUnmounted(() => phoneQuery.removeEventListener('change', onPhoneChange))

// The radar: the same axes, labels and symbols as the frame information's (src/mechOverview.ts), with this build's numbers.
const axes = computed(() => radarAxes(props.stats, frameRanges(props.frames)))

const byId = (items: Item[]) => new Map(items.map((item) => [item.id, item]))
const weaponsById = computed(() => byId(props.weapons))
const systemsById = computed(() => byId(props.systems))

// Weapon places as the cards show them (modifiers applied): damage first, then range.
type Place = { name: string; icon: string; stats: ReturnType<typeof itemDetails>['stats']; item: Item; mod?: Item } | null
const place = (base: Item | undefined, key: string, location: { mount: number; position: number; integrated?: boolean }): Place => {
  if (!base) return null
  const item = equipmentDetails(base, props.sheet, props.bonuses, props.details.weapon_options?.[key], location, props.details.core_mounts)
  const stats = itemDetails(item, tagNames.value).stats.filter((stat) => stat.kind === 'damage' || stat.kind === 'range')
  return { name: base.name, icon: itemCard(base).icon, stats: [...stats.filter((s) => s.kind === 'damage'), ...stats.filter((s) => s.kind === 'range')], item, mod: props.mods.find((mod) => mod.id === props.details.weapon_mods?.[key]) }
}
const boxes = computed(() =>
  props.frame.mounts.map((mount, m) => ({
    name: mount,
    places: Array.from({ length: mountSize(mount) }, (_, i) => {
      const id = props.details.mounts?.[m]?.[i]
      return place(id ? weaponsById.value.get(id) ?? props.integrated.get(id) : undefined, `${m}:${i}`, { mount: m, position: i })
    }),
  })),
)
// Weapons built into the frame get a box of their own.
const builtIn = computed(() =>
  props.frame.integrated.flatMap((id, i) => {
    const base = props.integrated.get(id)
    return base?.mount ? [place(base, `integrated:${id}`, { mount: -1, position: i, integrated: true })] : []
  }),
)
const equipped = computed(() => [...boxes.value.flatMap((box) => box.places), ...builtIn.value].filter((entry): entry is NonNullable<Place> => !!entry))
const installed = computed(() => (props.details.systems ?? []).map((id) => systemsById.value.get(id)).filter((item): item is Item => !!item))

const damage = computed(() => damageTotals(equipped.value.map((entry) => entry.item)))
const maxDamage = computed(() => Math.max(1, ...damage.value.map((entry) => entry.total)))
const reaches = computed(() => reach(equipped.value.map((entry) => entry.item)))
const maxReach = computed(() => Math.max(1, ...reaches.value.map((entry) => entry.max)))
const tint = (type: string) => { const color = defColour('damage_types', type); return color ? { color } : undefined }
const fill = (type: string, share: number) => ({ width: `${Math.round(share * 100)}%`, ...(defColour('damage_types', type) ? { background: defColour('damage_types', type) } : {}) })

const remaining = computed(() => (props.spTotal ?? 0) - props.spUsed)
const summary = computed(() => `${props.baseFrame.name} build compared with every frame: ${axes.value.map((axis) => `${axis.label} ${axis.value}`).join(', ')}`)
</script>

<template>
  <section class="panel overview">
    <h2 class="sheet-label">Overview</h2>

    <div class="top">
      <div class="identity">
        <!-- The mech's picture, the one place it shows on the profile tab: its upload, else the frame's art, else the maker's logo, dim. -->
        <MechImage size="overview" :src="image" :art="art" :logo="logo" :alt="`Image of ${name}`" :art-alt="`${baseFrame.name} frame art`" />
        <ul class="chips">
          <li v-for="role in baseFrame.mechtype" :key="role" class="chip">{{ role }}</li>
        </ul>
        <!-- The page's image upload, while editable. -->
        <slot />
      </div>
      <RadarChart v-if="axes.length >= 3" class="radar" :axes="axes" :summary="summary" :label-size="phone ? 26 : undefined" :wrap="phone" />
    </div>

    <div class="loadout">
      <div class="meter" :class="{ full: spUsed === spTotal, over: spUsed > (spTotal ?? 0) }">
        <div class="meter-head">
          <span class="label">System points</span>
          <span class="meter-value num">{{ spUsed }} / {{ spTotal }}</span>
        </div>
        <div class="meter-bar"><span :style="{ '--fill': `${spTotal ? Math.min(100, (spUsed / spTotal) * 100) : 100}%` }"></span></div>
        <div class="meter-note">{{ remaining < 0 ? `${-remaining} over` : remaining === 0 ? 'All used' : `${remaining} left` }}</div>
      </div>

      <ul class="mounts">
        <li v-for="(box, m) in boxes" :key="m" class="mount">
          <p class="label mount-name"><Icon name="weapon" />{{ box.name }}</p>
          <ul class="places">
            <li v-for="(entry, i) in box.places" :key="i" class="place" :class="{ empty: !entry }">
              <template v-if="entry">
                <span class="tile weapon"><Icon :name="entry.icon" /></span>
                <span class="place-body">
                  <span class="place-name">{{ entry.name }}</span>
                  <ItemStats :stats="entry.stats" compact />
                  <span v-if="entry.mod" class="chip mod"><Icon name="mod" />{{ entry.mod.name }}</span>
                </span>
              </template>
              <span v-else class="dim">Empty</span>
            </li>
          </ul>
        </li>
        <li v-if="builtIn.length" class="mount">
          <p class="label mount-name"><Icon name="frame" />Integrated</p>
          <ul class="places">
            <li v-for="(entry, i) in builtIn" :key="i" class="place">
              <template v-if="entry">
                <span class="tile weapon"><Icon :name="entry.icon" /></span>
                <span class="place-body">
                  <span class="place-name">{{ entry.name }}</span>
                  <ItemStats :stats="entry.stats" compact />
                </span>
              </template>
            </li>
          </ul>
        </li>
      </ul>

      <ul v-if="installed.length" class="systems">
        <li v-for="(item, i) in installed" :key="`${item.id}-${i}`" class="system">
          <span class="tile system"><Icon :name="itemCard(item).icon" /></span>
          <span class="system-name">{{ item.name }}</span>
          <span v-if="item.sp" class="num sp" :title="`${item.sp} system points`"><Icon name="system_point" />{{ item.sp }}<span class="sr-only"> system points</span></span>
        </li>
      </ul>
    </div>

    <div v-if="damage.length || reaches.length" class="output">
      <div v-if="damage.length">
        <h3 class="label">Damage</h3>
        <ul class="bars">
          <li v-for="entry in damage" :key="entry.type">
            <Icon v-if="symbolOf(entry.type)" :src="symbolOf(entry.type)!" :style="tint(entry.type)" />
            <span class="num value">{{ entry.total }}</span>
            <span class="bar"><span :style="fill(entry.type, entry.total / maxDamage)"></span></span>
            <small>{{ entry.type }}</small>
          </li>
        </ul>
      </div>
      <div v-if="reaches.length">
        <h3 class="label">Reach</h3>
        <ul class="bars reach">
          <li v-for="entry in reaches" :key="entry.type">
            <Icon v-if="symbolOf(entry.type)" :src="symbolOf(entry.type)!" />
            <span class="num value">{{ entry.min === entry.max ? entry.max : `${entry.min}–${entry.max}` }}</span>
            <span class="bar"><span :style="fill(entry.type, entry.max / maxReach)"></span></span>
            <small>{{ entry.type }}</small>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<style scoped>
.overview {
  display: grid;
  gap: var(--space-l);
}

.overview > .sheet-label {
  margin: 0;
}

/* Two columns gathered in the middle: the identity (a showcase, so centred: the logo with its chips under it) and the
   radar beside it, like the pilot page's stat row; one column on phones. The frame's name and maker are on the plate above. */
.top {
  display: grid;
  grid-template-columns: minmax(0, 18rem) minmax(0, 26rem);
  align-items: center;
  justify-content: center;
  gap: var(--space-xl);
}

.identity {
  display: grid;
  justify-items: center;
  gap: var(--space-m);
  min-width: 0;
}

.identity .chips {
  justify-content: center;
}

.radar {
  justify-self: center;
}

/* The loadout diagram: the SP meter, then a box per mount, then the systems. */
.loadout {
  display: grid;
  gap: var(--space-m);
}

.mounts {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
  gap: var(--space-m);
  margin: 0;
  padding: 0;
  list-style: none;
}

.mount {
  display: grid;
  gap: var(--space-s);
  align-content: start;
  padding: var(--space-s) var(--space-m) var(--space-m);
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  background: var(--panel);
}

.mount-name {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  margin: 0;
  color: var(--text-dim);
}

.mount-name .icon {
  width: 16px;
  height: 16px;
}

/* Places sit on the mount's own surface, parted by a thin rule like actions in a card; an empty one is a slim dashed line. */
.places {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.place {
  display: flex;
  align-items: flex-start;
  gap: var(--space-s);
  padding: var(--space-s) 0;
  border-top: 1px solid var(--rule);
}

.place:first-child {
  padding-top: 0;
  border-top: 0;
}

.place.empty {
  align-items: center;
  justify-content: center;
  min-height: 28px;
  margin: var(--space-xs) 0;
  padding: 2px;
  border: 1px dashed var(--rule);
  border-radius: 2px;
  font-size: var(--fs-s);
}

.tile {
  display: grid;
  flex: none;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 2px;
  color: #fff;
  font-size: 18px;
}

.tile.weapon { background: var(--type-weapon); }
.tile.system { background: var(--type-system); }

.place-body {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.place-name {
  font-weight: 700;
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.chip.mod {
  justify-self: start;
  height: 20px;
  font-size: 11px;
}

.chip.mod .icon {
  width: 14px;
  height: 14px;
  margin-right: 4px;
}

.systems {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-s);
  margin: 0;
  padding: 0;
  list-style: none;
}

.system {
  display: inline-flex;
  align-items: center;
  gap: var(--space-s);
  padding: 4px var(--space-s) 4px 4px;
  border: 1px solid var(--rule);
  border-radius: 2px;
  background: var(--raised);
}

.system-name {
  font-weight: 700;
}

.sp {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: var(--text-dim);
  font-size: var(--fs-s);
}

.sp .icon {
  width: 16px;
  height: 16px;
}

/* Damage and reach as bars: symbol, number, a bar scaled to the biggest, the word. */
.output {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
  gap: var(--space-l);
}

.output h3 {
  margin: 0 0 var(--space-s);
}

.bars {
  display: grid;
  gap: var(--space-s);
  margin: 0;
  padding: 0;
  list-style: none;
}

.bars li {
  display: grid;
  grid-template-columns: 22px 3.5rem minmax(0, 1fr) 5.5rem;
  align-items: center;
  gap: var(--space-s);
}

.bars .icon {
  width: 22px;
  height: 22px;
  color: var(--text-dim);
}

.bars .value {
  font-weight: 700;
  text-align: right;
}

.bar {
  height: 10px;
  border-radius: 2px;
  background: var(--raised);
  overflow: hidden;
}

.bar > span {
  display: block;
  height: 100%;
  background: var(--text-dim);
}

.bars small {
  color: var(--text-dim);
  font-size: var(--fs-s);
  text-transform: capitalize;
}

@media (max-width: 40rem) {
  .top {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
