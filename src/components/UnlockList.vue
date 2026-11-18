<script setup lang="ts">
import type { Unlock } from '../info'
import Icon from './Icon.vue'
import InfoButton from './InfoButton.vue'

// The gear a licence rank unlocks (the pilot sheet's ladder and the licence's full information): its type's symbol,
// then the name. With "links" the name goes to its entry in the archives; otherwise it opens its full information.
defineProps<{ items: Unlock[]; links?: boolean }>()
</script>

<template>
  <ul class="unlocks">
    <li v-for="item in items" :key="`${item.kind}:${item.name}`">
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
</style>
