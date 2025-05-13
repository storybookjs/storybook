import { existsSync } from 'node:fs';

export const boost = new Set(['.js', '.jsx', '.ts', '.tsx', '.cts', '.mts', '.cjs', '.mjs']);

function sortExtensions() {
  return [...Array.from(boost)];
}

const possibleExtensions = sortExtensions();

export function getInterpretedFile(pathToFile: string) {
  return possibleExtensions
    .map((ext) => (pathToFile.endsWith(ext) ? pathToFile : `${pathToFile}${ext}`))
    .find((candidate) => existsSync(candidate));
}

export function getInterpretedFileWithExt(pathToFile: string) {
  return possibleExtensions
    .map((ext) => ({ path: pathToFile.endsWith(ext) ? pathToFile : `${pathToFile}${ext}`, ext }))
    .find((candidate) => existsSync(candidate.path));
}
