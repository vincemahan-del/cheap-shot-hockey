"use client";

import { useState } from "react";
import { SUPPORTED_SPORTS, type Sport } from "@/lib/team-orders";

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; quoteId: string }
  | { kind: "error"; message: string };

const SPORT_LABELS: Record<Sport, string> = {
  hockey: "Hockey",
  lacrosse: "Lacrosse",
  "field-hockey": "Field hockey",
  other: "Other",
};

export default function TeamOrdersPage() {
  const [orgName, setOrgName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [sport, setSport] = useState<Sport>("hockey");
  const [estPlayers, setEstPlayers] = useState<number | "">("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<SubmitState>({ kind: "idle" });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state.kind === "submitting") return;
    setState({ kind: "submitting" });

    try {
      const res = await fetch("/api/team-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgName,
          contactEmail,
          sport,
          estPlayers: typeof estPlayers === "number" ? estPlayers : -1,
          message: message || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setState({
          kind: "error",
          message: body?.message ?? `Request failed (${res.status})`,
        });
        return;
      }
      const body = (await res.json()) as { quote: { id: string } };
      setState({ kind: "success", quoteId: body.quote.id });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Network error",
      });
    }
  }

  if (state.kind === "success") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16" data-testid="team-orders-success">
        <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-8">
          <h1 className="font-display text-3xl font-black uppercase tracking-tight">
            Got it. We&apos;ll be in touch.
          </h1>
          <p className="mt-4 text-[color:var(--muted)]">
            Your team-orders inquiry is in. Our pro-shop crew typically replies
            within one business day with a custom quote.
          </p>
          <div className="mt-6 rounded-md bg-[color:var(--surface-2)] px-4 py-3 text-sm">
            <span className="text-[color:var(--muted)]">Reference:</span>{" "}
            <span className="font-mono font-bold" data-testid="team-orders-quote-id">
              {state.quoteId}
            </span>
          </div>
          <button
            type="button"
            data-testid="team-orders-submit-another"
            onClick={() => {
              setOrgName("");
              setContactEmail("");
              setSport("hockey");
              setEstPlayers("");
              setMessage("");
              setState({ kind: "idle" });
            }}
            className="mt-6 text-sm font-semibold text-[color:var(--primary)] hover:opacity-80"
          >
            Submit another inquiry →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-12" data-testid="team-orders-page">
      <header className="mb-8">
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[color:var(--primary)]">
          Team &amp; League Orders
        </p>
        <h1 className="font-display text-4xl font-black uppercase tracking-tight">
          Gear up the whole bench.
        </h1>
        <p className="mt-3 max-w-2xl text-[color:var(--muted)]">
          Outfitting a hockey, lacrosse, or field-hockey program? We do bulk
          pricing, custom jerseys, and 24-hour ship on stocked items. Tell us
          what you need and we&apos;ll send back a quote.
        </p>
      </header>

      <form
        onSubmit={onSubmit}
        data-testid="team-orders-form"
        className="space-y-5 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6"
      >
        <Field label="Organization / Club name" htmlFor="orgName">
          <input
            id="orgName"
            data-testid="team-orders-org-name"
            type="text"
            required
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="e.g. Eagles Hockey Club"
            className={inputClass}
          />
        </Field>

        <Field label="Contact email" htmlFor="contactEmail">
          <input
            id="contactEmail"
            data-testid="team-orders-contact-email"
            type="email"
            required
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="coach@yourclub.test"
            className={inputClass}
          />
        </Field>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Sport" htmlFor="sport">
            <select
              id="sport"
              data-testid="team-orders-sport"
              value={sport}
              onChange={(e) => setSport(e.target.value as Sport)}
              className={inputClass}
            >
              {SUPPORTED_SPORTS.map((s) => (
                <option key={s} value={s}>
                  {SPORT_LABELS[s]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Approx. players" htmlFor="estPlayers">
            <input
              id="estPlayers"
              data-testid="team-orders-est-players"
              type="number"
              required
              min={1}
              max={500}
              value={estPlayers}
              onChange={(e) => {
                const v = e.target.value;
                setEstPlayers(v === "" ? "" : Number.parseInt(v, 10));
              }}
              placeholder="e.g. 18"
              className={inputClass}
            />
          </Field>
        </div>

        <Field label="Anything else?" htmlFor="message" optional>
          <textarea
            id="message"
            data-testid="team-orders-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Tell us about your timeline, brand preferences, or special requests."
            className={inputClass}
          />
        </Field>

        {state.kind === "error" && (
          <p
            data-testid="team-orders-error"
            className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-400"
          >
            {state.message}
          </p>
        )}

        <button
          type="submit"
          data-testid="team-orders-submit"
          disabled={state.kind === "submitting"}
          className="rounded-md bg-[color:var(--primary)] px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-white transition hover:opacity-90 disabled:opacity-50"
        >
          {state.kind === "submitting" ? "Sending…" : "Request a quote"}
        </button>
      </form>
    </div>
  );
}

const inputClass =
  "w-full rounded-md border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm outline-none focus:border-[color:var(--primary)]";

function Field({
  label,
  htmlFor,
  optional,
  children,
}: {
  label: string;
  htmlFor: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-[color:var(--muted)]">
        {label}{" "}
        {optional && <span className="font-normal normal-case opacity-60">(optional)</span>}
      </label>
      {children}
    </div>
  );
}
