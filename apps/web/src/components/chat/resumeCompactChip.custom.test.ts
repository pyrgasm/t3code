// @effect-diagnostics nodeBuiltinImport:off - reads the upstream files that hold the chip state.
import * as NodeFS from "node:fs";
import { describe, expect, it } from "vite-plus/test";

import { keepsFullHistory, withKeepFullHistory } from "./resumeCompactChip";

const read = (path: string) => NodeFS.readFileSync(new URL(path, import.meta.url), "utf8");

describe("resume Compact chip", () => {
  it("starts off, turns on when clicked, and resets to Full after a send", () => {
    const initial: ReadonlySet<string> = new Set();
    expect(keepsFullHistory(initial, "t1")).toBe(true);

    const compacting = withKeepFullHistory(initial, "t1", false);
    expect(keepsFullHistory(compacting, "t1")).toBe(false);
    expect(keepsFullHistory(compacting, "t2")).toBe(true);

    expect(keepsFullHistory(withKeepFullHistory(compacting, "t1", true), "t1")).toBe(true);
  });

  it("is the chip state ChatView and the composer send use", () => {
    expect(read("../ChatView.tsx")).toMatch(
      /keepFullHistory = keepsFullHistory\(compactThreadKeys, routeThreadKey\)/,
    );
    expect(read("./useComposerSend.ts")).toMatch(/setKeepFullHistory\(routeThreadKey, true\)/);
  });
});
