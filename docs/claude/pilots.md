# Pilots

Covers: Pilots: the three tabs, who sees what, death, the field list and what the site does not track.
See also: [backstory.md](backstory.md), [pilot-inventory.md](pilot-inventory.md), [levelling-and-manna.md](levelling-and-manna.md), [reputation.md](reputation.md), [images.md](images.md), [dossier-page.md](dossier-page.md).

- Three tabs: **Pending**, **Approved** and **Dead**.
- **New character:** the player fills in a template and submits it, and it shows as pending. When a GM approves it, it moves to Approved. **Submission is up to the player** (the developer, 2026-11-19): a new pilot is a **draft** (`characters.submitted_at` null) until they press `Submit pilot`, and only submitted pilots reach the GM queue and the Pending tab. Starting to write is never submitting.
  - Suggested in `docs/database-sketch.md`: a new character is a normal character with status pending, which the player edits directly until a GM approves it. Pending changes are only for approved characters.
- **Every logged-in user can see every character (pending, approved and dead), and almost everything on it** (the developer, 2026-11-19: "aside from a toggled backstory, I want all pilot information to now be public"):
  - Pilot card (the `characters` row): name, callsign, age, gender, sexuality, height, weight, eye colour, hair colour, appearance description and image, personality, and traits (narrative: what the character is good at).
  - Mech card: name, appearance, image, manufacturer ID.
  - **The whole sheet except the backstory:** stats, biomods, loadout, licences, talents, core bonuses, every mech's frame, loadout, mods and history, plus **level** (and so licence level). Other players read it through `pilot_sheet(target_character_id)` (migration `20261119200000_public_sheets.sql`, tested in `supabase/tests/public_sheets.test.sql`): `security definer`, returns `(sheet, level)` with `backstory` removed, for any status, to any logged-in user (revoked from `anon`; an unknown pilot gives no row). `character_sheets` keeps its RLS (own player, GMs and owners), because it holds the backstory and the review note; a direct select by anyone else still returns nothing.
  - **Still private:** the backstory (the player can make it public, see [backstory.md](backstory.md)), **manna** (the developer's correction, 2026-11-19: only the pilot's player and GMs see how much a pilot has received, spent or has left; the function never returns it, and other viewers' pages show no manna figures or manna blocks), the GM's review note (`character_sheets.review_note`), draft and submitted changes (`pending_changes`: only their own player and GMs), experience and the reward log, reputation, and anything GM-only. The function never returns the note or those tables.
- **Death:** GMs, owners, or the character's own player can mark a character dead. Everyone can see the Dead tab. Dead characters can't come back (a database trigger refuses any change away from dead, even from GMs and owners).
  - A player marking their own character dead needs **no GM approval**, just a "are you sure?" confirmation on the page.
  - Players can't update the characters table directly, so this needs a small database function. It checks that the caller owns the character (or is a GM or owner), and refuses to change a dead character back. A flash clone counts as a new character, which the player submits for approval as usual.
- **COMP/CON import:** dropped (the developer, 2026-11-19). Not planned.
- **The full field list** (from the developer, 2026-10-28):
  - Profile: name, callsign, age, gender, eye colour, height, weight, sexuality, hair colour, personality, appearance description, appearance image, and traits.
  - Pilot stats: physicality, dexterity, perception, acuity, tech-fluency.
  - Mech skills: hull, systems, agility, engineering.
  - Also: licences, weapons and equipment (pilot gear only), bionics/bodymods, backstory.
  - Mechs (added in a follow-up answer): several per pilot, each with a name, appearance description, image, weapons on the frame's mounts, a manufacturer ID, and systems with system points.
  - Confirmed as staying, though not on the list: talents, core bonuses, licence level, pilot HP, manna and mod points.
- **It's a general character manager, not a combat tracker.** It doesn't track current HP, structure, stress or heat.
- **Not used:** skill triggers (replaced by custom pilot stats), save target, sensors, LANCER backgrounds, bonds, and (not on the field list) reserves. **Weapon mods are used** (the developer, 2026-11-17: a core part of the game): see "Weapon mods" in [mech-loadout.md](mech-loadout.md).
