<script setup lang="ts">
import { h, type VNode } from 'vue'
import { sanitiseDoc, type SafeNode } from '../richText'

// Shows formatted text saved by the editor. It's always cleaned by sanitiseDoc() first, then drawn
// with plain Vue elements, so text written by other players can't inject anything (see src/richText.ts).
const props = defineProps<{ doc: unknown }>()

const TAGS = { paragraph: 'p', heading: 'h3', bulletList: 'ul', listItem: 'li' } as const

function draw(node: SafeNode): VNode | string {
  if (node.type === 'hardBreak') return h('br')
  if (node.type !== 'text') return h(TAGS[node.type], node.content.map(draw))
  let out: VNode | string = node.text
  if (node.colour || node.size) out = h('span', { style: { color: node.colour, fontSize: node.size } }, out)
  if (node.underline) out = h('u', out)
  if (node.italic) out = h('em', out)
  if (node.bold) out = h('strong', out)
  return out
}

const Rendered = () => h('div', { class: 'rich prose' }, sanitiseDoc(props.doc).map(draw))
</script>

<template>
  <Rendered />
</template>

<style scoped>
.rich :deep(p) {
  margin: 0 0 0.75em;
}

.rich :deep(h3) {
  margin: 1em 0 0.4em;
  font-size: 1rem;
}

.rich :deep(ul) {
  margin: 0 0 0.75em;
  padding-left: 1.25em;
}

.rich :deep(li p) {
  margin: 0;
}

.rich > :deep(:last-child) {
  margin-bottom: 0;
}
</style>
