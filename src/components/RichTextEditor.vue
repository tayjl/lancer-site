<script setup lang="ts">
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { useTemplateRef, watch } from 'vue'
import { editorExtensions, splitAroundSelection } from '../richText'
import { GAME_ICONS, loreHref, SIZES } from '../richTextSafe'
import { makerLogo } from '../archive'
import Icon from './Icon.vue'
import ItemPicker from './ItemPicker.vue'

// The paragraph editor (extensions in src/richText.ts). The value is TipTap's JSON document, or null when empty.
const doc = defineModel<unknown>()
// "links" (only the lore editor sets it) adds a "Link to entry" button, with these entries to pick from.
// "html" (the content editor's rules text) makes the value an HTML string, "" when empty, as game data has it.
const props = defineProps<{ label: string; links?: { id: string; name: string; meta?: string; text?: string }[]; html?: boolean }>()

// What this editor last wrote to the model, so a new value from outside (a list entry removed or moved, Discard) can be told
// from the echo of its own typing.
const empty = () => (props.html ? '' : null)
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? empty()) === JSON.stringify(b ?? empty())
let written: unknown = doc.value
const attributes = () => ({ attributes: { 'aria-label': props.label, 'aria-multiline': 'true', role: 'textbox' } })
const editor = useEditor({
  content: (doc.value as object | null) ?? '',
  extensions: editorExtensions(!!props.links),
  editorProps: attributes(),
  onUpdate: ({ editor }) => {
    written = props.html ? (editor.isEmpty ? '' : editor.getHTML()) : editor.isEmpty ? null : editor.getJSON()
    doc.value = written
  },
})
// A row's number changes when another row is removed or moved.
watch(() => props.label, () => editor.value?.setOptions({ editorProps: attributes() }))
watch(doc, (value) => {
  if (same(value, written)) return
  written = value
  editor.value?.commands.setContent((value as object | null) ?? '', { emitUpdate: false })
})

const XSMALL = SIZES.xsmall
const SMALL = SIZES.small
const LARGE = SIZES.large

// Each toolbar button runs one editor command on the selected text, then puts the cursor back.
const chain = () => editor.value?.chain().focus()
const toggleBold = () => chain()?.toggleBold().run()
const toggleItalic = () => chain()?.toggleItalic().run()
const toggleUnderline = () => chain()?.toggleUnderline().run()
// Lists and headings are block-level: split the paragraph around the selection first, so only the selected text changes.
const split = () => chain()?.command(({ tr }) => !!splitAroundSelection(tr))
const toggleList = () => split()?.toggleBulletList().run()
const toggleHeading = () => split()?.toggleHeading({ level: 3 }).run()
const setColour = (e: Event) => chain()?.setColor((e.target as HTMLInputElement).value).run()
const toggleGlitch = () => chain()?.toggleMark('glitch').run()
// HORUS's own logo (a bundled shape), drawn like the other tools' symbols.
const glitchLogo = makerLogo({ id: 'HORUS' } as Parameters<typeof makerLogo>[0]) ?? undefined
const iconPicker = useTemplateRef('iconPicker')
const insertIcon = (name: string | number) => {
  chain()?.insertContent({ type: 'gameIcon', attrs: { name } }).run()
  iconPicker.value?.close()
}
const iconOptions = GAME_ICONS.map((icon) => ({ id: icon.name, name: icon.label }))
const setSize = (size?: string) => (size ? chain()?.setFontSize(size) : chain()?.unsetFontSize())?.run()

// The link button: on plain selected text it asks which entry to link to; on a link it takes the link off.
const picker = useTemplateRef('picker')
const noSelection = () => editor.value?.state.selection.empty ?? true
const onLink = () => (is('link') ? chain()?.extendMarkRange('link').unsetLink().run() : picker.value?.open())
const linkTo = (id: string) => {
  chain()?.setLink({ href: loreHref(id) }).run()
  picker.value?.close()
}

// Which buttons show as pressed, for the text where the cursor is.
const is = (name: string, attrs?: Record<string, unknown>) => editor.value?.isActive(name, attrs) ?? false
const isNormalSize = () => !is('textStyle', { fontSize: XSMALL }) && !is('textStyle', { fontSize: SMALL }) && !is('textStyle', { fontSize: LARGE })
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
        <button type="button" class="tool" aria-label="Extra-small text" title="Extra-small text" :aria-pressed="is('textStyle', { fontSize: XSMALL })" @click="setSize(XSMALL)">XS</button>
        <button type="button" class="tool" aria-label="Small text" title="Small text" :aria-pressed="is('textStyle', { fontSize: SMALL })" @click="setSize(SMALL)">S</button>
        <button type="button" class="tool" aria-label="Normal text" title="Normal text" :aria-pressed="isNormalSize()" @click="setSize()">M</button>
        <button type="button" class="tool" aria-label="Large text" title="Large text" :aria-pressed="is('textStyle', { fontSize: LARGE })" @click="setSize(LARGE)">L</button>
      </span>
      <span class="group">
        <input type="color" class="tool colour" aria-label="Text colour" title="Text colour" :value="editor?.getAttributes('textStyle').color ?? '#ffffff'" @input="setColour" />
        <button type="button" class="tool" aria-label="Clear colour" title="Clear colour" @click="chain()?.unsetColor().run()">Clear</button>
      </span>
      <span class="group">
        <button type="button" class="tool" aria-label="Glitch" title="Glitch" :aria-pressed="is('glitch')" @click="toggleGlitch"><Icon :src="glitchLogo" /></button>
        <button type="button" class="tool" aria-label="Insert game icon" title="Insert game icon" @click="iconPicker?.open()"><Icon name="range" /></button>
      </span>
      <span class="group">
        <button type="button" class="tool" aria-label="Bullet list" title="Bullet list" :aria-pressed="is('bulletList')" @click="toggleList"><Icon name="list" /></button>
        <button type="button" class="tool" aria-label="Heading" title="Heading" :aria-pressed="is('heading', { level: 3 })" @click="toggleHeading"><Icon name="heading" /></button>
      </span>
      <span v-if="links" class="group">
        <button
          type="button"
          class="tool"
          :aria-label="is('link') ? 'Remove link' : 'Link to entry'"
          :title="!is('link') && noSelection() ? 'Select some text first' : is('link') ? 'Remove link' : 'Link to entry'"
          :aria-pressed="is('link')"
          :disabled="!is('link') && noSelection()"
          @click="onLink"
        ><Icon name="link" /></button>
      </span>
    </div>
    <EditorContent :editor="editor" />
    <ItemPicker ref="iconPicker" title="Add game icon" :options="iconOptions" empty="No game icons." @choose="insertIcon" />
    <ItemPicker v-if="links" ref="picker" title="Link entry" :options="links" empty="No other entries to link." @choose="linkTo" />
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

/* The header strip: groups wrap onto a second row when a phone is too narrow, so no button is clipped. */
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-s);
  padding: var(--space-xs);
  border-bottom: 1px solid var(--rule);
  background: var(--raised);
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

/* Touch sizes: the buttons are 44px wide too, and the groups wrap onto more rows. */
@media (pointer: coarse), (max-width: 30rem) {
  .tool { min-width: 44px; }
  .tool.colour { width: 44px; }
}
@media (max-width: 30rem) {
  .toolbar { gap: var(--space-xs); }
  .tool { padding: 0; }
}

.tool:focus-visible {
  outline-offset: -2px; /* inside the group, which clips anything outside */
}

.tool .icon {
  width: 18px;
  height: 18px;
}

.tool.colour:focus-visible {
  outline: 2px solid var(--lilac);
}

.tool.colour {
  height: var(--tap);
  padding: var(--space-xs);
  background: transparent;
  cursor: pointer;
}

/* A game symbol in the writing area: 1em, in the text colour (RichText.vue draws the same with Icon.vue). */
.editor :deep(.game-icon) {
  display: inline-block;
  width: 1em;
  height: 1em;
  vertical-align: -0.125em;
  background: currentColor;
  mask: center / contain no-repeat;
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

.editor :deep(.ProseMirror a) {
  cursor: text;
}

.editor :deep(.ProseMirror ul) {
  padding-left: 1.25em;
}
</style>
