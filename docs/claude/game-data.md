# Game data

Covers: LANCER game data sources, licences and storage decisions, plus Massif third-party notice.
See also: [lcp-import.md](lcp-import.md), [content-editor.md](content-editor.md), [archives.md](archives.md).

- Don't hand-type frames, weapons and talents. Use **Massif Press's own data** (https://github.com/massif-press).
- **Official content to enable** (each is a GitHub repo and an npm package):

  | Content | npm package |
  |---|---|
  | Core | `@massif/lancer-data` (its wiki documents the JSON format) |
  | Karrakin Trade Baronies | `@massif/ktb-data` |
  | Long Rim | `@massif/long-rim-data` |
  | Wallflower | `@massif/wallflower-data` |
  | Dustgrave | `@massif/dustgrave-data` |
  | Operation Solstice Rain | `@massif/osr-data` |
  | Operation Winter Scar | `@massif/ows-data` |
  | Shadow of the Wolf | `@massif/sotw-data` |
  | Siren's Song, A Mountain's Remorse | `@massif/ssmr-data` |

- **Licence:** every package in the table above is **GPL-3.0-or-later** (checked in each repo's `package.json` on 2026-10-28). You can use the data freely, but software built on it that you share must also be shared as source under the same licence. This repo is public and is licensed **GPL-3.0-or-later** to match (see `LICENSE`).
- **LCP tools:** `cc-lcp-editor` (a tool for making LCPs) and `vscode-comp-con-content-authoring` (a VS Code extension that checks LCP data is formatted correctly).
- **Decided: characters store item IDs, not copies of items.** A character saves the ID of each frame, weapon, talent and so on (the IDs used in `lancer-data` and LCPs), and the site looks up names and stats from the game data when showing the sheet. Don't copy names or stats into the character. This makes homebrew and LCP import work, and means rules fixes in the data show up automatically.
- **Decided: the private character sheet is one JSON column (`jsonb`)**, not split across many tables.
  - Why: sheets are deeply nested (pilot, then mechs, then loadouts, then mounts). One column means fewer tables, one read and one write per sheet, and a pending change can hold a full proposed sheet in the same shape. COMP/CON exports are JSON too, which helps with import.
  - The cost: the database can't check that the item IDs inside it exist or that the shape is right, so the app has to validate it.
  - The public info (name, callsign, images and so on) stays in normal columns, apart from the sheet, because it has different visibility.
- COMP/CON (the official LANCER companion app) is built with Vue, so it's a useful reference for how to structure characters. It's GPL licensed, though: read it for ideas, but don't copy code wholesale.
- Don't copy COMP/CON's styling code. Massif's **manufacturer logos are allowed** (the developer, 2026-10-31): `src/assets/logos/` holds GMS, HA, HORUS, IPS-N and SSC from COMP/CON's `public/img/logo/` (GPL-3.0, credited in the README), cleaned to their paths only (Illustrator's wrapper and undefined entities removed).
- **Massif's Lancer Third Party License** (https://massifpress.com/legal) requires two pieces of text: an acknowledgement that the site isn't an official Lancer product, and "Lancer is copyright Massif Press".
  - Both are in `src/components/ThirdPartyNotice.vue`, which names the site HOR_OS. Keep the wording; only the name may change.
  - It's shown under `[ uplink with discord ]` on the login screen only (the developer's choice), not on the logged-in pages.
