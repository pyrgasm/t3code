import { useAtomValue } from "@effect/atom-react";
import { AuthOrchestrationOperateScope, type EnvironmentId } from "@t3tools/contracts";
import * as Option from "effect/Option";
import { Atom } from "effect/reactivity";

import { remoteOpenResolutionAtom } from "../../remoteOpen";
import { serverEnvironment } from "../../state/server";
import { environmentSession, sessionHasScope } from "../../state/session";
import { mediaHostActions, type MediaHostActions } from "./mediaMenu.logic";

// Config pushes arrive with every provider status change; keep equal results so media stays put.
export const mediaHostActionsAtom = Atom.family((environmentId: EnvironmentId) =>
  Atom.make((get): MediaHostActions | null => {
    const remoteOpen = get(remoteOpenResolutionAtom(environmentId));
    const next = mediaHostActions({
      config: get(serverEnvironment.configValueAtom(environmentId)),
      canOperate: sessionHasScope(
        get(environmentSession.sessionStateAtom(environmentId)),
        AuthOrchestrationOperateScope,
      ),
      localExec: remoteOpen.isResolved && remoteOpen.state.mode === "local-exec",
    });
    const previous = Option.getOrNull(get.self<MediaHostActions | null>());
    return previous !== null && next !== null && previous.revealLabel === next.revealLabel
      ? previous
      : next;
  }).pipe(Atom.withLabel("media-host-actions")),
);

const NO_MEDIA_HOST_ACTIONS = Atom.make<MediaHostActions | null>(null);

export function useMediaHostActions(environmentId: EnvironmentId | null): MediaHostActions | null {
  return useAtomValue(
    environmentId === null ? NO_MEDIA_HOST_ACTIONS : mediaHostActionsAtom(environmentId),
  );
}
