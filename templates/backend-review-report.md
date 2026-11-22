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
