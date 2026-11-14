import { ThreadId, type ThreadUsage } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { formatContextUse, formatUsd, subagentStatsLine, threadSpend } from "./threadStats.logic";

const parent = ThreadId.make("parent");
const child = ThreadId.make("child");

const usage = (threadId: ThreadId, overrides: Partial<ThreadUsage> = {}): ThreadUsage => ({
  threadId,
  costUsd: 0,
  unpricedTurns: 0,
  totals: {
    uncachedInputTokens: 0,
    cachedInputTokens: 0,
    cacheCreationTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
  },
  context: null,
  ...overrides,
});

describe("threadSpend", () => {
  it("splits the thread's own spend from its subagent threads'", () => {
    expect(
      threadSpend(
        [
          usage(parent, { costUsd: 1.5, unpricedTurns: 1 }),
          usage(child, { costUsd: 0.25 }),
          usage(ThreadId.make("other-child"), { costUsd: 0.25, unpricedTurns: 2 }),
        ],
        parent,
      ),
    ).toEqual({ costUsd: 1.5, subagentCostUsd: 0.5, unpricedTurns: 3 });
  });

  it("has no subagent spend without subagent threads, and nothing before the answer", () => {
    expect(threadSpend([usage(parent, { costUsd: 2 })], parent).subagentCostUsd).toBeNull();
    expect(threadSpend(null, parent)).toEqual({
      costUsd: null,
      subagentCostUsd: null,
      unpricedTurns: 0,
    });
  });
});

describe("formatting", () => {
  it.each([
    [0, "$0"],
    [0.0042, "$0.004"],
    [1.234, "$1.23"],
    [1234.5, "$1,235"],
  ])("formats %s as %s", (amount, expected) => {
    expect(formatUsd(amount)).toBe(expected);
  });

  it("shows context against the window when the window is known", () => {
    expect(formatContextUse({ usedTokens: 42_000, maxTokens: 200_000 })).toBe("42k / 200k (21%)");
    expect(formatContextUse({ usedTokens: 4_200, maxTokens: 1_000_000 })).toBe("4.2k / 1m (0.4%)");
    expect(formatContextUse({ usedTokens: 42_000, maxTokens: null })).toBe("42k");
  });

  it("builds a subagent line from whatever is known", () => {
    expect(
      subagentStatsLine({
        modelLabel: "Haiku 4.5",
        effort: "xhigh",
        usage: usage(child, { costUsd: 0.04, context: { usedTokens: 12_000, maxTokens: null } }),
      }),
    ).toBe("Haiku 4.5 · Extra high · 12k ctx · $0.04");
    expect(subagentStatsLine({ modelLabel: "Sonnet 4.6", effort: null, usage: null })).toBe(
      "Sonnet 4.6",
    );
    expect(subagentStatsLine({ modelLabel: null, effort: null, usage: null })).toBe("");
  });
});
