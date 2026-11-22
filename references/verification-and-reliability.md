# Backend reliability and evidence

Use when a write can race, be retried, cross a transaction boundary or consume uncertain source data. These are design and verification patterns; validate SQL dialect and installed action contracts before implementation.

## Atomic concurrency (BRV-01)

A read/compare/update sequence without a lock permits two requests to pass the same comparison. Use either:

1. a conditional update with `Id = @Id AND Version = @ExpectedVersion`, incrementing Version and checking that exactly one row changed; or
2. `Get<Entity>ForUpdate`, then compare version/state and authorize the record inside the same transaction before writing.

Keep the invariant and history/outbox writes in that transaction. A lock in a separate Service Action ends when that call returns and does not protect the caller's later update. Lock related rows in a stable order. For absent-row uniqueness use a database unique key; locking a row that does not exist is not sufficient. Timestamp versions require verified database/serialization precision; a monotonic integer is easier to reason about.

Acceptance: race two edits and approve versus cancel. Exactly one incompatible transition succeeds; the other returns a stable conflict code without duplicate history or notifications.

## Idempotency and ambiguous outcomes (BRV-02)

For a retryable command, scope the idempotency key by tenant/principal and operation, store a request fingerprint and enforce uniqueness. Repeating the same key and payload returns the original outcome. Reusing it with a different payload is rejected. Use pending/completed/failed states and a recovery lease where necessary; retain keys for the documented retry period.

A timeout does not prove failure: the remote Service Action/provider may have committed. Reconcile by key or provider reference before retrying a non-idempotent action. A new key on every retry defeats deduplication. A UI busy flag improves UX but does not protect the server.

Outbox pattern: commit business changes **and the delivery intent** together; a worker atomically claims due work, delivers with a stable provider key, then records completion. A crash after delivery but before acknowledgement causes redelivery, so this is at-least-once delivery, not an exactly-once guarantee. Recover expired claims and alert on oldest pending age, attempts and dead letters. Do not hold row locks over slow network calls.

## Transaction map and result contract (BRV-03)

Mark each Server Action, Service Action, explicit commit/abort, CMF/BPT action with commit behavior, and external connection. One wrapper or one HTTP round-trip does not imply one transaction. Ensure newly added framework calls do not commit earlier writes unexpectedly.

Use `ActionResult {IsSuccess, Code, Message, Errors[{Field, Code, Message}]}` for expected outcomes; keep any correlation/idempotency metadata as documented optional fields. Codes are stable and not localized. Existing public contracts require compatible extensions/versioning, not silent rewrites.

Returning `IsSuccess = False` after a write still allows normal request commit. Validate before mutation, or deliberately roll back the failed unit before returning the result. An aborting handler only rolls back since the last commit; it cannot undo a completed Service Action or provider request. Test failure after each durable boundary.

Do not apply a blanket `CommitTransaction` before every event or launch. Determine receiver visibility and the installed API's trigger semantics. Where a commit is required before dispatch, define recovery for 'business write committed, dispatch failed'; a durable dispatch intent usually makes that recovery explicit.

**Verified ODC exception:** current official event documentation requires committing data created in the same transaction before triggering an event that depends on it. Preserve a durable dispatch intent and recovery for a failed trigger after that commit; do not claim the event and business write are atomic.

## Authorization and data meaning (BRV-04)

- Derive caller identity/tenant on the server; validate each referenced parent, child, file and activity belongs to the authorized scope. A user-supplied idempotency key is a request identifier, never an identity credential.
- Background jobs use an explicit trusted system/initiator context. Stored initiator identity is audit provenance, not proof that their old authorization is still valid. Recheck current business state and tenant scope. Keep privileged background entry points inaccessible to client callers; do not remove public authorization to make a timer work.
- Distinguish master IDs, snapshot IDs and external IDs in DTOs and mapping specs. For historical views, join through the submission snapshot, with an explicit as-of rule. A field whose source is unverified remains unavailable.
- Lists use a deterministic sort with a unique tie-breaker, bounded page size and matching authorization/filter predicates for page and count. Keyset pagination can help large changing datasets; choose it deliberately.
- Parameterize values. Map sort/filter identifiers to server-owned SQL fragments. `EncodeSql` escapes string literals; it does not make an arbitrary ORDER BY or SQL fragment safe.
- Treat UTC instants, local date-only values, business calendar timezone, money precision/currency and null/unknown values as distinct contracts. Do not substitute zero for missing money or an empty string for an unknown date.

## Verification matrix

Test an unauthorized role and another tenant/owner; two simultaneous writes; repeated key with same and different payload; timeout after remote commit; rollback after partial mutation; worker crash after send; stale claim recovery; and a historical record whose current master data has changed. Inspect stored data and side effects, not only the response message.

## Sources and provenance

- [Official ODC event implementation](https://success.outsystems.com/documentation/outsystems_developer_cloud/building_apps/about_event_driven_architecture/implement_events_in_odc/), checked 2026-11-22: commit-before-trigger requirement for same-transaction data, event payload and handler constraints.

- [Handling transactions](https://github.com/OutSystems/docs-product/blob/master/src/ref/data/database/handling-transactions.md) and [Service Actions](https://success.outsystems.com/documentation/11/building_apps/reusing_and_refactoring/use_services_to_expose_functionality/): platform transaction boundaries; reliability designs above are engineering consequences, not additional platform guarantees.
- [Dynamic SQL guidance](https://success.outsystems.com/documentation/11/building_apps/data_management/data_operations/best_practices_for_building_dynamic_sql_statements/) and [SQL Injection Warning](https://success.outsystems.com/Documentation/11/Reference/Errors_and_Warnings/Warnings/SQL_Injection_Warning/).
- Anonymized prior-project evidence reviewed 2026-11-22: request-snapshot identity confusion, incomplete imported entity attributes, current-assignee filtering and required-comment validation. Preserve these checks without copying domain names or production data.
