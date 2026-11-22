# Sources

Where the rules come from, so they can be cited or re-verified. **Official** = OutSystems documentation or blog. **Community** = MVPs, partners, forum, articles. When the two disagree, official wins and the rule says so. Read in November 2026.

## Official — OutSystems 11
| Topic | Source | Used for |
|---|---|---|
| Transactions | success.outsystems.com/Documentation/11/Reference/OutSystems_Language/Data/Database_Reference/Handling_Transactions/ | Request = transaction; Commit/Abort start a new one; no nesting; locks released on commit/rollback; no distributed transactions; database isolation differences (commit before launching a process or calling a web service on Read Committed databases) — BTX-01…03, BTX-07 |
| Exception handling | success.outsystems.com/documentation/11/building_apps/handling_exceptions/exception_handling_mechanism/ | Handler order; timer flows only handle exceptions with their own handlers; integration exception type usually unknown → All Exceptions + ExceptionMessage — BER-02, BER-08, BIN-04 |
| Exception Handler element | success.outsystems.com/documentation/11/reference/outsystems_language/logic/implementing_logic/logic_tools/exception_handler/ | Abort Transaction property; not available client-side — BTX-03 |
| Timers | success.outsystems.com/documentation/11/building_apps/using_timers/ | 20-min default timeout; 3 concurrent timers per front-end; timeouts count as errors and are retried (default 3, set in Service Center); own session — BAS-01, BAS-07 |
| Logic performance | success.outsystems.com/documentation/best_practices/performance_and_monitoring/performance_best_practices_logic/ | Timer checkpoints/partial commits; don't isolate aggregates in actions; site properties are constants (frequent changes → deadlocks); Service Center analytics first — BAS-01, BPF-08, BCF-02, BPF-07 |
| Integration logging levels | success.outsystems.com/documentation/11/integration_with_external_systems/logging_levels_reference_for_integrations/ | Default / Troubleshoot / Full; parameter values visible in Service Center; input redaction for consumed REST — BIN-06 |
| Consumed REST at runtime | success.outsystems.com/documentation/11/integration_with_external_systems/rest/consume_rest_apis/configure_a_consumed_rest_api_at_runtime/ | Effective URL and credentials per environment in Service Center — BIN-03 |
| Handling HTTP status codes (blog, 2019) | outsystems.com/blog/posts/handling-http-status-codes-consuming-rest/ | Non-2xx raises by default; handle in OnAfterResponse with specific exceptions; "silencing" (rewrite to 200) is bad practice — BIN-04, BIN-11 |
| Light BPT (blog) | outsystems.com/blog/posts/light-bpt/ | Only on entity Create; manual launch runs as a regular process — BAS-08 |

## Official — ODC
| Topic | Source | Used for |
|---|---|---|
| Service actions | success.outsystems.com/documentation/outsystems_developer_cloud/app_architecture/service_actions/ | REST-based remote call; weak dependency; UserId/TenantId passed; user and communication exceptions catchable; structures over entities; same portfolio only |
| Data management | …/outsystems_developer_cloud/building_apps/data_management/best_practices_for_data_management/ | Settings read-only, secret settings; indexes; text > 2000 and binaries isolated; batch beyond timer/event limits — BCF-02, BDA-10 |
| Long-running timers | …/manage_technical_debt_in_odc/performance_findings/avoid_long_running_timers/ | ≤ 30 min; wake pattern; retries reprocess — BAS-01 |
| Use timers | …/outsystems_developer_cloud/building_apps/use_timers/ | 20-min default; 3 automatic retries, not configurable; worst case 4 × timeout; one instance per timer — BAS-07 |
| Implement events | …/about_event_driven_architecture/implement_events_in_odc/ | Basic-type params, 10 KB payload, order-independent handlers ≤ 2 min, All Exceptions on both sides, commit before triggering — BAS-09, BTX-07 |
| ODC for O11 developers | …/outsystems_developer_cloud/odc_for_o11_developers/ | Public server actions only in libraries; public app entities read-only; cross-app relations delete rule Ignore, no FK; settings; workflows; external libraries |
| AI-call timeouts | …/agentic_apps_in_odc/dealing_with_timeouts_on_ai_agent_calls/ | Server Request Timeout up to 60 s; async queue + event + polling pattern — BIN-08 |
| Platform limits | …/getting_started/outsystems_system_requirements_for_odc/ | Exposed REST 60 s, service action 100 s, external library 95 s, events 2 min / 10 000 queue (read from a truncated page: re-verify before quoting) |

## Community
| Source | Used for |
|---|---|
| Synobsys standards — synobsys.github.io (standards index, naming, REST API conventions, Server Action Security, ADR index, custom auth how-to) | Comply-or-explain with ADRs; English/unabbreviated names; resource-oriented REST, `/v1`, `limit`/`offset`, few status codes, structured error body; every server action checks login + role (ADR-003); service account for timers; API-key custom auth — BNM-08, BSC-01, BSC-11, BIN-07 |
| HackerNoon, "Nobody told me securing APIs was my problem in OutSystems" (2026) | Exposed APIs aren't secured by default; test without credentials (expect 401); per-method and per-record authorization; per-consumer keys, hashed; expiring tokens; verify JWT signatures; generic errors — BSC-11 |
| OutSystems forum: GetForUpdate threads (9333, 76151, 53723, 97617, 106379) | Lock lasts until the transaction ends; reads not blocked; no lock across user think time; semaphore entity for serialization; unique index against duplicate API calls — BTX-04 |
| OutSystems forum: timer threads (53844, 83512, 102669, 106897, 105676) | Retries configurable in O11; timeouts can't be caught; claim records "In Progress" and recover; separate retry timer; backoff with jitter instead of Sleep — BAS-02, BAS-07 |
| OutSystems forum: cache threads (60154, 52129, 102190) | Invalidation is module-wide (`EspaceInvalidateCache`); cache per input combination; minutes fixed at design time; server-side only — BPF-09 |
| OutSystems forum: service action exceptions (88861) and Idea 100 | Custom exception types are not public across modules; consumers handle them as generic user exceptions or 500s — BLG-08 (kept as "verify on your version") |
| OutSystems forum: Light BPT threads (41063, 88217, 69635) and book *Rapid Application Development with OutSystems* | 20 Light BPT / 10 BPT / 3 timer threads per front-end by default; light activity timeout reported ~3 min vs 5 min for BPT automatic activities (2019, unverified) — BAS-08 |
| OutSystems forum 82832 | No FeedbackMessage in server actions: the caller may not be a UI — BER-07 |

| maiurnarendra/outsystems-ai-skills v0.14.1 (GitHub, MIT, reviewed 2026-11-22): action-flows, crud-conventions, advanced-sql, integrations, timers | Flow layout and label conventions, built-ins before loops, static-entity ids and `Is_Active`, GetForUpdate output path, SQL style, IS output minimalism and review severities, no-progress guard, one-off timers, Effective Schedule — BLG-11, BLG-12, BDA-14, BDA-15, BIN-12, BAS-10 (paraphrased; house rules kept where they differ, e.g. IS per business concept) |

## Could not be read (HTTP 403 to automated fetch)
itnext.io articles on safe timers, heavy timers, concurrency and REST API design; Noesis "Exception handling standards"; "Light processes under the hood" (Medium). Their points appear only where the same advice was confirmed by another source above.


## Reliability review — 2026-11-22

See [verification and reliability](../references/verification-and-reliability.md) for primary sources, provenance and acceptance cases. Platform facts are separated from house policy and anonymized project observations. A community mirror is not an official publication; installed contracts and version-matched official sources take precedence. Runtime claims were not retested in a live tenant during this documentation review.

## Eight-skill delivery review — 2026-11-22

- Official: [OutSystems testing guidelines](https://success.outsystems.com/documentation/11/testing_apps/outsystems_testing_guidelines/); [develop for testability](https://success.outsystems.com/documentation/11/testing_apps/develop_for_testability/); [ODC UI testing](https://success.outsystems.com/documentation/outsystems_developer_cloud/testing_apps/web_ui_testing/).
- Standard: [Scrum Guide](https://scrumguides.org/scrum-guide.html); W3C [status messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html), [redundant entry](https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry.html) and [accessible authentication](https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html) where UI criteria apply.
- Engineering recommendations and generalized project observations: source/app baselines, historical identity, complete consumer imports, action-specific fields, mock/live consistency and honest blocked-work reporting. See `references/verification-and-reliability.md`; these recommendations are distinguished from platform facts.
