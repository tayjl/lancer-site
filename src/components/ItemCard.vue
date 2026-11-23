<script setup lang="ts">
import { ref } from 'vue'
import type { Info } from '../info'
import type { CardType } from '../itemDetails'
import Icon from './Icon.vue'
import InfoButton from './InfoButton.vue'

// The one card for a game thing (weapon, system, frame or licence, pilot gear or bionic, talent, core bonus): a header
// bar in its type's colour (the --type-* tokens) with its symbol, its name (opening its full information with "info")
// and, at the right, "meta" (system points, mod points, a rank; "unit" after a number). Then the body and the card's
// buttons ("foot"). A "mod" slot (a weapon's mod) comes after the source line, and then a thin rule sets the foot apart
// so the weapon's buttons don't read as the mod's. "integrated": built into the frame or granted, so it can't be
// removed. "source": the pack it comes from, as the last line of the body.
// The small button in the header minimises the card: only the header and the stats row (an "item-stats" list) stay.
defineProps<{ type: CardType; icon: string; name: string; info?: () => Info; meta?: string; unit?: string; integrated?: boolean; source?: string }>()
const minimised = ref(false)
</script>

<template>
  <article class="item-card" :class="[type, { integrated, minimised }]">
    <header class="head">
      <Icon :name="icon" />
      <h3 class="name"><InfoButton v-if="info" :info="info" :label="name" /><template v-else>{{ name }}</template></h3>
      <span v-if="meta || $slots.meta" class="meta">
        <slot name="meta"><span :class="{ num: unit }">{{ meta }}</span><span v-if="unit" class="unit">{{ unit }}</span></slot>
      </span>
      <button type="button" class="fold" :class="{ push: !(meta || $slots.meta) }" :aria-label="minimised ? 'Expand' : 'Minimise'" :aria-expanded="!minimised" @click="minimised = !minimised">{{ minimised ? '+' : '−' }}</button>
    </header>
    <div v-if="$slots.default || source" class="body" :class="{ 'has-mod': $slots.mod }">
      <slot />
      <p v-if="source" class="pack-source">Source: {{ source }}</p>
      <slot name="mod" />
    </div>
    <div v-if="$slots.foot" class="foot"><slot name="foot" /></div>
  </article>
</template>

<style scoped>
.item-card {
  --c: var(--raised);
  overflow: hidden;
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  background: var(--panel);
}

.weapon { --c: var(--type-weapon); }
.system { --c: var(--type-system); }
.frame { --c: var(--type-frame); }
.pilot { --c: var(--type-pilot); }
.talent { --c: var(--type-talent); }
.core { --c: var(--type-core); }

.head {
  display: flex;
  align-items: center;
  gap: var(--space-s);
  min-height: 40px;
  padding: 6px var(--space-m);
  background: var(--c);
  color: #fff;
}

/* Core bonuses' lime takes dark text. */
.core .head {
  color: var(--void);
}

/* Built in: a light line along the header's foot. */
.integrated .head {
  box-shadow: inset 0 -3px 0 rgb(255 255 255 / 0.35);
}

.head > .icon {
  width: 22px;
  height: 22px;
}

.name {
  min-width: 0;
  margin: 0;
  color: inherit;
  font-size: 17px;
  font-weight: 700;
  line-height: 1.2;
  overflow-wrap: anywhere;
}

/* Touch screens: the name is a button, so it gets a full-size tap area. */
@media (pointer: coarse), (max-width: 40rem) {
  .name :deep(.info-link) {
    display: inline-flex;
    align-items: center;
    min-height: var(--tap);
  }
}

.meta {
  display: flex;
  flex: none;
  align-items: baseline;
  gap: var(--space-m);
  margin-left: auto;
  font: 700 var(--fs-s) var(--sans);
  white-space: nowrap;
}

.unit {
  margin-left: 3px;
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 0.85;
}

/* The fold button: a real button with a full tap area, a symbol and an outline so it isn't colour alone. */
.fold {
  flex: none;
  min-width: var(--tap);
  min-height: var(--tap);
  margin: -6px calc(var(--space-s) * -1) -6px 0;
  padding: 0;
  border: 1px solid currentColor;
  border-radius: var(--radius);
  background: none;
  color: inherit;
  font: 700 18px/1 var(--sans);
  cursor: pointer;
}

.fold::before,
.fold::after {
  content: none;
}

.fold:hover,
.fold:focus-visible {
  background: rgb(255 255 255 / 0.2);
}

/* Lime header: white fill and the lilac focus ring vanish, so go dark. */
.core .fold:hover,
.core .fold:focus-visible {
  background: rgb(0 0 0 / 0.15);
}

.core .fold:focus-visible {
  outline-color: var(--void);
}

.fold.push {
  margin-left: auto;
}

/* Minimised: keep only the stats row. A body with no stats goes, and so does the foot. */
.minimised .body > :deep(:not(.item-stats)),
.minimised .foot {
  display: none;
}

.minimised .body:not(:has(> .item-stats)) {
  display: none;
}

.body {
  display: grid;
  gap: var(--space-m);
  padding: var(--space-m);
}

.foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-s);
  padding: 0 var(--space-m) var(--space-m);
}

.head + .foot {
  padding-top: var(--space-m);
}

.body.has-mod + .foot {
  padding-top: var(--space-m);
  border-top: 1px solid var(--rule);
}
</style>
