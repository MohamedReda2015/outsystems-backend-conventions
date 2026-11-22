# Backend review: `<App / modules>`

| | |
|---|---|
| Date / reviewer | |
| Scope | modules, elements sampled |
| Platform | O11 PS version / ODC |
| Inputs | inventory.json, SQL exports, Code Quality snapshot, TrueChange |
| Project precedence decisions | (AGENTS.md entries that override the house standard) |

## Summary
| Blocker | Major | Minor |
|---|---|---|
| 0 | 0 | 0 |

**Top 3 risks**
1.
2.
3.

## Tool output
- `check-backend.mjs`: N errors, N warnings
- `lint-sql.mjs`: N errors, N warnings

## Findings (Security → Data integrity → Performance → Architecture → Maintainability)
| # | Rule | Sev | Element (`Module.Folder.Element`) | Evidence | Fix |
|---|---|---|---|---|---|
| 1 | BSC-02 | Blocker | `Request_BL.ServiceActions.Request.Request_Submit` | input `UserId` passed from CW | remove input; use `GetUserId()` in `_Logic` |

## Security questions per client-reachable action (security.md §9)
| Action | No session | No role | Other user's id | Wrong state | Oversized input | Replay |
|---|---|---|---|---|---|---|

## Not verified
(what you could not check, and why)


## Evidence and acceptance

- Platform/app type, installed versions/theme where relevant, target environment:
- Existing project decisions and authorized delivery scope:
- Requirement → element/contract → source of data → verification evidence:
- Concurrency, retry/unknown outcome, authorization and failure cases relevant to this change:
- Delivery status: prepared / model validated / merged / published / runtime verified (record only observed stages):
- Not tested, missing dependency or blocked evidence, and the exact next step:

## Delivery trace and tested baseline

- Source revision/locator; requirement, story and criterion IDs:
- Target app/module version, environment, role, locale and data-provider mode:
- Expected versus observed result and evidence reference (including test time):
- Evidence stage: prepared / model validated / merged / published / runtime verified:
- Changed source/contracts since last test; affected checks to rerun:
- Outstanding dependent work, owner and next action; scope decisions:
