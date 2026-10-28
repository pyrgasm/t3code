import { FolderTreeIcon } from "lucide-react";

import { updateClientSettings, useBoringSidebarEnabled } from "../../hooks/useSettings";
import { SidebarHeaderIconButton } from "./SidebarThreadHeader";

// Same patch as the Labs "Boring sidebar" switch, which also clears the removed legacy opt-in.
export function projectFolderTogglePatch(enabled: boolean) {
  return { boringSidebarEnabled: !enabled, legacySidebarEnabled: false };
}

export function ProjectFolderToggle() {
  const enabled = useBoringSidebarEnabled();
  return (
    <SidebarHeaderIconButton
      label={enabled ? "Stop grouping by project" : "Group threads into project folders"}
      aria-pressed={enabled}
      data-active={enabled}
      onClick={() => void updateClientSettings(projectFolderTogglePatch(enabled))}
    >
      <FolderTreeIcon />
    </SidebarHeaderIconButton>
  );
}
