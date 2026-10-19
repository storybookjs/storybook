import { posix, sep } from 'node:path';

// eslint-disable-next-line depend/ban-dependencies
import slash from 'slash';

function normalizePath(id: string) {
  return posix.normalize(slash(id));
}

// We need to convert from an absolute path, to a traditional node module import path,
// so that vite can correctly pre-bundle/optimize
export function stripAbsNodeModulesPath(absPath: string) {
  const splits = absPath.split(`node_modules${sep}`);
  // Return everything after the final "node_modules/"
  return normalizePath(splits[splits.length - 1]);
}
