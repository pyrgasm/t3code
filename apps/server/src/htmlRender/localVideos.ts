// Local videos inline like images, so a card keeps playing after the clip moves.
// They have no size limit: the user would rather wait for a big card than lose the clip.
export const VIDEO_MIME_TYPES: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
};

export const isVideoPath = (path: string) =>
  Object.hasOwn(VIDEO_MIME_TYPES, path.slice(path.lastIndexOf(".") + 1).toLowerCase());

// Validated by bytes, like images: MP4 and QuickTime open with a box whose type
// sits at byte 4, WebM with the EBML magic.
export const isVideoBytes = (bytes: Uint8Array) => {
  const head = String.fromCharCode(...bytes.subarray(0, 8));
  return (
    /^(?:ftyp|moov|mdat|wide|free|skip)$/.test(head.slice(4, 8)) ||
    head.startsWith("\x1a\x45\xdf\xa3")
  );
};
