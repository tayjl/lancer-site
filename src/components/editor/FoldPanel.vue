<script setup lang="ts">
import { computed, inject } from 'vue'
import { isFolded, setFolded } from '../../fileSections'
import Icon from '../Icon.vue'
import { useProblems } from './useFields'

// A section of a form: a panel that folds, its one-line summary shown while it's folded, and "Needs fixing" while folded
// if anything at "paths" (or below) has an error, so a problem never hides inside a closed section. Inside the editor
// (which provides its kind) whether it's open is remembered per kind in this browser (src/fileSections.ts); "open" is the
// default. "forget" always starts as "open" says (the raw data box).
const props = defineProps<{ title: string; summary?: string; open?: boolean; paths?: string[]; forget?: boolean }>()
const kind = inject('editor-kind', '')
const id = kind && !props.forget ? `editor:${kind}:${props.title}` : ''
const isOpen = computed(() => (id ? !isFolded(id, !props.open) : props.open))
const toggled = (event: Event) => {
  const now = (event.target as HTMLDetailsElement).open
  if (id && now !== isOpen.value) setFolded(id, !now)
}
const { at } = useProblems()
const bad = computed(() => (props.paths ?? []).some((path) => at(path, true).some((problem) => problem.level === 'error')))
</script>

<template>
  <details class="panel fold" :open="isOpen" @toggle="toggled">
    <summary>
      <h3 class="sheet-label">{{ title }}</h3>
      <span v-if="summary" class="fold-sum">{{ summary }}</span>
      <span v-if="bad" class="fold-bad"><Icon name="warning" />Needs fixing</span>
      <Icon name="chevron-down" class="chev" />
    </summary>
    <div class="fold-body"><slot /></div>
  </details>
</template>

<style scoped>
/* A closed fold is only its summary line, so a column of them stays short. */
.fold:not([open]) { padding-block: var(--space-s); }
summary { display: flex; align-items: center; gap: var(--space-m); min-height: var(--tap); cursor: pointer; list-style: none; }
summary::-webkit-details-marker { display: none; }
summary:focus-visible { outline: 2px solid var(--lilac); outline-offset: 2px; }
/* A step above the fields' 12px labels, so the sections stand out from what's in them. */
summary h3 { flex: none; margin: 0; font-size: var(--fs-m); }
.fold-sum { min-width: 0; overflow: hidden; color: var(--text-dim); font-size: var(--fs-s); text-overflow: ellipsis; white-space: nowrap; }
details[open] > summary .fold-sum, details[open] > summary .fold-bad { display: none; }
.fold-bad { display: inline-flex; flex: none; align-items: center; gap: 4px; color: var(--danger); font-size: var(--fs-s); font-weight: 700; }
.fold-bad .icon { width: 16px; height: 16px; }
.chev { flex: none; width: 18px; height: 18px; margin-left: auto; color: var(--text-dim); transition: transform 0.15s; }
details[open] > summary .chev { transform: rotate(180deg); }
details[open] > summary { margin-bottom: var(--space-m); }
.fold-body { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--space-m); }
@media (prefers-reduced-motion: reduce) { .chev { transition: none; } }
</style>
