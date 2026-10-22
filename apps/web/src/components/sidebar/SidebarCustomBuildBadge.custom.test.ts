// @effect-diagnostics nodeBuiltinImport:off - reads the upstream file the badge is mounted in.
import * as NodeFS from "node:fs";
import { describe, expect, it } from "vite-plus/test";

import { buildStatusFrom, parseCustomBuildVersion } from "./customBuildStatus";

const VERSION = "0.0.46-nightly.20261013.305301";

describe("custom build badge", () => {
  it("is mounted in the sidebar header", () => {
    const chrome = NodeFS.readFileSync(new URL("./SidebarChrome.tsx", import.meta.url), "utf8");
    expect(chrome).toMatch(/<SidebarCustomBuildBadge\b/);
  });

  it("reads the upstream nightly and custom build number from the version", () => {
    expect(parseCustomBuildVersion(VERSION)).toEqual({ upstream: "3053", build: 1 });
    expect(parseCustomBuildVersion("0.0.46")).toBeNull();
  });

  it("reports the newest build and workflow run", () => {
    const run = { status: "completed", conclusion: "success", html_url: "https://run" };
    expect(buildStatusFrom(`v${VERSION}`, run, VERSION)).toEqual({ kind: "current" });
    expect(buildStatusFrom("v0.0.46-nightly.20261014.305402", run, VERSION)).toEqual({
      kind: "ready",
      version: "0.0.46-nightly.20261014.305402",
    });
    expect(buildStatusFrom(`v${VERSION}`, { ...run, status: "in_progress" }, VERSION)).toEqual({
      kind: "building",
      url: "https://run",
    });
    expect(buildStatusFrom(`v${VERSION}`, { ...run, conclusion: "failure" }, VERSION)).toEqual({
      kind: "failed",
      url: "https://run",
    });
    expect(buildStatusFrom(undefined, undefined, VERSION)).toEqual({ kind: "unknown" });
  });
});
