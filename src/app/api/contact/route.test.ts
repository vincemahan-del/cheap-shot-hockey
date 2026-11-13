import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { getContactMessage } from "@/lib/contact";

function post(body: string): Promise<Response> {
  return POST(
    new NextRequest("http://localhost/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    }),
  );
}

const valid = {
  name: "  Gordie Howe ",
  email: "Gordie@RedWings.test",
  topic: "returns",
  message: "My skates arrived in two different sizes.",
};

describe("POST /api/contact", () => {
  it("returns 201 with the stored, normalized message", async () => {
    const res = await post(JSON.stringify(valid));
    expect(res.status).toBe(201);

    const { message } = await res.json();
    expect(message.id).toMatch(/^CSH-MSG-[0-9a-z]+$/);
    expect(message.name).toBe("Gordie Howe");
    expect(message.email).toBe("gordie@redwings.test");
    expect(message.orderNumber).toBeNull();
    expect(getContactMessage(message.id)).toEqual(message);
  });

  it("returns 400 with per-field errors the form can show", async () => {
    const res = await post(JSON.stringify({ ...valid, email: "nope", message: "short" }));
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.message).toBe("validation failed");
    const fields = body.details.errors.map((e: { field: string }) => e.field);
    expect(fields).toEqual(expect.arrayContaining(["email", "message"]));
  });

  it("returns 400 for a body that is not JSON", async () => {
    const res = await post("not json");
    expect(res.status).toBe(400);
    expect((await res.json()).message).toBe("invalid JSON body");
  });
});
