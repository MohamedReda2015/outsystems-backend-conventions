# Changelog

## Unreleased — cross-skill delivery review (2026-11-22)

- Connected requirements, domain implementation and runtime evidence through stable IDs and versioned handoffs.
- Added domain acceptance guidance, template evidence fields and sourced review checks.


## Unreleased — reliability review (2026-11-22)

- Clarified platform facts versus house/project conventions and verification evidence.
- Added domain-specific reliability guidance, source provenance and acceptance cases.
- Added review/template checks and corrected over-broad or inconsistent claims.
- Extended repository consistency checks to the new reliability rule IDs and aligned contributor guidance with the full checkout.


All notable changes to this skill. Rule IDs are stable: new rules get new numbers, retired rules are never reused.

## 1.2.0 — 2026-11-22
Prepared for public release on GitHub. No rule changes.
- README rewritten for public use: badges, install for Claude Code / Claude.ai / API / AGENTS.md readers / Cursor / Copilot / multi-agent, example prompts, layout, scripts, rule groups, sources, companion skills, disclaimer.
- Added CONTRIBUTING, CODE_OF_CONDUCT, SECURITY, issue templates (inaccuracy, rule proposal), PR template.
- Added CI (consistency check, script tests, clean examples, evals JSON, packaging smoke test) and a tag-driven release workflow that publishes the packaged zip.
- Privacy scan: no client names, personal data, local paths or credentials.

## 1.1.0 — 2026-11-22
Research update: official O11/ODC documentation and community standards (Synobsys, OutSystems blog and forum, published API-security reports). Details in `research/assessment-2026-11.md`, sources in `research/sources.md`.
- **Corrected**: consumed-REST error handling (no "silencing"), integration logging levels and redaction, timer retries and concurrency (O11 vs ODC), the ODC section (libraries, read-only public entities, cross-app references without FK, events, workflows, settings), service-action exception wording now labelled by evidence.
- **New rules**: BNM-08 (REST resource design), BTX-07 (commit before hand-off), BIN-11 (never silence REST errors), BER-07 (no UI calls server-side), BER-08 (handlers in timer/process/API entry actions), BAS-07 (retries, concurrency, stale claims), BAS-08 (Light BPT constraints), BAS-09 (ODC events), BPF-08 (no single-aggregate wrapper actions), BPF-09 (cache behaviour), BSC-11 (exposed-API verification). Reworded: BIN-06.
- **Lessons**: BLL-19…22 (community-reported).
- **Scripts**: `check-backend.mjs` checks logging level without redaction, aggregate-only actions, shared timer schedules, timer actions without handlers, unverified exposed APIs; tests extended.
- **Docs**: GetForUpdate facts and semaphore pattern; database isolation differences; stale-claim recovery and jitter; service-account option for timers; ADR "comply or explain" governance; companion skills outsystems-bpt and outsystems-cmf.

## 1.0.0 — 2026-11-22
First release.
- `SKILL.md` with the backend placed on the 3-layer Architecture Canvas, Step 0, core conventions, how to build and review, most-broken rules.
- References: naming and structure, business logic and transactions, data access, integrations, errors and logging, async processing, performance/caching/configuration, server-side security, lessons learned (BLL-01…18), review checklist.
- Rule families: BNM, BLG, BTX, BDA, BIN, BER, BAS, BPF, BSC, BCF. Cross-references to the outsystems-architecture rule IDs.
- Templates: public action spec, integration spec, timer spec, backend review report.
- Scripts: `lint-sql.mjs` (SQL node linter), `check-backend.mjs` (inventory checker), `test.mjs`, `check_skill.mjs`.
- Adapters: core rules for AGENTS.md, Copilot and Cursor.
