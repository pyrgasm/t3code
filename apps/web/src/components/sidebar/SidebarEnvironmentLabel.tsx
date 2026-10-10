import { resolveEnvironmentMachineKind } from "@t3tools/contracts";
import { useParams } from "@tanstack/react-router";

import { useComposerDraftStore } from "../../composerDraftStore";
import { cn } from "../../lib/utils";
import { useEnvironment, usePrimaryEnvironmentId } from "../../state/environments";
import { resolveThreadRouteTarget } from "../../threadRoutes";
import { EnvironmentMachineIcon } from "../EnvironmentMachineIcon";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

/** Which machine the open thread (or, with none open, this app) runs on: "Local" or the
    environment's name. Renders nothing when there is no environment to name. */
export function SidebarEnvironmentLabel({ onBackdrop }: { onBackdrop: boolean }) {
  const routeTarget = useParams({
    strict: false,
    select: (params) => resolveThreadRouteTarget(params),
  });
  const draftEnvironmentId = useComposerDraftStore((store) =>
    routeTarget?.kind === "draft"
      ? (store.getDraftSession(routeTarget.draftId)?.environmentId ?? null)
      : null,
  );
  const primaryEnvironmentId = usePrimaryEnvironmentId();
  const environmentId =
    (routeTarget?.kind === "server" ? routeTarget.threadRef.environmentId : draftEnvironmentId) ??
    primaryEnvironmentId;
  const environment = useEnvironment(environmentId);
  if (environment === null) return null;

  const isLocal = environment.environmentId === primaryEnvironmentId;
  const label = isLocal ? "Local" : environment.label;

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className={cn(
              "relative z-10 flex h-6 min-w-0 items-center gap-1 text-xs",
              onBackdrop ? "text-white/70" : "text-muted-foreground",
            )}
          />
        }
      >
        <EnvironmentMachineIcon
          aria-hidden
          kind={resolveEnvironmentMachineKind(environment.serverConfig)}
          className="size-3 shrink-0"
        />
        <span className="truncate">{label}</span>
      </TooltipTrigger>
      <TooltipPopup side="bottom">
        {isLocal ? `This PC (${environment.label})` : `Running on ${environment.label}`}
      </TooltipPopup>
    </Tooltip>
  );
}
