<script setup lang="ts">
import { computed, useId, useTemplateRef, watchPostEffect } from 'vue'
import FieldError from './FieldError.vue'
import { useProblems } from './useFields'

// One labelled input of a form: the label, the input (the slot), an optional hint and, when the editor finds something
// wrong at "path", the input's danger outline, aria-invalid and an "Error: …" line under it. The form's own code only
// names the path. "block" is for a field that isn't one native input (a rules text editor): the label is then a plain
// heading and not a <label>.
const props = defineProps<{ label: string; path?: string; hint?: string; block?: boolean }>()
const { invalid, at } = useProblems()
const root = useTemplateRef<HTMLElement>('root')
const id = useId()
const bad = computed(() => !!props.path && invalid(props.path))

// The first control inside is the one the problem belongs to: the input of a label, the writing area or radio group of a block.
const INPUT = 'input:not([type="checkbox"]):not([type="radio"]), select, textarea'
const BLOCK = '[contenteditable="true"], [role="radiogroup"]'
watchPostEffect(() => {
  // Only a field with a path, or a hint on a single input, touches its control; one that merely labels a list leaves it alone.
  const hinted = !!props.hint && !props.block
  if (!props.path && !hinted) return
  const control = root.value?.querySelector(props.block ? BLOCK : INPUT)
  if (!control) return
  const parts = new Set((control.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean))
  parts.delete(`${id}-err`)
  if (hinted) parts.add(`${id}-hint`)
  if (props.path) {
    if (bad.value) control.setAttribute('aria-invalid', 'true')
    else control.removeAttribute('aria-invalid')
    if (at(props.path).length) parts.add(`${id}-err`)
  }
  if (parts.size) control.setAttribute('aria-describedby', [...parts].join(' '))
  else control.removeAttribute('aria-describedby')
})
</script>

<template>
  <component :is="block ? 'div' : 'label'" ref="root" :class="block ? 'field-block' : 'field'" :data-invalid="bad || undefined">
    <span :class="{ label: block }">{{ label }}</span>
    <slot />
    <span v-if="hint" :id="`${id}-hint`" class="hint">{{ hint }}</span>
    <FieldError v-if="path" :path="path" :id="`${id}-err`" />
  </component>
</template>
