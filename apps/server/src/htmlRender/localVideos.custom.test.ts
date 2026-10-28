import * as NodeServices from "@effect/platform-node/NodeServices";
import { describe, expect, it } from "@effect/vitest";
import * as McpProviderSessions from "@t3tools/provider-core/server/McpProviderSessions";
import * as Effect from "effect/Effect";
import * as Base64 from "effect/encoding/Base64";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";

import * as ServerConfig from "../config.ts";
import * as PreviewBrowser from "../preview/PreviewBrowser.ts";
import * as HtmlRender from "./HtmlRender.ts";

const layerTest = HtmlRender.layer.pipe(
  Layer.provide(
    Layer.succeed(
      PreviewBrowser.PreviewBrowser,
      PreviewBrowser.PreviewBrowser.of({
        executable: Effect.die("This test has no preview browser."),
        installed: Effect.succeedNone,
      }),
    ),
  ),
  Layer.provideMerge(McpProviderSessions.layer),
  Layer.provideMerge(ServerConfig.layerTest(process.cwd(), { prefix: "t3-html-videos-" })),
  Layer.provideMerge(NodeServices.layer),
);

// Past both the 10 MiB image limit and the 25 MiB page limit.
const MP4 = new Uint8Array(26 * 1024 * 1024);
MP4.set([0, 0, 0, 0x20, ...new TextEncoder().encode("ftypisom")]);
const WEBM = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81]);

describe("HtmlRender local videos", () => {
  it.effect("inlines local videos of any size and refuses files that are not video", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const htmlRender = yield* HtmlRender.HtmlRender;
      const directory = yield* fileSystem.makeTempDirectoryScoped({ prefix: "t3-html-videos-" });
      const mp4 = path.join(directory, "before.mp4");
      const webm = path.join(directory, "after.webm");
      yield* fileSystem.writeFile(mp4, MP4);
      yield* fileSystem.writeFile(webm, WEBM);

      const prepared = yield* htmlRender.prepare(
        `<video muted controls src="${mp4}"></video><video><source src='${webm}'></video>`,
      );

      expect(prepared).toContain(`src="data:video/mp4;base64,${Base64.encode(MP4)}"`);
      expect(prepared).toContain(`src='data:video/webm;base64,${Base64.encode(WEBM)}'`);
      expect(prepared).not.toContain(directory);

      const secret = path.join(directory, "secret.mp4");
      yield* fileSystem.writeFileString(secret, "API_KEY=abc123 and more text");
      const error = yield* htmlRender.prepare(`<video src="${secret}"></video>`).pipe(Effect.flip);
      expect(error._tag === "HtmlRenderImagesNotFoundError" && error.paths).toEqual([secret]);
    }).pipe(Effect.provide(layerTest)),
  );
});
