export type BuildStatus =
  | { readonly kind: "checking" }
  | { readonly kind: "unknown" }
  | { readonly kind: "current" }
  | { readonly kind: "ready"; readonly version: string }
  | { readonly kind: "building"; readonly url: string }
  | { readonly kind: "failed"; readonly url: string };

export interface WorkflowRun {
  readonly status: string;
  readonly conclusion: string | null;
  readonly html_url: string;
}

// Upstream's nightly version with two build digits appended: 0.0.46-nightly.20261013.305301 is
// custom build 1 on upstream nightly 3053. Only this fork ships the badge, and dev builds carry
// a plain version, so the pattern alone identifies a custom build.
const CUSTOM_VERSION = /^\d+\.\d+\.\d+-nightly\.\d{8}\.(?<upstream>\d+)(?<build>\d{2})$/;

export function parseCustomBuildVersion(
  version: string,
): { readonly upstream: string; readonly build: number } | null {
  const groups = CUSTOM_VERSION.exec(version)?.groups;
  if (!groups?.upstream || !groups.build) return null;
  return { upstream: groups.upstream, build: Number(groups.build) };
}

export function buildStatusFrom(
  latestTag: string | undefined,
  run: WorkflowRun | undefined,
  appVersion: string,
): BuildStatus {
  if (run && run.status !== "completed") return { kind: "building", url: run.html_url };
  if (run && run.conclusion === "failure") return { kind: "failed", url: run.html_url };
  const latest = latestTag?.replace(/^v/, "");
  if (latest === undefined) return { kind: "unknown" };
  return latest === appVersion ? { kind: "current" } : { kind: "ready", version: latest };
}
