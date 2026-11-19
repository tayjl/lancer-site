<script setup lang="ts">
import { computed } from 'vue'
import { plural } from '../text'

// What breaks LANCER's rules on this sheet (src/rules.ts; docs/lancer-rules.md), for the player to fix and for GMs to
// see before approving. Nothing shows when everything is legal. The title speaks to whoever can fix it: "fix" on the
// owner's own editable sheet ("draft" adds "before you submit"), otherwise it just counts the problems.
const props = defineProps<{ problems: string[]; fix?: 'draft' | 'own' }>()
const title = computed(() => {
  const count = plural(props.problems.length, 'problem')
  return props.fix ? `Fix ${count}${props.fix === 'draft' ? ' before you submit' : ''}` : count
})
</script>

<template>
  <div v-if="problems.length" class="notice warn" role="note">
    <p class="notice-title">{{ title }}</p>
    <ul>
      <li v-for="problem in problems" :key="problem">{{ problem }}</li>
    </ul>
  </div>
</template>
