# Assessment of v1.0.0 against research (November 2026)

Method: the v1.0.0 rules were compared with official O11/ODC documentation and community standards (see sources.md). Each item is **Confirmed**, **Corrected**, **Gap** (missing) or **Unverified** (kept, but labelled). The fix column names what changed in v1.1.0.

## Confirmed (no change needed)
| Area | v1.0.0 rule | Evidence |
|---|---|---|
| Transactions | Request = one transaction; uncaught exception rolls back; Abort Transaction property; Commit/Abort start a new transaction | O11 Handling transactions, Exception Handler |
| Timers | 20-min default; ≤ 30 min; wake pattern, checkpoints, partial commits; own session | O11 Using timers, ODC long-running timers, O11 logic performance |
| Service actions | Remote REST call, weak dependency, user + communication exceptions reach consumer, UserId/TenantId passed, structures over entities | ODC Service actions |
| Settings / site properties | Read-only at runtime; entities for changing values; secrets marked secret | O11 logic performance, ODC data management |
| Data | Index filter/sort/join columns; isolate text > 2000 and binaries | ODC data management |
| Integrations | Effective URL / credentials per environment; normalize errors; never expose generated types | O11 runtime REST config, blog on HTTP codes |
| Security | Every reachable server action checks login + role (+ ownership); timers have no user | Synobsys ADR-003, HackerNoon |

## Corrected
| # | v1.0.0 said | Research says | Fix in v1.1.0 |
|---|---|---|---|
| C1 | "Avoid letting the platform's generic HTTP error surface" (vague) | Non-2xx raises an exception by default; handle in `OnAfterResponse` with specific exceptions; rewriting the status to 200 ("silencing") is bad practice | integrations.md §3/§6 rewritten; new **BIN-11** |
| C2 | Integration logging: "not Full in production" | Three levels (Default = errors only, Troubleshoot, Full); parameter values are stored and visible in Service Center; consumed REST supports input redaction | integrations.md §7; **BIN-06** reworded; checker reads `loggingLevel` / `redactInputs` |
| C3 | Timer retries: "platform retries failed runs" | O11: timeouts count as errors, retried (default 3, configurable in Service Center). ODC: 3 retries, not configurable, each resets the timeout → worst case 4 × timeout. Only 3 timers run at once per O11 front-end; one instance per timer | async-processing.md §2; new **BAS-07** |
| C4 | ODC notes (short, partly generic) | Public server actions only in libraries; public app entities always read-only; cross-app references have delete rule Ignore and no FK; settings; workflows replace BPT; events with strict limits; external libraries replace extensions; read-committed isolation | business-logic.md §11 rewritten; new **BAS-09**, **BTX-07** |
| C5 | Service action custom exception types "don't reliably cross" | Official docs: user and communication exceptions are catchable by consumers; custom exception types are not public across modules (Idea 100) and forum reports show generic handling | Wording kept, labelled as community evidence: verify on your version |

## Gaps (added)
| # | Missing in v1.0.0 | Fix |
|---|---|---|
| G1 | Commit before launching a process, calling a consumed service, or triggering an ODC event that reads the data just written (Read Committed databases: Oracle, PostgreSQL, Aurora; ODC) | **BTX-07**, business-logic.md §5 |
| G2 | Official rule: don't isolate an aggregate in its own action (loses field-level optimization) | **BPF-08**, data-access.md §4, checker flag `aggregateOnly` |
| G3 | Cache facts: per-input caching, design-time duration, server-side only, module-wide invalidation | **BPF-09**, performance-and-caching.md §3 |
| G4 | Light BPT specifics: Create-only trigger, Expose Process Events, light execution enabled, thread pools, manual launch = regular BPT | **BAS-08**, async-processing.md §5 |
| G5 | Timer and process flows aren't covered by the global exception handler | **BER-08**, errors-and-logging.md §4 |
| G6 | No FeedbackMessage or other UI calls in server actions | **BER-07** |
| G7 | Exposed API hardening: test unauthenticated (expect 401), per-consumer credentials stored hashed, expiring tokens, JWT signature verification | **BSC-11**, security.md §8, integrations.md §9 |
| G8 | REST resource design conventions (plural nouns, `/v1`, `limit`/`offset`, few status codes, structured error body) | **BNM-08**, integrations.md §9 |
| G9 | Governance: deviations recorded as ADRs ("comply or explain") | SKILL.md precedence |
| G10 | GetForUpdate detail: lock until transaction end, reads not blocked, semaphore entity to serialize a whole operation | business-logic.md §6 |
| G11 | Timer recovery: claim records "In Progress", recover stale claims; backoff with jitter; no `Sleep` in requests | async-processing.md §3 |
| G12 | Service account login as an alternative actor for timers that must pass role checks | security.md §3 |

## Unverified (kept, labelled)
- O11 consumed REST default timeout value (commonly reported as 100 s): not found in the pages read. The skill sets explicit timeouts anyway (BIN-02), so the default doesn't matter.
- Light BPT activity timeout (~3 min) and thread counts (20/10/3): from a 2019 article, forum and a book; check your platform version.
- ODC platform limits (exposed REST 60 s, service action 100 s, timer maximum): read from a truncated page; check the current limits page before quoting.
- Whether `LogMessage`/`LogError` rows survive a rollback: not stated in the docs read. The skill's advice (log failures outside the rolled-back work) is safe either way.

## Script improvements
- `check-backend.mjs`: BIN-06 (logging level Full without redaction), BPF-08 (`aggregateOnly` actions), BAS-07 (more than 3 timers in one module sharing a schedule → concurrency warning), BSC-11 (exposed API without `testedUnauthenticated`), BER-08 (timer action without `hasExceptionHandler`).
- Tests extended for the new checks.
