import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);

const fileExists = (basename: string) =>
  ['.js', '.cjs'].reduce((found: string, ext: string) => {
    const filename = `${basename}${ext}`;
    return !found && existsSync(filename) ? filename : found;
  }, '');

export function getMiddleware(configDir: string) {
  const middlewarePath = fileExists(resolve(configDir, 'middleware'));
  if (middlewarePath) {
    let middlewareModule = require(middlewarePath);
    if (middlewareModule.__esModule) {
      middlewareModule = middlewareModule.default;
    }
    return middlewareModule;
  }
  return () => {};
}
