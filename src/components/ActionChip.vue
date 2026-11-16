<script setup lang="ts">
import { computed } from 'vue'
import { activationOf } from '../itemDetails'
import Icon from './Icon.vue'

// An action's activation (Quick, Full, Reaction, Protocol, Free, Overcharge, Quick Tech, Full Tech, Invade): a filled
// chip in COMP/CON's colour for it, with its symbol and its word, a corner clipped off. It goes before the action's
// name. Passive or unknown activations draw nothing.
const props = defineProps<{ activation?: string }>()
const chip = computed(() => activationOf(props.activation))
</script>

<template>
  <span v-if="chip" class="action-chip" :style="{ '--c': `var(--act-${chip.colour})` }"><Icon :name="chip.icon" />{{ activation }}</span>
</template>

<style scoped>
.action-chip {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 5px;
  height: 24px;
  padding: 0 12px 0 8px;
  background: var(--c);
  color: #fff;
  font: 700 var(--fs-xs) / 1 var(--sans);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - 7px), calc(100% - 7px) 100%, 0 100%);
}

.action-chip .icon {
  width: 16px;
  height: 16px;
}
</style>
