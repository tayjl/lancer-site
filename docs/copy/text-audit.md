# Site text audit
Reply with `ID: new text` (or `ID: delete`). Placeholders in {braces} must stay.

How to read this: text is quoted verbatim in code spans. Where a sentence is built from pieces or pluralised, the rendered variants are shown separated by "/" or two spaces. Where the same text appears in several places, there is one row with every location (button labels are merged across the site). Flags: `long` (over ~15 words or more than one sentence), `mechanics` (explains internal behaviour), `dup` (same meaning worded differently elsewhere, see section 11), `tone` (AI-ish phrasing), `case` (inconsistent capitalisation or punctuation against siblings). Section headings, field labels, table column headers and tab names are not itemised (they name things rather than explain them), except where they appear inside another entry.

## 1. Page titles and summaries
| ID | Where | Current text | Flag | Location |
|---|---|---|---|---|
| S-01 | Page title: Home (browser/route title) | `Home` |  | src/router.ts:33 |
| S-02 | Page title: My pilot | `My pilot` |  | src/router.ts:38 |
| S-03 | Page title: Mech page | `Mech` |  | src/router.ts:45,64 |
| S-04 | Registry page title | `Pilot registry` |  | src/router.ts:51 |
| S-05 | Registry page summary | `Every approved pilot.` |  | src/router.ts:51 |
| S-06 | Pilot record page title | `Pilot record` |  | src/router.ts:58 |
| S-07 | Pending page title | `Pending pilots` |  | src/router.ts:73 |
| S-08 | Pending page summary | `New pilots waiting on a GM.` |  | src/router.ts:74 |
| S-09 | Memorial page title | `Memorial` |  | src/router.ts:83 |
| S-10 | Memorial page summary | `Pilots who died. Their records are kept.` | long | src/router.ts:83 |
| S-11 | Archives page title | `Archives` |  | src/router.ts:90 |
| S-12 | Archives page summary | `Every manufacturer, licence, frame, weapon, system, weapon mod, piece of gear, biomod, talent and core bonus in the loaded content packs.` | long, tone, mechanics | src/views/ArchivesView.vue:161 |
| S-13 | Lore page title | `Lore` |  | src/router.ts:26 |
| S-14 | Lore page summary | `Stories, places and people of the campaign, written by the GMs.` |  | src/router.ts:26 |
| S-15 | Lore editor page summary | `Write it here, then publish when it's ready.` |  | src/views/LoreEditView.vue:133 |
| S-16 | GM pilots page title | `GM pilots` |  | src/router.ts:102 |
| S-17 | GM pilots page summary | `Review new pilots, and level up or pay any pilot.` |  | src/router.ts:102 |
| S-18 | GM review page title | `GM review` |  | src/router.ts:109 |
| S-19 | GM changes page title | `GM changes` |  | src/router.ts:115 |
| S-20 | GM changes page summary | `Changes players want to make to their approved pilots.` |  | src/router.ts:115 |
| S-21 | GM change page title | `GM change` |  | src/router.ts:122 |
| S-22 | GM change page heading (page title is built from the pilot) | `Change to {callsign or name}` |  | src/views/GmChangeView.vue:179 |
| S-23 | Content page title | `GM content` |  | src/router.ts:128 |
| S-24 | Content page summary | `The packs behind your pilots, mechs and equipment.` |  | src/router.ts:128 |
| S-25 | Content editor page title | `Content editor` |  | src/router.ts:135 |
| S-26 | Content editor page summary | `Make and change game content.` |  | src/router.ts:135 |
| S-27 | Content editor page summary (long form, shown under the title) | `Make and change the game content pilots are built from. Imported items can be edited too; pack updates keep your edits.` | long, dup of the router summary, mechanics (§11.39) | src/views/ContentEditorView.vue:176 |

## 2. Section hints and helper lines
| ID | Where | Current text | Flag | Location |
|---|---|---|---|---|
| H-01 | Pilot sheet → Register a pilot (form intro) | `No pilot on file. A name is all that's needed to start; everything else is filled in on the sheet.` | long, tone | src/views/PilotManageView.vue:275 |
| H-02 | Pilot sheet → next-step bar (dead pilot) | `This pilot is dead. The record is kept, read-only.` | long | src/views/PilotManageView.vue:369 |
| H-03 | Pilot sheet → next-step bar (pilot sent back) | `Sent back by a GM. Change what they asked (note below), then resubmit.` | long | src/views/PilotManageView.vue:372 |
| H-04 | Pilot sheet → next-step bar (new pilot pending) | `Waiting on a GM. You can keep editing.` | long | src/views/PilotManageView.vue:376 |
| H-05 | Pilot sheet → next-step bar (approved, last change rejected) | `Your last change was rejected (reason below).` |  | src/views/PilotManageView.vue:380 |
| H-06 | Pilot sheet → next-step bar (approved, no draft) | `Approved. Changes go to a GM for review.` | long | src/views/PilotManageView.vue:380 |
| H-07 | Pilot sheet → next-step bar (drafting a change) | `Drafting a change. Your approved pilot stays as it is until a GM approves.` | long, tone | src/views/PilotManageView.vue:384 |
| H-08 | Pilot sheet → next-step bar (change submitted) | `Change submitted, waiting on a GM. The sheet shows what you sent.` | long | src/views/PilotManageView.vue:388 |
| H-09 | Pilot sheet → header, figure under Manna left | `{spent} of {received} spent` |  | src/views/PilotManageView.vue:342 |
| H-10 | Pilot sheet → header, player line | `Player: {player}` | dup (§11.32) | src/views/PilotManageView.vue:322 |
| H-11 | Pilot sheet → header labels | `Level / Licence level / Manna left` |  | src/views/PilotManageView.vue:332-340 |
| H-12 | Pilot sheet → header and next-step bar badges | `Sent back / Waiting for review / Change rejected / Draft change / Change submitted / {status} (pending, approved, dead)` | case | src/views/PilotManageView.vue:324-325,375-387 |
| H-13 | Pilot sheet → Profile tab → Danger zone | `If your pilot dies in the story, mark them dead. This can't be undone.` | dup, long (§11.16) | src/views/PilotManageView.vue:474 |
| H-14 | Pilot sheet → privacy tag beside section headings | `Private` | (§11.31) | src/views/PilotManageView.vue:449,482,486,497,510; src/views/MechView.vue:327,347,349,361; src/components/CoreBonusPanel.vue:73; src/components/MechLoadout.vue:253,272,322; src/components/PilotLoadout.vue:80; src/components/RankPanel.vue:101 |
| H-15 | Pilot sheet → Stats tab → points budget (HASE, personal stats) | `{left} of {budget} points left` |  | src/components/StatRow.vue:44 |
| H-16 | Pilot sheet → Stats tab → points budget when overspent | `{over} over the {budget} points` |  | src/components/StatRow.vue:43 |
| H-17 | Pilot sheet → Stats tab → stat tile note (biomod modifier) | `{base} base + {bonus}  /  {base} base − {bonus}` |  | src/components/StatRow.vue:53 |
| H-18 | Pilot sheet → Stats tab → disclosure under stats | `Where these numbers come from` | dup (§11.26) | src/components/StatRow.vue:78 |
| H-19 | Pilot sheet → Stats tab → "Where these numbers come from": pilot stat lines | `pilot base: {n} / {source}: +{n} / {source}: sets base to {n}` | dup, case (§11.26) | src/gameData.ts:227-228 |
| H-20 | Pilot sheet → Stats tab → general stat names | `hp / armour / speed / e-defence` | dup, case (§11.38) | src/gameData.ts:215-218 |
| H-21 | Pilot sheet → Equipment tab → Biomods, installed item with a missing pack (name) | `unknown item ({id})` |  | src/components/LoadoutBox.vue:37 |
| H-22 | Pilot sheet → Equipment tab → Biomods, installed item with a missing pack (description) | `its content pack may have been removed.` | case | src/components/LoadoutBox.vue:37 |
| H-23 | Pilot sheet → Equipment tab → Biomods heading, point meter | `Mod points {used} / {max}` |  | src/views/PilotManageView.vue:514; src/components/LoadoutBox.vue:75 |
| H-24 | Pilot sheet → Equipment tab → Biomod card, price | `{price} manna` |  | src/components/LoadoutBox.vue:83,117 |
| H-25 | Pilot sheet → biomod picker, match count | `{count} shown` | dup (§11.20) | src/components/LoadoutBox.vue:105 |
| H-26 | Pilot sheet → Equipment tab → Loadout, slot names | `Armour / Weapon 1 / Weapon 2 / Gear 1 / Gear 2 / Gear 3` |  | src/components/PilotLoadout.vue:32 |
| H-27 | Pilot sheet → Equipment tab → Loadout, items from packs not loaded | `Also on file: {count} item(s) from content packs that aren't loaded.` | mechanics | src/components/PilotLoadout.vue:102 |
| H-28 | Pilot sheet → Licences tab → licence level beside heading | `Licence level {level}` |  | src/views/PilotManageView.vue:536 |
| H-29 | Pilot sheet → Licences tab → rank ladder status, rank bought | `Held` |  | src/components/RankPanel.vue:120 |
| H-30 | Pilot sheet → Licences tab → rank ladder status, next rank | `Next: {price} manna` |  | src/components/RankPanel.vue:121 |
| H-31 | Pilot sheet → Licences tab → rank ladder status, rank not reachable | `Locked` |  | src/components/RankPanel.vue:122 |
| H-32 | Pilot sheet → Licences tab → rank with no unlocks | `Nothing new at this rank.` |  | src/components/RankPanel.vue:137 |
| H-33 | Pilot sheet → Licences tab → alternate frame choice (read-only) | `Chosen frame:` |  | src/components/RankPanel.vue:133 |
| H-34 | Pilot sheet → Licences tab → card header | `Rank {I\|II\|III}` |  | src/components/RankPanel.vue:113 |
| H-35 | Pilot sheet → Licences tab → Core bonuses heading | `{taken} of {picks} picks used` |  | src/components/CoreBonusPanel.vue:74 |
| H-36 | Pilot sheet → Licences tab → Core bonuses, helper line | `One free pick per 3 licence ranks. Each non-GMS bonus needs another 3 licence ranks from its manufacturer.` | long, mechanics | src/components/CoreBonusPanel.vue:76 |
| H-37 | Pilot sheet → Licence unlock list (screen reader only) | `{frame\|weapon\|system\|mod}:` |  | src/components/UnlockList.vue:15 |
| H-38 | Pilot sheet → Mechs tab → hangar mech card, frame line | `{maker} {frame}` |  | src/components/MechHangar.vue:70 |
| H-39 | Pilot sheet → Mechs tab → New mech form labels | `Mech name (required) / Manufacturer ID (XXXX-XXXX-XXXX)` |  | src/components/MechHangar.vue:81,85 |
| H-40 | Mech page → breadcrumb: unnamed mech | `Mech` |  | src/views/MechView.vue:249 |
| H-41 | Mech page → header, no frame chosen (read-only) | `No frame` |  | src/views/MechView.vue:278 |
| H-42 | Mech page → header labels | `Pilot / Size / System points` |  | src/views/MechView.vue:289,294,298 |
| H-43 | Mech page → draft bar (draft change open) | `Edits to this mech go into your draft change. Submit it from My pilot.` | long | src/views/MechView.vue:313 |
| H-44 | Mech page → draft bar (change submitted) | `Change submitted, waiting on a GM, so this mech is read-only. To edit it, choose Edit change on My pilot.` | long | src/views/MechView.vue:314 |
| H-45 | Mech page → draft bar badges | `Change submitted / Draft change` | dup (§11.21) | src/views/MechView.vue:312 |
| H-46 | Mech page → frame picker rows | `Mounts: {mounts}  /  Licence rank {I\|II\|III}  /  GMS` |  | src/views/MechView.vue:176 |
| H-47 | Mech page → Profile tab → Danger zone | `Scrapping {mech} removes it and its loadout from {your\|the} hangar for good.` | dup, tone (§11.16) | src/views/MechView.vue:338 |
| H-48 | Mech page → Stats tab → Resources labels | `AI capacity / Limited uses / Structure repair cost / Overcharge heat` |  | src/views/MechView.vue:351-356 |
| H-49 | Mech page → Stats tab → Other effects and conditions intro | `Only the modifiers listed under the stats' sources are counted. These need you or the GM to apply them.` | long, tone | src/views/MechView.vue:362 |
| H-50 | Mech page → Stats tab → effects, bonuses not counted in stats | `Not counted in the stats above.` |  | src/views/MechView.vue:374,390,403 |
| H-51 | Mech page → Stats tab → effects list kind labels | `Frame / Frame trait / Core system / Core power / Core bonus / Talent / Equipment / Unavailable` |  | src/views/MechView.vue:122-129 |
| H-52 | Mech page → Stats tab → core system, passive and power labels | `Passive / Core power` |  | src/views/MechView.vue:146 |
| H-53 | Mech page → Stats tab → talent reminder source (rendered "Talent: {talent} {I\|II\|III}") | `{talent} {rank}` |  | src/mechData.ts:305 |
| H-54 | Mech page → Stats tab → effects, bonus the build maths leaves out | `{+n} {bonus name}, only when {condition}.` | mechanics | src/mechData.ts:333-335 |
| H-55 | Mech page → Stats tab → accuracy bonus line | `{+n} accuracy on {check} checks` |  | src/mechData.ts:342 |
| H-56 | Mech page → Stats tab → content missing (content) | `Content unavailable; its bonuses are not included.` | dup (§11.11) | src/mechData.ts:193 |
| H-57 | Mech page → Stats tab → content missing (core bonus) | `Core bonus unavailable; its bonuses are not included.` | dup (§11.11) | src/mechData.ts:298 |
| H-58 | Mech page → Stats tab → content missing (talent) | `Talent unavailable; its bonuses are not included.` | dup (§11.11) | src/mechData.ts:303 |
| H-59 | Mech page → Stats tab → effect reminder trigger/effect labels | `Trigger: {trigger}  Effect: {effect}` |  | src/mechData.ts:217 |
| H-60 | Mech page → Stats tab → "Where these numbers come from": mech stat lines | `{frame}: {n} / {source}: +{n} / {source}: sets base to {n} / {source}: +{n} (highest override) / armour maximum: {n}` | dup (§11.26) | src/mechData.ts:381-386 |
| H-61 | Mech page → Stats tab → stat names | `structure / stress / hp / heat cap / armour / evasion / speed / e-defence / tech attack / repair cap / system points / size` | dup, case (§11.38) | src/mechData.ts:80-91 |
| H-62 | Mech page → Stats tab → Overcharge heat default | `1 → 1d3 → 1d6 → 1d6+4` | dice (homebrew has no dice) | src/mechData.ts:346 |
| H-63 | Mech page → Loadout → weapon card, profile picker label | `Profile` |  | src/components/BuildItem.vue:40 |
| H-64 | Mech page → Loadout → weapon card, profile option without a name | `profile {n}` | case | src/components/BuildItem.vue:42 |
| H-65 | Mech page → Loadout → prototype weapon picker labels | `Weapon type / Damage type / Prototype improvements` |  | src/components/BuildItem.vue:46,49,52 |
| H-66 | Mech page → Loadout → prototype improvements options | `optics + computer / optics + reactor shielding / computer + reactor shielding` | case | src/components/BuildItem.vue:54 |
| H-67 | Mech page → Loadout → weapon mod, source line | `Source: {pack}` | dup (§11.27) | src/components/ModSection.vue:26 |
| H-68 | Mech page → Loadout → weapon mod, why it can't be added (shown with a trailing full stop) | `{refusal}.` |  | src/components/ModSection.vue:32 |
| H-69 | Item card → "Where these numbers come from": range line | `{source}: +{n} {range type}` | dup (§11.26) | src/equipment.ts:62 |
| H-70 | Item card → "Where these numbers come from": Hunter II | `Hunter II: Thrown 5 (or existing higher Thrown); thrown weapons return at end of turn.` | dup, mechanics (§11.26) | src/equipment.ts:69 |
| H-71 | Item card → "Where these numbers come from": damage line | `{source}: +{expression} {damage type} damage (added before the flat conversion)` | dup, mechanics (§11.26) | src/equipment.ts:77 |
| H-72 | Item card → "Where these numbers come from": mod range line | `{mod}: +{n} {type}` | dup (§11.26) | src/equipment.ts:91 |
| H-73 | Item card → "Where these numbers come from": limited uses | `engineering: +{n} limited uses  /  {source}: +{n} limited uses` | dup (§11.26) | src/equipment.ts:103-104 |
| H-74 | Item card → "Where these numbers come from": attack roll | `attack roll bonus: +{n}` | dup (§11.26) | src/equipment.ts:110 |
| H-75 | Item card → "Where these numbers come from": accuracy | `attack accuracy: +{n} (Auto-Stabilizing Hardpoints) (Tweaked Optics)` | dup (§11.26) | src/equipment.ts:113 |
| H-76 | Item card → "Where these numbers come from": prototype reactor | `Stripped reactor shielding: spend 2 Heat when attacking to use the alternate area pattern (conditional).` | dup, long (§11.26) | src/equipment.ts:116 |
| H-77 | Item card → "Where these numbers come from": Overpower Caliber | `Overpower Caliber: +4 bonus damage on hit, once per round (not included in base damage).` | dup (§11.26) | src/equipment.ts:118 |
| H-78 | Item card → "Where these numbers come from": deployable | `{source}: +{n} {deployable} {stat}` | dup (§11.26) | src/equipment.ts:130 |
| H-79 | Item card → weapon with a chosen profile, card name | `{weapon} · {profile name or "profile {n}"}` |  | src/equipment.ts:9 |
| H-80 | Mech page → Loadout tab → system point meter note | `All used.  /  {n} left  /  {n} over` |  | src/components/MechLoadout.vue:217 |
| H-81 | Mech page → Loadout tab → system point meter label | `System points` |  | src/components/MechLoadout.vue:245 |
| H-82 | Mech page → Loadout tab → core bonus assignment option list | `Choose target  /  mount {n} · {weapon or mount}` | case | src/components/MechLoadout.vue:226-227 |
| H-83 | Mech page → Loadout tab → mount slot labels | `{mount} mount / Integrated mount / Integrated system` |  | src/components/MechLoadout.vue:275,281,327 |
| H-84 | Mech page → Loadout picker → installed item missing from packs | `unknown item ({id})` | case | src/components/MechLoadout.vue:50 |
| H-85 | Registry / Pending / Memorial → header, pilot count | `{count} pilot / {count} pilots` |  | src/views/RegistryView.vue:32 |
| H-86 | Registry / Pending / Memorial → search result count | `{shown} of {total} pilots` | dup (§11.20) | src/views/RegistryView.vue:44 |
| H-87 | Pilot card (registry, pending, memorial, GM queues) | `Player: {player}` | dup (§11.32) | src/components/PilotCard.vue:16 |
| H-88 | Pilot card badge | `Dead` |  | src/components/PilotCard.vue:18 |
| H-89 | GM review queues (gm: pilots, gm: changes) → heading | `Waiting for review {count}` |  | src/components/ReviewQueue.vue:24 |
| H-90 | GM review queues → card line | `Waiting {3d 4h}` |  | src/components/ReviewQueue.vue:31; src/time.ts:3-5 |
| H-91 | Archives header, entry count | `{count} entry / {count} entries` |  | src/views/ArchivesView.vue:162 |
| H-92 | Archives → manufacturer cards, row labels (the category names above, with a count) | `licences / frames / mech weapons / mech systems / weapon mods / biomods / core bonuses` |  | src/views/ArchivesView.vue:121 |
| H-93 | Archives → HORUS card greeting (glitching) | `CONGRATULATIONS, PILOT.` |  | src/views/ArchivesView.vue:46 |
| H-94 | Archives → HORUS card motto | `Access is yours, so long as you can keep it.` |  | src/views/ArchivesView.vue:50 |
| H-95 | Archives → GMS card motto | `From Cradle to the stars: GMS.` |  | src/views/ArchivesView.vue:49 |
| H-96 | Archives → list, group heading for licensed weapons/systems/mods | `{licence} licence  /  No licence` |  | src/views/ArchivesView.vue:231 |
| H-97 | Archives → list, group headings for pilot gear | `pilot armour / pilot weapons / pilot gear` | case | src/archive.ts:142 |
| H-98 | Archives → list, group heading when no manufacturer | `other` | case | src/archive.ts:61,92,94 |
| H-99 | Archives → list rows, facts | `Rank {I\|II\|III}  /  {mount} {type}  /  {n} SP` |  | src/archive.ts:111-114 |
| H-100 | Archives → list rows, biomod facts | `{slot}  /  {n} mod point(s)` |  | src/archive.ts:115 |
| H-101 | Lore → search label | `Search lore` |  | src/views/LoreView.vue:76 |
| H-102 | Lore → GM note beside the kind filter | `Only GMs can see drafts.` |  | src/views/LoreView.vue:95 |
| H-103 | Lore → list rows and entry header | `{12 Nov 2026} · {n} min read  /  Edited {12 Nov 2026} · {n} min read (drafts)` |  | src/lore.ts:33,36 |
| H-104 | Lore → kind names (chips, list headings, entry header) | `Story / Stories, Place / Places, Faction / Factions, Person / People, Event / Events` |  | src/lore.ts:15-19 |
| H-105 | Lore → draft badge on list rows, entry header | `Draft` |  | src/views/LoreView.vue:126; src/components/LoreEntry.vue:58 |
| H-106 | Lore entry → byline | `By {author}` |  | src/components/LoreEntry.vue:59 |
| H-107 | Lore entry → related section | `Related entries` | (§11.35) | src/components/LoreEntry.vue:67 |
| H-108 | Lore editor → status bar (draft) | `Only GMs can see this until it's published.` |  | src/views/LoreEditView.vue:141 |
| H-109 | Lore editor → status bar (published) | `Everyone can read it.` |  | src/views/LoreEditView.vue:145 |
| H-110 | Lore editor → status bar badges | `Draft / Published` | dup (§11.21) | src/views/LoreEditView.vue:140,144 |
| H-111 | Lore editor → Title / Kind / Summary labels | `Title / Kind / Summary` |  | src/views/LoreEditView.vue:161,165,174 |
| H-112 | Lore editor → Summary hint | `Shown in the list and under the title.` |  | src/views/LoreEditView.vue:176 |
| H-113 | Lore editor → Related entries, none | `None yet. They show under the entry.` | dup, long (§11.5) | src/views/LoreEditView.vue:197 |
| H-114 | Lore editor → Related entries, deleted target | `Deleted entry` |  | src/views/LoreEditView.vue:191 |
| H-115 | Lore editor → link picker option facts | `{Story\|Place\|…}  /  {kind} · Draft` |  | src/views/LoreEditView.vue:93 |
| H-116 | Lore editor → Danger zone | `Deleting an entry removes it for everyone and can't be undone. Links to it from other entries will stop working.` | dup, long (§11.16) | src/views/LoreEditView.vue:206 |
| H-117 | GM pilots → Waiting for review, helper line | `New pilots, oldest first. Open one to review their sheet.` | dup, long (§11.30) | src/views/GmPilotsView.vue:100 |
| H-118 | GM pilots → Pilot records, helper line | `Every pilot, including pending and dead. Level and manna save when you leave the field.` | long | src/views/GmPilotsView.vue:105 |
| H-119 | GM pilots → search count | `{shown} of {total} pilots` | dup (§11.20) | src/views/GmPilotsView.vue:112 |
| H-120 | GM pilots → table headers | `Callsign / Name / Player / Status / Level / Licence level / Manna received / Manna left / Mechs / Record` |  | src/views/GmPilotsView.vue:119-128 |
| H-121 | GM pilots → table, player not known | `Unknown player` |  | src/views/GmPilotsView.vue:135 |
| H-122 | GM pilots → table, manna spent under Manna left | `{spent} spent` |  | src/views/GmPilotsView.vue:167 |
| H-123 | GM pilots → table, status badges | `Sent back / {status} (pending, approved, dead)` | dup, case (§11.21) | src/views/GmPilotsView.vue:142 |
| H-124 | GM edit bar (pilot record, review page, mech pages) | `Changes save straight to this pilot, without approval.` |  | src/components/GmEditBar.vue:17 |
| H-125 | GM edit bar badge | `GM edit` |  | src/components/GmEditBar.vue:16 |
| H-126 | GM review (decision box) → heading | `Decision / GM controls` |  | src/components/GmReview.vue:123 |
| H-127 | GM review → privacy tag | `GM only` | dup (§11.31, 7) | src/components/GmReview.vue:123 |
| H-128 | GM review → GM controls labels | `Level / Manna received` |  | src/components/GmReview.vue:128,132 |
| H-129 | GM review → decision note label | `Note to the player` |  | src/components/GmReview.vue:139 |
| H-130 | GM review → decision note hint | `Sent with either decision. Needed to refuse.` | long | src/components/GmReview.vue:141 |
| H-131 | GM review → Danger zone, owner tag | `Owner only` | (§11.31) | src/components/GmReview.vue:158 |
| H-132 | GM review → Danger zone | `Deleting {pilot} removes the pilot, their sheet, mechs and every change. It can't be undone.` | dup, long (§11.16) | src/components/GmReview.vue:160 |
| H-133 | GM changes → Waiting for review, helper line | `Changes to approved pilots, oldest first. Open one to review it.` | dup, long (§11.30) | src/views/GmChangesView.vue:64 |
| H-134 | GM changes → Reviewed, helper line | `The latest reviewed changes.` |  | src/views/GmChangesView.vue:69 |
| H-135 | GM changes → Reviewed table headers | `Pilot / Status / Reviewer / When / Note` |  | src/views/GmChangesView.vue:76-80 |
| H-136 | GM changes → Reviewed table, when | `{3d 4h} ago` |  | src/views/GmChangesView.vue:88 |
| H-137 | GM changes → Reviewed table, pilot deleted | `A deleted pilot` |  | src/views/GmChangesView.vue:21,52 |
| H-138 | GM changes → Reviewed table, status badges | `approved / rejected` | dup, case (§11.21) | src/views/GmChangesView.vue:86 |
| H-139 | GM change → fallback pilot name | `A pilot` |  | src/views/GmChangeView.vue:63 |
| H-140 | GM change → summary strip, player line | `Player: {player}` | dup (§11.32) | src/views/GmChangeView.vue:191 |
| H-141 | GM change → summary strip, submitted | `Submitted {3d 4h} ago` |  | src/views/GmChangeView.vue:192 |
| H-142 | GM change → summary strip, a draft | `Draft: not submitted yet` |  | src/views/GmChangeView.vue:193 |
| H-143 | GM change → summary strip, reviewed status badge | `{status} (approved, rejected)` | dup, case (§11.21) | src/views/GmChangeView.vue:194 |
| H-144 | GM change → summary figures | `Balance before / Cost of change / Manna refunded / Balance after / Proposal spending / Manna left` |  | src/views/GmChangeView.vue:201-211 |
| H-145 | GM change → summary strip, small line under the figures | `{received} received · {spent} spent on the proposed sheet` |  | src/views/GmChangeView.vue:215 |
| H-146 | GM change → key above the lines | `{n} added or raised / {n} removed or lowered / {n} updated` |  | src/views/GmChangeView.vue:111-112,229 |
| H-147 | GM change → line kind labels | `Added / Raised / Removed / Lowered / Updated` |  | src/views/GmChangeView.vue:104-108 |
| H-148 | GM change → disclosure under a changed writing field | `View proposed text` |  | src/views/GmChangeView.vue:245 |
| H-149 | GM change → line text, a field changed | `{field}: {before} → {after}  (field is name, callsign, age, gender, sexuality, height, weight, eye colour, hair colour, manufacturer ID, frame)` |  | src/changeDiff.ts:81,126-134 |
| H-150 | GM change → line text, rank change | `{item}, rank {I} → {II}  /  {item}, rank {I}` |  | src/changeDiff.ts:86-88 |
| H-151 | GM change → line text, stat change | `{stat} {before} → {after}` |  | src/changeDiff.ts:94 |
| H-152 | GM change → line text, writing and images | `Portrait / Appearance / Personality / Traits / Backstory / History / Image` |  | src/changeDiff.ts:103-107,123-129,173 |
| H-153 | GM change → line text, new mech | `{mech} ({manufacturer ID})` |  | src/changeDiff.ts:122 |
| H-154 | GM change → line text, mounts | `Weapon mounts rearranged` |  | src/changeDiff.ts:139 |
| H-155 | GM change → line text, mount choices | `{bonus} target: {before} → {after}  /  mount {n}  /  mount {n}, {weapon}  /  empty weapon slot` | case | src/changeDiff.ts:144-150 |
| H-156 | GM change → line text, weapon options | `{mount n, weapon n} configuration: {options} → {options}  (options: profile {n}, optics, reactor shielding, computer)` | case | src/changeDiff.ts:152-160 |
| H-157 | GM change → line text, mod | `Mod on {weapon}: {mod} / Mod on {weapon}: {old} → {new}` |  | src/changeDiff.ts:168-171 |
| H-158 | GM change → line text, licence | `{licence} licence  /  {licence} licence frame: {before} → {after}` |  | src/changeDiff.ts:175,180 |
| H-159 | GM change → section headings | `identity / appearance / personality / traits / backstory / personal stats / piloting stats / biomods / loadout / mech hangar / mech: {mech} / {section} / licences / core bonuses / talents (lowercase in code)` | case | src/changeDiff.ts:103-182; src/views/GmChangeView.vue:95 |
| H-160 | GM change → Decision box heading and tag | `Decision / GM only` | dup (§11.7) | src/views/GmChangeView.vue:257 |
| H-161 | GM change → Decision note label | `Note to the player` |  | src/views/GmChangeView.vue:260 |
| H-162 | GM change → Decision note hint | `Optional when approving, required when rejecting.` |  | src/views/GmChangeView.vue:262 |
| H-163 | GM change → rejected change, reason heading | `Reason for rejecting` |  | src/views/GmChangeView.vue:275 |
| H-164 | Content → pack preview, older items kept | `Older items missing from this update stay available, so existing pilots keep their equipment.` | tone | src/views/ContentView.vue:239 |
| H-165 | Content → pack preview, heading | `Review pack update / Review import` |  | src/views/ContentView.vue:218 |
| H-166 | Content → pack preview, byline and version | `By {author}  /  Version {old} → {new}` |  | src/views/ContentView.vue:223-224 |
| H-167 | Content → pack preview, totals | `+{n} new / ~{n} to update / {n} older items kept` |  | src/views/ContentView.vue:228-230 |
| H-168 | Content → pack preview, unused files disclosure | `{n} file not used by this site  /  {n} files not used by this site` |  | src/views/ContentView.vue:242 |
| H-169 | Content → pack preview, unused files hint | `Only supported content files at the top level are imported.` |  | src/views/ContentView.vue:243 |
| H-170 | Content → pack preview, ID conflict reasons | `belongs to {pack}  /  belongs to another pack  /  would change the item type` | case | src/lcp.ts:122-123 |
| H-171 | Content → pack preview, foot, while importing | `Importing the pack and all its items…` | tone | src/views/ContentView.vue:254 |
| H-172 | Content → pack preview, foot, update | `Updated rules apply wherever these items are used. Older items stay available.` | long, tone | src/views/ContentView.vue:254 |
| H-173 | Content → pack preview, foot, new pack | `Import this pack to make its content available to character sheets.` |  | src/views/ContentView.vue:254 |
| H-174 | Content → Installed packs, count | `{n} pack, {n} items  /  {n} packs, {n} items` |  | src/views/ContentView.vue:269 |
| H-175 | Content → Installed packs, table headers | `Pack / Version / Items / Last imported` |  | src/views/ContentView.vue:278 |
| H-176 | Content → Content library, helper line | `Everything available to character sheets. Biomods are campaign content, managed apart from LCPs.` | long | src/views/ContentView.vue:300 |
| H-177 | Content → Content library, row labels | `frames / mech weapons / mech systems / weapon mods / pilot gear / talents / core bonuses / tags / manufacturers / biomods` |  | src/lcp.ts:5-6; src/views/ContentView.vue:304 |
| H-178 | Content → import preview, file name shown for the core import | `Official core content` |  | src/views/ContentView.vue:128 |
| H-179 | Content editor → privacy tag beside the title | `Owners only` | (§11.31) | src/views/ContentEditorView.vue:180 |
| H-180 | Content editor → pack homebrew description (stored in the pack's manifest) | `Items made in the site's content editor.` |  | src/editorStore.ts:96 |
| H-181 | Content editor → kind tabs and list headings | `Frames / Weapons / Systems / Weapon mods / Pilot gear / Talents / Core bonuses / Tags / Manufacturers / Biomods / Personal stats` |  | src/contentEditor.ts:18-28 |
| H-182 | Content editor → list group heading for site tables | `Site content` |  | src/views/ContentEditorView.vue:113 |
| H-183 | Content editor → list row facts for biomods | `{maker} · {slot} · {n} mod point(s) · {price} manna · retired` |  | src/editorStore.ts:52 |
| H-184 | Content editor → pane, preview of a stat | `Key: {id}` |  | src/components/editor/EditorPreview.vue:38 |
| H-185 | Content editor → list → name of the pack that holds new homebrew items | `Campaign homebrew` |  | src/contentEditor.ts:9 |
| H-186 | Content editor → homebrew pack author (stored in its manifest) | `Campaign owners` |  | src/editorStore.ts:96 |
| H-187 | Content editor → pane bar status | `Unsaved changes` |  | src/components/editor/EditorPane.vue:201 |
| H-188 | Content editor → pane bar badges | `Draft / Published / Edited` | dup (§11.21) | src/components/editor/EditorPane.vue:198-200 |
| H-189 | Content editor → pane title when the item has no name yet | `New {kind singular}` |  | src/components/editor/EditorPane.vue:112 |
| H-190 | Content editor → Danger zone | `Deleting removes this item for everyone and can't be undone. Official items can't be deleted.` | dup, long (§11.16) | src/components/editor/EditorPane.vue:268 |
| H-191 | Content editor → preview tabs | `Item card / Full information / Original` |  | src/components/editor/EditorPreview.vue:55 |
| H-192 | Content editor → preview, Original tab | `The pack's own version, before the campaign's edits.` |  | src/components/editor/EditorPreview.vue:74 |
| H-193 | Content editor → preview, an item without a name | `Unnamed` |  | src/components/editor/EditorPreview.vue:83 |
| H-194 | Content editor → preview, a tag's "what it means" group | `what it means / meaning` | case | src/components/editor/EditorPreview.vue:33 |
| H-195 | Content editor → preview, kind line | `tag / personal stat` | case | src/components/editor/EditorPreview.vue:33,38 |
| H-196 | Content editor → every item form → ID field hint (existing item) | `Made when the item was created. It never changes, so pilots keep it if you rename it.` | dup, long, mechanics, tone (§11.22) | src/components/editor/GearForm.vue:33; src/components/editor/CoreBonusForm.vue:28; src/components/editor/ItemBasics.vue:45; src/components/editor/TalentForm.vue:44; src/components/editor/FrameForm.vue:95 |
| H-197 | Content editor → every item form → ID field hint (new item) | `Made from the name until you save it the first time.` | dup, mechanics (§11.22) | src/components/editor/GearForm.vue:33; src/components/editor/CoreBonusForm.vue:28; src/components/editor/ItemBasics.vue:45; src/components/editor/TalentForm.vue:44; src/components/editor/FrameForm.vue:95 |
| H-198 | Content editor → Tag form → ID field hint (existing) | `Made when the item was created. It never changes, so pilots keep it if you rename it.` | dup, long, tone, mechanics (§11.22) | src/components/editor/TagForm.vue:25 |
| H-199 | Content editor → Tag form → ID field hint (new) | `Made from the name until you save it the first time.` | dup, mechanics (§11.22) | src/components/editor/TagForm.vue:25 |
| H-200 | Content editor → Tag form → Name hint | `Write {VAL} where the item's number goes, as in "Limited {VAL}".` |  | src/components/editor/TagForm.vue:22 |
| H-201 | Content editor → Tag form → Hidden checkbox | `Hidden: a note for the site, not shown to players` |  | src/components/editor/TagForm.vue:29 |
| H-202 | Content editor → Pilot gear form → Description hint | `Flavour. Gear with no rules text shows this as its rules.` | dup, long (§11.23) | src/components/editor/GearForm.vue:48 |
| H-203 | Content editor → Core bonus form → Mounted effect hint | `Optional: what it does while a weapon sits on a mount it changes.` |  | src/components/editor/CoreBonusForm.vue:44 |
| H-204 | Content editor → Core bonus form → Description hint | `Flavour text.` | dup (§11.23) | src/components/editor/CoreBonusForm.vue:47; src/components/editor/TalentForm.vue:52 |
| H-205 | Content editor → Biomod form → Slot hint | `Where on the body it goes. Pick a suggestion or type your own.` | long | src/components/editor/BionicForm.vue:47 |
| H-206 | Content editor → Biomod form → Manufacturer hint | `HORUS, NHC and Exotic biomods are GM-only.` |  | src/components/editor/BionicForm.vue:51 |
| H-207 | Content editor → Biomod form → Manufacturer select, none | `None` |  | src/components/editor/BionicForm.vue:53 |
| H-208 | Content editor → Biomod form → Retired checkbox | `Retired: no longer offered. Pilots who have it keep it.` | long | src/components/editor/BionicForm.vue:61 |
| H-209 | Content editor → Biomod form → no bonuses | `No bonuses. Use a negative number for a drawback.` | dup, long (§11.5) | src/components/editor/BionicForm.vue:77 |
| H-210 | Content editor → Biomod form → Description hint | `Flavour text, plain.` | dup (§11.23) | src/components/editor/BionicForm.vue:83 |
| H-211 | Content editor → Personal stat form → Key hint (existing) | `Sheets and bonuses use this key, so it never changes. Rename the stat freely.` | tone, long | src/components/editor/StatForm.vue:21 |
| H-212 | Content editor → Personal stat form → Key hint (new) | `Made from the name until you save it the first time.` | mechanics | src/components/editor/StatForm.vue:21 |
| H-213 | Content editor → Personal stat form → footnote | `A new personal stat appears on every pilot's stats tab, starting at 2 like the others.` | long | src/components/editor/StatForm.vue:26 |
| H-214 | Content editor → Weapon, system, mod forms → licence select, none | `No licence: anyone can use it` |  | src/components/editor/ItemBasics.vue:58 |
| H-215 | Content editor → select, nothing picked yet | `Choose…` | dup (§11.34) | src/components/editor/ItemBasics.vue:51; src/components/editor/GearForm.vue:38; src/components/editor/CoreBonusForm.vue:33; src/components/editor/WeaponForm.vue:60; src/components/editor/FrameForm.vue:101 |
| H-216 | Content editor → Weapon form → Damage hint | `Type a number or dice such as 1d6+2. This homebrew has no dice, so the site turns dice into one flat number, rounded up, and that is all players see.` | long, mechanics | src/components/editor/WeaponForm.vue:69 |
| H-217 | Content editor → Weapon form → single set of numbers note | `One set of numbers. If the weapon can be used in different modes, such as spun up or not, give it profiles.` | long | src/components/editor/WeaponForm.vue:73 |
| H-218 | Content editor → Weapon form → Profiles intro | `The pilot picks one when equipping the weapon. Each has its own range and damage. Leave a profile's tags, rules or actions empty to use the weapon's own, below.` | long | src/components/editor/WeaponForm.vue:80 |
| H-219 | Content editor → Weapon form → profile Tags hint | `Leave empty to use the weapon's tags.` | dup (§11.24) | src/components/editor/WeaponForm.vue:94 |
| H-220 | Content editor → Weapon form → profile Rules text hint | `Leave empty to use the weapon's rules text.` | dup (§11.24) | src/components/editor/WeaponForm.vue:97 |
| H-221 | Content editor → Weapon form → profile Actions hint | `Leave empty to use the weapon's actions.` | dup (§11.24) | src/components/editor/WeaponForm.vue:109 |
| H-222 | Content editor → Weapon form → profile title and default name | `Profile {n} · {name}  /  Mode {n}` |  | src/components/editor/WeaponForm.vue:81-82 |
| H-223 | Content editor → Weapon, system, mod forms → Lore hint | `Optional flavour text, plain.` | dup (§11.23) | src/components/editor/WeaponForm.vue:144; src/components/editor/SystemForm.vue:41; src/components/editor/ModForm.vue:67 |
| H-224 | Content editor → Weapon mod form → Only these types hint | `Leave all off to fit any type.` | dup (§11.24) | src/components/editor/ModForm.vue:41 |
| H-225 | Content editor → Weapon mod form → Only these sizes hint | `Leave all off to fit any size.` | dup (§11.24) | src/components/editor/ModForm.vue:44 |
| H-226 | Content editor → Weapon mod form → Added damage hint | `Added damage isn't counted in the weapon's numbers; it's conditional, so say when in the effect.` | mechanics, tone, long | src/components/editor/ModForm.vue:58 |
| H-227 | Content editor → Talent form → Summary hint | `One line, shown in lists: what the talent is for.` |  | src/components/editor/TalentForm.vue:49 |
| H-228 | Content editor → Talent form → rank problem notice (title) | `This talent has {n} rank, not three.  /  This talent has {n} ranks, not three.` |  | src/components/editor/TalentForm.vue:61 |
| H-229 | Content editor → Talent form → rank summary line | `{n} action(s) · Grants equipment` | dup (§11.20) | src/components/editor/TalentForm.vue:68 |
| H-230 | Content editor → Talent form → Built in hint | `Equipment the pilot's mech gets for free with this rank, with no mount needed.` | dup (§11.25) | src/components/editor/TalentForm.vue:82 |
| H-231 | Content editor → Talent form → May take hint | `Special equipment the pilot may choose to add once they have this rank.` |  | src/components/editor/TalentForm.vue:85 |
| H-232 | Content editor → Talent form → exclusive checkbox | `Replaces the lower ranks' built-in equipment: only the highest rank the pilot has applies` | long | src/components/editor/TalentForm.vue:90 |
| H-233 | Content editor → Manufacturer form → ID hint (existing) | `Items name their manufacturer by this code, so it never changes.` | mechanics | src/components/editor/ManufacturerForm.vue:34 |
| H-234 | Content editor → Manufacturer form → ID hint (new) | `A short code of letters and numbers, such as CHI. Items name their manufacturer by it, so it can't change once you create it.` | long, tone, mechanics | src/components/editor/ManufacturerForm.vue:34 |
| H-235 | Content editor → Manufacturer form → Logo hint | `Homebrew manufacturers can use one of the bundled logos, or none.` |  | src/components/editor/ManufacturerForm.vue:39 |
| H-236 | Content editor → Manufacturer form → logo select, none | `No logo` |  | src/components/editor/ManufacturerForm.vue:41 |
| H-237 | Content editor → Manufacturer form → Main colour hint | `The colour the site draws: the logo and a thin line on cards.` |  | src/components/editor/ManufacturerForm.vue:52 |
| H-238 | Content editor → Manufacturer form → Darker colour hint | `Optional. Kept with the manufacturer; the site doesn't draw it yet.` | long | src/components/editor/ManufacturerForm.vue:55 |
| H-239 | Content editor → System form → Kind of system options | `System / AI / Shield / Deployable / Drone / Tech / Armor / Flight System / Integrated` | case (§11.47) | src/contentEditor.ts:99; src/components/editor/SystemForm.vue:33 |
| H-240 | Content editor → Pilot gear form → Kind of gear options | `Armour / Weapon / Gear` |  | src/components/editor/GearForm.vue:39 |
| H-241 | Content editor → Deployables list → number field labels | `Size / HP / Evasion / E-defence / Armour` |  | src/components/editor/DeployableListField.vue:15 |
| H-242 | Content editor → Frame form → stat labels | `Size / Structure / Stress / HP / Armour / Evasion / E-defence / Heat cap / Repair cap / Speed / Tech attack / System points / Sensors (not used) / Save target (not used)` | dup (§11.38) | src/contentEditor.ts:134-137 |
| H-243 | Content editor → Frame form → mech type choices | `Balanced / Striker / Defender / Support / Controller / Artillery` |  | src/contentEditor.ts:129 |
| H-244 | Content editor → Frame form → use limits | `Turn / Next Turn / Round / Next Round / Scene / Encounter / Mission / Free` |  | src/contentEditor.ts:131 |
| H-245 | Content editor → biomod Slot suggestions | `Head / Eyes / Ears / Brain / Spine / Torso / Heart / Lungs / Arm / Hand / Leg / Foot / Skin / Nervous system / Full body` |  | src/contentEditor.ts:377 |
| H-246 | Content editor → Bonuses list → bonus type options | `Pilot HP / Pilot armour / Pilot speed / Pilot e-defence / Structure / Stress / HP / Heat capacity / Armour / Armour maximum / Evasion / Speed / E-defence / Tech attack / Repair capacity / System points / Size / AI capacity / Limited uses / {personal stat names}` | dup, case (§11.38) | src/contentEditor.ts:111-117 |
| H-247 | Content editor → Bonuses list → option group labels | `Pilot / Personal stat / Mech` |  | src/contentEditor.ts:108 |
| H-248 | Content editor → Frame form → Alternate of hint | `An alternate frame, such as an alternate Genghis, shares its original's licence: pilots choose between them.` | long | src/components/editor/FrameForm.vue:106 |
| H-249 | Content editor → Frame form → Alternate of select, none | `None: its own licence` |  | src/components/editor/FrameForm.vue:108 |
| H-250 | Content editor → Frame form → Licence hint (alternate) | `The ID of the original frame.` |  | src/components/editor/FrameForm.vue:112 |
| H-251 | Content editor → Frame form → Licence hint (own licence) | `A frame is its own licence, so this is its own ID.` |  | src/components/editor/FrameForm.vue:112 |
| H-252 | Content editor → Frame form → Unlocked at licence rank hint | `The rank pilots need in this frame's licence to use it: II for most. None for a frame anyone can use, like GMS's.` | long | src/components/editor/FrameForm.vue:119 |
| H-253 | Content editor → Frame form → Description hint | `Flavour text, shown in the frame's information.` | dup (§11.23) | src/components/editor/FrameForm.vue:122 |
| H-254 | Content editor → Frame form → licence rank choices | `None / I / II / III` |  | src/components/editor/FrameForm.vue:57 |
| H-255 | Content editor → Frame form → Stats intro | `What the frame gives before pilot skills and gear.` |  | src/components/editor/FrameForm.vue:128 |
| H-256 | Content editor → Frame form → Stats footnote | `Sensors and save target are game data the site's mech maths leaves out, so nothing here changes them.` | mechanics, long | src/components/editor/FrameForm.vue:137 |
| H-257 | Content editor → Frame form → stat labels for unused stats | `Sensors (not used) / Save target (not used)` |  | src/components/editor/FrameForm.vue:130 |
| H-258 | Content editor → Frame form → Weapon mounts intro | `Players see the mounts in this order.` |  | src/components/editor/FrameForm.vue:141 |
| H-259 | Content editor → Frame form → no mounts | `No mounts yet.` | dup (§11.5) | src/components/editor/FrameForm.vue:158 |
| H-260 | Content editor → Frame form → mount hints beside each mount | `Takes one Main or Auxiliary weapon.  /  Takes one weapon of any size.  /  Takes one Main or two Auxiliary weapons.  /  Takes one Main and one Auxiliary weapon.  /  Takes two Auxiliary weapons.` |  | src/mechData.ts:57-61 |
| H-261 | Content editor → Frame form → Traits intro | `Each trait is a name and its rules, with optional actions, bonuses and deployables.` |  | src/components/editor/FrameForm.vue:163 |
| H-262 | Content editor → Frame form → Traits, no traits | `No traits.` | dup (§11.5) | src/components/editor/FrameForm.vue:164 |
| H-263 | Content editor → Frame form → Trait Use limit hint | `A reminder of how often it can be used.` |  | src/components/editor/FrameForm.vue:172 |
| H-264 | Content editor → Frame form → Trait Use limit select, none | `No limit (always on)` |  | src/components/editor/FrameForm.vue:174 |
| H-265 | Content editor → Frame form → folded panel summaries | `{n} trait / {n} traits: {names}  /  No traits  /  {n} item / {n} items  /  Nothing unlocked yet  /  {name}: 1 passive, 1 power  /  Unnamed  /  No mounts` |  | src/components/editor/FrameForm.vue:79-84,200 |
| H-266 | Content editor → Frame form → Licence unlocks intro | `What each rank of this licence unlocks. Set on each item's own licence field.` | long | src/components/editor/FrameForm.vue:201 |
| H-267 | Content editor → Frame form → Licence unlocks, nothing at a rank | `Nothing.` | dup (§11.5) | src/components/editor/FrameForm.vue:209 |
| H-268 | Content editor → Frame form → Core system Lore hint | `Flavour text, shown above the passive and the power.` | dup (§11.23) | src/components/editor/CoreSystemFields.vue:31 |
| H-269 | Content editor → Frame form → Core system, Passive bonuses hint | `Counted in the mech's numbers.` |  | src/components/editor/CoreSystemFields.vue:43 |
| H-270 | Content editor → Frame form → Core system, Power bonuses hint | `Only apply while the power is on, so the mech's numbers leave them out. Say when in the rules.` | long | src/components/editor/CoreSystemFields.vue:80 |
| H-271 | Content editor → Frame form → Core system, Built in hint | `Weapons or systems the mech gets for free with this frame, with no mount needed.` | dup (§11.25) | src/components/editor/CoreSystemFields.vue:85 |
| H-272 | Content editor → Frame form → Core system, Lasts for / Switch off with, none | `Not stated` |  | src/components/editor/CoreSystemFields.vue:61,68 |
| H-273 | Item cards → pack credit line | `Source: {pack}` | dup (§11.27) | src/components/ItemCard.vue:27 |
| H-274 | Item card → disclosure under item numbers | `Where these numbers come from` | dup (§11.26) | src/components/ItemBody.vue:34 |
| H-275 | Full information dialog / archives pane → pack credit line | `Source: {pack}` | dup (§11.27) | src/components/InfoBody.vue:89 |
| H-276 | Full information dialog / archives pane → system point cost | `Costs {n} system points.` |  | src/components/InfoBody.vue:52 |
| H-277 | Pickers → search count | `{shown} of {total}` | dup (§11.20) | src/components/ItemPicker.vue:42 |
| H-278 | Confirm dialog (all confirmations) | `Are you sure?` |  | src/components/ConfirmDialog.vue:23 |
| H-279 | Content editor → list fields → folded entry with a problem | `Needs fixing` | dup (§11.37, 7) | src/components/editor/RepeatList.vue:47; src/components/editor/FoldPanel.vue:18 |
| H-280 | Content editor → list fields → entry titles | `Action {n} · {name}  /  Deployable {n} · {name}  /  Trait {n} · {name}  /  Rank {I} · {name}` |  | src/components/editor/ActionListField.vue:23; src/components/editor/DeployableListField.vue:22; src/components/editor/FrameForm.vue:165; src/components/editor/TalentForm.vue:67 |
| H-281 | Content editor → list fields → entry summary | `{n} action(s)` | dup (§11.20) | src/components/editor/FrameForm.vue:166; src/components/editor/TalentForm.vue:68 |
| H-282 | Content editor → Actions list → no actions | `No actions.` | dup (§11.5) | src/components/editor/ActionListField.vue:22 |
| H-283 | Content editor → Actions list → action with no activation | `Passive` |  | src/components/editor/ActionListField.vue:33 |
| H-284 | Content editor → Deployables list → no deployables | `No deployables. Add one if this item places a drone, mine or turret.` | dup, long (§11.5) | src/components/editor/DeployableListField.vue:21 |
| H-285 | Content editor → Deployables list → summary | `{kind} · {n} HP` |  | src/components/editor/DeployableListField.vue:23 |
| H-286 | Content editor → Damage and range lists → players see the flat number | `Players see {n} flat` |  | src/components/editor/DamageField.vue:39 |
| H-287 | Content editor → Damage list → not a number | `Needs a number or dice` | dup (§11.7) | src/components/editor/DamageField.vue:40 |
| H-288 | Content editor → Damage and range lists → no rows | `None.` | dup (§11.5) | src/components/editor/DamageField.vue:46 |
| H-289 | Content editor → Bonuses list → no bonuses | `No bonuses.` | dup (§11.5) | src/components/editor/BonusListField.vue:41 |
| H-290 | Content editor → Bonuses list → bonus type the site doesn't count | `{id} (not counted)` |  | src/components/editor/BonusListField.vue:30 |
| H-291 | Content editor → Bonuses list → Sets the base checkbox | `Sets the base` |  | src/components/editor/BonusListField.vue:36 |
| H-292 | Content editor → Tags list → add select first option | `Add a tag…` |  | src/components/editor/TagListField.vue:46 |
| H-293 | Content editor → Raw data → hint beside the heading | `The same data as the form, as JSON. For things the form has no field for.` | long | src/components/editor/RawDataField.vue:41 |
| H-294 | Full information / archives pane → kind line under the logo | `{maker} frame / {maker} licence / {maker} core bonus / pilot armour / pilot weapon / pilot gear / weapon mod / {mount} {type} weapon / {system type} / biomod / manufacturer / talent / tag / personal stat` | case | src/info.ts:71,79,104,173,239 |
| H-295 | Full information → item facts, licence | `Licence: {licence} {I\|II\|III}` |  | src/info.ts:85 |
| H-296 | Full information → frame facts, licence | `Licence: {licence} {I\|II\|III}` |  | src/info.ts:111 |
| H-297 | Full information → item or frame facts, no licence | `No licence needed` |  | src/info.ts:85,111 |
| H-298 | Full information → frame facts, mounts | `Mounts: {mounts}` |  | src/info.ts:110 |
| H-299 | Full information → biomod facts, retired | `retired: no longer offered` | case | src/info.ts:194 |
| H-300 | Full information → biomod facts, price | `{price} manna` |  | src/info.ts:194 |
| H-301 | Full information → biomod facts, mod points | `{n} mod point / {n} mod points` |  | src/info.ts:186 |
| H-302 | Full information → manufacturer facts | `{n} frames` |  | src/info.ts:213 |
| H-303 | Full information → licence facts | `{role}  ·  {price} manna per rank` |  | src/info.ts:243 |
| H-304 | Full information → group headings | `rules / tags / ranks / frames / effect / mounted effect / description / passive / passive: {name} / core system / rank {I\|II\|III}: {name} / rank {I\|II\|III}` | case | src/info.ts:91-92,132,151,167,180,198,216,248 |
| H-305 | Full information → frame list on a manufacturer | `{frame name}: {roles}  /  Frame` |  | src/info.ts:216 |
| H-306 | Full information → licence rank with nothing new | `Nothing new at this rank.` |  | src/info.ts:248 |
| H-307 | Item card / full information → tag names without a name in the data | `{tag id with tg_ removed and _ replaced by spaces}` |  | src/info.ts:66 |
| H-308 | Item card → facts line for mods | `Mod for {types}  /  Mod for any weapon` |  | src/itemDetails.ts:112 |
| H-309 | Item card → deployable stats line | `size {n} · hp {n} · armor {n} · evasion {n} · edef {n} · speed {n} · heatcap {n}` | case, long (§11.47) | src/itemDetails.ts:150 |
| H-310 | Item card → trigger and effect text | `Trigger: {text}  Effect: {text}` |  | src/itemDetails.ts:144-145 |
| H-311 | Item cards → unit beside system points and mod points | `SP / mod` |  | src/components/ItemDetails.vue:23; src/components/ModSection.vue:23; src/components/LoadoutBox.vue:82 |
| H-312 | Archives, change review, pilot sheet → biomod stat bonus labels | `{+n} {stat-name with _ as -}` |  | src/gameData.ts:240,245 |
| H-313 | Everywhere a value is missing (pilot sheet header, identity list, GM tables, GM change page, content table) | `–` |  | src/views/PilotManageView.vue:322,464; src/views/GmPilotsView.vue:133,170; src/views/GmChangesView.vue:87,89; src/views/GmChangeView.vue:191; src/views/ContentView.vue:281; src/components/StatRow.vue:28 |

## 3. Notices
| ID | Where | Current text | Flag | Location |
|---|---|---|---|---|
| N-01 | Top bar → profile failed to load (title) | `Couldn't load your profile` |  | src/App.vue:104 |
| N-02 | Top bar → profile failed to load (body) | `Can't reach the database. If the site has had a quiet week, the free Supabase project may be paused: an owner can restore it from the Supabase dashboard.` | long, mechanics, tone | src/App.vue:107 |
| N-03 | Pilot sheet → GM note on a sent-back pilot (title) | `Note from the GM` |  | src/views/PilotManageView.vue:412 |
| N-04 | Pilot sheet → GM note on an approved pilot (title) | `Note from the GM` |  | src/views/PilotManageView.vue:417 |
| N-05 | Pilot sheet → GM note on an approved change (title) | `Note from the GM` |  | src/views/PilotManageView.vue:424 |
| N-06 | Pilot sheet → GM note on an approved change (body) | `Your last change was approved.` |  | src/views/PilotManageView.vue:427 |
| N-07 | Pilot sheet → last change rejected (title) | `A GM rejected your last change` |  | src/views/PilotManageView.vue:431 |
| N-08 | Conflict notice (title) | `Not saved: this changed somewhere else` | dup (§11.1) | src/components/ConflictNotice.vue:10 |
| N-09 | Conflict notice (body) | `Another tab or a GM saved a newer version. Reload to see it; your last edit here wasn't saved.` | long, tone | src/components/ConflictNotice.vue:13 |
| N-10 | Game content failed to load (pilot sheet, mech page, archives, GM change page) | `Game content didn't load: {error}` |  | src/components/CatalogueNotice.vue:8 |
| N-11 | Pilot sheet → Equipment tab → Loadout, too many items for slots | `No free slot for {names}. They're dropped at the next loadout change.` | mechanics, long | src/components/PilotLoadout.vue:99 |
| N-12 | Mech page → Loadout tab → weapons or mods left behind (title: none, body 1) | `Unfitted weapons: {names}.` |  | src/components/MechLoadout.vue:265 |
| N-13 | Mech page → Loadout tab → weapons or mods left behind (body 2) | `Mods without a weapon: {names}.` |  | src/components/MechLoadout.vue:266 |
| N-14 | Lore editor → player opens the editor | `Access denied. This page is for GMs.` | long | src/views/LoreEditView.vue:122 |
| N-15 | GM pilots → player opens the page | `Access denied. This page is for GMs.` | dup, long (§11.17) | src/views/GmPilotsView.vue:96 |
| N-16 | GM edit bar → player has a change waiting | `{name} has a change waiting for review. Editing directly will stop it from being approved: review it first.` | long, mechanics | src/components/GmEditBar.vue:22 |
| N-17 | GM changes → player opens the page | `Access denied. This page is for GMs.` | dup, long (§11.17) | src/views/GmChangesView.vue:60 |
| N-18 | GM change → player opens the page | `Access denied. This page is for GMs.` | dup, long (§11.17) | src/views/GmChangeView.vue:182 |
| N-19 | GM change → player edited the pilot after the change was made | `This pilot changed after the change was made. Approval is blocked, so the proposal can't overwrite newer edits.` | dup, long, mechanics, tone (§11.19) | src/views/GmChangeView.vue:221 |
| N-20 | GM change → reviewed change | `This change has been reviewed. Its original comparison and cost weren't stored, so the figures above use the proposal and the current manna received.` | long, mechanics | src/views/GmChangeView.vue:254 |
| N-21 | Content → non-owner opens the page | `Access denied. This page is for owners.` | dup, long (§11.17) | src/views/ContentView.vue:197 |
| N-22 | Content → pack import succeeded (title) | `{pack} is ready` |  | src/views/ContentView.vue:208 |
| N-23 | Content → pack import succeeded (body 1) | `Version {version} imported: {added} new, {updated} updated, {retained} older items kept.` |  | src/views/ContentView.vue:209 |
| N-24 | Content → pack import succeeded (body 2) | `Its content is now in the pilot and mech pickers.` |  | src/views/ContentView.vue:210 |
| N-25 | Content → pack preview, COMP/CON v3 | `This is a COMP/CON v3 pack. Some advanced effects are not displayed by this site yet.` | long | src/lcp.ts:95 |
| N-26 | Content → pack preview, dependencies | `This pack declares dependencies. Check its required packs and versions before importing; dependency requirements are not verified automatically.` | long, tone, mechanics | src/lcp.ts:96 |
| N-27 | Content → pack preview, some items have campaign edits | `{n} of this pack's items has campaign edits (made in the content editor). The update keeps them.  /  {n} of this pack's items have campaign edits (made in the content editor). The update keeps them.` |  | src/views/ContentView.vue:237 |
| N-28 | Content → pack preview, ID conflicts (title) | `Item IDs need attention` |  | src/views/ContentView.vue:247 |
| N-29 | Content → pack preview, ID conflicts (body) | `This import is blocked. Give these items unique IDs in the LCP editor, or choose an update for their original pack.` | long, mechanics | src/views/ContentView.vue:248 |
| N-30 | Content editor → non-owner opens the page | `Access denied. This page is for owners.` | dup, long (§11.17) | src/views/ContentEditorView.vue:188 |
| N-31 | Content editor → official item, already edited (title) | `Edited from {pack}` |  | src/components/editor/EditorPane.vue:227 |
| N-32 | Content editor → official item, already edited (body) | `The campaign's version replaces the pack's everywhere, and pack updates keep it. The pack's own is under Original in the preview.` | dup, long, tone, mechanics (§11.28) | src/components/editor/EditorPane.vue:230 |
| N-33 | Content editor → official item, not yet edited (title) | `Official content from {pack}` |  | src/components/editor/EditorPane.vue:233 |
| N-34 | Content editor → official item, not yet edited (body) | `Saving makes the campaign's own version of it. Pack updates keep your version.` | dup, long, tone, mechanics (§11.28) | src/components/editor/EditorPane.vue:234 |
| N-35 | Content editor → item used by pilots (title) | `Used by {name}, {name}, {name} and {n} more` |  | src/components/editor/EditorPane.vue:238 |
| N-36 | Content editor → item used by pilots (body) | `Saving changes their sheets. Players see the new numbers straight away; nothing needs approving.` | long, tone, mechanics | src/components/editor/EditorPane.vue:239 |
| N-37 | Content editor → problems list (title, with errors) | `Fix {n} problem before saving  /  Fix {n} problems before saving` | dup (§11.8) | src/components/editor/EditorPane.vue:243 |
| N-38 | Content editor → problems list (title, warnings only) | `Worth a look` | tone | src/components/editor/EditorPane.vue:243 |
| N-39 | Content editor → problems list (line prefixes) | `Error: {text}  /  Warning: {text}` |  | src/components/editor/EditorPane.vue:245 |
| N-40 | Content editor → kind with no form | `There's no form for {kind} yet. Edit the data below; the preview shows the result.` | long, tone | src/components/editor/EditorPane.vue:261 |
| N-41 | Content editor → preview can't be drawn | `The preview can't be drawn from this data: {error}` |  | src/components/editor/EditorPreview.vue:65 |
| N-42 | Content editor → preview, original can't be drawn | `The original can't be drawn: {error}` |  | src/components/editor/EditorPreview.vue:75 |

## 4. Empty states
| ID | Where | Current text | Flag | Location |
|---|---|---|---|---|
| E-01 | Pilot sheet → writing field with no text (read-only) | `Nothing on file.` | dup (§11.5) | src/components/SheetField.vue:57 |
| E-02 | Pilot sheet → Equipment tab → Biomods, nothing installed | `No biomods installed.` | dup (§11.5) | src/components/LoadoutBox.vue:90 |
| E-03 | Pilot sheet → biomod picker, no results | `Nothing matches that search.` | dup (§11.5) | src/components/LoadoutBox.vue:130 |
| E-04 | Pilot sheet → biomod picker, nothing imported | `Nothing to choose from yet: the content packs may not be imported.` | dup, mechanics (§11.5) | src/components/LoadoutBox.vue:130 |
| E-05 | Pilot sheet → Equipment tab → Loadout, read-only and nothing equipped | `No gear equipped.` | dup (§11.5) | src/components/PilotLoadout.vue:95 |
| E-06 | Pilot sheet → Equipment tab → Loadout, empty slot | `No {armour\|weapon\|gear} in this slot.` | dup (§11.5) | src/components/PilotLoadout.vue:33 |
| E-07 | Pilot sheet → Licences tab → no licences | `No licences yet.` | dup (§11.5) | src/components/RankPanel.vue:152 |
| E-08 | Pilot sheet → Licences tab → Core bonuses, picks left | `{count} pick left. / {count} picks left.` | dup (§11.5) | src/components/CoreBonusPanel.vue:89 |
| E-09 | Pilot sheet → Licences tab → Core bonuses, none left | `Next pick at {n} licence ranks.` | dup (§11.5) | src/components/CoreBonusPanel.vue:92 |
| E-10 | Pilot sheet → Licences tab → Core bonuses, read-only and none | `No core bonuses.` | dup (§11.5) | src/components/CoreBonusPanel.vue:95 |
| E-11 | Pilot sheet → Talents tab → no talents | `No talents yet.` | dup (§11.5) | src/components/RankPanel.vue:152 |
| E-12 | Pilot sheet → Mechs tab → no mechs (editable) | `No mechs yet.` | dup (§11.5) | src/components/MechHangar.vue:94 |
| E-13 | Pilot sheet → Mechs tab → no mechs (read-only) | `No mechs on file.` | dup (§11.5) | src/components/MechHangar.vue:94 |
| E-14 | Mech page → Stats tab → no frame | `Choose a frame to work out this mech's stats.` | dup (§11.29) | src/views/MechView.vue:408 |
| E-15 | Mech page → Loadout tab → mount with a Superheavy brace | `Bracing the Superheavy weapon.` | dup (§11.5) | src/components/MechLoadout.vue:282 |
| E-16 | Mech page → Loadout tab → empty mount (from the frame's mount type) | `Empty. Takes one Main or Auxiliary weapon.  /  Empty. Takes one weapon of any size.  /  Empty. Takes one Main or two Auxiliary weapons.  /  Empty. Takes one Main and one Auxiliary weapon.  /  Empty. Takes two Auxiliary weapons.` | dup (§11.5) | src/mechData.ts:57-61; src/components/MechLoadout.vue:213 |
| E-17 | Mech page → Loadout tab → empty place on a mount (fallback) | `Empty. Takes a weapon of any size.  /  Empty. Takes one {Main or Auxiliary} weapon.` | dup (§11.5) | src/components/MechLoadout.vue:212,311 |
| E-18 | Mech page → Loadout tab → no frame (Weapon mounts) | `Choose a frame (in the strip above) to fit its mounts.` | dup (§11.29) | src/components/MechLoadout.vue:273 |
| E-19 | Mech page → Loadout tab → no frame (Systems) | `Choose a frame (in the strip above) to see its system points.` | dup (§11.29) | src/components/MechLoadout.vue:325 |
| E-20 | Mech page → Loadout tab → no systems | `No systems installed.` | dup (§11.5) | src/components/MechLoadout.vue:338 |
| E-21 | Registry → no approved pilots | `No approved pilots yet.` | dup (§11.5) | src/router.ts:51 |
| E-22 | Pending → no pending pilots | `Nothing waiting on a GM.` | dup (§11.5) | src/router.ts:75; src/components/ReviewQueue.vue:27 |
| E-23 | Memorial → no dead pilots | `No one has died yet.` | dup (§11.5) | src/router.ts:83 |
| E-24 | Registry / Pending / Memorial → search has no matches | `No pilots match that search.` | dup (§11.5) | src/views/RegistryView.vue:46 |
| E-25 | GM review queues → nothing waiting | `Nothing waiting on a GM.` | dup (§11.5) | src/components/ReviewQueue.vue:27 |
| E-26 | Archives → nothing loaded (landing page and category pages) | `No content yet: the content packs may still be loading, or none are imported.` | dup, mechanics (§11.5) | src/views/ArchivesView.vue:215,265 |
| E-27 | Archives → search has no matches | `Nothing matches that search.` | dup (§11.5) | src/views/ArchivesView.vue:262 |
| E-28 | Archives → category is empty | `Nothing in this category in the loaded content packs.` | dup, mechanics (§11.5) | src/views/ArchivesView.vue:264 |
| E-29 | Lore → entry missing or unavailable (list pane and entry page) | `This entry isn't available.` | dup (§11.5) | src/views/LoreView.vue:61,136 |
| E-30 | Lore → no entries at all | `No lore yet.` | dup (§11.5) | src/views/LoreView.vue:100 |
| E-31 | Lore → search or filter matches nothing | `Nothing matches that search.` | dup (§11.5) | src/views/LoreView.vue:104 |
| E-32 | Lore editor → entry missing | `This entry isn't available.` | dup (§11.5) | src/views/LoreEditView.vue:126 |
| E-33 | Lore editor → link picker, no entries | `No other entries to link.` | dup (§11.5) | src/views/LoreEditView.vue:211 |
| E-34 | GM pilots → search has no matches | `No pilots match that search.` | dup (§11.5) | src/views/GmPilotsView.vue:114 |
| E-35 | GM pilots → no pilots at all | `No pilots on file.` | dup (§11.5) | src/views/GmPilotsView.vue:114 |
| E-36 | GM changes → no reviewed changes | `No changes reviewed yet.` | dup (§11.5) | src/views/GmChangesView.vue:71 |
| E-37 | GM change → nothing changed | `No changes to the approved record.` | dup (§11.5) | src/views/GmChangeView.vue:232 |
| E-38 | Content → no packs installed | `No packs installed yet. Import an LCP to fill the pilot and mech pickers.` | dup, long (§11.5) | src/views/ContentView.vue:274 |
| E-39 | Content → pack search has no matches | `No packs match that search.` | dup (§11.5) | src/views/ContentView.vue:275 |
| E-40 | Content editor → no item open | `Choose an item to edit, or make a new one.` | dup (§11.5) | src/views/ContentEditorView.vue:268 |
| E-41 | Content editor → list group, no rows (search active) | `No matches.` | dup (§11.5) | src/views/ContentEditorView.vue:223 |
| E-42 | Content editor → list group, no rows | `None yet.` | dup (§11.5) | src/views/ContentEditorView.vue:223 |
| E-43 | Full information dialog / archives pane → nothing to show | `No further information.` | dup (§11.5) | src/components/InfoBody.vue:88 |
| E-44 | Pickers → no search results | `Nothing matches that search.` | dup (§11.5) | src/components/ItemPicker.vue:72 |
| E-45 | Pickers → no options (default) | `Nothing to choose from yet: the content packs may not be imported.` | dup, mechanics (§11.5) | src/components/ItemPicker.vue:72 |
| E-46 | Writing editor link picker, no entries | `No other entries to link to.` | dup (§11.5) | src/components/RichTextEditor.vue:82 |
| E-47 | Content editor → built-in equipment picker, nothing to pick | `There are no weapons or systems to choose from.` | dup (§11.5) | src/components/editor/ItemIdListField.vue:31 |

## 5. Blocked reasons and rule checks
| ID | Where | Current text | Flag | Location |
|---|---|---|---|---|
| R-01 | Rule check title, viewing someone else's sheet | `"1 rule problem" / "{count} rule problems"` | dup (§11.9) | src/components/RuleCheck.vue:10 |
| R-02 | Rule check title, your own editable sheet | `"1 rule to fix" / "{count} rules to fix"` | dup (§11.9) | src/components/RuleCheck.vue:11 |
| R-03 | Rule check title, your own draft change | `"1 rule to fix before you submit" / "{count} rules to fix before you submit"` | dup (§11.9) | src/components/RuleCheck.vue:11 |
| R-04 | Pilot sheet → rule check, manna overspent | `{spent} manna spent, but only {received} received.` | dup (§11.9) | src/rules.ts:290 |
| R-05 | Pilot sheet → rule check, personal stat base out of range ({stat} is the id with - for _) | `{stat}: base personal stats must be whole numbers from {min} to {max}.` | dup (§11.9) | src/rules.ts:31 |
| R-06 | Pilot sheet → rule check, personal points overspent | `{used} personal stat points allocated, but only {available} are available.` | dup (§11.9) | src/rules.ts:33 |
| R-07 | Pilot sheet → Stats tab → minus button tooltip | `Already at the minimum ({min})` |  | src/components/StatRow.vue:33 |
| R-08 | Pilot sheet → Stats tab → plus button tooltip | `Already at the maximum ({max})` |  | src/components/StatRow.vue:35 |
| R-09 | Pilot sheet → Stats tab → plus button tooltip (budget spent) | `No points left` |  | src/components/StatRow.vue:35 |
| R-10 | Pilot sheet → rule check, HASE points overspent | `{used} HASE points taken, but level {level} only gives {points}.` |  | src/rules.ts:293 |
| R-11 | Pilot sheet → rule check, HASE stat out of range | `{stat} must be a whole number from 0 to {max}.` |  | src/rules.ts:295 |
| R-12 | Pilot sheet → biomod picker, blocked reason | `Over the limit` | dup (§11.7) | src/components/LoadoutBox.vue:54 |
| R-13 | Pilot sheet → biomod picker / licence / talent / core bonus pickers, blocked reason | `Not enough manna` | dup (§11.7) | src/components/LoadoutBox.vue:54; src/components/RankPanel.vue:84,107,147 |
| R-14 | Pilot sheet → pickers, blocked reason for GM-only content | `(GM_ONLY_REASON, see rules.ts)` | dup (§11.7) | src/components/LoadoutBox.vue:54 |
| R-15 | Pilot sheet → rule check, mod points overspent | `Biomods use {used} mod points, but level {level} only gives {limit}.` |  | src/rules.ts:298 |
| R-16 | Pilot sheet → rule check, gear slots exceeded | `Pilot gear exceeds its available armour, weapon or gear slots.` |  | src/rules.ts:313 |
| R-17 | Pilot sheet → rule check, gear missing from packs | `Pilot gear includes items unavailable in the loaded content packs.` | dup, mechanics (§11.10) | src/rules.ts:314 |
| R-18 | Pilot sheet → rule check, biomod missing | `Biomod {id} isn't in the loaded catalogue.` | dup, mechanics (§11.10) | src/rules.ts:317 |
| R-19 | Pilot sheet → rule check, biomod installed twice | `A biomod can only be installed once.` |  | src/rules.ts:318 |
| R-20 | Pilot sheet → Licences/Talents → Add button, not enough manna | `Not enough manna` | dup (§11.7) | src/components/RankPanel.vue:107 |
| R-21 | Pilot sheet → Licences/Talents → Raise rank button, not enough manna | `Not enough manna` | dup (§11.7) | src/components/RankPanel.vue:147 |
| R-22 | Pilot sheet → rule check, too many core bonuses | `Core bonuses taken: {taken}, but {ranks} licence ranks only give {picks}.` | dup (§11.9) | src/rules.ts:72 |
| R-23 | Pilot sheet → rule check, core bonus missing from packs | `Core bonus {id} isn't in the loaded content packs.` | dup, mechanics (§11.10) | src/rules.ts:78 |
| R-24 | Pilot sheet → rule check, duplicate core bonus | `{bonus} can only be taken once.` |  | src/rules.ts:81 |
| R-25 | Pilot sheet → rule check, core bonus without manufacturer | `{bonus} has no manufacturer in the loaded content packs.` | dup, mechanics (§11.10) | src/rules.ts:83 |
| R-26 | Pilot sheet → rule check, core bonus manufacturer ranks | `{maker} core bonuses need {n} {maker} licence ranks; you have {ranks}.` |  | src/rules.ts:92 |
| R-27 | Pilot sheet → pickers, blocked reason for GM-only content | `GM only` | dup (§11.7) | src/rules.ts:47 |
| R-28 | Pilot sheet → rule check, licence rank invalid | `{licence} licence must be a whole rank from 0 to III.` |  | src/rules.ts:301 |
| R-29 | Pilot sheet → rule check, licence missing from packs | `Licence {id} isn't in the loaded licensed frames.` | dup, mechanics (§11.10) | src/rules.ts:305 |
| R-30 | Pilot sheet → rule check, licence held under an alternate frame | `{frame} is now part of the {original} licence, not a licence of its own: a GM should move its ranks there.` | long, mechanics | src/rules.ts:306 |
| R-31 | Pilot sheet → rule check, talent rank invalid | `Talent {id} must be a whole rank from 0 to III.` |  | src/rules.ts:309 |
| R-32 | Pilot sheet → rule check, talent missing from packs | `Talent {id} isn't in the loaded content packs.` | dup, mechanics (§11.10) | src/rules.ts:310 |
| R-33 | Mech page → frame picker, blocked reason, licence rank missing | `Needs licence {I\|II\|III}` | dup (§11.7) | src/rules.ts:114 |
| R-34 | Mech page → frame picker, blocked reason, other frame chosen for this licence | `Licence gives {frame}` | dup (§11.7) | src/rules.ts:116 |
| R-35 | Mech page → rule check, frame missing from packs | `its frame isn't in the loaded content packs.` | dup, case, mechanics (§11.10) | src/rules.ts:181 |
| R-36 | Mech page → rule check, talent-only item without its talent | `{item} needs its talent rank; it is no longer granted.` | dup (§11.9) | src/rules.ts:192 |
| R-37 | Mech page → rule check, integrated item in a normal slot | `{item} is integrated and must not also occupy a normal slot.` | mechanics | src/rules.ts:193 |
| R-38 | Mech page → rule check, mounts gone after frame change | `Weapons remain on mounts this build no longer has; remove or refit them.` | tone | src/rules.ts:195 |
| R-39 | Mech page → rule check, extra slots gone | `Weapons remain in extra slots this mount no longer has; remove or refit them.` | tone | src/rules.ts:196 |
| R-40 | Mech page → rule check, core bonus needs a mount | `{bonus}: choose a normal mount.` |  | src/rules.ts:201 |
| R-41 | Mech page → rule check, Overpower Caliber needs a weapon | `Overpower Caliber: choose an equipped weapon.` |  | src/rules.ts:205 |
| R-42 | Mech page → rule check, weapon profile no longer exists | `{weapon}: selected weapon profile is unavailable.` |  | src/rules.ts:212 |
| R-43 | Mech page → rule check, prototype weapon type | `Prototype weapon has an invalid weapon type.` |  | src/rules.ts:214 |
| R-44 | Mech page → rule check, prototype damage type | `Prototype weapon has an invalid damage type.` |  | src/rules.ts:215 |
| R-45 | Mech page → rule check, prototype improvements | `Prototype weapon must choose two improvements.` |  | src/rules.ts:216 |
| R-46 | Mech page → rule check, frame licence rank missing | `The {frame} frame needs {licence} licence rank {I\|II\|III}.` |  | src/rules.ts:220,223 |
| R-47 | Mech page → rule check, item licence rank missing | `{item} needs {licence} licence rank {I\|II\|III}.` |  | src/rules.ts:220 |
| R-48 | Mech page → rule check, wrong alternate frame | `{frame} isn't the frame the {licence} licence gives this pilot.` |  | src/rules.ts:225 |
| R-49 | Mech page → rule check, weapon missing from packs | `A weapon ({id}) isn't in the loaded content packs.` | dup, mechanics (§11.10) | src/rules.ts:237 |
| R-50 | Mech page → rule check, weapon on wrong mount | `{weapon} ({size}) doesn't fit its {mount} mount.` |  | src/rules.ts:242 |
| R-51 | Mech page → rule check, Superheavy needs a second mount | `Its Superheavy weapon needs a second, empty mount.` |  | src/rules.ts:247 |
| R-52 | Mech page → rule check, mod on a missing weapon | `{mod} is on a weapon that is no longer there; remove it.` | tone | src/rules.ts:254 |
| R-53 | Mech page → rule check, mod missing from packs | `A mod ({id}) isn't in the loaded content packs.` | dup, mechanics (§11.10) | src/rules.ts:255 |
| R-54 | Mech page → rule check, mod doesn't fit weapon | `{mod} can't go on {weapon}. {reason}.` | long | src/rules.ts:259 |
| R-55 | Mech page → rule check, system missing from packs | `A system ({id}) isn't in the loaded content packs.` | dup, mechanics (§11.10) | src/rules.ts:266 |
| R-56 | Mech page → rule check, second Unique item | `{item} is unique: one per mech.` |  | src/rules.ts:273 |
| R-57 | Mech page → rule check, too many AIs (one) | `Only one AI per mech.` |  | src/rules.ts:275 |
| R-58 | Mech page → rule check, too many AIs (more) | `Only {n} AIs allowed on this mech.` |  | src/rules.ts:275 |
| R-59 | Mech page → rule check, system points over | `Its system points are over: {used}/{total}.` |  | src/rules.ts:280 |
| R-60 | Pilot sheet → rule check, mech problem prefix | `{mech name}: {mech problem}` |  | src/rules.ts:322 |
| R-61 | Mech page → Loadout picker → blocked, licence | `Needs {licence} {I\|II\|III}` | dup (§11.7) | src/components/MechLoadout.vue:147 |
| R-62 | Mech page → Loadout picker → blocked, Unique | `Unique: already on this mech` | dup (§11.7) | src/components/MechLoadout.vue:149 |
| R-63 | Mech page → Loadout picker → blocked, AI capacity | `AI capacity {n}` | dup (§11.7) | src/components/MechLoadout.vue:150 |
| R-64 | Mech page → Loadout picker → blocked, Superheavy | `Needs an empty mount to brace it` | dup (§11.7) | src/components/MechLoadout.vue:151 |
| R-65 | Mech page → Loadout picker → blocked, system points | `Not enough SP` | dup (§11.7) | src/components/MechLoadout.vue:152 |
| R-66 | Mech page → Loadout picker → blocked, mod can't go on this weapon | `An integrated mount can't be modified  /  {weapon} can't take mods  /  Fits {types} weapons only  /  Can't go on {type} weapons` | dup (§11.7) | src/equipment.ts:18,28-31 |
| R-67 | Mech page → Loadout picker → blocked, GM-only content | `GM only` | dup (§11.7) | src/rules.ts:47 |
| R-68 | GM change → Approve change button, blocked reason | `The pilot changed after this change was made.` | dup (§11.19) | src/views/GmChangeView.vue:268 |
| R-69 | Content → Import pack button, blocked reason (ID conflicts) | `Fix the item IDs above first.` | dup (§11.7) | src/views/ContentView.vue:43 |
| R-70 | Content → Import pack button, blocked reason (still loading) | `Loading installed content…` | dup (§11.7) | src/views/ContentView.vue:44 |
| R-71 | Content → Import pack button, blocked reason (load failed) | `Installed content failed to load.` | dup (§11.7) | src/views/ContentView.vue:44 |
| R-72 | Content → Remove button, blocked reason | `Used by {name}, {name}, {name} and {n} more` | dup (§11.7) | src/views/ContentView.vue:50 |
| R-73 | Content editor → Publish button, blocked reason | `Save your changes first.` | dup (§11.7) | src/components/editor/EditorPane.vue:208 |
| R-74 | Content editor → Save changes / Create button, blocked reason | `Fix {n} problem first.  /  Fix {n} problems first.` | dup (§11.8) | src/components/editor/EditorPane.vue:214 |
| R-75 | Content editor → Delete item button, blocked reason | `Used by {name}, {name} and {n} more. Swap it out of their sheets first.` | dup, long (§11.7) | src/components/editor/EditorPane.vue:271 |

## 6. Editor validation messages
| ID | Where | Current text | Flag | Location |
|---|---|---|---|---|
| V-01 | Content editor → new item id already used | `That ID is already used by another item.` |  | src/components/editor/EditorPane.vue:90 |
| V-02 | Content editor → raw data box, not valid JSON | `Not valid JSON: {message}  /  Not valid JSON: unreadable` |  | src/contentEditor.ts:81 |
| V-03 | Content editor → raw data box, not an object | `The data must be one JSON object, in curly braces.` |  | src/contentEditor.ts:79 |
| V-04 | Content editor → every kind, id changed | `The ID can't change: it has to stay "{id}", so pilots keep this item.` |  | src/contentEditor.ts:361 |
| V-05 | Content editor → every kind, name missing | `A name is needed.` |  | src/contentEditor.ts:362,381,400 |
| V-06 | Content editor → pilot gear, kind of gear | `Choose what kind of gear this is.` |  | src/contentEditor.ts:363 |
| V-07 | Content editor → core bonus, manufacturer | `Choose the manufacturer of this core bonus.` |  | src/contentEditor.ts:364 |
| V-08 | Content editor → tag on any item, not chosen | `Tag {n} needs choosing.  /  {who}: tag {n} needs choosing.` |  | src/contentEditor.ts:188 |
| V-09 | Content editor → tag on any item, unknown tag | `Tag "{id}" isn't in the loaded tags.` |  | src/contentEditor.ts:189 |
| V-10 | Content editor → tag on any item, needs a value | `{Tag name} needs a number.` |  | src/contentEditor.ts:190 |
| V-11 | Content editor → bonus on any item, no type | `Bonus {n} needs a type.` |  | src/contentEditor.ts:197 |
| V-12 | Content editor → bonus on any item, unknown type | `Bonus "{id}" isn't counted by the site's build maths.` | mechanics | src/contentEditor.ts:198 |
| V-13 | Content editor → bonus on any item, bad value | `Bonus {n} needs a number, or a formula such as {systems}/2.` |  | src/contentEditor.ts:200 |
| V-14 | Content editor → action on any item, no name | `Action {n} needs a name.` |  | src/contentEditor.ts:209 |
| V-15 | Content editor → action on any item, unknown activation | `Action {n} has an activation the site doesn't know.` |  | src/contentEditor.ts:210 |
| V-16 | Content editor → action on any item, no rules text | `Action {n} has no rules text, so players won't see it.` |  | src/contentEditor.ts:212 |
| V-17 | Content editor → range or damage row, no type | `{Range\|Damage\|Added range\|Added damage} {n} needs a type.` |  | src/contentEditor.ts:174 |
| V-18 | Content editor → range row, no number | `Range {n} needs a number.` |  | src/contentEditor.ts:176 |
| V-19 | Content editor → damage row, no number | `Damage {n} needs a number or dice such as 1d6+2.` | dup | src/contentEditor.ts:176 |
| V-20 | Content editor → deployable, no name | `{Deployable} needs a name.` |  | src/contentEditor.ts:222 |
| V-21 | Content editor → deployable, bad number | `{Deployable}: {size\|HP\|evasion\|e-defence\|armour} needs a number, 0 or more.` |  | src/contentEditor.ts:225 |
| V-22 | Content editor → weapon, licence not a frame | `The licence "{id}" isn't a frame that exists.` |  | src/contentEditor.ts:235 |
| V-23 | Content editor → weapon, system or mod, licence rank | `A licence rank is I, II or III.` |  | src/contentEditor.ts:237 |
| V-24 | Content editor → system points | `System points need a whole number, 0 or more.` |  | src/contentEditor.ts:241 |
| V-25 | Content editor → weapon, mount size | `Choose the mount size.` |  | src/contentEditor.ts:245 |
| V-26 | Content editor → weapon, weapon type | `Choose the weapon type.` |  | src/contentEditor.ts:246 |
| V-27 | Content editor → weapon, profile without a name | `Profile {n} needs a name.` |  | src/contentEditor.ts:256 |
| V-28 | Content editor → weapon, duplicate profile names | `Profile names must differ: "{name}" is used twice.` |  | src/contentEditor.ts:257 |
| V-29 | Content editor → system, kind of system | `Choose the kind of system.` |  | src/contentEditor.ts:265 |
| V-30 | Content editor → weapon mod, added tag not chosen | `Added tag {n} needs choosing.` |  | src/contentEditor.ts:279 |
| V-31 | Content editor → talent, ranks | `A talent has exactly three ranks.` |  | src/contentEditor.ts:286 |
| V-32 | Content editor → talent, rank without a name | `{Rank I\|II\|III} needs a name.` |  | src/contentEditor.ts:290 |
| V-33 | Content editor → talent, granted item doesn't exist | `{Rank}: "{id}" isn't an item that exists.` |  | src/contentEditor.ts:294 |
| V-34 | Content editor → frame, manufacturer | `Choose the manufacturer.` |  | src/contentEditor.ts:303 |
| V-35 | Content editor → frame, licence rank | `A licence rank is none (0), I, II or III.` |  | src/contentEditor.ts:305 |
| V-36 | Content editor → frame, alternate of itself | `A frame can't be an alternate of itself.` |  | src/contentEditor.ts:308 |
| V-37 | Content editor → frame, alternate of an alternate | `Choose the original frame: an alternate frame is already an alternate of another.` |  | src/contentEditor.ts:309 |
| V-38 | Content editor → frame, licence id | `A frame is its own licence: licence id should be "{id}".` | mechanics | src/contentEditor.ts:311 |
| V-39 | Content editor → frame, stat not a number | `{Stat} needs a number.` |  | src/contentEditor.ts:318 |
| V-40 | Content editor → frame, size | `Size is ½, 1, 2 or 3.` |  | src/contentEditor.ts:319 |
| V-41 | Content editor → frame, stat not whole | `{Stat} needs a whole number, 0 or more.  /  {Stat} needs a whole number.` |  | src/contentEditor.ts:320 |
| V-42 | Content editor → frame, mounts | `A frame needs at least one weapon mount.` |  | src/contentEditor.ts:324 |
| V-43 | Content editor → frame, unknown mount | `Mount {n} needs a mount the site knows.` |  | src/contentEditor.ts:326 |
| V-44 | Content editor → frame, trait without a name | `Trait {n} needs a name.` |  | src/contentEditor.ts:333 |
| V-45 | Content editor → frame, duplicate trait names | `Trait names must differ: "{name}" is used twice.` |  | src/contentEditor.ts:334 |
| V-46 | Content editor → frame, core system name | `The core system needs a name.` |  | src/contentEditor.ts:341 |
| V-47 | Content editor → frame, core system built-in item | `Core system: "{id}" isn't an item that exists.` |  | src/contentEditor.ts:346 |
| V-48 | Content editor → manufacturer, id | `The ID is a short code of letters, numbers, - and _, such as IPS-N.` |  | src/contentEditor.ts:352 |
| V-49 | Content editor → manufacturer, main colour | `The main colour needs a hex colour such as #1c9ae8.` |  | src/contentEditor.ts:353 |
| V-50 | Content editor → manufacturer, darker colour | `The darker colour needs a hex colour such as #0c4d99.` |  | src/contentEditor.ts:354 |
| V-51 | Content editor → biomod, no slot (warning) | `No slot: pilots will not see where on the body it goes.` |  | src/contentEditor.ts:382 |
| V-52 | Content editor → biomod, no manufacturer (warning) | `No manufacturer: it's listed under Other.` |  | src/contentEditor.ts:383 |
| V-53 | Content editor → biomod, price | `The price needs a whole number of manna, 0 or more.` |  | src/contentEditor.ts:384 |
| V-54 | Content editor → biomod, mod points | `Mod points need a whole number, 0 or more.` |  | src/contentEditor.ts:385 |
| V-55 | Content editor → biomod, bonus has no stat | `Bonus {n} needs a stat that exists.` |  | src/contentEditor.ts:390 |
| V-56 | Content editor → biomod, two bonuses on one stat | `Only one bonus per stat: {stat} is there twice.` |  | src/contentEditor.ts:391 |
| V-57 | Content editor → biomod, bonus amount | `Bonus {n} needs a whole number other than 0.` |  | src/contentEditor.ts:393 |
| V-58 | Content editor → personal stat, order | `The order needs a whole number.` |  | src/contentEditor.ts:401 |

## 7. Confirm dialogs
| ID | Where | Current text | Flag | Location |
|---|---|---|---|---|
| C-01 | Pilot sheet → Danger zone → Mark pilot dead | `Mark {name} dead? This can't be undone. They move to the memorial, and you can register a new pilot.` | dup (§11.12) | src/views/PilotManageView.vue:108 |
| C-02 | Pilot sheet → Withdraw a change | `Withdraw this change? Everything in it is thrown away; your approved pilot stays as it is.` | long, tone | src/views/PilotManageView.vue:113 |
| C-03 | Pilot sheet → Mark dead confirm button | `Mark dead` | (§11.14) | src/views/PilotManageView.vue:108 |
| C-04 | Pilot sheet → Withdraw confirm button | `Withdraw` | (§11.14) | src/views/PilotManageView.vue:113 |
| C-05 | Pilot sheet → Equipment tab → Loadout → Remove | `Remove {name}?` | dup (§11.13) | src/components/PilotLoadout.vue:48 |
| C-06 | Pilot sheet → Equipment tab → Loadout → Remove confirm button | `Remove` | (§11.14) | src/components/PilotLoadout.vue:48 |
| C-07 | Pilot sheet → Licences tab → Core bonuses → Remove | `Remove {name}?` | dup (§11.13) | src/components/CoreBonusPanel.vue:41 |
| C-08 | Pilot sheet → Core bonuses → Remove confirm button | `Remove` | (§11.14) | src/components/CoreBonusPanel.vue:41 |
| C-09 | Mech page → change frame | `A new frame has different mounts, so this mech's weapons, and their mods, come off. Go ahead?` | tone | src/views/MechView.vue:187 |
| C-10 | Mech page → change frame confirm button | `Change frame` | (§11.14) | src/views/MechView.vue:187 |
| C-11 | Mech page → Scrap mech | `Scrap {mech}? This can't be undone.` |  | src/views/MechView.vue:212 |
| C-12 | Mech page → Scrap mech confirm button | `Scrap mech` | (§11.14) | src/views/MechView.vue:212 |
| C-13 | Mech page → Loadout → Remove weapon | `Remove {weapon}?  /  Remove {weapon} and its mod, {mod}?` | dup (§11.13) | src/components/MechLoadout.vue:113 |
| C-14 | Mech page → Loadout → Remove mod | `Remove {mod}?` | dup (§11.13) | src/components/MechLoadout.vue:118 |
| C-15 | Mech page → Loadout → Remove system | `Remove {system}?` | dup (§11.13) | src/components/MechLoadout.vue:122 |
| C-16 | Mech page → Loadout → Remove confirm button | `Remove` | (§11.14) | src/components/MechLoadout.vue:113,118,122 |
| C-17 | Lore editor → Unpublish | `Unpublish "{title}"? Only GMs will be able to read it.` | (§11.15) | src/views/LoreEditView.vue:86 |
| C-18 | Lore editor → Unpublish confirm button | `Unpublish` | (§11.14) | src/views/LoreEditView.vue:86 |
| C-19 | Lore editor → Delete entry | `Delete "{title}"? This can't be undone. Links to it from other entries will stop working.` | dup | src/views/LoreEditView.vue:112 |
| C-20 | Lore editor → Delete entry confirm button | `Delete entry` | (§11.14) | src/views/LoreEditView.vue:112 |
| C-21 | GM review → Mark pilot dead | `Mark {name} dead? This can't be undone. They move to the memorial.` | dup (§11.12) | src/components/GmReview.vue:60 |
| C-22 | GM review → Mark dead confirm button | `Mark dead` | (§11.14) | src/components/GmReview.vue:60 |
| C-23 | GM review → Delete pilot | `Delete {name} permanently? This removes the pilot, their sheet, mechs and every change. It can't be undone.` |  | src/components/GmReview.vue:73 |
| C-24 | GM review → Delete pilot confirm button | `Delete pilot` | (§11.14) | src/components/GmReview.vue:73 |
| C-25 | GM review → Approve pilot | `Approve {name}? They'll appear in the pilot registry.{ The rule check lists {n} problem(s).}` |  | src/components/GmReview.vue:94-95 |
| C-26 | GM review → Approve confirm button | `Approve pilot` | (§11.14) | src/components/GmReview.vue:95 |
| C-27 | GM change → Approve change | `Approve this change to {name}? It goes live straight away.{ The rule check lists {n} problem(s).}` | tone | src/views/GmChangeView.vue:146-147 |
| C-28 | GM change → Approve confirm button | `Approve change` | (§11.14) | src/views/GmChangeView.vue:147 |
| C-29 | Content → Remove a pack | `Remove {pack} and its {n} item(s)? This can't be undone. Importing the pack again brings them back.` |  | src/views/ContentView.vue:171 |
| C-30 | Content → Remove pack confirm button | `Remove pack` | (§11.14) | src/views/ContentView.vue:171 |
| C-31 | Content editor → leaving with unsaved changes | `Discard your unsaved changes?` |  | src/views/ContentEditorView.vue:94 |
| C-32 | Content editor → leaving confirm button | `Discard changes` | (§11.14) | src/views/ContentEditorView.vue:94 |
| C-33 | Content editor → Publish | `Publish "{title}"? Players can pick it as soon as it's published, and it can't go back to a draft.` |  | src/components/editor/EditorPane.vue:148 |
| C-34 | Content editor → Publish confirm button | `Publish` | (§11.14) | src/components/editor/EditorPane.vue:148 |
| C-35 | Content editor → Revert to original | `Put "{title}" back to the pack's own version? The campaign's edits are lost, and every pilot using it sees the original.` |  | src/components/editor/EditorPane.vue:158 |
| C-36 | Content editor → Revert confirm button | `Revert to original` | (§11.14) | src/components/editor/EditorPane.vue:158 |
| C-37 | Content editor → Delete item | `Delete "{title}"? This can't be undone. It's in no pilot's sheet.` |  | src/components/editor/EditorPane.vue:176 |
| C-38 | Content editor → Delete confirm button | `Delete item` | (§11.14) | src/components/editor/EditorPane.vue:176 |

## 8. Status and error messages
| ID | Where | Current text | Flag | Location |
|---|---|---|---|---|
| M-01 | Pilot sheet → name field left empty, and register form | `A pilot needs a name.` |  | src/views/PilotManageView.vue:153,167 |
| M-02 | Pilot sheet → loading | `Loading pilot record…` | dup (§11.4) | src/views/PilotManageView.vue:267 |
| M-03 | Pilot sheet → pilot id unknown | `No pilot record with that id.` |  | src/views/PilotManageView.vue:269 |
| M-04 | Pilot sheet → load error | `{error}` |  | src/views/PilotManageView.vue:268 |
| M-05 | Pilot sheet → writing fields, saving | `Saving…` | dup (§11.2) | src/components/SheetField.vue:30 |
| M-06 | Pilot sheet → writing fields, saved | `Saved` | dup (§11.3) | src/components/SheetField.vue:32 |
| M-07 | Pilot sheet → writing fields, edit not yet sent | `Not saved yet` | dup (§11.1) | src/components/SheetField.vue:37 |
| M-08 | Pilot sheet → writing fields, error | `Not saved: {error}` | dup (§11.1) | src/components/SheetField.vue:52 |
| M-09 | Save status (pilot sheet, mech page, GM edit bar, lore editor) | `Saving…` | dup (§11.2) | src/components/SaveStatus.vue:14 |
| M-10 | Save status | `Saved` | dup (§11.3) | src/components/SaveStatus.vue:15 |
| M-11 | Save status → error | `Not saved: {error}` | dup (§11.1) | src/components/SaveStatus.vue:11 |
| M-12 | Image upload → uploading | `Uploading…` | dup (§11.2) | src/components/ImageUpload.vue:27 |
| M-13 | Image upload → removing | `Saving…` | dup (§11.2) | src/components/ImageUpload.vue:36 |
| M-14 | Image upload → failed | `Not saved: {error}` | dup (§11.1) | src/components/ImageUpload.vue:39 |
| M-15 | Any save → can't reach the database | `can't reach the database. Check your connection, then retry.` | dup, case, long, mechanics (§11.1) | src/lib/supabaseClient.ts:11 |
| M-16 | Any save → blocked by the database (shown after "Not saved: ") | `you don't have permission to change this, or it no longer exists.` | dup, case (§11.1) | src/lib/supabaseClient.ts:9 |
| M-17 | Any save → newer version exists (message text; the notice uses ConflictNotice) | `this changed somewhere else.` | dup, case (§11.1) | src/lib/supabaseClient.ts:10 |
| M-18 | Pilot sheet / mech page → Retry while an earlier edit failed | `your last edit is not saved yet. Retry saving it first.` | dup, case, long (§11.1) | src/myPilot.ts:195 |
| M-19 | Pilot sheet → new mech or mech name/ID is blank | `A mech needs a name.` |  | src/myPilot.ts:59 |
| M-20 | Pilot sheet → new mech or mech page → manufacturer ID is malformed | `The manufacturer ID should look like XXXX-XXXX-XXXX (letters and digits).` |  | src/myPilot.ts:60 |
| M-21 | Pilot sheet / mech page → picture upload, not an image | `that file is not an image.` | dup, case (§11.1) | src/images.ts:33 |
| M-22 | Pilot sheet / mech page → picture upload, too big | `that image is over 20 MB. Pick a smaller one.` | dup, case, long (§11.1) | src/images.ts:34 |
| M-23 | Pilot sheet / mech page → picture upload, unreadable | `that image can't be read. Try a PNG, JPEG or WebP.` | dup, case, long (§11.1) | src/images.ts:36 |
| M-24 | Pilot sheet / mech page → picture upload, can't convert | `that image can't be converted.` | dup, case (§11.1) | src/images.ts:47 |
| M-25 | Pilot sheet → biomod picker, save failed | `Not saved: {error}` | dup (§11.1) | src/components/LoadoutBox.vue:106 |
| M-26 | Pilot sheet → Equipment tab → Loadout, save failed | `Not saved: {error}` | dup (§11.1) | src/components/PilotLoadout.vue:97 |
| M-27 | Pilot sheet → Licences/Talents, save failed | `Not saved: {error}` | dup (§11.1) | src/components/RankPanel.vue:154 |
| M-28 | Pilot sheet → Core bonuses, save failed | `Not saved: {error}` | dup (§11.1) | src/components/CoreBonusPanel.vue:97 |
| M-29 | Pilot sheet → Mechs tab → New mech form error | `{error}` |  | src/components/MechHangar.vue:88 |
| M-30 | Mech page → loading | `Loading mech record…` | dup (§11.4) | src/views/MechView.vue:237 |
| M-31 | Mech page → mech id unknown | `No mech with that id in {your\|this} hangar.` |  | src/views/MechView.vue:239 |
| M-32 | Mech page → load error | `{error}` |  | src/views/MechView.vue:238 |
| M-33 | Mech page → Loadout → weapon card, save failed | `Not saved: {error}` | dup (§11.1) | src/components/BuildItem.vue:59 |
| M-34 | Mech page → Loadout picker → chosen item vanished | `Item unavailable` |  | src/components/MechLoadout.vue:201 |
| M-35 | Mech page → Loadout → save failed | `Not saved: {error}` | dup (§11.1) | src/components/MechLoadout.vue:341 |
| M-36 | Registry / Pending / Memorial → loading | `Loading pilots…` | dup (§11.4) | src/views/RegistryView.vue:35 |
| M-37 | Registry / Pending / Memorial → load error | `Couldn't load the pilots: {error}` |  | src/views/RegistryView.vue:36 |
| M-38 | Lore → loading | `Loading…` | dup (§11.4) | src/views/LoreView.vue:59,98 |
| M-39 | Lore → load error | `Lore didn't load: {error}` |  | src/views/LoreView.vue:72 |
| M-40 | Lore entry → Copy link result | `Copied` |  | src/components/LoreEntry.vue:27 |
| M-41 | Lore entry → Copy link failed | `Not copied` | dup (§11.1) | src/components/LoreEntry.vue:29 |
| M-42 | Lore editor → loading | `Loading…` | dup (§11.4) | src/views/LoreEditView.vue:121,124 |
| M-43 | Lore editor → load error | `Lore didn't load: {error}` |  | src/views/LoreEditView.vue:123 |
| M-44 | Lore editor → title blank | `a title is needed.` | dup, case (§11.1) | src/views/LoreEditView.vue:66 |
| M-45 | Lore → new entry default title | `Untitled entry` |  | src/lore.ts:73 |
| M-46 | GM pilots → loading | `Loading…` | dup (§11.4) | src/views/GmPilotsView.vue:95 |
| M-47 | GM pilots → loading records | `Loading pilot records…` | dup (§11.4) | src/views/GmPilotsView.vue:97 |
| M-48 | GM pilots → load error | `{error}` |  | src/views/GmPilotsView.vue:98 |
| M-49 | GM pilots → table row, level or manna not a whole number | `Level and manna must be whole numbers, 0 or more.` | dup (§11.18) | src/views/GmPilotsView.vue:81 |
| M-50 | GM pilots → table row, no private sheet | `Private sheet missing` |  | src/views/GmPilotsView.vue:174 |
| M-51 | GM pilots → table row, save failed | `Not saved: {error}` | dup (§11.1) | src/views/GmPilotsView.vue:176 |
| M-52 | GM pilots → table row, saving | `Saving…` | dup (§11.2) | src/views/GmPilotsView.vue:179 |
| M-53 | GM pilots → table row, saved | `Saved` | dup (§11.3) | src/views/GmPilotsView.vue:180 |
| M-54 | GM review → loading | `Loading…` | dup (§11.4) | src/components/GmReview.vue:124 |
| M-55 | GM review → level or manna not a whole number | `Level and manna must be whole numbers, 0 or more.` | dup (§11.18) | src/components/GmReview.vue:49 |
| M-56 | GM review → level and manna saved | `Saved.` | dup, trailing full stop (other "Saved" has none) (§11.3) | src/components/GmReview.vue:88 |
| M-57 | GM review → refuse without a note | `Write a note first, so the player knows what to change.` | tone | src/components/GmReview.vue:112 |
| M-58 | GM review → pilot sent back | `Sent back. The player sees your note on their sheet.` | long | src/components/GmReview.vue:117 |
| M-59 | GM review → delete didn't remove anything | `Nothing was deleted. Only owners can delete pilots.` | long | src/components/GmReview.vue:77 |
| M-60 | GM changes → loading | `Loading…` | dup (§11.4) | src/views/GmChangesView.vue:59 |
| M-61 | GM changes → loading changes | `Loading changes…` | dup (§11.4) | src/views/GmChangesView.vue:62 |
| M-62 | GM changes → load error | `{error}` |  | src/views/GmChangesView.vue:63 |
| M-63 | GM change → loading | `Loading change…` | dup (§11.4) | src/views/GmChangeView.vue:181,183 |
| M-64 | GM change → change id unknown | `No change with that ID.` |  | src/views/GmChangeView.vue:43 |
| M-65 | GM change → pilot or sheet failed to load | `Could not load the complete pilot record. Reload before reviewing.` | long | src/views/GmChangeView.vue:53 |
| M-66 | GM change → load error | `{error}` |  | src/views/GmChangeView.vue:184 |
| M-67 | GM change → reject without a reason | `Write a reason first, so the player knows what to fix.` | tone | src/views/GmChangeView.vue:166 |
| M-68 | Content → loading | `Loading…` | dup (§11.4) | src/views/ContentView.vue:196 |
| M-69 | Content → loading installed content | `Loading installed content…` | dup (§11.4) | src/views/ContentView.vue:206,44 |
| M-70 | Content → installed content failed to load | `Could not load installed content. {error}` |  | src/views/ContentView.vue:79 |
| M-71 | Content → removing a pack, done | `Removed {pack}.` |  | src/views/ContentView.vue:178 |
| M-72 | Content → removing a pack, failed | `Not removed: {error}` | dup (§11.1) | src/views/ContentView.vue:181 |
| M-73 | Content → checking a file | `Checking {file}…` | dup (§11.4, 2) | src/views/ContentView.vue:214 |
| M-74 | Content → core content loading (button) | `Loading core content…` | dup (§11.4, 2) | src/views/ContentView.vue:191 |
| M-75 | Content → core content failed | `Could not load core content. {error}  /  Please try again.` |  | src/views/ContentView.vue:136 |
| M-76 | Content → file picked is not an LCP | `Choose an .lcp file or a ZIP export of one.` |  | src/views/ContentView.vue:98 |
| M-77 | Content → file too big | `Choose an LCP smaller than 15 MB.` |  | src/views/ContentView.vue:99; src/lcp.ts:39 |
| M-78 | Content → file is for a different pack than the one being updated | `This file is for {pack}. Choose an update for {target}, or use Import a pack to add it separately.` | long | src/views/ContentView.vue:102 |
| M-79 | Content → file can't be read | `Could not read this pack. Choose a valid .lcp file.` | long | src/views/ContentView.vue:105 |
| M-80 | Content → import failed | `Import failed. {error} No partial import was saved.` | long | src/views/ContentView.vue:163 |
| M-81 | Content → can't tell which pilots use a pack | `Couldn't check which pilots use it.` |  | src/views/ContentView.vue:76 |
| M-82 | Content → pack file errors, too many files | `This archive contains too many files.` |  | src/lcp.ts:48 |
| M-83 | Content → pack file errors, duplicate file | `The archive contains two copies of {file}.` |  | src/lcp.ts:53 |
| M-84 | Content → pack file errors, too large | `The JSON content is too large. Split this into smaller packs.` | long | src/lcp.ts:56 |
| M-85 | Content → pack file errors, not a zip | `Could not open this archive. Choose a valid .lcp file, not an extracted folder.` | long | src/lcp.ts:62 |
| M-86 | Content → pack file errors, bad JSON | `{file} is not valid UTF-8 JSON. Fix it and export the pack again.` | long, mechanics | src/lcp.ts:66 |
| M-87 | Content → pack file errors, no manifest | `Missing lcp_manifest.json at the top level of the archive.` | mechanics | src/lcp.ts:68 |
| M-88 | Content → pack file errors, manifest not an object | `The pack manifest must be a JSON object.` |  | src/lcp.ts:70 |
| M-89 | Content → pack file errors, manifest field missing | `The manifest needs a valid {field}.` |  | src/lcp.ts:72 |
| M-90 | Content → pack file errors, no description | `The manifest needs a description.` |  | src/lcp.ts:73 |
| M-91 | Content → pack file errors, bad version | `The pack version should look like 1.0.0.` |  | src/lcp.ts:74 |
| M-92 | Content → pack file errors, not a list | `{file} must contain a list of items.` |  | src/lcp.ts:82 |
| M-93 | Content → pack file errors, item id missing | `Every item in {file} needs a non-empty ID without surrounding spaces.` |  | src/lcp.ts:85 |
| M-94 | Content → pack file errors, item name missing | `Item {id} in {file} needs a name.` |  | src/lcp.ts:86 |
| M-95 | Content → pack file errors, duplicate id | `Duplicate item ID: {id}. Every item in a pack needs its own ID.` | long | src/lcp.ts:87 |
| M-96 | Content → pack file errors, too many items | `Import at most 10,000 items at once. Split this into smaller packs.` | long | src/lcp.ts:90 |
| M-97 | Content → pack file errors, nothing usable | `This pack contains no supported pilot or mech content.` |  | src/lcp.ts:93 |
| M-98 | Content editor → loading | `Loading…` | dup (§11.4) | src/views/ContentEditorView.vue:187,203,231 |
| M-99 | Content editor → list failed to load | `The list didn't load: {error}` |  | src/views/ContentEditorView.vue:202 |
| M-100 | Content editor → item missing | `This item isn't available. It may have been deleted.` | long | src/views/ContentEditorView.vue:82 |
| M-101 | Content editor → export done | `Exported {n} item(s) to {filename}.` |  | src/views/ContentEditorView.vue:167 |
| M-102 | Content editor → export failed | `Not exported: {error}` | dup (§11.1) | src/views/ContentEditorView.vue:161 |
| M-103 | Content editor → export, nothing to export | `There is no homebrew yet: make an item first.` |  | src/editorStore.ts:169 |
| M-104 | Content editor → export, nothing published | `There are no published homebrew items to export yet.` |  | src/editorStore.ts:173 |
| M-105 | Content editor → can't check which pilots use an item | `Couldn't check which pilots use this.` |  | src/components/editor/EditorPane.vue:241 |
| M-106 | Content editor → delete failed | `Not deleted: {error}` | dup (§11.1) | src/components/editor/EditorPane.vue:274 |
| M-107 | Content editor → biomod save found nothing | `The biomod was not saved.` | dup (§11.1) | src/editorStore.ts:111,128 |
| M-108 | Content editor → preview, error with no message | `unreadable data` | case | src/components/editor/EditorPreview.vue:40 |
| M-109 | Pickers → save failed | `Not saved: {error}` | dup (§11.1) | src/components/ItemPicker.vue:43 |
| M-110 | Content editor → Raw data → error line (shown with "Error:" prefix) | `{error}` |  | src/components/editor/RawDataField.vue:53 |

## 9. Tooltips, aria-labels and placeholders
| ID | Where | Current text | Flag | Location |
|---|---|---|---|---|
| T-01 | Top bar → logo link aria-label | `HOR_OS: home` |  | src/App.vue:59 |
| T-02 | Top bar → narrow-screen menu, signed-in line | `Signed in as {name} ({role})` |  | src/App.vue:95 |
| T-03 | Pilot sheet → header and identity portrait alt | `Portrait of {callsign or name}` | dup (§11.33) | src/views/PilotManageView.vue:293,457 |
| T-04 | Pilot sheet → tab row aria-label | `pilot sheet sections` | case | src/components/SheetTabs.vue:8 |
| T-05 | Empty portrait | `No image` |  | src/components/Portrait.vue:16 |
| T-06 | Pilot sheet → Stats tab → minus button | `Lower {stat}` |  | src/components/StatRow.vue:58 |
| T-07 | Pilot sheet → Stats tab → plus button | `Raise {stat}` |  | src/components/StatRow.vue:67 |
| T-08 | Pilot sheet → biomod picker dialog aria-label | `Choose biomods` |  | src/components/LoadoutBox.vue:92 |
| T-09 | Pilot sheet → Loadout picker title | `Choose {armour\|weapon\|gear}  /  Choose pilot gear` |  | src/components/PilotLoadout.vue:107 |
| T-10 | Pilot sheet → Licences/Talents picker title | `Add a {licence\|talent} (rank I, {price} manna)` |  | src/components/RankPanel.vue:156 |
| T-11 | Pilot sheet → Core bonuses picker title | `Choose a core bonus` |  | src/components/CoreBonusPanel.vue:99 |
| T-12 | Pilot sheet → Mechs tab → hangar thumbnail alt | `Image of {mech}` | dup (§11.33) | src/components/MechHangar.vue:63 |
| T-13 | Mech page → frame picker title | `Choose a frame` |  | src/views/MechView.vue:437 |
| T-14 | Mech page → tab row aria-label | `Mech sections` |  | src/views/MechView.vue:321 |
| T-15 | Mech page → name field aria-label | `Manufacturer ID (XXXX-XXXX-XXXX)` |  | src/views/MechView.vue:266 |
| T-16 | Mech page → manufacturer ID placeholder | `XXXX-XXXX-XXXX` |  | src/views/MechView.vue:267 |
| T-17 | Mech page → image alt (profile tab, hangar) | `Image of {mech}` | dup (§11.33) | src/views/MechView.vue:331 |
| T-18 | Mech page → Loadout → weapon mod section aria-label | `Weapon mod` |  | src/components/ModSection.vue:18 |
| T-19 | Mech page → Loadout pickers, title (weapon slot) | `Choose {mount label}` |  | src/components/MechLoadout.vue:177 |
| T-20 | Mech page → Loadout picker, title (mod) | `Choose a mod for {weapon}` |  | src/components/MechLoadout.vue:177 |
| T-21 | Mech page → Loadout picker, title (system) | `Add a system` |  | src/components/MechLoadout.vue:177 |
| T-22 | Registry / Pending / Memorial → search box placeholder | `Callsign, name, player or mech` | dup (§11.6) | src/views/RegistryView.vue:42 |
| T-23 | Registry / Pending / Memorial → search label | `Search` |  | src/views/RegistryView.vue:41 |
| T-24 | Pilot card portrait alt | `Portrait of {callsign or name}` | dup (§11.33) | src/components/PilotCard.vue:12 |
| T-25 | Archives search label | `Search every category` |  | src/views/ArchivesView.vue:168 |
| T-26 | Archives search placeholder | `Name, maker or rules text` | dup (§11.6) | src/views/ArchivesView.vue:169 |
| T-27 | Archives category tab row aria-label | `Archive categories` |  | src/views/ArchivesView.vue:176 |
| T-28 | Archives manufacturer filter aria-label | `Filter by manufacturer` |  | src/views/ArchivesView.vue:179 |
| T-29 | Archives list aria-label | `Entries` |  | src/views/ArchivesView.vue:221 |
| T-30 | Lore → search placeholder | `Title, summary or text` | dup (§11.6) | src/views/LoreView.vue:77 |
| T-31 | Lore → kind filter aria-label | `Filter by kind` |  | src/views/LoreView.vue:82 |
| T-32 | Lore → entries list aria-label | `Entries` |  | src/views/LoreView.vue:109 |
| T-33 | Lore editor → remove a related entry | `Remove {title}  /  Remove deleted entry` | case | src/views/LoreEditView.vue:192 |
| T-34 | Lore editor → link picker title | `Link an entry` | (§11.36) | src/views/LoreEditView.vue:211 |
| T-35 | GM pilots → search placeholder | `Callsign, name or player` | dup (§11.6) | src/views/GmPilotsView.vue:110 |
| T-36 | GM pilots → table region aria-label | `Pilot records` |  | src/views/GmPilotsView.vue:115 |
| T-37 | GM pilots → level input aria-label | `Level for {callsign or name}` |  | src/views/GmPilotsView.vue:151 |
| T-38 | GM pilots → manna input aria-label | `Manna received for {callsign or name}` |  | src/views/GmPilotsView.vue:161 |
| T-39 | GM pilots → manna left tooltip | `{spent} spent` |  | src/views/GmPilotsView.vue:165 |
| T-40 | GM pilots → status badge tooltip (sent-back pilots) | `{GM's note}` |  | src/views/GmPilotsView.vue:140 |
| T-41 | GM changes → reviewed table region aria-label | `Reviewed changes` |  | src/views/GmChangesView.vue:72 |
| T-42 | GM change → summary strip aria-label | `Change summary` |  | src/views/GmChangeView.vue:187 |
| T-43 | GM change → proposed changes aria-label | `Proposed changes` |  | src/views/GmChangeView.vue:225 |
| T-44 | Content → search placeholder | `Pack name or author` | dup (§11.6) | src/views/ContentView.vue:272 |
| T-45 | Content → file input aria-label | `Choose Lancer content pack` | case | src/views/ContentView.vue:199 |
| T-46 | Content → import totals aria-label | `What this import changes` |  | src/views/ContentView.vue:227 |
| T-47 | Content → import counts aria-label | `Content in this file` |  | src/views/ContentView.vue:232 |
| T-48 | Content → installed packs region aria-label | `Installed packs` |  | src/views/ContentView.vue:276 |
| T-49 | Content → Update button aria-label | `Update {pack}` |  | src/views/ContentView.vue:285 |
| T-50 | Content → Remove button aria-label | `Remove {pack}` |  | src/views/ContentView.vue:287,290 |
| T-51 | Content → core content pack description (stored in the database) | `Official LANCER core pilot and mech content.` |  | src/coreContent.ts:19 |
| T-52 | Content editor → search placeholder | `Search {kind, lower case}` | dup (§11.6) | src/views/ContentEditorView.vue:200 |
| T-53 | Content editor → search label (screen readers) | `Search {kind, lower case}` |  | src/views/ContentEditorView.vue:199 |
| T-54 | Content editor → tab row aria-label | `Kind of content` |  | src/views/ContentEditorView.vue:193 |
| T-55 | Content editor → pane aria-label | `Editing {title}` |  | src/components/editor/EditorPane.vue:193 |
| T-56 | Content editor → pane tab row aria-label | `Editor view` |  | src/components/editor/EditorPane.vue:195 |
| T-57 | Content editor → preview aria-label | `Preview` |  | src/components/editor/EditorPreview.vue:61 |
| T-58 | Content editor → Manufacturer form → name placeholder | `Corvid Heavy Industries` |  | src/components/editor/ManufacturerForm.vue:29 |
| T-59 | Content editor → Manufacturer form → ID placeholder | `CHI` |  | src/components/editor/ManufacturerForm.vue:37 |
| T-60 | Content editor → colour fields → placeholder | `#1c9ae8` |  | src/components/editor/ColourField.vue:14 |
| T-61 | Content editor → colour field → picker aria-label | `{label}: pick a colour` |  | src/components/editor/ColourField.vue:15 |
| T-62 | Full information → radar chart description (screen readers) | `Stats compared with every frame: {stat} {value}, {stat} {value}, …` |  | src/components/InfoBody.vue:28 |
| T-63 | Full information dialog aria-label | `{kind}: {name}  /  Full information` |  | src/components/InfoDialog.vue:41 |
| T-64 | Item name button, opens full information | `Full information: {name}` |  | src/components/InfoButton.vue:14 |
| T-65 | Licence unlock name link (archives) | `Open in archives: {name}` |  | src/components/InfoButton.vue:11 |
| T-66 | Pickers → search label | `Search` |  | src/components/ItemPicker.vue:39 |
| T-67 | Writing editor toolbar aria-label | `{field} formatting` |  | src/components/RichTextEditor.vue:54 |
| T-68 | Writing editor toolbar buttons (aria-label and tooltip) | `Bold / Italic / Underline / Small text / Normal text / Large text / Bullet list / Heading` |  | src/components/RichTextEditor.vue:56-67 |
| T-69 | Writing editor link button (aria-label and tooltip) | `Link to entry / Remove link` |  | src/components/RichTextEditor.vue:73-74 |
| T-70 | Writing editor link button tooltip when no text selected | `Select some text first` |  | src/components/RichTextEditor.vue:74 |
| T-71 | Writing editor link picker title | `Link to an entry` |  | src/components/RichTextEditor.vue:82 |
| T-72 | Content editor → Raw data → textarea aria-label | `Raw data (JSON)` |  | src/components/editor/RawDataField.vue:47 |
| T-73 | Content editor → Actions list → How often placeholder | `1/round` |  | src/components/editor/ActionListField.vue:40 |
| T-74 | Content editor → Actions list → Trigger placeholder | `Reactions only` |  | src/components/editor/ActionListField.vue:43 |
| T-75 | Content editor → Bonuses list → amount placeholder | `2 or {systems}/2` |  | src/components/editor/BonusListField.vue:35 |
| T-76 | Content editor → lists → remove, move and add buttons (aria-labels) | `Remove {noun} {n} / Move {noun} {n} up / Move {noun} {n} down / Remove bonus {n} / Remove mount {n} / Move mount {n} up / Move mount {n} down / Remove {tag} / Remove {item}` |  | src/components/editor/RepeatList.vue:49-51; src/components/editor/BonusListField.vue:37; src/components/editor/FrameForm.vue:151-153; src/components/editor/TagListField.vue:42; src/components/editor/ItemIdListField.vue:27 |
| T-77 | Content editor → Bonus rows → aria-labels | `Bonus {n} type / Bonus {n} amount / Bonus {n} stat` |  | src/components/editor/BonusListField.vue:29,35; src/components/editor/BionicForm.vue:68,72 |
| T-78 | Content editor → Damage rows → aria-labels | `{Damage\|Range\|Added range\|Added damage} {n} type / {…} {n} amount / Remove {…} {n}` |  | src/components/editor/DamageField.vue:33,37,42 |
| T-79 | Content editor → Tags list → aria-labels | `Tags / Add a tag / {tag} value` |  | src/components/editor/TagListField.vue:31,38,45 |
| T-80 | Content editor → Frame form → mount select aria-label | `Mount {n}` |  | src/components/editor/FrameForm.vue:145 |
| T-81 | Writing editors (empty field, all rich-text fields) | `Write here…` | (§11.40) | src/components/RichTextEditor.vue:160 |

## 10. Button labels
| ID | Where | Label | Flag | Location |
|---|---|---|---|---|
| B-01 | Top bar tabs | `My pilot` |  | src/App.vue:20-30 |
| B-02 | Top bar tabs | `Registry` |  | src/App.vue:20-30 |
| B-03 | Top bar tabs | `Pending` |  | src/App.vue:20-30 |
| B-04 | Top bar tabs | `Memorial` |  | src/App.vue:20-30 |
| B-05 | Top bar tabs | `Archives` |  | src/App.vue:20-30 |
| B-06 | Top bar tabs | `Lore` |  | src/App.vue:20-30 |
| B-07 | Top bar tabs | `Pilots` |  | src/App.vue:20-30 |
| B-08 | Top bar tabs | `Changes` |  | src/App.vue:20-30 |
| B-09 | Top bar tabs | `Content` |  | src/App.vue:20-30 |
| B-10 | Top bar | `Disconnect` |  | src/App.vue:81 |
| B-11 | Top bar (narrow screens) | `Menu` | (§11.45) | src/App.vue:83 |
| B-12 | Top bar (narrow screens); Full information dialog; Pickers | `Close` | (§11.45) | src/App.vue:83; src/components/InfoDialog.vue:54; src/components/ItemPicker.vue:35 |
| B-13 | Profile-load notice; Save status / writing fields; GM pilots → table row | `Retry` | (§11.46) | src/App.vue:105; src/components/SaveStatus.vue:12; src/components/SheetField.vue:53; src/views/GmPilotsView.vue:177 |
| B-14 | Pilot sheet header | `GM review` |  | src/views/PilotManageView.vue:347 |
| B-15 | Pilot sheet header | `GM controls` |  | src/views/PilotManageView.vue:347 |
| B-16 | Pilot sheet header | `Edit pilot` |  | src/views/PilotManageView.vue:349 |
| B-17 | Register form | `Register pilot` | (§11.41) | src/views/PilotManageView.vue:285 |
| B-18 | Next-step bar | `Resubmit for review` | (§11.44) | src/views/PilotManageView.vue:394 |
| B-19 | Next-step bar | `Propose changes` | (§11.44) | src/views/PilotManageView.vue:395 |
| B-20 | Next-step bar | `Withdraw` | (§11.43) | src/views/PilotManageView.vue:397,402 |
| B-21 | Next-step bar | `Submit for review` | (§11.44) | src/views/PilotManageView.vue:398 |
| B-22 | Next-step bar | `Edit change` | (§11.44) | src/views/PilotManageView.vue:401 |
| B-23 | Notices | `Clear note` | (§11.43) | src/views/PilotManageView.vue:418,425 |
| B-24 | Profile tab → Danger zone; GM review (approved pilot) | `Mark pilot dead` | (§11.43) | src/views/PilotManageView.vue:475; src/components/GmReview.vue:152 |
| B-25 | Pilot sheet tabs; Mech page tabs | `profile` |  | src/views/PilotManageView.vue:234; src/views/MechView.vue:65 |
| B-26 | Pilot sheet tabs; Mech page tabs | `stats` |  | src/views/PilotManageView.vue:234; src/views/MechView.vue:65 |
| B-27 | Pilot sheet tabs | `equipment` |  | src/views/PilotManageView.vue:234 |
| B-28 | Pilot sheet tabs; Archives tabs (category names, lowercase in code) | `licences` |  | src/views/PilotManageView.vue:234; src/archive.ts:13; src/views/ArchivesView.vue:72 |
| B-29 | Pilot sheet tabs; Archives tabs (category names, lowercase in code) | `talents` |  | src/views/PilotManageView.vue:234; src/archive.ts:13; src/views/ArchivesView.vue:72 |
| B-30 | Pilot sheet tabs | `mechs` |  | src/views/PilotManageView.vue:234 |
| B-31 | Conflict notice | `Reload` | (§11.46) | src/components/ConflictNotice.vue:11 |
| B-32 | Image upload | `Replace image` | (§11.42) | src/components/ImageUpload.vue:35 |
| B-33 | Image upload | `Upload image` | (§11.41) | src/components/ImageUpload.vue:35 |
| B-34 | Image upload | `Remove image` | (§11.43) | src/components/ImageUpload.vue:36 |
| B-35 | Pilot sheet → Biomods heading | `Edit biomods` | (§11.42) | src/components/LoadoutBox.vue:77 |
| B-36 | Biomod picker; GM edit bar | `Done` | (§11.45) | src/components/LoadoutBox.vue:98; src/components/GmEditBar.vue:19 |
| B-37 | Biomod picker rows; Pilot sheet → Loadout slot card foot; Pilot sheet → Core bonus card foot; Mech page → Loadout; Content → Installed packs rows | `Remove` | (§11.43) | src/components/LoadoutBox.vue:122; src/components/PilotLoadout.vue:90; src/components/CoreBonusPanel.vue:83; src/components/MechLoadout.vue:307,333; src/views/ContentView.vue:287,290 |
| B-38 | Biomod picker rows | `Add` | (§11.41) | src/components/LoadoutBox.vue:124 |
| B-39 | Pilot sheet → Loadout slot | `Equip {armour\|weapon\|gear}` | (§11.42) | src/components/PilotLoadout.vue:85 |
| B-40 | Pilot sheet → Loadout slot card foot; Mech page → Loadout | `Swap` | (§11.42) | src/components/PilotLoadout.vue:89; src/components/MechLoadout.vue:306 |
| B-41 | Pilot sheet → Licences/Talents heading | `Add {licence\|talent} · {price}` | (§11.41) | src/components/RankPanel.vue:105 |
| B-42 | Pilot sheet → Licences/Talents card foot | `Lower rank` |  | src/components/RankPanel.vue:142 |
| B-43 | Pilot sheet → Licences/Talents card foot (rank I) | `Remove {licence\|talent}` | (§11.43) | src/components/RankPanel.vue:142 |
| B-44 | Pilot sheet → Licences/Talents card foot | `Raise rank · {price}` |  | src/components/RankPanel.vue:145 |
| B-45 | Pilot sheet → Core bonuses | `Choose core bonus` | (§11.42) | src/components/CoreBonusPanel.vue:90 |
| B-46 | Pilot sheet → Mechs tab heading | `New mech` | (§11.41) | src/components/MechHangar.vue:57 |
| B-47 | Pilot sheet → New mech form | `Create mech` | (§11.41) | src/components/MechHangar.vue:90 |
| B-48 | Pilot sheet → New mech form; Confirm dialog; Content → pack preview | `Cancel` | (§11.45) | src/components/MechHangar.vue:91; src/components/ConfirmDialog.vue:26; src/views/ContentView.vue:256 |
| B-49 | Mech page header (own mech) | `Choose frame` | (§11.42) | src/views/MechView.vue:275 |
| B-50 | Mech page header (editable) | `Frame details` | (§11.42) | src/views/MechView.vue:281 |
| B-51 | Mech page → Danger zone | `Scrap mech` | (§11.43) | src/views/MechView.vue:339 |
| B-52 | Mech page tabs | `loadout` |  | src/views/MechView.vue:65 |
| B-53 | Mech page → Loadout → weapon mod | `Swap mod` | (§11.42) | src/components/ModSection.vue:28 |
| B-54 | Mech page → Loadout → weapon mod | `Remove mod` | (§11.43) | src/components/ModSection.vue:29 |
| B-55 | Mech page → Loadout → weapon card | `Add mod` | (§11.41) | src/components/ModSection.vue:34 |
| B-56 | Mech page → Loadout | `Equip weapon` | (§11.42) | src/components/MechLoadout.vue:285,312 |
| B-57 | Mech page → Loadout | `Add system` | (§11.41) | src/components/MechLoadout.vue:323 |
| B-58 | Mech page → Loadout (stray weapons and mods notice) | `Clear unfitted` | (§11.43) | src/components/MechLoadout.vue:268 |
| B-59 | Archives search; Lore list | `Clear` | (§11.43) | src/views/ArchivesView.vue:171; src/views/LoreView.vue:79,105 |
| B-60 | Archives tabs (category names, lowercase in code) | `all` |  | src/archive.ts:13; src/views/ArchivesView.vue:72 |
| B-61 | Archives tabs (category names, lowercase in code) | `manufacturers` |  | src/archive.ts:13; src/views/ArchivesView.vue:72 |
| B-62 | Archives tabs (category names, lowercase in code) | `core bonuses` |  | src/archive.ts:13; src/views/ArchivesView.vue:72 |
| B-63 | Archives tabs (category names, lowercase in code) | `frames` |  | src/archive.ts:13; src/views/ArchivesView.vue:72 |
| B-64 | Archives tabs (category names, lowercase in code) | `mech weapons` |  | src/archive.ts:13; src/views/ArchivesView.vue:72 |
| B-65 | Archives tabs (category names, lowercase in code) | `mech systems` |  | src/archive.ts:13; src/views/ArchivesView.vue:72 |
| B-66 | Archives tabs (category names, lowercase in code) | `weapon mods` |  | src/archive.ts:13; src/views/ArchivesView.vue:72 |
| B-67 | Archives tabs (category names, lowercase in code) | `pilot gear` |  | src/archive.ts:13; src/views/ArchivesView.vue:72 |
| B-68 | Archives tabs (category names, lowercase in code) | `biomods` |  | src/archive.ts:13; src/views/ArchivesView.vue:72 |
| B-69 | Lore list header (GMs) | `New entry` | (§11.41) | src/views/LoreView.vue:69,101 |
| B-70 | Lore entry unavailable | `Back to Lore` |  | src/views/LoreView.vue:62,137 |
| B-71 | Lore entry | `Copy link` |  | src/components/LoreEntry.vue:51 |
| B-72 | Lore entry (GMs) | `Edit entry` |  | src/components/LoreEntry.vue:52 |
| B-73 | Lore editor status bar | `View entry` |  | src/views/LoreEditView.vue:149 |
| B-74 | Lore editor status bar; Content editor pane bar | `Publish` | (§11.44) | src/views/LoreEditView.vue:150; src/components/editor/EditorPane.vue:207,210 |
| B-75 | Lore editor status bar | `Unpublish` | (§11.44) | src/views/LoreEditView.vue:151 |
| B-76 | Lore editor Related entries | `Link entry` | (§11.41) | src/views/LoreEditView.vue:198 |
| B-77 | Lore editor Danger zone | `Delete entry` | (§11.43) | src/views/LoreEditView.vue:207 |
| B-78 | GM pilots → table row | `Open sheet` |  | src/views/GmPilotsView.vue:173 |
| B-79 | GM edit bar | `Open the change` |  | src/components/GmEditBar.vue:23 |
| B-80 | GM review | `Save level and manna` |  | src/components/GmReview.vue:135 |
| B-81 | GM review decision | `Approve pilot` | (§11.44) | src/components/GmReview.vue:148 |
| B-82 | GM review decision | `Refuse pilot` | (§11.44) | src/components/GmReview.vue:149 |
| B-83 | GM review Danger zone | `Delete pilot permanently` | (§11.43) | src/components/GmReview.vue:161 |
| B-84 | GM change summary | `Open the record and GM controls` |  | src/views/GmChangeView.vue:196 |
| B-85 | GM change decision | `Approve change` | (§11.44) | src/views/GmChangeView.vue:267 |
| B-86 | GM change decision | `Reject change` | (§11.44) | src/views/GmChangeView.vue:270 |
| B-87 | Content header | `Load core content` | (§11.41) | src/views/ContentView.vue:191 |
| B-88 | Content header | `Import a pack` | (§11.41) | src/views/ContentView.vue:192 |
| B-89 | Content header | `Open editor` |  | src/views/ContentView.vue:193 |
| B-90 | Content → load error notice | `Try again` | (§11.46) | src/views/ContentView.vue:203 |
| B-91 | Content → pack preview | `Update pack` | (§11.44) | src/views/ContentView.vue:258,261 |
| B-92 | Content → pack preview | `Import pack` | (§11.44) | src/views/ContentView.vue:258,261 |
| B-93 | Content → pack preview (while saving) | `Importing…` | (§11.2) | src/views/ContentView.vue:261 |
| B-94 | Content → Installed packs rows | `Update` |  | src/views/ContentView.vue:285 |
| B-95 | Content editor header | `Packs and imports` |  | src/views/ContentEditorView.vue:181 |
| B-96 | Content editor header | `Export as .lcp` |  | src/views/ContentEditorView.vue:182 |
| B-97 | Content editor list | `New {kind singular}` | (§11.41) | src/views/ContentEditorView.vue:209 |
| B-98 | Content editor list | `Show {n} more` |  | src/views/ContentEditorView.vue:224 |
| B-99 | Content editor pane bar | `Revert` | (§11.43) | src/components/editor/EditorPane.vue:204 |
| B-100 | Content editor pane bar | `Save changes` |  | src/components/editor/EditorPane.vue:213,216 |
| B-101 | Content editor pane bar | `Create draft` | (§11.41) | src/components/editor/EditorPane.vue:213,216 |
| B-102 | Content editor pane bar | `Create` | (§11.41) | src/components/editor/EditorPane.vue:213,216 |
| B-103 | Content editor notice | `Revert to original` | (§11.43) | src/components/editor/EditorPane.vue:228 |
| B-104 | Content editor Danger zone | `Delete item` | (§11.43) | src/components/editor/EditorPane.vue:270,273 |
| B-105 | Content editor pane tabs (narrow screens) | `Edit` |  | src/components/editor/EditorPane.vue:195 |
| B-106 | Content editor pane tabs (narrow screens) | `Preview` |  | src/components/editor/EditorPane.vue:195 |
| B-107 | Content editor → forms | `Add bonus` | (§11.41) | src/components/editor/BionicForm.vue:78; src/components/editor/BonusListField.vue:42 |
| B-108 | Content editor → Weapon form | `Split into profiles` |  | src/components/editor/WeaponForm.vue:74 |
| B-109 | Content editor → Talent form | `Make it three ranks` |  | src/components/editor/TalentForm.vue:62 |
| B-110 | Content editor → Talent form (add buttons) | `Add built-in equipment` | (§11.41) | src/components/editor/TalentForm.vue:83,86 |
| B-111 | Content editor → Talent form (add buttons) | `Add optional equipment` | (§11.41) | src/components/editor/TalentForm.vue:83,86 |
| B-112 | Content editor → Frame form | `Add mount` | (§11.41) | src/components/editor/FrameForm.vue:159 |
| B-113 | Pickers | `Chosen` | (§11.42) | src/components/ItemPicker.vue:56 |
| B-114 | Pickers | `Choose` | (§11.34, 42) | src/components/ItemPicker.vue:65 |
| B-115 | Confirm dialog (when no label is given) | `Confirm` |  | src/confirm.ts:13 |
| B-116 | Content editor → list fields | `Add {noun}` | (§11.41) | src/components/editor/RepeatList.vue:62; src/components/editor/DamageField.vue:47 |
| B-117 | Content editor → Tags list | `Add a tag…` | (§11.41) | src/components/editor/TagListField.vue:46 |

## 11. Inconsistencies
Groups of strings that say the same kind of thing differently. IDs are from sections 1 to 10.

### 11.1 "Not saved" and its relatives
Most failures read "Not saved: {error}", but the sentence after the colon is written two ways: some messages start in lower case because they were written to follow "Not saved: " (the database messages, picture upload, lore title), others start with a capital ("A pilot needs a name.", "The manufacturer ID should look like..."). Other failure prefixes differ too: "Not saved yet" (a waiting edit, not a failure), "Not saved: this changed somewhere else" (a title that is also a notice), "Not deleted:", "Not removed:", "Not exported:", "Not copied".

IDs: N-08, M-07, M-08, M-11, M-14, M-15, M-16, M-17, M-18, M-21, M-22, M-23, M-24, M-25, M-26, M-27, M-28, M-33, M-35, M-41, M-44, M-51, M-72, M-102, M-106, M-107, M-109

### 11.2 "Saving…" and other in-progress words
Same idea, different verbs: "Saving…", "Uploading…", "Importing…", "Loading core content…", "Checking {file}…".

IDs: M-05, M-09, M-12, M-13, M-52, M-73, M-74, B-93

### 11.3 "Saved" with and without a full stop
Every save status says "Saved" with no full stop except the GM controls box, which says "Saved.".

IDs: M-06, M-10, M-53, M-56

### 11.4 Loading lines
"Loading…" is used alone on most pages; others name the thing ("Loading pilot records…", "Loading pilot record…", "Loading mech record…", "Loading pilots…", "Loading change…", "Loading changes…", "Loading installed content…"). Note "Loading pilot record…" (singular) vs "Loading pilot records…" on the GM roster.

IDs: M-02, M-30, M-36, M-38, M-42, M-46, M-47, M-54, M-60, M-61, M-63, M-68, M-69, M-73, M-74, M-98

### 11.5 Empty-state phrasings
At least seven shapes are in use: "No X yet." (No licences yet. / No mechs yet. / No lore yet.), "No X." (No core bonuses. / No actions. / No traits.), "No X installed." (No biomods installed. / No systems installed.), "No X on file." (No mechs on file. / No pilots on file. / Nothing on file.), "Nothing X" (Nothing waiting on a GM. / Nothing matches that search. / Nothing in this category in the loaded content packs.), "None." / "None yet.", and search-miss lines that differ ("Nothing matches that search." vs "No pilots match that search." vs "No packs match that search." vs "No matches."). Also "No one has died yet." and "No gear equipped." / "No gear in this slot."

IDs: H-113, H-209, H-259, H-262, H-267, H-282, H-284, H-288, H-289, E-01, E-02, E-03, E-04, E-05, E-06, E-07, E-08, E-09, E-10, E-11, E-12, E-13, E-15, E-16, E-17, E-20, E-21, E-22, E-23, E-24, E-25, E-26, E-27, E-28, E-29, E-30, E-31, E-32, E-33, E-34, E-35, E-36, E-37, E-38, E-39, E-40, E-41, E-42, E-43, E-44, E-45, E-46, E-47

### 11.6 Search boxes
Search placeholders list their fields in different styles ("Callsign, name, player or mech", "Callsign, name or player", "Name, maker or rules text", "Title, summary or text", "Pack name or author"), the labels vary ("Search", "Search lore", "Search every category", "Search {kind}"), and "maker" in the archives is "manufacturer" elsewhere.

IDs: T-22, T-26, T-30, T-35, T-44, T-52

### 11.7 Reasons beside a disabled button
The reasons are written in different shapes: bare words ("GM only", "Over the limit"), "Needs ..." ("Needs licence II", "Needs IPS-N Drake II", "Needs an empty mount to brace it"), "Not enough ..." ("Not enough manna", "Not enough SP"), "Fits ... only", "Can't go on ...", and "Unique: already on this mech". "SP" appears abbreviated here while the dialog and facts say "system points". Frame blocking says "Needs licence II" without the licence name, while weapons and systems include it ("Needs IPS-N Drake II"). None end with a full stop except where a sentence is joined ("Fix the item IDs above first.", "Save your changes first.", "The pilot changed after this change was made.").

IDs: H-127, H-160, H-279, H-287, R-12, R-13, R-14, R-20, R-21, R-27, R-33, R-34, R-61, R-62, R-63, R-64, R-65, R-66, R-67, R-69, R-70, R-71, R-72, R-73, R-75

### 11.8 "Fix N problem(s)" wording
Three ways to tell someone what is wrong: a button reason ("Fix 1 problem first."), a notice title ("Fix 1 problem before saving") and the rule check ("1 rule to fix" / "1 rule to fix before you submit" / "1 rule problem"). "Fix {n} problem first." has a full stop, the notice title has none.

IDs: N-37, R-74

### 11.9 Rule-check wording
The rule check titles count "rules" while the lines describe "problems"; the GM approve confirms say "The rule check lists {n} problem(s)." Lines mix voices: second person ("you have {ranks}"), third person ("Its Superheavy weapon needs a second, empty mount."), and imperative ("remove or refit them", "choose a normal mount"). Several lines start in lower case or with "its" because they are prefixed with the mech name ("{mech}: its frame isn't in the loaded content packs.").

IDs: R-01, R-02, R-03, R-04, R-05, R-06, R-22, R-36

### 11.10 "Isn't in the loaded ..." wording
The same "item not in the data" problem is worded as "isn't in the loaded content packs", "isn't in the loaded catalogue", "isn't in the loaded licensed frames", "unavailable in the loaded content packs", "has no manufacturer in the loaded content packs" and "Item unavailable". "Catalogue" and "licensed frames" are internal terms.

IDs: R-17, R-18, R-23, R-25, R-29, R-32, R-35, R-49, R-53, R-55

### 11.11 Missing content in reminders
Three near-identical notes: "Content unavailable; its bonuses are not included.", "Core bonus unavailable; its bonuses are not included.", "Talent unavailable; its bonuses are not included." Compare "unavailable" in the sheet's rule checks.

IDs: H-56, H-57, H-58

### 11.12 Mark dead confirmations
The pilot-sheet and GM-review versions differ: one adds "and you can register a new pilot".

IDs: C-01, C-21

### 11.13 Remove confirmations
Several "Remove {name}?" confirms give no consequence, while delete and scrap confirms spell the consequence out.

IDs: C-05, C-07, C-13, C-14, C-15

### 11.14 Confirm button labels
Mixed: bare verb ("Remove", "Withdraw", "Publish", "Unpublish") and verb plus noun ("Mark dead", "Scrap mech", "Delete pilot", "Delete entry", "Delete item", "Remove pack", "Approve pilot", "Approve change", "Change frame", "Discard changes", "Revert to original"). The default when none is given is "Confirm".

IDs: C-03, C-04, C-06, C-08, C-10, C-12, C-16, C-18, C-20, C-22, C-24, C-26, C-28, C-30, C-32, C-34, C-36, C-38

### 11.15 Confirm questions
Lore "Unpublish" and "Delete" quote the title with straight quotes ("{title}"); the editor's confirms also quote; the pilot, mech and pack confirms do not quote names.

IDs: C-17

### 11.16 Danger zone sentences
Four patterns: "If your pilot dies in the story, mark them dead. This can't be undone." / "Scrapping {mech} removes it and its loadout from {your|the} hangar for good." / "Deleting {pilot} removes ... It can't be undone." / "Deleting an entry removes it for everyone and can't be undone. ...". "for good" and "can't be undone" vary.

IDs: H-13, H-47, H-116, H-132, H-190

### 11.17 Access denied
"Access denied. This page is for GMs." vs "Access denied. This page is for owners." Same shape; check that it is wanted.

IDs: N-15, N-17, N-18, N-21, N-30

### 11.18 Whole-number messages
"Level and manna must be whole numbers, 0 or more." (twice) vs the editor's "needs a whole number, 0 or more." vs rules.ts "must be a whole number from 0 to {max}" vs "must be a whole rank from 0 to III".

IDs: M-49, M-55

### 11.19 "Pilot changed after the change was made"
Said twice, a notice and a button reason, with different wording.

IDs: N-19, R-68

### 11.20 Counts
"{shown} of {total} pilots" (registry, GM pilots), "{n} shown" (biomod picker), "{shown} of {total}" (pickers), "{n} pilot(s)" / "{n} entry/entries" / "{n} pack(s), {n} items", "{n} action(s)" (with "(s)"), "{n} file(s) not used by this site". Pluralisation is handled in code in some places and with "(s)" in others.

IDs: H-25, H-86, H-119, H-229, H-277, H-281

### 11.21 Status badges
Badge words are sometimes lower-case raw statuses ("pending", "approved", "dead", "rejected") and sometimes phrases with a capital ("Sent back", "Waiting for review", "Change rejected", "Draft change", "Change submitted"). The same pilot can be "Pending" on a card list tab but "Waiting for review" on the sheet.

IDs: H-45, H-110, H-123, H-138, H-143, H-188

### 11.22 ID field hints
The same two hints are repeated across the item forms; the tag form reuses them, the personal stat and manufacturer forms word it differently ("Sheets and bonuses use this key, so it never changes. Rename the stat freely." / "Items name their manufacturer by this code, so it never changes.").

IDs: H-196, H-197, H-198, H-199

### 11.23 "Flavour" hints
"Flavour text.", "Flavour text, plain.", "Optional flavour text, plain.", "Flavour. Gear with no rules text shows this as its rules.", "Flavour text, shown in the frame's information.", "Flavour text, shown above the passive and the power." Lore and Description fields are labelled differently across forms for the same idea.

IDs: H-202, H-204, H-210, H-223, H-253, H-268

### 11.24 "Leave empty / Leave all off" hints
"Leave empty to use the weapon's tags." / "...rules text." / "...actions." and "Leave all off to fit any type." / "...any size."

IDs: H-219, H-220, H-221, H-224, H-225

### 11.25 "Built in" hints
Talent: "Equipment the pilot's mech gets for free with this rank, with no mount needed." Frame core system: "Weapons or systems the mech gets for free with this frame, with no mount needed."

IDs: H-230, H-271

### 11.26 "Where these numbers come from" and its lines
The heading is the same for pilot stats, mech stats and item cards, but the lines under it are formatted differently: "{source}: +{n}", "{source}: sets base to {n}", "pilot base: {n}", "attack accuracy: +{n}", "{source}: +{n} {damage type} damage (added before the flat conversion)", with lower-case labels for some and sentences for others.

IDs: H-18, H-19, H-60, H-69, H-70, H-71, H-72, H-73, H-74, H-75, H-76, H-77, H-78, H-274

### 11.27 "Source: {pack}" lines
Pack credit appears on item cards, mod sections and the information view with the same wording ("Source: {pack}").

IDs: H-67, H-273, H-275

### 11.28 Explaining how the system works inside notices
The editor's notices explain how pack updates and edits interact (internal behaviour) rather than what the owner should do.

IDs: N-32, N-34

### 11.29 "Choose a frame" prompts
Three phrasings of the same prompt: "Choose a frame (in the strip above) to fit its mounts.", "Choose a frame (in the strip above) to see its system points.", "Choose a frame to work out this mech's stats."

IDs: E-14, E-18, E-19

### 11.30 Queue helper lines
"New pilots, oldest first. Open one to review their sheet." vs "Changes to approved pilots, oldest first. Open one to review it."

IDs: H-117, H-133

### 11.31 Privacy and role tags
"Private", "GM only", "Owner only", "Owners only", "Only GMs can see drafts." Owner is singular in one place and plural in the other.

IDs: H-14, H-127, H-131, H-179

### 11.32 "Player: {name}"
One shared line; the missing value is "–" in some places and "Unknown player" in the GM roster.

IDs: H-10, H-87, H-140

### 11.33 Portrait and image alt text
"Portrait of {callsign or name}" (pilot) vs "Image of {mech}" (mech).

IDs: T-03, T-12, T-17, T-24

### 11.34 "Choose…" in selects
"Choose…" vs "None", "None: its own licence", "No licence: anyone can use it", "No logo", "Not stated" for the empty option.

IDs: H-215, B-114

### 11.35 Related entries
Wording of the empty and removal states differs ("None yet. They show under the entry.").

IDs: H-107

### 11.36 Link pickers
Two titles for the same thing: "Link to an entry" (the writing editor's link button) and "Link an entry" (the editor's related list), with "No other entries to link to." vs "No other entries to link.".

IDs: T-34

### 11.37 "Needs fixing"
Shown on folded entries and panels with a problem.

IDs: H-279

### 11.38 Short names for stats
The same stat is named differently across the site: "heat cap" and "repair cap" on the mech page and frame form vs "Heat capacity" and "Repair capacity" in the bonus type list; "armour" and "e-defence" are lower case in stat tiles and capitalised in the editor.

IDs: H-20, H-61, H-242, H-246

### 11.39 Content editor summaries
The router summary ("Make and change game content.") and the page's own longer summary say different things; only the longer one is shown.

IDs: S-27

### 11.40 Rich-text placeholder
One shared placeholder for all writing fields.

IDs: T-81

### 11.41 Button verbs: adding
"Add", "Add mod", "Add system", "Add bonus", "New mech", "New entry", "New {kind}", "Create mech", "Create draft", "Create", "Register pilot", "Link entry", "Upload image", "Import a pack", "Load core content".

IDs: B-17, B-33, B-38, B-41, B-46, B-47, B-55, B-57, B-69, B-76, B-87, B-88, B-97, B-101, B-102, B-107, B-110, B-111, B-112, B-116, B-117

### 11.42 Button verbs: choosing and swapping
"Choose", "Choose core bonus", "Choose frame", "Chosen", "Equip weapon", "Equip {gear}", "Swap", "Swap mod", "Replace image", "Edit biomods".

IDs: B-32, B-35, B-39, B-40, B-45, B-49, B-50, B-53, B-56, B-113, B-114

### 11.43 Button verbs: removing
"Remove", "Remove mod", "Remove image", "Clear note", "Clear", "Clear unfitted", "Withdraw", "Delete entry", "Delete item", "Delete pilot permanently", "Scrap mech", "Mark pilot dead", "Revert", "Revert to original".

IDs: B-20, B-23, B-24, B-34, B-37, B-43, B-51, B-54, B-58, B-59, B-77, B-83, B-99, B-103, B-104

### 11.44 Button verbs: submitting and deciding
"Submit for review", "Resubmit for review", "Propose changes", "Edit change", "Approve pilot", "Refuse pilot", "Approve change", "Reject change", "Publish", "Unpublish", "Update pack" / "Import pack". Note: GM review uses "Refuse pilot" for a new pilot but "Reject change" for a change; the player sees "Sent back" for a refused pilot and "rejected" for a change.

IDs: B-18, B-19, B-21, B-22, B-74, B-75, B-81, B-82, B-85, B-86, B-91, B-92

### 11.45 Button verbs: closing
"Cancel", "Close", "Done", "Menu".

IDs: B-11, B-12, B-36, B-48

### 11.46 Button verbs: retrying
"Retry", "Reload", "Try again".

IDs: B-13, B-31, B-90

### 11.47 Spelling and wording choices
"Licence" (UK) is used consistently in visible text; "license" appears only in data keys. "Biomod" is used consistently in visible text (the code word "bionic" is not shown). "Armour" (UK) is used in stat labels, but "Armor" is shown in the system-kind options in the content editor and as a gear kind internally, and the deployable stat line prints "armor". Americanisms: none found other than "Armor".

IDs: H-239, H-309

### Flag index

- `long` (89): S-10, S-12, S-27, H-01, H-02, H-03, H-04, H-06, H-07, H-08, H-13, H-36, H-43, H-44, H-49, H-76, H-113, H-116, H-117, H-118, H-130, H-132, H-133, H-172, H-176, H-190, H-196, H-198, H-202, H-205, H-208, H-209, H-211, H-213, H-216, H-217, H-218, H-226, H-232, H-234, H-238, H-248, H-252, H-256, H-266, H-270, H-284, H-293, H-309, N-02, N-09, N-11, N-14, N-15, N-16, N-17, N-18, N-19, N-20, N-21, N-25, N-26, N-29, N-30, N-32, N-34, N-36, N-40, E-38, R-30, R-54, R-75, C-02, M-15, M-18, M-22, M-23, M-58, M-59, M-65, M-78, M-79, M-80, M-84, M-85, M-86, M-95, M-96, M-100

- `mechanics` (48): S-12, S-27, H-27, H-36, H-54, H-70, H-71, H-196, H-197, H-198, H-199, H-212, H-216, H-226, H-233, H-234, H-256, N-02, N-11, N-16, N-19, N-20, N-26, N-29, N-32, N-34, N-36, E-04, E-26, E-28, E-45, R-17, R-18, R-23, R-25, R-29, R-30, R-32, R-35, R-37, R-49, R-53, R-55, V-12, V-38, M-15, M-86, M-87

- `tone` (30): S-12, H-01, H-07, H-47, H-49, H-164, H-171, H-172, H-196, H-198, H-211, H-226, H-234, N-02, N-09, N-19, N-26, N-32, N-34, N-36, N-38, N-40, R-38, R-39, R-52, C-02, C-09, C-27, M-57, M-67

- `case` (40): H-12, H-19, H-20, H-22, H-61, H-64, H-66, H-82, H-84, H-97, H-98, H-123, H-138, H-143, H-155, H-156, H-159, H-170, H-194, H-195, H-239, H-246, H-294, H-299, H-304, H-309, R-35, M-15, M-16, M-17, M-18, M-21, M-22, M-23, M-24, M-44, M-108, T-04, T-33, T-45

## 12. Counts
| Section | Entries |
|---|---|
| 1. Page titles and summaries (S) | 27 |
| 2. Section hints and helper lines (H) | 313 |
| 3. Notices (N) | 42 |
| 4. Empty states (E) | 47 |
| 5. Blocked reasons and rule checks (R) | 75 |
| 6. Editor validation messages (V) | 58 |
| 7. Confirm dialogs (C) | 38 |
| 8. Status and error messages (M) | 110 |
| 9. Tooltips, aria-labels and placeholders (T) | 81 |
| 10. Button labels (B) | 117 |
| Total | 908 |
