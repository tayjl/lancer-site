<script setup lang="ts" generic="T extends Data">
import { ref } from 'vue'
import type { Data } from '../../contentEditor'
import { capitalise } from '../../text'
import Icon from '../Icon.vue'
import { latest, useProblems } from './useFields'

// A list of grouped entries (a weapon's profiles, an item's actions, its deployables): each a folding box with a title and
// a one-line summary, buttons to move it up or down or remove it, and "Add" under the list. The slots draw the entries:
// "title" (default "Noun 1"), "summary" (shown while folded) and the body, which is given the entry, its index and
// "change" (merges fields into it). With "path" a box also says "Needs fixing" while folded if something inside has a
// problem. "fixed" (a talent's three ranks) leaves out Add, Remove and the move buttons.
const modelProp = defineModel<T[]>({ required: true })
const model = latest(modelProp)
const props = defineProps<{ noun: string; make: () => T; path?: string; fixed?: boolean; empty?: string; addLabel?: string }>()
defineSlots<{
  title?(props: { item: T; index: number }): unknown
  summary?(props: { item: T; index: number }): unknown
  default(props: { item: T; index: number; change: (changes: Partial<T>) => void }): unknown
}>()

const { at } = useProblems()
// Every entry but the first starts folded when the list is drawn (a long form stays short); ones added later start open.
const folded = ref(new Set(model.value.slice(1).map((_, index) => index + 1)))
const toggled = (index: number, event: Event) => {
  const next = new Set(folded.value)
  if ((event.target as HTMLDetailsElement).open) next.delete(index)
  else next.add(index)
  folded.value = next
}
const bad = (index: number) => !!props.path && at(`${props.path}.${index}`, true).some((problem) => problem.level === 'error')
const change = (index: number, changes: Partial<T>) => (model.value = model.value.map((item, i) => (i === index ? { ...item, ...changes } : item)))
const move = (index: number, by: number) => {
  const next = [...model.value]
  ;[next[index], next[index + by]] = [next[index + by], next[index]]
  model.value = next
}
</script>

<template>
  <div class="rows-in">
    <ol v-if="model.length" class="reps">
      <li v-for="(item, index) in model" :key="index">
        <details class="rep" :open="!folded.has(index)" @toggle="toggled(index, $event)">
          <summary>
            <span class="rep-title"><slot name="title" :item="item" :index="index">{{ capitalise(noun) }} {{ index + 1 }}</slot></span>
            <span class="rep-sum"><slot name="summary" :item="item" :index="index" /></span>
            <span v-if="bad(index)" class="rep-bad"><Icon name="warning" />Needs fixing</span>
            <span v-if="!fixed" class="tools">
              <button type="button" class="icon-btn" :disabled="index === 0" :aria-label="`Move ${noun} ${index + 1} up`" @click="move(index, -1)"><Icon name="chevron-up" /></button>
              <button type="button" class="icon-btn" :disabled="index === model.length - 1" :aria-label="`Move ${noun} ${index + 1} down`" @click="move(index, 1)"><Icon name="chevron-down" /></button>
              <button type="button" class="icon-btn remove" :aria-label="`Remove ${noun} ${index + 1}`" @click="model = model.filter((_, i) => i !== index)"><Icon name="close" /></button>
            </span>
            <Icon name="chevron-down" class="fold" />
          </summary>
          <div class="rep-body">
            <slot :item="item" :index="index" :change="(changes: Partial<T>) => change(index, changes)" />
          </div>
        </details>
      </li>
    </ol>
    <p v-else-if="empty" class="empty">{{ empty }}</p>
    <div v-if="!fixed"><button type="button" class="small" @click="model = [...model, make()]"><Icon name="plus" />{{ addLabel ?? `Add ${noun}` }}</button></div>
  </div>
</template>

<style scoped>
.rows-in { display: grid; gap: var(--space-s); }
.reps { display: grid; gap: var(--space-s); margin: 0; padding: 0; list-style: none; }

/* An entry: its own box, since several sit one above another; the summary line is its handle. */
.rep { border: 1px solid var(--rule); border-radius: var(--radius); background: var(--void); }
.rep > summary { display: flex; align-items: center; gap: var(--space-s); min-height: 44px; padding: 4px var(--space-xs) 4px var(--space-m); list-style: none; cursor: pointer; }
.rep > summary::-webkit-details-marker { display: none; }
.rep > summary:focus-visible { outline: 2px solid var(--lilac); outline-offset: -2px; }
.rep-title { flex: none; font-size: var(--fs-s); font-weight: 700; }
.rep-title :deep(.dim) { font-weight: 400; }
.rep-sum { flex: 1 1 0; min-width: 0; overflow: hidden; color: var(--text-dim); font-size: var(--fs-s); text-overflow: ellipsis; white-space: nowrap; }
.rep[open] .rep-sum, .rep[open] .rep-bad { display: none; }
.rep-bad { display: inline-flex; align-items: center; gap: 4px; flex: none; color: var(--danger); font-size: var(--fs-s); font-weight: 700; }
.rep-bad .icon { width: 16px; height: 16px; }
.tools { display: flex; margin-left: auto; flex: none; }
.fold { flex: none; width: 18px; height: 18px; margin-right: var(--space-xs); color: var(--text-dim); transition: transform 0.15s; }
.rep[open] .fold { transform: rotate(180deg); }
.rep-body { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--space-m); padding: var(--space-m); border-top: 1px solid var(--rule); }
/* Phones: the title and buttons share the first line (the title shortens), the summary and any "Needs fixing" go under. */
@media (max-width: 40rem) {
  .rep > summary { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 0 var(--space-xs); padding-left: var(--space-m); }
  .rep-title { grid-area: 1 / 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tools { grid-area: 1 / 2; }
  .fold { grid-area: 1 / 3; }
  .rep-sum { grid-area: 2 / 1 / 3 / -1; padding-bottom: 6px; }
  .rep-bad { grid-area: 3 / 1 / 4 / -1; padding-bottom: 6px; }
}
@media (prefers-reduced-motion: reduce) { .fold { transition: none; } }
</style>
