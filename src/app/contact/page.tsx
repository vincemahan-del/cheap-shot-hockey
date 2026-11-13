"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CONTACT_TOPICS,
  validateContactInput,
  type ContactMessage,
  type ContactMessageInput,
  type ContactTopic,
} from "@/lib/contact";

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; ticketId: string }
  | { kind: "error"; message: string };

type FieldErrors = Partial<Record<keyof ContactMessageInput, string>>;

const TOPIC_LABELS: Record<ContactTopic, string> = {
  "order-question": "Order question",
  sizing: "Sizing",
  returns: "Returns",
  "team-orders": "Team orders",
  other: "Other",
};

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState<ContactTopic>("order-question");
  const [orderNumber, setOrderNumber] = useState("");
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [state, setState] = useState<SubmitState>({ kind: "idle" });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state.kind === "submitting") return;

    const payload: ContactMessageInput = {
      name,
      email,
      topic,
      orderNumber: orderNumber.trim() === "" ? undefined : orderNumber,
      message,
    };

    const clientErrors = validateContactInput(payload);
    if (clientErrors.length > 0) {
      setFieldErrors(
        Object.fromEntries(clientErrors.map((err) => [err.field, err.message])),
      );
      setState({ kind: "idle" });
      return;
    }
    setFieldErrors({});
    setState({ kind: "submitting" });

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const serverErrors = body?.details?.errors as
          | Array<{ field: keyof ContactMessageInput; message: string }>
          | undefined;
        if (res.status === 400 && Array.isArray(serverErrors)) {
          setFieldErrors(
            Object.fromEntries(serverErrors.map((err) => [err.field, err.message])),
          );
          setState({ kind: "idle" });
          return;
        }
        setState({
          kind: "error",
          message: body?.message ?? `Request failed (${res.status})`,
        });
        return;
      }
      const body = (await res.json()) as { message: ContactMessage };
      setState({ kind: "success", ticketId: body.message.id });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Network error",
      });
    }
  }

  if (state.kind === "success") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16" data-testid="contact-success">
        <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-8">
          <h1 className="font-display text-3xl font-black uppercase tracking-tight">
            Message received.
          </h1>
          <p className="mt-4 text-[color:var(--muted)]">
            Thanks for reaching out. Our support crew replies within one
            business day — keep your ticket ID handy if you follow up.
          </p>
          <div className="mt-6 rounded-md bg-[color:var(--surface-2)] px-4 py-3 text-sm">
            <span className="text-[color:var(--muted)]">Ticket:</span>{" "}
            <span className="font-mono font-bold" data-testid="contact-ticket-id">
              {state.ticketId}
            </span>
          </div>
          <button
            type="button"
            data-testid="contact-submit-another"
            onClick={() => {
              setName("");
              setEmail("");
              setTopic("order-question");
              setOrderNumber("");
              setMessage("");
              setFieldErrors({});
              setState({ kind: "idle" });
            }}
            className="mt-6 text-sm font-semibold text-[color:var(--primary)] hover:opacity-80"
          >
            Send another message →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12" data-testid="contact-page">
      <header className="mb-8">
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[color:var(--primary)]">
          Contact us
        </p>
        <h1 className="font-display text-4xl font-black uppercase tracking-tight">
          Drop the gloves, not the questions.
        </h1>
        <p className="mt-3 max-w-2xl text-[color:var(--muted)]">
          Order issues, sizing help, returns — send us a message and our
          pro-shop crew will get back to you within one business day.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <form
          onSubmit={onSubmit}
          noValidate
          data-testid="contact-form"
          className="space-y-5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6 lg:col-span-2"
        >
          <Field label="Your name" htmlFor="name" error={fieldErrors.name} errorTestId="contact-name-error">
            <input
              id="name"
              data-testid="contact-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Gordie Howe"
              aria-invalid={Boolean(fieldErrors.name)}
              className={inputClass(Boolean(fieldErrors.name))}
            />
          </Field>

          <Field label="Email" htmlFor="email" error={fieldErrors.email} errorTestId="contact-email-error">
            <input
              id="email"
              data-testid="contact-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@cheapshot.test"
              aria-invalid={Boolean(fieldErrors.email)}
              className={inputClass(Boolean(fieldErrors.email))}
            />
          </Field>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Topic" htmlFor="topic" error={fieldErrors.topic} errorTestId="contact-topic-error">
              <select
                id="topic"
                data-testid="contact-topic"
                value={topic}
                onChange={(e) => setTopic(e.target.value as ContactTopic)}
                className={inputClass(Boolean(fieldErrors.topic))}
              >
                {CONTACT_TOPICS.map((t) => (
                  <option key={t} value={t}>
                    {TOPIC_LABELS[t]}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label="Order number"
              htmlFor="orderNumber"
              optional
              error={fieldErrors.orderNumber}
              errorTestId="contact-order-number-error"
            >
              <input
                id="orderNumber"
                data-testid="contact-order-number"
                type="text"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                placeholder="e.g. o-abc123"
                aria-invalid={Boolean(fieldErrors.orderNumber)}
                className={inputClass(Boolean(fieldErrors.orderNumber))}
              />
            </Field>
          </div>

          <Field
            label="How can we help?"
            htmlFor="message"
            error={fieldErrors.message}
            errorTestId="contact-message-error"
          >
            <textarea
              id="message"
              data-testid="contact-message"
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              maxLength={2000}
              placeholder="Tell us what's going on — the more detail, the faster we can help."
              aria-invalid={Boolean(fieldErrors.message)}
              className={inputClass(Boolean(fieldErrors.message))}
            />
          </Field>

          {state.kind === "error" && (
            <p
              data-testid="contact-error"
              className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400"
            >
              {state.message}
            </p>
          )}

          <button
            type="submit"
            data-testid="contact-submit"
            disabled={state.kind === "submitting"}
            className="rounded-md bg-[color:var(--primary)] px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {state.kind === "submitting" ? "Sending…" : "Send message"}
          </button>
        </form>

        <aside className="space-y-5">
          <div
            data-testid="contact-support-hours"
            className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6"
          >
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-[color:var(--muted)]">
              Support hours
            </h2>
            <p className="text-sm">Mon–Fri, 9am–6pm ET</p>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              Email us anytime:
              <br />
              <a
                href="mailto:support@cheapshot.test"
                data-testid="contact-support-email"
                className="font-mono text-[color:var(--primary)] hover:opacity-80"
              >
                support@cheapshot.test
              </a>
            </p>
          </div>

          <div
            data-testid="contact-quick-links"
            className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6"
          >
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-[color:var(--muted)]">
              Quick answers
            </h2>
            <ul className="space-y-1.5 text-sm">
              <li>
                <Link
                  href="/shipping"
                  data-testid="contact-link-shipping"
                  className="hover:text-[color:var(--accent)]"
                >
                  Shipping &amp; returns →
                </Link>
              </li>
              <li>
                <Link
                  href="/size-guide"
                  data-testid="contact-link-size-guide"
                  className="hover:text-[color:var(--accent)]"
                >
                  Size guide →
                </Link>
              </li>
              <li>
                <Link
                  href="/team-orders"
                  data-testid="contact-link-team-orders"
                  className="hover:text-[color:var(--accent)]"
                >
                  Team &amp; league orders →
                </Link>
              </li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function inputClass(hasError: boolean): string {
  return [
    "w-full rounded-md border bg-[color:var(--background)] px-3 py-2 text-sm outline-none",
    hasError
      ? "border-red-500/60 focus:border-red-400"
      : "border-[color:var(--border)] focus:border-[color:var(--primary)]",
  ].join(" ");
}

function Field({
  label,
  htmlFor,
  optional,
  error,
  errorTestId,
  children,
}: {
  label: string;
  htmlFor: string;
  optional?: boolean;
  error?: string;
  errorTestId: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[color:var(--muted)]"
      >
        {label}{" "}
        {optional && <span className="font-normal normal-case opacity-60">(optional)</span>}
      </label>
      {children}
      {error && (
        <p data-testid={errorTestId} className="mt-1.5 text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
