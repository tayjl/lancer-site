<script setup lang="ts">
import { computed } from 'vue'
import { tagNames, type Item } from '../gameData'
import { itemDetails } from '../itemDetails'
import StatIcon from './StatIcon.vue'
import { averageDamageText } from '../damage'

// One item inside a loadout card: its name, its stats with LANCER's symbols, its rules text and its tags.
const props = defineProps<{ item: Item }>()
const details = computed(() => itemDetails(props.item, tagNames.value))
const rules = computed(() => {
  const raw = props.item.raw ?? {}
  const result: { name: string; text: string }[] = []
  for (const key of ['on_attack', 'on_hit', 'on_crit']) if (raw[key]) result.push({ name: key.replaceAll('_', ' '), text: String(raw[key]) })
  for (const key of ['actions', 'deployables', 'active_effects']) if (Array.isArray(raw[key])) for (const entry of raw[key] as Record<string, unknown>[])
    {
      const stats = ['size', 'hp', 'armor', 'evasion', 'edef', 'speed', 'heatcap'].filter(stat => typeof entry[stat] === 'number').map(stat => `${stat} ${entry[stat]}`).join(' · ')
      if (entry.detail || entry.description || stats) result.push({ name: String(entry.name ?? key), text: `${stats}${stats ? '. ' : ''}${entry.detail ?? entry.description ?? ''}` })
      if (Array.isArray(entry.actions)) for (const action of entry.actions as Record<string, unknown>[]) if (action.detail) result.push({ name: String(action.name ?? 'action'), text: String(action.detail) })
    }
  return result.map(rule => ({ ...rule, text: averageDamageText(rule.text) }))
})
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
    <details v-if="item.sources?.length || rules.length" class="rules">
      <summary>modifiers and rules</summary>
      <p v-for="(source, index) in item.sources" :key="`source-${index}`">{{ source }}</p>
      <p v-for="(rule, index) in rules" :key="`rule-${index}`"><strong>{{ rule.name }}:</strong> {{ rule.text.replace(/<[^>]*>/g, ' ') }}</p>
    </details>
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
  color: var(--text-dim);
  font: 400 0.875rem/1.45 var(--read);
}
.rules { color: var(--text-dim); font: 400 0.8125rem/1.5 var(--read); }
.rules summary { cursor: pointer; color: var(--sky); }
.rules p { margin-top: 0.5rem; }

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
