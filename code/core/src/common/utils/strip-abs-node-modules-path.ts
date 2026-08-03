import { posix, sep } from 'node:path';

// eslint-disable-next-line depend/ban-dependencies
import slash from 'slash';

function normalizePath(id: string) {
  return posix.normalize(slash(id));
}

// We need to convert from an absolute path, to a traditional node module import path,
// so that vite can correctly pre-bundle/optimize
export function stripAbsNodeModulesPath(absPath: string) {
  // Yarn's pnpm linker keeps packages in node_modules/.store/<name>-virtual-<hash>/package.
  // Stripping up to the last node_modules would yield ".store/...", which no bundler resolves,
  // and the mangled directory name makes the package name unrecoverable from the path alone.
  if (slash(absPath).includes('node_modules/.store/')) {
    return absPath;
  }
  // TODO: Evaluate if this is correct after removing pnp compatibility code in SB11
  // TODO: Evaluate if searching for node_modules in a yarn pnp environment is correct
  const splits = absPath.split(`node_modules${sep}`);
  // Return everything after the final "node_modules/"
  return normalizePath(splits[splits.length - 1]);
}
