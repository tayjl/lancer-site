<script setup lang="ts">
import type { Info } from '../info'
import type { CardType } from '../itemDetails'
import Icon from './Icon.vue'
import InfoButton from './InfoButton.vue'

// The one card for a game thing (weapon, system, frame or licence, pilot gear or bionic, talent, core bonus): a header
// bar in its type's colour (the --type-* tokens) with its symbol, its name (opening its full information with "info")
// and, at the right, "meta" (system points, mod points, a rank; "unit" after a number). Then the body and the card's
// buttons ("foot"). "integrated": built into the frame or granted, so it can't be removed.
defineProps<{ type: CardType; icon: string; name: string; info?: () => Info; meta?: string; unit?: string; integrated?: boolean }>()
</script>

<template>
  <article class="item-card" :class="[type, { integrated }]">
    <header class="head">
      <Icon :name="icon" />
      <h3 class="name"><InfoButton v-if="info" :info="info" :label="name" /><template v-else>{{ name }}</template></h3>
      <span v-if="meta || $slots.meta" class="meta">
        <slot name="meta"><span :class="{ num: unit }">{{ meta }}</span><span v-if="unit" class="unit">{{ unit }}</span></slot>
      </span>
    </header>
    <div v-if="$slots.default" class="body"><slot /></div>
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
</style>
