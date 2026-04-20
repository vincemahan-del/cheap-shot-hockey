import { ok } from "@/lib/api";

export async function GET() {
  return ok({
    name: "cheap-shot-hockey",
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT ?? "dev",
    branch: process.env.VERCEL_GIT_COMMIT_REF ?? process.env.GIT_BRANCH ?? "local",
    environment:
      process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development",
    deployedAt:
      process.env.VERCEL_GIT_COMMIT_AUTHOR_LOGIN
        ? new Date().toISOString()
        : new Date().toISOString(),
    region: process.env.VERCEL_REGION ?? "local",
    apiVersion: "1.0.0",
    uiVersion: "1.0.0",
    demoUrl: process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000",
  });
}
