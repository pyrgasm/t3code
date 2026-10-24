// @effect-diagnostics nodeBuiltinImport:off - reads the upstream file the shelf is mounted in.
import * as NodeFS from "node:fs";
import { describe, expect, it } from "vite-plus/test";

import { pinnedShelfRows } from "./pinnedShelf";

const sidebar = NodeFS.readFileSync(new URL("../Sidebar.tsx", import.meta.url), "utf8");
const threadRow = NodeFS.readFileSync(new URL("./SidebarThreadRow.tsx", import.meta.url), "utf8");

describe("pinned shelf", () => {
  it("folds pinned threads away except the open one", () => {
    const pinned = ["a", "b", "c"];
    expect(pinnedShelfRows(pinned, true, (key) => key === "b")).toEqual(["a", "b", "c"]);
    expect(pinnedShelfRows(pinned, false, (key) => key === "b")).toEqual(["b"]);
    expect(pinnedShelfRows(pinned, false, () => false)).toEqual([]);
  });

  it("is the pinned list the sidebar renders, under its own header", () => {
    expect(sidebar).toMatch(/rowsOf\(visiblePinnedThreads, "pinned"\)/);
    expect(sidebar).toMatch(/<SidebarPinnedShelfHeader/);
  });

  it("pins an unpinned row from its hover controls, left of the snooze clock", () => {
    expect(threadRow).toMatch(
      /showPinButton = canOperateThread && props\.pinningSupported && !props\.isPinned/,
    );
    expect(threadRow).toMatch(
      /<RowPinButton onPin=\{\(\) => onPin\(threadRef\)\} \/> : null\}\s*\{showSnoozeButton/,
    );
    expect(sidebar).toMatch(/onPin=\{attemptPin\}/);
  });
});
