import type { EnvironmentId, ThreadId, ThreadUsage } from "@t3tools/contracts";

import { useEnvironmentQuery } from "./query";
import { serverEnvironment } from "./server";

/** Spend and context of the given threads, null until the environment answers. */
export function useThreadUsage(
  environmentId: EnvironmentId | null,
  threadIds: ReadonlyArray<ThreadId>,
): ReadonlyArray<ThreadUsage> | null {
  const { data } = useEnvironmentQuery(
    environmentId === null || threadIds.length === 0
      ? null
      : serverEnvironment.threadUsage({ environmentId, input: { threadIds: [...threadIds] } }),
  );
  return data?.threads ?? null;
}
