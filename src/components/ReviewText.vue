<script setup lang="ts">
import { computed } from 'vue'
import { documentText, sameContent, textDiff } from '../textDiff'
import RichText from './RichText.vue'

const props = defineProps<{ before: unknown; after: unknown; rich?: boolean }>()
const shown = (value: unknown) => props.rich ? documentText(value) : String(value ?? '')
const parts = computed(() => textDiff(shown(props.before), shown(props.after)))
const changed = computed(() => !sameContent(props.before, props.after))
const formattingOnly = computed(() => changed.value && shown(props.before) === shown(props.after))
</script>

<template>
  <span v-if="!rich || (changed && !formattingOnly)" class="text-diff" :class="{ prose: rich }">
    <template v-for="(part, i) in parts" :key="i"><ins v-if="part.kind === 'added'" title="added">{{ part.text }}</ins><del v-else-if="part.kind === 'removed'" title="removed">{{ part.text }}</del><template v-else>{{ part.text }}</template></template>
    <span v-if="!parts.length" class="dim">nothing on file.</span>
  </span>
  <template v-else>
    <p v-if="formattingOnly" class="sky">formatting changed</p>
    <RichText v-if="after" :doc="after" />
    <p v-else class="dim">nothing on file.</p>
  </template>
</template>

<style scoped>
.text-diff { white-space: pre-wrap; overflow-wrap: anywhere; }
ins { color: var(--sky); background: color-mix(in srgb, var(--sky) 12%, transparent); text-decoration: underline; }
del { color: var(--rose); background: color-mix(in srgb, var(--rose) 10%, transparent); }
del + ins { margin-left: 0.2em; }
</style>
