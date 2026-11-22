#!/usr/bin/env node
// Consistency checks for the outsystems-backend-conventions skill (Node.js 16+, no packages).
//   node scripts/check_skill.mjs
// Exit code: 0 = all checks pass, 1 = at least one error.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const errors = [];
const warnings = [];
const read = (p) => readFileSync(join(ROOT, p), "utf8");

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === ".git" || name === "node_modules") continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(relative(ROOT, full).split(sep).join("/"));
  }
  return out;
}
const files = walk(ROOT);
const textFiles = files.filter((f) => /\.(md|mdc|mjs|json|yml|sql|txt)$/.test(f) || !f.includes("."));

// 1. SKILL.md frontmatter and size
const skill = read("SKILL.md").replace(/\r\n/g, "\n");
const fm = skill.match(/^---\n([\s\S]*?)\n---/);
if (!fm) errors.push("SKILL.md: missing YAML frontmatter");
else {
  const get = (k) => (fm[1].match(new RegExp(`^${k}:\\s*(.*)$`, "m")) || [])[1];
  const name = get("name"), desc = get("description"), lic = get("license");
  const version = (fm[1].match(/^\s+version:\s*(\S+)/m) || [])[1];
  if (!name || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name) || name.length > 64) errors.push(`SKILL.md: invalid name '${name}'`);
  if (!desc) errors.push("SKILL.md: missing description");
  else if (desc.length > 1024) errors.push(`SKILL.md: description is ${desc.length} chars (max 1024)`);
  if (!lic) warnings.push("SKILL.md: no license field");
  if (!version || !/^\d+\.\d+\.\d+$/.test(version)) errors.push(`SKILL.md: metadata.version '${version}' is not semver`);
  else if (!existsSync(join(ROOT, "CHANGELOG.md")) || !read("CHANGELOG.md").includes(`## ${version}`)) errors.push(`CHANGELOG.md: no entry for version ${version}`);
}
const skillLines = skill.split("\n").length;
if (skillLines > 500) errors.push(`SKILL.md: ${skillLines} lines (max 500)`);
else if (skillLines > 300) warnings.push(`SKILL.md: ${skillLines} lines (aim for < 300)`);

// 2. Referenced paths exist (paths that belong to companion skills are written "… there" and skipped)
const pathRe = /\b((?:references|templates|scripts|adapters|evals)\/[A-Za-z0-9_./-]+\.(?:md|mjs|json|mdc|sql))\b(?!` there)/g;
for (const f of files.filter((x) => /\.(md|mdc)$/.test(x))) {
  for (const m of read(f).matchAll(pathRe)) {
    const p = m[1];
    if (p.includes("*") || p.includes("<")) continue;
    if (!existsSync(join(ROOT, p))) errors.push(`${f}: references missing file ${p}`);
  }
}

// 3. Rule IDs: own rules defined once in the checklist; lessons defined once; every cited ID known
const checklist = read("references/review-checklist.md");
const defined = [...checklist.matchAll(/^\| ([A-Z]+-\d+) \|/gm)].map((m) => m[1]);
const dup = defined.filter((id, i) => defined.indexOf(id) !== i);
if (dup.length) errors.push(`review-checklist.md: duplicate rule IDs ${[...new Set(dup)].join(", ")}`);
const lessons = [...read("references/lessons-learned.md").matchAll(/\*\*(BLL-\d+)\b/g)].map((m) => m[1]);
const dupL = lessons.filter((id, i) => lessons.indexOf(id) !== i);
if (dupL.length) errors.push(`lessons-learned.md: duplicate lesson IDs ${[...new Set(dupL)].join(", ")}`);
const known = new Set([...defined, ...lessons]);

// Rule IDs defined by the companion outsystems-architecture skill (v2.0.0).
const ARCH = {
  ARC: [1, 14], HSE: [1, 6], DAT: [1, 12], INT: [1, 6], UI: [1, 8], SEC: [1, 14],
  AUD: [1, 3], MNT: [1, 8], OPS: [1, 7], TST: [1, 4],
};
const archPerf = new Set([1, 4, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
for (const [p, [a, b]] of Object.entries(ARCH)) for (let i = a; i <= b; i++) known.add(`${p}-${String(i).padStart(2, "0")}`);
for (const i of archPerf) known.add(`PERF-${String(i).padStart(2, "0")}`);

const idRe = /\b(BNM|BLG|BTX|BDA|BIN|BER|BAS|BPF|BSC|BCF|BLL|ARC|HSE|DAT|INT|UI|PERF|SEC|AUD|MNT|OPS|TST)-(\d+)\b/g;
for (const f of files.filter((x) => /\.(md|mdc|mjs|json)$/.test(x) && !x.startsWith(".github/") && x !== "scripts/check_skill.mjs")) {
  for (const m of read(f).matchAll(idRe)) {
    if (!known.has(m[0])) errors.push(`${f}: cites undefined rule ${m[0]}`);
  }
}

// 4. Adapters carry the core-rules block markers
for (const a of ["adapters/AGENTS.md", "adapters/copilot-instructions.md", "adapters/cursor/outsystems-backend-conventions.mdc"]) {
  if (!existsSync(join(ROOT, a))) { errors.push(`${a}: missing`); continue; }
  const t = read(a);
  if (!t.includes("BEGIN core rules") || !t.includes("END core rules")) errors.push(`${a}: missing BEGIN/END core rules markers`);
}

// 5. Privacy / secret hygiene (generic patterns only)
const secretRes = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "private key"],
  [/\b(?:api[_-]?key|secret|password|token)\s*[:=]\s*["']?[A-Za-z0-9+/_-]{16,}/i, "credential-like assignment"],
  [/\b[A-Za-z0-9._%+-]+@(?!example\.(?:com|org)\b|noreply\b)[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/, "e-mail address"],
  [/\b(?:\d{1,3}\.){3}\d{1,3}\b/, "IP address"],
];
for (const f of textFiles) {
  if (f === "scripts/check_skill.mjs") continue;
  read(f).split("\n").forEach((line, i) => {
    for (const [re, what] of secretRes) {
      if (!re.test(line)) continue;
      if (what === "IP address" && /\b127\.0\.0\.1\b|\b0\.0\.0\.0\b/.test(line)) continue;
      errors.push(`${f}:${i + 1}: possible ${what}`);
    }
  });
}

for (const w of warnings) console.log(`warning: ${w}`);
for (const e of errors) console.log(`error:   ${e}`);
console.log(errors.length ? `FAILED: ${errors.length} error(s)` : `OK: ${files.length} files checked, ${defined.length} rule IDs, ${lessons.length} lessons`);
process.exit(errors.length ? 1 : 0);
