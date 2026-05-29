import Link from "next/link";
import { decodeLabel } from "@/lib/deployments";

// The convergence step. BOTH a successful and a failed deployment reach this
// screen — mirroring the customer's flow where success or failure are both
// acceptable outcomes ("both are pass cases") and the test proceeds to the
// next action regardless. The deployment outcome is shown for context, but
// arriving here is the assertion that matters.
export default async function DeploymentNextStepPage({
  params,
}: {
  params: Promise<{ label: string }>;
}) {
  const { label } = await params;
  const decoded = decodeLabel(label);
  // The recorded outcome is encoded in the label itself — by the time the
  // flow reaches this convergence step the deployment is already terminal.
  const outcome = decoded
    ? decoded.outcome === "fail"
      ? "failure"
      : "successful"
    : "unknown";

  const OUTCOME_LABEL: Record<string, string> = {
    successful: "Successful",
    failure: "Failure",
    unknown: "Unknown",
  };

  return (
    <div className="mx-auto max-w-xl px-4 py-12" data-testid="deployment-next-page">
      <header className="mb-8">
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[color:var(--primary)]">
          Catalog Deployments
        </p>
        <h1 className="font-display text-3xl font-black uppercase tracking-tight">
          Next step
        </h1>
        <p className="mt-3 text-[color:var(--muted)]">
          The deployment finished processing. Whether it succeeded or failed, the
          workflow continues from here.
        </p>
      </header>

      <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] p-6">
        <p
          data-testid="deployment-next-confirm"
          className="text-base font-semibold"
        >
          Deployment processed — proceeding to the next step.
        </p>

        <dl className="mt-5 grid grid-cols-2 gap-2 text-xs text-[color:var(--muted)]">
          <dt>Deployment label</dt>
          <dd className="text-right font-mono" data-testid="deployment-next-label">
            {label}
          </dd>
          <dt>Recorded outcome</dt>
          <dd className="text-right">
            <span data-testid="deployment-next-outcome" data-status={outcome}>
              {OUTCOME_LABEL[outcome]}
            </span>
          </dd>
        </dl>
      </div>

      <Link
        href="/deployments"
        data-testid="deployment-start-another"
        className="mt-6 inline-block text-sm font-semibold text-[color:var(--primary)] hover:opacity-80"
      >
        ← Create another deployment
      </Link>
    </div>
  );
}
