---
name: outsystems-backend-conventions
description: OutSystems backend conventions for O11 and ODC on the 3-layer Architecture Canvas. Covers naming and folders for server elements; BL logic (thin Service Actions, private _Logic, use-case writes, validation, state transitions, ActionResult); Service vs Server Actions, transactions, concurrency, idempotency; database work (read-only entities, CRUD wrappers, aggregates, SQL, soft delete, bulk, retention); integrations (_IS wrappers, consumed/exposed REST, timeouts, retries, outbox); errors and logging; timers, BPT, async; performance, caching, server security, configuration. Includes an SQL linter, an inventory checker, templates and real-project lessons. Use it whenever an agent builds, refactors, reviews or explains an OutSystems server or service action, entity, aggregate, SQL node, structure, exception, timer, site property, integration or exposed API, even if the user only says "add the save logic", "call this API", "why is it slow" or "clean up the BL".
license: MIT
metadata:
  version: 1.2.0
  updated: 2026-11-22
  platform: OutSystems 11 (server side of Reactive Web, Mobile, Traditional Web) and ODC
  agent-independent: true
  companion-skills: outsystems-architecture (layers, modules, dependencies, rule IDs ARC/HSE/DAT/INT/SEC/PERF...); outsystems-frontend-conventions (screens, blocks, client logic); outsystems-live-style-guide (visual design); outsystems-bpt (processes, task inboxes); outsystems-cmf (case management)
---

# OutSystems Backend Conventions

This skill makes an agent write OutSystems server-side code the way a senior OutSystems tech lead expects to find it in review:
- **every element in the right layer and module**, named so anyone can find it;
- **thin public contracts** over private logic, so one use case = one call = one transaction;
- **writes that are authorized, validated, audited and atomic**, and safe to retry;
- **queries that are bounded, indexed, injection-proof** and filter soft-deleted rows;
- **integrations behind a wrapper** with timeouts, normalized errors and no leaked secrets;
- **errors that users can read and operators can trace**;
- **background work that never times out, never repeats, and can be stopped**.

It works for any agent (Claude, Copilot, Cursor, Codex, Gemini, a custom LLM agent) and for humans. Everything is plain Markdown plus two zero-dependency Node.js scripts.

## Where this skill sits

| Question | Skill |
|---|---|
| Which module and layer, who may reference whom, app composition, deployment SOPs | **outsystems-architecture** |
| How screens, blocks, client actions and forms are written | **outsystems-frontend-conventions** |
| How it looks: tokens, theme, CSS, patterns, accessibility | **outsystems-live-style-guide** |
| BPT processes, human tasks, approval flows; case management on CMF | **outsystems-bpt**, **outsystems-cmf** |
| How **server-side** code is written: logic, data, integrations, errors, async, performance, security | **this skill** |

When they overlap, the architecture skill owns *where* an element lives; this skill owns *how* it is written. This skill cites the architecture skill's rule IDs (`DAT-05`, `SEC-09`, `INT-02`…) and adds its own (`BLG-*`, `BTX-*`, `BDA-*`, `BIN-*`, `BER-*`, `BAS-*`, `BPF-*`, `BSC-*`, `BCF-*`, `BNM-*`).

## Precedence of rules
1. **The project's own conventions** (its AGENTS.md, blueprint or naming document already in force). Follow them, and say so.
2. **This house standard.**
3. **OutSystems official guidance** (Architecture Canvas, Platform Best Practices, Code Quality patterns, docs). Community conventions only fill gaps.

Deviations are "comply or explain": record each one as a short decision (ADR) in the project's AGENTS.md or docs, with the reason.

If a project rule conflicts with a **security**, **transaction** or **data-integrity** rule here (`BSC-*`, `BTX-01`, `BDA-04`, `BDA-08`), flag it with the risk and ask. Never silently follow it and never silently rework already-built modules. Record the decision in the project's AGENTS.md.

## The backend on the 3-layer Canvas

```
END-USER    <App>_Front_End        No backend logic. Calls CW blocks only (strict mode).
──────────────────────────────────────────────────────────────────────────────────────────
CORE        <App>_CW               Data actions that call BL Service/Server Actions. No rules.
            <App>_BL     ◄── the backend's front door
                         Structures (all DTOs) · public Service Actions (thin) · private _Logic
                         · use-case write actions · validation · state transitions · roles
                         · user exceptions · site properties · integration orchestration
            <App>_CS     Entities (Public, Expose Read-Only) · Lookups (static) · CRUD wrappers
                         (audit columns, invariants, no role checks, never called by the client)
            <Concept>_Sync / _Eng  Timers and heavy processing (sync, hot cache)
            <Concept>_API          Exposed REST: auth, mapping, versioning; calls BL. No rules.
──────────────────────────────────────────────────────────────────────────────────────────
FOUNDATION  <Concept>_IS           Consumed REST/SOAP wrappers: auth, mapping, errors, timeouts
            <Name>_Lib             Business-agnostic helpers: logging, crypto, formatting, audit
```
Dependencies always point down; a `_CS` never consumes BL, Sync, API or Eng (`ARC-01`, `ARC-10`, `HSE-01`). Full canvas rules are in the architecture skill.

## Step 0: establish context (before writing anything)
1. **Platform**: O11 (which Platform Server version — `Is Secret` needs 11.25+) or ODC (no modules/Service Actions the same way: libraries and apps; see `references/business-logic.md` §8).
2. **Which module** the element belongs in, by the table above. If it doesn't fit, ask the architecture skill before creating a module.
3. **What exists**: the module's folders, its Structures, `ActionResult`, user exceptions, the standard logging action, shared config/IdP modules, existing `_IS` modules. **Reuse before creating** (`BLL-03`).
4. **Naming style in force**: `Entity_Verb` (house default) or `EntityVerb`. One per factory (`BNM-01`).
5. **Who calls it**: the client (then it is a public REST endpoint — `references/security.md`), another app (Service Action), a timer, or an external system (`_API`).

## Core conventions (details in the references)

### 1. Names say what and which kind (`references/naming-and-structure.md`)
| Element | Pattern (house `Entity_Verb`) | Examples |
|---|---|---|
| CRUD wrapper (CS) | `<Entity>_Create/_Update/_Delete/_CreateOrUpdate` | `Request_Create`, `RequestFile_Delete` |
| Read action (BL) | `<Concept>_Get` · `_GetList` · `_Search` · `_Count` | `Request_Get`, `Request_GetList` |
| Use-case action (BL) | `<Concept>_<DomainVerb>` | `Request_Submit`, `Request_Approve`, `Order_UpdateDeliveryDate` |
| Private implementation | `<PublicName>_Logic` | `Request_Submit_Logic` |
| Validation / mapping | `<Concept>_Validate<What>` · `<Concept>_Map<From>To<To>` | `Request_ValidateSave`, `Request_MapRecordToDetail` |
| Structure | `<Concept><Purpose>` | `RequestSaveInput`, `RequestSummary`, `RequestDetail` |
| IS action / structure | `<Concept>_IS_<Verb><Object>` · `<Concept>_IS_<Purpose>` | `Customer_IS_GetProfile`, `Customer_IS_Profile` |
| Timer action | `Timer_<Job>` | `Timer_SyncCustomers` |
| User exception | `<Kind>Exception` | `ValidationException`, `NotFoundException` |
| Site property | `<Area><Name><Unit>` | `CrmBaseUrl`, `RequestExpiryDays` |

No `Action1`, `ServerAction2`, `SQL1`, `Structure1`, `Param1` (`BNM-02`). Every public element and parameter has a Description (`HSE-06`).

### 2. Business logic: thin door, fat room (`references/business-logic.md`)
- A public BL action does four things only: **authorize → validate → call `_Logic` → map to a Structure** (`BLG-01`).
- **Service Action** for contracts consumed by other apps or teams (weak reference, own transaction). **Public Server Action** inside one app when the caller needs one shared transaction. CS CRUD wrappers are always Server Actions (`BLG-02`).
- Writes are **use cases**, not "save the record": `Order_UpdateDeliveryDate(OrderId, DeliveryDate)` loads the record on the server, checks role + ownership + status, assigns only allowed fields, calls the CRUD wrapper (`BLG-03`, `SEC-11`).
- Validation order: **authorization → existence → state → input rules → cross-record rules**, in one `_Validate…` action reused by every write path (`BLG-04`).
- Status changes go through **explicit transition actions** checked against a transition table, and write a history row in the same transaction (`BLG-05`).
- Business rules live **only** in BL — not in CRUD (except entity invariants), not in IS/API, not in SQL, not on the client (`BLG-06`).

### 3. Transactions: one use case, one transaction (`references/business-logic.md` §5–7)
- Every request runs in one transaction that commits at the end, or rolls back on an unhandled exception or an `Abort Transaction` handler.
- A **Service Action runs in its own transaction**: a sequence of Service Actions is not atomic. Put the steps in one private Server Action behind one Service Action, or design compensation (`BTX-01`, `DAT-05`).
- `CommitTransaction` only in timers, batches and long processes, documented as `[commit transaction]` (`BTX-02`, `DAT-12`).
- **Concurrency**: user-edited records use an optimistic check (`UpdatedOn` sent back and compared); counters, sequence numbers and balances use `Get<Entity>ForUpdate` (row lock) (`BTX-04`).
- **Idempotency**: anything that can be retried — timers, integration calls, Service Actions after a `CommunicationException`, double clicks — is safe to run twice (`BTX-05`).
- No external call (REST, email, SMS) while holding locks; send after commit or through an outbox (`BTX-06`).
- **Commit before handing off** to a process, an ODC event, a woken timer or a service that reads what you just wrote: on Oracle/PostgreSQL and in ODC the other side can't see uncommitted rows (`BTX-07`).
- There are no distributed transactions: other catalogs, external databases and integrations commit on their own.

### 4. Data access: bounded, safe, indexed (`references/data-access.md`)
- Entities in CS, `Public` + `Expose Read-Only`; writes only via CRUD wrappers that set `CreatedBy/On`, `UpdatedBy/On` (`BDA-01`, `BDA-02`).
- **Aggregates first.** SQL only for what aggregates can't do; use `{Entity}.[Attribute]`, never physical table names (`BDA-03`).
- Parameters, never concatenation. Expand Inline only with `BuildSafe_InClause*` / `EncodeSql` on literals (`BDA-04`, `SEC-02`).
- Every list query is **bounded** (Max. Records; `TOP`/`OFFSET…FETCH` inside SQL), never `SELECT *` (`BDA-05`).
- Soft-deleted rows filtered in **every** read, joined children included (`BDA-06`).
- No functions or casts on columns in `WHERE`/`JOIN`; index what you filter, sort and join on (`BDA-07`, `PERF-01`).
- `UPDATE`/`DELETE` SQL always has a `WHERE`, and bulk changes are audited as one operation (`BDA-08`).
- **Lint every SQL node you write**:
  ```
  node scripts/lint-sql.mjs <file-or-folder> [--soft-delete Request,RequestFile] [--json]
  ```

### 5. Integrations: wrap, time out, normalize (`references/integrations.md`)
- External systems only through a `<Concept>_IS` that follows the **wrapper canvas**: validate → authenticate → map in → call + audit → normalize errors → map out (`BIN-01`, `INT-01`…`INT-03`).
- Every consumed method has an **explicit timeout** (≤ 10 s on a user's request, ≤ 30 s otherwise) (`BIN-02`).
- URLs and credentials from per-environment config; secrets `Is Secret` or the shared IdP config (`BIN-03`).
- `OnAfterResponse` parses the error body and raises typed exceptions; never "silence" errors by rewriting the status to 200; external messages never reach users verbatim (`BIN-04`, `BIN-11`).
- Integration logging level **Default** in production; redact sensitive inputs before using Troubleshoot or Full (`BIN-06`).
- Retry only transient errors on idempotent calls, bounded, with backoff (`BIN-05`). Slow, unreliable or non-urgent calls go **async** via an outbox (`BIN-08`).
- Exposed APIs: `_API` module, authentication + TLS (or Internal Access Only), input validation, per-method exception handling, HTTP status codes, versioned, resource-oriented paths (`BIN-07`, `SEC-12`, `BNM-08`). They are **not secured by default**: prove an unauthenticated call gets 401; one hashed credential per consumer; verified, expiring tokens (`BSC-11`).

### 6. Errors and logging (`references/errors-and-logging.md`)
- **Expected business outcomes** the caller must branch on → return `ActionResult` (`IsSuccess`, `Message`, `Errors[] {Field, Code, Message}`), the same shape the frontend skill maps onto forms. **Unexpected failures** → raise exceptions (`BLG-08`, `BER-05`).
- One set of user exceptions per BL module (`ValidationException`, `NotFoundException`, `NotAuthorizedException`, `ConflictException`, `BusinessRuleException`); one `<Concept>IntegrationException` per `_IS` (`BER-01`).
- Handlers ordered specific → general, `AllExceptions` last, **never empty** (`BER-02`, `DAT-08`).
- Log **once**, where handled, through the standard logging action: module, action, correlation id, user, masked inputs — never secrets or full personal data (`BER-03`, `SEC-06`).
- Never return raw exception text, stack traces or SQL errors to a client or API consumer (`BER-04`).

### 7. Async work: timers, BPT, outbox (`references/async-processing.md`)
- Users never wait for batch work. Choose: **Timer** (scheduled/batch), **Light BPT / BPT** (one event per record, workflows), **Outbox + Timer** (reliable external side effects) (`BAS-05`).
- Timer pattern: `Timer_` action, logical timeout below the platform timeout, batches, checkpoint + `CommitTransaction` per batch, self re-wake, kill switch, run log (`BAS-01`, `DAT-09`).
- Per-record isolation: status, attempt count, max attempts, last error, a dead-letter state (`BAS-02`). Jobs are idempotent: the platform retries failed timers (`BAS-03`).
- Budget for the platform: timeouts count as failures and are retried (O11 default 3; ODC 3 fixed, worst case 4 × timeout); a platform timeout can't be caught; O11 runs 3 timers at once per front-end; recover stale "In Progress" claims (`BAS-07`). Timer entry actions need their own exception handlers (`BER-08`).
- Light BPT starts only on entity Create; ODC uses events (ids only, ≤ 10 KB, handlers ≤ 2 min) and workflows (`BAS-08`, `BAS-09`).

### 8. Performance and caching (`references/performance-and-caching.md`)
- No queries or Service Actions inside loops; join, batch, or pass lists (`BPF-01`, `BPF-04`).
- Fetch only needed fields; no binaries or large text in list queries (`BPF-02`, `PERF-06`).
- `Cache in Minutes` for stable reference data only, never for user- or permission-dependent results; it caches per input values, its duration is fixed at design time, and invalidation clears the whole module (`BPF-03`, `BPF-09`).
- Don't wrap a single aggregate in its own action: it loses field-level optimization (`BPF-08`, official).
- Site properties are read-only at runtime; runtime-changeable settings live in a config entity (`BCF-02`, `DAT-11`).

### 9. Security on the server (`references/security.md`)
- Every client-reachable aggregate, data action and server action is a public REST endpoint. Each BL entry point checks **role + record ownership** on the server (`BSC-01`, `SEC-01`).
- **Identity comes from the server**: `GetUserId()` inside the action, never a `UserId`, `TenantId` or `IsAdmin` input from the client (`BSC-02`, `SEC-09`).
- Output Structures carry only what the caller may see: no hashes, internal flags or other users' data (`BSC-10`).
- No secrets in code, logs or URLs (`BSC-03`, `SEC-03`, `SEC-06`).

## How to work

### Building backend logic
1. Do Step 0. For a new public action fill `templates/service-action-spec.md`; for an integration `templates/integration-spec.md`; for a timer `templates/timer-spec.md`.
2. Create **folders first** (`BNM-04`), then build bottom-up: CS entity + CRUD → BL Structures → `_Validate` + `_Logic` → thin public action → (IS / API / Timer) → CW data action.
3. Name, describe and type every element as you create it.
4. Wire exceptions, logging, transactions and authorization **before** calling it done.
5. Lint every SQL node (`scripts/lint-sql.mjs`). If you can export an inventory (Service Studio MCP read tools, Discovery, or a hand list), run:
   ```
   node scripts/check-backend.mjs <inventory.json> [--style pascal] [--json]
   ```
6. **Verify on the platform** (`BLL-01`): publish, read the element back, check TrueChange, then exercise happy path, invalid input, missing role, another user's record, double submit, and an integration timeout. Report what you saw, not what you wrote.
7. Finish with the build report from the architecture skill (`templates/build-report.md` there).

### Reviewing
1. Step 0, then run both scripts on what you can export.
2. Walk `references/review-checklist.md`; every rule has an ID and a severity. Triage: Security → Data integrity → Performance → Architecture → Maintainability.
3. Write `templates/backend-review-report.md`: most severe first, each with rule ID, evidence (`Module.Folder.Element`) and a concrete fix.

### Refactoring
Read `references/lessons-learned.md` first. Keep public signatures stable: add a new version (`Request_GetV2`) for breaking changes and deprecate the old one (`INT-06`, `MNT-07`). Rebuild internals behind `_Logic` so consumers are untouched.

## Rules most often broken
- Multi-step write split across several Service Actions, so a failure leaves half the data (`BTX-01`).
- Whole entity record accepted from the client; user id passed as an input (`BLG-03`, `BSC-02`).
- Role checked on the screen only, not in the BL action; no ownership check (`BSC-01`).
- Query or Service Action inside a For Each (`BPF-01`).
- SQL with concatenated input, `SELECT *`, no row limit, missing `IsDeleted` filter (`BDA-04`…`BDA-06`).
- Empty exception handler, or `AllExceptions` first; raw exception text returned to users (`BER-02`, `BER-04`).
- REST call with the default timeout and generated structures leaking out of the `_IS` (`BIN-02`, `INT-02`).
- Timer that processes everything in one transaction and times out, then reprocesses on retry (`BAS-01`, `BAS-03`).
- Secret in a plain site property; site property written at runtime (`BSC-03`, `BCF-02`).
- Exposed API never called without credentials before release (`BSC-11`); REST errors "silenced" to 200 (`BIN-11`).
- Launching a process or event before committing the data it reads (`BTX-07`).
- Audit columns set by callers and by the wrapper, and drifting (`BDA-02`).

## Reference map (read only what the task needs)
| File | Read when |
|---|---|
| `references/naming-and-structure.md` | naming any server element; folders per module; where an element goes on the canvas |
| `references/business-logic.md` | BL actions, Service vs Server Actions, validation, state transitions, transactions, concurrency, idempotency, ODC notes |
| `references/data-access.md` | entities, CRUD wrappers, aggregates, SQL, soft delete, bulk, pagination, retention |
| `references/integrations.md` | consuming or exposing REST/SOAP, IS wrappers, auth, timeouts, retries, outbox, sync |
| `references/errors-and-logging.md` | exceptions, `ActionResult`, handlers, logging, correlation, audit |
| `references/async-processing.md` | timers, BPT / Light BPT, outbox, queues, batch jobs |
| `references/performance-and-caching.md` | slow actions or queries, caching, configuration and site properties |
| `references/security.md` | any client-reachable action, API, secret, upload, tenant or personal data |
| `references/lessons-learned.md` | before any real build or refactor (`BLL-*`) |
| `references/review-checklist.md` | any review, audit or "is this right?" question |
| `templates/service-action-spec.md` · `templates/integration-spec.md` · `templates/timer-spec.md` · `templates/backend-review-report.md` | new public action; new integration; new timer; review report |
| `scripts/lint-sql.mjs` | linting SQL node text (`--soft-delete`, `--json`) |
| `scripts/check-backend.mjs` | checking a backend inventory JSON: layers, names, signatures, secrets, timers, APIs, logging levels (`--style`, `--json`) |
| `research/sources.md` · `research/assessment-2026-11.md` | where a rule comes from (official vs community) and what the November 2026 research changed; re-verify before quoting platform limits |
