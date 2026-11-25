# Pilots

## Pilot basics

- Three tabs: **Pending**, **Approved**, **Dead**.
- **New character:** the player fills in a template and submits it. A GM approves it and it moves to Approved.
  - **Submission is up to the player** (the developer, 2026-11-19): a new pilot is a **draft** (`characters.submitted_at` null) until `Submit pilot`. Only submitted pilots reach the GM queue and Pending tab.
  - Suggested in `docs/database-sketch.md`: a new character is a normal character with status pending, edited directly by the player until a GM approves it. Pending changes are only for approved characters.
- **Every logged-in user sees every character (pending, approved, dead) and almost everything on it** (the developer, 2026-11-19: "aside from a toggled backstory, I want all pilot information to now be public"):
  - Pilot card (the `characters` row): name, callsign, age, gender, sexuality, height, weight, eye colour, hair colour, appearance description and image, personality, traits (narrative: what the character is good at).
  - Mech card: name, appearance, image, manufacturer ID.
  - **The whole sheet except the backstory:** stats, biomods, loadout, licences, talents, core bonuses, every mech's frame, loadout, mods and history, and **level** (so licence level).
  - Other players read it through `pilot_sheet(target_character_id)` (migration `20261119200000_public_sheets.sql`, tested in `supabase/tests/public_sheets.test.sql`): `security definer`, returns `(sheet, level)` with `backstory` removed, any status, any logged-in user. Revoked from `anon`. An unknown pilot gives no row.
  - `character_sheets` keeps its RLS (own player, GMs, owners) because it holds the backstory and review note. A direct select by anyone else returns nothing.
  - **Still private:** the backstory (the player can make it public, see [Backstory](#backstory)), **manna**, the GM's review note (`character_sheets.review_note`), draft and submitted changes (`pending_changes`: own player and GMs), experience and the reward log, reputation, anything GM-only. The function never returns the note or those tables.
  - **Manna** (the developer's correction, 2026-11-19): only the pilot's player and GMs see received, spent or left. Other viewers' pages show no manna figures or blocks.
- **Death:** GMs, owners or the character's own player can mark a character dead. Everyone sees the Dead tab. Dead characters can't come back (a database trigger refuses any change away from dead, even from GMs and owners).
  - A player marking their own character dead needs **no GM approval**, just an "are you sure?" confirmation.
  - Players can't update the characters table directly, so a small database function does it. It checks the caller owns the character (or is a GM or owner) and refuses to revive. A flash clone is a new character, submitted for approval as usual.
- **COMP/CON import:** dropped (the developer, 2026-11-19). Not planned.
- **Full field list** (the developer, 2026-10-28):
  - Profile: name, callsign, age, gender, eye colour, height, weight, sexuality, hair colour, personality, appearance description, appearance image, traits.
  - Pilot stats: physicality, dexterity, perception, acuity, tech-fluency.
  - Mech skills: hull, systems, agility, engineering.
  - Also: licences, weapons and equipment (pilot gear only), bionics/bodymods, backstory.
  - Mechs: several per pilot, each with name, appearance description, image, weapons on the frame's mounts, manufacturer ID, systems with system points.
  - Confirmed as staying, though not on the list: talents, core bonuses, licence level, pilot HP, manna, mod points.
- **A general character manager, not a combat tracker.** No current HP, structure, stress or heat.
- **Not used:** skill triggers (replaced by custom pilot stats), save target, sensors, LANCER backgrounds, bonds, reserves.
- **Weapon mods are used** (the developer, 2026-11-17: a core part of the game). See "Weapon mods" in [Mech loadout](pilot-and-mech-pages.md#mech-loadout).

## Pilot profile

- **Customisation** (migration `20261120090000_pilot_profile.sql`, tested in `supabase/tests/pilot_profile.test.sql`, on the hosted project): cosmetic, **public to every logged-in user**, **saves live with no GM approval, even on approved pilots** (game parts still go through changes). The pilot's own player writes it unless the pilot is dead. GMs and owners write any (GM edit mode).
- **Table `pilot_profiles`** (one row per pilot, `character_id` primary key, cascade):
  - `colour` (`#rrggbb`, check constraint).
  - `motto` (at most 120). A growing, wrapping textarea (Enter leaves it) so long mottos don't clip on phones.
  - `banner_image` (upload path, same shape check as `pilot_image`).
  - `gallery` (jsonb array of at most 4 `{path, caption}`, upload-shaped paths, captions at most 140, trigger `private.check_pilot_gallery()`).
  - `updated_at`.
  - Players insert and update, never delete. GMs and owners insert, update, delete.
  - Uploads use the existing `character-images` bucket policies unchanged (own folder in, own folder or GM anywhere out).
- **Code** (`src/pilotProfile.ts`, `usePilotProfile(characterId)`, used by `PilotManageView.vue`):
  - `ready` stays false if the read fails, so nothing is saved over an unseen profile.
  - Each save sends the whole on-screen profile, one at a time. The first is an upsert. Later ones update with `.eq('updated_at', <raw string>)` through `checkWrite()` and set `conflict` (the page's `ConflictNotice`) when someone else saved first.
  - Failures keep the edit and `Retry` re-sends. Unused images are deleted best-effort after a successful save.
  - `profileEditable` in the page is separate from the sheet's `editable`: your own living pilot (any status) or a GM in edit mode.
- **Header:**
  - Banner (`ImageUpload` with `noun="banner"` and `BANNER_SIDE` 1600, the only image bigger than 1024px) is the cover's top strip: 9rem (6rem on phones), `object-fit: cover`, fading into the panel at its foot, pilot colour as a 2px line under it. Uploaded in the cover's tools while editing.
  - Motto sits under the name in italic `--text-dim` between quotation marks in the pilot colour (drawn by CSS, not stored). Inline field while editable, saved on leaving it.
  - The cover's top border is 3px in the pilot colour.
- **Banner position** (migration `20261120110000_banner_position_and_public_card.sql`, on the hosted project): `pilot_profiles.banner_x` / `banner_y` (0 to 100, default 50, the `object-position` in percent) and `banner_zoom` (1 to 3, default 1, a `scale()` from that point). Saved with the profile. A new or removed banner resets to centred (`BANNER_CENTRED`). Set with `Position banner` (see [Pilot page (dossier)](pilot-and-mech-pages.md#pilot-page-dossier), Cover).
- **Colour field** (the cover's tools): `PilotColourField.vue`, hex box and swatch joined as one `.colour-input` control, `Reset colour` beside it. The sheet previews live and saves on release or leaving the box.
- **Gallery** (`PilotGallery.vue`, 08 Gallery): up to 4 thumbnails (4:3, `object-fit: cover`, four across, two columns on phones), each a button opening the picture and caption in a `dialog.dialog`.
  - Editable: `Add picture` (hidden at 4, "4 of 4 pictures" in dim text), per picture a caption field, `Replace`, `Remove`. Read-only viewers get no section when empty.
  - List changes are the pure functions `addPicture`, `replacePicture`, `removePicture`, `setCaption` (tested).
- **Registry cards:** `PILOT_FIELDS` embeds `profile:pilot_profiles(colour)` so cards load in one query. `PilotCard` takes `colour` (3px top border). The GM queues' cards don't use it yet. Cards also show a commendation count ([Service record and commendations](#service-record-and-commendations)).
- **Colour in the page:** the sheet root gets `--pilot` (and `.has-pilot`) when set. It also gives profile panels a 3px top border and the gallery's hover/focus outline and dialog border.

## Service record and commendations

- **Tables** (migration `20261120100000_timeline_milestones.sql`, tested in `supabase/tests/timeline_milestones.test.sql`, on the hosted project, types in `src/lib/database.types.ts`):
  - `pilot_timeline`: `kind` `player` | `gm` | `auto`, `title` at most 100, `body` rich-text jsonb or null, `occurred_on`. `created_by` is forced to the logged-in user. `character_id`, `kind`, `created_by`, `created_at` never change.
    - Everyone reads. A player adds, edits, deletes their own `player` entries on their own living pilot (a dead pilot's player can't write). GMs and owners add and edit `gm` entries anywhere and delete any entry.
    - **Nobody inserts `auto` entries directly.** Only the `security definer` triggers below.
  - `commendations`: unique `name`, `description` at most 300, `icon` = an icon name from `src/assets/icons`. Everyone reads, owners manage.
  - `pilot_commendations` (an award): `character_id`, `commendation_id` (both cascade), `reason` at most 300, `awarded_by` forced to the logged-in user, `awarded_at`. Everyone reads, GMs and owners give and take back.
- **Automatic entries** (`kind = 'auto'`, today's date, short title, no body, `security definer` triggers with a fixed `search_path`). Backfill migration `20261121100000_backfill_service_record.sql` covered pilots approved before 2026-11-20.
  - `characters` pending → approved "Approved for duty", → dead "Killed in action".
  - An approved pilot's `mechs` gaining an id: "New mech: {name}".
  - `character_sheets.level` rising on an approved pilot: "Reached level {n}".
  - An approved pilot's `sheet.licences` gaining a rank: "{frame name} licence, rank {I/II/III}" (name from `content_items`, `edited` before `data`, else the id).
  - A `pilot_commendations` insert: "Awarded {name}", reason as the body (one plain rich-text paragraph).
  - Pending pilots get no mech, licence or level entries (approval covers it). A revoke removes nothing (a GM deletes the entry by hand).
- **Service record UI** (`src/serviceRecord.ts`, `useServiceRecord(characterId)`, `src/components/ServiceRecord.vue`, 03 Service record, full width):
  - Vertical timeline, newest first (`sortTimeline()`: date, then when written). Shows 10, then `Show all N` / `Show fewer`. "No entries yet." when empty.
  - Each entry: date (sans, dim), `Log` / `GM` / `Record` label with a marker (`KIND_MARK`: pilot, shield, flag, `auto` markers dashed), bold title, body through `RichText`. Line and markers are `--pilot` (neutral `--edge` without one), decoration only.
  - The pilot's own player (own living pilot, any status) adds, edits, deletes their `Log` entries. A GM in GM edit mode adds `GM` entries and edits and deletes any (`Log`, `GM`, `Record`). The kind label never changes. The database lets GMs update and delete any timeline row.
  - Inline form: date, title (100), optional basic rich-text body, saved with `SaveStatus`. Edits are guarded by the entry's `updated_at` (`checkWrite`). Deletes use `confirmAction`.
- **Commendations, owners:** content editor **Commendations** tab (`CommendationPane.vue`, the `FactionPane.vue` pattern for site tables): explicit save, `updated_at` guard, `checkWrite`, unsaved guards. `Delete commendation` asks "Delete {name}? Pilots who have it lose it. This can't be undone." Name unique, description at most 300, icon radio grid from `ICON_CHOICES` in `src/commendations.ts` with a live `MedalBadge` preview. `validateCommendation()` in `contentEditor.ts`, `createCommendation` / `saveCommendation` / `deleteCommendation` in `editorStore.ts`.
- **Awarding:** GMs and owners, on GM review in a `GM only` "Commendations" panel (`CommendationAward.vue`), between Reputation and Reward history: a select, optional reason, `Award`, and what the pilot has, each with `Revoke` after a confirm. An award also reloads the service record. `usePilotAwards()` loads a pilot's awards with the commendation and awarder's name.
- **Display:**
  - The cover shows medals (`CommendationBadges.vue`, nothing when none): icon in a round badge ringed in `--pilot` (`MedalBadge.vue`) and the name. Each is a button opening a small dialog (description, reason, awarded by, date).
  - Registry cards show a small medal and count when above zero (`PILOT_FIELDS` embeds `awards:pilot_commendations(count)`, same single query).
  - Icons added from Lucide: medal, star, shield, flame, heart, crosshair, crown (`src/icons.ts` is the shared url lookup behind `Icon.vue`).

## ID cards and link previews

- **Pilot ID card** (`PilotIdCard.vue` on the shared `IdCardFrame.vue`, `src/idCard.ts`, `src/idCardExport.ts`): an in-universe Union pilot licence, in its own section 02 Pilot ID (centred, at most 36rem wide) with `Copy link` and `Download card` in the section head.
  - **Copy link:** approved or dead pilots only. Copies `/registry/<id>`, the address with the Discord preview (My pilot's `/pilot/...` shows whoever opens it their own pilot). The mech card's copies `/registry/<id>/mechs/<mech>`, as does a `Copy link` on the mech page's plate, same rule. All three copy buttons, lore's too, share `useCopyLink()` in `src/copyLink.ts`.
  - **Shape:** chip-card terminal read-out, credit-card sized. An SVG drawn at 856 x 540, scaled to fit (309px wide at 375), top-right and bottom-left corners cut (`CUT`, 48).
  - **Look** (techy, not a flat slab, 2026-11-19):
    - Dark panel with a faint 32px grid and a static diagonal sheen in the pilot colour. Thin `--rule` hairlines.
    - Pilot colour is edge light only: the two cut corners with a blurred glow, corner brackets at the square corners and around the portrait, a short rule under the header, the licence symbol, the medals' hexagon outlines and icons.
    - Header: licence symbol, "PILOT LICENCE", then "UNION · " and the serial in mono under it (`pilotSerial(id)`, `UNI-0042-XXXX-XXXX`: padded id then two Crockford base-32 codes from an FNV hash of it, deterministic), and a drawn contact chip. Pilots are licensed by Union, not HORUS: no HORUS branding and no department name (the developer, 2026-11-20).
    - Portrait in a sharp window (pilot symbol when none) with scan lines and a tint toward the pilot colour.
    - "CALLSIGN" as a small mono label over the callsign (52 units, weight 600), the name under it.
    - Level and Licence level as big mono figures. Status (lamp in its status colour: `--ok` approved, `--dead` dead, else `--wait`) and Issued (the approved date) smaller. Every label in the same small uppercase mono (22 units).
    - Footer: deterministic barcode of the serial (`barcodeBars()` in `src/idCard.ts`: guard bars, bars from FNV hashes, tested) and, on the right, commendation icons as hexagon medals (six at most, then "+N").
    - No microtext (it ran off the card).
  - **Export:** everything stays in the one SVG (patterns, gradients, blur filter, masks) and survives the PNG. Colours are read from the site's tokens once, because a downloaded picture has no stylesheet.
  - **`Download card`** makes a PNG with no library: clone the SVG, fetch every `<image>` (portrait, licence symbol, medal icons) and the two latin-subset fonts and inline them as data urls (an SVG drawn as an image can't load anything outside), draw to a 2x canvas (1712 x 1080), save as `<callsign>-id.png`. A picture that can't be fetched is left out and the note says so ("Downloaded, without the portrait (it couldn't be fetched).").
  - The card shows what the page shows, so with an open change on your own pilot it carries the change's draft figures and card.
- **Link previews** (Discord): a small Cloudflare Worker (`worker/`) runs only for `/registry/<id>`. For approved or dead pilots it returns `index.html` with og tags (title, description, colour), read through the public `pilot_card()` function.
  - The picture can't be drawn in the Worker (free-plan CPU limit), so the pilot's own browser saves it. `PilotIdCard.vue` does it silently 2s after the card settles, when the pilot is approved or dead, no change is open, and the viewer is the pilot's player (living pilot) or a GM.
  - It draws the card at 856 x 540 (`cardToPng(svg, 1)`), uploads it to `character-images/<player_id>/card-<id>.png` (under 1 MB) and saves a fingerprint of what the card shows (`cardFingerprint()`) as `pilot_profiles.card_version`.
  - The Worker puts `?v=<card_version>` on the image url so Discord refetches after any change. No saved picture yet: title and description only, no image tags.
- **In the pilot lists:** registry, pending and memorial show every pilot's card ([Registry](pages.md#registry)). `extra` is optional on `PilotIdCard` / `IdCardFrame`: none means no `Download card` (the record page passes `pilot-id-extra`). Every SVG id starts with `id-card-<pilot id>` (the frame's `prefix` and the card's own clips and masks), so cards on one page don't borrow each other's colours and clips.
- **Mech card** (`MechIdCard.vue`, the mech page's last section "Registration card", see [Mech page](pilot-and-mech-pages.md#mech-page)): the pilot card's twin on the same `IdCardFrame.vue` (856 x 540 SVG, cut corners, grid, sheen, edge light, outline, scan and tint patterns, `Download card` teleported to the section head, silent save).
  - The maker's colour (`makerColour`, only when the maker has its own) replaces the pilot colour (edge light, cut corners, brackets, short header rule). Without one the card is neutral (`--edge`).
  - Header: maker's logo (frame symbol without one), mech name big in uppercase, then "SOURCE NAME · " and the manufacturer id in mono ("No frame" with none).
  - Body left: the mech's picture in a bracketed window (its upload cropped to fill, else the frame art whole, else the maker's logo dim), with the pilot card's scan lines and tint.
  - Body right: the mech page's radar (`radarAxes()`) drawn by `RadarChart` in its `ink` mode (colours and font as attributes, each symbol a masked picture, labels just symbol and number, so it survives the PNG). Nothing without a frame.
  - Footer: "PILOT" over the callsign, Size and System points (used / total) as mono figures, barcode of the manufacturer id. Downloaded as `<mech name>-card.png`.
  - Its picture is saved by the same rules as the pilot card's (the pilot's player while alive, or a GM, approved or dead, never from an open change on your own pilot, only once the packs have loaded) to `character-images/<player_id>/mech-card-<character id>-<mech id>.png`. Its fingerprint is merged into `pilot_profiles.mech_card_versions[<mech id>]` through `usePilotProfile`, so other mechs' keys stay.
- **Mech link previews:** the Worker also handles `/registry/<id>/mechs/<mech id>` (the record mech route), read through the public `mech_card()` function.
  - og:title is the mech's name, og:description "IPS-N Blackbeard. Pilot: WARDEN." (just "Pilot: …" with no frame). Every player-typed value is escaped.
  - The image is used only when `card_image` is the path `mech_card()` builds (checked again by pattern). The mech's own image field is never used.
  - No theme colour: the maker's colour isn't readable without logging in. Tests: `worker/meta.test.ts`.

## Stats and rules text

- **Pilot combat stats:** HP 6, armour 0, speed 4, **e-defence 10** before permanent equipment/talent/core bonuses.
  - **Pilots have no evasion** (latest developer correction): ignore `pilot_evasion` bonuses and omit them from equipment cards. Keep pilot e-defence and normal mech evasion.
  - **Grit is shown** (the developer, 2026-11-19): a Grit tile in General stats, half the level rounded up, display only (nothing uses it).
  - No save target or sensors. Stats are public (2026-11-19), calculated, and have source disclosures.
- **Pilot stats are custom.** LANCER's skill triggers ("narrative triggers") are replaced by five homebrew stats: **physicality, dexterity, perception, acuity, tech-fluency**. Public to every logged-in user (see [Pilot basics](#pilot-basics)).
  - Each **base stat starts at 2** with **4 shared points** to allocate. Base stats stay within **2–4** and don't gain points with level.
  - Biomod modifiers apply afterwards and can take effective totals below 2 or above 4.
  - Existing saved allocations are not silently rewritten. Out-of-range or overspent bases are flagged for correction (developer's request, 2026-10-29).
- **Mech skills** (Hull, Agility, Systems, Engineering) gain allocation points with level. Pilot HP is 6 plus equipped gear bonuses, no level bonus.
- **HASE starts at 0** with 2 + level points (changed from "start at 1" for compliance). One-line change in `sheetStats()` if the developer wants 1 back.
- **Mech stats:** structure, stress, HP, heat cap, armour, evasion, speed, e-defence, tech attack, repair cap, system points, size. Calculated, never stored.
  - Speed gains floor(Agility / 2). E-defence and tech attack each gain Systems. Evasion uses the normal frame + Agility formula (no pending rework).
  - Grit, save target and sensors remain excluded.
- **Permanent build effects:**
  - `mechEffects()` collects frame traits, passive core bonuses, equipped weapons/systems (including integrated items), pilot gear, owned core bonuses, purchased talent ranks. `mechStats()` and rule checks share these effects.
  - `bonuses.ts` does safe arithmetic (known licence/HASE/size variables, no JavaScript evaluation), replacements and highest overrides.
  - Armour normally caps at 4, with `armor_max` modifiers. Fomorian Frame increments size up to 3.
  - `equipment.ts` applies matching weapon range/damage bonuses, Hunter II Thrown, selected profiles, Limited bonuses (including floor(Engineering/2)) and drone/deployable modifiers. Damage dice become the flat homebrew number (rounded up) once, after modifiers.
  - `coreRules.ts` supplements permanent core check modifiers missing from the pinned dataset's structured bonuses. `mechEffects()` adds a supplement entry only when the frame's (or core bonus's) own structured bonuses don't already carry it (newer data gives Exposed Reactor its bonus), so it never counts twice.
  - Conditional abilities and active core powers are readable reminders, never treated as permanently active. Unknown expressions/effects stay manual and are not evaluated as code.
- **Reminders** (the mech page's "other effects and conditions" list): frame traits and their actions, core passive and active power, core bonuses, talent ranks and bonuses not counted in the stats, in plain wording.
  - An action named like its trait or core power (COMP/CON's data often has both) is listed once, under the parent, with the action's chip and text (trigger and effect). Same in the full-information dialog (`absorb()` in `info.ts`), which also takes the action's numbers.
  - Each reminder (`Reminder` in `mechData.ts`) carries its `kind` (frame, trait, core, core-power, core-bonus, talent, item, missing), `name`, where it's `from` ("Brawler I"), any `activation`, and `uncounted` for bonuses the stats leave out ("+10 hp, only when exposed.", then a dim "Not counted in the stats.").
  - Left out: frame lore, COMP/CON's repeated `synergies` hints, equipped items' rules (their cards show them), pilot gear (only non-`pilot_*` bonuses count on a mech).
- **Talent grants and mount choices:**
  - Integrated talent equipment appears automatically. Exclusive grants upgrade to the highest owned rank. Optional special equipment is selectable only while granted.
  - Improved Armament, Integrated Weapon and Mount Retrofitting alter mounts. Auto-Stabilizing Hardpoints and Overpower Caliber target choices are per mech.
  - Choices live in `sheet.mechs[id].core_mounts`. Per-instance profile/prototype choices, a Variable weapon's `damageType` and the weapon's description (`notes`) live in `weapon_options` keyed `mount:place` or `integrated:item-id` (a swap resets it, a removal drops it).
  - System descriptions live in `system_notes` keyed by the system's index (a removal moves later ones down). Pilot gear descriptions live on the owned item (`owned_gear[].notes`, see [Pilot inventory](#pilot-inventory)).
  - New fields are included in GM change review. Lost mounts/talent ranks, invalid targets and stale profiles are rule-checked without silently deleting saved gear.
  - AI capacity includes The Lesson of Shaping. `mechResources()` shows AI/Limited capacity, structure repair cost, overcharge costs and permanent check accuracy apart from numeric stats.
- **Scope confirmed:** permanent character-building effects and readable combat reminders only. No current HP, heat, overshield, status toggles, expended charges, turn tracking or active-core-power state.
- **Rules text:** LANCER's rules text is small HTML. `src/rulesText.ts` parses it into an allowlist (paragraphs, bold, italic, underline, lists, line breaks, no attributes, other tags dropped). `RulesText.vue` draws it with Vue, never `v-html`, turning top-level line breaks into spaced paragraphs (`paragraphs()`), because imported packs are untrusted. Styled by `.rules-text` in `style.css` (bold keywords in bold white). `plainText()` flattens it for one-line picker summaries. Don't strip formatting with regexes elsewhere.
- **No dice** (the developer, 2026-10-31): no dice at all.
  - **Damage** is a flat number: the dice expression's mean rounded **up** (1d6 → 4, 2d6+1 → 8). It is the damage, not an average. Never label it "average" (`damage.ts`, item cards show "kinetic 4"). Shared item cards/pickers and explicit damage phrases in rules text use this.
  - Overcharge heat (1 → 1d3 → 1d6 → 1d6+4, or a frame's own list) is converted the same way, so the default reads 1 → 2 → 4 → 8 (`mechResources()`).
  - Other dice in game text (movement, rolls, Limited 1d6+2 and so on) stay as they are. The developer will give instructions for each or edit them in the content editor, so don't invent conversions. Variable/unsupported expressions stay visible, with no guessed values.
- **LANCER rules compliance** (the developer's request, 2026-10-29): `docs/lancer-rules.md` records every character rule the site follows (licences, HASE points, mounts, Superheavy, Unique, AI, system points and so on) and whether it's enforced, rule-checked, left to GMs or waiting on unbuilt features. Rules are in `src/rules.ts` (tested in `src/rules.test.ts`). `useCatalogue()` there gives the loaded game content in the shape the rule checks read, for the pilot sheet, mech page and change review. Keep that file current when rules change.
- **Core bonus equipment and mounts:**
  - `buildFrame()` takes the core bonus catalogue. A taken core bonus's `integrated` items join the mech's integrated items, its `special_equipment` is optional equipment (`talentGrants()`), and `replace_integrated: true` drops the frame's own integrated weapons (not systems).
  - `add_mount` (val = any mount type, optional `max` = "only if fewer than N mounts") and `superheavy_mounting` (a Superheavy mount if under 3 mounts) both count mounts excluding integrated ones.
  - `drone_hp` / `deployable_hp` already apply on item cards (equipment.ts).
  - The editor's `EFFECT_BONUS_TYPES` lists effect bonuses and their value kinds. `bonusCounted()` decides what the editor calls "not counted".
- **Homebrew effects:**
  - Every kind's bonuses are collected where they apply: mech ids in `mechEffects()` (each source has a stable `key`), pilot ids and the five personal stats in `pilotBonuses()` (gear, talent ranks, core bonuses, installed biomods) and `modPointLimit()`.
  - Equipped weapons, systems and installed biomods grant equipment through `grantingSources()` and `talentGrants()`.
  - Requirements: `unmetRequirements()` / `requirementReason()` in `src/rules.ts`.
  - Biomods read `effect_bonuses`, `integrated`, `special_equipment`, `replace_integrated` and `requires` from the bionics table once those columns exist. Rules table: `docs/lancer-rules.md`.

## Levelling and manna

- **Homebrew levelling and gear** (decided by the developer, 2026-10-29, `docs/lancer-rules.md`, prices in `PRICES` in `src/rules.ts`):
  - **Level** is gained narratively only: GMs and owners set it. It raises **HASE points (2 + level)** and **biomod capacity, the mod limit (6 + level)**. Nothing else.
  - **Manna buys everything else:**
    - Licence ranks **600** each. Talent ranks **300** each.
    - Biomods (bionics) at **their own price** (`bionics.manna_cost`, set in the content editor). Existing ones were set to 500 on 2026-11-18 so no balance changed.
    - Owned pilot gear that isn't free (its price, see [Pilot inventory](#pilot-inventory)).
    - **Mechs: the first is free, each one after it 500** (`PRICES.extraMech`, the developer, 2026-11-19). `mannaSpent(sheet, bionicPrices, mechs, gear, live)` takes the mech count from the card's `mechs` list, so scrapping a mech refunds it. Pilots who already had several mechs lost 500 per extra one. The hangar's `New mech` shows `New mech · 500` from the second and uses the blocked pattern with "Not enough manna". GM change review counts an added mech in the cost of change like any purchase.
  - **New pilots start with 2000 manna** (`STARTING_MANNA`, column default from migration `20261121090000_starting_manna_2000.sql`). Existing pilots keep what they have.
  - **GMS gear is free to print.** Licensed gear (frames, weapons, systems) is free once the pilot holds that licence rank.
  - **Licence level** is the number of licence ranks bought (no separate number).
  - **Alternate frames** (packs mark one with `variant` = the original's name and usually `license_id` = the original's id, e.g. Worldkiller Genghis, Empakaai): **one licence per original frame.**
    - Helpers `alternateOf()` / `licensedFrames()` / `licenceFrames()` / `chosenFrame()` in `mechData.ts`. The licence picker, archives' Licences and manufacturer counts list originals only. The alternate appears in the original's ladder at its own rank.
    - The pilot picks which frame the licence gives (`sheet.frame_choices`, licence id → frame id, free): radios on the licence card once the rank is held, a "Chosen frame" line when read-only. The frame picker blocks the other (`frameBlockedBy()` in `rules.ts`, "Licence gives X").
    - `mechProblems()` and `pilotProblems()` flag a mech on the wrong frame and a licence still held under an alternate's id (never auto-rewritten, a GM moves its ranks).
    - Change review shows a changed choice as an Updated line in licences. The frame form has an "Alternate of" select. Tested in `src/alternateFrames.test.ts`.
  - **Core bonuses:** one free pick per **3 licence ranks** bought.
    - Each non-GMS bonus also needs **3 ranks in its manufacturer**, across any of its licences (6 for a second bonus from that manufacturer, etc.). GMS bonuses have no manufacturer requirement.
    - The picker blocks ineligible choices. The shared rule check flags existing selections that lose eligibility, including in GM reviews. No bonus can be taken twice. Existing selections are never silently removed.
  - **Where it's stored:** `character_sheets.level` and `character_sheets.manna` (manna *received*, in total). Both GM-only: a trigger refuses changes from anyone else, even a player whose pilot is pending (migration `20261029022434_level_and_manna.sql`, which also dropped the old hand-set `mod_points`). What's **spent** is worked out from the sheet (`mannaSpent()`), so the balance (received minus spent) can't be faked, lowering a rank refunds it, and pickers block anything the balance can't cover.
  - **GMs set them** in the **gm: pilots** roster (editable level, experience, total manna received) or the rewards row of GM edit mode on the pilot's page (`Save rewards`). The roster's `Open sheet` links there. They save on their own button only: approving or sending back never needs them (the developer's request, 2026-10-29).
  - **Experience and the reward log** (migration `20261119160000_rewards_and_experience.sql`, tested in `supabase/tests/rewards.test.sql`, on the hosted project):
    - Experience is a **GM-only** number per pilot, 0–1000, in `pilot_progress` (`character_id` primary key, `experience`, `updated_at`, no row means 0). At 1000 the pilot is "ready to level", but nothing is automatic: a GM raises the level.
    - Every change to **level, manna received or experience** is recorded in `pilot_reward_log` (`character_id`, `field`, `old_value`, `new_value`, `reason`, `changed_by`, `changed_at`) by **triggers** (`private.log_sheet_rewards()` on `character_sheets`, `private.log_experience()` on `pilot_progress`, both `security definer`). A change made anywhere, the dashboard included, is logged (no reason, and `changed_by` null with no logged-in user).
    - **Both tables are GM-only.** RLS: GMs and owners read, nobody has a write grant, players and visitors get nothing, even for their own pilot. Kept apart from `character_sheets` because players can read their own sheet.
    - Writes go through two `security definer` functions that check `is_gm()` themselves:
      - `award(target_character_id, new_level, new_manna, new_experience, reason)`: nulls leave a field unchanged, whole numbers 0 or more, experience at most 1000. Sets the reason as a transaction-local setting `app.reward_reason` that the triggers read, all in one go.
      - `level_up(target_character_id, reason)`: refused below 1000 experience. Level + 1, experience − 1000, reason defaults to "Level up".
    - The roster and rewards row (`GmRewards.vue`) call them (`src/rewards.ts`: `award()`, `levelUp()`, `rewardsProblem()`, `describeReward()`, tested in `src/rewards.test.ts`). Nothing on the site writes level or manna to `character_sheets` any more. Players see nothing new.
- **Licence levels:** the pilot's licence ranks in each frame, bought with manna. Licence level is their total.
- **Talents and core bonuses:** included.
- **Manna:** the in-universe currency, not in LANCER's data. GMs record how much each pilot has received (`character_sheets.manna`). Spent is worked out from the sheet. Players never change it directly. It stays private to the pilot's player and GMs (the rest of the sheet and level went public 2026-11-19, manna did not).

## Biomods

- **Bionics / enhancements raise pilot stats.** Decided: they're the **site's own content**, not LCP content, stored in Supabase next to the list of custom pilot stats.
  - Each has a name, description, the stat bonuses it gives, a **manna cost** and a **mod-point cost**. A bonus can only point at a stat that exists in the list.
  - **Price, slot, effect** (migration `20261118120000_biomod_slot_effect_price.sql`, on the hosted project): `manna_cost` is the real price (`mannaSpent(sheet, bionicPrices)`, `bionicPrices` from `useGameData()`, an unknown id costs 0, changing a price moves the balance of pilots who have it). `slot` is where on the body (free text with suggestions, `BIONIC_SLOTS`, empty is a warning). `effect` is rules-text HTML.
  - **Manufacturer** (migration `20261119090000_biomod_manufacturer.sql`, on the hosted project): `bionics.source` is the id of one of the packs' manufacturers (null = none, listed under "Other"). `save_bionic` takes it as a last argument, `new_source`.
  - A HORUS, NHC or Exotic biomod is **GM edit only** for everyone, GMs and owners included (the developer, 2026-11-19). `bionicOptions` in `PilotManageView.vue` folds HORUS/NHC into the Exotic rule for biomods only, reason "GM edit only". See "The Exotic Gear tag" in [Content editor forms](game-content.md#content-editor-forms). Biomods have no tags.
  - Owners create and edit them in the content editor (`BiomodForm.vue`: name, slot, manufacturer (same option list as the item forms, empty is a warning), price, mod points, stat bonuses, description, effect). The editor tab and every visible label say "biomods".
  - Cards and the information show slot and price in the facts line, the effect as rules, the description as flavour (dim, italic, like lore).
  - **Mod points:** installed bionics can't cost more than the mod limit, 6 + level (see [Levelling and manna](#levelling-and-manna)). The sheet shows points used against the limit.
  - Installing a bionic is a normal pending change: add it and pay the manna. Once installed, it can only be swapped for a similar one. That rule isn't coded, GMs judge it when approving.
  - Bionics are public, like the rest of the sheet (2026-11-19). Characters store bionic IDs like any other item.
  - Only owners can add or change bionics, and stats (stats only in the Supabase dashboard, the content editor no longer edits them). One in use can't be deleted.
  - Owners can also add them in the Supabase dashboard's table editor. Anyone with dashboard access can change *everything*, so only trusted people get it.
  - Why not LCP: `cc-lcp-editor` has no bonus that targets a specific stat, reusing an existing bonus ID would clash with official items, and a custom ID would have to be typed into the JSON by hand.

## Backstory

- **Background:** a free-text backstory the player writes. LANCER's ready-made backgrounds aren't used.
  - **Private by default, and the player can make it public** (the developer, 2026-11-19). It is the only part of a pilot private from other players, and the only section whose privacy is shown and toggled.
  - **Storage:** the backstory stays in the private sheet (`sheet.backstory`). RLS is whole-row, so a public copy lives in its own table `pilot_public_backstory` (`character_id` primary key cascading from `characters`, `backstory jsonb`, `updated_at`), readable by every logged-in user, with **no direct writes for anyone**. **A row exists only while the backstory is public.** Migration `20261119190000_public_backstory.sql`, tested in `supabase/tests/public_backstory.test.sql`.
  - **`set_backstory_public(target_character_id, make_public)`:** `security definer`, callable by the character's own player or a GM or owner, any status. `true` upserts the row from the current `character_sheets.sheet->'backstory'`, `false` deletes it. It touches neither `characters` nor `character_sheets`, so their `updated_at` and the "changed since" approval check don't move.
  - **Following the sheet:** an after-insert-or-update-of-`sheet` trigger on `character_sheets` (`private.sync_public_backstory()`) refreshes an existing public row. So the public copy is the pilot's real sheet (a pending pilot's live edits, an approved pilot's approved backstory after a change is approved), never an unapproved draft change. A player with a draft change open sees their draft in the editor, others still read the approved text.
  - **Page** (`src/backstory.ts` `useBackstoryVisibility()`, `BackstoryVisibility.vue`, in `SheetField`'s `head` slot):
    - The Backstory panel's head has a Private | Public segmented control (real buttons with `aria-pressed`, a lock on Private). It saves at once with its own `SaveStatus`, in every status (a submitted pilot too). While public a dim line says "Everyone logged in can read this."
    - The pilot's own player and GM edit mode can change it. GMs and owners on records they can't edit, and the player on a record opened through the registry, see it read-only ("Private" with the lock, or "Public").
    - Viewers who can't read the whole sheet row (`canSeeBackstory` false: other players) see a Backstory panel only when a public copy exists (`RichText`).

## Reputation

- **GM-only: reputation.** Each character has a reputation level with each organisation. Even the character's own player can't see it. Players can read their own sheet, so it can't live in the sheet: it needs its own table plus a list of organisations. Owners manage organisations. GMs and owners set levels.
  - RLS is unchanged (GMs read and write reputation, owners manage factions and levels, players nothing) and no player page reads these tables. Tested in `supabase/tests/reputation.test.sql`.
- **Levels** are names, **fixed** (the developer, 2026-11-19): Hostile, Unfriendly, Neutral, Friendly, Allied, in that order. `reputation_levels.sort_order` 1 to 5, seeded idempotently by migration `20261119180000_reputation.sql`, which also adds `organisations.updated_at` for the editor's stale-save guard. No editor for levels.
- **Factions** are the `organisations` rows. Owners make, rename, delete them in the content editor's **Factions** tab (a site table like biomods, simpler: a list and a pane with just the name, `FactionPane.vue`).
  - `createFaction` / `saveFaction` / `deleteFaction` in `src/editorStore.ts`. Saving is explicit, guarded by `updated_at`, through `checkWrite()` and `SaveStatus`, with unsaved-changes guards as elsewhere.
  - A name is required and unique ignoring capitals (`validateFaction()`), shown as an error that blocks Save.
  - `Delete faction` asks "Delete {name}? Every pilot's reputation with it is removed. This can't be undone." through `confirmAction`. The foreign key cascades the reputation rows.
- **The tracker** is `src/components/ReputationPanel.vue`, a "Reputation" panel tagged `GM only` on GM review (`GmReview.vue`, between GM controls and the reward history), for pending and approved pilots (not dead ones).
  - A row per faction: name, then a select of the five levels with "Not set" first.
  - A change saves at once with its own Saving / Saved / Not saved status and Retry. A level is an upsert with `updated_by` set to the GM, "Not set" deletes the row. Each write ends in `.select()` through `checkWrite()`. A row is locked while it saves.
  - With no factions it says "No factions yet." and, for owners, links to the Factions tab.

## Pilot inventory

- **Pilot equipment:** only LANCER pilot gear (armour, weapons, kit) from the game data. No free-text items.
  - **Slots** (decided by the developer, 2026-10-29): **1 armour, 2 weapons, 3 gear**, laid out like COMP/CON's loadout.
  - **Inventory** (decided by the developer, migration `20261121110000_pilot_inventory.sql`):
    - Pilot gear is **owned** once bought (`sheet.owned_gear`, one entry per copy with its own key and description, duplicates allowed) and equipped by key (`sheet.equipped_gear`).
    - **Equipping needs no approval**, even with a change open (`equip_pilot_gear`).
    - **Buying goes through a change** and costs the item's price (`manna_cost`, set by owners in the content editor, 100 when unset).
    - A new pilot's **first full loadout is free** (1 armour, 2 weapons, 3 gear). `freeGear()` in `src/rules.ts` mirrors the database's `settle_pilot_gear`.
    - **No refunds:** players can't remove owned items, GMs can.
- **The loadout** (`src/components/PilotLoadout.vue`):
  - **Layout:** six slots in one three-column grid (a plain grid, not `.slot-grid`, cards top-aligned so a tall one never stretches the others): Armour, Weapon, Weapon on the first row, Gear, Gear, Gear on the second. Each card sits under its own small uppercase type label (`SlotCard`'s `label`), so type never depends on position. On phones (under 64rem) one column in the same order, biomods in their own row under the loadout.
  - Empty slots show the empty state ("No gear yet." with `Add gear`). Read-only sheets skip them so filled cards close up in order ("No pilot gear." when all are empty).
  - **Data:** each `sheet.owned_gear` entry is `{ key, id, notes?, damageType?, free? }`. `free` is set by the database only. It replaced the old `pilot_gear` and `pilot_gear_notes`, which the migration converted onto owned items. `equippedGear()` and `loadoutSlots()` in `src/gameData.ts` sort equipped items into slots by `type`, each type in equipped order.
  - **Equipping:** while the pilot can equip, each card's foot has `Swap` and `Remove`. For an **approved pilot** (own, or a GM in edit mode, even with a change open), a slot's picker offers its owned, unequipped items of that type (description as the dim line). Choosing equips and `Remove` unequips, at once with no approval, through `equipGear()` in `src/myPilot.ts` (`equip_pilot_gear`, only keys of known Armor/Weapon/Gear items are sent). Save status as usual.
  - **Stowed and misc** (approved pilots only): under the slots, one folding toggle `Stowed {n} · Misc {m}` (chevron, lilac only on hover and focus, closed by default, hidden when nothing is stowed, there are no misc items and the viewer can't add any).
    - **Stowed** = owned items not equipped (equipped ones are only in the slots), as plain one-line text rows, no cards, grouped Armour / Weapons / Gear / Misc with the small uppercase label in a narrow left column (above the rows under 36rem). Only groups with rows show, plus Misc for a GM in edit mode.
    - A row: item symbol (`itemCard()`'s icon), name, then dim on the same line `Bought in this change · {price} manna` or its description in quotes, cut off with an ellipsis. Items of other types or in no loaded pack go in Gear, the latter as `Unknown item ({id})`.
    - A row is a button (`aria-expanded`) that opens in place, one at a time: price line, `Description` (`ItemNote`, editable in a change), `Info` (the full information) and the GM's `Remove`, with `Not removed: …` there.
  - **`Buy item`** is in the Loadout heading row (change or GM edit mode). It lists every pilot gear item with its price (`gearPrice()`: the item's `manna_cost`, 100 when unset) in three boxes, Armour, Weapons, Gear (`PickGroup.fixed` in `src/pickerRows.ts`: boxes keep their order even when nothing in one can be bought), with the manna balance in the picker's bar. Rows are blocked "Not enough manna" or by the GM-only/Exotic rules. Choosing adds a new unequipped copy (`crypto.randomUUID()` key). An item bought in the open change has its slot-picker row blocked "Needs GM approval".
  - **Removing:** players can't remove owned items. A GM in edit mode can (`Remove`, then "{Item} will be taken off this pilot. This can't be undone." / `Remove item`).
  - **Misc items** (`sheet.misc_items`: `{ key, name, notes? }`, GM only, the database refuses player changes) are free text: name and description, never equipped, no price. Only a GM in edit mode gets `Add misc item` (small text button at the end of the Misc group) and `Remove` in the opened row (same confirm as owned items). Inline form: `Name` (required, max 60), `Description` (max 140), `Add item` / `Discard changes`.
  - **Pilot being created** (pending): a slot picks from the whole catalogue and adds and equips a new copy in one step. `Remove` takes it off the sheet. Each card says `Free` or its price (`freeGear(…, null)`: the first 1 armour, 2 weapons and 3 gear are free).
  - **Variable damage:** a Variable weapon (a Signature weapon) needs a damage type (`DAMAGE_CHOICES`), equipped or stowed. `Damage type` select (`Choose…` until picked) on its slot card and in its opened stowed row (`setDamage()` in `PilotLoadout.vue`, saved on `owned_gear[].damageType`). Until then the rule problem "{Name} needs a damage type." shows (`pilotProblems` in `src/rules.ts`). Live pilots who already owned a Signature weapon at launch show that problem until they choose one through a change (the developer decided to leave this, 2026-11-20).
  - Dead pilots: read-only. Unknown ids are kept and counted.
