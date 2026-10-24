// @effect-diagnostics nodeBuiltinImport:off - reads the upstream file the groups are mounted in.
import * as NodeFS from "node:fs";
import { describe, expect, it } from "vite-plus/test";

import { groupActiveThreadsByProject, toggleCollapsedProjectGroup } from "./projectGroups";

const sidebar = NodeFS.readFileSync(new URL("../Sidebar.tsx", import.meta.url), "utf8");

const thread = (id: string, projectId: string, environmentId = "local") => ({
  id,
  projectId,
  environmentId,
});
const projectGroups = [
  {
    projectKey: "t3code",
    displayName: "t3code",
    memberProjectRefs: [
      { environmentId: "local", projectId: "t3" },
      { environmentId: "pc2", projectId: "t3-remote" },
    ],
  },
  {
    projectKey: "fortnite",
    displayName: "Storm Royale",
    memberProjectRefs: [{ environmentId: "local", projectId: "fn" }],
  },
];

describe("active threads grouped by project", () => {
  it("groups in active order, merging a project's machines and keeping thread order", () => {
    const groups = groupActiveThreadsByProject({
      threads: [
        thread("a", "fn"),
        thread("b", "t3"),
        thread("c", "fn"),
        thread("d", "t3-remote", "pc2"),
        thread("e", "unknown"),
      ],
      projectGroups,
      collapsedKeys: new Set(),
      isRouteThread: () => false,
    });
    expect(groups.map((group) => [group.label, group.visible.map((t) => t.id)])).toEqual([
      ["Storm Royale", ["a", "c"]],
      ["t3code", ["b", "d"]],
      ["No project", ["e"]],
    ]);
  });

  it("folds a project down to the open thread, and unfolds it again", () => {
    const collapsed = toggleCollapsedProjectGroup([], "fortnite");
    const [fortnite] = groupActiveThreadsByProject({
      threads: [thread("a", "fn"), thread("c", "fn")],
      projectGroups,
      collapsedKeys: new Set(collapsed),
      isRouteThread: (candidate) => candidate.id === "c",
    });
    expect(fortnite?.expanded).toBe(false);
    expect(fortnite?.threads.map((t) => t.id)).toEqual(["a", "c"]);
    expect(fortnite?.visible.map((t) => t.id)).toEqual(["c"]);
    expect(toggleCollapsedProjectGroup(collapsed, "fortnite")).toEqual([]);
  });

  it("is mounted in the sidebar header and the active list", () => {
    expect(sidebar).toMatch(/<GroupByProjectToggle enabled=\{groupByProject\}/);
    expect(sidebar).toMatch(/<SidebarProjectGroupHeader/);
    expect(sidebar).toMatch(/rowsOf\(visibleActiveThreads, "active"\)/);
  });
});
