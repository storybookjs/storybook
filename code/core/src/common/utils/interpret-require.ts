import { importModule } from '../../shared/utils/module';
import { getInterpretedFile } from './interpret-files';

function getCandidate(paths: string[]) {
  for (let i = 0; i < paths.length; i += 1) {
    const candidate = getInterpretedFile(paths[i]);

    if (candidate) {
      return candidate;
    }
  }

  return undefined;
}

// TODO: remove this when it is no longer used by @storybook/core-webpack
export function serverRequire(filePath: string | string[]) {
  const paths = Array.isArray(filePath) ? filePath : [filePath];
  const candidatePath = getCandidate(paths);

  if (!candidatePath) {
    return null;
  }

  return importModule(candidatePath);
}
