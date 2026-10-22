// @effect-diagnostics nodeBuiltinImport:off - reads the upstream file the labels are mounted in.
import * as NodeFS from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { CreatedAndLastTime, RemoteMachineName } from "./customRowLabels";

const threadRow = NodeFS.readFileSync(new URL("./SidebarThreadRow.tsx", import.meta.url), "utf8");

describe("remote thread row machine name", () => {
  it("names the machine beside the remote icon", () => {
    expect(threadRow).toMatch(/<RemoteMachineName label=\{props\.environmentLabel\} \/>/);
    expect(renderToStaticMarkup(<RemoteMachineName label="pc2" />)).toContain(">pc2</span>");
    expect(renderToStaticMarkup(<RemoteMachineName label={null} />)).toBe("");
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
