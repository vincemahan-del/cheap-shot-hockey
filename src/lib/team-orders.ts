// Team order quote requests — accept inquiries from clubs/leagues, return a
// quote ID, store in-memory for the demo (matches the rest of the app's
// ephemeral data layer; no persistence required for a one-screen demo flow).

export type Sport = "hockey" | "lacrosse" | "field-hockey" | "other";

export const SUPPORTED_SPORTS: ReadonlyArray<Sport> = [
  "hockey",
  "lacrosse",
  "field-hockey",
  "other",
];

export interface TeamOrderQuoteInput {
  orgName: string;
  contactEmail: string;
  sport: string;
  estPlayers: number;
  message?: string;
}

export interface TeamOrderQuote {
  id: string;
  orgName: string;
  contactEmail: string;
  sport: Sport;
  estPlayers: number;
  message: string;
  receivedAt: string;
}

export interface ValidationFailure {
  field: keyof TeamOrderQuoteInput;
  message: string;
}

// ReDoS-safe email check. The domain labels use a dot-excluding class
// (`[^\s@.]`) so the literal `.` separators are unambiguous — no two
// adjacent unbounded quantifiers can straddle the same character, which
// is what made the previous /^[^\s@]+@[^\s@]+\.[^\s@]+$/ polynomial
// (CodeQL js/polynomial-redos, TAMD-138). Paired with MAX_EMAIL below,
// which bounds the input before the regex ever runs.
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;
const MAX_EMAIL = 254; // RFC 5321 max total length
const MAX_ORG_NAME = 200;
const MAX_MESSAGE = 2000;
const MIN_PLAYERS = 1;
const MAX_PLAYERS = 500;

export function validateTeamOrderInput(raw: unknown): ValidationFailure[] {
  if (typeof raw !== "object" || raw === null) {
    return [{ field: "orgName", message: "payload must be a JSON object" }];
  }
  const r = raw as Record<string, unknown>;
  const errors: ValidationFailure[] = [];

  const orgName = typeof r.orgName === "string" ? r.orgName.trim() : "";
  if (orgName.length < 2) {
    errors.push({ field: "orgName", message: "orgName must be at least 2 characters" });
  } else if (orgName.length > MAX_ORG_NAME) {
    errors.push({ field: "orgName", message: `orgName must be ${MAX_ORG_NAME} characters or fewer` });
  }

  const email = typeof r.contactEmail === "string" ? r.contactEmail.trim() : "";
  // Length-cap first: bounds the input before the regex runs, so even a
  // pathological string can't drive backtracking (defense-in-depth).
  if (email.length === 0 || email.length > MAX_EMAIL || !EMAIL_RE.test(email)) {
    errors.push({ field: "contactEmail", message: "contactEmail must be a valid email address" });
  }

  if (typeof r.sport !== "string" || !SUPPORTED_SPORTS.includes(r.sport as Sport)) {
    errors.push({
      field: "sport",
      message: `sport must be one of: ${SUPPORTED_SPORTS.join(", ")}`,
    });
  }

  if (
    typeof r.estPlayers !== "number" ||
    !Number.isInteger(r.estPlayers) ||
    r.estPlayers < MIN_PLAYERS ||
    r.estPlayers > MAX_PLAYERS
  ) {
    errors.push({
      field: "estPlayers",
      message: `estPlayers must be an integer between ${MIN_PLAYERS} and ${MAX_PLAYERS}`,
    });
  }

  if (r.message !== undefined) {
    if (typeof r.message !== "string") {
      errors.push({ field: "message", message: "message must be a string when provided" });
    } else if (r.message.length > MAX_MESSAGE) {
      errors.push({ field: "message", message: `message must be ${MAX_MESSAGE} characters or fewer` });
    }
  }

  return errors;
}

// In-memory store. Like cart/orders this resets on serverless cold-start,
// which is the same demo trade-off documented in CLAUDE.md.
const quotes = new Map<string, TeamOrderQuote>();
let counter = 0;

function generateQuoteId(): string {
  counter += 1;
  const r = Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0");
  return `TQ-${r}-${counter}`;
}

export function createTeamOrderQuote(input: TeamOrderQuoteInput): TeamOrderQuote {
  const quote: TeamOrderQuote = {
    id: generateQuoteId(),
    orgName: input.orgName.trim(),
    contactEmail: input.contactEmail.trim().toLowerCase(),
    sport: input.sport as Sport,
    estPlayers: input.estPlayers,
    message: typeof input.message === "string" ? input.message.trim() : "",
    receivedAt: new Date().toISOString(),
  };
  quotes.set(quote.id, quote);
  return quote;
}

export function getTeamOrderQuote(id: string): TeamOrderQuote | undefined {
  return quotes.get(id);
}

// Test helper. Not used in production code paths.
export function _resetQuotesForTesting(): void {
  quotes.clear();
  counter = 0;
}
