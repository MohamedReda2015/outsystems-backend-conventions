# Integrations: consuming and exposing services

Rules: `BIN-01` … `BIN-11`, plus `BNM-08` and `BSC-11` for exposed APIs. Builds on the architecture skill's `INT-01`…`INT-06`, `SEC-12` and its integration-and-caching reference (patterns: direct, cold cache + sync, isolated sync, lazy load, transparency service).

## Contents
1. Where integration code lives
2. The wrapper canvas, step by step
3. Consumed REST in practice
4. Timeouts, retries and circuit breaking
5. Authentication and secrets
6. Errors
7. Logging and auditing
8. Async integrations (outbox)
9. Exposed REST APIs
10. SOAP, files, email and SMS
11. Testing and non-production

## 1. Where integration code lives (`BIN-01`)
```
<App>_BL / Integrations/<Concept>   orchestration: decides WHEN to call, maps IS ↔ BL Structures
   │
<Concept>_IS  (Foundation)          the HOW: transport, auth, mapping, errors, timeouts, logging
   │
external system
```
- One `_IS` **per business concept** (`Customer_IS`), not per system; a concept spread across systems can be merged here, and a system serving many concepts is split across several IS modules.
- The consumed REST/SOAP definitions are **private** inside the `_IS`; only the wrapper actions and normalized Structures are public (`INT-02`).
- No business rules in `_IS` or `_API` (`INT-04`): no "if VIP then…", no status transitions.
- **Only what the app needs leaves the IS** (`BIN-12`): if the API returns 30 fields and the app uses 4, the public structure has 4 attributes, in real types (text dates → Date Time, numeric text → Integer/Decimal, "Y"/"N" → Boolean). The raw response, JSON text and HTTP status codes never appear in a public output. When the app later needs a field, add it to the structure and map it; never switch the output to the imported structure "to get everything".
- Review severities (`BIN-12`): Core or End-User referencing an imported structure or a consumed method directly is **Critical**; unused attributes, text-typed dates or numbers, or status-code / `Success`+`ErrorMessage` outputs are **Major**.

## 2. The wrapper canvas (`INT-03`)
Each public `_IS` action (`Customer_IS_GetProfile`) does, in order:
1. **Validate** inputs (mandatory, formats). Raise `ValidationException`.
2. **Authenticate**: get a token (cached until expiry) or prepare headers; read credentials from config.
3. **Map in**: normalized input Structure → external request.
4. **Call + audit**: one call with an explicit timeout; log per the logging policy (§7).
5. **Normalize errors**: status codes and error bodies → `<Concept>IntegrationException` (or more specific) with a safe message and the external code.
6. **Map out**: external response → `<Concept>_IS_<Purpose>` Structure. Units, dates (UTC), enums and nulls normalized here.
7. **Return**. Exception handling is left to the caller unless the IS must audit failures.

## 3. Consumed REST in practice
- Base URL as an **Effective URL** set per environment in Service Center, or from a config site property — never typed into methods for production.
- `OnBeforeRequest`: add auth headers, correlation id (`X-Correlation-Id`), `Accept-Language`; never log the request here.
- `OnAfterResponse` (`BIN-11`): by default the platform raises a generic exception for any non-2xx status, and the provider's error body is lost. Instead:
  1. add the provider's error structure to the API (it is often documented on a separate page);
  2. in `OnAfterResponse`, when `StatusCode >= 400`, deserialize `ResponseText` into that private structure;
  3. raise the normalized exception (§6) with the provider code kept for the log.
  **Never "silence" errors** by rewriting the status code to 200 so no exception fires: every caller then has to remember to check an error field, and most won't (the official blog calls this bad practice).
- For integration actions, the platform usually can't tell you the exception type: catch with `All Exceptions` inside the `_IS` and inspect `ExceptionMessage` only to normalize.
- Rename generated methods and structures to meaningful names; keep generated types private.
- Pass dates in ISO-8601 with offset; parse defensively (optional fields, unknown enum values → `Unknown`).
- Large payloads: page them (`page`, `pageSize`, `continuationToken`) and loop in a timer, not in a user request.

## 4. Timeouts, retries and circuit breaking (`BIN-02`, `BIN-05`)
- Set the **timeout on every method** (the default is long). Budget: ≤ 10 s when a user is waiting (`PERF-16`), ≤ 30 s in background jobs. Read it from a site property (`CrmTimeoutSeconds`).
- Retries: only on **transient** failures (timeout, 429, 502/503/504), only for **idempotent** calls (GET, PUT with full state, or calls with an idempotency key), at most 1 retry in a user request and a small bounded number (e.g. 3, exponential backoff) in background jobs. Respect `Retry-After`.
- Never retry 4xx validation errors.
- Fragile providers: a simple **circuit breaker** — count consecutive failures in a small entity or cache; when over a threshold, fail fast for N minutes with a friendly "service temporarily unavailable" and let async work wait.
- After a timeout on a **non-idempotent** call, the outcome is unknown: reconcile (query by your reference) before retrying.

## 5. Authentication and secrets (`BIN-03`, `SEC-03`)
- Secrets in site properties with **Is Secret = Yes** (O11 Platform Server 11.25+) or ODC secret settings; on older platforms an encrypted config entity decrypted only on the server.
- Reuse a shared configuration/IdP module's public `GetConfig`-style actions instead of copying secrets — and reference **only** those actions (lesson `BLL-07`).
- OAuth client-credentials tokens: cache with expiry (entity or cache-in-minutes action keyed by client), refresh shortly before expiry, never per call.
- No credentials in URLs or query strings; no secrets in logs or exception messages.
- HTTPS only; don't disable certificate validation.

## 6. Errors (`BIN-04`)
| External result | Normalized to |
|---|---|
| 400 / 422 with field errors | `ValidationException` (or return codes) with mapped fields |
| 401 / 403 | `<Concept>IntegrationException` code `AUTH_FAILED` (log, alert ops — usually config) |
| 404 | `NotFoundException` or empty result, per contract |
| 409 | `ConflictException` |
| 429, 5xx, timeout | `<Concept>IntegrationException` code `UNAVAILABLE` (retryable) |
| malformed body | `<Concept>IntegrationException` code `BAD_RESPONSE` |
Users see a business message ("We couldn't reach the customer system. Try again in a few minutes."), never the provider's text or HTTP details.

## 7. Logging and auditing (`BIN-06`)
- Service Center sets a **logging level** per consumed or exposed REST API and SOAP service (official levels):
  | Level | Logs | Use |
  |---|---|---|
  | **Default** | only requests that fail | Production |
  | **Troubleshoot** | failures plus the HTTP trace | short diagnosis |
  | **Full** | every request and response plus the trace | Dev/QA, or a short window in Production |
  Higher levels store input and output **parameter values** in the environment database, where anyone with Service Center access can read them. For consumed REST, configure **input redaction** for sensitive parameters *before* raising the level, and set the level back afterwards (`BIN-06`).
- Log in your own integration log (if required for compliance): system, operation, correlation id, duration, status, your reference id — payloads masked.
- Send and store a **correlation id** so one business operation can be traced across apps and providers.

## 8. Async integrations (outbox) (`BIN-08`, `BTX-06`)
For calls the user needn't wait for, or that must survive outages (notifications, pushing data to ERP):
1. In the business transaction, insert a `<Concept>Outbox` row (`Operation`, `PayloadJson` or keys, `Status = Pending`, `Attempts = 0`, `NextAttemptOn`, `IdempotencyKey`).
2. Wake the sender timer (`Wake<Timer>`) after commit, or let it poll.
3. The timer sends in batches, marks `Sent` / increments `Attempts` with backoff / moves to `Failed` after max attempts, and logs.
4. A back office shows failed rows with a "retry" action.
The business transaction never fails because the provider is down, and nothing is sent for a rolled-back transaction.

## 9. Exposed REST APIs (`BIN-07`, `SEC-12`, `INT-06`)
- In a `<Concept>_API` module. Each method: authenticate → validate input → call **BL** → map to API Structures → set status code. No logic of its own.
- Authentication: OAuth/JWT validation or API key in a header via **Custom** authentication (`OnAuthentication`), or Basic over TLS for system-to-system; **Internal Access Only** for in-network consumers. Never "None" on the internet.
- Catch exceptions **in each method** (there is no global handler): map `ValidationException` → 400 with field errors, `NotAuthorized` → 403, `NotFound` → 404, `Conflict` → 409, others → 500 with a correlation id and **no** internal details.
- One consistent error body: `{ "code", "message", "correlationId", "errors": [{ "field", "code", "message" }] }`.
- Versioning: path `/v1/…`. Optional new fields are non-breaking; removed/renamed/mandatory fields → `/v2`, keep `/v1` until consumers move, then deprecate.
- Rate-limit or throttle public APIs; support idempotency keys on `POST` that creates things.
- **Hardening (`BSC-11`)**: exposed APIs are *not* secured by default — leaving `OnAuthentication` empty publishes the data. Before release:
  1. call every method **without credentials** and expect `401`;
  2. authorize per method **and per record** (the caller's account may read only its own data), in a reusable server action;
  3. one credential per consuming system, stored **hashed** (an API-key entity, not one shared site property), revocable;
  4. tokens expire; JWT **signatures are verified on every call** before trusting any claim (no native JWT support: use a vetted Forge component or library);
  5. HTTPS only, generic error bodies, no keys or tokens in logs.
- For Reactive role checks inside API logic, the API's `OnAuthentication` can log in a **service account** mapped to the consumer (Synobsys pattern), so `Check<Role>Role(GetUserId())` works the same way as for screens.
- **Resource design (`BNM-08`)**: plural nouns and no verbs in paths (`/v1/requests`, `/v1/requests/{id}`); HTTP verbs for actions on them; the version first and mandatory; filters in the query string; `limit` and `offset` for paging; a small set of status codes (200, 201, 400, 401, 403, 404, 409, 500); one structured error body.
- Document the API (OutSystems generates OpenAPI): descriptions on every method, parameter and attribute.

## 10. SOAP, files, email and SMS
- SOAP: same canvas; map SOAP faults in the IS; never expose generated SOAP structures.
- Files from external systems: validate type and size, virus-scan, store in an extension entity or object storage (keep only the reference on the main entity).
- Email/SMS: one `_IS` per gateway, number/address normalization in one place, templates in config entities, sending through the outbox, and a **test-override** site property (send everything to one test recipient) that is empty in production (lesson `BLL-06`).
- **SSRF** (`BIN-09`): never call a URL built from user input; allow-list hosts; resolve callbacks from configuration.

## 11. Testing and non-production (`BIN-10`)
- Each `_IS` can switch to a **mock** implementation (`<Action>_Mock`, selected by a site property empty in production) so BL and UI work while the provider is unavailable — and mark unknown fields `NOT FOUND` rather than inventing data (lesson `BLL-05`).
- Before debugging your code for an auth/SSO failure, reproduce it with an existing app that uses the same provider; the environment's registration may be the problem (lesson `BLL-08`).
- Register callback URLs with the provider for **each** environment.
