// @effect-diagnostics nodeBuiltinImport:off - reads the upstream file the labels are mounted in.
import * as NodeFS from "node:fs";
import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import {
  CreatedAndLastTime,
  hasThreadPreview,
  RemoteMachineName,
  ThreadPreview,
} from "./customRowLabels";

const threadRow = NodeFS.readFileSync(new URL("./SidebarThreadRow.tsx", import.meta.url), "utf8");

describe("remote thread row machine name", () => {
  it("names the machine beside the remote icon", () => {
    expect(threadRow).toMatch(/<RemoteMachineName label=\{props\.environmentLabel\} \/>/);
    expect(renderToStaticMarkup(<RemoteMachineName label="pc2" />)).toContain(">pc2</span>");
    expect(renderToStaticMarkup(<RemoteMachineName label={null} />)).toBe("");
  });
});

describe("thread row message preview", () => {
  it("replaces the branch line with the last message, or the error that stopped the thread", () => {
    expect(threadRow).toMatch(
      /\{showsPreview \? \(\s*<ThreadPreview message=\{previewMessage\} error=\{previewError\} \/>/,
    );
    expect(threadRow).toMatch(/previewMessage = thread\.source\.latestVisibleMessage/);

    const reply = { role: "assistant", text: "Storm shrinks in 90s." };
    const error = { text: "Usage limit reached", usageLimit: true };
    expect(hasThreadPreview(null, null)).toBe(false);
    expect(hasThreadPreview({ role: "assistant", text: "" }, null)).toBe(false);
    expect(hasThreadPreview(reply, null)).toBe(true);
    expect(hasThreadPreview(null, error)).toBe(true);

    const text = (node: ReactElement) => renderToStaticMarkup(node).replace(/<[^>]+>/g, "");
    expect(text(<ThreadPreview message={{ role: "user", text: "Fix loot" }} error={null} />)).toBe(
      "You: Fix loot",
    );
    expect(text(<ThreadPreview message={reply} error={error} />)).toBe("Usage limit reached");
  });
});

describe("thread row created time", () => {
  it("shows the creation age before the last-message time", () => {
    expect(threadRow).toMatch(
      /<CreatedAndLastTime\s+created=\{<RelativeTimeLabel timestamp=\{thread\.createdAt\} \/>\}/,
    );
    const html = renderToStaticMarkup(<CreatedAndLastTime created="2d" last="15h" />);
    expect(html.replace(/<[^>]+>/g, "")).toBe("Created: 2d•15h");
  });
});
