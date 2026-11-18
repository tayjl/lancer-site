<script setup lang="ts">
import { computed } from 'vue'
import { sourceOf, type Item } from '../gameData'
import { itemCard } from '../itemDetails'
import { itemInfo } from '../info'
import ItemBody from './ItemBody.vue'
import ItemCard from './ItemCard.vue'

// One item's card (pilot loadout, mech mounts and systems): the header by its type, with its system points, then what
// ItemBody shows. The default slot goes at the top of the body (BuildItem's choices), "mod" (a weapon's mod) after its source
// line, and "foot" holds the card's buttons.
const props = defineProps<{ item: Item; integrated?: boolean }>()
const look = computed(() => itemCard(props.item))
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
    :source="sourceOf(item.id)"
  >
    <slot />
    <ItemBody :item="item" />
    <template v-if="$slots.mod" #mod><slot name="mod" /></template>
    <template v-if="$slots.foot" #foot><slot name="foot" /></template>
  </ItemCard>
</template>
