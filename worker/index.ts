import { previewTags, type PilotCard } from './meta'

// Link previews for pilot pages, in front of the static site (wrangler.jsonc runs this Worker only for /registry/*;
// everything else is served as plain files). It returns the app's index.html with preview tags added when the pilot is
// approved or dead. The card picture itself is saved to storage by the pilot's browser (PilotIdCard.vue): drawing it
// here is too much work for the free plan. Only the public publishable key and the public pilot_card() function are used.

type Env = { ASSETS: Fetcher; SUPABASE_URL: string; SUPABASE_PUBLISHABLE_KEY: string }

async function pilotCard(env: Env, id: string): Promise<PilotCard | null> {
  const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/pilot_card`, {
    method: 'POST',
    headers: { apikey: env.SUPABASE_PUBLISHABLE_KEY, Authorization: `Bearer ${env.SUPABASE_PUBLISHABLE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ target_character_id: Number(id) }),
  })
  if (!response.ok) return null
  const body = (await response.json()) as PilotCard | PilotCard[] | null
  const card = Array.isArray(body) ? body[0] : body
  return card?.id ? card : null
}

async function pilotPage(request: Request, env: Env, id: string) {
  const page = await env.ASSETS.fetch(request)
  if (!page.ok || !page.headers.get('Content-Type')?.includes('text/html')) return page
  try {
    const card = await pilotCard(env, id)
    const tags = card ? previewTags(card, env.SUPABASE_URL) : ''
    if (!tags) return page
    return new HTMLRewriter().on('head', { element: (head) => void head.append(tags, { html: true }) }).transform(page)
  } catch {
    return page // the preview is a nicety: the app must still load
  }
}

export default {
  async fetch(request: Request, env: Env) {
    const page = request.method === 'GET' && /^\/registry\/(\d{1,15})\/?$/.exec(new URL(request.url).pathname)
    return page ? pilotPage(request, env, page[1]) : env.ASSETS.fetch(request)
  },
}
