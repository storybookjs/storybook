import { createJiti } from 'jiti';

import { getInterpretedFileWithExt } from './interpret-files';

export function interopRequireDefault(filePath: string) {
  const jiti = createJiti(__filename, {});

  const result = jiti(filePath);

  const isES6DefaultExported =
    typeof result === 'object' && result !== null && typeof result.default !== 'undefined';

  return isES6DefaultExported ? result.default : result;
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
