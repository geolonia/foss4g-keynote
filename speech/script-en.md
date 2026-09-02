# FOSS4G Hiroshima 2026 — Speaker Script (English / canonical)

**Beyond the API — Why AI-Era Data Integration Needs Open Standards, Not Just Open Data**

- Talk: 2026-09-03 13:30 · **20 min talk + 5 min Q&A**
- Source: Keynote Manuscript (B案・swarm, QC-approved). This script *splits* the manuscript for delivery; it does not rewrite it.
- Cut plan: **Plan B** — table-of-contents section dropped, "open data decade" minimized, rebuttals 4 → strongest 2. The three pillars, the demo, and the Close survive untouched.
- Simplification pass (2026-09-02, from the speaker's read-aloud): same content and argument, plainer words — hard-to-pronounce terms replaced, sentences shortened. The audience head-count is removed everywhere ("the strangers in this room" instead of a number): the room speaks for itself, and a spoken count could contradict the real turnout. All measured facts (3,200 scenarios / 1,033 tests / 84.2% / 588 nulls) unchanged.
- Canonical language: **English** (the stage language). The Japanese script mirrors this file; claims, numbers, and structure are identical.

---

## How to read this script

- Normal paragraphs = words to speak.
- **[CUE: …]** lines = stage directions and demo signals. Never spoken.
- 🎙️ blocks = the speaker's own story, deliberately unscripted. Only the frame and target time are given.
- Pace assumption: **110 words per minute** — a deliberate, non-native-friendly pace. At 120 wpm the talk lands early; at 100 wpm it runs late. The checkpoints below absorb that.
- ⚠ **All second counts are desk estimates.** They become real only at the run-throughs on 9/1–9/2. Time the rehearsal; do not treat these numbers as measured.

## Timing sheet (desk estimate)

| # | Section | Words | Spoken @110 wpm | Beats / demo | Total | Ends at |
|---|---------|------:|----------------:|-------------:|------:|--------:|
| I | Seed — the room starts posting | 168 | 92 s | 15 s | 107 s | 1:47 |
| II | The open data decade (minimized) | 133 | 73 s | — | 73 s | 3:00 |
| III | The meaning gap | 284 | 155 s | 10 s | 165 s | 5:45 |
| IV | The objection — two answers (incl. 🎙️ 60 s) | 207 | 113 s | 75 s | 188 s | 8:53 |
| V | The build story + ETSI conformance | 466 | 254 s | 10 s | 264 s | 13:17 |
| VI | The payoff | 100 | 55 s | — | 55 s | 14:12 |
| VII | Harvest — the agent reads the room | 197 | 107 s | 105 s | 212 s | 17:44 |
| VIII | Close — three questions | 150 | 82 s | 5 s | 87 s | **19:11** |

Sum: **1151 s = 19:11** — desk buffer to 20:00 is **49 s**, plus the contingency plan below. The alternate two-question Close is 67 s spoken + the same 5 s beat = 72 s total. Word counts are machine-counted from the spoken paragraphs of this file (cue lines, on-slide text, and 🎙️ frames excluded).

## Checkpoints & contingency

- **Checkpoint A — start of Act V ("The build story") at 8:53.** More than one minute late → plan to skip the live audience question in Act VII (saves ~45 s).
- **Checkpoint B — start of Act VII (map full screen) at 14:12.** More than one minute late → skip the audience question AND use the two-question Close (saves ~60 s total: ~45 s question + ~15 s shorter Close).
- 🎙️ is budgeted at 60 s. If it runs to 90 s, that 30 s overrun consumes most of the 45 s audience-question reserve — that is fine; the reserve exists for exactly this.
- **Demo time is never cut** — the posting window and the three core queries are untouchable; all savings come from speech. The one planned exception is the optional audience question (Cue ⑧), which is a reserve, not part of the core demo.
- Fallback (Act VII): if the venue network or the live pipeline stalls for **15 seconds**, switch to the pre-recorded demo video and narrate over it. Never debug on stage. **Announce the switch honestly** — say that this is a recording of the same pipeline made earlier; the database itself is still up, and a post that fails to send shows an error on the phone and can simply be resubmitted. Never present recorded output as the room's live data, and never guarantee delivery the pipeline cannot promise.

---

## ACT I — Seed: the room starts posting 【0:00–1:47 / 107 s】

**[SLIDE 1 — QR code, full screen. Nothing else. No title, no logo.]**

**[STAGE NOTE (added 2026-09-02, see RUNBOOK.md) — BEFORE this cue, pre-show: open the projection page, advance once to Slide 2 until the map inset shows a post count, verify the WebSocket is actually live (count alone can come from a history fallback — check per RUNBOOK.md: DevTools Network→WS open, no `[keynoteMap] ws` console warning), then return to Slide 1. Opening the page alone does NOT connect. ★NEVER reload the projection page during the talk — the room shares your Wi-Fi IP, and once posting starts the auth rate limit (30/min per IP) may be gone; a reload could leave the stage map dead.]**

**[DEMO CUE ① — POST PROMPT. This is the moment you invite the room to post.]**

Good morning. Don't listen to me yet.

Please take out your phone. Point it at this code. A small form opens. Two questions. Where are you from — prefecture or country. What is your hometown famous for. A third box is optional: a hidden spot the maps don't know.

That's it. No account. No app. I will tell you why later. One promise: what you typed will come back at the end.

**[DEMO CUE ② — Map inset appears bottom-right and stays for the rest of the talk. ★FROM HERE THE ROOM IS POSTING — KEEP TALKING. Do not wait in silence; the posting happens under your voice.]**

**[STAGE NOTE (added 2026-09-02) — This cue = advancing the deck to Slide 2. Normally the map appears right away because the connection was established pre-show; do not reload. If it does not appear, follow RUNBOOK.md: advance the tethered backup device to the current slide first, then switch projection to it — or use the 15-second recorded fallback.]**

Bottom-right corner — those dots are your hometowns. Keep posting; the form stays open. That corner is now live.

**[SLIDE 2 — Title: "Beyond the API".]**

My name is Hal Seki. I run a company called Geolonia. We build data platforms for cities — and for the AI agents starting to use them.

Here is my promise. Before we finish, an AI agent will read what this room just wrote — and understand it. Not because the AI is clever. Because of what happened to your post on its way to the database.

That gap — between clever AI and understood data — is what this talk is about.

## ACT II — The open data decade, minimized 【1:47–3:00 / 73 s】

**[SLIDE 3 — "Access: solved. Meaning: not yet." One slide; the old two slides are merged.]**

First, credit — much of it belongs to this room. Over the last ten years, the open data movement won. Governments publish. Licenses are open. Access is solved. This community did much of that work.

Here is the hard question. If access is solved, why is open data still so hard to use?

Here is what happened. Every portal invented its own schema. Every API invented its own field names. Each one is open — and each one is a small silo with a nice license. We did not tear down the silos. We rebuilt them, with better licenses.

Now the new part. AI agents are becoming the main users of this data. Each new API is one more dialect to teach an agent by hand. Open licenses freed the bytes. Nothing freed the meaning.

## ACT III — The meaning gap 【3:00–5:45 / 165 s】 — Pillar a

**[SLIDE 4 — "The four ambiguities." Four quadrants: Identity / Semantics / Units & conventions / Time.]**

**[slow down — say it deliberately]**

Machine-readable is not machine-interpretable. Every dataset I have worked with has the same four problems.

Identity. Is "Chuo Community Center" in this file the same building as "Chūō Kōminkan" in that one?

Meaning. A column named capacity — how many people fit, or how many are inside right now? Those two numbers save lives differently.

Units and habits. My favorite — a map problem. NGSIv2, an older city-data standard, writes latitude first in its old location format. NGSI-LD and GeoJSON write longitude first. Same two numbers. Two different places on Earth.

Time. Measured when? Valid until? Updated by whom?

For decades, humans fixed this quietly, by hand. An engineer "just knows" column seven is Shift-JIS. That was the hidden cost of every data project — paid in overtime, never written down.

AI agents inherit all four problems, and none of the caution. They never say: "This looks strange. Let me ask someone."

**[SLIDE 5 — THE REVEAL. DEMO CUE ③: pick one real audience post from the inset — one of the two seeded colleague posts if the early crop is thin. Show its raw NGSI-LD JSON full screen. Beat: let it land.]**

Now — look at what you have been making while I talked.

Here is one of your posts, typed minutes ago — and what it became on the way to the database.

Look at the hometown. Not loose text in a comment box — a typed property from a published data model. The specialty: the same. Anything outside the model was rejected — it never got in. The timestamp has a defined meaning. The ID is stable, so the post can be cited.

Here is the point. You did not fill in a schema. You answered two small questions. The data model did the agreeing for you. The strangers in this room are making data that fits together, without ever meeting.

That is a semantic layer. Not paperwork. An agreement the platform enforces, so meaning travels with the data.

## ACT IV — The objection, and two answers 【5:45–8:53 / 188 s】 — Rebuttal

**[SLIDE 6 — The objection, stated in its strongest form.]**

Every AI engineer here is thinking the same thing. Let me say it out loud, at its strongest.

"Modern language models already read messy data. They guess what columns mean. So why build a semantic layer at all? Won't smarter models make it pointless?"

It is a serious argument. I have two answers. The first one I watched happen.

Answer one: the confidence trap. A smarter model does not fail less on unclear data. It fails better — its mistakes look more correct. It never says "I don't know." It picks the most likely meaning and moves on. Wrong answers that look right cost the most. They survive review.

**[SLIDE 7 — The three measured facts, exactly as recorded (source: cmd_715 field report). They stay on screen, plain, while the speaker tells the story. Shift register: slower, personal.]**

> On the slide, not read aloud word-for-word:
> - The AI wrote a text-encoding name that does not exist — twice in a row ('shift-jis', then 'shiftjis'). Each looked plausible. Neither worked.
> - A conversion script ran with no errors. Unhandled CRLF line endings had silently turned the "capacity" field into null — in all 588 records. Zero out of 588. The work was reported as "complete."
> - The lesson, straight from the log: "It ran" does not mean "it's right."

🎙️ **[Here the speaker tells his own hackathon story, in his own words. Target 60 seconds — 90 s max; anything above 60 s spends the contingency reserve. This passage is deliberately unscripted.]**

That is the confidence trap, live. And nothing in that story improves when the model gets smarter. A smarter model invents better-looking names. It writes scripts that fail more quietly.

Answer two: this has happened before. Every time machines got smarter, we gave them more structure, not less. Smarter crawlers got robots.txt, then sitemaps, then schema.org. Smarter models got OpenAPI, function calling, llms.txt, then MCP. If smart made structure pointless, MCP would not exist.

Smarter agents do not need less meaning. They use more of it, faster, with higher stakes. Meaning is a contract — and contracts are what scale.

## ACT V — The build story, with the ETSI numbers 【8:53–13:17 / 264 s】 — Pillar b

**[⏱ CHECKPOINT A — you should be here at 8:53. More than a minute late → plan to skip the audience question in Act VII.]**

**[SLIDE 8 — "So we bet on a standard: NGSI-LD (ETSI GS CIM 009)." One honest diagram.]**

So which contract? We bet on NGSI-LD — an open standard for the things in a city: shelters, buses, sensors, complaints, all in one shared format. It comes from ETSI, a European standards body.

Everything is an entity — a thing with a stable ID. Entities have properties, like capacity. And relationships — a shelter points to the group that runs it, and an agent follows the link instead of guessing. Location and time are built in. The coordinate order? Fixed by the standard. Meaning lives in the data model, not in each API's docs.

This is FOSS4G — I can hear the question. "Why not just run Orion-LD, the reference broker everyone knows?" Fair. It deserves a straight answer, and an honest cost.

**[SLIDE 9 — "Four requirements we couldn't compromise." Stated as OUR requirements, not as anyone's failings.]**

We had four needs. They are ours — not an attack on upstream. That is good software, made by people I respect.

One: fully managed and serverless. A city should not run a 24/7 broker to own its data.

Two: one engine, two protocols — NGSIv2 for old systems, NGSI-LD for the future. Same data.

Three: agents as first-class users. An MCP endpoint on the broker itself — not an add-on in front.

Four: security built in, not bolted on. One policy layer, with tokens tied to the sender.

Those four forced a hard choice: rebuild the standard from scratch, ourselves. That product is GeonicDB.

**[SLIDE 10 — "GeonicDB in one page." Write in (checked by the standard) → store → read out (API for apps / MCP for agents).]**

GeonicDB is a database service for city data. The standard checks every write. Apps read by web API; agents, by MCP. The city runs no servers. That corner is GeonicDB, live.

**[SLIDE 11 — "What it cost, and what it bought." Both columns visible at once.]**

Now the cost — a keynote that hides the cost is a sales pitch. Our test suite: about 3,200 scenarios. More test code than product code. And what we ship is, honestly, a subset of the standard. "Subset," not "compliant." You deserve the exact word.

**[SLIDE 12 — ETSI conformance chart, REUSED from the existing livedeck deck ("ETSI 適合度 84.2%" slide). The self-measurement note must be visible on the slide face. Present it as data — no triumph, no needling. FIWARE authors may be in the room.]**

But "subset" is not a feeling. It is a number. ETSI has an official test suite — 1,033 tests. We ran it ourselves. Four brokers, same conditions. GeonicDB passed 84.2 percent. Stellio, 51.6. Scorpio, 36.5. Orion-LD, 24.6.

I do not claim "compliant." I claim a measured number: 84.2 percent, the highest of the four. Our own run, late August, on our version 0.17. The conditions are on this slide.

We also walked away from upstream. Nobody carries our bugs now. Keeping up with the standard is our job — forever.

What we got is the other column on this slide. You can do the math.

One more thing, owed to this community: open-sourcing GeonicDB is planned. No date today. But I am saying it from this stage, on the record.

Keep one sentence: we could leave the code because we never left the standard. Open standards make code replaceable — ours too, someday. Working together comes from the contract, not from any one codebase. You want both: open source, and open standards.

## ACT VI — The payoff 【13:17–14:12 / 55 s】 — Pillar c

**[SLIDE 13 — "What a semantic layer gives an agent." Four tight bullets. The inset map is visibly full by now.]**

Time to keep my promise. All talk long, that corner has been collecting your posts as checked, valid NGSI-LD entities. In a moment, an AI agent reads them. Here is what the semantic layer hands it.

Typed fields — the agent knows which field means what. Checked writes — wrong data fails right away, with a clear error. It never gets in. Remember the 588 silent nulls? This design blocks that failure. Relationships to follow — a graph to walk, not joins to invent. And one MCP endpoint — the agent finds the tools and the data models by itself.

Enough claiming. Let's query.

## ACT VII — Harvest: the agent reads the room 【14:12–17:44 / 212 s】 — Demo · Pillar c

**[⏱ CHECKPOINT B — you should be here at ~14:12. More than a minute late → skip the audience question AND use the two-question Close.]**

**[FALLBACK, say nothing unless needed: if the network or pipeline stalls for 15 seconds, switch to the pre-recorded demo video and narrate over it. On switching, say the honest line: "The venue network is fighting us — what follows is a recording of this same demo, made earlier. The database is still up: if your post fails to send, just try again." From that point, do not call the recorded output live: narrate the queries in past tense ("here it called…", "this is what it found"), drop the word "live" from the spoken lines below, and SKIP the audience question (Cue ⑧) — a recording cannot answer the room. Recast the two room-claims: "This is what this room looks like as a dataset" → "This is what a room like this one looks like as a dataset — recorded earlier"; in the meta-point (Slide 15), credit the recorded session's participants, not this room, and add: "Your own posts are in the same database — I will show them after the talk." Never debug on stage.]**

**[SLIDE 14 — DEMO CUE ④: map goes FULL SCREEN. Beat — let the full map land. This is the visual payoff of the whole talk. Then split-screen: map + Claude connected to the broker's /mcp endpoint.]**

This is what this room looks like as a dataset.

Now the agent. This is Claude, connected to GeonicDB's /mcp endpoint — the same live database your phones write to. Nobody taught it this API. It finds everything through the standard. Watch.

**[DEMO CUE ⑤ — Query 1. Type or trigger it; narrate what it DID, not just what it found. ~15 s wait.]**

First question: "How many posts are there — and how many are our seeds?"

It called the entities tool with a typed query. No scraping. No guessing.

**[DEMO CUE ⑥ — Query 2. The bundling. Origins and specialties are free text in mixed languages; the agent groups posts that mean the same thing and quotes the originals as evidence. Point at the map; read one or two quoted strings aloud. The agent will note, by itself, that it was given no dictionary — let that line land; do not talk over it. ~20 s wait + reading.]**

Second: "These posts mix Japanese, English, and more. Which ones mean the same thing? Group them. Quote your evidence."

**[DEMO CUE ⑦ — Query 3. The digest. Read it aloud, slowly. This is the promise from minute two, kept. ~15 s wait.]**

Third: "In three sentences — who is in this room?"

**[DEMO CUE ⑧ — OPTIONAL audience question (~45 s). SKIP this block if behind schedule — this is the planned cut. If no question comes, use the spare: "Which hometown appears most often, and what is it famous for?" Repeat the question clearly into the mic before passing it to the agent.]**

A live dataset deserves a live question. Someone shout one. Ask this data anything.

**[SLIDE 15 — The meta-point. One sentence, full screen.]**

Let me tell you what you just saw — because it was not an AI demo.

The strangers in this room just made a dataset that fits together — in twenty minutes, with no meeting about schema. The standard held that meeting for you.

No working group. No data dictionary. No integration project. You answered two questions. The contract did the rest. And an agent that has never met you used your data right, on the first try. That is what open data alone cannot do — and open standards can.

## ACT VIII — Close: three questions 【17:44–19:11 / 87 s】

**[SLIDE 16 — Three questions, on screen while spoken. Then the final line alone.]**

I will end with homework for us as a community — questions no vendor should answer alone.

One. Should the official test suite — not the reference software — be the main thing a standards community maintains? Those 1,033 tests told you more than any feature list. What if that layer were the commons?

Two. What is the NGSI-LD and OGC story when agents trade data with agents? When no human is in the loop, who owns the meaning?

Three. Open data policy took ten years to win. What would an "open meaning" policy for public data look like — and who should write it?

The map behind me stays up. Your posts are real entities in a real database. They will still be there when you walk out — still answering queries.

Open your data — yes, always. Then open its meaning.

Thank you. I have five minutes for your questions — including the hard ones.

### ALTERNATE CLOSE — two questions 【67 s spoken + 5 s beat = ~72 s · use when Checkpoint B says so】

**[Same slide, questions 1 and 3 only. Question 2 (agent-to-agent semantics) is the cut: it is the most specialized of the three, and question 1 already opens the standards-community thread for Q&A.]**

I will end with homework — not for you alone, but for us as a community.

One. Should the official test suite — not the reference software — be the main thing a standards community maintains? Those 1,033 tests told you more than any feature list. What if that layer were the commons?

Two. Open data policy took ten years to win. What would an "open meaning" policy for public data look like — and who should write it?

The map stays up. Your posts are real entities in a real database. They will still be there when you walk out of this hall.

Open your data — yes, always. Then open its meaning.

Thank you. I have five minutes for your questions — including the hard ones.

---

## Speaker's pocket card — the ETSI measurement (NOT spoken; keep at hand for Q&A)

Full Q&A preparation lives in the anticipated-questions document (subtask_752d). This card covers only the measurement facts behind Slide 12.

- **What**: ETSI GS CIM 009 (NGSI-LD) official conformance test suite, **V1.9.1 target, 1,033 tests**, pinned to a fixed suite revision so runs are repeatable.
- **Scores (as shown on the livedeck slide)**: GeonicDB **84.2 % (870/1033)** · Stellio 51.6 % · Scorpio 36.5 % · Orion-LD 24.6 %. Self-measured, four brokers, same conditions. Measured 2026-08-28, **GeonicDB v0.17.0**.
- **Broker versions measured**: Orion-LD **1.9.0**; Stellio and Scorpio at their official "plug-test-latest" images; each broker on a fresh, empty database; identical suite commit; the suite's @context served from a pinned snapshot so no run depends on an external server that day.
- **Honest caveats — say these BEFORE anyone asks**:
  - GeonicDB ran with authentication disabled (its documented local-development mode) because the ETSI suite is unauthenticated. Not a patched build.
  - **Why is Orion-LD low?** The suite targets the newest spec revision (V1.9.1). Orion-LD 1.9.0 predates much of it, and entire classes it has not implemented (temporal, geo-queries in this suite's form) score zero. A large part of its result is also errored runs, not clean failures. The number says "distance from V1.9.1 as this suite measures it" — it does not say Orion-LD is bad software.
  - **"84.2 % means 15.8 % is missing — what is missing?"** True, and we know the list: mostly distributed operations (federation across brokers) and parts of context-source registration and temporal. We publish the failing test IDs internally and fix from that list.
  - v0.18.0 has since shipped with breaking changes; the spoken line "against our version 0.17" keeps the claim honest. Do not present the number as current-version.
- If pressed beyond this card: "That's a good question. The full run logs exist. Talk to me after — I'll show you."
