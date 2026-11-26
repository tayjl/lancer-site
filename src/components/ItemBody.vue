<script setup lang="ts">
import { computed } from 'vue'
import { tagNames, type Item } from '../gameData'
import { cardRules, itemDetails, itemFacts } from '../itemDetails'
import ActionChip from './ActionChip.vue'
import ItemStats from './ItemStats.vue'
import RulesText from './RulesText.vue'

// What an item shows under its header (ItemDetails.vue's card, and a weapon's mod): the facts line, its range, damage and
// bonuses, its actions (always shown in full: the activation chip, the name, the action's own range and damage, its
// rules), its rules text, any modifiers applied to it, and its tags. Sits in a grid: no wrapper of its own.
const props = defineProps<{ item: Item }>()
const details = computed(() => itemDetails(props.item, tagNames.value))
const numbers = computed(() => details.value.stats.filter((stat) => stat.kind !== 'sp'))
const rules = computed(() => cardRules(props.item))
</script>

<template>
  <p v-if="itemFacts(item).length" class="facts sep"><span v-for="fact in itemFacts(item)" :key="fact">{{ fact }}</span></p>
  <ItemStats :stats="numbers" />
  <section v-for="(rule, index) in rules" :key="index" class="ability">
    <h4 class="ability-head">
      <ActionChip :activation="rule.activation" />
      <span class="ability-name">{{ rule.name }}</span>
      <span v-if="rule.frequency" class="dim frequency">{{ rule.frequency }}</span>
    </h4>
    <div class="ability-body">
      <ItemStats :stats="rule.stats" />
      <RulesText v-if="rule.text" :html="rule.text" />
    </div>
  </section>
  <RulesText v-if="details.text" :html="details.text" />
  <details v-if="item.sources?.length" class="sources">
    <summary>Where these numbers come from</summary>
    <p v-for="(source, index) in item.sources" :key="index">{{ source }}</p>
  </details>
  <ul v-if="details.tags.length" class="chips">
    <li v-for="tag in details.tags" :key="tag" class="chip">{{ tag }}</li>
  </ul>
</template>

<style scoped>
.facts {
  margin: 0;
  color: var(--text-dim);
  font-size: var(--fs-s);
}

/* An action or deployable inside the card: no box of its own, it sits on the card's surface. A thin rule above it,
   then its chip and name mark where it starts; its numbers and rules follow. */
.ability {
  display: grid;
  gap: var(--space-s);
  padding-top: var(--space-m);
  border-top: 1px solid var(--rule);
}

.ability-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-s);
  margin: 0;
  font-size: var(--fs-m);
}

.frequency {
  font-size: var(--fs-s);
  font-weight: 400;
}

.ability-body {
  display: grid;
  gap: var(--space-s);
}

.sources {
  color: var(--text-dim);
  font-size: var(--fs-s);
}

.sources summary {
  display: flex;
  align-items: center;
  color: var(--lilac);
  cursor: pointer;
}

@media (pointer: coarse), (max-width: 40rem) {
  .sources summary {
    min-height: 44px;
  }
}

.sources p {
  margin: var(--space-xs) 0 0;
}
</style>
