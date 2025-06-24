import { existsSync } from 'node:fs';

export const supportedExtensions = [
  '.js',
  '.mjs',
  '.cjs',
  '.jsx',
  '.ts',
  '.mts',
  '.cts',
  '.tsx',
] as const;

export function getInterpretedFile(pathToFile: string) {
  return supportedExtensions
    .map((ext) => (pathToFile.endsWith(ext) ? pathToFile : `${pathToFile}${ext}`))
    .find((candidate) => existsSync(candidate));
}

export function getInterpretedFileWithExt(pathToFile: string) {
  return supportedExtensions
    .map((ext) => ({ path: pathToFile.endsWith(ext) ? pathToFile : `${pathToFile}${ext}`, ext }))
    .find((candidate) => existsSync(candidate.path));
}
