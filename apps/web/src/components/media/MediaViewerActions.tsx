import {
  AppWindowIcon,
  ClipboardCopyIcon,
  CopyIcon,
  DownloadIcon,
  FolderOpenIcon,
  LinkIcon,
  type LucideIcon,
} from "lucide-react";

import { Button } from "../ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import {
  copyMediaPath,
  mediaHostEnvironmentId,
  runMediaAction,
  useMediaActions,
  type MediaActionSource,
} from "./MediaActions";
import { useMediaHostActions } from "./mediaHostActions";

interface ViewerAction {
  readonly label: string;
  readonly icon: LucideIcon;
  readonly disabled?: boolean;
  readonly run: () => Promise<void>;
}

/** The media viewer's always-visible actions; the context menu offers the same ones. */
export function MediaViewerActions({ source }: { readonly source: MediaActionSource }) {
  const actions = useMediaActions(source);
  const host = useMediaHostActions(mediaHostEnvironmentId(source));
  const noun = source.kind;
  const unavailable = !actions.canReadMedia || (source.src === null && source.asset === undefined);
  const reference = source.reference;
  const canCopyImage =
    source.kind === "image" &&
    typeof navigator !== "undefined" &&
    Boolean(navigator.clipboard?.write) &&
    typeof ClipboardItem !== "undefined";

  const items: ViewerAction[] = [];
  if (host?.revealLabel !== undefined) {
    const label = host.revealLabel;
    items.push({
      label,
      icon: FolderOpenIcon,
      disabled: unavailable,
      run: () => runMediaAction(`Could not ${label.toLowerCase()}`, actions.revealOnHost),
    });
  }
  if (host !== null) {
    items.push({
      label: "Open with default app",
      icon: AppWindowIcon,
      disabled: unavailable,
      run: () => runMediaAction("Could not open with default app", actions.openOnHost),
    });
  }
  items.push({
    label: `Save ${noun}`,
    icon: DownloadIcon,
    disabled: unavailable,
    run: () =>
      runMediaAction(`Could not save ${noun}`, actions.save, `Preparing ${noun} download…`),
  });
  if (canCopyImage) {
    items.push({
      label: "Copy image",
      icon: CopyIcon,
      disabled: unavailable,
      run: () => runMediaAction("Could not copy image", actions.copyImage, "Copying image…"),
    });
  }
  if (reference?.kind === "file") {
    items.push({
      label: "Copy full path",
      icon: ClipboardCopyIcon,
      run: () =>
        runMediaAction("Could not copy full path", () => copyMediaPath(reference.path, reference)),
    });
  } else if (reference?.kind === "url") {
    items.push({
      label: "Copy URL",
      icon: LinkIcon,
      run: () =>
        runMediaAction("Could not copy URL", () => copyMediaPath(reference.url, reference)),
    });
  }

  return (
    <div role="toolbar" aria-label={`${noun} actions`} className="flex items-center gap-1.5">
      {items.map((item) => (
        <Tooltip key={item.label}>
          <TooltipTrigger
            render={
              <Button
                type="button"
                size="icon-sm"
                variant="media-close"
                aria-label={item.label}
                disabled={item.disabled}
                onClick={() => void item.run()}
              />
            }
          >
            <item.icon />
          </TooltipTrigger>
          <TooltipPopup side="bottom">{item.label}</TooltipPopup>
        </Tooltip>
      ))}
    </div>
  );
}
