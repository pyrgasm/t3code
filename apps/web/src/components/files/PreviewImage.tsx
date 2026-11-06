import { lazy, Suspense } from "react";

import type { MediaActionSource } from "../media/MediaActions";

import { FileSurfaceLoading } from "./fileSurfaceChrome";

const PreviewImageContent = lazy(() => import("./PreviewImageContent"));

export function PreviewImage(props: {
  readonly src: string;
  readonly name: string;
  readonly mimeType?: string;
  readonly onError?: () => void;
  /** Lets the full-window preview save, reveal and open the file it shows. */
  readonly actionsSource?: MediaActionSource | undefined;
}) {
  return (
    <Suspense fallback={<FileSurfaceLoading />}>
      <PreviewImageContent {...props} />
    </Suspense>
  );
}
