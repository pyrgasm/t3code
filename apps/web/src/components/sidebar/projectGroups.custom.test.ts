// @effect-diagnostics nodeBuiltinImport:off - reads the upstream file the groups are mounted in.
import * as NodeFS from "node:fs";
import { describe, expect, it } from "vite-plus/test";

import { groupActiveThreadsByProject, toggleCollapsedProjectGroup } from "./projectGroups";

const sidebar = NodeFS.readFileSync(new URL("../Sidebar.tsx", import.meta.url), "utf8");

const thread = (id: string, projectId: string, environmentId = "pc1") => ({
  id,
  projectId,
  environmentId,
});
// Upstream groups by git repository, so a game folder on three PCs is three groups.
const projectGroups = [
  {
    displayName: "t3code",
    memberProjectRefs: [
      { environmentId: "pc1", projectId: "t3" },
      { environmentId: "pc2", projectId: "t3-remote" },
    ],
  },
  { displayName: "Storm Royale", memberProjectRefs: [{ environmentId: "pc1", projectId: "fn" }] },
  { displayName: "Storm Royale", memberProjectRefs: [{ environmentId: "pc2", projectId: "fn2" }] },
  { displayName: "storm royale ", memberProjectRefs: [{ environmentId: "pc3", projectId: "fn3" }] },
];
const group = (threads: ReturnType<typeof thread>[], collapsed: readonly string[] = []) =>
  groupActiveThreadsByProject({
    threads,
    projectGroups,
    collapsedKeys: new Set(collapsed),
    isRouteThread: (candidate) => candidate.id === "c",
  });

describe("active threads grouped by project", () => {
  it("puts a project's threads from every PC in one group, in active order", () => {
    const groups = group([
      thread("a", "fn"),
      thread("b", "t3"),
      thread("c", "fn2", "pc2"),
      thread("d", "t3-remote", "pc2"),
      thread("e", "unknown"),
      thread("f", "fn3", "pc3"),
    ]);
    expect(groups.map((g) => [g.label, g.visible.map((t) => t.id)])).toEqual([
      ["Storm Royale", ["a", "c", "f"]],
      ["t3code", ["b", "d"]],
      ["No project", ["e"]],
    ]);
  });

  it("offers every PC the project is on for a new thread", () => {
    const [storm, t3] = group([thread("a", "fn"), thread("b", "t3")]);
    expect(storm?.targets.map((target) => target.environmentId)).toEqual(["pc1", "pc2", "pc3"]);
    expect(t3?.targets.map((target) => target.projectId)).toEqual(["t3", "t3-remote"]);
  });

  it("folds a project down to the open thread, and unfolds it again", () => {
    const [storm] = group([thread("a", "fn"), thread("c", "fn2", "pc2")]);
    const collapsed = toggleCollapsedProjectGroup([], storm!.key);
    const [folded] = group([thread("a", "fn"), thread("c", "fn2", "pc2")], collapsed);
    expect(folded?.expanded).toBe(false);
    expect(folded?.threads.map((t) => t.id)).toEqual(["a", "c"]);
    expect(folded?.visible.map((t) => t.id)).toEqual(["c"]);
    expect(toggleCollapsedProjectGroup(collapsed, storm!.key)).toEqual([]);
  });

  it("is mounted in the sidebar header and the active list", () => {
    expect(sidebar).toMatch(/<GroupByProjectToggle enabled=\{groupByProject\}/);
    expect(sidebar).toMatch(/<SidebarProjectGroupHeader/);
    expect(sidebar).toMatch(/newThreadContext\.handleNewThread\(target\)/);
    expect(sidebar).toMatch(/rowsOf\(visibleActiveThreads, "active"\)/);
  });
});
