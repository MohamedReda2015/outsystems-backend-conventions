# Async processing: timers, BPT, outbox

Rules: `BAS-01` … `BAS-09`, `BER-08`. Builds on the architecture skill's `DAT-09` and its data-and-logic §8.

## Contents
1. Choosing the mechanism
2. The timer pattern
3. Per-record processing
4. Outbox
5. BPT and Light BPT
6. Operations: kill switch, run log, monitoring

## 1. Choosing the mechanism (`BAS-05`)
| Need | Use |
|---|---|
| Scheduled or batch work (nightly sync, purge, reminders) | **Timer** |
| React to each new/changed record, independently and in parallel | **Light BPT** (event-triggered process with one automatic activity) |
| Long-running workflow with human tasks, waits, timeouts | **BPT** process |
| Reliable external side effects after a business transaction | **Outbox entity + timer** |
| Work the user started but shouldn't wait for (export, bulk update) | Job entity (`Status`, `Progress`) + timer woken with `Wake<Timer>`; UI polls status |
Never do batch work inside a user request; the user's request has a short timeout (`PERF-16`) and holds locks.

## 2. The timer pattern (`BAS-01`, `DAT-09`)
```
Timer_SyncCustomers   (Core module: Customer_Sync / Timers)
  0. If not Site.SyncCustomersIsEnabled → log "disabled" → end           (kill switch)
  1. Run = SyncCustomersRun_Create(StartedOn, Status=Running)
  2. Deadline = CurrDateTime() + Site.SyncCustomersMaxMinutes (e.g. 10, below the timer timeout)
  3. Checkpoint = SyncCustomersCheckpoint (last processed timestamp / id / page)
  4. Loop:
       Batch = next N records after Checkpoint   (N from config, e.g. 200)
       if Batch.Empty → Status=Completed → break
       For each record: process in isolation (§3)
       Checkpoint = last record; CommitTransaction                    (progress survives)
       if CurrDateTime() > Deadline → Status=Partial → WakeTimer_SyncCustomers → break
  5. Run end: counts (processed, failed, skipped), EndedOn, Status
```
Facts and rules:
- Default timer timeout is 20 minutes (`Timeout in Minutes`); Code Quality flags runs over 30. Don't "fix" a slow job by raising the timeout.
- **Retries and concurrency (`BAS-07`)**, official facts:
  - A timeout counts as an error, and failed runs are **retried automatically**: O11 default 3 retries (changeable in Service Center environment configuration); ODC 3 retries, **not** changeable, each resetting the timeout, so the worst case is 4 × the timeout. Logic must be idempotent (`BAS-03`). After the last retry, the timer waits for its next scheduled run.
  - A platform **timeout can't be caught** by your exception handler: the logical timeout is the only clean exit.
  - O11 runs only **3 timers at once per front-end** by default (higher priority first); ODC and O11 run one instance of each timer at a time. Many heavy timers sharing a schedule queue behind each other: stagger them.
  - Some teams disable reliance on automatic retries for jobs with side effects: they handle errors per record and let the run end successfully, using a separate retry timer for failed records.
- Timers run in **their own session**: no session variables, `GetUserId()` is the system context. Use an explicit actor (`SYSTEM:SyncCustomers`) for audit columns.
- Delta processing by timestamp/high-water mark; never "process everything every night" for large tables.
- Stagger schedules; heavy jobs off-peak; a dedicated timer front-end/zone for heavy loads.
- One timer per job; the `Timer_` action is called **only** by its timer (`BNM-06`).
- Timers live in Core (`_Sync`, `_Eng`, or the owning `_BL`/`_CS`), never in FE/CW (`BAS-06`).

## 3. Per-record processing (`BAS-02`)
- Each work item has: `Status` (Pending, Processing, Done, Failed, DeadLetter), `Attempts`, `NextAttemptOn`, `LastError` (masked), `ProcessedOn`.
- Wrap each record in its own exception handler (Abort Transaction = No, so earlier records survive): catch → log → mark the record `Failed` (Attempts+1, NextAttemptOn with backoff) → continue.
- If a failed record's partial writes must be undone, give each record (or small group) its own transaction: `CommitTransaction` after each success, and on failure call `AbortTransaction` (rolls back only that record's work), then mark it `Failed` and commit that status.
- After max attempts → `DeadLetter`, visible in the back office with a manual retry.
- Pick items with a status filter and `NextAttemptOn <= Now`; claim them (`Processing`, with `ClaimedOn`) and commit before slow work when several timers or front-ends may pick the same rows.
- **Recover stale claims**: a run killed by a platform timeout leaves rows in `Processing`. At the start of each run, move rows claimed longer ago than the timeout back to `Pending` (or `Failed` with an attempt counted).
- Backoff: `NextAttemptOn = Now + base × 2^Attempts` plus a small random **jitter**, so failed items don't all retry at the same moment. Never `Sleep` inside a request or timer to wait for a retry: it holds a thread.
- Timer entry actions have their own exception handlers (`BER-08`): the module's global exception handler doesn't run for timers or processes, so an unhandled error just interrupts the run and is logged.

## 4. Outbox (`BTX-06`, `BIN-08`)
See integrations.md §8. Summary: write the intention in the business transaction, send after commit from a timer, retry with backoff, dead-letter after max attempts, purge sent rows after the retention period.

## 5. BPT and Light BPT
- Processes live in the Core module that owns the triggering entity.
- Automatic activities are small, idempotent (they are retried) and contain no user interaction; human activities assign to roles/groups, not hard-coded users.
- **Light BPT (`BAS-08`)**: ideal for "for each new `Request`, compute X" at scale. Its constraints:
  - it starts **only on entity Create**: the entity needs **Expose Process Events**, the process's `Launch On` is that entity's Create, and light execution must be enabled for the module in Service Center. Updates, deletes and manual launches don't trigger it — a manual `Launch` runs as a regular BPT process;
  - it uses its own thread pool (reported defaults per front-end: 20 Light BPT, 10 BPT, 3 timer threads — check your version), and its activity timeout is short (reported ~3 minutes vs 5 for BPT automatic activities): keep the activity small and idempotent;
  - processing order isn't guaranteed: don't depend on it;
  - commit before the insert's data is needed by the activity (`BTX-07`).
- ODC has no BPT or Light BPT: use **events** (with the limits in business-logic.md §11, `BAS-09`) and **workflows**.
- Process versions: changing a process definition affects new instances; plan migrations for running instances.
- Terminate or close instances explicitly; purge old process data per retention.

## 6. Operations (`BAS-04`)
- **Kill switch** per job (`<Job>IsEnabled`) and tunables (`<Job>BatchSize`, `<Job>MaxMinutes`) read at runtime from site properties or a config entity — stop a job without a deployment.
- **Run log** entity per job: start, end, status, counts, error summary. A small back-office screen lists runs, failures and dead letters with retry.
- Alert (email/monitoring) on repeated failures or a job that hasn't completed within its expected window.
- Document each timer in `templates/timer-spec.md`: schedule, owner, volume, timeout, idempotency strategy, kill switch, per-environment settings (`OPS-05`).
