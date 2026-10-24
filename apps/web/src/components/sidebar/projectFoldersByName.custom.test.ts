// @effect-diagnostics nodeBuiltinImport:off - reads the upstream file the folders are mounted in.
import * as NodeFS from "node:fs";
import { describe, expect, it } from "vite-plus/test";

import type { SidebarProjectSnapshot } from "../../sidebarProjectGrouping";
import { mergeProjectFoldersByName, projectFolderTargets } from "./projectFoldersByName";

const sidebar = NodeFS.readFileSync(new URL("../Sidebar.tsx", import.meta.url), "utf8");

const member = (environmentId: string, id: string, environmentLabel: string | null) => ({
  environmentId,
  id,
  environmentLabel,
  workspaceRoot: `/work/${environmentId}/${id}`,
});

const folder = (
  displayName: string,
  members: ReadonlyArray<ReturnType<typeof member>>,
  remoteEnvironmentLabels: readonly string[] = [],
) =>
  ({
    ...members[0]!,
    projectKey: `${members[0]!.environmentId}:${members[0]!.id}`,
    displayName,
    groupedProjectCount: members.length,
    memberProjects: members,
    memberProjectRefs: members.map((m) => ({ environmentId: m.environmentId, projectId: m.id })),
    remoteEnvironmentLabels,
  }) as unknown as SidebarProjectSnapshot;

describe("project folders by name", () => {
  it("puts same-named projects from every machine in the first one's folder", () => {
    const merged = mergeProjectFoldersByName([
      folder("Bridge", [member("desk", "p1", null)]),
      folder("Other", [member("desk", "p2", null)]),
      folder(" bridge ", [member("laptop", "p3", "Laptop")], ["Laptop"]),
    ]);
    expect(merged.map((group) => group.displayName)).toEqual(["Bridge", "Other"]);
    expect(merged[0]!.projectKey).toBe("desk:p1");
    expect(merged[0]!.memberProjectRefs).toEqual([
      { environmentId: "desk", projectId: "p1" },
      { environmentId: "laptop", projectId: "p3" },
    ]);
    expect(merged[0]!.remoteEnvironmentLabels).toEqual(["Laptop"]);
  });

  it("offers one target per copy, by machine, and by path when a machine has two", () => {
    const merged = mergeProjectFoldersByName([
      folder("Bridge", [member("desk", "p1", null), member("desk", "p2", null)]),
      folder("Bridge", [member("laptop", "p3", "Laptop")]),
    ]);
    expect(projectFolderTargets(merged[0]!).map((target) => target.label)).toEqual([
      "This machine: /work/desk/p1",
      "This machine: /work/desk/p2",
      "Laptop",
    ]);
  });

  it("is what the boring sidebar folds threads into, and its new-thread button asks", () => {
    expect(sidebar).toMatch(/folderGroups: boringSidebarEnabled\s*\? mergeProjectFoldersByName\(/);
    expect(sidebar).toMatch(/await pickProjectFolderTarget\(group, position\)/);
  });
});
