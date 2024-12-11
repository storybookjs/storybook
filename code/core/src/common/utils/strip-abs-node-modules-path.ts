import { join, posix, sep } from 'node:path';

import slash from 'slash';

function normalizePath(id: string) {
  return posix.normalize(slash(id));
}

// We need to convert from an absolute path, to a traditional node module import path,
// so that vite can correctly pre-bundle/optimize
export function stripAbsNodeModulesPath(absPath: string) {
  // If the environment is a yarn pnp node_linker=pnpm environment, we don't want to strip the path
  if (absPath.includes(join('node_modules', '.cache'))) {
    return absPath;
  }
  // TODO: Evaluate if searching for node_modules in a yarn pnp environment is correct
  const splits = absPath.split(`node_modules${sep}`);
  // Return everything after the final "node_modules/"
  const module = normalizePath(splits[splits.length - 1]);
  return module;
}
