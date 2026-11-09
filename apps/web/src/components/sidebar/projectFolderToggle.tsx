import { FolderTreeIcon } from "lucide-react";

import { updateClientSettings, useClientSettings } from "../../hooks/useSettings";
import { SidebarHeaderIconButton } from "./SidebarThreadHeader";

export function projectFolderTogglePatch(enabled: boolean) {
  return { boringSidebarEnabled: !enabled };
}

export function ProjectFolderToggle() {
  const enabled = useClientSettings((settings) => settings.boringSidebarEnabled);
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
