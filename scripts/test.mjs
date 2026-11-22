#!/usr/bin/env node
// Regression tests for the two scripts (Node.js 16+, no packages).
//   node scripts/test.mjs
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = fileURLToPath(new URL(".", import.meta.url));
const ex = (p) => join(DIR, "examples", p);
let failed = 0;

function run(script, argv) {
  const r = spawnSync(process.execPath, [join(DIR, script), ...argv, "--json"], { encoding: "utf8" });
  return { code: r.status, out: JSON.parse(r.stdout) };
}
function expect(name, cond, detail = "") {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  " + detail}`);
  if (!cond) failed++;
}
const rules = (out, level) => [...new Set(out.findings.filter((f) => !level || f.level === level).map((f) => f.rule))].sort();
const same = (a, b) => JSON.stringify(a) === JSON.stringify([...b].sort());

// check-backend
let r = run("check-backend.mjs", [ex("inventory-good.json")]);
expect("inventory-good: no findings, exit 0", r.code === 0 && r.out.findings.length === 0, JSON.stringify(r.out.findings));

r = run("check-backend.mjs", [ex("inventory-bad.json")]);
const badErr = ["BAS-01", "BAS-06", "BDA-01", "BDA-06", "BIN-01", "BIN-07", "BLG-02", "BLG-03", "BSC-02", "BSC-03", "BTX-02", "HSE-02"];
const badWarn = ["BAS-07", "BCF-02", "BDA-02", "BER-08", "BIN-02", "BIN-06", "BIN-07", "BLG-01", "BNM-01", "BNM-02", "BNM-06", "BNM-07", "BPF-08", "BSC-11", "BTX-02", "HSE-06", "MNT-03"];
expect("inventory-bad: exit 1", r.code === 1);
expect("inventory-bad: error rules", same(rules(r.out, "error"), badErr), rules(r.out, "error").join(","));
expect("inventory-bad: warning rules", same(rules(r.out, "warning"), badWarn), rules(r.out, "warning").join(","));

r = run("check-backend.mjs", [ex("inventory-good.json"), "--style", "pascal"]);
expect("inventory-good with pascal style flags BNM-01", rules(r.out).includes("BNM-01"));

// lint-sql
r = run("lint-sql.mjs", [ex("sql-good"), "--soft-delete", "Request,RequestFile"]);
expect("sql-good: no findings, exit 0", r.code === 0 && r.out.findings.length === 0, JSON.stringify(r.out.findings));

r = run("lint-sql.mjs", [ex("sql-bad"), "--soft-delete", "Request"]);
const sqlErr = ["BDA-03", "BDA-04", "BDA-05", "BDA-06", "BDA-08"];
const sqlWarn = ["BDA-04", "BDA-05", "BDA-07", "BDA-09", "BDA-12", "BDA-13"];
expect("sql-bad: exit 1", r.code === 1);
expect("sql-bad: error rules", same(rules(r.out, "error"), sqlErr), rules(r.out, "error").join(","));
expect("sql-bad: warning rules", same(rules(r.out, "warning"), sqlWarn), rules(r.out, "warning").join(","));

console.log(failed ? `\n${failed} test(s) failed.` : "\nAll tests passed.");
process.exit(failed ? 1 : 0);
