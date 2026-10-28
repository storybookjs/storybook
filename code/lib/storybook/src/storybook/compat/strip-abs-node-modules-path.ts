import { normalize } from 'pathe';

/** Turn an absolute path into a bare `node_modules` import path, so Vite can pre-bundle it. */
export function stripAbsNodeModulesPath(absPath: string): string {
  const splits = normalize(absPath).split('node_modules/');
  return splits[splits.length - 1];
}
