# Business logic, actions and transactions

Rules: `BLG-01` … `BLG-10`, `BTX-01` … `BTX-07`. Builds on the architecture skill's `DAT-04`, `DAT-05`, `DAT-12`, `SEC-01`, `SEC-09`, `SEC-11`.

## Contents
1. The anatomy of a public BL action
2. Service Action or Server Action?
3. Use-case write actions (no mass assignment)
4. Validation
5. Transactions
6. Concurrency
7. Idempotency
8. State transitions and workflows
9. Read actions and pagination
10. Functions, reuse and flow style
11. ODC notes

## 1. The anatomy of a public BL action (`BLG-01`)
```
Request_Submit (public Service Action, BL/ServiceActions/Request)        ← thin: ≤ ~15 nodes
  1. Authorize    CheckRequestClerkRole(GetUserId())  → else raise NotAuthorizedException
  2. Validate     Request_ValidateSubmit(RequestId)   → ActionResult; if not IsSuccess → return it
  3. Execute      Request_Submit_Logic(RequestId, Comment)    (private Server Action)
  4. Map/return   ActionResult (+ ids / Structure)
  Exception handlers: ValidationException → ActionResult; others propagate (logged at boundary)

Request_Submit_Logic (private Server Action, BL/PrivateActions/Request)   ← all steps, ONE transaction
  load record (with ownership filter) → check state → Request_Update (CS) → RequestHistory_Create (CS)
  → enqueue notification (outbox) → return
```
Why: the public contract stays stable while `_Logic` can be rebuilt; all writes commit or roll back together; authorization can't be skipped by another entry point because `_Logic` is private.

## 2. Service Action or Server Action? (`BLG-02`)
| Use | When |
|---|---|
| **Service Action** (public, BL) | Contract consumed by **other apps or teams**; you want weak references and independent deployments. |
| **Public Server Action** (BL) | Consumers in the **same app** that need the work inside **their** transaction, or high-frequency calls where REST overhead matters. |
| **Private Server Action** | `_Logic`, `_Validate`, `_Map`, helpers. The default for everything that isn't a contract. |
| **Server Action in CS** | CRUD wrappers. Never a Service Action (writes must join the caller's transaction). |
| **Client-called server action** (in CW/FE) | One per user action; calls exactly one BL entry point (`PERF-15`). |

Service Action facts to design around:
- Own process, own transaction, REST call inside the same environment. A caller's rollback does **not** undo it.
- Passed context: UserId, TenantId, Locale, Request Key. Session variables are **not** passed.
- Consumers can get `CommunicationException` (timeout, network) — the work **may or may not** have happened. Hence idempotency (§7).
- Official: user and communication exceptions raised by a Service Action **can be caught** by consumers. Custom exception **types** are not public across modules, and forum reports show consumers handling them as a generic user exception (or a 500) — verify on your platform version. So anything the caller must branch on is returned as a code in `ActionResult`, never inferred from an exception type.
- Payloads are serialized: keep them small; never pass binaries you can pass by id.

## 3. Use-case write actions (`BLG-03`, `SEC-11`)
Never expose "save this whole record". Expose what the business does:
```
Order_UpdateDeliveryDate(OrderId, DeliveryDate)       ✔
Order_Save(OrderSaveInput {OrderId, DeliveryDate, Notes})   ✔ (only editable fields)
Order_CreateOrUpdate(Order record)                    ✘ client can set Status, Total, OwnerId…
```
The action: authorize → load the current record **on the server** (with ownership filter) → check status allows the change → assign only the allowed fields → CRUD wrapper → history/audit.

## 4. Validation (`BLG-04`)
Order (cheapest and most security-relevant first):
1. **Authorization**: role (`Check<Role>Role(GetUserId())`) and record ownership/ACL.
2. **Existence**: the record exists, is not soft-deleted, and is visible to this user (else `NotFoundException` — don't reveal that it exists).
3. **State**: the current status allows this action.
4. **Input rules**: mandatory, length, format, range, allowed values (static entity membership).
5. **Cross-record rules**: uniqueness, limits, overlaps, budget.

Rules:
- Re-validate **everything** on the server; client validation is only UX.
- One `<Concept>_Validate<UseCase>` returns an `ActionResult` with **all** field errors at once (`Errors[] {Field, Code, Message}`) so the UI can show them together. Reuse it from every write path (UI, API, import).
- Entity **invariants** (mandatory, format, referential integrity, uniqueness) may also be enforced in the CS wrapper as a last line of defence.
- Trim text, normalize case/phone/email formats in one helper before validating and storing.
- Never trust ids in a `SaveInput`: re-resolve parent and owner on the server.

## 5. Transactions (`BTX-01` … `BTX-03`, `BTX-06`)
Platform behaviour:
- A server request (screen/server action call, Service Action call, timer run, API method) is **one database transaction** that commits when the request ends successfully.
- An exception handler with **Abort Transaction = Yes** rolls back; an unhandled exception rolls back too.
- `CommitTransaction` commits what's done so far; `AbortTransaction` rolls back. Both start a new transaction. Transactions can't be nested; commit or rollback releases all locks.
- There is **no distributed transaction**: other database catalogs, external databases and integrations commit independently.
- Isolation depends on the database. On SQL Server, Azure SQL and MySQL, writes run in their own transaction (reads see uncommitted data in the same request). On Oracle, PostgreSQL and Aurora PostgreSQL there is one shared Read Committed transaction. ODC is read committed too.

House rules:
- **BTX-01** Multi-step writes live in **one** private Server Action behind one public entry point. If a flow must span several Service Actions (different apps), design **compensation** (e.g. `Payment_Refund` for `Payment_Capture`) and record which step completed.
- **BTX-02** `CommitTransaction` only in timers, batch jobs and long processes (per batch), never in BL use-case actions or CRUD wrappers. A public action that commits or aborts ends its description with `[commit transaction]` / `[abort transaction]` (`DAT-12`).
- **BTX-03** Handlers in write flows keep Abort Transaction = Yes. If you need a **failure record** to survive the rollback, write it to the platform log (`LogMessage`/`LogError`, not rolled back) or call the logging action after `AbortTransaction`. A row written to your own entity before the rollback is lost with it.
- **BTX-07** Commit **before** handing work to something that reads your data in another transaction: launching a BPT process, calling a consumed web service that calls back, triggering an ODC event, waking a timer that processes the new rows. Otherwise, on Read Committed databases and in ODC, the other side doesn't see the rows yet (or waits on your locks). Required by the docs for processes and web services on Oracle/PostgreSQL; do it everywhere so code is portable.
- **BTX-06** No external call (REST, SOAP, email, SMS, file store) while the transaction holds row locks or after a `Get…ForUpdate`. Commit first, or write an **outbox** row in the same transaction and let a timer send it (async-processing.md §4). Otherwise: long locks, and an external side effect that a rollback can't undo.

## 6. Concurrency (`BTX-04`)
| Situation | Pattern |
|---|---|
| Two users edit the same record | **Optimistic**: the client gets `UpdatedOn` (or a `Version` integer) with the record and sends it back; `_Logic` compares with the stored value and returns `ActionResult` code `CONCURRENT_UPDATE` if different. |
| Sequence numbers, counters, balances, stock, quota | **Pessimistic**: `Get<Entity>ForUpdate(Id)` locks the row until the transaction ends. Keep the window short; no external calls inside it. |
| "Only one may exist" (one open request per customer) | **Unique index** + catch the database exception → `ConflictException` / `ActionResult` code. Never only "check then insert". |
| Status transition races (approve vs cancel) | Conditional update: re-read with `ForUpdate`, check the current status, then update. |
| Reference numbers (`REQ-2026-000123`) | A `Sequence` entity per prefix/year, incremented with `GetSequenceForUpdate` in the same transaction as the insert. Never `MAX(Id)+1`. |
| Serialize a whole operation (one import per customer at a time) | **Semaphore entity**: one row per key; `Get…ForUpdate` on it at the start; other requests wait. Protects only code that follows the convention. |

`Get<Entity>ForUpdate` facts: it is the only locking primitive the platform gives; it locks **one row** for update/delete (others can still read it); the lock lasts until the **transaction** ends (end of request, or `CommitTransaction`). It can't hold a record while a user is editing a screen — that's what the optimistic check is for. Duplicate rows from concurrent API calls are stopped by a unique index, not by checking first.

## 7. Idempotency (`BTX-05`)
Anything that may run twice must produce the same result:
- **Timers** (platform retries failed runs), **BPT activities** (retried on error), **Service Actions** after a `CommunicationException`, **exposed APIs** (client retries), **double clicks**.
- Techniques: natural key + unique index; an **idempotency key** (client- or caller-generated GUID stored with the result; a repeated key returns the stored result); state checks ("already Submitted → return success with the same id"); upserts by external id in sync jobs.
- Outbound calls that create things at the provider send an idempotency key when the provider supports it.

## 8. State transitions and workflows (`BLG-05`)
- Status is a **static entity** (`RequestStatus`), referenced by record name, never by literal id (`DAT-07`).
- Keep a **transition table** — in code (one action per transition with an explicit "from" check) or in an entity `RequestTransition {FromStatusId, Action, ToStatusId, RoleName}` for configurable flows.
- One action per business event: `Request_Submit`, `Request_Approve`, `Request_Reject(Reason)`, `Request_Return(Comment)`. No `Request_SetStatus(StatusId)` reachable from the client.
- Each transition writes a `RequestHistory` row (status, actor, timestamp, comment) in the same transaction.
- Side effects (notifications, integrations) are enqueued, not executed inline (§5 `BTX-06`).
- BPT: use for long-running, human-in-the-loop workflows with waits and timeouts; keep automatic activities small and idempotent; process in a Core module next to the entity. For simple "on create, do X" use **Light BPT** (an event-triggered process with one automatic activity).

## 9. Read actions and pagination (`BLG-10`)
- Return purpose-built Structures (`Summary` for lists, `Detail` for one record). Never entity records to the client (`DAT-04`, `PERF-10`).
- Lists take `StartIndex` and `MaxRecords` (cap `MaxRecords` on the server, e.g. 100) and return `TotalCount`. Sort fields come from an allow-list, never raw text into SQL.
- Filter by the user **inside** the query (`GetUserId()`, ACL join), not after fetching.
- `_Get` raises `NotFoundException` when the record is missing **or** not visible — same message, so ids can't be probed.

## 10. Functions, reuse and flow style
- **BLG-06** Business rules only in BL. CS: invariants. IS/API: mapping and transport. SQL: data shaping only.
- **BLG-07** `Function = Yes` only for pure, cheap calculations (no queries, no writes, no integration calls), since functions are evaluated wherever the expression is used — including inside loops and per row.
- **BLG-08** Expected business outcomes → `ActionResult` codes. Unexpected → exceptions. Don't return a `Success` boolean that callers can ignore for unexpected failures.
- **BLG-09** One rule, one place: extract shared logic to a private action (`MNT-01`) instead of copying flows between Create and Update.
- Flows top-to-bottom, error branches to the right, labelled Ifs and Assigns, actions under ~40 nodes (`MNT-03`).

## 11. ODC notes
ODC has no modules: the units are **apps** (Web, Mobile, Workflow, Agentic) and **libraries**. The same intent applies, with these differences (official *ODC for O11 developers*, *Service actions*, *Implement events*, *Use timers*):

| O11 | ODC |
|---|---|
| Modules in an app, strong references | Apps deploy alone; **libraries** are versioned, released in the Portal, and bundled into each consuming app |
| Public server actions anywhere | Public server actions **only in libraries** (Foundation-like, stateless). Between apps, use **Service Actions** (same portfolio) or REST |
| Entities Public + Expose Read-Only | Public entities of an app are **always read-only** to consumers. Cross-app references get delete rule **Ignore** and **no database FK**: check existence and clean up orphans in logic |
| Site properties | **Settings** per stage, read-only at runtime, changed only in the Portal; **secret** settings for credentials |
| Extensions (C#) | **External libraries** (C# SDK), with their own execution and payload limits |
| BPT / Light BPT | **Workflows** for human processes; **events** for event-driven async work; **timers** |
| DB isolation varies | Read committed: commit before triggering an event that reads your data (`BTX-07`) |

Rules:
- Every cross-app call is remote: Service Action rules (own transaction, idempotency, small payloads, compensation, `CommunicationException`) apply to all of them. Prefer structures over entities in their signatures.
- **Events** (`BAS-09`): parameters of basic types only (pass ids, not records), payload ≤ 10 KB, handlers order-independent, idempotent and finished within 2 minutes, `All Exceptions` handled on both sides.
- **Timers**: 20-minute default timeout; 3 automatic retries that you **can't** change, each resetting the timeout (worst case 4 × timeout); one instance per timer at a time. Same batch / checkpoint / wake pattern (`BAS-01`, `BAS-07`).
- Client-called server logic has a request timeout (default 10 s, raise to at most 60 s): anything longer goes async (queue entity + event + polling), as the official AI-call pattern shows.
- Platform limits (exposed REST method, service action wait, external library calls, event queue size) change between releases: read the current ODC limits page before designing around a number.
