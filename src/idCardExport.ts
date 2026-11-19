import atkinsonUrl from '@fontsource-variable/atkinson-hyperlegible-next/files/atkinson-hyperlegible-next-latin-wght-normal.woff2?url'
import cascadiaUrl from '@fontsource-variable/cascadia-mono/files/cascadia-mono-latin-wght-normal.woff2?url'

// The pilot ID card's PNG download, with no library: the card is an SVG (PilotIdCard.vue), so it's copied, its pictures
// and the two fonts are put inside it as data urls (an SVG drawn as an image can't load anything from outside), then it
// is drawn onto a canvas at twice its size and saved. A picture that can't be fetched (an outside server without CORS
// headers, a network failure) is left out of the PNG and named in the result, rather than failing the download.

export const SANS_FAMILY = 'Atkinson Hyperlegible Next Variable'
export const MONO_FAMILY = 'Cascadia Mono Variable'

const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })

const cache = new Map<string, Promise<string>>()
// The file at "url" as a data url (kept for next time). Rejects when it can't be fetched.
function inline(url: string) {
  if (url.startsWith('data:')) return Promise.resolve(url)
  let found = cache.get(url)
  if (!found) {
    found = fetch(url).then((response) => {
      if (!response.ok) throw new Error(`${response.status}`)
      return response.blob().then(toDataUrl)
    })
    cache.set(url, found)
    found.catch(() => cache.delete(url)) // a failure isn't remembered
  }
  return found
}

const fontCss = async () => {
  const [sans, mono] = await Promise.all([inline(atkinsonUrl), inline(cascadiaUrl)])
  const face = (family: string, data: string) => `@font-face{font-family:'${family}';font-weight:200 900;src:url(${data}) format('woff2');}`
  return face(SANS_FAMILY, sans) + face(MONO_FAMILY, mono)
}

// Draws the card to a PNG blob. "dropped" lists the pictures (their "data-what" labels) that couldn't be included.
export async function cardToPng(svg: SVGSVGElement, scale = 2): Promise<{ blob: Blob; dropped: string[] }> {
  const copy = svg.cloneNode(true) as SVGSVGElement
  const box = svg.viewBox.baseVal
  copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  copy.setAttribute('width', String(box.width))
  copy.setAttribute('height', String(box.height))
  copy.removeAttribute('class')
  copy.removeAttribute('style')

  const dropped: string[] = []
  await Promise.all(
    [...copy.querySelectorAll('image')].map(async (image) => {
      try {
        image.setAttribute('href', await inline(image.getAttribute('href') ?? ''))
      } catch {
        dropped.push(image.getAttribute('data-what') ?? 'a picture')
        image.remove()
      }
    }),
  )
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
  style.textContent = await fontCss()
  copy.prepend(style)

  const xml = new XMLSerializer().serializeToString(copy)
  const picture = new Image()
  picture.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`
  await picture.decode()
  const canvas = document.createElement('canvas')
  canvas.width = box.width * scale
  canvas.height = box.height * scale
  canvas.getContext('2d')!.drawImage(picture, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('The browser could not make the picture.')
  return { blob, dropped }
}

// Saves the blob as a file download.
export function saveBlob(blob: Blob, filename: string) {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.click()
  URL.revokeObjectURL(link.href)
}
