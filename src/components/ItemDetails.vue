<script setup lang="ts">
import { computed } from 'vue'
import { tagNames, type Item } from '../gameData'
import { cardRules, itemCard, itemDetails, itemFacts } from '../itemDetails'
import { itemInfo } from '../info'
import ActionChip from './ActionChip.vue'
import ItemCard from './ItemCard.vue'
import ItemStats from './ItemStats.vue'
import RulesText from './RulesText.vue'

// One item's card (pilot loadout, mech mounts and systems): the header by its type, with its system points; then the
// facts line, its range, damage and bonuses, its actions (always shown in full: the activation chip, the name, the
// action's own range and damage, its rules), its rules text, any modifiers applied to it, and its tags. The default
// slot goes at the top of the body (BuildItem's choices); "foot" holds the card's buttons.
const props = defineProps<{ item: Item; integrated?: boolean }>()
const look = computed(() => itemCard(props.item))
const details = computed(() => itemDetails(props.item, tagNames.value))
const numbers = computed(() => details.value.stats.filter((stat) => stat.kind !== 'sp'))
const rules = computed(() => cardRules(props.item))
</script>

<template>
  <ItemCard
    :type="look.type"
    :icon="look.icon"
    :name="item.name"
    :info="() => itemInfo(item)"
    :meta="item.sp ? String(item.sp) : ''"
    unit="SP"
    :integrated="integrated"
  >
    <slot />
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
    <template v-if="$slots.foot" #foot><slot name="foot" /></template>
  </ItemCard>
</template>

<style scoped>
.facts {
  margin: 0;
  color: var(--text-dim);
  font-size: var(--fs-s);
}

/* An action or deployable inside the card: its chip and name, then its numbers and rules. */
.ability {
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  background: var(--void);
}

.ability-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-s);
  margin: 0;
  padding: 6px var(--space-s);
  border-bottom: 1px solid var(--rule);
  font-size: var(--fs-m);
}

.frequency {
  font-size: var(--fs-s);
  font-weight: 400;
}

.ability-body {
  display: grid;
  gap: var(--space-s);
  padding: var(--space-s) var(--space-m);
}

.sources {
  color: var(--text-dim);
  font-size: var(--fs-s);
}

.sources summary {
  color: var(--lilac);
  cursor: pointer;
}

.sources p {
  margin: var(--space-xs) 0 0;
}
</style>
