import { PinIcon } from "lucide-react";
import type { MouseEvent as ReactMouseEvent } from "react";

import { CollapsibleSectionHeader } from "../ui/collapsible-section-header";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

/** The hover control that pins a row, left of the snooze clock. */
export function RowPinButton(props: { onPin: () => void }) {
  const handleClick = (event: ReactMouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    props.onPin();
  };
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            aria-label="Pin thread"
            onClick={handleClick}
            onDoubleClick={(event) => event.stopPropagation()}
            className="inline-flex h-full cursor-pointer items-center rounded-md bg-transparent px-1.5 text-xs text-muted-foreground hover:text-foreground"
          />
        }
      >
        <PinIcon className="size-3" />
      </TooltipTrigger>
      <TooltipPopup>Pin thread</TooltipPopup>
    </Tooltip>
  );
}

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
