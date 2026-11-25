# Look and feel

## UI principles

- **Readability and usability come first** (the developer, 2026-11-16). This outranks everything else here, and where any page detail in these docs conflicts with it, this rule wins:
  - Everything is **readable at a glance**: the same kind of thing always uses the same symbol and colour. Each colour has **one job** and colour is never the only signal (always a symbol or word too).
  - **Standardised and clean:** one way to draw each kind of thing (button, card, tab, stat, tag, notice), reused everywhere. Follow COMP/CON's conventions for how game things are shown unless there's a reason not to (without copying its code).
  - The **terminal styling is flavour, not structure.** Drop it where it costs readability or usability.
  - **The site-wide redesign** (2026-11-16) covers every page except the login screen, which stays exactly as it is. All phases are built: 1 (foundation: tokens, type, base controls, icons, top bar, section tabs), 2 (shared content components), 3 and 4 (pilot sheet, mech page, archives), 5 (registry cards, GM pages), 6 (content page, writing editor, confirm dialog, portraits) and 7 (a consistency pass).
- **Redesign direction** (the developer's answers, 2026-11-16):
  - **What was wrong:** monospace text everywhere, colours with several meanings, terminal decoration (`[ brackets ]`, `> label // private`, `// empty //`, all-lowercase), and layout and density (stacked sticky bars, centred text and lists, hard to scan).
  - **Flavour: a light touch.** Dark theme, the HORUS logo and the accent colours stay. Everything else is a clean game app in the spirit of COMP/CON. Terminal touches only in the logo, the home page and small details such as empty states.
  - **Labels: COMP/CON style.** Short UPPERCASE labels in a readable sans font (Atkinson Hyperlegible Next), sentence case for anything read, numbers in the monospace font so they line up. No `>` prompts or `//` tags.
  - **Colour: one job per colour, following COMP/CON closely.**
    - The interface accent (lilac) only marks things you can click and where you are.
    - Status colours are separate (OK/added, pending, danger/dead/removed).
    - Teal (`--gm`) marks GM and owner tools only: ways into GM modes (`.gm` on a button or link, label always says "GM") and the `.private.gm` "GM only" / "Owner only" tags. Buttons inside GM screens keep their meaning colours.
    - Game meanings (damage types, action types, ranges, manufacturers and so on) use COMP/CON's colours and symbols, always with a symbol or word as well.
  - **Player customisation exception** (2026-11-20): the one-job rule doesn't apply to a pilot's own colour (`--pilot`). It is decoration only: borders, bars and outlines on their sheet, gallery and card. Never a button, link, tab, status, icon meaning or text colour.
    - `displayColour()` in `src/pilotColour.ts` (tested) mixes a too-dark stored colour with white in 5% steps until it has at least 3:1 contrast with `--panel`, so it also shows on `--void`. Stored values stay as picked. Always read `--pilot` through `displayColour()`.
  - **Identity colour** (the developer, 2026-11-20): a page's identity colour (the pilot's `--pilot` on the pilot page, the maker's `--mf` on the mech page) gets the same amount of colour on both: the header (pilot: banner gradient, portrait brackets and the cover's small rules, mech: the plate's logo, 3px top border and faint band), the section-title dashes and the stat tiles' top strip. Nothing else: not the file index (its marker is lilac, it's interactive), not charts or radars, item cards, text, buttons or icons. Outside these pages the maker colour stays the logo and a 3px top border (hangar cards, information dialogs).
  - **Alignment: left-aligned** for anything read at length or compared down a column (lists, rules text, tables). **Important, singular showcase things are centred** (the developer, 2026-11-16): mech cards in the hangar, stat tiles, numbers in boxes, empty-state messages, manufacturer cards.
  - **Archives layout (decided 2026-11-16): list + detail pane**, like COMP/CON's compendium. Desktop: a slim list of names grouped by manufacturer/licence with one or two key facts, and the selected entry's full card beside it. Phones: the list, and tapping opens the entry.
  - **Density: compact, like COMP/CON** (tighter cards and gaps, comfortable text size). **Devices: phone and desktop equally**, every page works fully on both.
  - **Process:** audit the current UI, a static **mockup** (pilot sheet, mech page, an item card) for the developer to approve, then the shared components, then the pages rebuilt one at a time.
  - **Mockup approved** (the developer, 2026-11-16: "exactly the direction I meant"). **The reference for every redesigned page is `docs/redesign/prototype/`** (`index.html`, `styles.css`, `icons.svg`, open it through the dev server at `/docs/redesign/prototype/index.html`, sections `#legend`, `#pilot`, `#mech`, `#mech-gms`, `#items`). The developer's copy is the private design canvas https://claude.ai/artifact/R6GikboW5BhycsmD49RuuY. It settles:
    - **Colour jobs** (the legend's table is the source of truth): lilac = interactive only. Status: `--ok` (approved, saved, added), `--wait` (pending, draft, draft dashed), `--danger` (rejected, rule broken, removed, over budget, destructive), dead = dim with a skull, `--info` (neutral notes).
    - COMP/CON's damage-type colours (icons only), action/activation colours (clipped chips, chip before the action's name, actions always shown in full), item-type header colours (weapon grey, system green, frame/licence purple, pilot gear/bionic teal, talent brown, core bonus lime with dark text).
    - Manufacturer colour only as the logo and a 3px top border, never text or a tint, except the mech page's header band (see Identity colour).
    - **Symbols:** an SVG sprite drawn in `currentColor`: the existing LANCER stat/range/damage icons, COMP/CON's cci icons (GPL-3.0) and Lucide (ISC, needs a README credit). Accepted: HASE (hull anvil, agility wind, systems chip, engineering wrench) and personal stats (physicality dumbbell, dexterity hand, perception eye, acuity lightbulb, tech-fluency code brackets).
    - **No dark inset boxes** (the developer, 2026-11-16): actions, deployables, frame traits, core powers and talent ranks inside a card or the information dialog sit on the card's own surface, separated by spacing and a thin `--rule` line. The action chip and bold name mark where an action starts. No `--void` sub-panels inside cards (stat tiles excepted).
    - **Patterns:**
      - Only GM-only and owner-only sections carry a lock tag (the developer, 2026-11-19: "remove the private tags from everything except backstory, where players can toggle it on/off"). The pilot sheet, mech page, loadouts and rank panels show no "Private" tags. The backstory's toggle ([Backstory](pilots.md#backstory)) is the one place a private state is drawn.
      - A blocked action is a disabled button keeping its label and cost ("Raise rank · 600") with the reason beside it in secondary text.
      - Item names are buttons that underline on hover/focus. One empty-state look.
      - Stats are tiles on desktop and one-line rows (icon, name, value, − / +) on phones.
      - Tab rows scroll sideways with a fade cue on phones. The slim top bar stays fixed on phones too.

## Colours and type

- The site is styled as an **in-universe COMP/CON terminal operated by HORUS on HOR_OS**, similar to LANCER's existing in-universe material.
- **Decided base look:** a glitch terminal with a dark grey background, white general text, and pastel purple and red accents. Easy on the eyes, stylised but readable, especially on character pages.
  - **Colours** are variables in `src/style.css`, ported from the prototype (its legend is the source of truth for each colour's job): surfaces `--void`, `--panel`, `--raised`, `--rule`, `--edge` (control outlines), text `--text`, `--text-dim`, `--lilac` (interactive only), status `--ok`, `--wait`, `--danger`, `--dead`, `--info`, game colours `--dmg-*`, `--act-*`, `--type-*`, manufacturers `--mf` (set per element from the pack's colour, accent only). The old accents `--rose` and `--sky` are only for the login screen, the home page's boot sequence and the glitch. Use the variables, not new hex values (unused variables were removed in the 2026-11-20 cleanup).
  - **Fonts** are bundled (no Google Fonts, for privacy): Atkinson Hyperlegible Next (`--sans`) for everything on logged-in pages, Cascadia Mono (`--mono`) only for numbers and codes (`.num`, `.code`, number inputs) and the boot scrawl, whose ASCII art needs its block and shade characters (`░▒▓█▄▀`).
  - Type scale `--fs-xs/s/m/l/xl` (12/14/16/20/28px), spacing `--space-xs/s/m/l/xl` (4/8/12/16/24px), `--radius`, `--tap` (36px, 44px on touch). Short labels, headings, tabs and buttons are UPPERCASE and letter-spaced (`.label`).
  - **Logged-in pages: clear and simple over stylised** (the developer, 2026-10-29). Every page looks like the pilot sheet: a plain header, sections with `.sheet-label` tags, in a centred column (2026-11-15, see [Pilot page (dossier)](pilot-and-mech-pages.md#pilot-page-dossier)).
- **Page text** is Atkinson Hyperlegible Next. Use `.prose` for anything read at length, `.dim` for secondary text, `.num` / `.code` for numbers and codes.
- **Sharp text matters** (it was blurry on a 2560px monitor once):
  - Font sizes land on whole pixels. 1rem stays 16px (the body font is set on `body`, not `:root`) and the ASCII art's size is rounded with `round()`.
  - Don't animate `transform` on text and don't use `mask-image` on it. Both make the browser draw the text as a separate image, which blurs it.

## Buttons and dialogs

- **Shared pieces** (`src/style.css`, from the prototype):
  - `.panel` (a page section: `--panel` fill, thin border, radius) with `.panel-head` (left-aligned).
  - `.panel.danger-zone` (an irreversible action: faint red border, a sentence in `.danger-body` and a `.danger` button, any error a `.notice.warn` under it, used on the pilot sheet, mech page, lore editor, GM review).
  - `.notice` (a banner with its symbol drawn by CSS: `.info` default, `.warn` danger with a warning sign, `.ok` with a tick, `.notice-head`, `.notice-title`).
  - `.badge` (a pill: `.draft` dashed, `.pending`, `.approved`, `.rejected`, `.dead`, each with its symbol by CSS, a badge with no status is plain).
  - `.chip` / `.chips` (square neutral tag chips), `.sep` (a dot-separated line), `.empty` (the one dashed empty state), `.meter` / `.meter-inline` (budgets, `.full`, `.over`), `.table`, `label.field` (an uppercase label over a control).
  - `.private` (a lock and a word, "GM only" or "Owner only", beside a section heading, no longer used for "Private" except the backstory's read-only state).
  - `.blocked` / `.blocked-reason` (a disabled button keeping its label and cost, the reason beside it), `.tabs` / `.tab` (underline tabs).
  - `.list-pane` (the archives and editor list + detail layout) and `.next` (the "what happens next" bar) live in `style.css`, not in their components (2026-11-20 cleanup).
  - `dialog.dialog` (`--mf` border, 3px top, a full-screen sheet on phones, see [Pickers and information](pilot-and-mech-pages.md#pickers-and-information)).
  - Form fields: a dark box with an `--edge` outline that turns lilac in use. Colour pickers (`input[type='color']`) are drawn the same way, as a swatch of the colour instead of browser chrome. `.colour-input` joins a hex box and its picker into one control (2026-11-21).
- **Buttons** (the prototype's): lilac uppercase text in an `--edge` outline that turns lilac with a faint tint on hover. `.primary` (filled lilac, one main action per view), `.danger` (`--danger` text and outline, tinted on hover), `.quiet` (a text action), `.small`. Disabled buttons go dim and keep their label. The global rules are in `:where()`, so a component's own button rule always wins.
  - **`.option` keeps the old terminal look:** `[ like this ]` in lilac, turning into `> like this <` in rose when hovered or selected. Only on the home and login screens, and it resets every part of the button look so they stay as they were.
- **"Are you sure?"** uses the site's own dialog: `confirmAction(message, { confirmLabel, danger })` in `src/confirm.ts` (a promise of true/false), drawn by `ConfirmDialog.vue` in `App.vue` in the shared `dialog.dialog` frame: a `.dialog-head` ("Are you sure?"), the message, and a foot with `Cancel` (`.quiet`) and the confirm button (`.primary`, or `.danger` when `danger`). Destructive questions start on Cancel. Nothing uses `window.confirm`.

## Layout and navigation

- **Layout** (`src/App.vue`):
  - **Top bar** (the prototype's), sticky on every screen size, height `--topbar-h` (56px, 52px on phones): the HORUS logo art, small (`src/assets/logo.txt` at 4px, linking home), then the underline **tabs** My pilot, Registry, Archives, Lore, Combat. For GMs and owners: a thin divider, a `GM` label and Pilots, Changes (owners also Content). Then the operator's name with their role as a `.label` (the box is `.account`, renamed from `.user` in the 2026-11-20 cleanup so the name no longer picks up the chat's sky colour) and Disconnect (`.quiet.small`).
  - The current tab is lilac with a lilac underline (`aria-current="page"`). A page under a tab marks it through route `meta.section`, and a pilot record or its mech marks Registry. `/pending` and `/memorial` redirect to the registry's tabs. `/combat` is the combat guide. `/pithub` has no tab (reached from the home page's art).
  - **The page** under it is a centred column (`.page`, at most `--page-max`, 84rem). Anything that sticks under the bar uses `top: var(--topbar-h)`.
  - **No net chat** on logged-in pages (removed by the developer, 2026-10-29, now that the home page has the boot scrawl and its chat).
  - **Under 77rem wide** (an owner's full tab set, with Lore, needs about 75rem, measured 2026-11-16, keep about 2rem spare for long names): the bar shows the logo, Disconnect and Menu. Menu opens a drawer under the bar with the tabs as 44px rows, the GM tabs under a `GM` label, and who you are. It closes when you pick a page.
- **Pages:** each route's `meta.title` and `meta.summary` in `src/router.ts` head the page through `src/components/PageHeader.vue` (the title large in `--text`, sentence case, the summary dim, a rule under them).
- **Breadcrumbs:** `PageHeader.vue` takes an optional `crumbs` list (`{ label, to? }`), drawn above the title (`registry / WARDEN / lantern ii`), the last one the current page.
- **Labels** are short words in sentence case ("My pilot", "Pilot registry"), drawn UPPERCASE by `.label` / `.sheet-label` / buttons where they're labels. Never snake_case or terminal decoration. Buttons say plainly what they do ("Uplink with Discord", "Disconnect"). Only the home and login screens keep the old lowercase `[ option ]` look.
- **Other routes** (2026-11-21): `/privacy` is public (linked from the login footer and the top bar or drawer, logged-in users also get the account Danger zone there). Any unknown path shows `NotFoundView` ("Page not found", Go home). A crash anywhere shows `src/crash.ts`'s plain-DOM screen. A lazy chunk that fails to load reloads once (sessionStorage guard).
