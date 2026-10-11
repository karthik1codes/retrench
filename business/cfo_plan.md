# Signal Scout — cfo.ai business plan (hackathon)

Ingest `business/cost_per_qualified_lead.json` (emitted each cycle from real neatlogs / CrustData credits) into cfo.ai (Ari).

## Unit economics (fill from live runs)

| Metric | Source |
| --- | --- |
| Cost / qualified lead (credits) | `cost_per_qualified_lead.json` |
| CrustData $ / credit | account pricing |
| EC2 t3.medium + EBS | AWS Cost Explorer / Budgets |
| S3 evidence storage | bucket metrics |

## Model

1. **Per-lead pricing** vs SaaS tiers (Starter / Growth / Scale)  
2. **Gross margin / lead** = price − (CrustData + LLM + infra allocated)  
3. **Break-even customers** at each tier  
4. **12-month revenue** at assumed conversion  
5. **Runway** including measured EC2/S3/CrustData from `/credits` + `/business`

## Autonomy note

Default is **draft only** — no send. Product sells the watchlist + drafts, not email spam.
