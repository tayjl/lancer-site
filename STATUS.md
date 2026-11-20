# Status

Short handoff note. Update at the end of each feature or milestone. History and detail: [docs/claude/history.md](docs/claude/history.md).

## Current state
- Vue + Vite + TypeScript app with Supabase; Discord login works; the new-pilot loop, pending changes, GM review, death and memorial, owner content page (LCP import) and content editor, archives, lore and reputation are built (check `git log` for the latest).
- Pilot profile customisation (colour, banner, motto, gallery), service record, commendations and the Union ID card are committed (`27bf5a5`, `689fb2f`).
- The pilot page is a "dossier": one scrolling file with a cover header, numbered sections (02 to the end collapsible) and a file index (mockup `docs/redesign/dossier/`; detail in `docs/claude/pilot-sheet.md`).
- Every migration through `20261121100000_backfill_service_record` is on the hosted project (checked with `supabase migration list` on 2026-11-21). New pilots start with 2000 manna; existing sheets unchanged. The backfill wrote the automatic service-record lines that pilots approved before 2026-11-20 never got.
- Discord link previews (2026-11-20): `/registry/<id>` runs a small Worker (`worker/`, `wrangler.jsonc` `main` and `run_worker_first`) that adds og tags for approved and dead pilots. The card picture is saved by the browser of the pilot's player or a GM to `character-images/<player_id>/card-<id>.png`; the Worker draws nothing (free-plan CPU limit). Local test: `npm run build`, then `npx wrangler dev --local` with the git-ignored `.dev.vars`.
- Branch `main`. Pushing deploys to Cloudflare, so ask before pushing. New migrations go to the hosted project before the site is pushed.

## Next steps
- **Planned, not built (decided 2026-11-21):**
  - **Item descriptions and variable damage:** each equipped item, pilot and mech, gets a description of what it really is (140 characters). A variable-damage weapon gets its type chosen when it's picked. Both go through a change and GM approval.
  - **Pilot inventory:** owned pilot items, bought through a change, each with a manna price set in the content editor (100 until an owner changes it). Equipping and swapping owned items needs no approval, checked by the database. A new pilot's first full loadout is free. Existing pilots own what they have equipped. No refunds. Mech parts are unchanged.
  - Suggested order: descriptions and damage first, then the inventory.
- After the first deploy with the Worker: paste an approved pilot's link in Discord to check the preview (a card picture appears once the owner or a GM has opened that pilot's page).
- Open question: starting values for pilot stats and a new pilot's starting level.
