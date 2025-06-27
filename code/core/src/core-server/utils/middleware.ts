import { existsSync } from 'node:fs';

import { resolve } from 'pathe';

const fileExists = (basename: string) =>
  ['.js', '.mjs', '.cjs'].reduce((found: string, ext: string) => {
    const filename = `${basename}${ext}`;
    return !found && existsSync(filename) ? filename : found;
  }, '');

export async function getMiddleware(configDir: string) {
  const middlewarePath = fileExists(resolve(configDir, 'middleware'));
  if (middlewarePath) {
    const middlewareModule = await import(middlewarePath);
    return middlewareModule.default ?? middlewareModule;
  }
  return () => {};
}
