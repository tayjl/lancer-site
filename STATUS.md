# Status

Short handoff note. Update at the end of each feature or milestone. History and detail: [docs/claude/history.md](docs/claude/history.md).

## Current state
- Vue + Vite + TypeScript app with Supabase; Discord login works; the new-pilot loop, pending changes, GM review, death and memorial, owner content page (LCP import) and content editor, archives, lore and reputation are built (check `git log` for the latest).
- Pilot profile customisation (colour, banner, motto, gallery), service record, commendations and the Union ID card are committed (`27bf5a5`, `689fb2f`).
- The pilot page is a "dossier": one scrolling file with a cover header, numbered sections (02 to the end collapsible) and a file index (mockup `docs/redesign/dossier/`; detail in `docs/claude/pilot-sheet.md`).
- Every migration through `20261120110000_banner_position_and_public_card` is on the hosted project (applied and checked with `supabase migration list` on 2026-11-20; types regenerated).
- Discord link previews (2026-11-20): `/registry/<id>` runs a small Worker (`worker/`, `wrangler.jsonc` `main` and `run_worker_first`) that adds og tags for approved and dead pilots. The card picture is saved by the browser of the pilot's player or a GM to `character-images/<player_id>/card-<id>.png`; the Worker draws nothing (free-plan CPU limit). Local test: `npm run build`, then `npx wrangler dev --local` with the git-ignored `.dev.vars`.
- Branch `main`. Pushing deploys to Cloudflare, so ask before pushing. New migrations go to the hosted project before the site is pushed.

## Next steps
- After the first deploy with the Worker: paste an approved pilot's link in Discord to check the preview (a card picture appears once the owner or a GM has opened that pilot's page).
- Open question: starting values for pilot stats and a new pilot's starting level.
