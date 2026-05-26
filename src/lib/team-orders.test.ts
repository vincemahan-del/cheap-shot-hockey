import { describe, it, expect, beforeEach } from "vitest";
import {
  validateTeamOrderInput,
  createTeamOrderQuote,
  getTeamOrderQuote,
  _resetQuotesForTesting,
  SUPPORTED_SPORTS,
  type TeamOrderQuoteInput,
} from "./team-orders";

const validInput: TeamOrderQuoteInput = {
  orgName: "Eagles Hockey Club",
  contactEmail: "coach@eagles.test",
  sport: "hockey",
  estPlayers: 18,
  message: "Prepping for the Summer Cup tournament",
};

beforeEach(() => _resetQuotesForTesting());

describe("validateTeamOrderInput", () => {
  it("returns no errors for a complete valid payload", () => {
    expect(validateTeamOrderInput(validInput)).toEqual([]);
  });

  it("returns no errors when optional message is omitted", () => {
    const withoutMessage: TeamOrderQuoteInput = {
      orgName: validInput.orgName,
      contactEmail: validInput.contactEmail,
      sport: validInput.sport,
      estPlayers: validInput.estPlayers,
    };
    expect(validateTeamOrderInput(withoutMessage)).toEqual([]);
  });

  it("flags non-object payloads", () => {
    expect(validateTeamOrderInput("nope")).toHaveLength(1);
    expect(validateTeamOrderInput(null)).toHaveLength(1);
    expect(validateTeamOrderInput(42)).toHaveLength(1);
  });

  it("flags missing orgName", () => {
    const errors = validateTeamOrderInput({ ...validInput, orgName: undefined });
    expect(errors.some((e) => e.field === "orgName")).toBe(true);
  });

  it("flags an orgName shorter than 2 characters (after trim)", () => {
    const errors = validateTeamOrderInput({ ...validInput, orgName: "  A  " });
    expect(errors.some((e) => e.field === "orgName")).toBe(true);
  });

  it("flags an orgName longer than 200 characters", () => {
    const errors = validateTeamOrderInput({ ...validInput, orgName: "A".repeat(201) });
    expect(errors.some((e) => e.field === "orgName")).toBe(true);
  });

  it("flags a missing or malformed contactEmail", () => {
    expect(
      validateTeamOrderInput({ ...validInput, contactEmail: undefined })
        .some((e) => e.field === "contactEmail"),
    ).toBe(true);
    expect(
      validateTeamOrderInput({ ...validInput, contactEmail: "not-an-email" })
        .some((e) => e.field === "contactEmail"),
    ).toBe(true);
  });

  it("accepts multi-label domains", () => {
    expect(
      validateTeamOrderInput({ ...validInput, contactEmail: "coach@team.sub.example.test" }),
    ).toEqual([]);
  });

  it("rejects an over-length email (RFC 5321 254 cap)", () => {
    const tooLong = `${"a".repeat(250)}@example.test`;
    expect(
      validateTeamOrderInput({ ...validInput, contactEmail: tooLong })
        .some((e) => e.field === "contactEmail"),
    ).toBe(true);
  });

  it("rejects a ReDoS-style payload in linear time (TAMD-138 guard)", () => {
    // The old /^[^\s@]+@[^\s@]+\.[^\s@]+$/ regex backtracked catastrophically
    // on a long no-dot domain. Assert this is both rejected AND fast.
    const malicious = `a@${"a".repeat(50000)}`;
    const start = performance.now();
    const errors = validateTeamOrderInput({ ...validInput, contactEmail: malicious });
    const elapsedMs = performance.now() - start;
    expect(errors.some((e) => e.field === "contactEmail")).toBe(true);
    expect(elapsedMs).toBeLessThan(50);
  });

  it("flags an unknown sport", () => {
    const errors = validateTeamOrderInput({ ...validInput, sport: "underwater-basketweaving" });
    expect(errors.some((e) => e.field === "sport")).toBe(true);
  });

  it("flags a missing sport", () => {
    const errors = validateTeamOrderInput({ ...validInput, sport: undefined });
    expect(errors.some((e) => e.field === "sport")).toBe(true);
  });

  it("flags estPlayers that isn't a positive integer in range", () => {
    expect(
      validateTeamOrderInput({ ...validInput, estPlayers: 0 })
        .some((e) => e.field === "estPlayers"),
    ).toBe(true);
    expect(
      validateTeamOrderInput({ ...validInput, estPlayers: 501 })
        .some((e) => e.field === "estPlayers"),
    ).toBe(true);
    expect(
      validateTeamOrderInput({ ...validInput, estPlayers: 1.5 })
        .some((e) => e.field === "estPlayers"),
    ).toBe(true);
    expect(
      validateTeamOrderInput({ ...validInput, estPlayers: "eighteen" })
        .some((e) => e.field === "estPlayers"),
    ).toBe(true);
  });

  it("flags a message that isn't a string", () => {
    const errors = validateTeamOrderInput({ ...validInput, message: 123 });
    expect(errors.some((e) => e.field === "message")).toBe(true);
  });

  it("flags a message longer than 2000 characters", () => {
    const errors = validateTeamOrderInput({ ...validInput, message: "A".repeat(2001) });
    expect(errors.some((e) => e.field === "message")).toBe(true);
  });

  it("accumulates multiple errors at once", () => {
    const errors = validateTeamOrderInput({
      orgName: "",
      contactEmail: "bad",
      sport: "curling",
      estPlayers: -3,
    });
    const fields = errors.map((e) => e.field);
    expect(fields).toEqual(expect.arrayContaining(["orgName", "contactEmail", "sport", "estPlayers"]));
  });
});

describe("createTeamOrderQuote", () => {
  it("assigns a unique ID per call with the TQ- prefix", () => {
    const q1 = createTeamOrderQuote(validInput);
    const q2 = createTeamOrderQuote(validInput);
    expect(q1.id).not.toBe(q2.id);
    expect(q1.id).toMatch(/^TQ-[0-9a-f]{6}-\d+$/);
    expect(q2.id).toMatch(/^TQ-[0-9a-f]{6}-\d+$/);
  });

  it("trims org name and lowercases email on store", () => {
    const q = createTeamOrderQuote({
      orgName: "  Eagles HC  ",
      contactEmail: "  COACH@Eagles.TEST  ",
      sport: "hockey",
      estPlayers: 18,
    });
    expect(q.orgName).toBe("Eagles HC");
    expect(q.contactEmail).toBe("coach@eagles.test");
  });

  it("defaults missing message to empty string", () => {
    const q = createTeamOrderQuote({
      orgName: "Eagles HC",
      contactEmail: "coach@eagles.test",
      sport: "hockey",
      estPlayers: 18,
    });
    expect(q.message).toBe("");
  });

  it("trims the provided message", () => {
    const q = createTeamOrderQuote({ ...validInput, message: "  trim me  " });
    expect(q.message).toBe("trim me");
  });

  it("stamps an ISO-8601 receivedAt", () => {
    const q = createTeamOrderQuote(validInput);
    expect(q.receivedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

describe("getTeamOrderQuote", () => {
  it("retrieves a stored quote by id", () => {
    const q = createTeamOrderQuote(validInput);
    expect(getTeamOrderQuote(q.id)).toEqual(q);
  });

  it("returns undefined for an unknown id", () => {
    expect(getTeamOrderQuote("TQ-nope-0")).toBeUndefined();
  });
});

describe("SUPPORTED_SPORTS", () => {
  it("includes the canonical sport keys", () => {
    expect(SUPPORTED_SPORTS).toContain("hockey");
    expect(SUPPORTED_SPORTS).toContain("lacrosse");
    expect(SUPPORTED_SPORTS).toContain("field-hockey");
    expect(SUPPORTED_SPORTS).toContain("other");
  });
});
