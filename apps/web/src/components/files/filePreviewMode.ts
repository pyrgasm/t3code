import { workspaceRelativeFilePath } from "@t3tools/client-runtime/markdown-links";
import type { ProjectReadFileError } from "@t3tools/contracts";
import { isAbsolutePath } from "~/terminal-links";

/** Resolve workspace links before choosing between the explorer and a file preview. */
export function resolveFilePreviewPath(path: string | null, cwd: string): string | null {
  if (path === null) return null;
  return path === "." || workspaceRelativeFilePath(path, cwd) === "." ? null : path;
}

export const isMarkdownPreviewFile = (path: string): boolean => /\.(?:md|mdx)$/i.test(path);

/** Describe existing failure codes without exposing the underlying platform cause. */
export function filePreviewReadErrorMessage(error: ProjectReadFileError): string {
  switch (error.failure) {
    case "path_not_file":
      return "The path is a directory or special file, not a regular file.";
    case "binary_file":
      return "The file is binary and cannot be displayed as text.";
    case "workspace_path_outside_root":
      return "The requested path is outside the workspace.";
    case "resolved_path_outside_root":
      return "The path resolves to a location outside the workspace.";
    case "operation_failed":
      // A realpath failure can mean a missing path, permissions, or another I/O error.
      return error.operation === "realpath-workspace-root"
        ? "The workspace folder could not be accessed."
        : "The file could not be accessed or read. It may be missing or inaccessible.";
    default:
      return error.message;
  }
}

export function shouldShowFileExplorer(input: {
  readonly relativePath: string | null;
  readonly explorerOpen: boolean;
  readonly attachmentOpen: boolean;
}): boolean {
  if (input.attachmentOpen) {
    return false;
  }
  return input.explorerOpen || input.relativePath === null;
}

const withDriveRoot = (path: string): string => (/^[A-Za-z]:$/.test(path) ? `${path}\\` : path);

/** The folder the tree browses for a host path outside the workspace: a folder
    itself, or the folder holding a file. */
export function hostBrowseRoot(path: string, isDirectory: boolean): string {
  const trimmed = path.length > 1 ? path.replace(/[\\/]+$/, "") : path;
  if (isDirectory) return withDriveRoot(trimmed);
  const cut = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  if (cut <= 0) return "/";
  return withDriveRoot(trimmed.slice(0, cut));
}

/** A tree entry path ('/'-separated, relative to the browse root) as a host path. */
export function joinHostPath(root: string, entryPath: string): string {
  const separator = root.includes("\\") || /^[A-Za-z]:/.test(root) ? "\\" : "/";
  return `${root.replace(/[\\/]+$/, "")}${separator}${entryPath.split("/").join(separator)}`;
}

/** A host path inside the browse root as a tree entry path. */
export function hostTreePath(root: string, path: string): string {
  return path
    .slice(root.replace(/[\\/]+$/, "").length)
    .replace(/^[\\/]+/, "")
    .replace(/[\\/]+$/, "")
    .replaceAll("\\", "/");
}

export function setMarkdownTaskChecked(
  markdown: string,
  markerOffset: number,
  checked: boolean,
): string {
  if (
    markerOffset < 0 ||
    markdown[markerOffset] !== "[" ||
    !/[ xX]/.test(markdown[markerOffset + 1] ?? "") ||
    markdown[markerOffset + 2] !== "]"
  ) {
    return markdown;
  }

  return `${markdown.slice(0, markerOffset + 1)}${checked ? "x" : " "}${markdown.slice(markerOffset + 2)}`;
}
