#!/usr/bin/env node
// lint-sql.mjs — lints the text of OutSystems SQL nodes (Node.js 16+, no packages).
//
// Usage:
//   node scripts/lint-sql.mjs <file-or-folder> [more...] [--soft-delete Entity1,Entity2]
//                             [--expand-inline Param1,Param2] [--style] [--json]
//
// Input: one .sql file per SQL node (copy the node text into a file named like the node,
// e.g. Request_GetOverdueSummary.sql). Folders are scanned recursively for *.sql.
//   --soft-delete    entities that use IsDeleted; every statement reading them must filter it.
//   --expand-inline  parameters set to Expand Inline in the node; each is reported so a
//                    reviewer confirms it is built with BuildSafe_InClause*/EncodeSql/allow-list.
//   --style          also check the opt-in team SQL style (BDA-15): header comment, uppercase
//                    keywords, leading commas, explicit joins, descriptive aliases. Warnings only.
//   --json           machine-readable output.
// Exit code: 0 = no errors (warnings allowed), 1 = at least one error, 2 = usage error.
//
// Rules (see references/review-checklist.md): BDA-03, BDA-04, BDA-05, BDA-06, BDA-07,
// BDA-08, BDA-09, BDA-12, BDA-13; BDA-15 with --style. The checks are text heuristics: they find likely problems,
// a reviewer confirms them.

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, extname } from "node:path";

const args = process.argv.slice(2);
const opt = { json: false, style: false, softDelete: [], expandInline: [] };
const targets = [];
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === "--json") opt.json = true;
  else if (a === "--style") opt.style = true;
  else if (a === "--soft-delete") opt.softDelete = (args[++i] || "").split(",").map((s) => s.trim()).filter(Boolean);
  else if (a === "--expand-inline") opt.expandInline = (args[++i] || "").split(",").map((s) => s.trim().replace(/^@/, "")).filter(Boolean);
  else if (a === "-h" || a === "--help") { usage(); process.exit(0); }
  else if (a.startsWith("--")) { console.error(`Unknown option ${a}`); usage(); process.exit(2); }
  else targets.push(a);
}
if (!targets.length) { usage(); process.exit(2); }

function usage() {
  console.error("Usage: node scripts/lint-sql.mjs <file-or-folder>... [--soft-delete A,B] [--expand-inline P1,P2] [--json]");
}

function collect(p, out) {
  if (!existsSync(p)) { console.error(`Not found: ${p}`); process.exit(2); }
  if (statSync(p).isDirectory()) {
    for (const n of readdirSync(p)) collect(join(p, n), out);
  } else if (extname(p).toLowerCase() === ".sql") out.push(p);
  return out;
}
const files = targets.flatMap((t) => collect(t, []));

// Replace comments and string literals with spaces (newlines kept) so offsets map to the original.
function mask(src) {
  let out = "";
  let i = 0;
  while (i < src.length) {
    const c = src[i], n = src[i + 1];
    if (c === "-" && n === "-") {
      while (i < src.length && src[i] !== "\n") { out += " "; i++; }
    } else if (c === "/" && n === "*") {
      const end = src.indexOf("*/", i + 2);
      const stop = end === -1 ? src.length : end + 2;
      for (; i < stop; i++) out += src[i] === "\n" ? "\n" : " ";
    } else if (c === "'") {
      out += "'"; i++;
      while (i < src.length) {
        if (src[i] === "'" && src[i + 1] === "'") { out += "  "; i += 2; continue; }
        if (src[i] === "'") { out += "'"; i++; break; }
        out += src[i] === "\n" ? "\n" : "x"; i++;
      }
    } else { out += c; i++; }
  }
  return out;
}

const lineOf = (text, idx) => text.slice(0, idx).split("\n").length;

const findings = [];
function add(file, text, idx, level, rule, msg) {
  findings.push({ file, line: lineOf(text, idx), level, rule, message: msg });
}

// BDA-15 (opt-in): team SQL style. One finding per kind per file keeps the output short.
function styleChecks(file, raw, m) {
  const first = raw.replace(/^\s+/, "");
  if (!/^(--|\/\*)/.test(first))
    add(file, m, 0, "warning", "BDA-15", "No header comment: start the node with /* <NodeName>: purpose */.");
  const lower = /\b(select|from|where|group by|order by|having|inner join|left join|join|and|or|as)\b/.exec(m);
  if (lower)
    add(file, m, lower.index, "warning", "BDA-15", `'${lower[1]}' in lowercase: write SQL keywords in UPPERCASE.`);
  for (const r of m.matchAll(/(\b\w+\s+)?\bJOIN\b/gi)) {
    if (!/^(INNER|LEFT|RIGHT|FULL|CROSS|OUTER)\s+$/i.test(r[1] || "")) {
      add(file, m, r.index + (r[1] || "").length, "warning", "BDA-15", "Bare JOIN: write INNER JOIN or LEFT JOIN explicitly.");
      break;
    }
  }
  const trailing = /,[ \t]*\n/.exec(m);
  if (trailing)
    add(file, m, trailing.index, "warning", "BDA-15", "Trailing comma at the end of a line: put commas at the start of the next line.");
  const KEY = /^(ON|AS|WHERE|SET|INNER|LEFT|RIGHT|FULL|CROSS|JOIN|GROUP|ORDER|WITH|UNION)$/i;
  for (const r of m.matchAll(/\{\w+\}\s+(?:AS\s+)?([A-Za-z_]\w*)\b/g)) {
    if (!KEY.test(r[1]) && r[1].length <= 2) {
      add(file, m, r.index, "warning", "BDA-15", `Alias '${r[1]}' is an abbreviation: use a descriptive CamelCase alias (e.g. Assignee) or none.`);
      break;
    }
  }
}

const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

for (const file of files) {
  const raw = readFileSync(file, "utf8").replace(/\r\n/g, "\n");
  const m = mask(raw);

  // Split into statements on ';' (offsets kept).
  const stmts = [];
  let start = 0;
  for (let i = 0; i <= m.length; i++) {
    if (i === m.length || m[i] === ";") {
      const body = m.slice(start, i);
      if (body.trim()) stmts.push({ offset: start, text: body });
      start = i + 1;
    }
  }

  if (opt.style) styleChecks(file, raw, m);

  for (const s of stmts) {
    const t = s.text;
    const at = (re) => { const r = re.exec(t); return r ? s.offset + r.index : null; };
    const lead = t.replace(/^\s+/, "");
    const leadIdx = s.offset + (t.length - lead.length);
    const kind = (/^(WITH\b[\s\S]*?\)\s*)?(SELECT|UPDATE|DELETE|INSERT|MERGE)\b/i.exec(lead) || [])[2]?.toUpperCase()
      || (/^(SELECT|UPDATE|DELETE|INSERT|MERGE)\b/i.exec(lead) || [])[1]?.toUpperCase() || "OTHER";

    // BDA-03 physical table names
    for (const r of t.matchAll(/\b(OSUSR|OSSYS|OSLTM)_\w+/gi))
      add(file, m, s.offset + r.index, "error", "BDA-03", `Physical table name '${r[0]}': use {Entity}.[Attribute] syntax (names differ per environment).`);

    // BDA-05 SELECT *
    for (const r of t.matchAll(/\bSELECT\s+(?:DISTINCT\s+)?(?:TOP\s*\(?\s*[@\w]+\s*\)?\s+)?\*/gi))
      add(file, m, s.offset + r.index, "error", "BDA-05", "SELECT *: list the columns in the order of the output Structure.");
    for (const r of t.matchAll(/\{\w+\}\s*\.\s*\*/g))
      add(file, m, s.offset + r.index, "warning", "BDA-05", `'${r[0]}' returns every column: acceptable only when the output is that entity's record and all columns are needed.`);

    // BDA-05 unbounded SELECT
    if (kind === "SELECT") {
      const limited = /\bTOP\b|\bOFFSET\b[\s\S]*\bFETCH\b|\bFETCH\s+(FIRST|NEXT)\b|\bROWNUM\b|\bLIMIT\s+[@\d]/i.test(t);
      const firstSelect = /\bSELECT\s+([\s\S]*?)\bFROM\b/i.exec(t);
      const aggOnly = firstSelect && !/\bGROUP\s+BY\b/i.test(t) &&
        firstSelect[1].split(",").every((c) => /^\s*(COUNT|SUM|MAX|MIN|AVG)\s*\(/i.test(c));
      const existsOnly = /^\s*SELECT\s+(CASE\s+WHEN\s+)?(NOT\s+)?EXISTS\b/i.test(lead) || /^\s*SELECT\s+1\b/i.test(lead);
      if (!limited && !aggOnly && !existsOnly)
        add(file, m, leadIdx, "warning", "BDA-05", "No row limit inside the statement (TOP / OFFSET…FETCH / ROWNUM). The node's Max. Records doesn't limit what the database returns.");
    }

    // BDA-08 UPDATE/DELETE without WHERE
    if ((kind === "UPDATE" || kind === "DELETE") && !/\bWHERE\b/i.test(t))
      add(file, m, leadIdx, "error", "BDA-08", `${kind} without WHERE affects every row.`);

    // BDA-04 dynamic SQL / likely Expand Inline
    for (const r of t.matchAll(/\b(EXEC(UTE)?\s*\(|sp_executesql)/gi))
      add(file, m, s.offset + r.index, "error", "BDA-04", "Dynamic SQL execution: injection risk and invisible to reviewers. Use parameters or aggregates.");
    for (const r of t.matchAll(/\bIN\s*\(\s*@(\w+)\s*\)/gi))
      add(file, m, s.offset + r.index, "warning", "BDA-04", `IN (@${r[1]}) is usually Expand Inline: build the value with BuildSafe_InClauseIntegerList / BuildSafe_InClauseTextList.`);
    for (const r of t.matchAll(/\bORDER\s+BY\s+@(\w+)/gi))
      add(file, m, s.offset + r.index, "warning", "BDA-04", `ORDER BY @${r[1]} needs Expand Inline: map the sort key through an allow-list of columns.`);
    for (const p of opt.expandInline) {
      const r = new RegExp(`@${reEsc(p)}\\b`, "i").exec(t);
      if (r) add(file, m, s.offset + r.index, "warning", "BDA-04", `@${p} is Expand Inline: confirm it is built with BuildSafe_InClause*, EncodeSql on literals, or an allow-list.`);
    }

    // BDA-07 non-sargable predicates and leading wildcards
    const clauseRe = /\b(WHERE|ON)\b([\s\S]*?)(?=\bGROUP\s+BY\b|\bORDER\s+BY\b|\b(?:INNER|LEFT|RIGHT|FULL|CROSS)\s+(?:OUTER\s+)?JOIN\b|\bJOIN\b|\bHAVING\b|\bUNION\b|$)/gi;
    for (const c of t.matchAll(clauseRe)) {
      const base = s.offset + c.index + c[0].length - c[2].length;
      const fnRe = /\b(UPPER|LOWER|CONVERT|CAST|ISNULL|COALESCE|YEAR|MONTH|DAY|DATEPART|DATEADD|TRIM|LTRIM|RTRIM|SUBSTRING|LEFT|RIGHT|TRUNC|TO_CHAR)\s*\(\s*(?:[\w]+\s*,\s*)?(\{\w+\}|\w+)\s*\.\s*\[?\w+\]?/gi;
      for (const f of c[2].matchAll(fnRe))
        add(file, m, base + f.index, "warning", "BDA-07", `${f[1].toUpperCase()}() on a column in ${c[1].toUpperCase()}: the index can't be used. Transform the parameter instead, or precompute.`);
    }
    for (const r of raw.slice(s.offset, s.offset + t.length).matchAll(/\bLIKE\s+(N?'%|'%'\s*(\+|\|\|))/gi))
      add(file, m, s.offset + r.index, "warning", "BDA-07", "Leading-wildcard LIKE can't use an index: prefer prefix search, or full-text search for large tables.");

    // BDA-09 NOLOCK
    for (const r of t.matchAll(/\bNOLOCK\b|\bREAD\s+UNCOMMITTED\b/gi))
      add(file, m, s.offset + r.index, "warning", "BDA-09", "NOLOCK / READ UNCOMMITTED gives dirty and duplicate reads: don't use it in business logic.");

    // BDA-13 row-by-row SQL
    for (const r of t.matchAll(/\bCURSOR\b|\bWHILE\b/gi))
      add(file, m, s.offset + r.index, "warning", "BDA-13", `${r[0].toUpperCase()} in SQL: use set-based statements; move procedural logic to actions or a timer.`);

    // BDA-12 hard-coded identifiers
    for (const r of t.matchAll(/\[(\w*Id)\]\s*(=|<>|!=|IN\s*\()\s*\d+/gi))
      add(file, m, s.offset + r.index, "warning", "BDA-12", `[${r[1]}] compared with a literal number: pass static entity ids as parameters (Entities.<Static>.<Record>).`);

    // BDA-06 soft delete
    if (kind !== "INSERT") {
      for (const e of opt.softDelete) {
        const refRe = new RegExp(`\\{${reEsc(e)}\\}(?:\\s+(?:AS\\s+)?(?!WHERE|ON|INNER|LEFT|RIGHT|JOIN|SET|GROUP|ORDER|WITH|FULL|CROSS|UNION)([A-Za-z_]\\w*))?`, "gi");
        const refs = [...t.matchAll(refRe)];
        if (!refs.length) continue;
        const names = [`\\{${reEsc(e)}\\}`, ...refs.map((r) => r[1]).filter(Boolean).map(reEsc)];
        const singleEntity = new Set([...t.matchAll(/\{(\w+)\}/g)].map((r) => r[1].toLowerCase())).size === 1;
        const filtered = new RegExp(`(${names.join("|")})\\s*\\.\\s*\\[?IsDeleted\\]?`, "i").test(t)
          || (singleEntity && /(^|[^.\w\]])\[IsDeleted\]/i.test(t)); // unqualified column is unambiguous with one entity
        if (!filtered)
          add(file, m, s.offset + refs[0].index, "error", "BDA-06", `{${e}} is soft-deleted but this statement doesn't filter IsDeleted.`);
      }
    }
  }
}

const errors = findings.filter((f) => f.level === "error").length;
const warnings = findings.length - errors;
if (opt.json) {
  console.log(JSON.stringify({ files: files.length, errors, warnings, findings }, null, 2));
} else {
  for (const f of findings) console.log(`${f.level.toUpperCase().padEnd(7)} ${f.rule}  ${f.file}:${f.line}  ${f.message}`);
  console.log(`\n${files.length} file(s): ${errors} error(s), ${warnings} warning(s).`);
}
process.exit(errors ? 1 : 0);
