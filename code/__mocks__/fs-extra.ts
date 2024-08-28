import { vi } from 'vitest';

// This is a custom function that our tests can use during setup to specify
// what the files on the "mock" filesystem should look like when any of the
// `fs` APIs are used.
let mockFiles = Object.create(null);

// eslint-disable-next-line no-underscore-dangle, @typescript-eslint/naming-convention
export function __setMockFiles(newMockFiles: Record<string, string | null>) {
  mockFiles = newMockFiles;
}

// A custom version of `readdirSync` that reads from the special mocked out
// file list set via __setMockFiles
export const writeFile = vi.fn(async (filePath: string, content: string) => {
  mockFiles[filePath] = content;
});
export const readFile = vi.fn(async (filePath: string) => mockFiles[filePath]);
export const readFileSync = vi.fn((filePath = '') => mockFiles[filePath]);
export const realpathSync = vi.fn((filePath = '') => filePath);
export const existsSync = vi.fn((filePath: string) => !!mockFiles[filePath]);
export const readJson = vi.fn((filePath = '') => JSON.parse(mockFiles[filePath]));
export const readJsonSync = vi.fn((filePath = '') => JSON.parse(mockFiles[filePath]));
export const lstatSync = vi.fn((filePath: string) => ({
  isFile: () => !!mockFiles[filePath],
}));
export const writeJson = vi.fn((filePath, json, { spaces } = {}) => {
  mockFiles[filePath] = JSON.stringify(json, null, spaces);
});

export default {
  __setMockFiles,
  writeFile,
  readFile,
  readFileSync,
  existsSync,
  readJson,
  readJsonSync,
  lstatSync,
  writeJson,
};
