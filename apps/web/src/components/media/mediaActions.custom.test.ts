// @effect-diagnostics nodeBuiltinImport:off - reads the upstream files that carry the wiring.
import * as NodeFS from "node:fs";
import { ThreadId, TurnItemId, type ServerConfig } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { isHostFileResource, mediaHostActions, mediaMenuItems } from "./mediaMenu.logic";

const read = (path: string) => NodeFS.readFileSync(new URL(path, import.meta.url), "utf8");

const windowsHost = {
  availableEditors: ["file-manager"],
  shellRevealInFileManager: true,
  shellRevealInFileManagerKind: "file-explorer",
  environment: { platform: { os: "windows" } },
} as unknown as ServerConfig;

const menu = (overrides: Partial<Parameters<typeof mediaMenuItems>[0]> = {}) =>
  mediaMenuItems({
    kind: "video",
    reference: { kind: "file", path: "C:/shots/clip.mp4" },
    host: { revealLabel: "Reveal in File Explorer" },
    canExpand: true,
    canOpenFile: false,
    canReadMedia: true,
    unavailable: false,
    canCopyImage: true,
    ...overrides,
  }).map((item) => item.id);

describe("media host actions", () => {
  it("offer reveal and default app only for a local server with a file manager", () => {
    expect(mediaHostActions({ config: windowsHost, canOperate: true, localExec: true })).toEqual({
      revealLabel: "Reveal in File Explorer",
    });
    expect(mediaHostActions({ config: windowsHost, canOperate: true, localExec: false })).toBe(
      null,
    );
    expect(mediaHostActions({ config: windowsHost, canOperate: false, localExec: true })).toBe(
      null,
    );
    expect(
      mediaHostActions({
        config: { ...windowsHost, availableEditors: [] },
        canOperate: true,
        localExec: true,
      }),
    ).toBe(null);
    expect(
      mediaHostActions({
        config: { ...windowsHost, shellRevealInFileManager: false },
        canOperate: true,
        localExec: true,
      }),
    ).toEqual({ revealLabel: undefined });
  });

  it("apply to every media that has a file on the host", () => {
    expect(isHostFileResource({ _tag: "attachment", attachmentId: "a" })).toBe(true);
    expect(
      isHostFileResource({ _tag: "media-file", threadId: ThreadId.make("t"), path: "/a.png" }),
    ).toBe(true);
    expect(
      isHostFileResource({
        _tag: "tool-output-image",
        threadId: ThreadId.make("t"),
        itemId: TurnItemId.make("i"),
        index: 0,
      }),
    ).toBe(false);
  });

  it("put preview, reveal, open and save first in the media menu", () => {
    expect(menu()).toEqual(["open-preview", "reveal", "open-default", "save", "copy-full-path"]);
    expect(menu({ kind: "image", canExpand: false })).toEqual([
      "reveal",
      "open-default",
      "save",
      "copy-image",
      "copy-full-path",
    ]);
    expect(menu({ host: null, reference: { kind: "url", url: "https://x.test/a.mp4" } })).toEqual([
      "open-preview",
      "save",
      "copy-url",
    ]);
  });

  it("reach the viewer, inline videos, attachments, linked images and the file viewer", () => {
    expect(read("../chat/ExpandedImageDialog.tsx")).toMatch(/<MediaViewerActions /);
    expect(read("./MediaVideoPlayer.tsx")).toMatch(/const expand = actionsSource\?\.onExpand;/);
    expect(read("../chat/TimelineUserMessageRow.tsx")).toMatch(
      /attachmentImageActionsSource\(ctx\.activeThreadEnvironmentId, image\)/,
    );
    expect(read("../ChatMarkdown.tsx")).toMatch(/expandOnClick=\{expandOnClick\}/);
    expect(read("../files/AttachmentFilePreview.tsx")).toMatch(/hostFile\.revealOnHost/);
    expect(read("../files/FilePreviewPanel.tsx")).toMatch(/actionsSource=\{actionsSource\}/);
  });
});
