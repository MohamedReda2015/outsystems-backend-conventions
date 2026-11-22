# Server-side security

Rules: `BSC-01` … `BSC-11`. This file is the backend checklist; the threat model and the full rules are in the architecture skill's security reference (`SEC-01` … `SEC-14`). **Security rules are never relaxed by project precedence** — flag and ask.

## Contents
1. What is exposed
2. Authorization in every entry point
3. Identity
4. Inputs
5. Outputs
6. Secrets and sensitive data
7. Public (Anonymous) endpoints
8. Exposed APIs, uploads, tenants
9. Security tests

## 1. What is exposed
In Reactive and Mobile apps, **every** screen aggregate, data action and server action the client can call is a REST endpoint. It is protected only by the screen's roles and accepts any parameters the caller sends. Service Actions are reachable by any module in the environment that references them. Exposed REST APIs are reachable by whatever the network allows. Design every entry point as if it were called directly with hostile input.

## 2. Authorization in every entry point (`BSC-01`, `SEC-01`)
Each BL entry point reachable from a client, another app or an API checks, on the server:
1. **Role**: `Check<Role>Role(GetUserId())` — raise `NotAuthorizedException` if missing.
2. **Record access**: ownership (`Record.OwnerUserId = GetUserId()`), ACL join, organizational scope (same department/branch), or tenant — **inside the query**, so a foreign id returns nothing (`NotFoundException`).
3. **State**: the action is allowed in the record's current status.
- CRUD wrappers don't check roles; they must therefore never be reachable from client logic (`DAT-01`, architecture security §2).
- Client-side role checks and hidden buttons are UX only.
- Admin overrides are explicit actions with their own role and an audit entry, not a flag parameter.

## 3. Identity (`BSC-02`, `SEC-09`)
- `GetUserId()` is called **inside** server logic. Never a `UserId`, `CurrentUserId`, `TenantId`, `IsAdmin`, `Role` or `ActorId` input on a client- or API-reachable action.
- Timers and processes have no user. Use an explicit system actor for audit columns. If they call BL actions that check roles, use a same-module private `_Logic` entry or a deliberately restricted background contract with explicit tenant/system context and current-state checks; prefer this to creating a synthetic interactive login — never remove the role check from the public action to make a timer work.
- External users without a platform user: resolve the actor from the authenticated session/token on the server (e.g. `IDP:<externalId>`), never from a parameter; compare it with the record's owner on every call.

## 4. Inputs (`BSC-04`, `SEC-02`, `SEC-08`)
- Revalidate everything (business-logic.md §4). Lengths and ranges matter: an unbounded `MaxRecords` or a 5 MB text is a denial-of-service.
- Mass assignment: use-case inputs only (`BLG-03`, `SEC-11`).
- SQL: parameters; Expand Inline only with `BuildSafe_InClause*` / `EncodeSql` on literals; allow-listed sort columns (`BDA-04`).
- Never build URLs, file paths, LDAP/XPath queries or shell commands from input (`BIN-09`).
- Deserialize JSON only into known Structures.

## 5. Outputs (`BSC-10`)
- Output Structures contain only what **this** caller may see. No password hashes, OTP codes, tokens, internal flags, other users' personal data, cost prices for customers, etc.
- Don't return entity records to the client; aggregates on screens fetch only used attributes, but data actions and server actions return whatever the Structure holds.
- Error outputs never include internals (`BER-04`).

## 6. Secrets and sensitive data (`BSC-03`, `BSC-06`, `SEC-03`, `SEC-06`)
- No secrets in code, JavaScript, SQL, descriptions, logs, URLs or test data. Secret site properties: **Is Secret = Yes**; or ODC secret settings; or an encrypted config entity on old platforms.
- Passwords are never stored by your app; use the platform's user management or the IdP.
- OTPs and reset tokens: random, single-use, short expiry, stored **hashed**, attempts limited.
- Sensitive personal data (national id, health, financial): encrypt at rest where policy requires (database TDE or field-level with a managed key), mask in UI and logs, restrict by role, audit access.
- Data minimization: don't store what you don't need; purge per retention (`BDA-11`).

## 7. Public (Anonymous) endpoints (`BSC-05`, `SEC-08`)
- Each must be safe with **any** input: no reading or changing data that isn't the caller's.
- Rate-limit (per IP / per identifier) login, OTP send/verify, registration, password reset, public search and contact forms; add CAPTCHA where abuse is likely.
- Don't reveal whether an account or record exists in error messages.
- No system entities (Users) in aggregates on Anonymous/Registered screens (`SEC-10`).

## 8. Exposed APIs, uploads, tenants
- **BSC-08** Exposed REST: TLS, authentication (or Internal Access Only), per-method exception handling, no internal details (integrations.md §9, `SEC-12`).
- **BSC-11** Exposed REST is **not secured by default**: an empty `OnAuthentication` publishes the data, with no warning. Prove it before release: every method called without credentials returns `401`; authorization per method and per record; one credential per consumer, stored hashed and revocable; expiring tokens; JWT signatures verified on every call (integrations.md §9).
- **BSC-07** Uploads: server-side type allow-list (by content, not only extension), size limit, antivirus scan **before** storing the binary, stored in an extension entity or object storage; filenames sanitized (`SEC-04`).
- **BSC-09** Multi-tenant: no `TenantSwitch()` or Show Tenant Identifier outside approved admin apps; tenant never taken from input (`SEC-05`).

## 9. Security tests (`TST-02`)
For each client-reachable BL action, test: no session; user without the role; user with the role but **another user's record id**; tampered status/state; oversized and malformed input; replay (idempotency); SQL meta-characters in every text input.
