# Retrench — NEW.md

> Draft replacement for `README.md`. Records the agent-first reframe of the Retrench idea, the
> verified feasibility of the three hackathon integrations, and the 48-hour build plan.
> Nothing here changes the product thesis: AI features as P&Ls, with a keep-or-kill line.

---

## Table of contents

- [The one-line version](#the-one-line-version)
- [Problem](#problem)
- [Product idea](#product-idea)
- [Unit economics](#unit-economics)
- [Worked example](#worked-example-checkout-recovery)
- [The agent: The Margin Reconciler](#the-agent-the-margin-reconciler)
- [Why this scores](#why-this-scores)
- [Evidence checklist](#evidence-checklist)
- [Integration feasibility](#integration-feasibility-verified)
- [Corrections to the earlier README](#corrections-to-the-earlier-readme)
- [Build order](#build-order)
- [Team split](#team-split)
- [Demo script](#demo-script)
- [Cut line](#cut-line)
- [Risks](#risks)
- [Resources](#resources)

---

## The one-line version

**The agent owns one goal: keep every AI feature above its margin line.**

Given that goal plus a set of tools, an agent decides on its own which features to examine, whether a
drop is real, whether to investigate or skip, what to do about it, and when it is done. The feature
portfolio view is not a dashboard a human browses — it is the **output artifact** the agent writes at
the end of its run.

The money thesis, the three integrations, and the keep-or-kill decision model are unchanged.

---

## Problem

Companies ship many agent-powered features (checkout recovery, support refunds, onboarding copilots).
Today those teams use disconnected tools:

- Observability shows failures and token spend, not contribution margin.
- Coding agents change prompts and tools daily, with weak links to prod regressions.
- Finance models know runway and COGS, but not *which AI feature* burned the week.

The recurring unanswered question:

> **Which AI features make money this week, which ones stopped, what commit/session caused it, and should we fix, pause, or kill?**

---

## Product idea

**Retrench treats every AI feature as a live P&L and draws the keep-or-kill line when unit economics vary.**

- Runtime truth from **neatlogs**
- Change causation from **Entire**
- Money truth from **cfo.ai (Ari)**

### Unit of analysis: Feature

A **Feature** is a product surface backed by one or more production agents.

| Feature | Production agent(s) |
| --- | --- |
| Checkout Recovery | `checkout_agent` |
| Support Refunds | `support_triage` → `refund_agent` |
| Onboarding Copilot | `onboarding_copilot` |

Each feature tracks volume, cost, failure tax, contribution, and change lineage.

### Why the agent is the product

The earlier draft described a UI with five agents behind it. That reads to a judge as "an
observability dashboard with agents inside it," and 30% of the hackathon score is on *the agent*.

The fix is structural, not cosmetic: one agent owns the goal and runs the loop. The screens become
the three-chapter report the agent produces:

1. **Runtime (neatlogs)** — success rate, cost/success, open incidents, evidence spans
2. **Change (Entire)** — commit, coding session, files/prompts touched
3. **Money (cfo.ai)** — contribution, OpEx, failure tax, scenarios

---

## Unit economics

```text
Contribution_F     = Successes_F × Value_per_success_F
Agent_OpEx_F       = Σ (tokens + tools + infra attributed to F)
Failure_Tax_F      = Failures_F × Cost_per_failure_F
                    + Credits / chargebacks attributed to F
Net_Feature_Margin = Contribution_F − Agent_OpEx_F − Failure_Tax_F
```

- `Successes`, `Failures`, `Agent_OpEx` ← **neatlogs**
- `Value_per_success`, `Cost_per_failure`, scenarios ← **cfo.ai**
- Margin cliffs → causal `commit` / session ← **Entire**

---

## Worked example: Checkout Recovery

### Assumptions in cfo.ai

| Assumption | Value |
| --- | --- |
| AOV | $85 |
| Gross margin on recovered order | 42% → ~$35.70 contribution / success |
| Target cost / success | < $0.80 |
| Expected cost of failed recovery | ~$12 |

### Healthy week

| Metric (neatlogs) | Value |
| --- | --- |
| Attempts | 4,200 |
| Success rate | 85% |
| Cost / success | $0.61 |

Ari: Net Feature Margin ≈ **$117k** for the week. Entire: last change Aug 20 (added retries) — stable.

### Regression (v2.8)

A coding agent removes retries on `create_checkout`.

| Source | Signal |
| --- | --- |
| Entire | Commit `a1b2c3`, session "remove checkout retries" |
| neatlogs | Success 85% → 62%; cost/success $0.61 → $1.40; ISS-284 (218 failing runs) |
| cfo.ai | ~$5k/day lost contribution vs expected |

### Resolution path

1. The agent detects the cliff from neatlogs analytics.
2. It attributes the cliff to a commit and session via Entire.
3. It prices the options in cfo.ai and decides.
4. It dispatches a fix brief to a coding agent.
5. It verifies the recovery and reports.

---

## The agent: The Margin Reconciler

### Goal

Given to the agent, not scripted:

> *"Every AI feature stays above its margin line. When one drops, find out why, restore it, and prove the recovery."*

The agent decides which feature to examine, whether a drop is real, whether to investigate or skip,
what action to take, and when the goal is met.

### Tools it owns

| Tool | Backing call |
| --- | --- |
| `nl_kpis(feature, window)` | `POST /api/v1/public/analytics/kpis` — attempts, successes, cost, tokens |
| `nl_cost(feature, window)` | `POST /api/v1/public/analytics/cost` — cost/success, per-tool cost, waste |
| `nl_failures(feature, window)` | `POST /analytics/errors` + `/analytics/detections` — failure classes |
| `nl_evidence(trace_id)` | `/traces` — the critical spans only, never whole traces |
| `what_changed(feature, since)` | `entire checkpoint explain <id> --json`, `entire why file:line` |
| `price_action(feature, action)` | cfo.ai MCP — write Scenario, return $ delta |
| `dispatch_fix(brief)` | neatlogs coding tools — hands the brief to a coding agent |
| `verify(feature)` | re-pull `nl_kpis`, compare against baseline |

### The loop

Every step emits a span, so a full run is inspectable as a single trace.

```text
triage                pick features, baseline economics
        ↓
detect cliff          a feature below its margin line or regressing vs its 7d baseline
        ↓
investigate runtime   failure class + critical evidence spans (neatlogs)
        ↓
attribute change      commit + session + files/prompts touched (Entire)
        ↓
price                 $ lost/day, and $ delta for each option (cfo.ai)
        ↓
decide                keep broken / fix / pause — reasoning written to state
        ↓
dispatch fix          brief → coding agent → patch → new Entire checkpoint
        ↓
verify                compare pre/post metrics + trace diff
        ↓
report                three-chapter brief in plain English
```

This covers all eight focus areas the hackathon scores: planning, tool use, state, context,
execution, recovery, verification, iteration.

### State

A per-feature `investigation record` (SQLite) is what makes this an agent rather than a script:

```text
feature_id, baseline snapshot, cliff detected, hypotheses tried,
tool failures, dispatch id, verification result, decision history
```

The agent reads and writes it, and resumes across runs — which is the "retain state across steps,
runs and failures" requirement.

### Recovery

Deliberately build and demo one failure path — "a run where an action failed, showing what the agent
did next" is a scored evidence item.

| Failure | Fallback |
| --- | --- |
| neatlogs 429 (60 req/min hard limit) | Backoff, fall back to cached analytics rows |
| Entire finds no checkpoint in the window | Widen the window, fall back to `entire blame` |
| cfo.ai write fails | `dry_run` first, then retry |
| Dispatched fix moves no metrics | Re-enter investigate with a new hypothesis (iteration) |

### Verification

Re-pull `nl_kpis` and compare pre/post. Only mark resolved when success rate and cost/success land
inside tolerance of baseline. Record actual vs expected in cfo.ai.

---

## Why this scores

| Criterion | Weight | How it lands |
| --- | --- | --- |
| The agent | 30% | Goal-owned loop with state, recovery, self-verification — not a UI |
| Use of neatlogs, Entire, cfo.ai | 25% | A genuine role for each, plus the mandated business plan |
| Demo video | 20% | Break it → agent finds it → agent prices it → agent fixes it → agent proves it |
| Building in public | 15% | "AI features as a portfolio of P&Ls" posts well |
| Usefulness and originality | 10% | Feature-level P&L with commit causation does not exist yet |

---

## Evidence checklist

| Required evidence | Artifact |
| --- | --- |
| The agent improved: a run before and after, with numbers compared | Instrument the agent itself (`agent_name="margin_agent"`). v1 run with visible flaws → fix → v2 run. Ship a table of spans/tokens/cost/latency/success |
| You used neatlogs | checkout_agent traces + the agent's own traces + analytics responses |
| You used Entire | `entire checkpoint explain` for the breaking commit **and** the fix commit |
| You used cfo.ai | The Margin Model (Variables + Scenarios) **and** your own pricing/costs/revenue/runway plan |
| The agent recovers from failures | The deliberate fallback trace |
| You built in public | `#neatHack` posts across Oct 10–12 |
| Code written during the hackathon | Public repo, commits dated Oct 10–12 |

---

## Integration feasibility (verified)

**neatlogs — green.** Everything assumed exists, and better than assumed:

- Public API: **285 operations**, base `https://app.neatlogs.com/api/v1/public`, service-account
  bearer token + `x-project-id` header, OpenAPI JSON downloadable for client generation
- **Analytics**: `kpis`, `cost`, `errors`, `detections`, `waste`, `time`, `tools`, `facets`,
  `chart`, `export` — the "attempts, successes, cost per success, failure classes" rollups, per feature
- **Webhooks (9 ops)** and **Alert Rules (8 ops)** with a test-fire endpoint — incident detection
  becomes event-driven, not polling
- **Traces (25 ops)** and **Coding Tools (5 ops)** for the fix-brief handoff
- **MCP server** at `https://ingest.neatlogs.com/mcp`, Streamable HTTP, project API key as bearer.
  Tools: `ping`, `whoami`, `search_traces`, `get_trace_context`, `list_detections`,
  `get_detection_trend`, `log_trace`, `triage_list`, `triage_get`, `triage_accept`,
  `triage_dismiss`, `triage_update_status`, `triage_update`, `triage_get_investigation`,
  `triage_list_steps`
- Python SDK: `pip install -U neatlogs` then `neatlogs.init()`; `npx @neatlogs/wizard` auto-instruments
  and wires the MCP server into Claude Code / Cursor
- **Rate limit: 60 requests/minute per API key, shared across all sessions.** This is the one hard
  constraint — use webhooks for the watch trigger, never poll.

Scope saver: neatlogs already ships Investigations, fixes/triage, and post-fix verification.
Retrench should **orchestrate** them, not reimplement the rollup, incident, or fix layer.

**Entire — green, with one design note.** Everything needed exists:

- Checkpoints are git refs: `refs/entire/checkpoints/<shard>/<id>`, each linked to its commit by an
  `Entire-Checkpoint: <id>` trailer
- Commands: `entire checkpoint list`, `entire checkpoint explain <id>`, `entire checkpoint search`,
  `entire search`, `entire blame <file>`, `entire why file:line`, `entire status --json`,
  `entire session list/info/current`, `entire activity`, `entire api`
- Plugin system: any `entire-<name>` executable on `$PATH` runs as `entire <name>`, kubectl-style
- Headless auth: `ENTIRE_TOKEN` for CI, `ENTIRE_TOKEN_STORE=file` for keyring-less machines

Design note: the causation join is **not** a bespoke query API. It is reading those refs via git, or
calling the control plane through `entire api`. Judge evidence is directly satisfiable with
`entire checkpoint explain <id>` output.

Caveat: session transcripts live in your repo's refs, so a public repo makes them public. Entire
redacts secrets, but best-effort — sanitize anything you link to.

**cfo.ai — amber.** The concepts are right; the tool names in the earlier README are wrong.

cfo.ai is Ari: a natural-language model builder over **Models, Variables, Dimensions, Scenarios,
formulas, Pages**. The real programmatic surface:

- **cfo.ai MCP server** — for Claude Code, Codex, or any MCP client, with workspace selection
- A documented **agent formula toolset** — read and explain saved formulas, evaluate without saving,
  and **`edit_table_blocks`** with `dry_run` preview and write verification
- **Scenarios** — Main plus editable branches with inheritance and comparison; this is what
  "keep broken / fix / pause" actually maps to
- **Pages** — shareable read-only links, which is how judges will verify cfo.ai usage
- **Skills** and **Triggers** — saved repeatable workflows and scheduled unattended runs

Confirm the exact MCP tool list at connect time in Phase 0.

---

## Corrections to the earlier README

1. **cfo.ai MCP tool names.** The earlier draft assumed `inspect_*` and `edit_scenarios`. Those do
   not exist. The real surface is formula agent tools plus `edit_table_blocks` (with `dry_run`),
   Scenarios, and Pages. Left uncorrected this would have broken the build.
2. **cfo.ai has a second, mandated role.** The hackathon requires cfo.ai to plan *the agent's own
   business* — pricing, costs, revenue, runway — and that business plan must be in the submission.
   The earlier draft used cfo.ai only as the product's "money truth." Do both.
3. **Dashboard → agent.** The earlier draft's center of gravity was a UI with five agents behind it.
   The track scores a goal-owning agent at 30%. One loop, one record, one report artifact.
4. **neatlogs rollups are read, not built.** Analytics, webhooks, detections and triage already
   exist. The earlier draft described building rollup jobs and incident opening inside Retrench.

---

## Build order

Priority-ordered so a partial build still demos.

### Phase 0 — Blockers (~2h)

Do this before writing any agent code.

- **LLM API keys — the #1 risk.** The AWS allowance explicitly does *not* cover model APIs. Use your
  own OpenAI/Anthropic keys, billed separately.
- neatlogs: create a project, `neatlogs.init()` on `checkout_agent`, confirm a trace lands
- Entire: `entire enable --agent claude-code`, one commit via your coding agent, confirm
  `entire checkpoint explain <id>` prints a checkpoint
- cfo.ai: sign up at cfo.ai/neathacks, cancel billing immediately, **build the Margin Model by hand
  with Ari first** (Variables: AOV, margin %, cost/success, cost/failure, retries enabled; Scenarios:
  Keep broken / Fix / Pause), then confirm the MCP server connects from Claude Code
- Public repo with `hackathon.md` build log at the root

### Phase 1 — Loop end-to-end, dumb (~8h)

Feature registry (one feature: Checkout Recovery), SQLite investigation record, orchestrator loop
with three tools (`nl_kpis`, `nl_cost`, `what_changed`). Self-instrument the agent in neatlogs — this
is what later produces the required before/after traces. Get one full no-op run traced end to end.

### Phase 2 — Money + action (~8h)

cfo.ai scenario read/write. Induce the regression: coding agent removes retries → new Entire
checkpoint → agent detects, attributes, prices. Then `dispatch_fix` → fix commit → second checkpoint.

### Phase 3 — Verify, recover, polish (~6h)

Verification step, the deliberate failure/fallback demo, the agent's own before/after improvement
table, record the three-minute video. Post `#neatHack` updates throughout.

### Suggested stack

| Layer | Choice |
| --- | --- |
| Agent | Python orchestrator loop, LLM tool-calling (OpenAI/Anthropic) |
| SDKs | neatlogs Python SDK; cfo.ai MCP; Entire CLI as a subprocess |
| State | SQLite |
| UI | None — the three-chapter report is a generated artifact |
| Deploy | Optional. Not required for judging. If used: us-east-1, Hackathon_VPC, one EC2 (t2/t3/t3a, nano–large, EBS ≤ 50 GB), Lambda/IAM/ALB only, within $25 |

---

## Team split

| Role | Owns |
| --- | --- |
| A | Orchestrator loop, state, recovery |
| B | neatlogs integration (analytics, traces, coding tools) + agent self-instrumentation |
| C | Entire + cfo.ai integrations |
| D | Regression injection, demo script, video, `#neatHack` posts |

Scale down if fewer people — A is non-negotiable.

---

## Demo script

1. **Setup** — the healthy Checkout Recovery card; show the cfo.ai Margin Model
2. **Break it** — a coding agent removes retries; a new Entire checkpoint lands
3. **The agent runs** — pulls neatlogs, sees the cliff, asks Entire, prices the drop in cfo.ai
4. **The agent acts** — dispatches a fix brief; the coding agent applies it; second checkpoint
5. **The agent proves it** — success rate and cost/success recover; margin returns to baseline
6. **The receipt** — the before/after table for the agent itself, from its own traces

---

## Cut line

If time runs out, drop `dispatch_fix` and the cfo.ai write. Keep
detect → investigate → attribute → price → report.

That still demos a working agent. A broken auto-fix demo is worse than no auto-fix.

---

## Risks

| Risk | Mitigation |
| --- | --- |
| LLM API keys unavailable | Blocker. Own them, not AWS. Resolve in Phase 0 |
| cfo.ai MCP tool names unverified | Confirm in Phase 0; fallback to the Ari-built model + shared Pages, agent writes via `edit_table_blocks` + `dry_run` |
| neatlogs 60 req/min | Webhooks for the watch trigger; never poll |
| Entire transcripts in a public repo | Secret redaction is best-effort; keep checkpoints in the repo but sanitize linked evidence |
| 48h scope overrun | The cut line above |

---

## Resources

**Hackathon:** [hackathon page](https://neatlogs.com/hackathon) ·
[Luma registration](https://luma.com/s5blr882) · [Discord](https://neatlogs.com/discord) ·
[web check-in](https://neatlogs.com/hackathon/check-in) ·
[AWS check-in](https://neatlogs.com/hackathon/check-in/aws) ·
[build companion skill](https://neatlogs.com/hackathon/skill) ·
[manifesto](https://neatlogs.com/manifesto)

**neatlogs:** [docs](https://docs.neatlogs.com) · [SDKs](https://docs.neatlogs.com/sdk) ·
[Public API](https://docs.neatlogs.com/api-reference) ·
[MCP tools reference](https://docs.neatlogs.com/integrations/mcp-tools) ·
[CLI](https://docs.neatlogs.com/cli) · [GitHub](https://github.com/NeatLogs/neatlogs) ·
`npx @neatlogs/wizard`

**Entire:** [site](https://entire.io) · [CLI (MIT)](https://github.com/entireio/cli) ·
`curl -fsSL https://entire.io/install.sh | bash` · supports Claude Code, Codex, Cursor, Copilot,
Gemini, OpenCode

**cfo.ai:** [site](https://cfo.ai) · [neathacks signup](https://cfo.ai/neathacks) ·
[docs](https://docs.cfo.ai)

**Credits:** AWS $25 per team (first 350 check-ins; EC2/Lambda/IAM/ALB in us-east-1 only, no Bedrock —
use your own OpenAI/Anthropic keys) · Crustdata 5,000 credits for everyone · Dodo Payments credits
for the top three ($5,000 / $3,000 / $1,000).

**Deadline:** submit on X by quoting the official neatlogs post, Oct 12, 7:00–11:55 PM IST. Demo
video ≤ 3 minutes, public repo, all three tools covered explicitly.
