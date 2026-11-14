import type { ContextWindowSnapshot } from "@t3tools/client-runtime/state/context-window";
import type { EnvironmentId, ThreadId } from "@t3tools/contracts";
import { memo } from "react";

import { formatContextWindowTokens } from "~/lib/contextWindow";
import { useThreadUsage } from "../../state/threadUsage";
import { Button } from "../ui/button";
import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";
import { formatContextWindowCompactionMessage } from "./compaction.logic";
import { composerFloatingLayerProps } from "./composerEventScope";
import { formatPercent, formatUsd, threadSpend } from "./threadStats.logic";

const RADIUS = 9.75;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/** The composer's context ring and spend, with the model and effort in its popover. */
export const ThreadStatsMeter = memo(function ThreadStatsMeter(props: {
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId | null;
  /** Threads this one delegated to, priced as its subagents. */
  readonly childThreadIds: ReadonlyArray<ThreadId>;
  readonly context: ContextWindowSnapshot | null;
  readonly modelLabel: string | null;
  readonly effortLabel: string | null;
}) {
  const { context, threadId } = props;
  const usage = useThreadUsage(
    threadId === null ? null : props.environmentId,
    threadId === null ? [] : [threadId, ...props.childThreadIds],
  );
  const spend = threadId === null ? null : threadSpend(usage, threadId);
  if (context === null && (spend === null || spend.costUsd === null)) return null;

  const maxTokens = context?.maxTokens != null && context.maxTokens > 0 ? context.maxTokens : null;
  const percent =
    context !== null && maxTokens !== null && context.usedPercentage !== null
      ? Math.max(0, Math.min(100, context.usedPercentage))
      : null;
  const usageColor =
    percent !== null && percent > 90
      ? "var(--color-error)"
      : "color-mix(in oklab, var(--color-muted-foreground) 72%, transparent)";
  const totalCost = spend?.costUsd == null ? null : spend.costUsd + (spend.subagentCostUsd ?? 0);
  const effort = props.effortLabel;
  const label = [
    percent !== null
      ? formatPercent(percent)
      : context !== null
        ? formatContextWindowTokens(context.usedTokens)
        : null,
    totalCost !== null && totalCost > 0 ? formatUsd(totalCost) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={150}
        closeDelay={0}
        render={
          <Button
            size="sm"
            variant="ghost-muted"
            className="shrink-0"
            aria-label={`Context and cost: ${label}`}
          >
            {context !== null ? (
              <svg viewBox="0 0 24 24" className="-rotate-90 size-4 shrink-0" aria-hidden="true">
                <circle
                  cx="12"
                  cy="12"
                  r={RADIUS}
                  fill="none"
                  className="stroke-muted-foreground/24"
                  strokeWidth="3"
                />
                <circle
                  cx="12"
                  cy="12"
                  r={RADIUS}
                  fill="none"
                  stroke={usageColor}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={CIRCUMFERENCE * (1 - (percent ?? 0) / 100)}
                />
              </svg>
            ) : null}
            <span className="text-xs tabular-nums">{label}</span>
          </Button>
        }
      />
      <PopoverPopup
        {...composerFloatingLayerProps}
        tooltipStyle
        side="top"
        align="end"
        padding="none"
        width="sm"
        className="text-left whitespace-normal"
      >
        <div className="flex flex-col gap-2 p-(--floating-content-inset) text-2xs leading-4">
          {props.modelLabel ? (
            <div className="font-medium text-foreground text-xs">
              {props.modelLabel}
              {effort ? <span className="text-muted-foreground"> · {effort}</span> : null}
            </div>
          ) : null}
          {context !== null ? (
            <>
              <StatRow
                label="Context"
                value={
                  maxTokens !== null
                    ? `${formatContextWindowTokens(context.usedTokens)} / ${formatContextWindowTokens(maxTokens)}${percent !== null ? ` · ${formatPercent(percent)}` : ""}`
                    : formatContextWindowTokens(context.usedTokens)
                }
              />
              {percent !== null ? (
                <div
                  className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(percent)}
                  aria-label="Context window usage"
                >
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${percent}%`, backgroundColor: usageColor }}
                  />
                </div>
              ) : null}
            </>
          ) : null}
          {spend?.costUsd != null ? (
            <StatRow label="Cost" value={`≈ ${formatUsd(spend.costUsd)}`} />
          ) : null}
          {spend?.subagentCostUsd != null ? (
            <StatRow label="Subagent threads" value={`≈ ${formatUsd(spend.subagentCostUsd)}`} />
          ) : null}
          {spend !== null && spend.unpricedTurns > 0 ? (
            <div className="text-pretty text-secondary-label">
              {spend.unpricedTurns === 1 ? "1 turn" : `${spend.unpricedTurns} turns`} on a model
              without a known price are not counted.
            </div>
          ) : null}
          {spend?.costUsd != null ? (
            <div className="text-pretty text-secondary-label">
              API list prices for this thread's tokens, built-in subagents included.
            </div>
          ) : null}
          {context?.autoCompactThreshold != null && context.autoCompactThreshold > 0 ? (
            <div className="text-pretty text-secondary-label">
              {formatContextWindowCompactionMessage(context.autoCompactThreshold)}
            </div>
          ) : null}
        </div>
      </PopoverPopup>
    </Popover>
  );
});

function StatRow(props: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-secondary-label">{props.label}</span>
      <span className="font-medium tabular-nums text-secondary-label">{props.value}</span>
    </div>
  );
}
