import { vi } from 'vitest';

// This is a custom function that our tests can use during setup to specify
// what the files on the "mock" filesystem should look like when any of the
// `fs` APIs are used.
let mockFiles = Object.create(null);

// eslint-disable-next-line no-underscore-dangle, @typescript-eslint/naming-convention
export function __setMockFiles(newMockFiles: Record<string, string | null>) {
  mockFiles = newMockFiles;
}

export const readFileSync = (filePath = '') => mockFiles[filePath];
export const existsSync = (filePath: string) => !!mockFiles[filePath];
export const lstatSync = (filePath: string) => ({
  isFile: () => !!mockFiles[filePath],
});
export const realpathSync = vi.fn();
export const readdir = vi.fn();
export const readdirSync = vi.fn();
export const readlinkSync = vi.fn();

export default {
  __setMockFiles,
  readFileSync,
  existsSync,
  lstatSync,
  realpathSync,
  readdir,
  readdirSync,
  readlinkSync,
};
