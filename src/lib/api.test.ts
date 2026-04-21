import { describe, it, expect } from "vitest";
import {
  ok,
  created,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  serverError,
  serviceUnavailable,
} from "./api";

describe("api response helpers", () => {
  it("ok returns 200 + JSON body", async () => {
    const r = ok({ a: 1 });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ a: 1 });
  });

  it("created returns 201", async () => {
    const r = created({ id: "x" });
    expect(r.status).toBe(201);
  });

  it.each([
    ["badRequest", badRequest, 400],
    ["unauthorized", unauthorized, 401],
    ["forbidden", forbidden, 403],
    ["notFound", notFound, 404],
    ["serverError", serverError, 500],
    ["serviceUnavailable", serviceUnavailable, 503],
  ])("%s returns %i", async (_name, fn, code) => {
    const r = fn("boom");
    expect(r.status).toBe(code);
    const body = await r.json();
    expect(body.message).toBe("boom");
    expect(body.error).toBeTruthy();
  });

  it("error helpers accept optional details", async () => {
    const r = badRequest("bad", { field: "email" });
    const body = await r.json();
    expect(body.details).toEqual({ field: "email" });
  });
});
