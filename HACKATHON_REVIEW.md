# Signal Scout — Hackathon Review (neatlogs.com/hackathon)

> Shallow pass only. Focus: does this win / demo well, what's missing, what to steal from LangChain's GTM agent.

## 1. Verdict

Good hackathon shape. It's a real autonomous agent, not a wrapper:

`segment.yaml` → Signal (CrustData + graph diff) → Research (qualify/archive) → Draft (CITES evidence only, never sends) → Watchlist digest. State in Neo4j with crash-resume, credit budget enforced, dry-run with zero API.

That maps directly to what neatHack rewards: Planning, Tool use, State, Execution, Recovery, Verification, Iteration. Plus you nominally touch all 3 required tools + CrustData.

Biggest risk is not code, it's **proof**. Judging is ~60% tools + demo video + building in public:
- Agent end-to-end 30%
- neatlogs + Entire + cfo.ai 25%
- Demo video ≤3min (must cover all 3 tools) 20%
- Building in public 15%
- Usefulness/originality 10%

Right now you'd lose points on the middle 45%: traces exist but no before/after links in README, Entire is only `checkpoints.json` (no `entire-graph` output), `cfo.ai` plan is a template with stub `cost_per_qualified_lead.json`, no failure-recovery run shown, no video script.

Fix proof before features.

## 2. What actually works

- **Single-file input:** `segment.yaml` is the only human input. Good story: "Series A-B fintech SaaS, 20-200, US" + 4 triggers.
- **Idempotent graph:** `MERGE` by `sig-{type}-{hash}`, `:Run / :Signal` checkpoint = kill mid-run → next timer resumes. Backoff on CrustData 429, run marked failed.
- **Safety by design:** draft-only, ≤90 words, `_strip_unknown_numbers`, `draft_cites_ok` else raise. `Draft-[:CITES]->Evidence<-[:EVIDENCED_BY]-Signal` is demo-gold in Neo4j.
- **Cost story:** `CreditLedger` (`X-Credits-Used`, 50/cycle budget, `:Run.credits_spent`) feeds directly into cfo.ai unit economics. Most teams won't have this.
- **Deployable:** `deploy/docker-compose.yml` (neo4j:5 + agent), `Dockerfile`, `systemd timer` hourly oneshot, `ssm_bootstrap.sh`, `iam-policy.json`. EC2 + Docker on instance is allowed (allowlist is EC2/Lambda/IAM/ALB).
- **UI exists:** Next.js ScoutStudio + `http_api.py` (`/health|/drafts|/overview|/targets|/watchlist`, `POST /scout|/contacts`) with token auth. Not mentioned in main README at all.

## 3. Errors / nits (shallow, not deep dive)

No missing imports (`boto3/neatlogs/openrouter` are lazy, `graph_memory` shim covers direct `graph._driver.session()` use). No TODOs. Issues are disclosure / small divergences:

- `targets_payload` selects `c.updated_at` which `merge_company` never sets → always null in UI.
- `watchlist_payload(days)` ignores `days` arg.
- Memory shim appends `| Why it matters:` to `summary`, real Neo4j sets `s.implication` property. UI handles both (`implication || extract`) but it's tech debt.
- Research caps on `processed`, not `qualified` → 5 noisy signals can starve good ones.
- CrustData title filter `type: "(.)"` is non-standard — verify against docs, may silently not filter.
- `tech_change` trigger `enabled: false` but still in config/schema — dead path in demo.
- `scout_one.py` forces `is_new_funding / force_scout_signal` + synthetic `profile severity 78` to guarantee a draft. Great for demo, inflates qualified count — must disclose or judges call it fake.
- Web `DEMO_SIGNALS / demoScout / demoContacts / demoDrafts` when `SCOUT_AGENT_URL` unset or `SCOUT_FALLBACK_DEMO=1`. If you demo with fallback on, say so.
- `/person/contact/enrich` 403 → fallback to `/person/enrich(business_emails)`, `verified` arg ignored. Real limitation, document it.
- `credits/.gitkeep` empty, `evidence/` only `README + checkpoints.json` — expected pre-live-run, but looks empty to judges.

None of these break the run. The Demo-fallback + synthetic-signal ones matter because they affect trust.

## 4. README — what's missing

Main `README.md` is decent for backend, missing for judging:

- **Web path absent:** no `npm run dev`, no `SCOUT_AGENT_URL / SCOUT_TOKEN / SCOUT_FALLBACK_DEMO` env table, `web/README.md` is still default `create-next-app` boilerplate. Fix this first — judges will open web/.
- **Quickstart confusing:** mixes `set` (cmd) + `$env:` (PowerShell) + `source` (bash) in one block, no `cp .env.example .env.local` step. Give one bash path + one PowerShell path.
- **No live vs demo table:** explain `NEO4J_URI=memory` (tests) vs `bolt://...` (live) vs `SCOUT_FALLBACK_DEMO=1` (UI fake). Right now a reviewer can't tell what's real.
- **No proof links:** placeholders needed for neatlogs trace links (before/after), `entire-graph` output, cfo.ai share link, EC2 cycle log. Even empty `| Metric | Link |` table signals you know the rubric.
- **No submission checklist:** map Acceptance Tests → judging rubric + 5-min demo script already there is good, but add 3-min video shot list (0:00 pain, 0:30 segment.yaml, 1:00 live cycle, 1:40 traces, 2:00 Entire before/after, 2:20 cfo.ai, 2:45 graph CITES).
- **No limitations section:** list 403 contact enrich, stub cost JSON, synthetic scout signal, tech_change disabled. Judges trust this more than perfect claims.
- **No build-in-public / troubleshooting:** no `#neatHack` X post guidance, no `pytest -q`, `docker logs`, `journalctl -u signal-scout` help.

## 5. How good for this hackathon?

| Rubric | Score feeling | Why |
|---|---|---|
| End-to-end 30% | Strong | True multi-agent cycle with state, recovery, budget guard. Better than CRUD wrappers. |
| Tools 25% | Medium-weak today | Uses all 3 on paper, but Entire = checkpoints only, cfo.ai = template, traces = no links. Easy to fix to Strong. |
| Demo 20% | Medium | 5-min script in README is good, CITES graph visual is memorable. Needs 3-min cut + live EC2 recording. |
| Public 15% | Unknown | No evidence in repo. Need X thread + dated commits. |
| Useful/original 10% | Strong | "Only acts on real + this week, never sends" is a clear wedge vs spammy sequencers. |

If you add proof links + fix web README + record one live cycle with a kill-restart, this is top-third material without new features.

## 6. LangChain GTM agent — difference, what to steal?

Source: https://www.langchain.com/blog/how-we-built-langchains-gtm-agent

**What they built:**
Inbound (Salesforce lead → CRM + Gong + LinkedIn + Exa → relationship-aware draft) + weekly account intelligence (usage from BigQuery + web + hiring + news → expansion / exec moves / install spikes) + engineer view (burn, renewals, support threads). Verification first (`do-not-send` if open ticket or touched that week). Rule assertions + LLM-judge + mocked-API CI. Human-in-loop in Slack (Send/Edit/Cancel, reasoning + sources shown, 48h SLA auto-nudge for silver leads). Every rep edit → LLM extracts style observation → Postgres per-rep memory → loaded pre-draft. Deep Agents virtual FS + compiled subagents, LangSmith deploy. Result: +250% lead-to-opp, 40h/mo/rep.

**You vs them:**
- Sources: them 8+ (CRM, product usage, calls, web, hiring, funding). You 1 (CrustData). Leaner, cheaper, fits 5k credit budget — advantage for hackathon.
- Unit: them Account (roll up signals → health/risk + who to contact). You Signal (per-event email). Their view sells to managers.
- Trust: them suppression + relationship branch (customer/warm/cold). You single cold template, no suppression. Biggest gap.
- Loop: them HITL + edit-learning + evals-first. You draft-only, no approval, no learning, 3 unit tests only.
- Infra: them Slack + Postgres + LangSmith scale. You Next.js + Neo4j + timer. Don't copy — overkill for time/credits.

**Steal only these 3 (rest not needed):**

1. **`do-not-contact` guard (highest ROI).** Before draft, check Neo4j for prior `Draft` for same company ≤7d + stub `support_risk` flag. Suppress with reason `suppressed: recent_touch`. 20 lines, biggest trust win with judges. Directly answers "agent that works without spamming."
2. **Explainable draft in UI.** You already have `CITES` in graph — just surface it. Show draft + `Why now` (signal) + cited facts + cost alongside Approve/Edit/Reject. Log action to neatlogs as eval signal. Turns existing UI into HITL without Slack.
3. **Golden eval set (5 cases).** `funding / surge / exec-hire / duplicate / stale` + rule check (right order, no dupes, cites present) + LLM-judge (tone/length). Run in CI with mocked APIs. Gives you before/after traces to show — direct judging points for Verification/Iteration.

**Explicitly skip:** Salesforce/Gong/BigQuery connectors, per-rep Postgres memory, Slack bot, auto-send SLA, Deep Agents FS. They cost weeks + credits and hurt your "runs cheap on timer" story. Mention as "out of scope, guard + evals cover trust" in README.

## 7. Next 3 moves (in order)

1. Proof (2h): fill trace/Entire/cfo link table, fix `web/README`, record kill-restart + `--dry-run` log, disclose demo fallback + synthetic signal.
2. Guard + HITL (half day): suppression check → Approve/Edit UI → log to neatlogs.
3. Evals (half day): 5 golden cases + `pytest` judge. Show before/after trace diff in video.

Do those and you cover the 45% you're currently leaving on the table without changing architecture.
