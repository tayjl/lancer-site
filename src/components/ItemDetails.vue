<script setup lang="ts">
import { computed } from 'vue'
import { tagNames, type Item } from '../gameData'
import { itemDetails } from '../itemDetails'
import StatIcon from './StatIcon.vue'

// One item inside a loadout card: its name, its stats with LANCER's symbols, its rules text and its tags.
const props = defineProps<{ item: Item }>()
const details = computed(() => itemDetails(props.item, tagNames.value))
</script>

<template>
  <div class="item-details">
    <p class="item-name">{{ item.name }}</p>
    <ul v-if="details.stats.length" class="stats">
      <li v-for="(stat, i) in details.stats" :key="i">
        <span class="stat-value"><StatIcon v-if="stat.icon" :src="stat.icon" />{{ stat.value }}</span>
        <span class="stat-label">{{ stat.label }}</span>
      </li>
    </ul>
    <p v-if="details.text" class="text">{{ details.text }}</p>
    <ul v-if="details.tags.length" class="tags">
      <li v-for="tag in details.tags" :key="tag">{{ tag }}</li>
    </ul>
  </div>
</template>

<style scoped>
.item-details {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.item-details p {
  margin: 0;
}

.item-name {
  color: var(--lilac);
  font-weight: 700;
}

.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.stats li {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-value {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--lilac);
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.2;
}

.stat-label {
  color: var(--text-dim);
  font-size: 0.6875rem;
}

.text {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  color: var(--text-dim);
  font: 400 0.875rem/1.45 var(--read);
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.tags li {
  padding: 0 0.4rem;
  border: 1px solid var(--rule);
  color: var(--sky);
  font-size: 0.6875rem;
}
</style>
