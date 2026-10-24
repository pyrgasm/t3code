import { assert, describe, it } from "@effect/vitest";
import {
  EventId,
  MessageId,
  type ModelSelection,
  ProjectId,
  ProviderInstanceId,
  ThreadId,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import * as SqlitePersistence from "../persistence/Sqlite.ts";
import { messagePreviewText } from "./latestMessagePreview.ts";
import * as ProjectionStore from "./ProjectionStore.ts";

const layerTest = ProjectionStore.layer.pipe(Layer.provideMerge(SqlitePersistence.layerMemory));
const modelSelection = {
  instanceId: ProviderInstanceId.make("codex"),
  model: "gpt-5.4",
} satisfies ModelSelection;

describe("thread row message preview text", () => {
  it("reads as one plain line", () => {
    assert.equal(
      messagePreviewText(
        "## Done\n\n- Fixed the **round timer** in `Game.verse`\n- Next: leaderboard",
      ),
      "Done Fixed the round timer in Game.verse Next: leaderboard",
    );
    assert.equal(messagePreviewText("```verse\nOnBegin()\n```"), "OnBegin()");
    assert.equal(messagePreviewText("x".repeat(1_000)).length, 200);
  });
});

it.layer(layerTest)("thread shell message preview", (it) => {
  it.effect("is the newest finished message you or the agent wrote, from SQL and memory", () =>
    Effect.gen(function* () {
      const projectionStore = yield* ProjectionStore.ProjectionStoreV2;
      const threadId = ThreadId.make("thread:preview");
      const start = DateTime.makeUnsafe("2026-10-24T10:00:00.000Z");
      yield* projectionStore.apply({
        id: EventId.make("event:preview:thread"),
        type: "thread.created",
        threadId,
        occurredAt: start,
        payload: {
          createdBy: "user",
          creationSource: "web",
          id: threadId,
          projectId: ProjectId.make("project:preview"),
          title: "Preview",
          providerInstanceId: modelSelection.instanceId,
          modelSelection,
          runtimeMode: "full-access",
          interactionMode: "default",
          branch: null,
          worktreePath: null,
          activeProviderThreadId: null,
          lineage: { parentThreadId: null, relationshipToParent: null, rootThreadId: threadId },
          forkedFrom: null,
          createdAt: start,
          updatedAt: start,
          archivedAt: null,
          settledOverride: null,
          settledAt: null,
          lastVisitedAt: null,
          deletedAt: null,
        },
      });

      let minute = 0;
      const message = (input: {
        readonly role: "user" | "assistant";
        readonly text: string;
        readonly createdBy?: "user" | "agent";
        readonly streaming?: boolean;
      }) => {
        minute += 1;
        const at = DateTime.add(start, { minutes: minute });
        const id = MessageId.make(`message:preview:${minute}`);
        return projectionStore
          .apply({
            id: EventId.make(`event:preview:message:${minute}`),
            type: "message.updated",
            threadId,
            occurredAt: at,
            payload: {
              createdBy: input.createdBy ?? (input.role === "user" ? "user" : "agent"),
              creationSource: "web",
              id,
              threadId,
              runId: null,
              nodeId: null,
              role: input.role,
              text: input.text,
              attachments: [],
              streaming: input.streaming ?? false,
              createdAt: at,
              updatedAt: at,
            },
          })
          .pipe(Effect.as(id));
      };
      const previews = Effect.gen(function* () {
        const projection = yield* projectionStore.getThreadProjection(threadId);
        const sqlShell = (yield* projectionStore.getShellSnapshot()).threads.find(
          (row) => row.id === threadId,
        )!;
        const memoryShell = ProjectionStore.threadShellFromProjection(projection);
        assert.deepEqual(sqlShell.latestVisibleMessage, memoryShell.latestVisibleMessage);
        return memoryShell.latestVisibleMessage;
      });

      assert.isNull(yield* previews);

      yield* message({ role: "user", text: "Make the  storm\nshrink faster" });
      const reply = yield* message({ role: "assistant", text: "Storm now shrinks in **90s**." });
      yield* message({ role: "assistant", text: "   " });
      yield* message({ role: "user", text: "[scheduled wake]", createdBy: "agent" });
      yield* message({ role: "assistant", text: "Still typ", streaming: true });

      const preview = yield* previews;
      assert.equal(preview?.id, reply);
      assert.equal(preview?.role, "assistant");
      assert.equal(preview?.text, "Storm now shrinks in 90s.");

      const prompt = yield* message({ role: "user", text: "Now the  loot\ntables" });
      const next = yield* previews;
      assert.equal(next?.id, prompt);
      assert.equal(next?.text, "Now the loot tables");
    }),
  );
});
