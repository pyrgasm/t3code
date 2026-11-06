import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";

import * as AssetSigner from "./AssetSigner.ts";
import * as ServerSecretStore from "../auth/ServerSecretStore.ts";
import * as ServerConfig from "../config.ts";
import * as Orchestrator from "../orchestration-v2/Orchestrator.ts";
import * as ProjectFaviconResolver from "../project/ProjectFaviconResolver.ts";
import * as T3ProjectFileLoader from "../project/T3ProjectFileLoader.ts";
import * as WorkspacePaths from "../workspace/WorkspacePaths.ts";
import { issueAssetUrl } from "./AssetAccess.ts";
import * as NativeAppIconResolver from "./NativeAppIconResolver.ts";

const layerConfig = ServerConfig.ServerConfig.layerTest(process.cwd(), {
  prefix: "t3-asset-file-path-test-",
});

const layerTest = Layer.mergeAll(
  Layer.mock(Orchestrator.OrchestratorV2)({}),
  layerConfig,
  WorkspacePaths.layer,
  ProjectFaviconResolver.layer.pipe(
    Layer.provide(WorkspacePaths.layer),
    Layer.provide(T3ProjectFileLoader.layer),
  ),
  NativeAppIconResolver.layer.pipe(Layer.provide(layerConfig)),
  AssetSigner.layer.pipe(
    Layer.provideMerge(ServerSecretStore.layer.pipe(Layer.provide(layerConfig))),
  ),
).pipe(Layer.provideMerge(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer)));

// Show in Explorer and Open with default app need the host file behind each media asset.
describe("asset URLs name their host file", () => {
  it.effect("for attachments, media files and workspace files", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const config = yield* ServerConfig.ServerConfig;

      yield* fs.makeDirectory(config.attachmentsDir, { recursive: true });
      const attachmentPath = path.join(config.attachmentsDir, "thread-1-pasted.png");
      yield* fs.writeFileString(attachmentPath, "png");
      const attachment = yield* issueAssetUrl({
        resource: { _tag: "attachment", attachmentId: "thread-1-pasted" },
      });
      expect(attachment.filePath).toBe(attachmentPath);

      const root = yield* fs.makeTempDirectoryScoped({ prefix: "t3-file-path-root-" });
      const outside = yield* fs.makeTempDirectoryScoped({ prefix: "t3-file-path-outside-" });
      const mediaPath = path.join(outside, "recording.mp4");
      yield* fs.writeFileString(mediaPath, "mp4");
      const media = yield* issueAssetUrl({
        resource: { _tag: "media-file", threadId: ThreadId.make("thread-1"), path: mediaPath },
        workspaceRoot: root,
      });
      expect(media.filePath).toBe(yield* fs.realPath(mediaPath));

      yield* fs.writeFileString(path.join(root, "shot.png"), "png");
      const workspace = yield* issueAssetUrl({
        resource: { _tag: "workspace-file", threadId: ThreadId.make("thread-1"), path: "shot.png" },
        workspaceRoot: root,
      });
      expect(workspace.filePath).toBe(yield* fs.realPath(path.join(root, "shot.png")));
    }).pipe(Effect.provide(layerTest)),
  );
});
