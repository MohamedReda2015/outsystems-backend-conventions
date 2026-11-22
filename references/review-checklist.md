# Backend review checklist (enforceable rules)

Every rule has an ID, a severity and a check. Cite the ID in findings. IDs are stable between versions; new rules get new numbers. Rules from the architecture skill (`ARC`, `HSE`, `DAT`, `INT`, `SEC`, `PERF`, `AUD`, `MNT`, `OPS`, `TST`) still apply and are cited where they overlap.

**Severity**: **Blocker** — security, data loss or corruption, or deployability; fix before release. **Major** — real defect, performance or maintenance cost; fix this release. **Minor** — convention or hygiene; fix when you touch it.

**Tags**: `[inv]` checked by `scripts/check-backend.mjs`; `[sql]` checked by `scripts/lint-sql.mjs`; `[CQ]` also flagged by OutSystems Code Quality.

## BNM — Naming and structure (naming-and-structure.md)
| ID | Sev | Rule |
|---|---|---|
| BNM-01 | Minor | One action naming style per factory (`Entity_Verb` or `EntityVerb`), recorded in AGENTS.md, never mixed in an app `[inv]` |
| BNM-02 | Minor | No default or placeholder names (`Action1`, `ServerAction1`, `SQL1`, `Structure1`, `Test…`, `Copy…`) `[inv]` |
| BNM-03 | Minor | Standard verbs with their standard meaning (`_Get` raises NotFound, `_GetList` pages, `_Save` is a use case…) |
| BNM-04 | Minor | Folders per module exist and elements are filed by concept (extends `HSE-04`) |
| BNM-05 | Minor | Structures `<Concept><Purpose>`; IS structures `<Concept>_IS_<Purpose>`; no generated names outside the IS `[inv]` |
| BNM-06 | Minor | Suffix/prefix conventions: `_Logic`, `_Mock`, `V2`, `Timer_` (used only by its timer) `[inv]` |
| BNM-07 | Minor | Parameters and variables named by meaning; identifiers `<Entity>Id` typed as entity identifiers; mandatory marked `[inv]` |
| BNM-08 | Minor | Exposed REST resources: plural nouns, no verbs in paths, version first (`/v1/requests`), `limit`/`offset` paging, few status codes, one structured error body |

## BLG — Business logic (business-logic.md)
| ID | Sev | Rule |
|---|---|---|
| BLG-01 | Major | Public BL actions are thin: authorize → validate → private `_Logic` → map (≈ ≤ 15 nodes) `[inv]` |
| BLG-02 | Major | Service vs Server Action chosen deliberately; CS CRUD are Server Actions, never Service Actions `[inv]` |
| BLG-03 | Blocker | Use-case write actions take only modifiable fields; no entity record inputs on client- or API-reachable actions (`SEC-11`) `[inv]` |
| BLG-04 | Major | Server re-validates everything in the standard order; one `_Validate…` reused by every write path |
| BLG-05 | Major | Status changes only through explicit transition actions checked against allowed transitions; history row in the same transaction; no client-reachable `SetStatus` |
| BLG-06 | Major | Business rules only in BL (CS: invariants only; IS/API/SQL/client: none) (`INT-04`) |
| BLG-07 | Minor | `Function = Yes` actions are pure and cheap (no queries, writes or integration calls) |
| BLG-08 | Major | Expected business outcomes returned as `ActionResult` codes; unexpected failures raised as exceptions |
| BLG-09 | Minor | No duplicated logic between write paths (`MNT-01`) |
| BLG-10 | Major | Reads return purpose-built Structures; lists paged server-side with a capped `MaxRecords` and `TotalCount`; sort keys allow-listed (`DAT-04`) |

## BTX — Transactions, concurrency, idempotency (business-logic.md §5–7)
| ID | Sev | Rule |
|---|---|---|
| BTX-01 | Blocker | Multi-step writes in one transaction (private Server Action behind one entry point); cross-app sequences have compensation (`DAT-05`) |
| BTX-02 | Major | `CommitTransaction` only in timers/batches/long processes, tagged `[commit transaction]` (`DAT-12`) `[inv][CQ]` |
| BTX-03 | Major | Write-flow handlers abort the transaction; failure records written where the rollback can't erase them |
| BTX-04 | Major | Concurrency handled: optimistic check for user edits; `Get…ForUpdate` for counters, sequences, balances; unique indexes for "only one" rules |
| BTX-05 | Major | Retryable operations are idempotent (timers, BPT, Service Actions after CommunicationException, APIs, double submit) |
| BTX-06 | Major | No external calls while holding locks or inside the business transaction; use after-commit or outbox |
| BTX-07 | Major | Commit before launching a process, calling a consumed service, or triggering an ODC event that must read data written in the same request (Read Committed databases: Oracle, PostgreSQL; ODC) |

## BDA — Data access (data-access.md)
| ID | Sev | Rule |
|---|---|---|
| BDA-01 | Major | Entities only in CS, Public + Expose Read-Only; writes only via CRUD wrappers (`DAT-01`) `[inv][CQ]` |
| BDA-02 | Major | Business entities have audit columns, set only inside CRUD wrappers (`DAT-02`) `[inv]` |
| BDA-03 | Major | Aggregates first; SQL uses `{Entity}.[Attribute]`, never physical table names `[sql]` |
| BDA-04 | Blocker | No SQL injection: parameters only; Expand Inline only with `BuildSafe_InClause*` / `EncodeSql` on literals / allow-lists (`SEC-02`) `[sql][CQ]` |
| BDA-05 | Major | Every list query bounded (Max. Records; `TOP`/`OFFSET…FETCH`/`ROWNUM` in SQL); no `SELECT *` (`DAT-10`) `[sql][CQ]` |
| BDA-06 | Major | Soft-deleted rows filtered in every read, joined children included (`DAT-03`) `[sql]` |
| BDA-07 | Major | Sargable predicates (no functions/casts on columns in WHERE/JOIN); indexes on filter/sort/join columns (`PERF-01`) `[sql]` |
| BDA-08 | Blocker | `UPDATE`/`DELETE` SQL always has a `WHERE`; bulk changes batched, audit columns set, operation audited `[sql]` |
| BDA-09 | Minor | No `NOLOCK` / `READ UNCOMMITTED` in business logic `[sql]` |
| BDA-10 | Major | Deliberate delete rules; large text and binaries in 1-to-1 extension entities (`DAT-06`, `PERF-06`) |
| BDA-11 | Major | High-volume tables have retention and a batched purge/archive job (`PERF-12`) |
| BDA-12 | Minor | Static entities for fixed codes, referenced by record name (`DAT-07`) |
| BDA-13 | Minor | Set-based SQL: no cursors or WHILE loops; no business logic in SQL `[sql]` |

## BIN — Integrations (integrations.md)
| ID | Sev | Rule |
|---|---|---|
| BIN-01 | Major | External calls only in `<Concept>_IS` following the wrapper canvas; generated types private (`INT-01`…`INT-03`) `[inv]` |
| BIN-02 | Major | Every consumed method has an explicit timeout (≤ 10 s user-facing, ≤ 30 s background) `[inv]` |
| BIN-03 | Blocker | URLs and credentials from per-environment config; secrets Is Secret or shared IdP config (`SEC-03`) `[inv]` |
| BIN-04 | Major | Errors normalized in `OnAfterResponse` to typed exceptions; provider messages never shown to users |
| BIN-05 | Major | Retries only for transient errors on idempotent calls, bounded with backoff |
| BIN-06 | Major | Integration logging level Default (errors only) in Production; Troubleshoot/Full only for diagnosis and only with input redaction for sensitive data; correlation id sent and logged `[inv]` |
| BIN-07 | Blocker | Exposed REST in `_API`: authentication + TLS or Internal Access Only, per-method exception handling, status codes, versioning (`SEC-12`, `INT-06`) `[inv][CQ]` |
| BIN-08 | Major | Slow, unreliable or non-urgent calls are async through an outbox with status, attempts and dead letter |
| BIN-09 | Blocker | No calls to URLs built from user input (SSRF); hosts allow-listed |
| BIN-10 | Minor | Each IS has a mock switch and test overrides that are off/empty in Production |
| BIN-11 | Major | Consumed REST errors handled in `OnAfterResponse` (error body parsed, specific exception raised); never silenced by rewriting the status code to 2xx |

## BER — Errors and logging (errors-and-logging.md)
| ID | Sev | Rule |
|---|---|---|
| BER-01 | Major | Standard user exceptions per BL module and one integration exception per IS; messages user-safe and translatable |
| BER-02 | Major | Handlers ordered specific → general, `AllExceptions` last, never empty (`DAT-08`) |
| BER-03 | Major | Log once at the boundary through the standard logging action, with correlation id, actor and masked inputs (`SEC-06`) |
| BER-04 | Blocker | No raw exception messages, stack traces, SQL or provider errors returned to clients or API consumers |
| BER-05 | Minor | No ignorable error flags for unexpected failures; exceptions are raised |
| BER-06 | Minor | Platform logs monitored each release; long-retention logs exported (`AUD-03`) |
| BER-07 | Minor | No FeedbackMessage or other UI calls in server-side logic: the caller may be a timer, an API or another app |
| BER-08 | Major | Timer, process and exposed-API entry actions have their own exception handlers (the global handler doesn't cover them) `[inv]` |

## BAS — Async processing (async-processing.md)
| ID | Sev | Rule |
|---|---|---|
| BAS-01 | Blocker | Timers: `Timer_` action, logical timeout, batches, checkpoint + commit, re-wake; never > 30 min (`DAT-09`) `[inv][CQ]` |
| BAS-02 | Major | Per-record isolation with status, attempts, backoff, last error and dead letter |
| BAS-03 | Major | Jobs and process activities are idempotent (platform retries) |
| BAS-04 | Major | Kill switch, tunables, run log and monitoring per job |
| BAS-05 | Major | Right mechanism chosen (timer / Light BPT / BPT / outbox / job entity); no batch work in user requests |
| BAS-06 | Minor | Timers and processes live in Core modules, one timer per job `[inv]` |
| BAS-07 | Major | Job budget accounts for automatic retries (O11 default 3, configurable; ODC 3 fixed, worst case 4 × timeout) and timer concurrency (3 per O11 front-end, one instance per timer); stale "In Progress" claims are recovered `[inv]` |
| BAS-08 | Major | Light BPT only where it fits: launched on entity Create (Expose Process Events, light execution enabled), short idempotent activity; manual launch runs as a regular process |
| BAS-09 | Major | ODC events: basic-type parameters (ids) within 10 KB, order-independent handlers that finish within 2 min, All Exceptions on producer and consumer, commit before triggering |

## BPF — Performance (performance-and-caching.md)
| ID | Sev | Rule |
|---|---|---|
| BPF-01 | Major | No queries, Service Actions or integration calls inside loops (`DAT-10`) `[CQ]` |
| BPF-02 | Major | Only needed fields fetched; no large text or binaries in list queries (`PERF-10`) |
| BPF-03 | Major | `Cache in Minutes` only for stable, non-user-specific data; every cache has expiry and invalidation |
| BPF-04 | Major | Coarse-grained Service Actions: one call per use case; list inputs instead of N calls |
| BPF-05 | Minor | No O(n²) matching in logic over large lists |
| BPF-06 | Major | No site property writes at runtime; no large session variables (`DAT-11`, `PERF-18`) `[CQ]` |
| BPF-07 | Minor | Tested with production-like volumes; slow SQL / integration / timer reports reviewed each release |
| BPF-08 | Major | No action that only wraps one aggregate (it loses field-level optimization): query where the data is used, or return a purpose-built Structure `[inv]` |
| BPF-09 | Minor | Caching designed for platform behaviour: cached per input combination, duration fixed at design time, server-side only, invalidation is module-wide |

## BSC — Server-side security (security.md)
| ID | Sev | Rule |
|---|---|---|
| BSC-01 | Blocker | Every client-, app- or API-reachable BL entry point checks role + record access + state on the server (`SEC-01`) |
| BSC-02 | Blocker | Identity from the server only: no `UserId`/`TenantId`/role/actor inputs on reachable actions (`SEC-09`) `[inv][CQ]` |
| BSC-03 | Blocker | No secrets in code, logs, URLs; secret site properties Is Secret (`SEC-03`) `[inv][CQ]` |
| BSC-04 | Blocker | All inputs revalidated and bounded; no injection of any kind (`SEC-02`) |
| BSC-05 | Major | Anonymous endpoints safe with any input, rate-limited, non-enumerating (`SEC-08`) |
| BSC-06 | Major | OTPs/tokens hashed, single-use, expiring; sensitive data encrypted/masked/role-restricted per policy |
| BSC-07 | Major | Uploads validated server-side (type by content, size, antivirus) before storage (`SEC-04`) |
| BSC-08 | Major | Exposed APIs secured (see BIN-07, `SEC-12`) |
| BSC-09 | Blocker | Tenant never from input; no `TenantSwitch`/Show Tenant Identifier outside approved admin apps (`SEC-05`) |
| BSC-10 | Major | Output Structures expose only what the caller may see |
| BSC-11 | Blocker | Exposed APIs verified: an unauthenticated call returns 401; credentials per consumer, stored hashed; tokens expire; JWT signatures verified on every call `[inv]` |

## BCF — Configuration (performance-and-caching.md §4)
| ID | Sev | Rule |
|---|---|---|
| BCF-01 | Major | Nothing environment- or business-specific hard-coded |
| BCF-02 | Major | Site properties read-only at runtime, described, with units and safe defaults; ≤ ~20 per module (`DAT-11`) `[inv]` |
| BCF-03 | Major | Runtime-editable settings in config entities with a protected back office, cached with invalidation |
| BCF-04 | Minor | Feature flags and kill switches have an owner and removal date; stale ones removed (`MNT-04`) |

## How to run a backend review
1. Step 0 from SKILL.md. Get the module list, the inventory (Service Studio MCP read tools, Discovery, or by hand) and the SQL node texts.
2. Run `node scripts/check-backend.mjs inventory.json` and `node scripts/lint-sql.mjs sql/`.
3. Read Code Quality and TrueChange for the modules; map them with the architecture skill's code-quality-patterns reference.
4. Sample by element type: CS entities + CRUD, BL public actions and their `_Logic`, Structures, transitions, SQL nodes, IS actions, exposed API methods, timers, site properties.
5. For each client-reachable action, ask the security questions in security.md §9.
6. Record each finding: ID · severity · `Module.Folder.Element` · evidence · fix. Order: Security → Data integrity (BTX, BDA) → Performance → Architecture → Maintainability. Use `templates/backend-review-report.md`.
