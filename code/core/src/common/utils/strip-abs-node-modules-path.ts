import path from 'node:path';

import slash from 'slash';

function normalizePath(id: string) {
  return path.posix.normalize(slash(id));
}

// We need to convert from an absolute path, to a traditional node module import path,
// so that vite can correctly pre-bundle/optimize
export function stripAbsNodeModulesPath(absPath: string) {
  // TODO: Evaluate if searching for node_modules in a yarn pnp environment is correct
  const splits = absPath.split(`node_modules${path.sep}`);
  // Return everything after the final "node_modules/"
  const module = normalizePath(splits[splits.length - 1]);
  return module;
}
