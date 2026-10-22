// The resume Compact chip starts off ("Full"): a thread keeps its full history unless its key is in
// the set of threads the user switched to Compact.

export function keepsFullHistory(compactThreadKeys: ReadonlySet<string>, threadKey: string) {
  return !compactThreadKeys.has(threadKey);
}

export function withKeepFullHistory(
  compactThreadKeys: ReadonlySet<string>,
  threadKey: string,
  keep: boolean,
): ReadonlySet<string> {
  if (keepsFullHistory(compactThreadKeys, threadKey) === keep) return compactThreadKeys;
  const next = new Set(compactThreadKeys);
  if (keep) next.delete(threadKey);
  else next.add(threadKey);
  return next;
}
