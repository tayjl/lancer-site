<script setup lang="ts">
import { Color, FontSize, TextStyle } from '@tiptap/extension-text-style'
import StarterKit from '@tiptap/starter-kit'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { COLOURS, SIZES } from '../richText'

// The paragraph editor: bold, italic, underline, three sizes, the palette's accent colours, bullet lists
// and small headings. Everything else StarterKit offers is switched off, so the editor can only produce
// what RichText.vue will show. The value is TipTap's JSON document, or null when empty.
const doc = defineModel<unknown>()
const props = defineProps<{ label: string }>()

const editor = useEditor({
  content: (doc.value as object | null) ?? '',
  extensions: [
    StarterKit.configure({
      heading: { levels: [3] },
      blockquote: false,
      code: false,
      codeBlock: false,
      horizontalRule: false,
      link: false,
      orderedList: false,
      strike: false,
    }),
    TextStyle,
    Color,
    FontSize,
  ],
  editorProps: { attributes: { 'aria-label': props.label, 'aria-multiline': 'true', role: 'textbox' } },
  onUpdate: ({ editor }) => (doc.value = editor.isEmpty ? null : editor.getJSON()),
})

const colourNames = { 'var(--lilac)': 'lilac', 'var(--rose)': 'rose', 'var(--sky)': 'sky' } as const
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
const setColour = (colour?: string) => (colour ? chain()?.setColor(colour) : chain()?.unsetColor())?.run()

// Which buttons show as pressed, for the text where the cursor is.
const is = (name: string, attrs?: Record<string, unknown>) => editor.value?.isActive(name, attrs) ?? false
const isNormalSize = () => !is('textStyle', { fontSize: SMALL }) && !is('textStyle', { fontSize: LARGE })
const isPlainColour = () => !COLOURS.some((colour) => is('textStyle', { color: colour }))
</script>

<template>
  <div class="editor">
    <div class="toolbar" role="toolbar" :aria-label="`${label} formatting`">
      <span class="group">
        <button type="button" class="tool" aria-label="bold" :aria-pressed="is('bold')" @click="toggleBold"><strong>b</strong></button>
        <button type="button" class="tool" aria-label="italic" :aria-pressed="is('italic')" @click="toggleItalic"><em>i</em></button>
        <button type="button" class="tool" aria-label="underline" :aria-pressed="is('underline')" @click="toggleUnderline"><u>u</u></button>
      </span>
      <span class="group">
        <button type="button" class="tool" :aria-pressed="is('textStyle', { fontSize: SMALL })" @click="setSize(SMALL)">small</button>
        <button type="button" class="tool" :aria-pressed="isNormalSize()" @click="setSize()">normal</button>
        <button type="button" class="tool" :aria-pressed="is('textStyle', { fontSize: LARGE })" @click="setSize(LARGE)">large</button>
      </span>
      <span class="group">
        <button type="button" class="tool" :aria-pressed="isPlainColour()" @click="setColour()">plain</button>
        <button
          v-for="colour in COLOURS"
          :key="colour"
          type="button"
          class="tool"
          :style="{ color: colour }"
          :aria-pressed="is('textStyle', { color: colour })"
          @click="setColour(colour)"
        >
          {{ colourNames[colour] }}
        </button>
      </span>
      <span class="group">
        <button type="button" class="tool" :aria-pressed="is('bulletList')" @click="toggleList">list</button>
        <button type="button" class="tool" :aria-pressed="is('heading', { level: 3 })" @click="toggleHeading">heading</button>
      </span>
    </div>
    <EditorContent :editor="editor" />
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 1rem;
  margin-bottom: 0.5rem;
}

.group {
  display: flex;
  gap: 0.25rem;
}

/* Small toggle buttons without the usual [ brackets ]. Pressed ones are outlined in lilac. */
.tool {
  padding: 0.1rem 0.45rem;
  border: 1px solid var(--rule);
  color: var(--text-dim);
  font-size: 0.75rem;
  font-weight: 400;
}

.tool::before,
.tool::after {
  content: none;
}

.tool:hover,
.tool:focus {
  color: var(--text);
}

.tool[aria-pressed='true'] {
  border-color: var(--lilac);
  color: var(--lilac);
}

.tool:focus-visible {
  outline: 1px solid var(--lilac);
  outline-offset: 2px;
}

/* The writing area: the readable font, like the text it becomes. */
.editor :deep(.ProseMirror) {
  min-height: 6rem;
  padding: 0.75rem;
  border: 1px solid var(--rule);
  font: 400 1.0625rem/1.55 var(--read);
}

.editor :deep(.ProseMirror:focus) {
  border-color: var(--lilac);
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
