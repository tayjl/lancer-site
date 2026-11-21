# Login boot

Covers: The login boot scrawl.
See also: [pages-home-lore.md](pages-home-lore.md), [game-data.md](game-data.md).

- **No visible divider lines** between the login screen's sections; spacing separates them.
- **Glitching** only on the login screen's ASCII art (a colour-split jolt every few seconds) and the HORUS greeting in the archives (the developer's request, 2026-10-31). It's the shared `.glitch` class and `glitch` keyframes in `style.css`. Page titles no longer glitch (clear over stylised), except Pithub's title (the developer asked for heavy styling, 2026-11-21). On the home page (not login) the art becomes a link to `/pithub` once the whole boot has played (`BootSequence` `link` prop), with no hover hint. Never on body text or anything people read. It switches off for people who prefer reduced motion.
- **The login page is a boot scrawl** (`src/components/BootSequence.vue`), laid out as a full-screen terminal:
  - **Rows:** the h0r_os ASCII art pinned at the top, the log in the middle, and the `[ uplink with discord ]` option centred at the bottom (`src/views/LoginView.vue`; `--tap` high in a narrow column).
  - **Order:**
    1. COMP/CON's HORUS start-up text prints in the log, then the art fills its (reserved) space at the top, then the connection log and MOTD print. Text lines come every 320ms (intro) and 260ms (connection log); art lines every 35ms.
    2. The Uplink button appears, already selected.
    3. A fake HORUS chat keeps arriving in the log under the MOTD, in slightly smaller text, one message every 1.1s.
  - **The log doesn't scroll.** It works like `tail`: its height snaps to a whole number of lines, new lines appear at the bottom, and old ones drop off the top. Every line is the same height (the chat's line height matches the log's), so no line is ever cut in half. A wrapped message that's partly off the top is hidden.
- **Where to edit it:** the text lives in `src/assets/boot/` (`intro.txt`, `art.txt`, `connect.txt`, `chat.txt`).
  - `chat.txt` is ours to edit freely. Lines are `username: message`, optionally starting with `[ MOD ]` (purple tag) or `[ ADMIN ]` (red tag). The `username:` is sky blue and the message white. Inside a message, `@mentions` are sky blue and `<SYSTEM MESSAGES>` in angle brackets are purple. Ban notices wrapped in `// ... //` are entirely red. (All in `src/chat.ts`.)
  - **Small phones** (a column under 28rem) show `art.txt` without the arrow banner at the bottom: everything from the first `>>>>` line on is dropped, worked out in code, so there's only one file to edit. Bigger screens show all 27 lines. The art's size on phones is limited by its 80-column width (about 7px on a 375px phone), so dropping lines frees vertical space rather than enlarging it.
  - An empty line in any of the text files shows as a blank line.
  - The phrases highlighted in rose inside the art are listed in `ART_PARTS` in `BootSequence.vue`. Update that list if those words change in `art.txt`.
- **Behaviour:** any key or a click skips to the end, and it's instant for reduced motion.
- **Layout:** one centred column, at most 47rem wide, which matches the art at its 16px maximum. The art scales to fill the column (container query units), so the text and art share edges, and the art shrinks on phones instead of wrapping.
  - On shorter screens the art also shrinks to leave room for the log, and the column narrows with it, but not below 34rem.
  - On very short screens (under 30rem tall, e.g. a phone held sideways) nothing is pinned and the page scrolls normally.
  - Text is slightly larger on wide screens.
  - It comes from COMP/CON (`src/features/main_menu/_components/startup_logs/horus.ts`, GPL-3.0, Massif Press) and is credited in the README. The `∙` character was swapped for `•`, because no bundled font has `∙` and it would break the art's alignment.
