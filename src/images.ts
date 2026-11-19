import { session } from './auth'
import type { Json } from './lib/database.types'
import { supabase } from './lib/supabaseClient'

// Pilot portraits and mech images. The browser shrinks each picture and uploads it to the public "character-images"
// bucket as "<your user id>/<random id>.webp" (or .jpg). The card stores that path, never a URL, and imageUrl() builds
// the link, so a tampered value can never point the page at an outside site. The database checks the same shape
// (migration 20261117180750_image_uploads.sql).

const BUCKET = 'character-images'
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
export const IMAGE_PATH = new RegExp(`^${UUID}/${UUID}\\.(webp|jpg)$`)

const MAX_INPUT = 20 * 1024 * 1024
const MAX_SIDE = 1024

// The picture's size once its long side is at most MAX_SIDE (never scaled up).
export function scaledSize(width: number, height: number) {
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

// The public link for a stored path, or null for anything that isn't one of our uploads. No network.
export const imageUrl = (path: string | null | undefined) =>
  path && IMAGE_PATH.test(path) ? supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl : null

const toBlob = (canvas: HTMLCanvasElement, type: string) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.85))

// Shrinks the picture and uploads it. Returns the stored path; throws an Error with a plain message when it can't.
// Animated GIFs become still pictures.
export async function uploadImage(file: File) {
  if (!file.type.startsWith('image/')) throw new Error('That file is not an image.')
  if (file.size > MAX_INPUT) throw new Error('That image is over 20 MB.')
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => {
    throw new Error("That image can't be read. Try a PNG, JPEG or WebP.")
  })
  const { width, height } = scaledSize(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  // Safari can't write WebP and hands back a PNG instead, so ask again for a JPEG.
  let blob = await toBlob(canvas, 'image/webp')
  if (blob?.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg')
  if (!blob) throw new Error("That image can't be converted.")
  const path = `${session.value!.user.id}/${crypto.randomUUID()}.${blob.type === 'image/webp' ? 'webp' : 'jpg'}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, cacheControl: '31536000' })
  if (error) throw new Error(error.message)
  return path
}

// Best effort: a file somebody else uploaded, or a dropped connection, just leaves it behind.
export async function deleteImage(path: string) {
  try {
    await supabase.storage.from(BUCKET).remove([path])
  } catch {
    // ignored on purpose
  }
}

// Every stored image a card uses: the portrait and each mech's picture.
export function cardImages(card: { pilot_image?: Json | null; mechs?: Json | null }) {
  const mechs = Array.isArray(card.mechs) ? card.mechs : []
  const paths = [card.pilot_image, ...mechs.map((mech) => (mech && typeof mech === 'object' && !Array.isArray(mech) ? mech.image : null))]
  return new Set(paths.filter((path): path is string => typeof path === 'string' && IMAGE_PATH.test(path)))
}
