# Site text changes (2026-11-19)
Every audit entry that was changed or deleted, in audit order. Entries not listed were left as they were. Where one entry covers variants, the New column shows them separated by " / ". "(pluralised in code)" means the wording is built by `plural()` in `src/text.ts`.

391 changed, 15 deleted, 502 left as is (of 908).

| ID | Old | New |
|---|---|---|
| S-10 | Pilots who died. Their records are kept. | Pilots who died. |
| S-12 | Every manufacturer, licence, frame, weapon, system, weapon mod, piece of gear, biomod, talent and core bonus in the loaded content packs. | Every piece of game content, by manufacturer. |
| S-15 | Write it here, then publish when it's ready. | Publish when it's ready. |
| S-17 | Review new pilots, and level up or pay any pilot. | Review new pilots. Set levels and manna. |
| S-20 | Changes players want to make to their approved pilots. | Changes to approved pilots. |
| S-24 | The packs behind your pilots, mechs and equipment. | Game content packs. |
| S-27 | Make and change the game content pilots are built from. Imported items can be edited too; pack updates keep your edits. | Make and change game content. |
| H-01 | No pilot on file. A name is all that's needed to start; everything else is filled in on the sheet. | Start with a name. Fill in the rest on the sheet. |
| H-02 | This pilot is dead. The record is kept, read-only. | This pilot is dead. The record is read-only. |
| H-03 | Sent back by a GM. Change what they asked (note below), then resubmit. | A GM sent this back. Fix what they asked, then resubmit. |
| H-05 | Your last change was rejected (reason below). | Your last change was rejected. |
| H-06 | Approved. Changes go to a GM for review. | Changes need GM approval. |
| H-07 | Drafting a change. Your approved pilot stays as it is until a GM approves. | Your approved pilot won't change until a GM approves this. |
| H-08 | Change submitted, waiting on a GM. The sheet shows what you sent. | Waiting on a GM. |
| H-10 | Player: {player} | Player: {player} (Unknown player when missing) |
| H-12 | Sent back / Waiting for review / Change rejected / Draft change / Change submitted / {status} (pending, approved, dead) | Sent back / Pending / Rejected / Draft / Submitted / {Status} (Pending, Approved, Dead) |
| H-13 | If your pilot dies in the story, mark them dead. This can't be undone. | Mark this pilot dead. This can't be undone. |
| H-19 | pilot base: {n} / {source}: +{n} / {source}: sets base to {n} | Base: {n} / {Source}: +{n} / {Source}: sets to {n} |
| H-20 | hp / armour / speed / e-defence | HP / Armour / Speed / E-defence |
| H-21 | unknown item ({id}) | Unknown item ({id}) |
| H-22 | its content pack may have been removed. | deleted |
| H-25 | {count} shown | {shown} of {total} |
| H-27 | Also on file: {count} item(s) from content packs that aren't loaded. | {n} item(s) not in any loaded pack. (pluralised in code) |
| H-32 | Nothing new at this rank. | No unlocks. |
| H-36 | One free pick per 3 licence ranks. Each non-GMS bonus needs another 3 licence ranks from its manufacturer. | One free pick per 3 licence ranks. |
| H-39 | Mech name (required) / Manufacturer ID (XXXX-XXXX-XXXX) | Mech name / Manufacturer ID (placeholder XXXX-XXXX-XXXX) |
| H-43 | Edits to this mech go into your draft change. Submit it from My pilot. | Edits here go into your draft change. Submit it from My pilot. |
| H-44 | Change submitted, waiting on a GM, so this mech is read-only. To edit it, choose Edit change on My pilot. | Waiting on a GM. This mech is read-only. |
| H-45 | Change submitted / Draft change | Submitted / Draft |
| H-47 | Scrapping {mech} removes it and its loadout from {your\\|the} hangar for good. | Scrapping {mech} removes it from the hangar. This can't be undone. |
| H-49 | Only the modifiers listed under the stats' sources are counted. These need you or the GM to apply them. | These aren't counted in the stats. |
| H-50 | Not counted in the stats above. | Not counted in the stats. |
| H-51 | Frame / Frame trait / Core system / Core power / Core bonus / Talent / Equipment / Unavailable | Frame / Frame trait / Core system / Core power / Core bonus / Talent / Equipment / Missing |
| H-56 | Content unavailable; its bonuses are not included. | Missing item. Its bonuses aren't counted. |
| H-57 | Core bonus unavailable; its bonuses are not included. | Missing core bonus. Its bonuses aren't counted. |
| H-58 | Talent unavailable; its bonuses are not included. | Missing talent. Its bonuses aren't counted. |
| H-60 | {frame}: {n} / {source}: +{n} / {source}: sets base to {n} / {source}: +{n} (highest override) / armour maximum: {n} | Base: {n} / {Source}: +{n} / {Source}: sets to {n} / {Source}: +{n} (highest wins) / Armour maximum: {n} |
| H-61 | structure / stress / hp / heat cap / armour / evasion / speed / e-defence / tech attack / repair cap / system points / size | Structure / Stress / HP / Heat cap / Armour / Evasion / Speed / E-defence / Tech attack / Repair cap / System points / Size |
| H-62 | 1 → 1d3 → 1d6 → 1d6+4 | 1 → 2 → 4 → 8 |
| H-64 | profile {n} | Profile {n} |
| H-66 | optics + computer / optics + reactor shielding / computer + reactor shielding | Optics + computer / Optics + reactor shielding / Computer + reactor shielding |
| H-70 | Hunter II: Thrown 5 (or existing higher Thrown); thrown weapons return at end of turn. | Hunter II: Thrown 5. Thrown weapons return at end of turn. |
| H-71 | {source}: +{expression} {damage type} damage (added before the flat conversion) | {Source}: +{expression} {damage type} damage |
| H-73 | engineering: +{n} limited uses  /  {source}: +{n} limited uses | Engineering: +{n} limited uses / {Source}: +{n} limited uses |
| H-74 | attack roll bonus: +{n} | Attack roll: +{n} |
| H-75 | attack accuracy: +{n} (Auto-Stabilizing Hardpoints) (Tweaked Optics) | Accuracy: +{n} (Auto-Stabilizing Hardpoints) (Tweaked Optics) |
| H-76 | Stripped reactor shielding: spend 2 Heat when attacking to use the alternate area pattern (conditional). | Stripped reactor shielding: Spend 2 Heat to use the alternate area pattern. |
| H-77 | Overpower Caliber: +4 bonus damage on hit, once per round (not included in base damage). | Overpower Caliber: +4 damage on hit, once per round. Not in the damage above. |
| H-79 | {weapon} · {profile name or "profile {n}"} | {weapon} · {profile name or "Profile {n}"} |
| H-80 | All used.  /  {n} left  /  {n} over | All used / {n} left / {n} over |
| H-82 | Choose target  /  mount {n} · {weapon or mount} | Choose… / Mount {n} · {weapon or mount} |
| H-84 | unknown item ({id}) | Unknown item ({id}) |
| H-97 | pilot armour / pilot weapons / pilot gear | Pilot armour / Pilot weapons / Pilot gear |
| H-98 | other | Other |
| H-101 | Search lore | Search |
| H-112 | Shown in the list and under the title. | deleted |
| H-113 | None yet. They show under the entry. | No related entries yet. |
| H-116 | Deleting an entry removes it for everyone and can't be undone. Links to it from other entries will stop working. | Deleting this entry breaks links to it. This can't be undone. |
| H-117 | New pilots, oldest first. Open one to review their sheet. | New pilots, oldest first. |
| H-118 | Every pilot, including pending and dead. Level and manna save when you leave the field. | Level and manna save when you leave the field. |
| H-123 | Sent back / {status} (pending, approved, dead) | Sent back / {Status} |
| H-124 | Changes save straight to this pilot, without approval. | Saves go straight to this pilot. |
| H-130 | Sent with either decision. Needed to refuse. | Required when sending back. |
| H-132 | Deleting {pilot} removes the pilot, their sheet, mechs and every change. It can't be undone. | Deleting {pilot} removes their sheet, mechs and changes. This can't be undone. |
| H-133 | Changes to approved pilots, oldest first. Open one to review it. | Changes to approved pilots, oldest first. |
| H-134 | The latest reviewed changes. | deleted |
| H-138 | approved / rejected | Approved / Rejected |
| H-140 | Player: {player} | Player: {player} (Unknown player when missing) |
| H-142 | Draft: not submitted yet | Not submitted |
| H-143 | {status} (approved, rejected) | {Status} (Approved, Rejected) |
| H-145 | {received} received · {spent} spent on the proposed sheet | {received} received · {spent} spent |
| H-149 | {field}: {before} → {after}  (field is name, callsign, age, gender, sexuality, height, weight, eye colour, hair colour, manufacturer ID, frame) | {Field}: {before} → {after} (field names capitalised: Pilot name, Callsign, Eye colour, Manufacturer ID, Frame...) |
| H-155 | {bonus} target: {before} → {after}  /  mount {n}  /  mount {n}, {weapon}  /  empty weapon slot | {Bonus} target: {before} → {after} / Mount {n} / Mount {n}, {weapon} / Unassigned / empty weapon slot |
| H-156 | {mount n, weapon n} configuration: {options} → {options}  (options: profile {n}, optics, reactor shielding, computer) | {Mount n, weapon n} configuration: {options} → {options} (options: Profile {n}, Optics, Reactor shielding, Computer, Defaults) |
| H-157 | Mod on {weapon}: {mod} / Mod on {weapon}: {old} → {new} | Mod on {weapon}: {mod} / Mod on {weapon}: {old} → {new} (capitalised) |
| H-164 | Older items missing from this update stay available, so existing pilots keep their equipment. | deleted |
| H-167 | +{n} new / ~{n} to update / {n} older items kept | +{n} new / ~{n} to update |
| H-168 | {n} file not used by this site  /  {n} files not used by this site | {n} file(s) not used |
| H-169 | Only supported content files at the top level are imported. | deleted |
| H-170 | belongs to {pack}  /  belongs to another pack  /  would change the item type | Belongs to {pack} / Belongs to another pack / Would change the item type |
| H-171 | Importing the pack and all its items… | deleted |
| H-172 | Updated rules apply wherever these items are used. Older items stay available. | deleted |
| H-173 | Import this pack to make its content available to character sheets. | deleted |
| H-176 | Everything available to character sheets. Biomods are campaign content, managed apart from LCPs. | deleted |
| H-177 | frames / mech weapons / mech systems / weapon mods / pilot gear / talents / core bonuses / tags / manufacturers / biomods | Frames / Mech weapons / Mech systems / Weapon mods / Pilot gear / Talents / Core bonuses / Tags / Manufacturers / Biomods |
| H-179 | Owners only | Owner only |
| H-183 | {maker} · {slot} · {n} mod point(s) · {price} manna · retired | {maker} · {slot} · {n} mod point(s) · {price} manna · Retired |
| H-190 | Deleting removes this item for everyone and can't be undone. Official items can't be deleted. | Deleting removes this item. This can't be undone. |
| H-192 | The pack's own version, before the campaign's edits. | The pack's version. |
| H-194 | what it means / meaning | Meaning / Meaning |
| H-195 | tag / personal stat | Tag / Personal stat |
| H-196 | Made when the item was created. It never changes, so pilots keep it if you rename it. | Fixed once created. |
| H-197 | Made from the name until you save it the first time. | Made from the name. |
| H-198 | Made when the item was created. It never changes, so pilots keep it if you rename it. | Fixed once created. |
| H-199 | Made from the name until you save it the first time. | Made from the name. |
| H-200 | Write {VAL} where the item's number goes, as in "Limited {VAL}". | Use {VAL} for the number, as in "Limited {VAL}". |
| H-201 | Hidden: a note for the site, not shown to players | Hidden from players |
| H-202 | Flavour. Gear with no rules text shows this as its rules. | Shown as the rules when there are none. |
| H-203 | Optional: what it does while a weapon sits on a mount it changes. | What it does on the mount it changes. |
| H-205 | Where on the body it goes. Pick a suggestion or type your own. | Pick one or type your own. |
| H-208 | Retired: no longer offered. Pilots who have it keep it. | Retired (pilots who have it keep it) |
| H-209 | No bonuses. Use a negative number for a drawback. | No bonuses yet. |
| H-210 | Flavour text, plain. | Flavour text. |
| H-211 | Sheets and bonuses use this key, so it never changes. Rename the stat freely. | Fixed once created. |
| H-212 | Made from the name until you save it the first time. | Made from the name. |
| H-213 | A new personal stat appears on every pilot's stats tab, starting at 2 like the others. | deleted |
| H-214 | No licence: anyone can use it | None |
| H-216 | Type a number or dice such as 1d6+2. This homebrew has no dice, so the site turns dice into one flat number, rounded up, and that is all players see. | A number or dice, like 1d6+2. |
| H-217 | One set of numbers. If the weapon can be used in different modes, such as spun up or not, give it profiles. | One set of numbers. Split into profiles for modes. |
| H-218 | The pilot picks one when equipping the weapon. Each has its own range and damage. Leave a profile's tags, rules or actions empty to use the weapon's own, below. | The pilot picks one profile. |
| H-219 | Leave empty to use the weapon's tags. | Empty uses the weapon's tags. |
| H-220 | Leave empty to use the weapon's rules text. | Empty uses the weapon's rules text. |
| H-221 | Leave empty to use the weapon's actions. | Empty uses the weapon's actions. |
| H-223 | Optional flavour text, plain. | Flavour text. |
| H-226 | Added damage isn't counted in the weapon's numbers; it's conditional, so say when in the effect. | Not counted in the weapon's numbers. Say when it applies in the effect. |
| H-227 | One line, shown in lists: what the talent is for. | One line shown in lists. |
| H-229 | {n} action(s) · Grants equipment | {n} action(s) · Grants equipment (pluralised in code) |
| H-230 | Equipment the pilot's mech gets for free with this rank, with no mount needed. | Built in, needs no mount. |
| H-231 | Special equipment the pilot may choose to add once they have this rank. | Optional equipment this rank unlocks. |
| H-232 | Replaces the lower ranks' built-in equipment: only the highest rank the pilot has applies | Only the highest rank's built-in equipment applies |
| H-233 | Items name their manufacturer by this code, so it never changes. | Fixed once created. |
| H-234 | A short code of letters and numbers, such as CHI. Items name their manufacturer by it, so it can't change once you create it. | A short code, like CHI. Fixed once created. |
| H-235 | Homebrew manufacturers can use one of the bundled logos, or none. | deleted |
| H-236 | No logo | None |
| H-237 | The colour the site draws: the logo and a thin line on cards. | Used for the logo and card border. |
| H-238 | Optional. Kept with the manufacturer; the site doesn't draw it yet. | Optional. |
| H-239 | System / AI / Shield / Deployable / Drone / Tech / Armor / Flight System / Integrated | System / AI / Shield / Deployable / Drone / Tech / Armour / Flight System / Integrated (stored value stays "Armor") |
| H-246 | Pilot HP / Pilot armour / Pilot speed / Pilot e-defence / Structure / Stress / HP / Heat capacity / Armour / Armour maximum / Evasion / Speed / E-defence / Tech attack / Repair capacity / System points / Size / AI capacity / Limited uses / {personal stat names} | Pilot HP / Pilot armour / Pilot speed / Pilot E-defence / Structure / Stress / HP / Heat cap / Armour / Armour maximum / Evasion / Speed / E-defence / Tech attack / Repair cap / System points / Size / AI capacity / Limited uses / {personal stat names} |
| H-248 | An alternate frame, such as an alternate Genghis, shares its original's licence: pilots choose between them. | Shares the original frame's licence. |
| H-249 | None: its own licence | None |
| H-250 | The ID of the original frame. | ID of the original frame. |
| H-251 | A frame is its own licence, so this is its own ID. | Its own ID. |
| H-252 | The rank pilots need in this frame's licence to use it: II for most. None for a frame anyone can use, like GMS's. | Rank needed to use this frame. None for GMS frames. |
| H-253 | Flavour text, shown in the frame's information. | Flavour text. |
| H-255 | What the frame gives before pilot skills and gear. | Before HASE and gear. |
| H-256 | Sensors and save target are game data the site's mech maths leaves out, so nothing here changes them. | deleted |
| H-258 | Players see the mounts in this order. | Shown in this order. |
| H-261 | Each trait is a name and its rules, with optional actions, bonuses and deployables. | deleted |
| H-262 | No traits. | No traits yet. |
| H-263 | A reminder of how often it can be used. | deleted |
| H-264 | No limit (always on) | None |
| H-265 | {n} trait / {n} traits: {names}  /  No traits  /  {n} item / {n} items  /  Nothing unlocked yet  /  {name}: 1 passive, 1 power  /  Unnamed  /  No mounts | {n} trait(s): {names} / No traits yet / {n} item(s) / No unlocks / {name}: 1 passive, 1 power / Unnamed / No mounts yet |
| H-266 | What each rank of this licence unlocks. Set on each item's own licence field. | Set on each item's licence field. |
| H-267 | Nothing. | No unlocks. |
| H-268 | Flavour text, shown above the passive and the power. | Flavour text. |
| H-270 | Only apply while the power is on, so the mech's numbers leave them out. Say when in the rules. | Not counted in the mech's numbers. Say when they apply in the rules. |
| H-271 | Weapons or systems the mech gets for free with this frame, with no mount needed. | Built in, needs no mount. |
| H-272 | Not stated | None |
| H-276 | Costs {n} system points. | Costs {n} system point / points. |
| H-281 | {n} action(s) | {n} action(s) (pluralised in code) |
| H-282 | No actions. | No actions yet. |
| H-284 | No deployables. Add one if this item places a drone, mine or turret. | No deployables yet. |
| H-288 | None. | No ranges yet. / No damage yet. |
| H-289 | No bonuses. | No bonuses yet. |
| H-292 | Add a tag… | Add tag… |
| H-293 | The same data as the form, as JSON. For things the form has no field for. | JSON, for fields the form lacks. |
| H-294 | {maker} frame / {maker} licence / {maker} core bonus / pilot armour / pilot weapon / pilot gear / weapon mod / {mount} {type} weapon / {system type} / biomod / manufacturer / talent / tag / personal stat | {Maker} frame / {Maker} licence / {Maker} core bonus / Pilot armour / Pilot weapon / Pilot gear / Weapon mod / {Mount} {type} weapon / {System type} / Biomod / Manufacturer / Talent / Tag / Personal stat |
| H-299 | retired: no longer offered | Retired |
| H-302 | {n} frames | {n} frame / frames |
| H-304 | rules / tags / ranks / frames / effect / mounted effect / description / passive / passive: {name} / core system / rank {I\\|II\\|III}: {name} / rank {I\\|II\\|III} | Rules / Tags / Ranks / Frames / Effect / Mounted effect / Description / Passive / Passive: {name} / Core system / Rank {I\|II\|III}: {name} / Rank {I\|II\|III} |
| H-306 | Nothing new at this rank. | No unlocks. |
| H-309 | size {n} · hp {n} · armor {n} · evasion {n} · edef {n} · speed {n} · heatcap {n} | Size {n} · HP {n} · Armour {n} · Evasion {n} · E-defence {n} · Speed {n} · Heat cap {n} |
| N-01 | Couldn't load your profile | Profile didn't load |
| N-02 | Can't reach the database. If the site has had a quiet week, the free Supabase project may be paused: an owner can restore it from the Supabase dashboard. | Can't reach the server. An owner may need to restore the paused project. |
| N-08 | Not saved: this changed somewhere else | Not saved |
| N-09 | Another tab or a GM saved a newer version. Reload to see it; your last edit here wasn't saved. | Someone else changed this. Reload to see their version. |
| N-11 | No free slot for {names}. They're dropped at the next loadout change. | No free slot for {names}. |
| N-14 | Access denied. This page is for GMs. | Only GMs can see this page. |
| N-15 | Access denied. This page is for GMs. | Only GMs can see this page. |
| N-16 | {name} has a change waiting for review. Editing directly will stop it from being approved: review it first. | {name} has a change waiting. Editing blocks its approval. |
| N-17 | Access denied. This page is for GMs. | Only GMs can see this page. |
| N-18 | Access denied. This page is for GMs. | Only GMs can see this page. |
| N-19 | This pilot changed after the change was made. Approval is blocked, so the proposal can't overwrite newer edits. | This pilot changed after the change was made. Approval is blocked. |
| N-20 | This change has been reviewed. Its original comparison and cost weren't stored, so the figures above use the proposal and the current manna received. | Already reviewed. The figures use the current manna received. |
| N-21 | Access denied. This page is for owners. | Only owners can see this page. |
| N-22 | {pack} is ready | {pack} imported |
| N-23 | Version {version} imported: {added} new, {updated} updated, {retained} older items kept. | Version {version}: {added} new, {updated} updated. |
| N-24 | Its content is now in the pilot and mech pickers. | deleted |
| N-25 | This is a COMP/CON v3 pack. Some advanced effects are not displayed by this site yet. | This is a COMP/CON v3 pack. Some advanced effects aren't shown. |
| N-26 | This pack declares dependencies. Check its required packs and versions before importing; dependency requirements are not verified automatically. | This pack needs other packs. Check they are imported. |
| N-27 | {n} of this pack's items has campaign edits (made in the content editor). The update keeps them.  /  {n} of this pack's items have campaign edits (made in the content editor). The update keeps them. | {n} item has / items have campaign edits. The update keeps them. |
| N-28 | Item IDs need attention | Item ID conflict |
| N-29 | This import is blocked. Give these items unique IDs in the LCP editor, or choose an update for their original pack. | Give these items unique IDs, or update their original pack. |
| N-30 | Access denied. This page is for owners. | Only owners can see this page. |
| N-32 | The campaign's version replaces the pack's everywhere, and pack updates keep it. The pack's own is under Original in the preview. | The pack's version is under Original in the preview. |
| N-34 | Saving makes the campaign's own version of it. Pack updates keep your version. | Saving makes a campaign version. |
| N-36 | Saving changes their sheets. Players see the new numbers straight away; nothing needs approving. | Saving changes their sheets. |
| N-38 | Worth a look | {n} warning(s) (pluralised in code) |
| N-40 | There's no form for {kind} yet. Edit the data below; the preview shows the result. | No form for {kind} yet. Edit the raw data. |
| N-41 | The preview can't be drawn from this data: {error} | Preview failed: {error} |
| N-42 | The original can't be drawn: {error} | Original failed: {error} |
| E-01 | Nothing on file. | No text. |
| E-02 | No biomods installed. | No biomods yet. |
| E-04 | Nothing to choose from yet: the content packs may not be imported. | No options. |
| E-05 | No gear equipped. | No gear. |
| E-06 | No {armour\\|weapon\\|gear} in this slot. | No {armour\|weapon\|gear} yet. |
| E-13 | No mechs on file. | No mechs. |
| E-14 | Choose a frame to work out this mech's stats. | Choose a frame first. |
| E-16 | Empty. Takes one Main or Auxiliary weapon.  /  Empty. Takes one weapon of any size.  /  Empty. Takes one Main or two Auxiliary weapons.  /  Empty. Takes one Main and one Auxiliary weapon.  /  Empty. Takes two Auxiliary weapons. | Takes one Main or Auxiliary weapon. / Takes one weapon of any size. / Takes one Main or two Auxiliary weapons. / Takes one Main and one Auxiliary weapon. / Takes two Auxiliary weapons. |
| E-17 | Empty. Takes a weapon of any size.  /  Empty. Takes one {Main or Auxiliary} weapon. | Takes a weapon of any size. / Takes one {Main or Auxiliary} weapon. |
| E-18 | Choose a frame (in the strip above) to fit its mounts. | Choose a frame first. |
| E-19 | Choose a frame (in the strip above) to see its system points. | Choose a frame first. |
| E-20 | No systems installed. | No systems yet. |
| E-22 | Nothing waiting on a GM. | No pending pilots. |
| E-23 | No one has died yet. | No dead pilots. |
| E-24 | No pilots match that search. | Nothing matches that search. |
| E-25 | Nothing waiting on a GM. | No items to review. |
| E-26 | No content yet: the content packs may still be loading, or none are imported. | No content yet. |
| E-28 | Nothing in this category in the loaded content packs. | No entries. |
| E-34 | No pilots match that search. | Nothing matches that search. |
| E-35 | No pilots on file. | No pilots yet. |
| E-36 | No changes reviewed yet. | No reviewed changes yet. |
| E-37 | No changes to the approved record. | No changes. |
| E-38 | No packs installed yet. Import an LCP to fill the pilot and mech pickers. | No packs yet. |
| E-39 | No packs match that search. | Nothing matches that search. |
| E-40 | Choose an item to edit, or make a new one. | Choose an item. |
| E-41 | No matches. | Nothing matches that search. |
| E-42 | None yet. | No items yet. |
| E-43 | No further information. | No information. |
| E-45 | Nothing to choose from yet: the content packs may not be imported. | No options. |
| E-46 | No other entries to link to. | No other entries to link. |
| E-47 | There are no weapons or systems to choose from. | No weapons or systems. |
| R-01 | "1 rule problem" / "{count} rule problems" | {n} problem(s) |
| R-02 | "1 rule to fix" / "{count} rules to fix" | Fix {n} problem(s) |
| R-03 | "1 rule to fix before you submit" / "{count} rules to fix before you submit" | Fix {n} problem(s) before you submit |
| R-05 | {stat}: base personal stats must be whole numbers from {min} to {max}. | {Stat} must be a whole number from {min} to {max}. |
| R-06 | {used} personal stat points allocated, but only {available} are available. | Personal stats use {used} points, but only {available} are available. |
| R-07 | Already at the minimum ({min}) | At the minimum ({min}) |
| R-08 | Already at the maximum ({max}) | At the maximum ({max}) |
| R-11 | {stat} must be a whole number from 0 to {max}. | {Stat} must be a whole number from 0 to {max}. |
| R-12 | Over the limit | Not enough mod points |
| R-16 | Pilot gear exceeds its available armour, weapon or gear slots. | Pilot gear doesn't fit the available slots. |
| R-17 | Pilot gear includes items unavailable in the loaded content packs. | Some pilot gear isn't in any loaded pack. |
| R-18 | Biomod {id} isn't in the loaded catalogue. | Unknown biomod ({id}). |
| R-22 | Core bonuses taken: {taken}, but {ranks} licence ranks only give {picks}. | Too many core bonuses: {taken} taken, {picks} available. |
| R-23 | Core bonus {id} isn't in the loaded content packs. | Core bonus {id} isn't in any loaded pack. |
| R-25 | {bonus} has no manufacturer in the loaded content packs. | {bonus} has no manufacturer. |
| R-26 | {maker} core bonuses need {n} {maker} licence ranks; you have {ranks}. | {maker} core bonuses need {n} {maker} licence ranks, but the pilot has {ranks}. |
| R-29 | Licence {id} isn't in the loaded licensed frames. | Licence {id} isn't in any loaded pack. |
| R-30 | {frame} is now part of the {original} licence, not a licence of its own: a GM should move its ranks there. | {frame} is part of the {original} licence. A GM should move its ranks there. |
| R-32 | Talent {id} isn't in the loaded content packs. | Talent {id} isn't in any loaded pack. |
| R-33 | Needs licence {I\\|II\\|III} | Needs {licence} {I\|II\|III} |
| R-35 | its frame isn't in the loaded content packs. | Frame isn't in any loaded pack. |
| R-36 | {item} needs its talent rank; it is no longer granted. | {item} needs its talent rank. |
| R-37 | {item} is integrated and must not also occupy a normal slot. | {item} is integrated and can't also take a normal slot. |
| R-38 | Weapons remain on mounts this build no longer has; remove or refit them. | Some weapons are on mounts the frame doesn't have. |
| R-39 | Weapons remain in extra slots this mount no longer has; remove or refit them. | Some weapons are in slots the mount doesn't have. |
| R-40 | {bonus}: choose a normal mount. | {bonus} needs a normal mount. |
| R-41 | Overpower Caliber: choose an equipped weapon. | Overpower Caliber needs an equipped weapon. |
| R-42 | {weapon}: selected weapon profile is unavailable. | {weapon} has a profile that no longer exists. |
| R-48 | {frame} isn't the frame the {licence} licence gives this pilot. | {frame} isn't the frame chosen for the {licence} licence. |
| R-49 | A weapon ({id}) isn't in the loaded content packs. | Weapon {id} isn't in any loaded pack. |
| R-51 | Its Superheavy weapon needs a second, empty mount. | Superheavy weapon needs a second empty mount. |
| R-52 | {mod} is on a weapon that is no longer there; remove it. | {mod} has no weapon to sit on. |
| R-53 | A mod ({id}) isn't in the loaded content packs. | Mod {id} isn't in any loaded pack. |
| R-55 | A system ({id}) isn't in the loaded content packs. | System {id} isn't in any loaded pack. |
| R-56 | {item} is unique: one per mech. | {item} is Unique. Only one allowed per mech. |
| R-57 | Only one AI per mech. | Only one AI allowed. |
| R-58 | Only {n} AIs allowed on this mech. | Only {n} AIs allowed. |
| R-59 | Its system points are over: {used}/{total}. | Uses {used} system points, but only {total} are available. |
| R-62 | Unique: already on this mech | Already on this mech |
| R-63 | AI capacity {n} | Not enough AI capacity |
| R-64 | Needs an empty mount to brace it | Needs an empty mount |
| R-65 | Not enough SP | Not enough system points |
| R-66 | An integrated mount can't be modified  /  {weapon} can't take mods  /  Fits {types} weapons only  /  Can't go on {type} weapons | An integrated mount can't be modified / {weapon} can't take mods / Fits {types} only / Can't go on {type} weapons |
| R-68 | The pilot changed after this change was made. | Pilot changed after this change |
| R-69 | Fix the item IDs above first. | Fix the item IDs first |
| R-70 | Loading installed content… | Loading… |
| R-71 | Installed content failed to load. | Content didn't load |
| R-73 | Save your changes first. | Save your changes first |
| R-74 | Fix {n} problem first.  /  Fix {n} problems first. | Fix {n} problem(s) first |
| R-75 | Used by {name}, {name} and {n} more. Swap it out of their sheets first. | Used by {name}, {name} and {n} more |
| V-03 | The data must be one JSON object, in curly braces. | The data must be one JSON object. |
| V-04 | The ID can't change: it has to stay "{id}", so pilots keep this item. | The ID must stay "{id}". |
| V-06 | Choose what kind of gear this is. | Choose a gear type. |
| V-07 | Choose the manufacturer of this core bonus. | Choose a manufacturer. |
| V-08 | Tag {n} needs choosing.  /  {who}: tag {n} needs choosing. | Tag {n} needs choosing. / {Who}: Tag {n} needs choosing. |
| V-09 | Tag "{id}" isn't in the loaded tags. | Tag "{id}" doesn't exist. |
| V-11 | Bonus {n} needs a type. | Bonus {n} needs a type. (capitalised after a colon) |
| V-12 | Bonus "{id}" isn't counted by the site's build maths. | Bonus "{id}" isn't counted in the stats. |
| V-14 | Action {n} needs a name. | Action {n} needs a name. (capitalised after a colon) |
| V-15 | Action {n} has an activation the site doesn't know. | Action {n} has an unknown activation. |
| V-16 | Action {n} has no rules text, so players won't see it. | Action {n} has no rules text and won't show. |
| V-21 | {Deployable}: {size\\|HP\\|evasion\\|e-defence\\|armour} needs a number, 0 or more. | {Deployable}: {Size\|HP\|Evasion\|E-defence\|Armour} needs a number, 0 or more. |
| V-22 | The licence "{id}" isn't a frame that exists. | Licence "{id}" isn't a frame. |
| V-24 | System points need a whole number, 0 or more. | System points must be a whole number, 0 or more. |
| V-33 | {Rank}: "{id}" isn't an item that exists. | {Rank}: Item "{id}" doesn't exist. |
| V-34 | Choose the manufacturer. | Choose a manufacturer. |
| V-37 | Choose the original frame: an alternate frame is already an alternate of another. | Choose the original frame, not another alternate. |
| V-38 | A frame is its own licence: licence id should be "{id}". | Licence ID should be "{id}". |
| V-41 | {Stat} needs a whole number, 0 or more.  /  {Stat} needs a whole number. | {Stat} must be a whole number, 0 or more. / {Stat} must be a whole number. |
| V-43 | Mount {n} needs a mount the site knows. | Mount {n} isn't a known mount. |
| V-47 | Core system: "{id}" isn't an item that exists. | Core system: Item "{id}" doesn't exist. |
| V-48 | The ID is a short code of letters, numbers, - and _, such as IPS-N. | Use letters, numbers, - and _, like IPS-N. |
| V-49 | The main colour needs a hex colour such as #1c9ae8. | Main colour needs a hex value like #1c9ae8. |
| V-50 | The darker colour needs a hex colour such as #0c4d99. | Darker colour needs a hex value like #0c4d99. |
| V-51 | No slot: pilots will not see where on the body it goes. | No slot set. |
| V-52 | No manufacturer: it's listed under Other. | No manufacturer. It's listed under Other. |
| V-53 | The price needs a whole number of manna, 0 or more. | Price must be a whole number, 0 or more. |
| V-54 | Mod points need a whole number, 0 or more. | Mod points must be a whole number, 0 or more. |
| V-57 | Bonus {n} needs a whole number other than 0. | Bonus {n} must be a whole number, not 0. |
| V-58 | The order needs a whole number. | Order must be a whole number. |
| C-01 | Mark {name} dead? This can't be undone. They move to the memorial, and you can register a new pilot. | Mark {name} dead? They move to the memorial. This can't be undone. |
| C-02 | Withdraw this change? Everything in it is thrown away; your approved pilot stays as it is. | Withdraw this change? Your approved pilot won't change. This can't be undone. |
| C-04 | Withdraw | Withdraw change |
| C-05 | Remove {name}? | Remove {name}? It leaves the slot empty. |
| C-06 | Remove | Remove gear |
| C-07 | Remove {name}? | Remove {name}? It frees a core bonus pick. |
| C-08 | Remove | Remove core bonus |
| C-09 | A new frame has different mounts, so this mech's weapons, and their mods, come off. Go ahead? | Change the frame? This mech's weapons and mods come off. |
| C-11 | Scrap {mech}? This can't be undone. | Scrap {mech}? It leaves the hangar. This can't be undone. |
| C-13 | Remove {weapon}?  /  Remove {weapon} and its mod, {mod}? | Remove {weapon}? It leaves the mount empty. / Remove {weapon} and its mod, {mod}? It leaves the mount empty. |
| C-14 | Remove {mod}? | Remove {mod}? The weapon keeps no mod. |
| C-15 | Remove {system}? | Remove {system}? It frees its system points. |
| C-16 | Remove | Remove weapon / Remove mod / Remove system |
| C-17 | Unpublish "{title}"? Only GMs will be able to read it. | Unpublish {title}? Only GMs can read it. |
| C-18 | Unpublish | Unpublish entry |
| C-19 | Delete "{title}"? This can't be undone. Links to it from other entries will stop working. | Delete {title}? Links to it stop working. This can't be undone. |
| C-21 | Mark {name} dead? This can't be undone. They move to the memorial. | Mark {name} dead? They move to the memorial. This can't be undone. |
| C-23 | Delete {name} permanently? This removes the pilot, their sheet, mechs and every change. It can't be undone. | Delete {name}? This removes their sheet, mechs and changes. This can't be undone. |
| C-25 | Approve {name}? They'll appear in the pilot registry.{ The rule check lists {n} problem(s).} | Approve {name}? They join the registry.{ It has {n} problem(s).} |
| C-27 | Approve this change to {name}? It goes live straight away.{ The rule check lists {n} problem(s).} | Approve the change to {name}? It goes live at once.{ It has {n} problem(s).} |
| C-29 | Remove {pack} and its {n} item(s)? This can't be undone. Importing the pack again brings them back. | Remove {pack} and its {n} item(s)? This can't be undone. |
| C-31 | Discard your unsaved changes? | Discard unsaved changes? This can't be undone. |
| C-33 | Publish "{title}"? Players can pick it as soon as it's published, and it can't go back to a draft. | Publish {title}? Players can use it at once. This can't be undone. |
| C-34 | Publish | Publish item |
| C-35 | Put "{title}" back to the pack's own version? The campaign's edits are lost, and every pilot using it sees the original. | Revert {title} to the pack's version? Your edits are lost. This can't be undone. |
| C-37 | Delete "{title}"? This can't be undone. It's in no pilot's sheet. | Delete {title}? This can't be undone. |
| M-02 | Loading pilot record… | Loading… |
| M-07 | Not saved yet | Unsaved changes |
| M-15 | can't reach the database. Check your connection, then retry. | Can't reach the server. Check your connection. |
| M-16 | you don't have permission to change this, or it no longer exists. | You don't have permission to change this. |
| M-17 | this changed somewhere else. | Someone else changed this. |
| M-18 | your last edit is not saved yet. Retry saving it first. | Your last edit is not saved yet. Retry it first. |
| M-20 | The manufacturer ID should look like XXXX-XXXX-XXXX (letters and digits). | The manufacturer ID should look like XXXX-XXXX-XXXX. |
| M-21 | that file is not an image. | That file is not an image. |
| M-22 | that image is over 20 MB. Pick a smaller one. | That image is over 20 MB. |
| M-23 | that image can't be read. Try a PNG, JPEG or WebP. | That image can't be read. Try a PNG, JPEG or WebP. |
| M-24 | that image can't be converted. | That image can't be converted. |
| M-30 | Loading mech record… | Loading… |
| M-31 | No mech with that id in {your\\|this} hangar. | No mech with that ID. |
| M-34 | Item unavailable | That item is unavailable. |
| M-36 | Loading pilots… | Loading… |
| M-37 | Couldn't load the pilots: {error} | Pilots didn't load: {error} |
| M-44 | a title is needed. | A title is needed. |
| M-47 | Loading pilot records… | Loading… |
| M-50 | Private sheet missing | Sheet missing |
| M-56 | Saved. | Saved |
| M-57 | Write a note first, so the player knows what to change. | Write a note before sending back. |
| M-58 | Sent back. The player sees your note on their sheet. | Sent back. |
| M-59 | Nothing was deleted. Only owners can delete pilots. | Not deleted: Only owners can delete pilots. |
| M-61 | Loading changes… | Loading… |
| M-63 | Loading change… | Loading… |
| M-65 | Could not load the complete pilot record. Reload before reviewing. | The pilot record didn't load fully. |
| M-67 | Write a reason first, so the player knows what to fix. | Write a reason before rejecting. |
| M-69 | Loading installed content… | Loading… |
| M-70 | Could not load installed content. {error} | Content didn't load: {error} |
| M-73 | Checking {file}… | Loading… |
| M-74 | Loading core content… | Loading… |
| M-75 | Could not load core content. {error}  /  Please try again. | Core content didn't load: {error} / Try again. |
| M-76 | Choose an .lcp file or a ZIP export of one. | Choose an .lcp file. |
| M-77 | Choose an LCP smaller than 15 MB. | That file is over 15 MB. |
| M-78 | This file is for {pack}. Choose an update for {target}, or use Import a pack to add it separately. | This file is for {pack}, not {target}. |
| M-79 | Could not read this pack. Choose a valid .lcp file. | That isn't a valid .lcp file. |
| M-80 | Import failed. {error} No partial import was saved. | Not imported: {error} |
| M-81 | Couldn't check which pilots use it. | Couldn't check who uses it. |
| M-82 | This archive contains too many files. | That pack has too many files. |
| M-83 | The archive contains two copies of {file}. | The pack has two copies of {file}. |
| M-84 | The JSON content is too large. Split this into smaller packs. | That pack is too large. |
| M-85 | Could not open this archive. Choose a valid .lcp file, not an extracted folder. | That isn't a valid .lcp file. |
| M-86 | {file} is not valid UTF-8 JSON. Fix it and export the pack again. | {file} isn't valid JSON. |
| M-87 | Missing lcp_manifest.json at the top level of the archive. | The pack has no lcp_manifest.json. |
| M-88 | The pack manifest must be a JSON object. | The manifest isn't valid. |
| M-93 | Every item in {file} needs a non-empty ID without surrounding spaces. | Every item in {file} needs an ID. |
| M-95 | Duplicate item ID: {id}. Every item in a pack needs its own ID. | Duplicate item ID: {id}. |
| M-96 | Import at most 10,000 items at once. Split this into smaller packs. | A pack can have at most 10,000 items. |
| M-97 | This pack contains no supported pilot or mech content. | This pack has no content the site uses. |
| M-100 | This item isn't available. It may have been deleted. | This item isn't available. |
| M-103 | There is no homebrew yet: make an item first. | No homebrew yet. |
| M-104 | There are no published homebrew items to export yet. | No published homebrew to export. |
| M-105 | Couldn't check which pilots use this. | Couldn't check who uses this. |
| M-107 | The biomod was not saved. | You don't have permission to change this. |
| M-108 | unreadable data | Unreadable data |
| T-04 | pilot sheet sections | Pilot sheet sections |
| T-25 | Search every category | Search |
| T-26 | Name, maker or rules text | Name, manufacturer or rules |
| T-34 | Link an entry | Link entry |
| T-45 | Choose Lancer content pack | Choose pack file |
| T-53 | Search {kind, lower case} | Search |
| T-71 | Link to an entry | Link entry |
| B-17 | Register pilot | Create pilot |
| B-18 | Resubmit for review | Resubmit pilot |
| B-20 | Withdraw | Withdraw change |
| B-21 | Submit for review | Submit change |
| B-39 | Equip {armour\\|weapon\\|gear} | Add {armour\|weapon\|gear} |
| B-45 | Choose core bonus | Add core bonus |
| B-56 | Equip weapon | Add weapon |
| B-74 | Publish | Publish entry / Publish item |
| B-75 | Unpublish | Unpublish entry |
| B-79 | Open the change | Open change |
| B-82 | Refuse pilot | Send back |
| B-83 | Delete pilot permanently | Delete pilot |
| B-84 | Open the record and GM controls | Open pilot record |
| B-88 | Import a pack | Import pack |
| B-90 | Try again | Retry |
| B-99 | Revert | Discard changes |

## Strings changed that were not in the audit
- Pilot sheet register form: heading "Register a pilot" is now "New pilot"; the name field label "Name (required)" is now "Name".
- Change review line labels are capitalised in code: Pilot name, Callsign, Age, Gender, Sexuality, Height, Weight, Eye colour, Hair colour (identity fields), Portrait, Appearance, Personality, Traits, Backstory, History, Image, Name, Manufacturer ID, Frame, Weapon mounts rearranged, Unassigned, Defaults.
- Item card rule headings "on attack / on hit / on crit" are now "On attack / On hit / On crit".
- Deployable stat names on item cards: "size · hp · armor · evasion · edef · speed · heatcap" are now "Size · HP · Armour · Evasion · E-defence · Speed · Heat cap".
- Pilot gear bonus labels on cards: armour, hp, e-defence, speed are now Armour, HP, E-defence, Speed.
- Content page: the "older items kept" total and the "Older items missing from this update stay available..." line are gone; "Biomods" count label capitalised.
- Stat tile tooltips "Already at the minimum/maximum (n)" are now "At the minimum/maximum (n)".
- Content editor "Revert" (discard unsaved edits) is now "Discard changes".
- Content page "Import a pack" is now "Import pack"; "Try again" is now "Retry".
- Overcharge heat is shown without dice (1 → 2 → 4 → 8); a frame's own list is converted the same way.
- Biomod and rule-check problem lines now follow "{Name} isn't in any loaded pack." / "Unknown biomod ({id})."
