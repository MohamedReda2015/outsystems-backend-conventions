#!/usr/bin/env node
// check-backend.mjs — checks an OutSystems backend inventory against the backend conventions
// (Node.js 16+, no packages).
//
// Usage:
//   node scripts/check-backend.mjs <inventory.json> [--style underscore|pascal] [--json]
//
// The inventory is a JSON export you build from the Service Studio MCP read tools, Discovery,
// or by hand. Only "modules[].name" is required; every other field is optional and a check
// runs only when its data is present. Example: scripts/examples/inventory-good.json.
//
// {
//   "namingStyle": "underscore",                       // or "pascal"; --style overrides
//   "modules": [{
//     "name": "Request_BL",                             // suffix gives the layer (_CS, _BL, _IS, _API…)
//     "entities":   [{ "name", "public", "exposeReadOnly", "isStatic", "isBusiness", "softDelete",
//                      "attributes": [{ "name", "type" }] }],
//     "structures": [{ "name", "public" }],
//     "actions":    [{ "name", "kind": "server|service|function", "public", "folder", "description",
//                      "calledFromClient", "nodeCount", "commitsTransaction", "calls": ["…"],
//                      "aggregateOnly", "returnsStructure", "hasExceptionHandler",
//                      "inputs": [{ "name", "type", "mandatory" }] }],
//     "siteProperties": [{ "name", "isSecret", "description" }],
//     "timers":       [{ "name", "action", "timeoutMinutes", "schedule" }],
//     "consumedRest": [{ "name", "loggingLevel": "Default|Troubleshoot|Full", "redactInputs",
//                        "methods": [{ "name", "timeoutSeconds" }] }],
//     "exposedRest":  [{ "name", "authentication": "None|Basic|Custom|OAuth", "internalAccessOnly", "requireHttps",
//                        "testedUnauthenticated" }]
//   }]
// }
//
// Exit code: 0 = no errors (warnings allowed), 1 = at least one error, 2 = usage error.
// Rule IDs are defined in references/review-checklist.md (this skill) and in the
// outsystems-architecture skill (HSE-*, MNT-*).

import { readFileSync, existsSync } from "node:fs";

const args = process.argv.slice(2);
let file = null, json = false, styleArg = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--json") json = true;
  else if (args[i] === "--style") styleArg = args[++i];
  else if (args[i] === "-h" || args[i] === "--help") { usage(); process.exit(0); }
  else if (args[i].startsWith("--")) { console.error(`Unknown option ${args[i]}`); usage(); process.exit(2); }
  else file = args[i];
}
function usage() { console.error("Usage: node scripts/check-backend.mjs <inventory.json> [--style underscore|pascal] [--json]"); }
if (!file || !existsSync(file)) { usage(); process.exit(2); }

let inv;
try { inv = JSON.parse(readFileSync(file, "utf8")); }
catch (e) { console.error(`Invalid JSON: ${e.message}`); process.exit(2); }
if (!Array.isArray(inv.modules)) { console.error("Inventory needs a 'modules' array."); process.exit(2); }

const style = styleArg || inv.namingStyle || "underscore";
if (!["underscore", "pascal"].includes(style)) { console.error(`Unknown style ${style}`); process.exit(2); }

const findings = [];
const add = (level, rule, where, message) => findings.push({ level, rule, element: where, message });

// ---- layer from module name -------------------------------------------------------------
const SUB = [
  ["Front_End", "EndUser"], ["FE", "EndUser"], ["BO", "EndUser"], ["Portal", "EndUser"], ["MUI", "EndUser"],
  ["CS", "CS"], ["MCS", "CS"], ["MDB", "CS"], ["BL", "BL"], ["MBL", "BL"], ["CW", "CW"], ["MCW", "CW"],
  ["Sync", "Sync"], ["Eng", "Eng"], ["API", "API"], ["OAPI", "API"],
  ["IS", "IS"], ["Drv", "IS"], ["Lib", "Lib"], ["FS", "Lib"], ["Ext", "Lib"], ["Th", "Th"], ["Pat", "Th"],
];
const label = (sl) => ({ EndUser: "an End-User", CW: "a CW", IS: "an _IS", API: "an _API", Th: "a theme", BL: "a BL", CS: "a CS", Sync: "a _Sync", Eng: "an _Eng", Lib: "a _Lib" }[sl] || sl);
function sublayer(name) {
  for (const [suf, sl] of SUB) if (name === suf || name.endsWith("_" + suf)) return sl;
  return "EndUser"; // unsuffixed modules are End-User by convention (name appears in the URL)
}

const DEFAULT_NAME = /^(Action|ServerAction|ServiceAction|ClientAction|Function|Aggregate|SQL|Structure|Exception|Entity|Timer)\d+$|^(Test|Temp|Tmp)\d*$|(Copy|_Copy)\d*$|^CopyOf/i;
const IDENTITY_INPUT = /^(UserId|CurrentUserId|LoggedUserId|LoggedInUserId|TenantId|IsAdmin|IsAdministrator|Role|RoleName|RoleId|ActorId|CreatedBy|UpdatedBy)$/i;
const SECRET_NAME = /(Secret|Password|Passwd|Pwd|Token|ApiKey|PrivateKey|ClientKey|AccessKey|SigningKey)$/i;
const AUDIT_COLS = ["CreatedBy", "CreatedOn", "UpdatedBy", "UpdatedOn"];

const allEntities = new Set();
for (const mod of inv.modules) for (const e of mod.entities || []) allEntities.add(e.name);
const timerActions = new Set();
for (const mod of inv.modules) for (const t of mod.timers || []) if (t.action) timerActions.add(t.action);

function nameStyleOk(name) {
  if (/^Timer_[A-Z]\w*$/.test(name)) return true;
  if (style === "underscore") return /^[A-Z][A-Za-z0-9]*(_[A-Z][A-Za-z0-9]*)+$/.test(name);
  return /^[A-Z][A-Za-z0-9]*$/.test(name);
}
const logicNameOf = (n) => (style === "underscore" ? `${n}_Logic` : `${n}Logic`);
const isLogicName = (n) => /(_Logic|Logic)$/.test(n);

for (const mod of inv.modules) {
  const M = mod.name || "(unnamed module)";
  const sl = sublayer(M);

  // ---- entities ------------------------------------------------------------------------
  for (const e of mod.entities || []) {
    const W = `${M}.${e.name}`;
    if (DEFAULT_NAME.test(e.name)) add("warning", "BNM-02", W, "Default or placeholder entity name.");
    if (["EndUser", "CW", "IS", "API", "Th"].includes(sl))
      add("error", "BDA-01", W, `Entity in ${label(sl)} module: business entities live in a _CS module.`);
    else if (sl === "BL")
      add("warning", "BDA-01", W, "Entity in BL: only hot-cache entities belong here; business entities live in _CS.");
    if (e.public && e.exposeReadOnly === false && !e.isStatic)
      add("error", "BDA-01", W, "Public entity is not Expose Read-Only: writes must go through CS CRUD wrappers.");
    const attrs = (e.attributes || []).map((a) => a.name);
    if (sl === "CS" && !e.isStatic && e.isBusiness !== false && attrs.length) {
      const missing = AUDIT_COLS.filter((c) => !attrs.includes(c));
      if (missing.length) add("warning", "BDA-02", W, `Business entity without audit columns: ${missing.join(", ")}.`);
    }
    if (e.softDelete && !attrs.includes("IsDeleted"))
      add("error", "BDA-06", W, "Marked softDelete but has no IsDeleted attribute.");
    for (const a of e.attributes || []) {
      if (/\bIdentifier$/i.test(a.type || "") && a.name !== "Id" && !/Id$/.test(a.name) && !/^(Created|Updated|Deleted)By$/.test(a.name))
        add("warning", "BNM-07", `${W}.${a.name}`, "Foreign key attribute should end in 'Id'.");
    }
  }

  // ---- structures ----------------------------------------------------------------------
  for (const s of mod.structures || []) {
    const W = `${M}.${s.name}`;
    if (DEFAULT_NAME.test(s.name)) add("warning", "BNM-02", W, "Default or placeholder structure name.");
    if (sl === "CS") add("error", "HSE-02", W, "Structure in CS: all DTO Structures live in BL.");
    else if (sl === "EndUser" || sl === "CW") add("warning", "HSE-02", W, `Structure in ${label(sl)} module: business DTOs live in BL (UI-only structures are fine).`);
    if (sl === "IS" && s.public !== false && style === "underscore" && !/_IS_/.test(s.name))
      add("warning", "BNM-05", W, "Public IS structure should be named <Concept>_IS_<Purpose> (normalized, not generated).");
  }

  // ---- actions -------------------------------------------------------------------------
  const actionNames = new Set((mod.actions || []).map((a) => a.name));
  for (const a of mod.actions || []) {
    const W = `${M}.${a.folder ? a.folder.replace(/\//g, ".") + "." : ""}${a.name}`;
    const desc = a.description || "";
    const reachable = a.calledFromClient || (a.public && ["BL", "API"].includes(sl)) || a.kind === "service";

    if (DEFAULT_NAME.test(a.name)) add("warning", "BNM-02", W, "Default or placeholder action name.");
    if (a.public && !nameStyleOk(a.name))
      add("warning", "BNM-01", W, `Name doesn't follow the '${style}' action naming style.`);
    if (a.public && !desc.trim()) add("warning", "HSE-06", W, "Public action without a Description.");

    if (a.kind === "service" && sl === "CS")
      add("error", "BLG-02", W, "Service Action in CS: CRUD wrappers are Server Actions so writes join the caller's transaction.");

    if (a.public && isLogicName(a.name))
      add("warning", "BLG-01", W, "_Logic implementations should be private; expose the thin action instead.");

    if (a.public && sl === "BL" && (a.nodeCount || 0) > 15 && !isLogicName(a.name)) {
      const callsLogic = (a.calls || []).some((c) => c === logicNameOf(a.name) || isLogicName(c));
      if (!callsLogic) add("warning", "BLG-01", W, `Public BL action has ${a.nodeCount} nodes and calls no _Logic: keep it thin (authorize → validate → _Logic → map).`);
    }
    if ((a.nodeCount || 0) > 40 && !desc.trim())
      add("warning", "MNT-03", W, `Long flow (${a.nodeCount} nodes) without a description: split or document it.`);

    if (a.commitsTransaction) {
      if (!/\[(commit|abort) transaction\]/i.test(desc))
        add("error", "BTX-02", W, "Commits or aborts the transaction but the Description lacks '[commit transaction]'.");
      if (sl === "CS" || (sl === "BL" && a.public && !a.name.startsWith("Timer_")))
        add("warning", "BTX-02", W, "CommitTransaction in a CRUD wrapper or use-case action: commit only in timers, batches and long processes.");
    }

    for (const p of a.inputs || []) {
      const P = `${W}(${p.name})`;
      if (/^(Param|Input|Parameter|In)\d*$/i.test(p.name)) add("warning", "BNM-07", P, "Meaningless parameter name.");
      if (reachable && IDENTITY_INPUT.test(p.name) && sl !== "CS")
        add("error", "BSC-02", P, "Identity/role input on a reachable action: call GetUserId() / Check<Role>Role() on the server.");
      if (sl === "CS" && /^(CreatedBy|CreatedOn|UpdatedBy|UpdatedOn)$/.test(p.name))
        add("warning", "BDA-02", P, "Audit column passed in: the CRUD wrapper sets audit columns itself.");
      const t = (p.type || "").trim();
      const isRecord = /\bRecord$/i.test(t) || allEntities.has(t.replace(/^List of\s+/i, ""));
      if (reachable && sl !== "CS" && isRecord)
        add("error", "BLG-03", P, `Entity record input (${t}) on a reachable action: accept only the fields the caller may change.`);
    }

    if (a.aggregateOnly && !a.returnsStructure)
      add("warning", "BPF-08", W, "Action only wraps one aggregate and returns its records: the aggregate can't be optimized for the caller's fields. Query where used, or return a purpose-built Structure.");
    if ((a.name.startsWith("Timer_") || timerActions.has(a.name)) && a.hasExceptionHandler === false)
      add("warning", "BER-08", W, "Timer entry action without an exception handler: the global handler doesn't cover timers.");

    if (a.name.startsWith("Timer_") && timerActions.size && !timerActions.has(a.name))
      add("warning", "BNM-06", W, "Timer_ action not used by any timer in the inventory.");
  }

  // ---- timers --------------------------------------------------------------------------
  for (const t of mod.timers || []) {
    const W = `${M}.Timers.${t.name}`;
    if (["EndUser", "CW", "Th"].includes(sl)) add("error", "BAS-06", W, `Timer in ${label(sl)} module: timers live in Core (_Sync, _Eng, _BL, _CS).`);
    if (t.action && !t.action.startsWith("Timer_")) add("warning", "BNM-06", W, `Timer action '${t.action}' should be named Timer_<Job>.`);
    if (t.action && !actionNames.has(t.action) && (mod.actions || []).length)
      add("warning", "BAS-01", W, `Timer action '${t.action}' not found in this module's actions.`);
    if ((t.timeoutMinutes || 0) > 30) add("error", "BAS-01", W, `Timeout ${t.timeoutMinutes} min: split into batches with a logical timeout and re-wake (max 30).`);
  }

  const bySchedule = {};
  for (const t of mod.timers || []) if (t.schedule) (bySchedule[t.schedule] ||= []).push(t.name);
  for (const [sch, names] of Object.entries(bySchedule))
    if (names.length > 3) add("warning", "BAS-07", M, `${names.length} timers share schedule '${sch}' (${names.join(", ")}): O11 runs 3 timers at once per front-end by default; stagger them.`);

  // ---- site properties -----------------------------------------------------------------
  const sps = mod.siteProperties || [];
  if (sps.length > 20) add("warning", "BCF-02", M, `${sps.length} site properties: move runtime/business settings to a configuration entity (≤ ~20).`);
  for (const p of sps) {
    const W = `${M}.SiteProperties.${p.name}`;
    if (SECRET_NAME.test(p.name) && !p.isSecret)
      add("error", "BSC-03", W, "Secret-looking site property without Is Secret = Yes (Platform Server 11.25+), or move it to an encrypted store.");
    if (!(p.description || "").trim()) add("warning", "BCF-02", W, "Site property without a Description.");
  }

  // ---- consumed REST -------------------------------------------------------------------
  for (const r of mod.consumedRest || []) {
    const W = `${M}.Integrations.${r.name}`;
    if (/^(full|troubleshoot)$/i.test(r.loggingLevel || "") && !r.redactInputs)
      add("warning", "BIN-06", W, `Logging level ${r.loggingLevel} without input redaction: parameter values (personal data, tokens) become visible in Service Center.`);
    if (sl !== "IS") add("error", "BIN-01", W, `Consumed REST in ${label(sl)} module: external calls live in a <Concept>_IS module.`);
    for (const meth of r.methods || []) {
      const MW = `${W}.${meth.name}`;
      if (meth.timeoutSeconds == null) add("warning", "BIN-02", MW, "No explicit timeout: set ≤ 10 s for user-facing calls, ≤ 30 s for background.");
      else if (meth.timeoutSeconds > 30) add("warning", "BIN-02", MW, `Timeout ${meth.timeoutSeconds} s is long: ≤ 10 s user-facing, ≤ 30 s background, otherwise go async.`);
    }
  }

  // ---- exposed REST --------------------------------------------------------------------
  for (const r of mod.exposedRest || []) {
    const W = `${M}.ExposedREST.${r.name}`;
    if (sl !== "API") add("warning", "BIN-07", W, "Exposed REST outside an _API module: keep exposure, auth and mapping in <Concept>_API.");
    if (/^none$/i.test(r.authentication || "") && !r.internalAccessOnly)
      add("error", "BIN-07", W, "Exposed REST without authentication and not Internal Access Only.");
    if (r.requireHttps === false) add("error", "BIN-07", W, "Exposed REST doesn't require HTTPS/TLS.");
    if (!r.internalAccessOnly && r.testedUnauthenticated !== true)
      add("warning", "BSC-11", W, "Not verified that an unauthenticated call returns 401 (exposed APIs aren't secured by default).");
  }
}

const errors = findings.filter((f) => f.level === "error").length;
const warnings = findings.length - errors;
if (json) {
  console.log(JSON.stringify({ style, modules: inv.modules.length, errors, warnings, findings }, null, 2));
} else {
  for (const f of findings) console.log(`${f.level.toUpperCase().padEnd(7)} ${f.rule.padEnd(7)} ${f.element}  ${f.message}`);
  console.log(`\n${inv.modules.length} module(s), style '${style}': ${errors} error(s), ${warnings} warning(s).`);
}
process.exit(errors ? 1 : 0);
