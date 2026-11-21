<script setup lang="ts">
import type { Unlock } from '../info'
import Icon from './Icon.vue'
import InfoButton from './InfoButton.vue'

// The gear a licence rank unlocks (the pilot sheet's ladder and the licence's full information): its type's symbol,
// then the name. With "links" the name goes to its entry in the archives; otherwise it opens its full information.
// With "cards" (the licence's full information) each is a bar in its type's colour, like an item card's header.
defineProps<{ items: Unlock[]; links?: boolean; cards?: boolean }>()
// The item cards' colours (ItemCard.vue): mods go with systems.
const TYPE = { frame: 'frame', weapon: 'weapon', system: 'system', mod: 'system' } as const
</script>

<template>
  <ul class="unlocks" :class="{ cards }">
    <li v-for="item in items" :key="`${item.kind}:${item.name}`" :class="cards && TYPE[item.kind]">
      <Icon :name="item.kind" />
      <span class="sr-only">{{ item.kind }}:</span>
      <InfoButton :label="item.name" :to="links ? item.to : undefined" :info="item.info" />
    </li>
  </ul>
</template>

<style scoped>
.unlocks {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  font-size: var(--fs-s);
  list-style: none;
}

.unlocks li {
  display: flex;
  align-items: center;
  gap: 6px;
}

.unlocks .icon {
  width: 18px;
  height: 18px;
  color: var(--text-dim);
}

/* Cards: ItemCard.vue's header bar (the --type-* colours, white text, its symbol), bigger and easier to scan. */
.cards {
  gap: var(--space-s);
  font-size: var(--fs-m);
}

.cards li {
  --c: var(--type-system);
  gap: var(--space-s);
  min-height: max(40px, var(--tap)); /* 44px on touch screens */
  padding: 6px var(--space-m);
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  background: var(--c);
  color: #fff;
  font-weight: 700;
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.cards .weapon { --c: var(--type-weapon); }
.cards .frame { --c: var(--type-frame); }

.cards .icon {
  flex: none;
  width: 22px;
  height: 22px;
  color: inherit;
}
</style>
