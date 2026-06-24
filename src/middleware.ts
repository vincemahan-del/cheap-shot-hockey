import { NextResponse, type NextRequest } from "next/server";

const DEMO_HEADER = "x-demo-mode";
const DEMO_COOKIE = "csh_demo";
const SESSION_COOKIE = "csh_session";
const SESSION_HEADER = "x-csh-session";
const ALLOWED = new Set(["normal", "slow", "flaky", "broken"]);

// Region (TAMD-171). Same query→cookie→header shape as demo mode, with a
// geo-IP fallback. Precedence: ?region= override → csh_region cookie →
// Vercel's x-vercel-ip-country geo header (CA → Canada) → US default.
const REGION_HEADER = "x-csh-region";
const REGION_COOKIE = "csh_region";
const REGION_ALLOWED = new Set(["us", "ca"]);

function resolveRegion(req: NextRequest): { region: string; fromQuery: boolean } {
  const query = req.nextUrl.searchParams.get("region")?.toLowerCase();
  if (query && REGION_ALLOWED.has(query)) return { region: query, fromQuery: true };

  const cookie = req.cookies.get(REGION_COOKIE)?.value?.toLowerCase();
  if (cookie && REGION_ALLOWED.has(cookie)) return { region: cookie, fromQuery: false };

  // Vercel populates this at the edge from the visitor's IP. Absent locally.
  const country = req.headers.get("x-vercel-ip-country")?.toUpperCase();
  if (country === "CA") return { region: "ca", fromQuery: false };

  return { region: "us", fromQuery: false };
}

function randomSessionId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `s-${Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

export function middleware(req: NextRequest) {
  const queryMode = req.nextUrl.searchParams.get("demo");
  const cookieMode = req.cookies.get(DEMO_COOKIE)?.value;
  const effective =
    queryMode && ALLOWED.has(queryMode)
      ? queryMode
      : cookieMode && ALLOWED.has(cookieMode)
        ? cookieMode
        : "normal";

  const { region, fromQuery: regionFromQuery } = resolveRegion(req);

  let sessionId = req.cookies.get(SESSION_COOKIE)?.value;
  const mintNewSession = !sessionId;
  if (!sessionId) sessionId = randomSessionId();

  const reqHeaders = new Headers(req.headers);
  reqHeaders.set(DEMO_HEADER, effective);
  reqHeaders.set(SESSION_HEADER, sessionId);
  reqHeaders.set(REGION_HEADER, region);

  const res = NextResponse.next({ request: { headers: reqHeaders } });

  if (queryMode && ALLOWED.has(queryMode)) {
    res.cookies.set(DEMO_COOKIE, queryMode, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60,
    });
  }
  if (regionFromQuery) {
    res.cookies.set(REGION_COOKIE, region, {
      path: "/",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60,
    });
  }
  if (mintNewSession) {
    res.cookies.set(SESSION_COOKIE, sessionId, {
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      maxAge: 30 * 24 * 60 * 60,
    });
  }
  res.headers.set(DEMO_HEADER, effective);
  res.headers.set(REGION_HEADER, region);
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
