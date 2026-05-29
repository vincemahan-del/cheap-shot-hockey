import Link from "next/link";
import DeploymentTracker from "./DeploymentTracker";

export default async function DeploymentDetailPage({
  params,
}: {
  params: Promise<{ label: string }>;
}) {
  const { label } = await params;

  return (
    <div className="mx-auto max-w-xl px-4 py-12" data-testid="deployment-detail-page">
      <header className="mb-8">
        <p className="mb-2 text-xs font-bold uppercase tracking-wider text-[color:var(--primary)]">
          Catalog Deployments
        </p>
        <h1 className="font-display text-3xl font-black uppercase tracking-tight">
          Tracking deployment
        </h1>
        <p className="mt-3 text-[color:var(--muted)]">
          This page polls the deployment status every second and updates in place
          until it reaches a terminal state. When it&apos;s done, search the
          deployment label to find the result.
        </p>
      </header>

      <DeploymentTracker label={label} />

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
