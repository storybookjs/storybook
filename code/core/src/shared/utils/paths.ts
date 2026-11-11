/** Matches a whole `node_modules` path segment, so `src/node_modules-tools/Tag.tsx` is kept. */
const NODE_MODULES_SEGMENT = /(?:^|[/\\])node_modules(?:[/\\]|$)/;

/**
 * Replaces Windows path separators with forward slashes, so paths compare and key consistently
 * across platforms.
 */
export function slash(path: string): string {
  return path.replace(/\\/g, '/');
}

/** Whether the path traverses a `node_modules` directory, on either path separator. */
export function isInNodeModules(path: string): boolean {
  return NODE_MODULES_SEGMENT.test(path);
}
