# Contributing

Thanks for helping improve **outsystems-backend-conventions**. This repository is an agent skill: Markdown that AI agents (and people) read to write and review OutSystems server-side code. Every change must stay **accurate, sourced, agent-independent and concise**.

## Ways to contribute
- **Propose a rule**: open a "Rule proposal" issue with the problem, the rule, the severity and a source.
- **Report a wrong or outdated rule**: open a "Bug / inaccuracy" issue and link the official documentation that contradicts it. Platform behaviour changes between O11 Platform Server versions and ODC releases, so say which one you checked.
- **Add a lesson learned**: a real mistake from a real project, written as *problem → cause → rule*, with no client or personal details.
- **Improve tooling**: the SQL linter (`scripts/lint-sql.mjs`), the inventory checker (`scripts/check-backend.mjs`), the consistency checker or the CI workflows.

## Content rules
1. **Cite sources.** Every new rule needs a source in `research/sources.md`, marked official (OutSystems documentation, blog, product updates) or community (MVPs, partners, forum, articles). Official sources win when they disagree; record the disagreement.
2. **Label uncertainty.** A platform number or behaviour you couldn't confirm in official docs is written as "reported" or "verify on your version", and listed under *Unverified* in the latest `research/assessment-*.md`.
3. **Paraphrase, don't copy.** Summarize documentation in your own words; short quotes only.
4. **No confidential data.** No client names, internal hostnames, credentials, tokens, phone numbers, personal data or screenshots of private systems. Use neutral example names (`Request_BL`, `Customer_IS`, `Order_CS`).
5. **Explain the reason.** Agents follow rules better when they know *why*. One sentence of reasoning beats an all-caps MUST.
6. **Agent-independent.** Plain Markdown and zero-dependency Node.js scripts. Tool-specific wording belongs only in `adapters/`.
7. **Stay in scope.** Module placement and layering belong to the companion **outsystems-architecture** skill; screens and client logic to **outsystems-frontend-conventions**. Cite their rule IDs instead of restating them.
8. **Keep SKILL.md small** (under ~250 lines). Details go in `references/`; SKILL.md points to them.

## Rule IDs
- Every enforceable rule lives in `references/review-checklist.md` as `| ID | Severity | Rule |`. Lessons live in `references/lessons-learned.md` as `**BLL-nn …**`.
- **IDs are stable.** Never renumber or reuse an ID. New rules take the next free number in their group (`BNM`, `BLG`, `BTX`, `BDA`, `BIN`, `BER`, `BAS`, `BPF`, `BSC`, `BCF`). To retire a rule, keep the row and mark it *Deprecated*.
- Severity: **Blocker** (security, data loss or corruption, deployability), **Major** (real defect, performance or maintenance cost), **Minor** (convention or hygiene).
- If a script checks the rule, tag it `[inv]` (inventory checker) or `[sql]` (SQL linter); `[CQ]` if OutSystems Code Quality also flags it.
- Cited architecture-skill IDs are validated against the ranges in `scripts/check_skill.mjs`. Update those ranges when the architecture skill adds IDs.

## Script changes
- Scripts use Node.js 16+ and the standard library only. They read local files and make no network calls.
- Every new check needs a case in `scripts/examples/` (good examples must stay clean; bad examples must trigger it) and an expectation in `scripts/test.mjs`.

## Before you open a pull request
```
node scripts/check_skill.mjs    # frontmatter, links, rule IDs, hygiene
node scripts/test.mjs           # both scripts against the examples
```
- Update `CHANGELOG.md`. Bump `metadata.version` in `SKILL.md` for releases (semantic versioning: new rules or checks = minor, wording fixes = patch, a changed meaning of existing IDs = major).
- If you changed `adapters/core-rules.md`, copy the same block (between the BEGIN/END markers) into `adapters/AGENTS.md`, `adapters/copilot-instructions.md` and `adapters/cursor/outsystems-backend-conventions.mdc`.

## Releases (maintainers)
1. Bump `metadata.version` in `SKILL.md` and add `## <version> — <date>` to `CHANGELOG.md`.
2. Merge to `main`, then tag `v<version>` and push the tag. The release workflow re-runs the checks, verifies the tag matches SKILL.md and the changelog, and attaches the packaged zip.

## Reliability review guidance

Use `BRV` for verification and reliability review rules. These are manual acceptance checks unless a script explicitly implements them. Keep platform facts, house conventions and observed project lessons distinct, and link primary sources from `references/verification-and-reliability.md`.

Run repository maintenance checks from a full Git checkout. Release archives intentionally exclude these scripts; installed skill packages still include the runtime validators.

## Code of conduct
By participating you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).
