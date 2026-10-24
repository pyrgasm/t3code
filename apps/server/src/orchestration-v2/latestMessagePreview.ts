import {
  MessageId,
  type OrchestrationV2LatestVisibleMessageSummary,
  type OrchestrationV2ThreadProjection,
} from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";

// Shell rows stream to every client on every thread event, so the preview
// carries only the opening of a message, never its body.
const PREVIEW_MAX_CHARS = 200;
// The SQL read cuts the text at this many characters before it leaves SQLite;
// the in-memory read cuts at the same point so both shells agree.
export const PREVIEW_SOURCE_CHARS = 600;

export function messagePreviewText(text: string): string {
  return text
    .slice(0, PREVIEW_SOURCE_CHARS)
    .replace(/```\w*/g, " ")
    .replace(/[`*]+/g, "")
    .replace(/^\s*(?:#+|>|[-+]|\d+\.)\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, PREVIEW_MAX_CHARS);
}

type ProjectionMessage = OrchestrationV2ThreadProjection["messages"][number];

// Mirrors the latest_visible_message_json subquery in ProjectionStore's shell read.
// A rollback keeps the undone run's messages stored, so they are skipped here.
function isPreviewCandidate(
  message: ProjectionMessage,
  rolledBackRunIds: ReadonlySet<string>,
): boolean {
  return (
    !message.streaming &&
    (message.runId === null || !rolledBackRunIds.has(message.runId)) &&
    message.workflowScript !== true &&
    message.text.trim() !== "" &&
    (message.role === "assistant" || (message.role === "user" && message.createdBy === "user"))
  );
}

export function latestVisibleMessageFromProjection(
  projection: Pick<OrchestrationV2ThreadProjection, "messages" | "runs">,
): OrchestrationV2LatestVisibleMessageSummary | null {
  const rolledBackRunIds = new Set<string>(
    projection.runs.filter((run) => run.status === "rolled_back").map((run) => run.id),
  );
  let latest: ProjectionMessage | null = null;
  for (const message of projection.messages) {
    if (!isPreviewCandidate(message, rolledBackRunIds)) continue;
    if (
      latest === null ||
      DateTime.toEpochMillis(message.createdAt) > DateTime.toEpochMillis(latest.createdAt) ||
      (DateTime.toEpochMillis(message.createdAt) === DateTime.toEpochMillis(latest.createdAt) &&
        message.id > latest.id)
    ) {
      latest = message;
    }
  }
  return latest === null
    ? null
    : {
        id: latest.id,
        role: latest.role,
        text: messagePreviewText(latest.text),
        updatedAt: latest.updatedAt,
      };
}

export function latestVisibleMessageFromRow(
  json: string | null,
): OrchestrationV2LatestVisibleMessageSummary | null {
  if (json === null) return null;
  const row = JSON.parse(json) as {
    readonly id: string;
    readonly role: "user" | "assistant";
    readonly text: string;
    readonly updatedAt: string;
  };
  return {
    id: MessageId.make(row.id),
    role: row.role,
    text: messagePreviewText(row.text),
    updatedAt: DateTime.makeUnsafe(row.updatedAt),
  };
}
