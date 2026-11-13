import { describe, it, expect } from "vitest";
import {
  validateContactInput,
  buildContactMessage,
  generateContactMessageId,
  createContactMessage,
  getContactMessage,
  CONTACT_TOPICS,
  type ContactMessageInput,
} from "./contact";

const validInput: ContactMessageInput = {
  name: "Gordie Howe",
  email: "gordie@redwings.test",
  topic: "order-question",
  orderNumber: "o-abc123",
  message: "My skates arrived in two different sizes — what do I do?",
};

describe("validateContactInput", () => {
  it("returns no errors for a complete valid payload", () => {
    expect(validateContactInput(validInput)).toEqual([]);
  });

  it("returns no errors when optional orderNumber is omitted", () => {
    const withoutOrderNumber: ContactMessageInput = {
      name: validInput.name,
      email: validInput.email,
      topic: validInput.topic,
      message: validInput.message,
    };
    expect(validateContactInput(withoutOrderNumber)).toEqual([]);
  });

  it("flags non-object payloads", () => {
    expect(validateContactInput("nope")).toHaveLength(1);
    expect(validateContactInput(null)).toHaveLength(1);
    expect(validateContactInput(42)).toHaveLength(1);
  });

  it("flags a missing name", () => {
    const errors = validateContactInput({ ...validInput, name: undefined });
    expect(errors.some((e) => e.field === "name")).toBe(true);
  });

  it("flags a name shorter than 2 characters (after trim)", () => {
    const errors = validateContactInput({ ...validInput, name: "  A  " });
    expect(errors.some((e) => e.field === "name")).toBe(true);
  });

  it("flags a name longer than 120 characters", () => {
    const errors = validateContactInput({ ...validInput, name: "A".repeat(121) });
    expect(errors.some((e) => e.field === "name")).toBe(true);
  });

  it("flags a missing or malformed email", () => {
    expect(
      validateContactInput({ ...validInput, email: undefined })
        .some((e) => e.field === "email"),
    ).toBe(true);
    expect(
      validateContactInput({ ...validInput, email: "not-an-email" })
        .some((e) => e.field === "email"),
    ).toBe(true);
  });

  it("rejects a ReDoS-style email payload in linear time (TAMD-138 guard)", () => {
    const malicious = `a@${"a".repeat(50000)}`;
    const start = performance.now();
    const errors = validateContactInput({ ...validInput, email: malicious });
    const elapsedMs = performance.now() - start;
    expect(errors.some((e) => e.field === "email")).toBe(true);
    expect(elapsedMs).toBeLessThan(50);
  });

  it("flags an unknown topic", () => {
    const errors = validateContactInput({ ...validInput, topic: "zamboni-rental" });
    expect(errors.some((e) => e.field === "topic")).toBe(true);
  });

  it("flags a missing topic", () => {
    const errors = validateContactInput({ ...validInput, topic: undefined });
    expect(errors.some((e) => e.field === "topic")).toBe(true);
  });

  it("flags an orderNumber that isn't a string", () => {
    const errors = validateContactInput({ ...validInput, orderNumber: 12345 });
    expect(errors.some((e) => e.field === "orderNumber")).toBe(true);
  });

  it("flags an orderNumber longer than 40 characters", () => {
    const errors = validateContactInput({ ...validInput, orderNumber: "x".repeat(41) });
    expect(errors.some((e) => e.field === "orderNumber")).toBe(true);
  });

  it("flags a missing message", () => {
    const errors = validateContactInput({ ...validInput, message: undefined });
    expect(errors.some((e) => e.field === "message")).toBe(true);
  });

  it("flags a message shorter than 10 characters (after trim)", () => {
    const errors = validateContactInput({ ...validInput, message: "  help  " });
    expect(errors.some((e) => e.field === "message")).toBe(true);
  });

  it("flags a message longer than 2000 characters", () => {
    const errors = validateContactInput({ ...validInput, message: "A".repeat(2001) });
    expect(errors.some((e) => e.field === "message")).toBe(true);
  });

  it("accumulates multiple errors at once", () => {
    const errors = validateContactInput({
      name: "",
      email: "bad",
      topic: "curling",
      orderNumber: 7,
      message: "short",
    });
    const fields = errors.map((e) => e.field);
    expect(fields).toEqual(
      expect.arrayContaining(["name", "email", "topic", "orderNumber", "message"]),
    );
  });
});

describe("generateContactMessageId", () => {
  it("produces CSH-MSG-<base36> ids", () => {
    expect(generateContactMessageId()).toMatch(/^CSH-MSG-[0-9a-z]+$/);
  });

  it("produces unique ids across calls", () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateContactMessageId()));
    expect(ids.size).toBe(50);
  });
});

describe("buildContactMessage", () => {
  it("stamps a CSH-MSG id and an ISO-8601 receivedAt", () => {
    const m = buildContactMessage(validInput);
    expect(m.id).toMatch(/^CSH-MSG-[0-9a-z]+$/);
    expect(m.receivedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it("trims name and message and lowercases email", () => {
    const m = buildContactMessage({
      ...validInput,
      name: "  Gordie Howe  ",
      email: "  GORDIE@RedWings.TEST  ",
      message: "  trim me — but keep at least ten chars  ",
    });
    expect(m.name).toBe("Gordie Howe");
    expect(m.email).toBe("gordie@redwings.test");
    expect(m.message).toBe("trim me — but keep at least ten chars");
  });

  it("normalizes a missing or blank orderNumber to null", () => {
    const withoutOrderNumber: ContactMessageInput = {
      name: validInput.name,
      email: validInput.email,
      topic: validInput.topic,
      message: validInput.message,
    };
    expect(buildContactMessage(withoutOrderNumber).orderNumber).toBeNull();
    expect(buildContactMessage({ ...validInput, orderNumber: "   " }).orderNumber).toBeNull();
  });

  it("trims a provided orderNumber", () => {
    const m = buildContactMessage({ ...validInput, orderNumber: "  o-abc123  " });
    expect(m.orderNumber).toBe("o-abc123");
  });
});

describe("CONTACT_TOPICS", () => {
  it("includes the canonical topic keys", () => {
    expect(CONTACT_TOPICS).toContain("order-question");
    expect(CONTACT_TOPICS).toContain("sizing");
    expect(CONTACT_TOPICS).toContain("returns");
    expect(CONTACT_TOPICS).toContain("team-orders");
    expect(CONTACT_TOPICS).toContain("other");
  });
});

describe("createContactMessage", () => {
  it("stores the normalized message so it can be read back by id", () => {
    const msg = createContactMessage(validInput);
    expect(msg.email).toBe("gordie@redwings.test");
    expect(getContactMessage(msg.id)).toEqual(msg);
  });

  it("returns undefined for an unknown id", () => {
    expect(getContactMessage("CSH-MSG-missing")).toBeUndefined();
  });
});
