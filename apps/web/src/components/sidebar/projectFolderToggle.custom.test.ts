// @effect-diagnostics nodeBuiltinImport:off - reads the upstream file the toggle is mounted in.
import * as NodeFS from "node:fs";
import { describe, expect, it } from "vite-plus/test";

import { projectFolderTogglePatch } from "./projectFolderToggle";

const header = NodeFS.readFileSync(new URL("./SidebarThreadHeader.tsx", import.meta.url), "utf8");

describe("project folder toggle", () => {
  it("flips the boring sidebar setting and clears the legacy opt-in", () => {
    expect(projectFolderTogglePatch(false)).toEqual({
      boringSidebarEnabled: true,
      legacySidebarEnabled: false,
    });
    expect(projectFolderTogglePatch(true)).toEqual({
      boringSidebarEnabled: false,
      legacySidebarEnabled: false,
    });
  });

  it("sits beside the search field, before the project filter", () => {
    expect(header).toMatch(/<ProjectFolderToggle \/>\s*\{projectScope\}/);
  });
});
