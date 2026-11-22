# Public action spec: `<Concept>_<Verb>`

Fill this in before building a public BL action (Service Action or public Server Action). Keep it in the project docs or the action's Description.

| Field | Value |
|---|---|
| Module / folder | `<App>_BL` / `ServiceActions/<Concept>` |
| Kind | Service Action (cross-app) · public Server Action (same app, shared transaction) — why: |
| Callers | CW data action / CW server action / other app / `_API` / timer |
| Purpose (business language) | |
| Roles checked (server) | `Check<Role>Role(GetUserId())` |
| Record access rule | owner / ACL join / scope / tenant — enforced **in the query** |
| Allowed states | e.g. Draft, Returned |

## Inputs (only fields the caller may set — BLG-03)
| Name | Type | Mandatory | Rules (length, format, range, allowed values) |
|---|---|---|---|
| `<Entity>Id` | `<Entity> Identifier` | yes | exists, not deleted, visible to user |

**Never**: `UserId`, `TenantId`, role flags, entity records (BSC-02, BLG-03).

## Outputs
| Name | Type | Notes |
|---|---|---|
| `Result` | `ActionResult` | codes below |

## ActionResult codes (expected business outcomes)
| Code | When | User message |
|---|---|---|
| `VALIDATION_FAILED` | field errors in `Errors[]` | per field |

## Exceptions raised (unexpected / security)
`NotAuthorizedException` · `NotFoundException` · …

## Implementation
- Private `_Logic`: `<Concept>_<Verb>_Logic` — steps (one transaction):
  1.
- Validation action reused: `<Concept>_Validate<UseCase>`
- CRUD wrappers called:
- History / audit written:
- Side effects (outbox / notifications):
- Concurrency: optimistic (`UpdatedOn`) / `Get…ForUpdate` / unique index
- Idempotency: how a repeated call behaves
- Commits transaction? no (else `[commit transaction]` in Description)

## Verification (BLL-01)
- [ ] Happy path · [ ] invalid input (all errors at once) · [ ] missing role · [ ] another user's id · [ ] wrong state · [ ] double call · [ ] TrueChange clean · [ ] Description filled
