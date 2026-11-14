import {
  type ThreadId,
  type ThreadUsage,
  type ThreadUsageResult,
  UsageReadError,
  type UsageTokenTotals,
} from "@t3tools/contracts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import {
  type ThreadContextUsageRow,
  type ThreadTurnUsageRow,
  ProjectionStoreV2,
} from "../orchestration-v2/ProjectionStore.ts";
import { priceUsage, type RateTable } from "./usagePricing.ts";
import { UsageService } from "./UsageService.ts";

const ZERO_TOTALS: UsageTokenTotals = {
  uncachedInputTokens: 0,
  cachedInputTokens: 0,
  cacheCreationTokens: 0,
  outputTokens: 0,
  reasoningTokens: 0,
};

const count = (value: number) => Math.max(0, Math.round(value));

function rowTotals(row: ThreadTurnUsageRow): UsageTokenTotals {
  // Input counts cache reads and writes; the ledger's extra input only has a total, so it takes
  // the main agent's cache split.
  const cachedShare = row.inputTokens > 0 ? row.cachedInputTokens / row.inputTokens : 0;
  const writeShare = row.inputTokens > 0 ? row.cacheCreationTokens / row.inputTokens : 0;
  const cachedInputTokens = row.cachedInputTokens + row.otherInputTokens * cachedShare;
  const cacheCreationTokens = row.cacheCreationTokens + row.otherInputTokens * writeShare;
  const inputTokens = row.inputTokens + row.otherInputTokens;
  return {
    uncachedInputTokens: count(inputTokens - cachedInputTokens - cacheCreationTokens),
    cachedInputTokens: count(cachedInputTokens),
    cacheCreationTokens: count(cacheCreationTokens),
    outputTokens: count(row.outputTokens + row.otherOutputTokens),
    reasoningTokens: count(row.reasoningTokens),
  };
}

function addTotals(left: UsageTokenTotals, right: UsageTokenTotals): UsageTokenTotals {
  return {
    uncachedInputTokens: left.uncachedInputTokens + right.uncachedInputTokens,
    cachedInputTokens: left.cachedInputTokens + right.cachedInputTokens,
    cacheCreationTokens: left.cacheCreationTokens + right.cacheCreationTokens,
    outputTokens: left.outputTokens + right.outputTokens,
    reasoningTokens: left.reasoningTokens + right.reasoningTokens,
  };
}

/** Prices each thread's turns at list rates. Threads with neither turns nor context are left out. */
export function priceThreadUsage(input: {
  readonly threadIds: ReadonlyArray<ThreadId>;
  readonly turns: ReadonlyArray<ThreadTurnUsageRow>;
  readonly contexts: ReadonlyArray<ThreadContextUsageRow>;
  readonly rates: RateTable;
  readonly overrides: RateTable;
}): ThreadUsageResult {
  const threads = new Map<ThreadId, ThreadUsage>();
  const entry = (threadId: ThreadId): ThreadUsage =>
    threads.get(threadId) ?? {
      threadId,
      costUsd: 0,
      unpricedTurns: 0,
      totals: ZERO_TOTALS,
      context: null,
    };
  for (const row of input.turns) {
    const current = entry(row.threadId);
    const totals = rowTotals(row);
    const priced =
      row.model === null
        ? null
        : priceUsage(
            input.rates,
            { model: row.model, totals, speed: "standard", reportedCostUsd: null },
            input.overrides,
          );
    const costUsd = priced === null || priced.costSource === "unpriced" ? null : priced.costUsd;
    const unpriced = costUsd === null;
    threads.set(row.threadId, {
      ...current,
      costUsd: current.costUsd + (costUsd ?? 0),
      unpricedTurns: current.unpricedTurns + (unpriced ? row.turns : 0),
      totals: addTotals(current.totals, totals),
    });
  }
  for (const row of input.contexts) {
    threads.set(row.threadId, {
      ...entry(row.threadId),
      context: { usedTokens: count(row.usedTokens), maxTokens: row.maxTokens },
    });
  }
  return { threads: input.threadIds.flatMap((id) => threads.get(id) ?? []) };
}

export class ThreadUsageService extends Context.Service<
  ThreadUsageService,
  {
    readonly read: (
      threadIds: ReadonlyArray<ThreadId>,
    ) => Effect.Effect<ThreadUsageResult, UsageReadError>;
  }
>()("t3/usage/ThreadUsage/ThreadUsageService") {}

const make = Effect.gen(function* () {
  const usage = yield* UsageService;
  const projections = yield* ProjectionStoreV2;

  const read = Effect.fn("ThreadUsageService.read")(function* (threadIds: ReadonlyArray<ThreadId>) {
    const unique = [...new Set(threadIds)];
    const [{ turns, contexts }, tables] = yield* Effect.all(
      [
        projections.getThreadUsageRows(unique).pipe(
          Effect.mapError(
            (cause) =>
              new UsageReadError({
                reason: "scanFailed",
                detail: "Thread usage could not be read.",
                cause,
              }),
          ),
        ),
        usage.priceTables,
      ],
      { concurrency: 2 },
    );
    return priceThreadUsage({ threadIds: unique, turns, contexts, ...tables });
  });

  return { read } as const;
});

export const layer = Layer.effect(ThreadUsageService, make);
