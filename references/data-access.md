# Database operations

Rules: `BDA-01` … `BDA-13`. Builds on the architecture skill's `DAT-01`…`DAT-03`, `DAT-06`, `DAT-07`, `DAT-10`, `PERF-01`, `PERF-06`, `PERF-12`, `SEC-02`.

## Contents
1. Entity design checklist
2. CRUD wrappers
3. Soft delete
4. Aggregates
5. SQL nodes
6. Bulk operations
7. Pagination, sorting, searching
8. Retention, archiving, purging
9. External databases

## 1. Entity design checklist (`BDA-01`, `BDA-10`, `BDA-12`)
- [ ] In a `_CS` module, folder `Entities/<Concept>`; Public = Yes; **Expose Read-Only = Yes** (`DAT-01`).
- [ ] Id: AutoNumber Long Integer (or Text natural key only with a reason).
- [ ] Mandatory attributes marked; text **lengths** chosen deliberately (Email 250, Name 200, Code 50…). Over 2000 chars → large-text column: move to a 1-to-1 `<Entity>Content`/`Extension` entity with binaries (`PERF-06`).
- [ ] Foreign keys typed as `<Entity> Identifier` with a deliberate **Delete Rule**: `Protect` (default), `Delete` (owned children only), `Ignore` (logs/history only) (`DAT-06`).
- [ ] Audit columns `CreatedBy`, `CreatedOn`, `UpdatedBy`, `UpdatedOn`; `IsDeleted` (+ `DeletedBy/On`) if soft delete; `Version` integer if optimistic locking without `UpdatedOn`.
- [ ] **Indexes** on attributes used in filters, sorts and joins; **unique** indexes on natural keys (`Code`, `ExternalId`, `Email`). Composite indexes ordered by selectivity, matching the query's filter (`PERF-01`).
- [ ] Fixed lists are **static entities** in `Lookups`, referenced by record name (`Entities.RequestStatus.Submitted`), never by literal id (`DAT-07`).
- [ ] Money: Decimal with explicit precision (e.g. 37,8 default is fine; store currency code alongside). Dates: Date Time in **UTC** on the server, convert for display.
- [ ] No entity with hundreds of attributes; split by usage (summary vs detail vs content).
- [ ] Multi-tenant flag set deliberately (`SEC-05`).

## 2. CRUD wrappers (`BDA-01`, `BDA-02`)
```
Request_Create(Source: RequestCreateInput or Request record) → RequestId     CS/CRUD/Request
  1. invariants: mandatory, formats, uniqueness (raise ValidationException)
  2. set CreatedBy = actor, CreatedOn = CurrDateTime() (UTC), UpdatedBy/On = same
  3. CreateRequest (built-in)
  4. history/audit hook (optional) · cache invalidation (optional)
Request_Update(Source)          sets UpdatedBy/On only; never overwrites CreatedBy/On
Request_Delete(RequestId)       soft: IsDeleted = True, DeletedBy/On; hard only for owned children
```
- The wrapper is the **only** place that sets audit columns; callers never assign them (lesson `BLL-04`, `DAT-02`).
- Actor: `GetUserId()` for platform users; an explicit actor text (e.g. `IDP:<externalId>`) for external users with no platform user; `SYSTEM:<Job>` for timers.
- Wrappers do **not** check roles (they are called only by BL, timers and processes — never from client logic).
- `Update` loads the stored record first only when it must preserve columns the caller doesn't own; otherwise BL passes a full, server-loaded record.

## 3. Soft delete (`BDA-06`, `DAT-03`)
- `<Entity>_Delete` sets `IsDeleted`. Physical deletes only for owned child rows and purges.
- **Every** read filters it: aggregates (`not Request.IsDeleted`), SQL (`AND {Request}.[IsDeleted] = 0`), joined children (`Child.Id = NullIdentifier() or not Child.IsDeleted` for outer joins), lookups used by other flows, counts, exports, API reads.
- Unique indexes on soft-deletable entities include `IsDeleted` or a filtered alternative, otherwise a deleted `Code` blocks re-creating it.
- When adding soft delete to an existing entity, list **every** read (Find Usages on the entity) and fix them in one change. Lint SQL with `--soft-delete <Entity>`.

## 4. Aggregates (`BDA-03`)
- First choice: optimized SQL generation, only used columns fetched, refactor-safe, type-safe.
- Set **Max. Records** on every list aggregate (`DAT-10`). Use the aggregate's total count output for pagination rather than a second query.
- Filters: compare columns directly. `Request.CreatedOn >= FromDate` ✔; `DateTimeToDate(Request.CreatedOn) = Today` ✘ (non-sargable). Precompute boundaries in variables.
- Merge chains of aggregates that feed each other into one with joins (`PERF-13`). Join type deliberately: `With` (inner) vs `With or Without` (left).
- Test emptiness with `List.Empty`, not `List.Count` (`PERF-14`).
- No aggregates inside a For Each (`BPF-01`).
- Don't wrap a single aggregate in its own action just to "reuse" it: the aggregate then fetches every attribute because it can't see what the caller uses (`BPF-08`, official). Reuse a query by returning a purpose-built Structure.

## 5. SQL nodes (`BDA-03`…`BDA-05`, `BDA-07`…`BDA-09`, `BDA-13`)
Use SQL only for what aggregates cannot express: complex grouping/window functions, `EXISTS`/`NOT EXISTS`, `UNION`, CTEs, bulk `UPDATE`/`DELETE`/`INSERT … SELECT`, DB functions.

```sql
/* Request_GetOverdueSummary — overdue requests per assignee (SQL Server) */
SELECT {Request}.[AssignedToUserId], COUNT(1)
FROM {Request}
WHERE {Request}.[IsDeleted] = 0
  AND {Request}.[StatusId] = @SubmittedStatusId
  AND {Request}.[DueOn] < @Now
GROUP BY {Request}.[AssignedToUserId]
ORDER BY COUNT(1) DESC
OFFSET 0 ROWS FETCH NEXT @MaxRecords ROWS ONLY
```
Rules:
- `{Entity}.[Attribute]` syntax only — never physical names (`OSUSR_ABC_REQUEST`): they differ per environment and break on refactor.
- **Parameters** for every value (`@SubmittedStatusId`), including static entity ids passed from `Entities.RequestStatus.Submitted`. Never concatenate input.
- **Expand Inline** only when unavoidable (dynamic `IN` lists, allow-listed sort columns): use `BuildSafe_InClauseIntegerList` / `BuildSafe_InClauseTextList`, `EncodeSql()` on string **literals** only, and an allow-list for column names (`SEC-02`).
- No `SELECT *` — list columns in the order of the output Structure (also protects against schema changes).
- Row limit **inside** the statement (`TOP`, `OFFSET … FETCH`, `ROWNUM`/`FETCH FIRST` on Oracle). The node's Max. Records doesn't limit what the database returns.
- Sargable predicates: no `UPPER()`, `CONVERT()`, `CAST()`, `ISNULL()` or arithmetic on the **column** side of `WHERE`/`JOIN`. Leading-wildcard `LIKE '%x'` cannot use an index — use it knowingly.
- No `WITH (NOLOCK)` / `READ UNCOMMITTED` in business logic (dirty and duplicate reads).
- Set-based, not row-by-row: no cursors or `WHILE` loops.
- No business logic in SQL (status rules, permissions decisions beyond filtering): it is invisible to reviewers and Code Quality.
- Comment the purpose on top; indent; one SQL node per purpose; name it like an action (`GetOverdueSummary`).
- Database-specific syntax is a portability decision — note the engine in the comment.
- Lint: `node scripts/lint-sql.mjs <folder> --soft-delete Request,RequestFile`.

## 6. Bulk operations (`BDA-08`)
- Bulk `UPDATE`/`DELETE` SQL always has a `WHERE` and is bounded (process in batches of e.g. 1 000–5 000 rows in timers to avoid lock escalation and timeouts).
- Bulk SQL bypasses CRUD wrappers: set audit columns in the statement, and audit the **operation** (who, what filter, how many rows) once.
- Imports (Excel/CSV): parse → validate into a staging entity with per-row status → apply valid rows in batches → report errors. Never one giant transaction.

## 7. Pagination, sorting, searching
- Server-side paging: `StartIndex` + `MaxRecords` (capped server-side) + total count.
- Sorting: allow-list of sort keys mapped to columns (`"CreatedOn" → {Request}.[CreatedOn]`); default sort always defined (stable paging needs a unique tiebreaker, e.g. Id).
- Search: trim input, minimum length for `LIKE` searches, prefix search (`x%`) where possible; for large free-text search consider full-text indexes or a search service.

## 8. Retention, archiving, purging (`BDA-11`, `PERF-12`)
- Every high-volume table (logs, history, outbox, staging, notifications, integration logs) has a **retention period** and a purge timer that deletes in batches off-peak.
- Archive business data that must be kept but is rarely read into `<Entity>Archive` entities or an external store.
- Audit data has its own retention policy (`AUD-02`).

## 9. External databases
- Integrate via **Integration Builder / external entities** or a connection string defined in Service Center (never in code).
- Treat them like integrations: in an `_IS` (or dedicated `_CS` wrapping the external entities), with connection pooling, timeouts and no cross-database joins over linked servers (`PERF-04`).
