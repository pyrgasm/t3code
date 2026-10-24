import { CollapsibleSectionHeader } from "../ui/collapsible-section-header";

export const PINNED_SHELF_EXPANDED_KEY = "t3code:sidebar:pinned-expanded";

// A folded shelf still shows the open thread, as the Settled shelf does, so
// opening a pinned thread never makes its row vanish from under the cursor.
export function pinnedShelfRows<T>(
  pinned: readonly T[],
  expanded: boolean,
  isRouteThread: (thread: T) => boolean,
): readonly T[] {
  return expanded ? pinned : pinned.filter(isRouteThread);
}

export function SidebarPinnedShelfHeader(props: {
  count: number;
  expanded: boolean;
  onToggle: () => void;
  dragging: boolean;
  isDropTarget: boolean;
}) {
  return (
    <li data-thread-selection-safe className="mx-0.5 h-8 list-none">
      <CollapsibleSectionHeader
        onClick={props.onToggle}
        expanded={props.expanded}
        tone={props.isDropTarget ? "accent" : props.dragging ? "emphasized" : "muted"}
        data-testid="sidebar-pinned-shelf-toggle"
      >
        {props.expanded ? "Pinned" : `Pinned (${props.count})`}
      </CollapsibleSectionHeader>
    </li>
  );
}
