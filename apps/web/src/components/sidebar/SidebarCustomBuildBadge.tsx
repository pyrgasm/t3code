import { useEffect, useState } from "react";

import { APP_VERSION } from "../../branding";
import { cn } from "../../lib/utils";
import { readLocalApi } from "../../localApi";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

// The fork this build comes from, and its build workflow (.github/workflows/custom-release.yml).
const CUSTOM_BUILD_REPO = "pyrgasm/t3code";
const CUSTOM_BUILD_WORKFLOW = "custom-release.yml";
// Unauthenticated GitHub API: 60 requests an hour per IP, two per check.
const CHECK_INTERVAL_MS = 10 * 60 * 1000;

const CUSTOM_VERSION = /^(?<upstream>\d+\.\d+\.\d+)-custom\.(?<build>\d+)$/.exec(APP_VERSION);

type BuildStatus =
  | { readonly kind: "checking" }
  | { readonly kind: "unknown" }
  | { readonly kind: "current" }
  | { readonly kind: "ready"; readonly version: string }
  | { readonly kind: "building"; readonly url: string }
  | { readonly kind: "failed"; readonly url: string };

interface WorkflowRun {
  readonly status: string;
  readonly conclusion: string | null;
  readonly html_url: string;
}

async function fetchJson<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(`https://api.github.com/repos/${CUSTOM_BUILD_REPO}/${path}`, {
    headers: { Accept: "application/vnd.github+json" },
    signal,
  });
  if (!response.ok) throw new Error(`GitHub ${response.status}`);
  return (await response.json()) as T;
}

async function readBuildStatus(signal: AbortSignal): Promise<BuildStatus> {
  const [release, runs] = await Promise.all([
    fetchJson<{ readonly tag_name: string }>("releases/latest", signal),
    fetchJson<{ readonly workflow_runs: ReadonlyArray<WorkflowRun> }>(
      `actions/workflows/${CUSTOM_BUILD_WORKFLOW}/runs?per_page=1`,
      signal,
    ),
  ]);
  const run = runs.workflow_runs[0];
  if (run && run.status !== "completed") return { kind: "building", url: run.html_url };
  if (run && run.conclusion === "failure") return { kind: "failed", url: run.html_url };
  const latest = release.tag_name.replace(/^v/, "");
  return latest === APP_VERSION ? { kind: "current" } : { kind: "ready", version: latest };
}

const DOT_CLASS: Record<BuildStatus["kind"], string> = {
  checking: "bg-muted-foreground/40",
  unknown: "bg-muted-foreground/40",
  current: "bg-emerald-500",
  ready: "bg-sky-500",
  building: "bg-amber-500 animate-pulse",
  failed: "bg-destructive",
};

function describe(status: BuildStatus): string {
  switch (status.kind) {
    case "checking":
      return "Checking the custom build…";
    case "unknown":
      return "Could not reach GitHub to check the custom build.";
    case "current":
      return "Up to date with the newest custom build.";
    case "ready":
      return `Custom build v${status.version} is ready. Update from the update pill, or run the desktop updater.`;
    case "building":
      return "A new custom build is running. Click to watch it.";
    case "failed":
      return "The last custom build failed; this version keeps working. Click to see why.";
  }
}

/** Version and build status of a pyrgasm/t3code custom build; renders nothing on other builds. */
export function SidebarCustomBuildBadge({ onBackdrop }: { onBackdrop: boolean }) {
  const [status, setStatus] = useState<BuildStatus>({ kind: "checking" });

  useEffect(() => {
    if (!CUSTOM_VERSION) return;
    const controller = new AbortController();
    const check = () => {
      readBuildStatus(controller.signal).then(setStatus, () => {
        if (!controller.signal.aborted) setStatus({ kind: "unknown" });
      });
    };
    check();
    const timer = window.setInterval(check, CHECK_INTERVAL_MS);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, []);

  if (!CUSTOM_VERSION?.groups) return null;
  const { upstream, build } = CUSTOM_VERSION.groups;
  const url =
    status.kind === "building" || status.kind === "failed"
      ? status.url
      : `https://github.com/${CUSTOM_BUILD_REPO}/releases`;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label={`Custom build ${build}`}
            className={cn(
              "relative z-10 flex h-6 shrink-0 items-center gap-1.5 rounded-md px-1.5 text-xs tabular-nums outline-hidden ring-ring hover:bg-sidebar-row-hover focus-visible:ring-2",
              onBackdrop ? "text-white/70" : "text-muted-foreground",
            )}
            onClick={() => {
              void readLocalApi()?.shell.openExternal(url);
            }}
          >
            <span className={cn("size-1.5 rounded-full", DOT_CLASS[status.kind])} />
            {`custom.${build}`}
          </button>
        }
      />
      <TooltipPopup side="bottom">
        <div className="flex flex-col gap-0.5">
          <span>{`T3 Code v${upstream} + custom build ${build}`}</span>
          <span className="text-muted-foreground">{describe(status)}</span>
        </div>
      </TooltipPopup>
    </Tooltip>
  );
}
