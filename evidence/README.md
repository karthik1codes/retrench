# Evidence (neatHack judging)

Store here:

1. **Entire checkpoint IDs** — before/after for ≥2 improvements driven by neatlogs eval failures  
2. Screenshots of neatlogs evals (hallucination, trigger-precision, draft-quality)  
3. Sample digest markdown from a live EC2 run  

## Entire workflow

```bash
entire enable --agent cursor
# after each milestone commit:
git add -A && git commit -m "..."
entire checkpoint   # if your CLI uses this — follow current Entire docs
```

Record IDs in `evidence/checkpoints.json`.
