import type { ThreadId, ThreadUsage } from "@t3tools/contracts";

import { formatContextWindowTokens } from "../../lib/contextWindow";

/** "$1.23", "$0.004" under a cent, "$0" for nothing spent. */
export function formatUsd(amount: number): string {
  if (amount <= 0) return "$0";
  if (amount < 0.01) return `$${amount.toFixed(3)}`;
  if (amount < 1000) return `$${amount.toFixed(2)}`;
  return `$${Math.round(amount).toLocaleString("en-US")}`;
}

export interface ThreadSpend {
  /** This thread's own turns, its native subagents' ledger included. */
  readonly costUsd: number | null;
  /** App-run and Codex subagents that are threads of their own. */
  readonly subagentCostUsd: number | null;
  readonly unpricedTurns: number;
}

/** Splits a usage answer for a thread and its child threads into own and subagent spend. */
export function threadSpend(
  usage: ReadonlyArray<ThreadUsage> | null,
  threadId: ThreadId,
): ThreadSpend {
  if (usage === null) return { costUsd: null, subagentCostUsd: null, unpricedTurns: 0 };
  let costUsd = 0;
  let subagentCostUsd: number | null = null;
  let unpricedTurns = 0;
  for (const thread of usage) {
    unpricedTurns += thread.unpricedTurns;
    if (thread.threadId === threadId) costUsd += thread.costUsd;
    else subagentCostUsd = (subagentCostUsd ?? 0) + thread.costUsd;
  }
  return { costUsd, subagentCostUsd, unpricedTurns };
}

/** "42k / 200k (21%)", or the token count alone when the window size is unknown. */
export function formatContextUse(context: {
  readonly usedTokens: number;
  readonly maxTokens: number | null;
}): string {
  const used = formatContextWindowTokens(context.usedTokens);
  if (context.maxTokens === null || context.maxTokens <= 0) return used;
  const percent = Math.min(100, (context.usedTokens / context.maxTokens) * 100);
  return `${used} / ${formatContextWindowTokens(context.maxTokens)} (${formatPercent(percent)})`;
}

export function formatPercent(value: number): string {
  return value < 10 ? `${value.toFixed(1).replace(/\.0$/, "")}%` : `${Math.round(value)}%`;
}

const EFFORT_LABELS: Record<string, string> = {
  xhigh: "Extra high",
  max: "Max",
  ultrathink: "Ultrathink",
};

function formatEffort(effort: string | null | undefined): string | null {
  const value = effort?.trim();
  if (!value) return null;
  return EFFORT_LABELS[value] ?? value.charAt(0).toUpperCase() + value.slice(1);
}

/** One dim line for a subagent row: "Haiku 4.5 · High · 12k ctx · $0.04". */
export function subagentStatsLine(input: {
  readonly modelLabel: string | null;
  readonly effort: string | null;
  readonly usage: ThreadUsage | null;
}): string {
  const parts = [input.modelLabel, formatEffort(input.effort)];
  if (input.usage?.context) {
    parts.push(`${formatContextWindowTokens(input.usage.context.usedTokens)} ctx`);
  }
  if (input.usage && input.usage.costUsd > 0) parts.push(formatUsd(input.usage.costUsd));
  return parts.filter(Boolean).join(" · ");
}
