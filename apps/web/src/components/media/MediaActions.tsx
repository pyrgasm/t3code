import { formatFilePathForClipboard } from "@t3tools/client-runtime/media-actions";
import {
  mediaReferenceFileName,
  type MediaReference,
} from "@t3tools/client-runtime/media-reference";
import { resolveAssetUrl } from "@t3tools/client-runtime/state/assets";
import {
  isAtomCommandInterrupted,
  settlePromise,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import {
  AuthFilesystemReadScope,
  type AssetResource,
  type EnvironmentId,
  sessionGrantsScope,
  type SessionGrantInput,
} from "@t3tools/contracts";
import { AsyncResult } from "effect/reactivity";
import { useRef, useState, type ReactElement } from "react";

import { writeTextToClipboard } from "../../hooks/useCopyToClipboard";
import { readLocalApi } from "../../localApi";
import { appAtomRegistry } from "../../rpc/atomRegistry";
import { assetEnvironment } from "../../state/assets";
import { useEnvironmentQuery } from "../../state/query";
import { environmentSession, readPreparedConnection } from "../../state/session";
import { shellEnvironment } from "../../state/shell";
import { useAtomCommand } from "../../state/use-atom-command";
import { useAtomQueryRunner } from "../../state/use-atom-query-runner";
import { stackedThreadToast, toastManager } from "../ui/toast";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import { mediaHostActionsAtom } from "./mediaHostActions";
import { isHostFileResource, mediaMenuItems, type MediaHostActions } from "./mediaMenu.logic";
import { downloadMedia, readMediaPng } from "./mediaContent";

export interface MediaActionSource {
  readonly kind: "image" | "video";
  readonly name: string;
  readonly src: string | null;
  readonly reference?: MediaReference;
  readonly asset?: { readonly environmentId: EnvironmentId; readonly resource: AssetResource };
  readonly onOpenFile?: () => void;
  /** Opens the full-window preview; menus offer it wherever a click cannot. */
  readonly onExpand?: () => void;
}

function mediaFileName(source: MediaActionSource): string {
  return (
    (source.reference && mediaReferenceFileName(source.reference)) || source.name || source.kind
  );
}

function allowsHostMedia(session: SessionGrantInput | null) {
  return session === null || sessionGrantsScope(session, AuthFilesystemReadScope);
}

function canReadHostMedia(environmentId: EnvironmentId | null): boolean {
  if (environmentId === null) return true;
  const result = appAtomRegistry.get(environmentSession.sessionStateAtom(environmentId));
  return result._tag !== "Failure" && allowsHostMedia(AsyncResult.getOrElse(result, () => null));
}

/** The environment whose host holds this media's file, when it has one. */
export function mediaHostEnvironmentId(source: MediaActionSource): EnvironmentId | null {
  return source.asset && isHostFileResource(source.asset.resource)
    ? source.asset.environmentId
    : null;
}

function readMediaHostActions(source: MediaActionSource): MediaHostActions | null {
  const environmentId = mediaHostEnvironmentId(source);
  return environmentId === null ? null : appAtomRegistry.get(mediaHostActionsAtom(environmentId));
}

export function useMediaActions(source: MediaActionSource) {
  const hostEnvironmentId =
    source.asset &&
    (source.asset.resource._tag === "workspace-file" || source.asset.resource._tag === "media-file")
      ? source.asset.environmentId
      : null;
  const fileSession = useEnvironmentQuery(
    hostEnvironmentId === null ? null : environmentSession.sessionStateAtom(hostEnvironmentId),
  );
  const canReadMedia =
    hostEnvironmentId === null ||
    (fileSession.error === null && fileSession.data !== null && allowsHostMedia(fileSession.data));
  const assertCanReadMedia = () => {
    if (!canReadHostMedia(hostEnvironmentId)) {
      throw new Error("This connection cannot read host files.");
    }
  };
  const createAssetUrl = useAtomQueryRunner(assetEnvironment.createUrl, {
    reportFailure: false,
    refresh: true,
  });
  const openInEditor = useAtomCommand(shellEnvironment.openInEditor, { reportFailure: false });
  const mintAsset = async (asset: NonNullable<MediaActionSource["asset"]>) => {
    const result = await createAssetUrl({
      environmentId: asset.environmentId,
      input: { resource: asset.resource },
    });
    if (result._tag === "Failure") throw squashAtomCommandFailure(result);
    return result.value;
  };
  const actionUrl = async () => {
    assertCanReadMedia();
    if (!source.asset) {
      if (!source.src) throw new Error("This media is unavailable. Try reopening the preview.");
      return source.src;
    }
    const connection = readPreparedConnection(source.asset.environmentId);
    if (!connection) throw new Error("Reconnect to this environment and try again.");
    const minted = await mintAsset(source.asset);
    assertCanReadMedia();
    const url = resolveAssetUrl(connection.httpBaseUrl, minted.relativeUrl);
    if (!url) throw new Error("The environment returned an invalid media URL.");
    return url;
  };
  const save = async () => {
    await downloadMedia(await actionUrl(), mediaFileName(source));
  };
  const copyImage = async () => {
    assertCanReadMedia();
    if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
      throw new Error(
        "Image copying is unavailable. Use a secure browser connection or save the image.",
      );
    }
    // Start the clipboard write in the user gesture; fetching/decoding may finish later.
    await navigator.clipboard.write([
      new ClipboardItem({ "image/png": actionUrl().then(readMediaPng) }),
    ]);
  };
  const openOnHost = async (reveal: boolean) => {
    assertCanReadMedia();
    const environmentId = mediaHostEnvironmentId(source);
    if (environmentId === null || !source.asset) {
      throw new Error("This media has no file on the host.");
    }
    // The server resolves workspace-relative, home-relative and attachment paths to the real file.
    const filePath =
      (await mintAsset(source.asset)).filePath ??
      (source.reference?.kind === "file" ? source.reference.path : undefined);
    if (filePath === undefined) throw new Error("Update the server to open this file.");
    const result = await openInEditor({
      environmentId,
      input: { cwd: filePath, editor: "file-manager", ...(reveal ? { reveal: true } : {}) },
    });
    if (result._tag === "Failure" && !isAtomCommandInterrupted(result)) {
      throw squashAtomCommandFailure(result);
    }
  };
  return {
    save,
    copyImage,
    canReadMedia,
    assertCanReadMedia,
    revealOnHost: () => openOnHost(true),
    openOnHost: () => openOnHost(false),
  };
}

export type MediaActionsApi = ReturnType<typeof useMediaActions>;

export async function copyMediaPath(text: string, reference: MediaReference | undefined) {
  const isFile = reference?.kind === "file";
  await writeTextToClipboard(
    isFile ? formatFilePathForClipboard(text, reference.path) : text,
    isFile ? "file path" : "URL",
  );
}

/** Runs one media action with a progress toast where it waits on bytes, and an error toast on failure. */
export async function runMediaAction(
  title: string,
  action: () => Promise<void>,
  loading?: string,
) {
  let progressToast: ReturnType<typeof toastManager.add> | undefined;
  const result = await settlePromise(async () => {
    if (loading) progressToast = toastManager.add({ type: "loading", title: loading });
    await action();
    if (progressToast) toastManager.close(progressToast);
  });
  if (AsyncResult.isFailure(result)) {
    const error = squashAtomCommandFailure(result);
    const toast = stackedThreadToast({
      type: "error",
      title,
      description: error instanceof Error ? error.message : "The media action failed.",
    });
    if (progressToast) toastManager.update(progressToast, toast);
    else toastManager.add(toast);
  }
}

export function MediaActions({
  source,
  children,
  showTooltip = true,
}: {
  source: MediaActionSource;
  children: ReactElement;
  showTooltip?: boolean;
}) {
  const actions = useMediaActions(source);
  const { save, copyImage, canReadMedia, assertCanReadMedia } = actions;
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const menuOpen = useRef(false);
  const reference = source.reference;
  const tooltip = reference?.kind === "file" ? reference.path : (reference?.url ?? source.name);

  const showMenu = async (position: { x: number; y: number }) => {
    const api = readLocalApi();
    if (!api || menuOpen.current) return;
    menuOpen.current = true;
    setTooltipOpen(false);
    const noun = source.kind === "image" ? "image" : "video";
    const items = mediaMenuItems({
      kind: source.kind,
      reference,
      host: readMediaHostActions(source),
      canExpand: source.onExpand !== undefined,
      canOpenFile: source.onOpenFile !== undefined,
      canReadMedia,
      unavailable: !canReadMedia || (source.src === null && source.asset === undefined),
      canCopyImage:
        typeof navigator !== "undefined" &&
        Boolean(navigator.clipboard?.write) &&
        typeof ClipboardItem !== "undefined",
    });
    const shown = await settlePromise(() => api.contextMenu.show(items, position));
    menuOpen.current = false;
    if (AsyncResult.isFailure(shown)) {
      await runMediaAction("Could not open media menu", () => Promise.reject(shown.cause));
      return;
    }
    const action = AsyncResult.getOrElse(shown, () => null);
    if (!action) return;
    const title = `Could not ${items.find((item) => item.id === action)?.label.toLowerCase() ?? "complete media action"}`;
    switch (action) {
      case "open-preview":
        source.onExpand?.();
        return;
      case "copy-full-path":
        if (reference?.kind === "file")
          await runMediaAction(title, () => copyMediaPath(reference.path, reference));
        return;
      case "copy-relative-path":
        if (reference?.kind === "file" && reference.relativePath) {
          const relativePath = reference.relativePath;
          await runMediaAction(title, () => copyMediaPath(relativePath, reference));
        }
        return;
      case "copy-url":
        if (reference?.kind === "url")
          await runMediaAction(title, () => copyMediaPath(reference.url, reference));
        return;
      case "open-file":
        await runMediaAction(title, async () => {
          assertCanReadMedia();
          source.onOpenFile?.();
        });
        return;
      case "reveal":
        await runMediaAction(title, actions.revealOnHost);
        return;
      case "open-default":
        await runMediaAction(title, actions.openOnHost);
        return;
      case "save":
        await runMediaAction(title, save, `Preparing ${noun} download…`);
        return;
      case "copy-image":
        await runMediaAction(title, copyImage, "Copying image…");
    }
  };

  return (
    <Tooltip disabled={!showTooltip} open={tooltipOpen} onOpenChange={setTooltipOpen}>
      <TooltipTrigger
        render={children}
        tabIndex={0}
        onContextMenu={(event) => {
          if (event.defaultPrevented) return;
          event.preventDefault();
          event.stopPropagation();
          const bounds = event.currentTarget.getBoundingClientRect();
          void showMenu(
            event.clientX === 0 && event.clientY === 0
              ? { x: bounds.left, y: bounds.bottom }
              : { x: event.clientX, y: event.clientY },
          );
        }}
        onKeyDown={(event) => {
          if (
            event.defaultPrevented ||
            !(event.key === "ContextMenu" || (event.shiftKey && event.key === "F10"))
          )
            return;
          event.preventDefault();
          event.stopPropagation();
          const bounds = event.currentTarget.getBoundingClientRect();
          void showMenu({ x: bounds.left, y: bounds.bottom });
        }}
      />
      <TooltipPopup variant="code">{tooltip}</TooltipPopup>
    </Tooltip>
  );
}
