import type { ReactNode } from "react";
import { cn } from "~/lib/utils";

type PreviewMessage = { readonly role: string; readonly text: string } | null;
type PreviewError = { readonly text: string; readonly usageLimit: boolean } | null;

/** Whether the row's bottom line shows a preview instead of the branch. */
export function hasThreadPreview(message: PreviewMessage, error: PreviewError): boolean {
  return error !== null || (message !== null && message.text !== "");
}

/** The bottom line of a thread row: the last message, or the error that stopped the thread. */
export function ThreadPreview(props: { message: PreviewMessage; error: PreviewError }) {
  if (props.error !== null) {
    return (
      <span
        className={cn(
          "min-w-0 flex-1 truncate",
          props.error.usageLimit ? "text-warning" : "text-error",
        )}
      >
        {props.error.text}
      </span>
    );
  }
  if (props.message === null) return null;
  return (
    <span className="min-w-0 flex-1 truncate">
      {props.message.role === "user" ? (
        <span className="text-muted-foreground/55">You: </span>
      ) : null}
      {props.message.text}
    </span>
  );
}

/** Windows' default "DESKTOP-AB12CD" names only differ after the prefix. */
export function shortMachineName(label: string): string {
  return label.replace(/^(DESKTOP|LAPTOP)-(?=.)/i, "");
}

/** The environment's name beside the machine icon of a remote thread row. */
export function RemoteMachineName(props: { label: string | null | undefined }) {
  return props.label ? (
    <span className="ml-1 max-w-24 truncate">{shortMachineName(props.label)}</span>
  ) : null;
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
