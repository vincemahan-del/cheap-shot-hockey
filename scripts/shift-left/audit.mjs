#!/usr/bin/env node
// area-coverage-audit CLI. Pure logic lives in engine.mjs (unit-tested). See docs/AREA-COVERAGE-AUDIT.md.
//   node scripts/shift-left/audit.mjs                 # coverage + guard + reconcile report
//   node scripts/shift-left/audit.mjs --guard         # exit 1 if any repo surface is unclassified (CI)
//   node scripts/shift-left/audit.mjs impact <files>  # which tests does this change hit

import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import { buildMaps, areaOfTestid, tidClassified, normRoute, deriveAreas, resolveFiles, filterSurfaces } from "./engine.mjs";

const argv = process.argv.slice(2);
const MODE = argv[0] === "impact" ? "impact" : "audit";
const impactFiles = MODE === "impact" ? argv.slice(1).filter((a) => !a.startsWith("--")) : [];
const ROOT = path.resolve(".");
const HERE = path.dirname(new URL(import.meta.url).pathname);
const GUARD = argv.includes("--guard");

const manifest = yaml.load(fs.readFileSync(path.join(HERE, "coverage.map.yml"), "utf8"));
const index = JSON.parse(fs.readFileSync(path.join(HERE, "test-index.json"), "utf8")).tests;
const maps = buildMaps(manifest);
const { AREAS, routeToArea } = maps;
const set = (arr) => new Set(arr || []);

// reverse lookups: lib/component/message -> area (impact mode)
const libToArea = {}, compToArea = {}, msgToArea = {};
for (const a of AREAS) {
  for (const l of manifest.areas[a].lib || []) libToArea[l] = a;
  for (const c of manifest.areas[a].components || []) compToArea[c] = a;
  for (const m of manifest.areas[a].messages || []) msgToArea[m] = a;
}
const coreLib = set(manifest.core?.lib), coreComp = set(manifest.core?.components), coreMsg = set(manifest.core?.messages);
const exclLib = set(manifest.excluded?.lib), exclComp = set(manifest.excluded?.components);
const platformRoutes = set(manifest.platform?.routes);
const L = (s = "") => console.log(s);

// ---------- IMPACT MODE ----------
if (MODE === "impact") {
  const rel = (f) => f.replace(ROOT + "/", "").replace(/^\.\//, "");
  const fileRoute = (f) => {
    if (!/(^|\/)(page|route)\.tsx?$/.test(f) || !/src\/app\//.test(f)) return null;
    const r = f.replace(/.*src\/app\//, "").replace(/\/?(page|route)\.tsx?$/, "");
    return r === "" ? "/" : "/" + r;
  };
  const fileTids = (f) => {
    let txt = ""; try { txt = fs.readFileSync(path.join(ROOT, rel(f)), "utf8"); } catch { return []; }
    const s = new Set(); let m;
    const rs = /data-testid="([^"]+)"/g, rt = /data-testid=\{`([^`$]*)/g;
    while ((m = rs.exec(txt))) s.add(m[1]);
    while ((m = rt.exec(txt))) if (m[1]) s.add(m[1]);
    return [...s];
  };
  // files from args, or stdin when called as `impact -` / `impact` (pipe-friendly for CI)
  const wantStdin = impactFiles.length === 0 || (impactFiles.length === 1 && impactFiles[0] === "-");
  const allFiles = resolveFiles(impactFiles, wantStdin ? fs.readFileSync(0, "utf8") : "");
  const files = filterSurfaces(allFiles);   // ignore docs/config/CI/.mabl artifacts in the diff
  const skipped = allFiles.length - files.length;
  const areasHit = new Set(); let broad = false; const owned = new Set(); const rep = [];
  for (const f of files) {
    const r = rel(f); let bucket = "unclassified", as = [];
    const route = fileRoute(f);
    if (route !== null) {
      if (routeToArea.has(route)) { bucket = "area"; as = [routeToArea.get(route)]; }
      else if (platformRoutes.has(route)) bucket = "platform";
    } else if (libToArea[r]) { bucket = "area"; as = [libToArea[r]]; }
    else if (coreLib.has(r)) bucket = "core";
    else if (exclLib.has(r)) bucket = "excluded";
    else {
      const base = path.basename(r).replace(/\.tsx?$/, "");
      if (compToArea[base]) { bucket = "area"; as = [compToArea[base]]; }
      else if (coreComp.has(base)) bucket = "core";
      else if (exclComp.has(base)) bucket = "excluded";
      else if (/^messages\//.test(r)) {
        let ns = []; try { ns = Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, r), "utf8"))); } catch {}
        const ba = new Set();
        for (const n of ns) { if (msgToArea[n]) ba.add(msgToArea[n]); else if (coreMsg.has(n)) broad = true; }
        as = [...ba]; bucket = "message-file";
      }
    }
    if (bucket === "core") broad = true;
    for (const a of as) areasHit.add(a);
    for (const t of fileTids(f)) owned.add(t);
    rep.push({ f: r, bucket, as });
  }
  const matchTid = (tt) => [...owned].some((o) => tt === o || tt.startsWith(o) || o.startsWith(tt));
  const precise = index.filter((t) => t.testids.some(matchTid));
  const areaTests = index.filter((t) => t.area.some((a) => areasHit.has(a)));
  L("══════════ impact ══════════");
  for (const x of rep) L(`  ${x.f}  ->  ${x.bucket}${x.as.length ? " (" + x.as.join(",") + ")" : ""}`);
  if (skipped) L(`  (${skipped} non-source file(s) ignored — docs/config/CI/artifacts)`);
  if (!files.length) L("  (no src/ or messages/ surfaces in this diff)");
  L("");
  L(`impacted areas: ${[...areasHit].map((a) => "area-" + a).join(", ") || "(none)"}${broad ? "  + CORE/BROAD" : ""}`);
  if (broad) L("  ⚠ core/cross-cutting change → BROAD impact: run the full smoke/regression set");
  L("");
  L(`precise (by owned testid · ${owned.size} prefixes): ${precise.length} test(s)`);
  L("  " + (precise.map((t) => t.name).join(", ") || "— none reference these testids"));
  if (owned.size && precise.length === 0) L("  ⚠ instrumented but UNCOVERED → suggest authoring a test");
  L("");
  L(`area-level (${areasHit.size} area(s)): ${areaTests.length} test(s)`);
  L("  " + (areaTests.map((t) => t.name).join(", ") || "— none"));
  process.exit(0);
}

// ---------- AUDIT MODE: sweep ----------
const walk = (d) => fs.existsSync(d) ? fs.readdirSync(d, { recursive: true }).map((f) => path.join(d, f)) : [];
const routes = [...new Set(walk(path.join(ROOT, "src/app"))
  .filter((f) => /(^|\/)(page|route)\.tsx?$/.test(f))
  .map((f) => {
    const r = path.relative(path.join(ROOT, "src/app"), f).replace(/\\/g, "/").replace(/\/?(page|route)\.tsx?$/, "");
    return r === "" ? "/" : "/" + r;
  }))].sort();
const libMods = walk(path.join(ROOT, "src/lib")).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts")).map((f) => "src/lib/" + path.basename(f));
const comps = walk(path.join(ROOT, "src/components")).filter((f) => f.endsWith(".tsx")).map((f) => path.basename(f, ".tsx"));
const reStatic = /data-testid="([^"]+)"/g, reTmpl = /data-testid=\{`([^`$]*)/g;
const allTids = new Set();
for (const f of walk(path.join(ROOT, "src")).filter((f) => /\.tsx?$/.test(f))) {
  const txt = fs.readFileSync(f, "utf8"); let m;
  while ((m = reStatic.exec(txt))) allTids.add(m[1]);
  while ((m = reTmpl.exec(txt))) if (m[1]) allTids.add(m[1]);
}
let msgs = [];
try { msgs = Object.keys(JSON.parse(fs.readFileSync(path.join(ROOT, "messages/en.json"), "utf8"))); } catch {}

// classification sets for the guard
const classRoutes = new Set([...routeToArea.keys(), ...(manifest.platform?.routes || [])]);
const classLib = set([...AREAS.flatMap((a) => manifest.areas[a].lib || []), ...(manifest.core?.lib || []), ...(manifest.excluded?.lib || [])]);
const classComp = set([...AREAS.flatMap((a) => manifest.areas[a].components || []), ...(manifest.core?.components || []), ...(manifest.excluded?.components || [])]);
const classMsg = set([...AREAS.flatMap((a) => manifest.areas[a].messages || []), ...(manifest.core?.messages || []), ...(manifest.excluded?.messages || [])]);

// ---------- GUARD ----------
const un = { routes: [], lib: [], components: [], messages: [], testids: [] };
for (const r of routes) if (!classRoutes.has(r)) un.routes.push(r);
for (const l of libMods) if (!classLib.has(l)) un.lib.push(l);
for (const c of comps) if (!classComp.has(c)) un.components.push(c);
for (const m of msgs) if (!classMsg.has(m)) un.messages.push(m);
for (const t of allTids) if (!tidClassified(t, maps)) un.testids.push(t);

// ---------- DERIVE + RECONCILE (add-only) ----------
const recon = []; const coverage = Object.fromEntries(AREAS.map((a) => [a, 0]));
for (const t of index) {
  const derived = deriveAreas(t, maps);
  const cur = set(t.area);
  const adds = [...derived].filter((a) => !cur.has(a)).sort();
  const review = [...cur].filter((a) => !derived.has(a)).sort();
  if (adds.length || review.length) recon.push({ name: t.name, adds, review });
  for (const a of t.area) if (a in coverage) coverage[a]++;
}

// ---------- REPORT ----------
L("══════════════ area-coverage-audit ══════════════");
L(`repo: ${ROOT}`);
L(`swept: ${routes.length} routes · ${libMods.length} lib · ${comps.length} components · ${msgs.length} msg-namespaces · ${allTids.size} testids · ${index.length} tests`);
L("\n── GUARD (every surface classified?) ──");
const totalUn = Object.values(un).reduce((n, a) => n + a.length, 0);
for (const [k, v] of Object.entries(un)) if (v.length) L(`  ⚠ unclassified ${k} (${v.length}): ${v.slice(0, 12).join(", ")}${v.length > 12 ? " …" : ""}`);
L(totalUn === 0 ? "  ✓ 100% classified — guard passes" : `  ✗ ${totalUn} unclassified — guard FAILS (new-area / manifest-gap candidates)`);
L("\n── COVERAGE by area ──");
for (const a of AREAS) L(`  ${coverage[a] > 0 ? "✓" : "✗ ZERO"}  area-${a.padEnd(12)} ${coverage[a]} test(s)`);
const zero = AREAS.filter((a) => coverage[a] === 0);
L(`  zero-coverage areas: ${zero.length ? zero.map((a) => "area-" + a).join(", ") : "none"}`);
L("\n── RECONCILE (add-only) ──");
if (!recon.length) L("  ✓ all current area-* labels match derivation");
for (const r of recon) {
  const parts = [];
  if (r.adds.length) parts.push(`ADD ${r.adds.map((a) => "area-" + a).join(",")}`);
  if (r.review.length) parts.push(`review(keep) ${r.review.map((a) => "area-" + a).join(",")}`);
  L(`  ${r.name.padEnd(24)} ${parts.join("  |  ")}`);
}
L("  (review = current label not testid-derivable — content-verified; kept, never auto-removed)");

if (GUARD && totalUn > 0) process.exit(1);
