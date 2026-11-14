import { ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "@effect/vitest";

import type { ThreadTurnUsageRow } from "../orchestration-v2/ProjectionStore.ts";
import { priceThreadUsage } from "./ThreadUsage.ts";
import { createOverrideRateTable } from "./usagePricing.ts";

const parent = ThreadId.make("thread-parent");
const child = ThreadId.make("thread-child");
const idle = ThreadId.make("thread-idle");

// $1/M input, $10/M output, $0.10/M cache read, $2/M cache write.
const rates = createOverrideRateTable({
  "claude-opus-5-5": {
    inputCostPerMillionTokens: 1,
    outputCostPerMillionTokens: 10,
    cacheReadCostPerMillionTokens: 0.1,
    cacheWriteCostPerMillionTokens: 2,
  },
});

const row = (overrides: Partial<ThreadTurnUsageRow>): ThreadTurnUsageRow => ({
  threadId: parent,
  model: "claude-opus-5-5",
  turns: 1,
  inputTokens: 0,
  cachedInputTokens: 0,
  cacheCreationTokens: 0,
  outputTokens: 0,
  reasoningTokens: 0,
  otherInputTokens: 0,
  otherOutputTokens: 0,
  ...overrides,
});

describe("priceThreadUsage", () => {
  it("prices cache reads and writes apart from fresh input and folds in subagent ledger usage", () => {
    const result = priceThreadUsage({
      threadIds: [parent],
      turns: [
        row({
          turns: 3,
          inputTokens: 1_000_000,
          cachedInputTokens: 800_000,
          cacheCreationTokens: 100_000,
          outputTokens: 100_000,
          // Takes the main agent's split: 80% cache reads, 10% writes, 10% fresh.
          otherInputTokens: 1_000_000,
          otherOutputTokens: 100_000,
        }),
      ],
      contexts: [],
      rates,
      overrides: new Map(),
    });
    const [thread] = result.threads;
    expect(thread?.totals).toEqual({
      uncachedInputTokens: 200_000,
      cachedInputTokens: 1_600_000,
      cacheCreationTokens: 200_000,
      outputTokens: 200_000,
      reasoningTokens: 0,
    });
    // 0.2 fresh + 0.16 reads + 0.4 writes + 2 output.
    expect(thread?.costUsd).toBeCloseTo(2.76, 6);
    expect(thread?.unpricedTurns).toBe(0);
  });

  it("counts turns on unknown models as unpriced and keeps them out of the cost", () => {
    const result = priceThreadUsage({
      threadIds: [parent],
      turns: [
        row({ inputTokens: 1_000_000 }),
        row({ model: "some-unlisted-model", turns: 2, inputTokens: 5_000_000 }),
        row({ model: null, inputTokens: 5_000_000 }),
      ],
      contexts: [],
      rates,
      overrides: new Map(),
    });
    expect(result.threads[0]?.costUsd).toBeCloseTo(1, 6);
    expect(result.threads[0]?.unpricedTurns).toBe(3);
  });

  it("answers in request order, attaches context, and leaves out threads with nothing to report", () => {
    const result = priceThreadUsage({
      threadIds: [child, idle, parent],
      turns: [row({ threadId: parent, outputTokens: 1_000_000 })],
      contexts: [{ threadId: child, usedTokens: 42_000, maxTokens: 200_000 }],
      rates,
      overrides: new Map(),
    });
    expect(result.threads.map((thread) => thread.threadId)).toEqual([child, parent]);
    expect(result.threads[0]).toMatchObject({
      costUsd: 0,
      context: { usedTokens: 42_000, maxTokens: 200_000 },
    });
    expect(result.threads[1]).toMatchObject({ costUsd: 10, context: null });
  });

  it("prefers the user's price override over list rates", () => {
    const result = priceThreadUsage({
      threadIds: [parent],
      turns: [row({ outputTokens: 1_000_000 })],
      contexts: [],
      rates,
      overrides: createOverrideRateTable({
        "claude-opus-5-5": { inputCostPerMillionTokens: 1, outputCostPerMillionTokens: 30 },
      }),
    });
    expect(result.threads[0]?.costUsd).toBeCloseTo(30, 6);
  });
});
