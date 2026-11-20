# Colours and type

Covers: The terminal look, colour variables, fonts, page text and sharp-text rules.
See also: [ui-principles.md](ui-principles.md), [buttons-and-dialogs.md](buttons-and-dialogs.md).

- The site is styled as an **in-universe COMP/CON terminal operated by HORUS on HOR_OS**, similar to LANCER's existing in-universe material. I'll suggest styling ideas as they come.
- **Decided base look:** a glitch terminal with a dark grey background, white general text, and pastel purple and red accents. It should be easy on the eyes, stylised but readable, especially on character pages.
  - **Colours** are variables in `src/style.css`, ported from the prototype (its legend is the source of truth for each colour's job): surfaces `--void`, `--panel`, `--raised`, `--rule`, `--edge` (control outlines); text `--text`, `--text-dim`; `--lilac` (interactive only); status `--ok`, `--wait`, `--danger`, `--dead`, `--info`; game colours `--dmg-*`, `--act-*`, `--type-*`; manufacturers `--mf` (set per element from the pack's colour; accent only: the logo and a 3px top border, never text or a tint). The old accents `--rose` and `--sky` are only for the login screen, the home page's boot sequence and the glitch; nothing else uses them. Use the variables, not new hex values (unused variables were removed in the 2026-11-20 cleanup).
  - **Fonts** are bundled with the site (no Google Fonts, for privacy): Atkinson Hyperlegible Next (`--sans`) for everything on logged-in pages; Cascadia Mono (`--mono`) only for numbers and codes (`.num`, `.code`, number inputs) and the boot scrawl, whose ASCII art needs its block and shade characters (`░▒▓█▄▀`). Type scale `--fs-xs/s/m/l/xl` (12/14/16/20/28px), spacing `--space-xs/s/m/l/xl` (4/8/12/16/24px), `--radius`, `--tap` (36px, 44px on touch). Short labels, headings, tabs and buttons are UPPERCASE and letter-spaced (`.label`).
  - **Logged-in pages: clear and simple over stylised** (the developer's direction, 2026-10-29). Every page looks like the pilot sheet: a plain header, sections with `.sheet-label` tags, in a centred column (2026-11-15, see [dossier-page.md](dossier-page.md)).
- **Page text** is Atkinson Hyperlegible Next. Use `.prose` for anything read at length, `.dim` for secondary text, `.num` / `.code` for numbers and codes.
- **Sharp text matters** (it was blurry on a 2560px monitor once):
  - Font sizes should land on whole pixels. 1rem stays 16px (the body font is set on `body`, not `:root`), and the ASCII art's size is rounded with `round()`.
  - Don't animate `transform` on text, and don't use `mask-image` on it. Both make the browser draw the text as a separate image, which blurs it.
