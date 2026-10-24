import * as Schema from "effect/Schema";
import { FolderTreeIcon } from "lucide-react";
import type { ReactNode } from "react";

import { CollapsibleSectionHeader } from "../ui/collapsible-section-header";
import { SidebarHeaderIconButton } from "./SidebarThreadHeader";

export const GROUP_BY_PROJECT_KEY = "t3code:sidebar:group-by-project";
export const COLLAPSED_PROJECT_GROUPS_KEY = "t3code:sidebar:collapsed-project-groups";

export const EMPTY_COLLAPSED_PROJECT_GROUPS: readonly string[] = [];
export const CollapsedProjectGroups = Schema.Array(Schema.String);
const NO_PROJECT_GROUP_KEY = "no-project";

export interface ProjectGroupRef {
  readonly projectKey: string;
  readonly displayName: string;
  readonly memberProjectRefs: ReadonlyArray<{
    readonly environmentId: string;
    readonly projectId: string;
  }>;
}

export interface ActiveProjectGroup<T> {
  readonly key: string;
  readonly label: string;
  readonly threads: readonly T[];
  /** Rows shown: all of them, or only the open thread while the group is folded. */
  readonly visible: readonly T[];
  readonly expanded: boolean;
}

/**
 * Splits the active list into one group per project. Groups take the place of
 * their most recent thread in the active order, and threads keep that order
 * inside their group, so grouping moves no thread relative to its neighbours.
 */
export function groupActiveThreadsByProject<
  T extends { readonly environmentId: string; readonly projectId: string },
>(input: {
  readonly threads: readonly T[];
  readonly projectGroups: readonly ProjectGroupRef[];
  readonly collapsedKeys: ReadonlySet<string>;
  readonly isRouteThread: (thread: T) => boolean;
}): ActiveProjectGroup<T>[] {
  const groupByMember = new Map<string, ProjectGroupRef>();
  for (const group of input.projectGroups) {
    for (const ref of group.memberProjectRefs) {
      groupByMember.set(`${ref.environmentId}:${ref.projectId}`, group);
    }
  }
  const groups = new Map<string, { label: string; threads: T[] }>();
  for (const thread of input.threads) {
    const project = groupByMember.get(`${thread.environmentId}:${thread.projectId}`);
    const key = project?.projectKey ?? NO_PROJECT_GROUP_KEY;
    let group = groups.get(key);
    if (group === undefined) {
      group = { label: project?.displayName ?? "No project", threads: [] };
      groups.set(key, group);
    }
    group.threads.push(thread);
  }
  return [...groups].map(([key, group]) => {
    const expanded = !input.collapsedKeys.has(key);
    return {
      key,
      label: group.label,
      threads: group.threads,
      visible: expanded ? group.threads : group.threads.filter(input.isRouteThread),
      expanded,
    };
  });
}

export function toggleCollapsedProjectGroup(
  collapsed: readonly string[],
  key: string,
): readonly string[] {
  return collapsed.includes(key)
    ? collapsed.filter((candidate) => candidate !== key)
    : [...collapsed, key];
}

export function GroupByProjectToggle(props: { enabled: boolean; onToggle: () => void }) {
  return (
    <SidebarHeaderIconButton
      label={props.enabled ? "Stop grouping by project" : "Group active threads by project"}
      aria-pressed={props.enabled}
      data-active={props.enabled}
      onClick={props.onToggle}
    >
      <FolderTreeIcon className="size-4" />
    </SidebarHeaderIconButton>
  );
}

export function SidebarProjectGroupHeader(props: {
  label: string;
  count: number;
  icon: ReactNode;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <li data-thread-selection-safe className="mx-0.5 mt-1 h-8 list-none">
      <CollapsibleSectionHeader
        onClick={props.onToggle}
        expanded={props.expanded}
        accessory={<span className="shrink-0 tabular-nums">{props.count}</span>}
        data-testid="sidebar-project-group-toggle"
      >
        <span className="flex items-center gap-1.5">
          {props.icon}
          {props.label}
        </span>
      </CollapsibleSectionHeader>
    </li>
  );
}
