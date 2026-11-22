# LANCER: DICELESS & MAPLESS RP HANDBOOK
*A complete, self-contained ruleset for text-based roleplay—no dice, no battlemaps, and no prior Lancer rulebook required.*

---

### 1. Turn Economy & Scene Resources
On your turn, you get:
* **1 Protocol:** Optional quick system toggle activated at the very start of your turn before moving or taking actions.
* **1 Movement:** Reposition using your mech's **Speed** stat.
* **1 Full Action** OR **2 Quick Actions:** You cannot take the exact same action twice in a single turn unless an ability or Overcharge allows it.
* **1 Overcharge:** Optional once-per-turn Free Action to push your reactor for **1 extra Quick Action**, at the cost of escalating Heat.
* **1 Reaction:** Declared at the **end** of your turn as a pre-emptive commitment rather than a mid-post interruption.

#### Track Per Turn
At the end of each post, track your current **HP**, **Structure** (usually 4), **Heat** (up to your Heat Cap), **Stress** (usually 4), **Active Statuses**, **Limited Charges**, and **Overcharges** used.

#### Scene Meta-Resources (Reset Every Combat/Scene)
* **Lancer's Edge (2 / Scene):** Add **+2** (1 Accuracy) to **any** Attack, Tech Attack, Check, or Save. Designed to help any pilot land crucial blows or pass key checks when stats alone fall short.
* **Lancer's Precision (1 / Scene):** Declared *before* an attack resolves. Upgrades a **Grazing Hit (`1–3 below`)** OR a **Full Hit (`>= Defense`)** into a **Critical Hit**. Expended whether the attack hits or misses.

---

### 2. Core Resolution Math

#### Accuracy & Difficulty
* **1 Accuracy = +2** | **1 Difficulty = -2**
* Net Accuracy/Difficulty on any single roll is **capped at ±2 stacks (±4 total)** from combined weapon tags, statuses, and reactions.

#### Physical & Tech Attacks
$$\text{Attack} = 10 + \text{Grit (or NPC Bonus)} + \text{Net Accuracy/Difficulty}$$
$$\text{Tech Attack} = 10 + \text{Tech Attack} + \text{Net Accuracy/Difficulty}$$

| Result vs. Target Evasion / E-Defense | Physical Attack Outcome | Tech Attack Outcome |
| :--- | :--- | :--- |
| **+3 or more over** *(or Lancer's Precision on a hit/graze)* | **Critical Hit:** 1.25x damage (rounded up) + on-hit & crit riders | **Critical Hack:** Full Heat + full effects + crit riders |
| **Equal to +2 over** | **Full Hit:** Full damage + on-hit riders | **Full Hack:** Full Heat + full effects |
| **1–3 below** | **Grazing Hit:** Half damage (rounded up), **no** on-hit riders | **Partial Hack:** **1 Heat** (or **Impaired** until end of next turn), **no** full hack conditions |
| **4+ below** | **Miss:** 0 damage (unless *Reliable X* applies) | **Fail:** No effect |

* **Crit Damage Calculation:** Multiply base weapon damage + static bonuses by **1.25** and round up (e.g., 3 becomes 4, 5 becomes 7, 6 becomes 8).
* **Damage Types & Armor:** Damage comes in **Kinetic**, **Explosive**, **Energy**, and **Burn**. Your **Armor** (typically 0 to 4) subtracts directly from incoming Kinetic, Explosive, and Energy damage—**unless** the attack has **Armor Piercing (AP)** or you are **Shredded**. **Burn** always ignores Armor.
* **Calibrated Defense Baselines:** Light/Nimble (Evasion 12–14 | E-Def 10–12), Medium/Standard (Evasion 10–12 | E-Def 10–12), Heavy/Superheavy (Evasion 8–10 | E-Def 10–14).

#### Checks & Saves
$$\text{Check / Save Score} = 10 + \text{HASE Stat (Hull, Agility, Systems, Engineering)}$$
* **Above Target DC:** Succeed | **Below Target DC:** Fail | **Equal to Target DC:** The defender chooses to take **1 Heat** to succeed, or willingly fails.

#### Pilot Narrative Checks (Out of Mech)
Outside of mech combat, pilots use narrative **Triggers** (+2, +4, or +6). Compare **10 + Pilot Trigger** against flat DCs:
* **DC 12:** Routine / Trained task
* **DC 14:** Risky / Expert task
* **DC 16:** Heroic / Near-Impossible task
* *Pushing Through:* Spend **Lancer's Edge (+2)** or take **1 Narrative Stress** to bridge a 1–2 point gap.

---

### 3. Narrative Positioning & Speed Gateways
There is no grid; positioning is established in prose and gated by **Speed** and **Range**.

#### Speed Gateways (What Your Movement Unlocks)
* **Standard Repositioning (Any Speed):** Move freely within your immediate local area—take cover behind terrain, shift angles, engage an adjacent target, or step back slightly.
* **Cross-Field Maneuver (Speed 5+):** Cross the main battlefield to reach a distant target, flank behind a frontline, or dramatically change elevation in one move. *(Speed 4 or lower requires a **Boost**).*
* **Extreme Dash / Disengage & Relocate (Speed 6+):** Break out of a brawl *and* cross the field to a completely new position in one turn. *(Speed 5 or lower requires a **Boost**).*

#### Range Tiers & Narrative Intent
* **Range 1 (Engaged / Melee):** Must narratively close into melee **Engagement** with the target. While Engaged, making **Range 6+** attacks incurs **1 Difficulty (-2)**.
* **Range 2+ (Close / CQB):** Hits anyone in the immediate brawl or nearby cover without entering Engagement.
* **Range 6+ (Medium / Rifle):** Hits anywhere across the central firefight with a clear sightline.
* **Range 11+ (Far / Sniper):** Hits rear lines, ridges, or distant targets across long sightlines.
* **Range 21+ (Extreme / Artillery):** Hits anywhere on the battlefield unless completely sealed off from line of sight.

#### Area of Effect (AoE) Templates
* **Burst:** Hits everyone currently **Engaged** with you (Burst 1) or everyone in your immediate local area / Close Range (Burst 2+).
* **Blast:** Hits primary target + **1–2 nearby targets** clustered around the same cover, objective, or squad.
* **Cone:** Hits up to **2–3 targets** in a forward arc between you and your target's direction.
* **Line:** Hits primary target + **1–2 targets** positioned directly behind them along the same firing lane.

#### Converting Range, Threat & Sensor Traits
* **+1 to +4 Range:** Ignores partial sightline/angle penalties within your current Range Tier, or lets a **Close (2+)** weapon reach **Medium (6+)** from a strong vantage point.
* **+5 or more Range:** Promotes the weapon up **one full Range Tier** (e.g., Medium 6+ → Far 11+).
* **+1 to +2 Threat (Melee):** Lets you make melee attacks and declare **Overwatch** against targets in **Close Range (2+)** without entering **Range 1 Engagement**.
* **Sensors Stat (Tech / Lock On / Bolster Reach):**
  * *Sensors 5:* **Short-Range** (Engaged / Close Range only).
  * *Sensors 8–10:* **Tactical** (Anywhere in the central firefight / Medium Range).
  * *Sensors 15–20:* **Battlefield-Wide** (Anywhere in the scene; ignores *Obscured* for Lock On/Search).
* **Auras ("Within Range X"):** Range 1–2 = Engaged or sharing your immediate cover; Range 3–5 = Anyone in your local Close Range area (or 1 designated ally/enemy you tether to at the start of your turn); Range 8+ = Anyone in sight across the central firefight.
* **Range-Conditional Talents:** *"Within Range 3"* = Engaged or Close Range (2+). *"Beyond Range 5/8+"* = Medium/Far/Extreme range while not Engaged and without using a Cross-Field Maneuver.

#### Cover, Terrain & Knockback
* **Cover:** Environmental cover does not grant defense bonuses in Player vs. Player combat (except for **Deployables** providing cover). **Screened**, **Barrier-Protected**, and **Obscured** remain active.
* **Knockback (1–3):** Triggers on a **Full Hit or Crit** (not on a Grazing Hit):
  * Knockback 1: Breaks Range 1 Engagement (pushes target to Close Range).
  * Knockback 2: Slams target into local terrain/walls or knocks them off low ledges.
  * Knockback 3+: Launches target across the battlefield or into **Dangerous Terrain**.
* **Difficult Terrain:** Crossing rubble, deep mud, or wreckage reduces your effective **Speed by 2** for that turn.
* **Dangerous Terrain:** Entering or ending a turn inside plasma vents, acid pools, or collapsing debris deals a flat hazard penalty (e.g., **2 Heat** or **3 damage**) unless cleared via a flat **Agility/Engineering Check**.
* **Deployables & Drones:** Must be noted at the end of a post with their location/anchor and remaining HP.

---

### 4. Pre-Declared Reactions (End of Turn)
Reactions are declared at the end of your turn as pre-emptive commitments rather than mid-post interrupts:
* **Brace:** The first damaging attack you take before the start of your next turn deals **half damage and half Heat**. However, on your next turn you **cannot take Reactions**, **cannot Move**, and can only take **1 Quick Action** (no Full Actions or Overcharges).
* **Overwatch:** Declare a **Melee or CQB weapon** (non-Heavy) and a **target**. If that target moves away from you before your next turn, you gain a **free attack** against them on your next turn.
* **Modifier Reactions:** Systems or talents with the Reaction tag that alter rolls must be declared at the end of your turn and apply **+2 (1 Accuracy)** or **-2 (1 Difficulty)** to the affected calculation as it happens.

---

### 5. Core Actions, Overcharge & Structure / Stress

#### Standard Mech Actions
* **Skirmish (Quick Action):** Attack with **1 weapon** (plus a second Auxiliary weapon on the same mount, if applicable).
* **Barrage (Full Action):** Attack with **2 weapons** (or **1 Superheavy weapon**).
* **Boost (Quick Action):** Make an extra Movement—used to cover extra ground or unlock a **Speed Gateway** your base Speed couldn't reach.
* **Reload (Quick Action):** Reload **one Loading weapon** or **one weapon mount** containing Loading weapons.
* **Tech Attack / Invade (Quick Action):** Make a Tech Attack against a target's **E-Defense** to inflict **2 Heat** plus a hacking effect (such as *Impaired* or *Slowed*).
* **Lock On (Quick Action):** Mark a visible target as **Locked On** (no roll required).
* **Bolster (Quick Action):** Grant an ally **+2 (1 Accuracy)** on their next Skill Check or Save.
* **Hide (Quick Action):** Become **Hidden** if you are out of direct line of sight, **Obscured**, or **Invisible**, and not **Engaged**.
* **Search (Quick Action):** Spot a **Hidden** target by comparing your **10 + Systems** against their **10 + Agility**.
* **Ram (Quick Action):** Melee attack against an adjacent target; on a **Full Hit or Crit**, knock the target **Prone** + **Knockback 1**.
* **Grapple (Quick Action):** Melee attack against an adjacent target; on a hit, a larger mech locks a smaller mech in place (the smaller mech cannot move independently). Equal-sized mechs are controlled by whoever has the higher **Hull** score. The grappled target must spend **1 Quick Action + 1 Heat** to break free.
* **Disengage (Full Action):** Safely move without triggering **Overwatch** or Engagement penalties.
* **Stabilize (Full Action):** Cool your reactor, reload all weapons, and patch systems—choose **one** from each pair:
  1. Clear all **Heat** to 0 **OR** spend 1 Repair to heal to **full HP**.
  2. Reload all **Loading** weapons, clear all **Burn**, **OR** clear one **Condition** (such as *Impaired* or *Jammed*) on yourself or an engaged ally.
* **Overcharge (1/Turn, Free Action):** Gain 1 extra Quick Action immediately. Heat cost escalates per use between Full Repairs: **1 Heat → 2 Heat → 4 Heat → 6 Heat**.

#### Structure & Stress Tracks (1–4)
When your HP hits 0, you take **1 Structure damage** (resetting HP to full with any leftover damage carrying over). When your Heat exceeds your Heat Cap, you take **1 Stress damage** (resetting Heat to 0 with leftover Heat carrying over).
* **Structure Damage:** 1 **Impaired** until end of next turn • 2 **Destroy** one eligible weapon mount or system • 3 **Stunned** until end of next turn • 4 **Blow Up** (mech is wrecked).
* **Stress Damage:** 1 **Impaired** until end of next turn • 2 Gain **Exposed** status • 3 **Stunned** until end of next turn • 4 **Melt Down** (reactor goes critical and explodes).

---

### 6. Complete Statuses & Conditions

| Status / Condition | Full Effect |
| :--- | :--- |
| **Burn X** | Deals X Armor-ignoring Burn damage at the end of your turn, then decreases by **1 + half Engineering (rounded down)** until it reaches 0 (or is cleared immediately via **Stabilize**). |
| **Exposed** | Your reactor shielding is blown open—all Kinetic, Explosive, and Energy damage you take is **doubled** until cleared with **Stabilize**. |
| **Hidden** | Enemies know your rough area, but you **cannot be directly targeted** by attacks until you attack, lose cover/obscurement, or are found via **Search**. |
| **Immobilized** | You **cannot move or Boost** voluntarily, and you automatically fail **Agility** checks/saves (though **Knockback** can still move you). |
| **Impaired** | You suffer **-2 (1 Difficulty)** to all Attacks, Tech Attacks, Checks, and Saves. |
| **Intangible** | You phase out of normal space—you **cannot affect or be affected by** any physical attacks, tech attacks, objects, or characters until the condition ends, though you can still move normally. |
| **Invisible** | All attacks against you suffer **-2 (1 Difficulty)**. Additionally, while Invisible: (1) you may take the **Hide** action in the open without needing cover or *Obscured* terrain (unless Engaged), (2) your movement does not trigger **Overwatch**, and (3) you gain **+1 effective Speed** toward unlocking **Speed Gateways**. |
| **Jammed** | Your comms and targeting are scrambled—you **cannot** make normal ranged/tech attacks, use systems, take Reactions, or speak over comms. You can only **Move, Boost, Improvise Attack, Grapple, or Ram**. |
| **Lock On** | Any attacker can consume this status on their next attack against you to gain **+2 (1 Accuracy)**. |
| **Prone** | You are knocked down—attacks against you gain **+2 (1 Accuracy)**, you count as **Slowed**, and you must sacrifice your **Movement** to stand back up. |
| **Shredded** | Your defenses are torn apart—you gain **no benefit from Armor or Damage Resistance** (all incoming damage hits at full value). |
| **Shutdown** | Your reactor is powered down—you are **Stunned**, lose all active system effects, and are **Immune to Tech Attacks** until you spend a **Full Action to Boot Up**. |
| **Slowed** | You are locked out of all **Speed Gateways** (only Standard Repositioning is allowed) and **cannot Boost**. |
| **Stunned** | Until the end of your next turn, you are limited to **1 Quick Action** (no Full Actions, Movement, Overcharge, or Reactions), and attacks against you gain **+2 (1 Accuracy)**. |

---

### 7. Weapon Sizes, Tags & System Conversions

#### Weapon Sizes & Mounts
* **Auxiliary (Aux):** Light weapons. Firing a mount holding two Aux weapons (*Flex* or *Aux/Aux*) fires **both** with the same Skirmish/Barrage (the second Aux weapon deals base damage only, without bonus damage).
* **Main:** Standard mech weapons; one fires per Skirmish.
* **Heavy:** High-impact weapons; cannot be fired with **Overwatch** unless a talent specifies otherwise.
* **Superheavy:** Occupies **two mounts** and requires a **Full Action (Barrage)** to fire; cannot be used with Skirmish or Overwatch.

#### Weapon & System Tags
* **Accurate / Inaccurate:** Grants **+1 Accuracy (+2)** or **+1 Difficulty (-2)** on attacks with this weapon.
* **AI:** System/weapon contains an NHP or Comp/Con; allows the mech to act autonomously while the pilot operates outside.
* **Armor Piercing (AP):** Ignores the target's **Armor** when dealing damage.
* **Arcing:** Lobs shots over obstacles; ignores cover, **Screened**, and **Barrier-Protected**.
* **Danger Zone:** Only activates (or gains bonus effects) when your current **Heat is at least half your Heat Cap** (rounded up).
* **Heat X (Self):** Firing the weapon immediately adds **X Heat** to your own reactor.
* **Knockback X:** Pushes target back on a **Full Hit or Crit** (see Section 3).
* **Limited X:** Can only be used **X times per mission** (plus bonus uses from your Engineering stat) until you perform a **Full Repair**.
* **Loading:** Weapon can only be fired once, then requires a **Reload (Quick Action)** or **Stabilize (Full Action)** before firing again.
* **Mod:** Attached to a weapon mount to grant extra tags or damage.
* **Ordnance:** Can only be fired **before** you move on your turn, and **cannot be used while Engaged** (Range 1).
* **Overkill:** Before making an attack, you may take **1 Heat** to add **+2 damage** (once per attack).
* **Overshield X:** Grants **X temporary HP** that absorbs incoming damage before your real HP (does not stack—keep the highest value).
* **Protocol:** Activated only at the **start of your turn** before moving or taking actions.
* **Reaction:** Must be pre-declared at the **end of your turn** (counts toward your 1 Reaction per round limit).
* **Reliable X:** Even on a **Grazing Hit** (if X is higher than half damage) or a **Full Miss**, the weapon still deals **X damage**.
* **Seeking:** Guided munitions; ignores cover, **Screened**, and **Barrier-Protected**, but **cannot hit Obscured targets**.
* **Shield:** Grants **Barrier-Protected** (-2 / 1 Difficulty to incoming ranged attacks) or deploys directional cover.
* **Smart:** Self-guiding weapon; targets **E-Defense** instead of Evasion, and ignores all cover and statuses like **Obscured**.
* **Thrown:** Weapon leaves your hand on attack and cannot be used again until recovered with a **Quick Action**.
* **Unique:** You can only install **one** copy of this weapon or system on your mech.

#### Universal Rulebook Conversions (Talents, Traits & RNG Frames)
* **Dice Damage:** Convert to flat values (the mean, rounded up)—**1d3 = 2**, **1d6 = 4**, **2d6 = 7**, **3d6 = 11**.
* **Recharge X+ & Probability Rolls:**
  * Recharge 4+ or 50% / 4+ → **1-turn cooldown** (usable every other turn) or **triggers on a Full Hit**.
  * Recharge 5+ or 5+ → **2-turn cooldown** or **triggers on a Critical Hit**.
  * Recharge 6 or 6 → **3-turn cooldown** or **Once per scene**.

---

### 8. Recommended RP Post Footer
```text
[STATUS: 18/20 HP | 4/4 Struct | 2/6 Heat | 4/4 Stress | Edge: 2/2 | Precision: 1/1]
[POSITION: Behind comms tower | Engaged: None | Range: Medium to Vanguard, Far to Sniper]
[REACTION DECLARED: Brace (first incoming damaging attack)]
```


---

### 9. Additions (from the core book, adapted)
*Added 2026-11-22 to fill the gaps above. Core numbers are kept where they work. Dice become flat values (mean rounded up), squares become the position tiers, and nothing here adds a new resource or a second reaction system.*

#### A. Filling the gaps above
* **Grit:** Half your licence level, rounded up (shown on the pilot sheet). It's the Grit in the Attack formula, and pilots on foot use it too.
* **Overcharge (after the 4th use):** The cost stays at **6 Heat** for every further use until your next Full Repair.
* **Improvised Attack (Full Action):** A melee attack (Range 1) with a fist, a rifle butt or a lump of wreckage: **4 Kinetic**, resolved like any other attack. *(Core: 1d6.)*
* **Screened:** Granted by a system or a deployable (in PvP, plain terrain gives nothing). Ranged attacks against you suffer **-2 (1 Difficulty)**. Melee is unaffected.
* **Barrier-Protected:** The same effect, from a Shield. **Screened and Barrier-Protected don't stack.**
* **Obscured:** Smoke, darkness or a system's cloud. Attacks against you from **beyond Close** suffer **-2 (1 Difficulty)**, and you can **Hide** while Obscured. *Seeking* weapons can't hit you. *Smart* weapons ignore it.
* **Engaged:** You're Engaged with anyone at Range 1. It ends when either of you moves away, is knocked back, or Disengages. You can be Engaged with several enemies at once.
* **Damage Resistance:** Halves damage of the named type (rounded up), after Armor. Lost while **Shredded**.
* **Bonus damage:** Flat damage added to an attack (Overkill, talents, systems). It's added **before** the Crit multiplier. The second Aux weapon on a mount doesn't get it.
* **Sensor bands:** **Sensors 7 or less = Short-Range** (Engaged and Close) • **8–14 = Tactical** (the central firefight) • **15 or more = Battlefield-Wide**.
* **Aura bands:** **Range 1–2** = Engaged or sharing your cover • **Range 3–7** = your local Close area • **Range 8+** = anyone in sight across the firefight.
* **Search ties:** The hider may take **1 Heat** to stay Hidden (the same as a tied Check).
* **Boot Up while Shutdown:** Shutdown makes you Stunned, but **Boot Up** is the one Full Action you can still take.
* **Structure 2 with nothing left to destroy:** You're **Stunned** until the end of your next turn instead. The **defender** chooses which weapon or system is destroyed. *(Core rolls for it.)*

#### B. Rules the handbook was missing
**Turn order (text scene)**
* Players post in **any order they agree on**. One post is one turn. After each player turn the GM takes **one NPC turn**, and any NPCs left over go once the players are done. A round ends when everyone has acted once.
* Players go first unless the GM calls an **ambush**.
* Reactions you declare expire at the **start of your next turn**.

**Rest & Full Repair (between scenes)**
* **Rest:** A short break between scenes. Clear all **Heat** and **statuses**. Spend **Repairs**: 1 Repair restores all **HP**, 1 Repair fixes one **destroyed weapon or system**, **2 Repairs** restore 1 **Structure** or 1 **Stress** (some frames, like the Everest, cost less, as the mech page shows).
* **Full Repair:** Downtime between missions, when the GM calls it. Everything returns: HP, Structure, Stress, Repairs, Limited uses, destroyed parts, your **Core Power**, and Overcharge back to **1 Heat**.

**Core Power**
* **Once per mission** (it returns at Full Repair). Use the activation and duration the power itself gives. Passive core effects are always on.

**Systems & tech**
* **Activate (Quick or Full):** Use a system with that tag. Overcharge's extra Quick Action can't pay for a Full one.
* **Quick Tech:** Invade, Scan, Lock On, Bolster, or a system's own Quick Tech option.
* **Full Tech (Full Action):** Two Quick Tech actions (they may both be Invade, at the same or different targets), or a system's Full Tech option.
* **Scan (Quick Tech):** No roll. Learn one thing about a target in Sensors: its HP, Structure and Heat • its defences • its weapons and systems • its statuses.
* **Fragment Signal:** The basic Invade option. On a Full Hack the target is **Impaired and Slowed** until the end of its next turn. Other Invade options come from systems and talents.
* **Heat as damage:** Heat you deal goes straight onto the target's Heat. **Armor doesn't reduce it.** Resistance to Heat halves it.

**More mech actions**
* **Shut Down (Quick Action):** Clear all **Heat** and **Exposed**, and end any condition a tech attack caused. You gain **Shutdown** until you **Boot Up (Full Action)**.
* **Mount / Dismount (Full Action):** Get into or out of a mech you're Engaged with. An empty mech can't act.
* **Eject (Quick Action, once a scene):** The pilot is thrown clear to **Close** range. The empty mech is **Impaired** and can't act.
* **Self-Destruct (Quick Action):** At the **end of your next turn** your mech explodes: **Burst 2, 14 Explosive**. Anyone caught can make an **Agility save (DC 14)** for half. The mech is destroyed, and a pilot still inside dies. *(Core: 4d6.)*
* **Skill Check (Quick Action):** Make a Check for a HASE stat when the GM calls for one.

**Statuses & states**
* **Danger Zone:** Your Heat is at least half your Heat Cap. Danger Zone tags work while you're in it.
* **Down and Out (pilots):** A pilot at **0 HP**. They're **Stunned** and die if they take any more damage. An ally Engaged with them can use Stabilize's second choice to bring them back to **1 HP**.

**Pilots on foot**
* **Pilot stats:** **HP 6**, **E-Defense 10**, **Armor 0**, **Speed 4**, plus gear and talents (as on the pilot sheet). Pilots have no Evasion. *(Open: what attacks against a pilot on foot roll against.)*
* **Pilot attacks:** **10 + Grit** against the target's Evasion. Use the flat damage on the pilot weapon.
* **Jockey (Full Action):** Climb onto a mech you're Engaged with: **10 + Grit** against the mech's **10 + Hull**. On a success, choose one each turn you stay on: **Distract** (Impaired and Slowed until the end of its next turn) • **Shred** (2 Heat) • **Damage** (4 Kinetic, ignores Armor). The mech can shake you off with a successful Hull check on its turn.
* **Mech destroyed (Blow Up):** The pilot survives, thrown clear to **Close**, **Prone** and **Stunned** until the end of their next turn.
* **Melt Down:** The reactor explodes at the **end of your next turn**, like Self-Destruct. The pilot must **Eject** before then or dies.

**Drones & deployables**
* Unless the system says otherwise: **Size ½**, **HP 5**, **Evasion 10**, **E-Defense 10**, **Armor 0**.

**Size**
* Every frame has a **Size** on its sheet (½, 1, 2 or 3). Grapple compares Sizes (Section 5).

#### C. Left out
* Squares, templates by square, falling distance: grid-only. Use the position tiers.
