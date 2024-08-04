import { pathExists } from '@ndelangen/fs-extra-unified';

export const boost = new Set(['.js', '.jsx', '.ts', '.tsx', '.cts', '.mts', '.cjs', '.mjs']);

function sortExtensions() {
  return [...Array.from(boost)];
}

const possibleExtensions = sortExtensions();

export async function getInterpretedFile(pathToFile: string) {
  for (const ext of possibleExtensions) {
    const candidate = pathToFile.endsWith(ext) ? pathToFile : `${pathToFile}${ext}`;
    if (await pathExists(candidate)) {
      return candidate;
    }
  }

  return undefined;
}

export async function getInterpretedFileWithExt(pathToFile: string) {
  for (const ext of possibleExtensions) {
    const candidate = pathToFile.endsWith(ext) ? pathToFile : `${pathToFile}${ext}`;
    if (await pathExists(candidate)) {
      return { path: candidate, ext };
    }
  }

  return undefined;
}
