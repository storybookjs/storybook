import { vi } from 'vitest';

// This is a custom function that our tests can use during setup to specify
// what the files on the "mock" filesystem should look like when any of the
// `fs` APIs are used.
let mockFiles = Object.create(null);

// eslint-disable-next-line no-underscore-dangle, @typescript-eslint/naming-convention
export function __setMockFiles(newMockFiles: Record<string, string | null>) {
  mockFiles = newMockFiles;
}

export const writeFile = vi.fn(async (filePath: string, content: string) => {
  mockFiles[filePath] = content;
});
export const readFile = vi.fn(async (filePath: string) => mockFiles[filePath]);
export const lstat = vi.fn(async (filePath: string) => ({
  isFile: () => !!mockFiles[filePath],
}));
export const readdir = vi.fn();
export const readlink = vi.fn();
export const realpath = vi.fn();

export default {
  __setMockFiles,
  writeFile,
  readFile,
  lstat,
  readdir,
  readlink,
  realpath,
};
