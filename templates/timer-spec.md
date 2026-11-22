# Timer spec: `<Job>`

| Field | Value |
|---|---|
| Module / folder | `<Concept>_Sync` / `Timers` (Core) |
| Timer / action | `<Job>` / `Timer_<Job>` |
| Purpose | |
| Schedule | e.g. every 15 min / daily 02:00 (staggered from: …) |
| Expected volume per run | |
| Platform timeout (min) | 20 (default) |
| Logical timeout (min) | `<Job>MaxMinutes` = 10 |
| Batch size | `<Job>BatchSize` = 200 |
| Kill switch | `<Job>IsEnabled` |
| Checkpoint | `<Job>Checkpoint` entity: last id / timestamp / page |
| Commit | after each batch |
| Re-wake | `Wake<Job>` when the logical timeout is reached with work left |
| Per-record status | Pending → Processing → Done / Failed (Attempts, NextAttemptOn) → DeadLetter after N |
| Idempotency strategy | upsert by external id / status check / idempotency key |
| Actor for audit columns | `SYSTEM:<Job>` |
| Run log | `<Job>Run`: start, end, status, processed, failed, skipped |
| Monitoring / alert | who is alerted, when |
| Per-environment settings (deployment notes, OPS-05) | |
| Retention / purge of its own data | |

## Verification
- [ ] Empty run · [ ] normal run · [ ] run longer than the logical timeout re-wakes and resumes · [ ] a failing record doesn't stop the batch · [ ] rerun after failure doesn't duplicate work · [ ] kill switch stops it


## Evidence and acceptance

- Platform/app type, installed versions/theme where relevant, target environment:
- Existing project decisions and authorized delivery scope:
- Requirement → element/contract → source of data → verification evidence:
- Concurrency, retry/unknown outcome, authorization and failure cases relevant to this change:
- Delivery status: prepared / model validated / merged / published / runtime verified (record only observed stages):
- Not tested, missing dependency or blocked evidence, and the exact next step:
