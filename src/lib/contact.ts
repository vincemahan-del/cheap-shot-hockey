import { isValidEmail } from "./email";

export type ContactTopic =
  | "order-question"
  | "sizing"
  | "returns"
  | "team-orders"
  | "other";

export const CONTACT_TOPICS: ReadonlyArray<ContactTopic> = [
  "order-question",
  "sizing",
  "returns",
  "team-orders",
  "other",
];

export interface ContactMessageInput {
  name: string;
  email: string;
  topic: string;
  orderNumber?: string;
  message: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  topic: ContactTopic;
  orderNumber: string | null;
  message: string;
  receivedAt: string;
}

export interface ValidationFailure {
  field: keyof ContactMessageInput;
  message: string;
}

const MIN_NAME = 2;
const MAX_NAME = 120;
const MAX_ORDER_NUMBER = 40;
const MIN_MESSAGE = 10;
const MAX_MESSAGE = 2000;

export function validateContactInput(raw: unknown): ValidationFailure[] {
  if (typeof raw !== "object" || raw === null) {
    return [{ field: "name", message: "payload must be a JSON object" }];
  }
  const r = raw as Record<string, unknown>;
  const errors: ValidationFailure[] = [];

  const name = typeof r.name === "string" ? r.name.trim() : "";
  if (name.length < MIN_NAME) {
    errors.push({ field: "name", message: `name must be at least ${MIN_NAME} characters` });
  } else if (name.length > MAX_NAME) {
    errors.push({ field: "name", message: `name must be ${MAX_NAME} characters or fewer` });
  }

  if (!isValidEmail(r.email)) {
    errors.push({ field: "email", message: "email must be a valid email address" });
  }

  if (typeof r.topic !== "string" || !CONTACT_TOPICS.includes(r.topic as ContactTopic)) {
    errors.push({
      field: "topic",
      message: `topic must be one of: ${CONTACT_TOPICS.join(", ")}`,
    });
  }

  if (r.orderNumber !== undefined) {
    if (typeof r.orderNumber !== "string") {
      errors.push({ field: "orderNumber", message: "orderNumber must be a string when provided" });
    } else if (r.orderNumber.trim().length > MAX_ORDER_NUMBER) {
      errors.push({
        field: "orderNumber",
        message: `orderNumber must be ${MAX_ORDER_NUMBER} characters or fewer`,
      });
    }
  }

  const message = typeof r.message === "string" ? r.message.trim() : "";
  if (typeof r.message !== "string") {
    errors.push({ field: "message", message: "message is required" });
  } else if (message.length < MIN_MESSAGE) {
    errors.push({ field: "message", message: `message must be at least ${MIN_MESSAGE} characters` });
  } else if (message.length > MAX_MESSAGE) {
    errors.push({ field: "message", message: `message must be ${MAX_MESSAGE} characters or fewer` });
  }

  return errors;
}

export function generateContactMessageId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.floor(Math.random() * 36 ** 4)
    .toString(36)
    .padStart(4, "0");
  return `CSH-MSG-${ts}${rand}`;
}

export function buildContactMessage(input: ContactMessageInput): ContactMessage {
  const orderNumber =
    typeof input.orderNumber === "string" && input.orderNumber.trim().length > 0
      ? input.orderNumber.trim()
      : null;
  return {
    id: generateContactMessageId(),
    name: input.name.trim(),
    email: input.email.trim().toLowerCase(),
    topic: input.topic as ContactTopic,
    orderNumber,
    message: input.message.trim(),
    receivedAt: new Date().toISOString(),
  };
}

// In memory, like team-orders: resets on serverless cold start.
const messages = new Map<string, ContactMessage>();

export function createContactMessage(input: ContactMessageInput): ContactMessage {
  const msg = buildContactMessage(input);
  messages.set(msg.id, msg);
  return msg;
}

export function getContactMessage(id: string): ContactMessage | undefined {
  return messages.get(id);
}
