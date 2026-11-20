<script setup lang="ts">
import Icon from '../Icon.vue'
import { useProblems } from './useFields'

// What's wrong at one place in the item: an "Error: …" (or "Warning: …") line under the input, from the editor's problem
// list. "deep" also shows what's wrong anywhere below the path (a whole row's). Nothing is drawn when all is well.
defineProps<{ path: string; deep?: boolean; id?: string }>()
const { at } = useProblems()
</script>

<template>
  <p v-for="(problem, index) in at(path, deep)" :id="index === 0 ? id : undefined" :key="problem.text" class="err" :class="{ warn: problem.level === 'warn' }">
    <Icon name="warning" /><span><b>{{ problem.level === 'error' ? 'Error' : 'Warning' }}:</b> {{ problem.text }}</span>
  </p>
</template>
