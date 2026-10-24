import * as Schema from "effect/Schema";
import { ChevronDownIcon, FolderTreeIcon, PlusIcon } from "lucide-react";

import { cn } from "~/lib/utils";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "../ui/menu";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { SidebarHeaderIconButton } from "./SidebarThreadHeader";

export const GROUP_BY_PROJECT_KEY = "t3code:sidebar:group-by-project";
export const COLLAPSED_PROJECT_GROUPS_KEY = "t3code:sidebar:collapsed-project-groups";
export const EMPTY_COLLAPSED_PROJECT_GROUPS: readonly string[] = [];
export const CollapsedProjectGroups = Schema.Array(Schema.String);

const NO_PROJECT_GROUP_KEY = "\0no-project";

interface ProjectRef {
  readonly environmentId: string;
  readonly projectId: string;
}

export interface ProjectGroupRef<R extends ProjectRef = ProjectRef> {
  readonly displayName: string;
  readonly memberProjectRefs: ReadonlyArray<R>;
}

export interface ActiveProjectGroup<T, R extends ProjectRef = ProjectRef> {
  readonly key: string;
  readonly label: string;
  readonly threads: readonly T[];
  /** Rows shown: all of them, or only the open thread while the group is folded. */
  readonly visible: readonly T[];
  readonly expanded: boolean;
  /** Every copy of the project, one per machine or folder, where a new thread can start. */
  readonly targets: readonly R[];
}

// Projects only share a group upstream when they are the same git repository,
// so folders that are not repositories, like game projects, split per machine.
// Matching on the name keeps one folder per project across every machine.
function projectNameKey(displayName: string): string {
  return displayName.trim().toLowerCase();
}

/**
 * Splits the active list into one group per project name. Groups take the
 * place of their most recent thread in the active order, and threads keep that
 * order inside their group, so grouping moves no thread relative to its
 * neighbours.
 */
export function groupActiveThreadsByProject<
  T extends { readonly environmentId: string; readonly projectId: string },
  R extends ProjectRef,
>(input: {
  readonly threads: readonly T[];
  readonly projectGroups: readonly ProjectGroupRef<R>[];
  readonly collapsedKeys: ReadonlySet<string>;
  readonly isRouteThread: (thread: T) => boolean;
}): ActiveProjectGroup<T, R>[] {
  const nameByMember = new Map<string, string>();
  const targetsByName = new Map<string, R[]>();
  for (const group of input.projectGroups) {
    const key = projectNameKey(group.displayName);
    const targets = targetsByName.get(key) ?? [];
    targetsByName.set(key, targets);
    for (const ref of group.memberProjectRefs) {
      nameByMember.set(`${ref.environmentId}:${ref.projectId}`, group.displayName);
      targets.push(ref);
    }
  }
  const groups = new Map<string, { label: string; threads: T[] }>();
  for (const thread of input.threads) {
    const name = nameByMember.get(`${thread.environmentId}:${thread.projectId}`);
    const key = name === undefined ? NO_PROJECT_GROUP_KEY : projectNameKey(name);
    let group = groups.get(key);
    if (group === undefined) {
      group = { label: name ?? "No project", threads: [] };
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
      targets: targetsByName.get(key) ?? [],
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

const newThreadButtonClassName =
  "pointer-events-auto inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-sm text-sidebar-muted-foreground/60 hover:bg-sidebar-row-hover hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/70";

/** Starts a thread in the project, asking which machine when it lives on more than one. */
function NewThreadInProjectButton<R extends ProjectRef>(props: {
  label: string;
  targets: readonly R[];
  targetLabel: (target: R) => string;
  onNewThread: (target: R) => void;
}) {
  const [only] = props.targets;
  if (only === undefined) return null;
  const buttonLabel = `New thread in ${props.label}`;
  if (props.targets.length === 1) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-label={buttonLabel}
              className={newThreadButtonClassName}
              onClick={() => props.onNewThread(only)}
            />
          }
        >
          <PlusIcon className="size-3.5" />
        </TooltipTrigger>
        <TooltipPopup>{buttonLabel}</TooltipPopup>
      </Tooltip>
    );
  }
  return (
    <Menu>
      <MenuTrigger
        render={
          <button
            type="button"
            aria-label={`${buttonLabel} on…`}
            className={newThreadButtonClassName}
          />
        }
      >
        <PlusIcon className="size-3.5" />
      </MenuTrigger>
      <MenuPopup side="bottom" align="end">
        {props.targets.map((target) => (
          <MenuItem
            key={`${target.environmentId}:${target.projectId}`}
            onClick={() => props.onNewThread(target)}
          >
            {props.targetLabel(target)}
          </MenuItem>
        ))}
      </MenuPopup>
    </Menu>
  );
}

export function SidebarProjectGroupHeader<R extends ProjectRef>(props: {
  label: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  targets: readonly R[];
  targetLabel: (target: R) => string;
  onNewThread: (target: R) => void;
}) {
  return (
    <li data-thread-selection-safe className="relative mx-0.5 mt-1 h-8 list-none">
      {/* Stretched under the row: a button cannot hold the new-thread button. */}
      <button
        type="button"
        aria-expanded={props.expanded}
        aria-label={props.label}
        onClick={props.onToggle}
        data-testid="sidebar-project-group-toggle"
        className="absolute inset-0 cursor-pointer rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/70"
      />
      <div className="pointer-events-none relative flex h-full items-center gap-2 px-2 text-xs font-medium text-sidebar-muted-foreground/60">
        <span className="min-w-0 truncate">{props.label}</span>
        <span aria-hidden className="h-px min-w-2 flex-1 bg-sidebar-border/60" />
        <NewThreadInProjectButton
          label={props.label}
          targets={props.targets}
          targetLabel={props.targetLabel}
          onNewThread={props.onNewThread}
        />
        <span aria-hidden className="shrink-0 tabular-nums">
          {props.count}
        </span>
        <ChevronDownIcon
          aria-hidden
          className={cn("size-3 shrink-0 transition-transform", !props.expanded && "rotate-180")}
        />
      </div>
    </li>
  );
}
