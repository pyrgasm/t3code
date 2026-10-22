import type { ReactNode } from "react";

/** The environment's name beside the machine icon of a remote thread row. */
export function RemoteMachineName(props: { label: string | null | undefined }) {
  return props.label ? <span className="ml-1 max-w-24 truncate">{props.label}</span> : null;
}

/** "Created: 2d • 15h": the thread's age, dimmed, before the time of its last message. */
export function CreatedAndLastTime(props: { created: ReactNode; last: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="text-muted-foreground/55">Created: {props.created}</span>
      <span aria-hidden className="text-muted-foreground/35">
        •
      </span>
      {props.last}
    </span>
  );
}
