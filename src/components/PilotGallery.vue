<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'
import { imageUrl, uploadImage } from '../images'
import { CAPTION_MAX, GALLERY_MAX, addPicture, removePicture, replacePicture, setCaption, type GalleryItem } from '../pilotProfile'

// The pilot's gallery: up to four pictures with an optional caption, each opening full size in a dialog. Read-only
// viewers see no panel at all when there are none. While "editable" each picture can be replaced, removed and
// captioned, and a new one added; "save" stores the whole list and returns an error message, or null.
const props = defineProps<{ items: GalleryItem[]; editable: boolean; name: string; save: (items: GalleryItem[]) => Promise<string | null> }>()

const input = useTemplateRef('input')
const dialog = useTemplateRef('dialog')
const open = ref(0)
const busy = ref('')
const error = ref('')
let target = -1 // the picture the file picker is for: its place, or -1 for a new one

async function change(doing: string, next: () => Promise<string | null>) {
  busy.value = doing
  error.value = ''
  try {
    error.value = (await next()) ?? ''
  } catch (e) {
    error.value = (e as Error).message
  }
  busy.value = ''
}

function choose(at: number) {
  target = at
  input.value?.click()
}

function picked(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  ;(event.target as HTMLInputElement).value = ''
  const at = target
  if (file)
    change('Uploading…', async () => {
      const path = await uploadImage(file)
      return props.save(at < 0 ? addPicture(props.items, path) : replacePicture(props.items, at, path))
    })
}

function show(at: number) {
  open.value = at
  dialog.value?.showModal()
}

const title = (item: GalleryItem, at: number) => item.caption || `Picture ${at + 1} of ${props.items.length}`
</script>

<template>
  <div v-if="editable || items.length" class="gallery">
    <!-- The button and count sit in the section's head (FileSection.vue). -->
    <Teleport defer to="#gallery-extra">
      <span v-if="editable && items.length >= GALLERY_MAX"><span class="num">{{ GALLERY_MAX }}</span> of <span class="num">{{ GALLERY_MAX }}</span> pictures</span>
      <button v-if="editable && items.length < GALLERY_MAX" type="button" class="small" :disabled="!!busy" @click="choose(-1)">Add picture</button>
    </Teleport>
    <input ref="input" type="file" accept="image/*" class="sr-only" tabindex="-1" @change="picked" />

    <ul v-if="items.length" class="pictures">
      <li v-for="(item, at) in items" :key="item.path" class="picture">
        <button type="button" class="thumb" :aria-label="`Open ${title(item, at)}`" @click="show(at)">
          <img :src="imageUrl(item.path)!" :alt="item.caption" loading="lazy" />
        </button>
        <input
          v-if="editable"
          type="text"
          class="caption"
          aria-label="Caption"
          placeholder="Caption"
          :maxlength="CAPTION_MAX"
          :value="item.caption"
          @change="change('Saving…', () => save(setCaption(items, at, ($event.target as HTMLInputElement).value.trim())))"
        />
        <p v-else-if="item.caption" class="caption dim">{{ item.caption }}</p>
        <div v-if="editable" class="buttons">
          <button type="button" class="small" :disabled="!!busy" @click="choose(at)">Replace</button>
          <button type="button" class="quiet small" :disabled="!!busy" @click="change('Saving…', () => save(removePicture(items, at)))">Remove</button>
        </div>
      </li>
    </ul>
    <p v-else class="empty">No pictures yet.</p>

    <p v-if="busy" class="dim status" role="status">{{ busy }}</p>
    <p v-else-if="error" class="error status" role="alert">Not saved: {{ error }}</p>

    <!-- A click on the dialog itself is a click on the backdrop (its parts fill it). -->
    <dialog ref="dialog" class="dialog viewer" :aria-label="items[open] ? title(items[open], open) : 'Picture'" @click.self="dialog?.close()">
      <template v-if="items[open]">
        <header class="dialog-head">
          <h2>{{ title(items[open], open) }}</h2>
          <button type="button" class="small" autofocus @click="dialog?.close()">Close</button>
        </header>
        <div class="dialog-body">
          <img :src="imageUrl(items[open].path)!" :alt="items[open].caption || `Picture of ${name}`" />
        </div>
      </template>
    </dialog>
  </div>
</template>

<style scoped>
/* Four to a row (two on phones), centred, so one to three pictures sit in the middle rather than at the left. */
.pictures {
  --per-row: 4;
  --gap: var(--space-m);
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--gap);
  margin: 0;
  padding: 0;
  list-style: none;
}

.pictures > .picture {
  width: calc((100% - (var(--per-row) - 1) * var(--gap)) / var(--per-row));
}

@media (max-width: 40rem) {
  .pictures {
    --per-row: 2;
    --gap: var(--space-s);
  }
}

.picture {
  display: flex;
  flex-direction: column;
  gap: var(--space-s);
  min-width: 0;
}

/* The pilot's colour is a thin outline on hover and focus: decoration only. */
.thumb {
  display: block;
  min-height: 0;
  padding: 0;
  overflow: hidden;
  border: 1px solid var(--rule);
  border-radius: var(--radius);
  background: var(--raised);
  line-height: 0;
}

.thumb:hover,
.thumb:focus-visible {
  border-color: var(--pilot, var(--edge));
  outline: 2px solid var(--pilot, var(--edge));
  outline-offset: 0;
}

.thumb img {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
}

.caption {
  margin: 0;
  font-size: var(--fs-s);
  overflow-wrap: anywhere;
}

.buttons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-s);
}

.status {
  margin: var(--space-s) 0 0;
  font-size: var(--fs-s);
}

.error {
  color: var(--danger);
}

.viewer {
  width: min(60rem, calc(100vw - 2rem));
  --mf: var(--pilot, var(--edge));
}

.viewer .dialog-body {
  display: grid;
  place-items: center;
}

.viewer img {
  max-width: 100%;
  max-height: calc(100dvh - 10rem);
  object-fit: contain;
}
</style>
