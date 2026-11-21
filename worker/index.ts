import { mechPreviewTags, previewTags, type MechCard, type PilotCard } from './meta'

// Link previews for pilot and mech pages, in front of the static site (wrangler.jsonc runs this Worker only for
// /registry/*; everything else is served as plain files). It returns the app's index.html with preview tags added when the
// pilot is approved or dead. The card pictures themselves are saved to storage by the viewer's browser (IdCardFrame.vue):
// drawing them here is too much work for the free plan. Only the public publishable key and the public pilot_card() and
// mech_card() functions are used.

type Env = { ASSETS: Fetcher; SUPABASE_URL: string; SUPABASE_PUBLISHABLE_KEY: string }

// The first row a public card function returns, or null.
async function rpc<T>(env: Env, name: string, args: Record<string, unknown>): Promise<T | null> {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${env.SUPABASE_PUBLISHABLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
  if (!response.ok) return null
  const body = (await response.json()) as T | T[] | null
  return (Array.isArray(body) ? body[0] : body) ?? null
}

async function withPreview(request: Request, env: Env, preview: () => Promise<string>) {
  const page = await env.ASSETS.fetch(request)
  if (!page.ok || !page.headers.get('Content-Type')?.includes('text/html')) return page
  try {
    const tags = await preview()
    if (!tags) return page
    // The page's own og tags (index.html's bare-site ones) go, so a pilot's preview never doubles them.
    return new HTMLRewriter()
      .on('meta[property^="og:"]', { element: (meta) => void meta.remove() })
      .on('head', { element: (head) => void head.append(tags, { html: true }) })
      .transform(page)
  } catch {
    return page // the preview is a nicety: the app must still load
  }
}

// A pilot's page, or one of their mechs' (/registry/<id>/mechs/<mech id>, src/router.ts).
const PAGE = /^\/registry\/(\d{1,15})(?:\/mechs\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}))?\/?$/

export default {
  async fetch(request: Request, env: Env) {
    const page = request.method === 'GET' && PAGE.exec(new URL(request.url).pathname)
    if (!page) return env.ASSETS.fetch(request)
    const [, id, mechId] = page
    return withPreview(request, env, async () => {
      if (mechId) {
        const card = await rpc<MechCard>(env, 'mech_card', { target_character_id: Number(id), target_mech_id: mechId })
        return card?.character_id ? mechPreviewTags(card, env.SUPABASE_URL) : ''
      }
      const card = await rpc<PilotCard>(env, 'pilot_card', { target_character_id: Number(id) })
      return card?.id ? previewTags(card, env.SUPABASE_URL) : ''
    })
  },
}
