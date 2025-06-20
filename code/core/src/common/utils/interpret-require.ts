import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

import { resolveModule } from '../../shared/utils/resolve';
import { getInterpretedFileWithExt } from './interpret-files';

let registered = false;

export async function interopRequireDefault(filePath: string) {
  if (!registered) {
    const loaderPath = resolveModule({ pkg: 'storybook', exportPath: 'internal/loader' });
    register(loaderPath, import.meta.url);
    registered = true;
  }

  let resolvedPath = filePath;

  try {
    if (!filePath.startsWith('file:')) {
      resolvedPath = pathToFileURL(filePath).href;
    }

    const result = await import(resolvedPath);

    const isES6DefaultExported =
      typeof result === 'object' && result !== null && typeof result.default !== 'undefined';

    return isES6DefaultExported ? result.default : result;
  } catch (e) {
    // console.log('fallback!', { e, filePath });
    const result = require(filePath);

    const isES6DefaultExported =
      typeof result === 'object' && result !== null && typeof result.default !== 'undefined';

    return isES6DefaultExported ? result.default : result;
  }
}

function getCandidate(paths: string[]) {
  for (let i = 0; i < paths.length; i += 1) {
    const candidate = getInterpretedFileWithExt(paths[i]);

    if (candidate) {
      return candidate;
    }
  }

  return undefined;
}

export function serverRequire(filePath: string | string[]) {
  const candidatePath = serverResolve(filePath);

  if (!candidatePath) {
    return null;
  }

  return interopRequireDefault(candidatePath);
}

export function serverResolve(filePath: string | string[]): string | null {
  const paths = Array.isArray(filePath) ? filePath : [filePath];
  const existingCandidate = getCandidate(paths);

  if (!existingCandidate) {
    return null;
  }

  return existingCandidate.path;
}
