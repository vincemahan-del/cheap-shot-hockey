// Pure, deterministic core of the area-coverage engine. No IO — unit-testable.
// Imported by audit.mjs (the CLI) and audit.test.mjs (the tests).

export function buildMaps(manifest) {
  const AREAS = Object.keys(manifest.areas);
  const prefixRules = [];      // {prefix, area}  — area-only (drives derivation/labels)
  const routeToArea = new Map();
  for (const a of AREAS) {
    for (const p of manifest.areas[a].testid_prefix || []) prefixRules.push({ prefix: p, area: a });
    for (const r of manifest.areas[a].routes || []) routeToArea.set(r, a);
  }
  // longest-prefix-first so specific beats generic (nav-categories > nav-cat- ; account-admin-link > account-)
  prefixRules.sort((x, y) => y.prefix.length - x.prefix.length);
  // guard accepts testids classified to ANY bucket (area + core + excluded)
  const guardPrefixes = [
    ...prefixRules.map((r) => r.prefix),
    ...(manifest.core?.testid_prefix || []),
    ...(manifest.excluded?.testid_prefix || []),
  ].sort((a, b) => b.length - a.length);
  return { AREAS, prefixRules, routeToArea, guardPrefixes };
}

// area for a testid (areas-only; null if unmatched). Longest-prefix wins via sorted rules.
export const areaOfTestid = (t, maps) =>
  maps.prefixRules.find((r) => t === r.prefix || t.startsWith(r.prefix))?.area || null;

// is a testid claimed by ANY bucket (for the completeness guard)
export const tidClassified = (t, maps) =>
  maps.guardPrefixes.some((p) => t === p || t.startsWith(p));

// normalize a concrete route to its manifest pattern (/products/foo -> /products/[slug])
export function normRoute(r) {
  const p = r.split("?")[0];
  const s = p.split("/").filter(Boolean);
  if (!s.length) return "/";
  if (s[0] === "products" && s.length === 2) return "/products/[slug]";
  if (s[0] === "orders" && s.length === 2) return "/orders/[id]";
  if (s[0] === "deployments" && s.length === 2) return "/deployments/[label]";
  if (s[0] === "api") {
    if (s[1] === "orders" && s.length === 3) return "/api/orders/[id]";
    if (s[1] === "orders" && s.length === 4 && s[3] === "receipt") return "/api/orders/[id]/receipt";
    if (s[1] === "products" && s.length === 3) return "/api/products/[id]";
    if (s[1] === "deployments" && s.length === 3 && s[2] !== "search") return "/api/deployments/[label]";
  }
  return "/" + s.join("/");
}

// derive the areas a test VERIFIES. Rule (verifies, not transit):
//   - testids -> their areas (testids sit on asserted/interacted elements)
//   - any route with ?region= / ?lang= -> i18n (behavioral, verified by assertion content)
//   - if the test has NO testids at all -> fall back to its routes' base areas
// When testids exist, base-route areas are NOT added (a transited /products doesn't earn catalog).
export function deriveAreas(test, maps) {
  const d = new Set();
  for (const tid of test.testids || []) {
    const a = areaOfTestid(tid, maps);
    if (a) d.add(a);
  }
  for (const r of test.routes || []) if (/[?&](region|lang)=/.test(r)) d.add("i18n");
  if ((test.testids || []).length === 0) {
    for (const r of test.routes || []) {
      const a = maps.routeToArea.get(normRoute(r));
      if (a) d.add(a);
    }
  }
  return d;
}

// Resolve the impact file list from CLI args OR stdin. `impact -` (or no args)
// reads newline-delimited paths from stdin — robust to bracket route paths
// ([slug]/[id]) and spaces that shell globbing/word-splitting would mangle.
// Trims, drops blanks, dedupes.
export function resolveFiles(args, stdin = "") {
  const useStdin = args.length === 0 || (args.length === 1 && args[0] === "-");
  const list = useStdin ? stdin.split(/\r?\n/) : args;
  return [...new Set(list.map((s) => s.trim()).filter(Boolean))];
}
