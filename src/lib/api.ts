import { NextResponse } from "next/server";

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

export function created<T>(data: T): NextResponse {
  return NextResponse.json(data, { status: 201 });
}

export function badRequest(message: string, details?: unknown): NextResponse {
  return NextResponse.json({ error: "bad_request", message, details }, { status: 400 });
}

export function unauthorized(message = "authentication required"): NextResponse {
  return NextResponse.json({ error: "unauthorized", message }, { status: 401 });
}

export function forbidden(message = "forbidden"): NextResponse {
  return NextResponse.json({ error: "forbidden", message }, { status: 403 });
}

export function notFound(message = "not found"): NextResponse {
  return NextResponse.json({ error: "not_found", message }, { status: 404 });
}

export function serverError(message = "internal error"): NextResponse {
  return NextResponse.json({ error: "server_error", message }, { status: 500 });
}

export function serviceUnavailable(message = "demo mode: simulated failure"): NextResponse {
  return NextResponse.json({ error: "service_unavailable", message }, { status: 503 });
}
