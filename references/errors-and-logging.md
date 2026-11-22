# Error handling and logging

Rules: `BER-01` … `BER-08`, `BLG-08`. Builds on the architecture skill's `DAT-08`, `SEC-06`, `AUD-01`…`AUD-03`.

## Contents
1. Two kinds of failure
2. The ActionResult contract
3. The standard exception set
4. Where to handle
5. Handler rules
6. Messages
7. Logging
8. Audit vs log

## 1. Two kinds of failure (`BLG-08`, `BER-05`)
| Kind | Examples | Mechanism |
|---|---|---|
| **Expected business outcome** — the caller must branch or show it to the user | validation errors, "request already submitted", "budget exceeded", concurrent update | Return **`ActionResult`** with codes |
| **Unexpected failure** — a bug, an outage, a broken invariant, an authorization breach | DB error, integration down, null where impossible, user without role calling the action | **Raise an exception**; handled at the boundary, logged once |

Never use exceptions for normal control flow in loops, and never return a `Success = False` for an outage that callers might ignore.

## 2. The ActionResult contract
Defined once in the app's `_BL` (or a shared `_Lib`), the same shape the frontend skill maps onto forms:
```
ActionResult        IsSuccess: Boolean · Message: Text (user-facing, translated) · Code: Text
                    Errors: ValidationError List
ValidationError     Field: Text (input name, e.g. "DeliveryDate") · Code: Text (e.g. "DATE_IN_PAST")
                    Message: Text (user-facing)
```
- Codes are stable, UPPER_SNAKE, documented in the action's description (`Returns ActionResult codes: REQ_LOCKED, CONCURRENT_UPDATE`).
- Use-case actions that also return data return `ActionResult` + the data output (`RequestId`).
- Across **Service Actions**, `ActionResult` is the only reliable way to tell the caller *which* business error happened.

## 3. The standard exception set (`BER-01`)
Per BL module (user exceptions):
| Exception | Raised when | Typical handling at boundary |
|---|---|---|
| `ValidationException` | input invalid and the caller didn't use `_Validate` first | show message / map to 400 |
| `NotFoundException` | record missing **or not visible** to this user | "not found" / 404 |
| `NotAuthorizedException` | role or ownership check failed | generic "no permission" / 403; log as security event |
| `ConflictException` | state conflict, duplicate, concurrency | message / 409 |
| `BusinessRuleException` | a rule violated deep in `_Logic` where returning a result is impractical | message / 422 |
Per `_IS`: `<Concept>IntegrationException` (message safe for users, external code in the log). Platform exceptions you'll also meet: `Database Exception`, `Communication Exception` (Service Action / REST timeouts), `Security Exception` (no session/role), `All Exceptions`.

## 4. Where to handle (`BER-03`)
Handle at **boundaries** only, so each failure is logged exactly once:
- Client-called server actions in CW / FE (translate to feedback; the UI flow's OnException is the safety net).
- Exposed API methods (each method, mapping to status codes).
- Timer entry actions (`Timer_<Job>`) and per-record loops inside them.
- BPT activities.
- Consumers of Service Actions (catch `CommunicationException`, translate).
**BER-08**: the module's global exception handler (`OnException` of the Common flow) covers screen requests only. **Timers, BPT activities and exposed REST methods** need their own handlers in the entry action; otherwise an error just interrupts the run and is logged by the platform with no recovery, status update or translated response.

**BER-07**: server-side logic never calls `FeedbackMessage` or other UI actions: the same action may be called by a timer, an API or another app. Return `ActionResult` or raise; the UI decides how to show it.

Inside BL `_Logic` and CS, **don't catch** just to re-raise or log — let it propagate. Catch only to add information (then raise a more specific exception), to compensate, or to convert an expected database error (unique index violation → `ConflictException`).

## 5. Handler rules (`BER-02`, `DAT-08`)
- Order: specific user exceptions → `Database` / `Communication` → `AllExceptions` last.
- **Never empty.** A handler logs, translates, compensates or re-raises.
- Abort Transaction = Yes in write flows (the default). Set it to No only for read-only flows or after deliberately compensating.
- Log failure details **before** or **outside** the rolled-back transaction (platform log survives; your own entity rows don't) — see business-logic.md `BTX-03`.
- Per-record handlers in batches: catch, mark the record failed with the error, continue (async-processing.md).

## 6. Messages (`BER-04`)
- User-facing: what happened + what to do, in business language, translated. "This request was already approved by someone else. Refresh to see the latest version."
- Never to clients or API consumers: `ExceptionMessage` of `AllExceptions`/`DatabaseException`, stack traces, SQL text, table names, provider responses, internal ids of other users.
- `NotAuthorized` and `NotFound` messages don't reveal whether a record exists.

## 7. Logging (`BER-03`, `BER-06`, `SEC-06`)
One standard logging action in a Foundation library (e.g. `Log_Lib.Log_Error`, `Log_Warning`, `Log_Info`), wrapping the platform `LogMessage` or an audit library, with:
- module, action, severity, message;
- **correlation id** (from the API header, the outbox row, or generated at the entry point) and the platform request key where available;
- user / actor;
- key inputs, **masked** (ids yes; national id, phone, email, card, tokens: masked or omitted);
- for integrations: system, operation, status, duration.
Rules:
- Log once, where handled; don't double-log on re-raise.
- No secrets, tokens, passwords or full personal data — ever.
- Info-level logging is switchable per module (config) so production isn't flooded.
- Monitor Service Center Errors / Integrations / Timers logs; export logs if they must be kept beyond the default retention (`AUD-03`).

## 8. Audit vs log
- **Log** = for operators (diagnosis). Retention short. Not a business record.
- **Audit** = for the business/compliance: who did what, when, before/after. Written by CRUD wrappers and transitions (`<Entity>History`, Audit_Lib), with its own retention and access roles (`AUD-01`). See the architecture skill's audit-trail reference.
