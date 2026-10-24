import type { SidebarProjectSnapshot } from "../../sidebarProjectGrouping";
import { readLocalApi } from "../../localApi";

// Upstream shares a folder only between copies of the same git repository, so
// folders that are not repositories, like game projects, split per machine.
// Matching on the name keeps one folder per project across every machine.
export function mergeProjectFoldersByName(
  groups: readonly SidebarProjectSnapshot[],
): SidebarProjectSnapshot[] {
  const byName = new Map<string, SidebarProjectSnapshot>();
  for (const group of groups) {
    const key = group.displayName.trim().toLowerCase();
    const first = byName.get(key);
    byName.set(
      key,
      first === undefined
        ? group
        : {
            ...first,
            groupedProjectCount: first.groupedProjectCount + group.groupedProjectCount,
            memberProjects: [...first.memberProjects, ...group.memberProjects],
            memberProjectRefs: [...first.memberProjectRefs, ...group.memberProjectRefs],
            remoteEnvironmentLabels: [
              ...new Set([...first.remoteEnvironmentLabels, ...group.remoteEnvironmentLabels]),
            ],
          },
    );
  }
  return [...byName.values()];
}

/** Each copy of the folder's project, labelled by its machine, and by path when a machine has two. */
export function projectFolderTargets(group: SidebarProjectSnapshot) {
  const members = group.memberProjects.length > 0 ? group.memberProjects : [group];
  const machineOf = (member: (typeof members)[number]) =>
    ("environmentLabel" in member ? member.environmentLabel : null) ?? "This machine";
  return members.map((member) => ({
    environmentId: member.environmentId,
    projectId: member.id,
    label:
      members.filter((other) => machineOf(other) === machineOf(member)).length > 1
        ? `${machineOf(member)}: ${member.workspaceRoot}`
        : machineOf(member),
  }));
}

/** The copy to start a thread in, asking which machine when the folder spans more than one. */
export async function pickProjectFolderTarget(
  group: SidebarProjectSnapshot,
  position?: { x: number; y: number },
) {
  const targets = projectFolderTargets(group);
  if (targets.length <= 1) return targets[0] ?? null;
  const picked = await readLocalApi()?.contextMenu.show(
    targets.map((target, index) => ({ id: String(index), label: target.label })),
    position,
  );
  return picked == null ? null : (targets[Number(picked)] ?? null);
}
