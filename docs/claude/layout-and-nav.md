# Layout and nav

Covers: App layout, top bar, page column, route list, breadcrumbs and nav labels.
See also: [pages-home-lore.md](pages-home-lore.md), [registry.md](registry.md), [gm-pages.md](gm-pages.md).

- **Layout** (`src/App.vue`):
  - **Top bar** (prototype's), sticky on every screen size, height `--topbar-h` (56px, 52px on phones): the HORUS logo art, small (`src/assets/logo.txt` at 4px, linking home), then the underline **tabs** My pilot, Registry, Archives, Lore, Combat; for GMs and owners a thin divider, a `GM` label and Pilots, Changes (owners also Content); the operator's name with their role as a `.label` (the box is `.account`, renamed from `.user` in the 2026-11-20 cleanup so the name no longer picks up the chat's sky colour), and Disconnect (`.quiet.small`). The current tab is lilac with a lilac underline (`aria-current="page"`); a page under a tab marks it through route `meta.section`, a pilot record or its mech marks Registry. `/pending` and `/memorial` redirect to the registry's tabs. `/combat` is the combat guide; `/pithub` has no tab (reached from the home page's art).
  - **The page** under it, a centred column (`.page`, at most `--page-max`, 84rem). Anything that sticks under the bar uses `top: var(--topbar-h)`.
  - **No net chat** on logged-in pages (removed by the developer, 2026-10-29, now that the home page has the boot scrawl and its chat).
  - **Under 77rem wide** (an owner's full tab set, with Lore, needs about 75rem; measured 2026-11-16, keep about 2rem spare for long names): the bar shows the logo, Disconnect and Menu; Menu opens a drawer under the bar with the tabs as 44px rows, the GM tabs under a `GM` label, and who you are. It closes when you pick a page.
- **Pages** (each route's `meta.title` and `meta.summary` in `src/router.ts` head the page through `src/components/PageHeader.vue`: the title large in `--text`, sentence case, the summary dim, a rule under them):
- **Breadcrumbs:** `PageHeader.vue` takes an optional `crumbs` list (`{ label, to? }`), drawn above the title (`registry / WARDEN / lantern ii`), the last one the current page.
- **Labels** are short words in sentence case ("My pilot", "Pilot registry"), drawn UPPERCASE by `.label` / `.sheet-label` / buttons where they're labels; never snake_case or terminal decoration. Buttons say plainly what they do ("Uplink with Discord", "Disconnect"). Only the home and login screens keep the old lowercase `[ option ]` look.
