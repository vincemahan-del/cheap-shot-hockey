import { NextResponse, type NextRequest } from "next/server";

const DEMO_HEADER = "x-demo-mode";
const DEMO_COOKIE = "csh_demo";
const SESSION_COOKIE = "csh_session";
const SESSION_HEADER = "x-csh-session";
const ALLOWED = new Set(["normal", "slow", "flaky", "broken"]);

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

  let sessionId = req.cookies.get(SESSION_COOKIE)?.value;
  const mintNewSession = !sessionId;
  if (!sessionId) sessionId = randomSessionId();

  const reqHeaders = new Headers(req.headers);
  reqHeaders.set(DEMO_HEADER, effective);
  reqHeaders.set(SESSION_HEADER, sessionId);

  const res = NextResponse.next({ request: { headers: reqHeaders } });

  if (queryMode && ALLOWED.has(queryMode)) {
    res.cookies.set(DEMO_COOKIE, queryMode, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60,
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
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
