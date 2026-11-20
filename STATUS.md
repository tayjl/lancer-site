# Status

Short handoff note. Update at the end of each feature or milestone. History and detail: [docs/claude/history.md](docs/claude/history.md).

## Current state
- Vue + Vite + TypeScript app with Supabase; Discord login works; the new-pilot loop, pending changes, GM review, death and memorial, owner content page (LCP import) and content editor, archives, lore and reputation are built (check `git log` for the latest).
- Pilot profile customisation (colour, banner, motto, gallery), service record, commendations and the Union ID card are committed (`27bf5a5`, `689fb2f`).
- The pilot page is a "dossier": one scrolling file with a cover header, numbered sections (02 to the end collapsible) and a file index (mockup `docs/redesign/dossier/`; detail in `docs/claude/pilot-sheet.md`).
- Every migration through `20261120100000_timeline_milestones` is on the hosted project (checked with `supabase migration list` on 2026-11-19).
- Branch `main`. Pushing deploys to Cloudflare, so ask before pushing. New migrations go to the hosted project before the site is pushed.

## Next steps
- Open question: starting values for pilot stats and a new pilot's starting level.
