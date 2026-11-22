# Integration spec: `<Concept>_IS`

| Field | Value |
|---|---|
| Concept | e.g. Customer |
| External system(s) / owner / contact | |
| Pattern (architecture skill) | direct · cold cache + sync · isolated sync · lazy load · transparency |
| Protocol | REST / SOAP / file / DB |
| Environments and base URLs | Dev: config · QA: config · Prod: config (never in code) |
| Authentication | API key header / OAuth client credentials / mTLS / Basic over TLS |
| Secrets location | site property `Is Secret` / shared IdP config action / ODC secret setting |
| Callback URLs registered per environment | yes / n.a. |

## Public wrapper actions (normalized)
| Action | Input Structure | Output Structure | Idempotent? | Timeout (s) | Retries |
|---|---|---|---|---|---|
| `<Concept>_IS_Get<Object>` | | `<Concept>_IS_<Purpose>` | yes | 10 | 1 |

## Error mapping (OnAfterResponse)
| External | Normalized exception / code | Retry? | User message |
|---|---|---|---|
| 400/422 | ValidationException | no | |
| 401/403 | `<Concept>IntegrationException` AUTH_FAILED | no (alert ops) | |
| 404 | NotFoundException / empty | no | |
| 409 | ConflictException | no | |
| 429/5xx/timeout | `<Concept>IntegrationException` UNAVAILABLE | yes (bounded) | |

## Sync or async
- User waits? yes/no. If no → outbox `<Concept>Outbox` + timer `Timer_Send<Concept>`.
- Sync job (if any): see `templates/timer-spec.md`.

## Logging and compliance
- Service Center logging level per environment:
- Own integration log fields (masked):
- Correlation id header:

## Non-production
- Mock switch: `<Concept>UseMock` (False in Prod)
- Test overrides: (empty in Prod)
- Unknown fields marked `NOT FOUND` until confirmed (BLL-05)


## Evidence and acceptance

- Platform/app type, installed versions/theme where relevant, target environment:
- Existing project decisions and authorized delivery scope:
- Requirement → element/contract → source of data → verification evidence:
- Concurrency, retry/unknown outcome, authorization and failure cases relevant to this change:
- Delivery status: prepared / model validated / merged / published / runtime verified (record only observed stages):
- Not tested, missing dependency or blocked evidence, and the exact next step:
