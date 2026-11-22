# Performance, caching and configuration

Rules: `BPF-01` … `BPF-09`, `BCF-01` … `BCF-04`. Builds on the architecture skill's performance reference (`PERF-*`), `DAT-10`, `DAT-11`.

## Contents
1. Server-side performance rules
2. Measuring before tuning
3. Caching
4. Configuration

## 1. Server-side performance rules
- **BPF-01** No aggregate, SQL, Service Action or integration call inside a For Each. Fetch once with a join, or pass the list of ids (`BuildSafe_InClauseIntegerList`) and match in memory. Watch for hidden loops: a `Function` action with a query used in an expression evaluated per row.
- **BPF-02** Fetch only what the use case needs: Structures as outputs, no large text or binaries in list queries (`PERF-06`, `PERF-10`). In SQL list only needed columns.
- **BPF-04** Chatty contracts cost a REST round-trip each: one Service Action per use case returning everything that use case needs; accept lists (`Customer_GetByIds`) instead of being called N times.
- **BPF-05** Avoid O(n²) work in logic: nested For Each over large lists to match records. Join in the query, or sort both lists and walk once. Avoid `ListAppend` inside a loop of a loop; build results with `ListAppendAll` where possible.
- **BPF-08** (official) Don't create an action whose only job is to run one aggregate and return its records. The platform optimizes an aggregate by fetching only the attributes the **caller** uses; inside an isolated action it can't see that, so it fetches the whole entity. Query where the data is used, or have the action map to a purpose-built Structure (the BL `_Get`/`_GetList` pattern), which also fixes the columns.
- **BPF-06** No site property writes at runtime (module cache invalidation — `DAT-11`); no large session variables (`PERF-18`).
- Keep transactions short: no user think-time, no external calls with locks held (`BTX-06`).
- Default server request timeout ≤ 10 s for client-called actions (`PERF-16`); anything slower goes async.
- Indexes match the real queries (`PERF-01`); check the execution plan for the slowest queries with the DBA.
- **BPF-07** Performance is checked with data: test with production-like volumes; review Service Center slow SQL, slow extension/integration and timer reports each release.

## 2. Measuring before tuning
1. Service Center → Monitoring: Errors, Slow SQL, Integrations, Timers; LifeTime Analytics for screen/request times.
2. Reproduce with realistic volume.
3. Find the top offenders by total time (count × duration), not the single slowest call.
4. Fix the biggest: query shape and indexes, loops, payload size, chattiness, caching — in that order.
5. Measure again and record the result in the build report.

## 3. Caching (`BPF-03`, `BCF-03`)
| Cache | Use for | Watch out |
|---|---|---|
| **Cache in Minutes** on a server action or aggregate | Stable reference data: lookups, config, menus, translations, exchange rates updated daily | Cache key = inputs only. **Never** cache results that depend on the current user, roles or tenant unless those are inputs. Per front-end server, not shared. Invalidated on republish of the module. |
| **Hot cache** entities (`_BL` filled by `_Eng`) | Pre-calculated per-use-case data (catalog with final prices, dashboards) | Recalculate only what changed; purge inactive data. |
| **Cold cache** (local replica via sync) | External summary data searched/listed often | One-way sync, write-through on writes (`INT-05`). |
| **Distributed cache** (external store) | Shared across servers/apps, short-lived, large | Cache-aside inside CRUD wrappers; expiry on every entry. |
| **Token cache** | OAuth access tokens | Refresh before expiry; keyed by client/scope. |
**How `Cache in Minutes` behaves (`BPF-09`)** — design around it:
- results are cached **per combination of input values**, per front-end server (not shared between servers);
- the duration is fixed at design time: it can't be set from a variable or changed at runtime;
- it exists only for **server-side** aggregates, SQL and server actions — client-side aggregates aren't cached;
- invalidation is **module-wide**: `EspaceInvalidateCache` (or a republish) clears every cached element of the module. There is no per-action invalidation, so isolate frequently invalidated caches in a small module, or use a short duration.

Rules:
- Cache only what is **expensive and read far more than written**. Measure the hit ratio when in doubt.
- Every cache has an owner, an expiry, and an invalidation path when the data changes (the CRUD wrapper or the config back office).
- Never cache secrets in client-reachable outputs; never cache authorization decisions longer than a request.

## 4. Configuration (`BCF-01` … `BCF-04`)
- **BCF-01** Nothing environment- or business-specific is hard-coded: URLs, endpoints, keys, phone numbers, emails, thresholds, limits, feature switches (`SEC-03`).
- **BCF-02** **Site properties** for simple per-environment values that change only by deployment/ops: in the module that reads them, with a Description, units in the name and a safe default. **Read-only at runtime** (`DAT-11`): treat them as constants. Writing one invalidates the module cache, and frequent writes under load have caused deadlocks (official logic-performance guidance). In ODC, settings can only be changed in the Portal. More than ~20 in one module → move to a config entity.
  - Secrets: **Is Secret = Yes** (Platform Server 11.25+).
  - Values are not migrated by LifeTime: list them per environment in the deployment notes (`OPS-05`).
  - Test overrides (`SmsTestRecipient`, `<Concept>UseMock`) are empty/False in production and checked explicitly.
- **BCF-03** **Configuration entities** + a small back office (role-protected) for values business users change at runtime, lists, or per-tenant settings. Read through a cached `Config_Get…` action; invalidate on save.
- **BCF-04** **Feature flags / kill switches** have an owner and a removal date; stale flags are removed (`MNT-04`).
- Static entities for fixed codes the logic depends on (`DAT-07`); config entities for codes the business can add.
