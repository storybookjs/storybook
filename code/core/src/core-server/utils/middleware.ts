import path from 'node:path';
import fs from 'node:fs';

const fileExists = (basename: string) =>
  ['.js', '.cjs'].reduce((found: string, ext: string) => {
    const filename = `${basename}${ext}`;
    return !found && fs.existsSync(filename) ? filename : found;
  }, '');

export function getMiddleware(configDir: string) {
  const middlewarePath = fileExists(path.resolve(configDir, 'middleware'));
  if (middlewarePath) {
    let middlewareModule = require(middlewarePath);
    // eslint-disable-next-line no-underscore-dangle
    if (middlewareModule.__esModule) {
      middlewareModule = middlewareModule.default;
    }
    return middlewareModule;
  }
  return () => {};
}
