<script setup lang="ts">
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { EDITOR_EXTENSIONS, SIZES } from '../richText'
import Icon from './Icon.vue'

// The paragraph editor (extensions in src/richText.ts). The value is TipTap's JSON document, or null when empty.
const doc = defineModel<unknown>()
const props = defineProps<{ label: string }>()

const editor = useEditor({
  content: (doc.value as object | null) ?? '',
  extensions: EDITOR_EXTENSIONS,
  editorProps: { attributes: { 'aria-label': props.label, 'aria-multiline': 'true', role: 'textbox' } },
  onUpdate: ({ editor }) => (doc.value = editor.isEmpty ? null : editor.getJSON()),
})

const SMALL = SIZES.small
const LARGE = SIZES.large

// Each toolbar button runs one editor command on the selected text, then puts the cursor back.
const chain = () => editor.value?.chain().focus()
const toggleBold = () => chain()?.toggleBold().run()
const toggleItalic = () => chain()?.toggleItalic().run()
const toggleUnderline = () => chain()?.toggleUnderline().run()
const toggleList = () => chain()?.toggleBulletList().run()
const toggleHeading = () => chain()?.toggleHeading({ level: 3 }).run()
const setSize = (size?: string) => (size ? chain()?.setFontSize(size) : chain()?.unsetFontSize())?.run()

// Which buttons show as pressed, for the text where the cursor is.
const is = (name: string, attrs?: Record<string, unknown>) => editor.value?.isActive(name, attrs) ?? false
const isNormalSize = () => !is('textStyle', { fontSize: SMALL }) && !is('textStyle', { fontSize: LARGE })
</script>

<template>
  <!-- One field: the toolbar is its header strip, the writing area right under it. -->
  <div class="editor">
    <div class="toolbar" role="toolbar" :aria-label="`${label} formatting`">
      <span class="group">
        <button type="button" class="tool mark" aria-label="Bold" title="Bold" :aria-pressed="is('bold')" @click="toggleBold"><strong>B</strong></button>
        <button type="button" class="tool mark" aria-label="Italic" title="Italic" :aria-pressed="is('italic')" @click="toggleItalic"><em>I</em></button>
        <button type="button" class="tool mark" aria-label="Underline" title="Underline" :aria-pressed="is('underline')" @click="toggleUnderline"><u>U</u></button>
      </span>
      <span class="group">
        <button type="button" class="tool" aria-label="Small text" title="Small text" :aria-pressed="is('textStyle', { fontSize: SMALL })" @click="setSize(SMALL)">S</button>
        <button type="button" class="tool" aria-label="Normal text" title="Normal text" :aria-pressed="isNormalSize()" @click="setSize()">M</button>
        <button type="button" class="tool" aria-label="Large text" title="Large text" :aria-pressed="is('textStyle', { fontSize: LARGE })" @click="setSize(LARGE)">L</button>
      </span>
      <span class="group">
        <button type="button" class="tool" aria-label="Bullet list" title="Bullet list" :aria-pressed="is('bulletList')" @click="toggleList"><Icon name="list" /></button>
        <button type="button" class="tool" aria-label="Heading" title="Heading" :aria-pressed="is('heading', { level: 3 })" @click="toggleHeading"><Icon name="heading" /></button>
      </span>
    </div>
    <EditorContent :editor="editor" />
  </div>
</template>

<style scoped>
/* A form field: --edge outline, lilac while anything inside has focus. */
.editor {
  overflow: hidden;
  border: 1px solid var(--edge);
  border-radius: var(--radius);
  background: var(--void);
}

.editor:focus-within {
  border-color: var(--lilac);
  box-shadow: 0 0 0 1px var(--lilac);
}

/* The header strip: one row, scrolling sideways if a phone is too narrow for it. */
.toolbar {
  display: flex;
  gap: var(--space-s);
  overflow-x: auto;
  padding: var(--space-xs);
  border-bottom: 1px solid var(--rule);
  background: var(--raised);
  scrollbar-width: none; /* the cut-off button at the edge shows there is more */
}

/* A segmented group: joined buttons parted by thin rules. */
.group {
  display: flex;
  flex: none;
  overflow: hidden;
  border: 1px solid var(--rule);
  border-radius: var(--radius);
}

.tool {
  min-width: var(--tap);
  padding: 0 var(--space-s);
  border: 0;
  border-radius: 0;
  color: var(--text);
  font-size: var(--fs-s);
  text-transform: none;
}

.tool + .tool {
  border-left: 1px solid var(--rule);
}

/* Phones: narrower buttons (still 44px tall) so the whole strip fits one row. */
@media (max-width: 30rem) {
  .toolbar { gap: var(--space-xs); }
  .tool { min-width: 34px; padding: 0; }
}

.tool:focus-visible {
  outline-offset: -2px; /* inside the group, which clips anything outside */
}

.tool .icon {
  width: 18px;
  height: 18px;
}

.tool.mark {
  font-size: var(--fs-m);
}

.tool[aria-pressed='true'] {
  background: color-mix(in srgb, var(--lilac) 12%, transparent);
  color: var(--lilac);
}

/* An empty editor (one empty paragraph) shows a quiet hint where the text goes. */
.editor :deep(.ProseMirror > p:only-child:has(> br.ProseMirror-trailingBreak:only-child))::before {
  content: 'Write here…';
  float: left;
  height: 0;
  color: var(--text-dim);
  pointer-events: none;
}

/* The writing area, in the readable font of the text it becomes. */
.editor :deep(.ProseMirror) {
  min-height: 6rem;
  padding: var(--space-m);
  font: 400 var(--fs-m) / 1.55 var(--sans);
  outline: none;
}

.editor :deep(.ProseMirror p) {
  margin: 0 0 0.75em;
}

.editor :deep(.ProseMirror h3) {
  margin: 1em 0 0.4em;
  font-size: 1rem;
}

.editor :deep(.ProseMirror ul) {
  padding-left: 1.25em;
}
</style>
