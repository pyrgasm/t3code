import type { MediaActionId } from "@t3tools/client-runtime/media-actions";
import type { MediaReference } from "@t3tools/client-runtime/media-reference";
import type { AssetResource, ContextMenuItem, ServerConfig } from "@t3tools/contracts";

import {
  revealInFileExplorerLabelForKind,
  revealInFileExplorerLabelForOs,
} from "../preview/fileExplorerLabel";

export type WebMediaActionId = MediaActionId | "open-preview" | "reveal" | "open-default";

export interface MediaHostActions {
  /** "Reveal in File Explorer" and friends; absent when the host's file manager cannot select a file. */
  readonly revealLabel: string | undefined;
}

/** Resources whose asset URL names the file on the host (`AssetCreateUrlResult.filePath`). */
export function isHostFileResource(resource: AssetResource): boolean {
  return (
    resource._tag === "attachment" ||
    resource._tag === "media-file" ||
    resource._tag === "workspace-file" ||
    resource._tag === "draft-workspace-file"
  );
}

export function mediaHostActions(input: {
  readonly config: ServerConfig | null;
  readonly canOperate: boolean;
  readonly localExec: boolean;
}): MediaHostActions | null {
  const { config } = input;
  // The file manager opens on the server's machine, which is this screen only for a local server.
  if (!input.canOperate || !input.localExec || !config?.availableEditors.includes("file-manager")) {
    return null;
  }
  return {
    revealLabel:
      config.shellRevealInFileManager !== true
        ? undefined
        : config.shellRevealInFileManagerKind === undefined
          ? revealInFileExplorerLabelForOs(config.environment.platform.os)
          : revealInFileExplorerLabelForKind(config.shellRevealInFileManagerKind),
  };
}

export function mediaMenuItems(input: {
  readonly kind: "image" | "video";
  readonly reference: MediaReference | undefined;
  /** Null when the media has no host file or this client cannot act on the host. */
  readonly host: MediaHostActions | null;
  readonly canExpand: boolean;
  readonly canOpenFile: boolean;
  readonly canReadMedia: boolean;
  readonly unavailable: boolean;
  readonly canCopyImage: boolean;
}): ContextMenuItem<WebMediaActionId>[] {
  const noun = input.kind;
  const items: ContextMenuItem<WebMediaActionId>[] = [];
  if (input.canExpand) items.push({ id: "open-preview", label: `Open ${noun} preview` });
  if (input.host?.revealLabel !== undefined) {
    items.push({ id: "reveal", label: input.host.revealLabel, disabled: input.unavailable });
  }
  if (input.host !== null) {
    items.push({ id: "open-default", label: "Open with default app", disabled: input.unavailable });
  }
  if (input.canOpenFile) {
    items.push({ id: "open-file", label: "Open in file viewer", disabled: !input.canReadMedia });
  }
  items.push({ id: "save", label: `Save ${noun}`, disabled: input.unavailable });
  if (input.kind === "image") {
    items.push({
      id: "copy-image",
      label: "Copy image",
      disabled: input.unavailable || !input.canCopyImage,
    });
  }
  if (input.reference?.kind === "file") {
    items.push({ id: "copy-full-path", label: "Copy full path" });
    if (input.reference.relativePath) {
      items.push({ id: "copy-relative-path", label: "Copy relative path" });
    }
  } else if (input.reference?.kind === "url") {
    items.push({ id: "copy-url", label: "Copy URL" });
  }
  return items;
}
