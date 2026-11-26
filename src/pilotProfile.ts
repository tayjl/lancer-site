import { computed, ref, shallowRef, watch } from 'vue'
import type { Json } from './lib/database.types'
import { deleteImage, IMAGE_PATH } from './images'
import { CHANGED_ELSEWHERE, checkWrite, recheckUpdatedAt, supabase } from './lib/supabaseClient'
import { displayColour } from './pilotColour'

// A pilot's profile customisation (the pilot_profiles table): colour, motto, banner (and its position) and up to four gallery
// pictures, plus the fingerprints of the saved ID card pictures (PilotIdCard.vue, MechIdCard.vue).
// It's cosmetic and public, so it saves live with no GM approval, even on an approved pilot (the database lets a pilot's
// own player, GMs and owners write it, never a dead pilot's player). Everything in it is public to every logged-in user.

export const MOTTO_MAX = 120
export const CAPTION_MAX = 140
export const GALLERY_MAX = 4

export type GalleryItem = { path: string; caption: string }
// Where the banner sits in its strip: x and y are its CSS object-position in percent, zoom scales it up from that point.
export type BannerPosition = { banner_x: number; banner_y: number; banner_zoom: number }
export type ProfileFields = { colour: string | null; motto: string | null; banner_image: string | null; gallery: GalleryItem[]; card_version: string | null; mech_card_versions: Record<string, string> } & BannerPosition

export const BANNER_CENTRED: BannerPosition = { banner_x: 50, banner_y: 50, banner_zoom: 1 }
const BLANK: ProfileFields = { colour: null, motto: null, banner_image: null, gallery: [], card_version: null, mech_card_versions: {}, ...BANNER_CENTRED }

// The gallery column is plain JSON to the database; anything that isn't an upload path is dropped, as the page never draws it.
export function readGallery(json: Json | undefined): GalleryItem[] {
  if (!Array.isArray(json)) return []
  return json.flatMap((item) => {
    const entry = item && typeof item === 'object' && !Array.isArray(item) ? item : null
    return typeof entry?.path === 'string' && IMAGE_PATH.test(entry.path) ? [{ path: entry.path, caption: typeof entry.caption === 'string' ? entry.caption : '' }] : []
  })
}

// Every change to the list returns a new one. Adding past the limit changes nothing.
export const addPicture = (gallery: GalleryItem[], path: string) => (gallery.length >= GALLERY_MAX ? gallery : [...gallery, { path, caption: '' }])
export const replacePicture = (gallery: GalleryItem[], at: number, path: string) => gallery.map((item, i) => (i === at ? { ...item, path } : item))
export const removePicture = (gallery: GalleryItem[], at: number) => gallery.filter((_, i) => i !== at)
export const setCaption = (gallery: GalleryItem[], at: number, caption: string) =>
  gallery.map((item, i) => (i === at ? { ...item, caption: caption.slice(0, CAPTION_MAX) } : item))

const imagesOf = (fields: ProfileFields) => new Set([fields.banner_image, ...fields.gallery.map((item) => item.path)].filter((path): path is string => !!path))

// Loads and saves one pilot's profile. Saves run one at a time, each sending the whole profile as it is on screen when it
// runs; the first creates the row, later ones only write if the row is still the version this page last loaded or saved
// (otherwise "conflict" is set and saving stops, like the pilot sheet). Every save returns an error message, or null.
// "ready" is false until the row has loaded, so nothing can be saved over a profile that failed to load.
export function usePilotProfile(characterId: () => number | undefined) {
  const fields = shallowRef<ProfileFields>(BLANK)
  const ready = ref(false)
  const conflict = ref(false)
  let seen = '' // the row's updated_at as last loaded or saved, as the raw string; empty while there's no row
  let unsaved = false
  let saved = new Set<string>() // the images the saved profile uses, so ones it stops using can go

  async function load() {
    const id = characterId()
    if (id === undefined) return
    const { data, error } = await supabase.from('pilot_profiles').select('*').eq('character_id', id).maybeSingle()
    if (error) return
    fields.value = data
      ? {
          colour: data.colour,
          motto: data.motto,
          banner_image: data.banner_image,
          gallery: readGallery(data.gallery),
          card_version: data.card_version,
          mech_card_versions: data.mech_card_versions && typeof data.mech_card_versions === 'object' && !Array.isArray(data.mech_card_versions) ? (data.mech_card_versions as Record<string, string>) : {},
          banner_x: data.banner_x,
          banner_y: data.banner_y,
          banner_zoom: data.banner_zoom,
        }
      : BLANK
    seen = data?.updated_at ?? ''
    saved = imagesOf(fields.value)
    ready.value = true
  }
  watch(characterId, load, { immediate: true })

  async function write() {
    const id = characterId()!
    const { colour, motto, banner_image, gallery, card_version, mech_card_versions, banner_x, banner_y, banner_zoom } = fields.value
    const body = { colour, motto, banner_image, gallery: gallery as unknown as Json, card_version, mech_card_versions, banner_x, banner_y, banner_zoom }
    const result = seen
      ? await checkWrite(await supabase.from('pilot_profiles').update(body).eq('character_id', id).eq('updated_at', seen).select('updated_at'), {
          seen,
          recheck: recheckUpdatedAt('pilot_profiles', 'character_id', id),
        })
      : await checkWrite(await supabase.from('pilot_profiles').upsert({ character_id: id, ...body }).select('updated_at'))
    if (result.row) {
      seen = result.row.updated_at
      // Best effort: a picture the saved profile no longer uses is deleted (a GM's file, for a player, just stays).
      const now = imagesOf(fields.value)
      for (const path of saved) if (!now.has(path)) deleteImage(path)
      saved = now
    }
    return result.error
  }

  let queue: Promise<unknown> = Promise.resolve()
  function save() {
    const run = async () => {
      if (conflict.value) return CHANGED_ELSEWHERE
      if (!unsaved) return null
      unsaved = false
      const error = await write()
      if (error) unsaved = true
      if (error === CHANGED_ELSEWHERE) conflict.value = true
      return error
    }
    const result = queue.then(run, run) // a save that threw must not block the ones after it
    queue = result
    return result
  }

  // Changes some fields on screen straight away (so quick edits build on each other), then saves.
  function update(changes: Partial<ProfileFields>) {
    fields.value = { ...fields.value, ...changes }
    unsaved = true
    return save()
  }

  // The colour as drawn: lightened if it's too dark to show (src/pilotColour.ts), or null for none.
  const colour = computed(() => displayColour(fields.value.colour))

  return { fields, ready, conflict, colour, update, retry: save }
}
