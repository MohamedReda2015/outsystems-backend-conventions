# Naming and structure of server-side elements

Rules: `BNM-01` … `BNM-08`. Module placement rules (ARC, HSE) belong to the architecture skill; this file applies them to individual backend elements.

## Contents
1. Where each backend element lives
2. Folders per module
3. Action names
4. Structures, parameters and variables
5. Entities and attributes
6. Exceptions, roles, site properties, timers
7. Descriptions

## 1. Where each backend element lives
| Element | Module | Layer | Notes |
|---|---|---|---|
| Entity (business) | `<App>_CS` / `<Concept>_CS` | Core | Public, Expose Read-Only. Never in BL, CW, FE or IS. |
| Static entity (lookup) | `_CS` → `Lookups` | Core | Referenced by record name. |
| Hot-cache entity | `_BL` that owns the use case | Core | Filled by an `_Eng` timer or process. |
| Sync control / outbox / run-log entity | `_Sync`, `_Eng` or the owning `_CS` | Core | Never in FE. |
| Audit / log entities | `Audit_Lib` / `<Name>_Lib` | Foundation | No foreign keys to business data. |
| CRUD wrapper | `_CS` → `CRUD` | Core | Server Action. Sets audit columns. No role checks. |
| Structure (DTO) | `_BL` → `Structures` | Core | All app DTOs live here (`HSE-02`). |
| Normalized integration structure | `_IS` → `Structures` | Foundation | Never the auto-generated types. |
| Public business action | `_BL` → `ServiceActions` (or `PublicActions`) | Core | Thin. |
| Private logic | `_BL` → `PrivateActions` | Core | `_Logic`, `_Validate…`, `_Map…`. |
| State transitions | `_BL` → `Workflow` | Core | One action per transition. |
| Integration orchestration | `_BL` → `Integrations` | Core | Calls `_IS`, maps to BL Structures. |
| Consumed REST/SOAP | `<Concept>_IS` | Foundation | One IS per concept, not per system. |
| Exposed REST | `<Concept>_API` | Core (sublayer API) | Calls BL. No rules. |
| Timer + its action | `_Sync`, `_Eng`, or the `_BL`/`_CS` that owns the data | Core | Never in FE or CW. |
| BPT process | Core module next to the triggering entity | Core | |
| Business-agnostic helper | `<Name>_Lib` | Foundation | No business entities. |
| Roles | `_BL` (public) or the theme for transversal job roles | Core / Foundation | |
| User exceptions | the module that raises them | any | `_BL` for business, `_IS` for integration. |
| Site properties | the module that reads them (`_BL`, `_IS`, `_Sync`) | any | Not in FE for backend values. |

**Never in the backend path**: business logic in `_CW` (presentation helpers only), in `_Front_End`, or in `_IS`/`_API` (technical only).

## 2. Folders per module (`BNM-04`, extends `HSE-04`)
```
<App>_CS     Entities/<Concept>/   Lookups/   CRUD/<Concept>/   (Indexes on entities, not folders)
<App>_BL     Structures/<Concept>/   ServiceActions/<Concept>/   Workflow/<Concept>/
             PrivateActions/<Concept>/   Validation/   Mapping/   Integrations/<System or Concept>/
             (Roles, Exceptions, Site Properties at module level)
<Concept>_IS Wrappers/ (public normalized actions)   Structures/   Mapping/   Auth/
             (consumed REST/SOAP under Integrations, renamed to the concept)
<Concept>_API  v1/<Resource>/   Mapping/   Auth/
<Concept>_Sync Timers/   SyncLogic/   Control/
<Name>_Lib     <Area>/ by capability (Logging, Crypto, Text, Dates…)
```
Create the folders before the elements (lesson `BLL-02`). A flat module of 80 actions is unreviewable.

## 3. Action names (`BNM-01`, `BNM-03`, `BNM-06`)
Pick **one** style per factory and record it in AGENTS.md: house default `Entity_Verb` (`Request_Submit`) or no-underscore `EntityVerb` (`RequestSubmit`). Never mix inside one app.

**Standard verbs** — use these meanings everywhere:
| Verb | Meaning | Returns / raises |
|---|---|---|
| `_Get` | one record by id | Structure; raises `NotFoundException` if missing or not visible to the user |
| `_GetList` | a page of records | list + `TotalCount` |
| `_Search` | filtered/sorted page from a filter Structure | list + `TotalCount` |
| `_Count` | a dedicated count | Integer |
| `_Exists` | existence check | Boolean |
| `_Create` | CS wrapper insert | new Id |
| `_Update` | CS wrapper update | — |
| `_CreateOrUpdate` | CS wrapper upsert | Id |
| `_Delete` | CS wrapper (soft) delete | — |
| `_Save` | BL use-case upsert from a `…SaveInput` | `ActionResult` + Id |
| domain verb | a business event: `_Submit`, `_Approve`, `_Reject`, `_Cancel`, `_Assign`, `_Close` | `ActionResult` |
| `_Validate<What>` | pure validation, no writes | `ActionResult` or raises `ValidationException` |
| `_Map<From>To<To>` | pure mapping | Structure |
| `_Calculate<What>` | pure calculation (often Function = Yes) | value |
| `_Notify<Who>` | send email/SMS/push (async preferred) | — |

**Suffixes**: `_Logic` (private implementation of the public action with the same base name), `_Mock` (stub implementation for non-prod), `V2` (breaking version: `Request_GetV2`), `_Async` (enqueues work instead of doing it).

**Prefixes**: `Timer_` for an action run by a timer, used only by that timer (official convention).

**Forbidden**: default names (`Action1`, `ServerAction1`, `Aggregate1`, `SQL1`, `Structure1`, `Exception1`), `Test…`, `Copy…`, `New…`, `Temp…`, `Do…`, `Process…` without object, abbreviations other than agreed acronyms (`Id`, `Url`, `Api`, `Sms`, `Otp`). (`BNM-02`)

## 4. Structures, parameters and variables (`BNM-05`, `BNM-07`)
- Structures: `<Concept><Purpose>`. Standard purposes: `SaveInput`, `Filter`, `Summary` (list row), `Detail` (one record), `Lookup` (id + label), `Result`. Shared: `ActionResult`, `ValidationError`, `PageInfo`.
- IS structures: `<Concept>_IS_<Purpose>` (`Customer_IS_Profile`). Rename or wrap generated REST types; they never leave the `_IS`.
- Input parameters: business names (`RequestId`, `Comment`), never `Param1`, `Input`, `Data`. Identifiers end in `Id` and are typed as the entity identifier, not Long Integer.
- Mandatory inputs are marked Mandatory. Optional inputs have a documented default.
- Outputs: named for what they are (`RequestId`, `Result`, `Requests`, `TotalCount`), never `Out1`.
- Booleans read as questions: `IsActive`, `HasAttachments`, `CanApprove`.
- Local variables: name by meaning (`ExistingRequest`, `NextStatusId`), not by type (`Record1`, `List`).

## 5. Entities and attributes
- Singular PascalCase (`Request`, `RequestFile`). Static entities singular (`RequestStatus`).
- Foreign keys `<Entity>Id`; second reference to the same entity gets a role prefix (`AssignedToUserId`, `CreatedBy` for audit).
- Audit columns: `CreatedBy`, `CreatedOn`, `UpdatedBy`, `UpdatedOn`; soft delete `IsDeleted` (+ `DeletedBy`, `DeletedOn`).
- Extension entities: `<Entity>Content`, `<Entity>Detail`, `<Entity>Extension`. History: `<Entity>History`.
- Control entities: `<Job>Checkpoint`, `<Job>Run`, outbox `<Concept>Outbox`.

## 6. Exceptions, roles, site properties, timers
- User exceptions: `<Kind>Exception` — the standard set is in errors-and-logging.md. IS: `<Concept>IntegrationException`.
- Roles: job roles (`RequestApprover`, `RequestClerk`), never technical (`Role1`, `Admin2`).
- Site properties: `<Area><Name><Unit>` with units (`CrmTimeoutSeconds`, `RequestExpiryDays`, `CrmBaseUrl`, `CrmClientSecret`). Secrets end in `Secret`, `Key`, `Password` or `Token` so tools can find them.
- Timers: `<Job>` (`SyncCustomers`), action `Timer_<Job>`, kill switch `<Job>IsEnabled`.
- Exposed REST (`BNM-08`): API `<Concept>API` with version in the path; resources are plural nouns (`/v1/requests`, `/v1/requests/{id}/files`), no verbs (`/getRequests` ✘); query parameters camelCase (`limit`, `offset`, `status`); OutSystems method names `Get<Resources>`, `Get<Resource>`, `Create<Resource>`, `Update<Resource>`.
- Keep names short enough for the platform's element-name limit (Synobsys reports 50 characters for most elements): agreed glossary abbreviations, not ad-hoc ones.

## 7. Descriptions (`HSE-06`)
Every public action, Structure, attribute, parameter, entity, exception and site property has a Description. For actions:
```
<What it does, in business language>. <Who may call it / roles checked>.
Raises: NotFoundException, ValidationException. Returns ActionResult codes: REQ_LOCKED, REQ_EXPIRED.
[commit transaction]   ← only when it commits (DAT-12)
```
