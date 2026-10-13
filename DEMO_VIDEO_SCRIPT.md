# Signal Scout — Demo Video Script (≈4:00)

**Target length:** 3:45–4:15  
**Tone:** problem → agents → proof tools → business → close  
**On screen:** prefer live Scout + one pre-recorded EC2 cycle if network is flaky  
**Disclose once if needed:** demo fallback / synthetic profile signal / Testing OAuth

---

## Shot list (quick)

| Time | Beat | On screen |
| --- | --- | --- |
| 0:00–0:20 | You + thanks + product | Face / name → landing + stack |
| 0:20–0:55 | Problem (tools gap) | Pain slide → tool voids |
| 0:55–1:25 | Solution + agents | `segment.yaml` → architecture → Scout run |
| 1:25–1:55 | Focus areas | neatHack 8 cards + map each to Signal Scout |
| 1:55–2:25 | CrustData + Neo4j | Scout profile / Neo4j CITES |
| 2:25–2:55 | neatlogs | Cycle spans + HITL |
| 2:55–3:25 | Entire + cfo.ai | Checkpoints + Ari cash / tiers |
| 3:25–4:00 | Effect + conclusion | HITL send / follow-ups → close |

---

## Full spoken script

### 0:00–0:20 — You + thanks + crisp product line

**[Screen: you on camera (or name slate) → cut to landing with stack strip: CrustData · neatlogs · Entire · cfo.ai]**

> Hi, I’m **[Your name]** — builder of **Signal Scout** for neatHack.
>
> Huge thanks to **neatlogs**, **cfo.ai**, **Entire**, and **CrustData** for the stack that made this agent real — not just a demo wrapper.
>
> **Signal Scout:** real company triggers, evidence-backed drafts, you send.

*(Half-beat. Cut to problem.)*

**Shorter alt (if tight on time, ~12s):**

> I’m **[Your name]**. This is **Signal Scout** for neatHack.  
> Thanks to **CrustData**, **neatlogs**, **Entire**, and **cfo.ai**.  
> Real triggers. Evidence drafts. You send.

---

### 0:12–0:55 — Problem statement (simple, detailed, tools lens)

**[Screen: “The gap” — five voids, or tab chaos → blank checklist]**

> **The problem is not “write better cold email.”**  
> The problem is outbound with **no reliable system** around it.
>
> Today a rep still does this by hand: CRM, call notes, LinkedIn, company site — about **fifteen minutes** before one line of copy. Teammates may have already reached out. Nobody has a shared “do not touch” memory. Roughly **thirty percent of B2B contacts go stale within a year**, so “personalization” often means last year’s funding round. Sequencers make it worse: they spray volume; they do not ask whether the trigger is **real and this week**.
>
> In tool terms, the stack is broken in five places:
>
> 1. **No live signal source** — without something like **CrustData**, the agent invents context or scrapes noise.  
> 2. **No durable memory** — without **Neo4j** (or equivalent state), a crash mid-run means lost work, duplicate drafts, and no proof a fact was evidenced.  
> 3. **No flight recorder** — without **neatlogs**, you cannot see which agent failed, retried, or burned tokens when a draft goes wrong.  
> 4. **No product iteration trail** — without **Entire**, agent coding sessions and git commits do not stay tied together for judges or the team.  
> 5. **No unit economics** — without **cfo.ai**, you cannot say whether credits-per-lead and EC2 cost fund a real Starter / Growth / Scale price.
>
> So the neatHack question is sharp: **Can we build an agent that only acts on material, this-week events — with evidence, crash-safe state, inspectable runs, and a cost model — and still keep a human before send?**

---

### 0:55–1:25 — Solution proposed + agents used

**[Screen: `segment.yaml` → README architecture diagram → Scout UI]**

> **Signal Scout** is our answer: a trigger-event GTM agent. The only human input is one file — `segment.yaml` — for example Series A–B fintech SaaS, twenty to two hundred employees, US, plus the triggers we care about: funding, hiring surges, exec hires.
>
> Behind that file, four agents run as a pipeline — not one giant prompt:
>
> 1. **Signal Agent** — pulls live company data, diffs against memory, creates signals and evidence.  
> 2. **Research Agent** — qualifies or archives so noise does not become outreach.  
> 3. **Draft Agent** — writes a short, evidence-backed draft and can **suppress** if we already touched the account or support risk is set.  
> 4. **Watchlist Agent** — turns the week into a digest of who to reach.
>
> The product UI lets a human **Approve, Edit, or Reject**, then open Gmail or optionally agent-send after approval. Digests and drafts only by default — **we do not silent-spam**. Follow-ups can queue as a plus-three-day bump and plus-seven-day close for human review.

**[Action: Run scout on a real domain → show draft + Why now]**

> Here is the interactive path: domain in, draft out, with the reason the signal mattered.

---

### 1:20–1:55 — Focus areas (neatHack)

**[Screen: neatHack “Focus areas” image — Planning → Iteration]**

> neatHack judges agents on eight focus areas. Here is how Signal Scout hits each one:

| Focus area | How we map it |
| --- | --- |
| **Planning** | Goal → Signal → Research → Draft → Watchlist checklist every cycle |
| **Tool use** | CrustData for market data; LLM for research/draft; Gmail only after HITL |
| **State** | Neo4j `:Run` / `:Signal` / companies / drafts — survives crash and resume |
| **Context** | Segment filters + this-week window; leave out stale noise |
| **Execution** | EC2 + systemd timer / API serve — long cycles finish unattended |
| **Recovery** | CrustData backoff on 429; failed run marked; next timer continues unfinished work |
| **Verification** | Draft must CITES evidence; golden pytest cases; human Approve/Edit/Reject |
| **Iteration** | neatlogs spans + HITL actions + Entire checkpoints improve the next loop |

> So this is not a chatbot wrapper. It is a planned, stateful, recoverable agent system with verification in the loop.

---

### 1:55–2:25 — CrustData + Neo4j

**[Screen: Scout company panel / CrustData-backed fields → Neo4j Browser if available]**

> **CrustData** is how we see the market. The Signal Agent calls CrustData for company profile, funding, headcount growth, and related people signals. Every material fact we keep is stored as evidence — the Draft Agent is only allowed to cite what was evidenced. That is how we stay inbox-safe and honest.
>
> **Neo4j** is the brain’s memory. Companies, signals, evidence, drafts, and runs live in a property graph. The relationship we care about for judges is:
>
> `(Draft)-[:CITES]->(Evidence)<-[:EVIDENCED_BY]-(Signal)`
>
> Idempotent merges mean killing a run mid-cycle does not duplicate the world — the next timer resumes. That is **State**, **Recovery**, and **Verification** in one place.

---

### 2:25–2:55 — Tracing every agent run with neatlogs

**[Screen: neatlogs dashboard — one cycle with research/draft spans]**

> **neatlogs** is our flight recorder. Every cycle opens a neatlogs session. Research and Draft LLM calls are agent spans — so we can see which agent ran, what it cost, and where retries or qualification calls piled up.
>
> When I Approve, Edit, or Reject a draft in Scout, we can log that as a HITL eval signal. That turns human taste into something we can inspect — not a black box.
>
> How we **trace errors** in practice: if a draft looks wrong or a cycle is expensive, we open the neatlogs run, find the agent span that failed or retried, fix the prompt, suppress rule, or budget — then compare the next trace. neatlogs does not replace Auth or DNS debugging; it answers: **what did each agent do, and what did it cost?**

---

### 2:55–3:25 — Entire (repo context) + cfo.ai (business)

**[Screen: Entire checkpoint list / `evidence/checkpoints.json` → cfo.ai plan + cash chart]**

> **Entire** keeps the **repo and agent work in the same story**. Cursor sessions checkpoint to commits. When we fix follow-ups, card layout, or Gmail token handling, Entire records before/after so judges see iteration — not a one-shot demo. We keep IDs in `evidence/checkpoints.json`. That is how we maintain project context across days of building.
>
> **cfo.ai** answers a different question: if the agent works, can the business? We took a measured cycle — for example about **four point six five CrustData credits for five qualified leads**, roughly **zero point nine three credits per lead** — plus about **thirty dollars a month EC2**, and modeled Starter, Growth, and Scale.
>
> Ari shows base revenue around seventy-five thousand over twelve months at about fifty-eight percent gross margin, an upside path, and a downside that cash-outs if operating cost stays high with weak acquisition. Sliders on CrustData dollars-per-credit and LLM dollars-per-draft show sensitivity — bumping draft cost by a cent meaningfully cuts closing cash. So autonomy is only valuable if unit economics survive.

---

### 3:25–4:00 — Effect of the tools + conclusion

**[Screen: Scout Approve → Sent / follow-ups → stack logos]**

> **Effect of using these tools together:**
>
> - **CrustData** — real triggers instead of scraped guesses  
> - **Neo4j** — durable memory, CITES proof, crash resume  
> - **neatlogs** — every agent run is inspectable and costed  
> - **Entire** — product improvements stay tied to commits and public iteration  
> - **cfo.ai** — pricing and runway grounded in measured credits, not vibes  
>
> Together they turn “an LLM that writes email” into a **GTM agent system**: planned pipeline, tool use with budgets, state across failures, verification before a human sends, and a business model that can say yes or no.
>
> **Conclusion:** Signal Scout only acts on events that are real and this week. It drafts with evidence, suppresses bad timing, runs on a timer with memory, and keeps a human in the loop. The neatHack stack is not decoration — CrustData feeds the eyes, Neo4j holds the brain, neatlogs watches every agent, Entire proves we iterated, and cfo.ai proves we can afford to keep running.
>
> Real triggers. Evidence-backed drafts. You send. That is Signal Scout.

---

## Optional B-roll lines (if you need to fill 10–15s)

- Kill mid-run / show next timer resume (Recovery).  
- `pytest tests/test_gtm_golden.py` green (Verification).  
- `python -m signalscout run --dry-run` (zero external API).  
- Follow-ups tab: +3d bump / +7d close after send.

---

## Honesty checklist (say once if true)

- [ ] Live EC2 agent reachable (not only `SCOUT_FALLBACK_DEMO`)  
- [ ] OAuth app still in Testing → test users only  
- [ ] cfo.ai CrustData $/credit still provisional until contract price locked  
- [ ] neatlogs shows agent/LLM spans — not every web auth error  

---

## One-card cue (print this)

```text
INTRO: Real triggers. Evidence drafts. You send.
PS: no CrustData / Neo4j / neatlogs / Entire / cfo → broken outbound
→ segment.yaml → 4 agents → 8 focus areas → HITL send
```

---

## Problem → tools (cheat sheet for you)

| Broken today | Missing capability | Tool that closes it |
| --- | --- | --- |
| Guessed / stale personalization | Live company triggers | **CrustData** |
| Lost runs, duplicate outreach | Crash-safe memory + CITES | **Neo4j** |
| “Why did the agent do that?” | Per-agent spans + cost | **neatlogs** |
| Demo looks one-shot | Session ↔ commit history | **Entire** |
| Cool agent, bankrupt unit cost | Credits/lead → pricing | **cfo.ai** |
