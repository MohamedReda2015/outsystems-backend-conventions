# Backend lessons learned (BLL)

Collected from enterprise OutSystems 11 Reactive builds (request and file-exchange portals, executive dashboards, case management, government e-services). Names are generalized and no client data is included. Each lesson: problem → cause → rule. Add new lessons at the end with the next number; never renumber.

## Process
- **BLL-01 "Done" from memory was wrong.** Elements reported as created didn't exist or didn't validate. *Rule*: after every change, read the element back from the platform, check TrueChange errors and warnings, and exercise it. Report only what you verified.
- **BLL-02 Flat modules became unreviewable.** Eighty actions in the module root. *Rule*: create folders first (CRUD apart from workflow, ServiceActions apart from PrivateActions, Structures by concept), then the elements.
- **BLL-03 Duplicated helpers and structures.** A new `ActionResult`, a new logging action and a new phone formatter were created next to existing ones. *Rule*: inventory the module and its dependencies first; reuse before creating.

## Data and logic
- **BLL-04 Audit columns drifted.** Callers and the CRUD wrapper both set `UpdatedOn`/`UpdatedBy`, with different time zones and actors. *Rule*: only the wrapper sets audit columns; callers pass business data only (`BDA-02`).
- **BLL-09 Soft delete leaked deleted rows.** After adding `IsDeleted`, joined child lists and a lookup used by another flow still showed deleted rows. *Rule*: Find Usages on the entity and fix every read in one change; outer joins use `Child.Id = NullIdentifier() or not Child.IsDeleted`; lint SQL with `--soft-delete` (`BDA-06`).
- **BLL-10 Half-saved requests.** A submit flow called three Service Actions in a row; the third failed and the first two stayed committed. *Rule*: thin Service Action → one private `_Logic` Server Action holding all steps in one transaction (`BTX-01`).
- **BLL-11 Binaries slowed every list.** File content stored on the main entity made list aggregates heavy. *Rule*: 1-to-1 `<Entity>Content` extension, written only after the antivirus scan passes (`BDA-10`).
- **BLL-12 A built-in helper wasn't available.** `GenerateGuid` / `BinaryDataSize` were missing without an extra dependency in one environment. *Rule*: confirm a helper exists before designing around it; fallbacks: SQL `NEWID()`/`CRYPT_GEN_RANDOM`, `DATALENGTH`, or a small `_Lib` action.
- **BLL-13 Guessed model details were wrong** (sort direction, join type, delete rule). *Rule*: read back an existing element that already does the same thing, and copy its shape.
- **BLL-14 Reference numbers collided.** `MAX(Id)+1` generated duplicate request numbers under load. *Rule*: a `Sequence` entity incremented with `Get…ForUpdate` in the same transaction (`BTX-04`).

## Integrations
- **BLL-05 Invented source data.** Fields with an unknown source were filled with plausible values and nearly reached UAT. *Rule*: mark them `NOT FOUND`, keep a `_Mock` provider behind a switch, and resolve the real source before release (`BIN-10`).
- **BLL-06 SMS gateway confusion.** Several gateways existed; only one login + send pair actually delivered, and only with numbers in international format without "+" and the right message category. *Rule*: one `_IS` per gateway, number formatting in one place, test end-to-end, and a test-override recipient property that is empty in production.
- **BLL-07 Copying IdP secrets.** The identity provider config (client id, encrypted secret) already existed in a shared module; copying it into site properties duplicated secrets. Referencing *all* of that module's public elements pulled in tenant-specific entities and broke the build ("Show Tenant Identifier" reference errors). *Rule*: consume only the shared `GetConfig`-style actions you need.
- **BLL-08 SSO failure was environmental.** A staging client registration was invalid for every app. *Rule*: reproduce with an existing app on the same provider before debugging your code; register each environment's callback URL.
- **BLL-15 Generated REST structures leaked.** BL and CW used the `_IS` generated types; a provider field rename broke three modules. *Rule*: normalized `_IS` structures only (`INT-02`).
- **BLL-16 Default REST timeout froze screens.** A slow provider held user requests for the platform default timeout. *Rule*: explicit per-method timeouts from config; async for slow providers (`BIN-02`, `BIN-08`).

## Async
- **BLL-17 Timer reprocessed data.** A sync timer timed out after 20 minutes, the platform retried it, and it started again from the beginning, sending duplicate notifications. *Rule*: checkpoint + commit per batch, logical timeout + re-wake, idempotent sends via outbox (`BAS-01`, `BAS-03`).

## Tooling
- **BLL-18 Automation on very large modules.** Modules around 10 MB took minutes to open or change through the Service Studio MCP / Model API and sometimes failed. *Rule*: make those changes by hand, or build the piece in a small module.

## Community-reported (research, November 2026)
These come from published experience reports and forum threads (see `research/sources.md`), not from our own projects.
- **BLL-19 An exposed API returned customer data to anyone.** `OnAuthentication` was never implemented and the platform gave no warning; an enterprise review found it. *Rule*: call every exposed method without credentials before release and expect 401 (`BSC-11`).
- **BLL-20 Silenced REST errors hid failures.** Rewriting non-2xx status codes to 200 in `OnAfterResponse` stopped exceptions, and callers that didn't check the error field treated failures as success. *Rule*: parse the error body and raise a specific exception (`BIN-11`).
- **BLL-21 A timed-out timer left records stuck "In Progress".** A platform timeout can't be caught, so claimed records were never released. *Rule*: record claim time and recover stale claims at the start of each run (`BAS-07`).
- **BLL-22 A cache wouldn't refresh.** Teams expected to invalidate one cached action, but invalidation clears the whole module, and one report saw stale data until republish. *Rule*: design caches around module-wide invalidation and short durations (`BPF-09`).
