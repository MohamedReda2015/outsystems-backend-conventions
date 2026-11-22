# OutSystems Backend Conventions

[![CI](https://github.com/MohamedReda2015/outsystems-backend-conventions/actions/workflows/ci.yml/badge.svg)](https://github.com/MohamedReda2015/outsystems-backend-conventions/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![OutSystems 11 and ODC](https://img.shields.io/badge/OutSystems-O11%20%7C%20ODC-red)
![Agent independent](https://img.shields.io/badge/agents-Claude%20%7C%20Copilot%20%7C%20Cursor%20%7C%20Codex%20%7C%20any-6f42c1)

**An agent skill that teaches AI coding agents, and people, to write OutSystems server-side code the way a senior OutSystems tech lead expects to find it in review.**

It covers business logic, server and service actions, transactions, database operations, integrations, error handling, timers and async work, performance, caching, configuration and server-side security, all placed on the official **3-layer Architecture Canvas** (End-User / Core / Foundation) and the **Front_End → CW → BL → CS** module chain. Every rule has a stable ID and a severity, so any agent can enforce it in reviews. Two zero-dependency Node.js scripts lint SQL nodes and check a backend inventory.

It is plain Markdown, so it works with Claude (Code, Desktop, API), GitHub Copilot, Cursor, Codex, Gemini CLI, Aider, or your own LLM agents.

---

## Contents
- [What you get](#what-you-get)
- [Install](#install)
- [Use it](#use-it)
- [Repository layout](#repository-layout)
- [Scripts](#scripts)
- [Rule IDs and severities](#rule-ids-and-severities)
- [Sources and research](#sources-and-research)
- [Companion skills](#companion-skills)
- [Versioning and releases](#versioning-and-releases)
- [Contributing](#contributing)
- [Disclaimer](#disclaimer)
- [License](#license)

## What you get
| Area | Highlights |
|---|---|
| Placement | Which backend element goes in which module and layer: CS entities and CRUD wrappers, BL Structures and actions, `_IS` wrappers, `_API`, `_Sync`/`_Eng` timers, `_Lib` helpers |
| Business logic | Thin public actions over private `_Logic`; use-case writes (no mass assignment); validation order; state transitions with history; `ActionResult` for expected business outcomes |
| Transactions | Service vs Server Action semantics, one use case = one transaction, commit rules, commit before hand-off, optimistic and pessimistic concurrency (`Get…ForUpdate`, semaphore entity), idempotency |
| Data access | Read-only entities, audit columns, soft delete everywhere, aggregates first, safe and bounded SQL, bulk operations, pagination, retention |
| Integrations | Wrapper canvas, timeouts, retries and circuit breaking, error normalization in `OnAfterResponse`, logging levels and redaction, outbox, exposed-API design and hardening |
| Errors and logging | Exception taxonomy, handler order, where to handle, user-safe messages, masked logging with correlation ids |
| Async | Timer pattern (batches, checkpoints, wake, kill switch), retries and concurrency, stale-claim recovery, Light BPT constraints, ODC events and workflows |
| Performance and config | No queries in loops, no single-aggregate wrappers, cache behaviour, site properties as constants, config entities |
| Security | Every reachable action authorizes role + record + state; identity from the server; output minimization; secrets; anonymous endpoints; exposed APIs proven to return 401 |
| ODC | Differences from O11: libraries vs apps, read-only public entities, settings, events, workflows, external libraries |
| Tooling | SQL linter, inventory checker, spec and review templates, adapters for other agents, evals |

## Install
The repository root **is** the skill: `SKILL.md` sits at the top level.

**Claude Code**, for all projects:
```bash
git clone https://github.com/MohamedReda2015/outsystems-backend-conventions ~/.claude/skills/outsystems-backend-conventions
```
```powershell
git clone https://github.com/MohamedReda2015/outsystems-backend-conventions "$HOME\.claude\skills\outsystems-backend-conventions"
```
For one project only, clone it into `<repo>/.claude/skills/outsystems-backend-conventions`. The skill triggers automatically from its description.

**Claude.ai / Claude Desktop**: download `outsystems-backend-conventions-vX.Y.Z.zip` from [Releases](https://github.com/MohamedReda2015/outsystems-backend-conventions/releases) and upload it under *Settings → Capabilities → Skills*.

**Claude API / Agent SDK**: upload it as a custom Skill, or put `SKILL.md` in the system prompt and give the agent read access to `references/`.

**Codex, Gemini CLI, Aider, Jules and other AGENTS.md readers**: add the repo as a folder or submodule of your project and copy [`adapters/AGENTS.md`](adapters/AGENTS.md) to your repository root.

**Cursor**: add the folder to the repo and copy [`adapters/cursor/outsystems-backend-conventions.mdc`](adapters/cursor/outsystems-backend-conventions.mdc) to `.cursor/rules/`.

**GitHub Copilot**: copy [`adapters/copilot-instructions.md`](adapters/copilot-instructions.md) to `.github/copilot-instructions.md`.

**Custom or multi-agent systems**: put [`adapters/core-rules.md`](adapters/core-rules.md) in every agent's system prompt and give agents a file-read tool for the rest. Suggested roles:
- **Builder**: `business-logic`, `data-access`, `integrations`, `errors-and-logging` + the spec templates.
- **Reviewer**: `review-checklist`, `security` + both scripts → `templates/backend-review-report.md`, blocking on any Blocker.

## Use it
Example prompts once it is installed:
- "Add the submit logic for a leave request: validate, change status, write history, notify the manager."
- "Our Reactive Save button calls three Service Actions in a row and sometimes leaves half-saved data. Fix it."
- "Review this SQL node" (paste the SQL text).
- "Wrap the partner's shipment REST API; it is slow and sometimes down."
- "Write the spec for a nightly timer that syncs 2 million customers from the ERP."
- "Is it OK to pass `UserId` into my BL Service Action?"

The agent follows `SKILL.md`: it establishes context (platform, module, existing elements, naming style, callers), applies the precedence rules (project conventions > house standard > official guidance; security, transaction and data-integrity rules are flagged, never silently relaxed), reads only the references it needs, and reports findings with rule IDs.

## Repository layout
```
SKILL.md                       entry point: canvas placement, Step 0, core conventions, workflows, reference map
references/                    details loaded on demand
  naming-and-structure.md        element placement per layer, folders, verbs, structures, REST resource naming
  business-logic.md              public action anatomy, Service vs Server Actions, validation, transactions,
                                 concurrency, idempotency, state transitions, reads, ODC differences
  data-access.md                 entities, CRUD wrappers, soft delete, aggregates, SQL, bulk, paging, retention
  integrations.md                wrapper canvas, consumed REST, timeouts/retries, auth, errors, logging, outbox,
                                 exposed REST, SOAP/files/email/SMS, mocks
  errors-and-logging.md          ActionResult, exception set, where and how to handle, messages, logging
  async-processing.md            timers, retries and concurrency, per-record processing, outbox, BPT/Light BPT
  performance-and-caching.md     server-side performance, measuring, caching behaviour, configuration
  security.md                    entry-point authorization, identity, inputs/outputs, secrets, public endpoints, APIs
  lessons-learned.md             BLL-01… real project mistakes → rules (plus community-reported ones)
  review-checklist.md            every enforceable rule with ID and severity
templates/                     public action spec, integration spec, timer spec, backend review report
scripts/                       lint-sql.mjs, check-backend.mjs, examples/, test.mjs, check_skill.mjs
adapters/                      core-rules.md, AGENTS.md, Cursor rule, Copilot instructions
evals/                         test prompts with expectations
research/                      sources.md (official vs community), assessment notes
```

## Scripts
Node.js 16+, no packages, no network access. Exit code 1 means at least one error (warnings don't fail), so both can gate your own pipelines.

**SQL linter**: paste each SQL node's text into a `.sql` file, then:
```bash
node scripts/lint-sql.mjs path/to/sql --soft-delete Request,RequestFile [--expand-inline Ids] [--style] [--json]
node scripts/lint-sql.mjs scripts/examples/sql-bad --soft-delete Request     # shows each rule firing
```
It flags physical table names, `SELECT *`, unbounded selects, `UPDATE`/`DELETE` without `WHERE`, dynamic SQL, likely Expand Inline `IN`/`ORDER BY` parameters, non-sargable predicates, leading-wildcard `LIKE`, `NOLOCK`, cursors, hard-coded ids and missing `IsDeleted` filters.

**Inventory checker**: describe modules, entities, actions, timers, site properties and REST APIs in JSON (from the Service Studio MCP read tools, Discovery, or by hand; see the header of the script and [`scripts/examples/inventory-good.json`](scripts/examples/inventory-good.json)), then:
```bash
node scripts/check-backend.mjs inventory.json [--style underscore|pascal] [--json]
node scripts/check-backend.mjs scripts/examples/inventory-bad.json            # shows each rule firing
```
It flags entities and structures in the wrong layer, writable public entities, missing audit columns, naming-style breaks, identity and entity-record inputs on reachable actions, fat public actions, undocumented commits, timers over 30 minutes or in UI modules, secrets not marked secret, REST consumed outside `_IS`, missing timeouts, Full logging without redaction, unsecured or unverified exposed APIs, and more.

## Rule IDs and severities
Every rule lives in [`references/review-checklist.md`](references/review-checklist.md):

| Group | Covers |
|---|---|
| `BNM` | Naming and structure |
| `BLG` | Business logic |
| `BTX` | Transactions, concurrency, idempotency |
| `BDA` | Data access |
| `BIN` | Integrations |
| `BER` | Errors and logging |
| `BAS` | Async processing |
| `BPF` | Performance |
| `BSC` | Server-side security |
| `BCF` | Configuration |
| `BLL` | Lessons learned (in `lessons-learned.md`) |

Severities: **Blocker** (security, data loss or corruption, deployability), **Major** (real defect, performance or maintenance cost), **Minor** (hygiene). IDs are stable across versions. Tags: `[inv]` checked by the inventory checker, `[sql]` by the SQL linter, `[CQ]` also flagged by OutSystems Code Quality. Rules from the companion architecture skill (`ARC`, `HSE`, `DAT`, `INT`, `SEC`, `PERF`…) are cited, not restated.

## Sources and research
Rules are based on official OutSystems 11 and ODC documentation, community standards and real projects. [`research/sources.md`](research/sources.md) says where each rule comes from (official or community). [`research/assessment-2026-11.md`](research/assessment-2026-11.md) records what was confirmed, corrected, added or left unverified. Platform numbers (timeouts, limits, thread counts) change between versions: the skill labels the ones it couldn't confirm, and you should check them for your version before relying on them.

## Companion skills
This skill works alone. It cites rule IDs from, and defers to, these optional companions:
- **outsystems-architecture** ([GitHub](https://github.com/MohamedReda2015/outsystems-architecture)): layers, modules, dependencies, deployment SOPs. It owns *where* an element lives.
- **outsystems-live-style-guide** ([GitHub](https://github.com/MohamedReda2015/outsystems-live-style-guide)): visual design, themes, accessibility.
- **outsystems-frontend-conventions**: screens, blocks, client logic. Its `ActionResult` shape matches this skill's.

## Versioning and releases
[Semantic versioning](https://semver.org/) of `metadata.version` in `SKILL.md`: new rules or checks = minor; wording or fixes = patch; a changed meaning of existing IDs = major. See [CHANGELOG.md](CHANGELOG.md).

Pushing a tag `vX.Y.Z` that matches the SKILL.md version and has a changelog entry runs the checks and publishes a release with the packaged `outsystems-backend-conventions-vX.Y.Z.zip`. Build the same zip locally with:
```bash
git archive --format=zip --prefix=outsystems-backend-conventions/ -o outsystems-backend-conventions.zip HEAD
```

## Contributing
Rule proposals, corrections and real-world lessons are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md): cite a source, label what you couldn't verify, paraphrase, include no confidential data, keep rule IDs stable, and run the checks:
```bash
node scripts/check-backend.mjs scripts/examples/inventory-good.json --json
node scripts/lint-sql.mjs scripts/examples/sql-good --json
```
Also see the [Code of Conduct](CODE_OF_CONDUCT.md) and the [Security policy](SECURITY.md).

## Disclaimer
This is an independent community project. It is **not affiliated with, endorsed by, or supported by OutSystems**. "OutSystems", "Service Studio", "Service Center", "LifeTime", "ODC", "Forge" and related names are trademarks of OutSystems. The content paraphrases public OutSystems documentation and community material, credited in [`research/sources.md`](research/sources.md), together with the authors' own experience. Always check critical decisions against the [official documentation](https://success.outsystems.com/documentation/) for your platform version.

## License
[MIT](LICENSE).


## Reliability review (Unreleased)

The updated guidance separates installed platform behavior, house conventions and observed project lessons. Read [verification and reliability](references/verification-and-reliability.md) for domain acceptance checks and primary sources. Changes are recorded under Unreleased; this does not declare a new upstream release.

Repository maintenance checks (full Git checkout):

```sh
node scripts/check_skill.mjs
node scripts/test.mjs
```

These maintenance scripts are excluded from the release archive.
