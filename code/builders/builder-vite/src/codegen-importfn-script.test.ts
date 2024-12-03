import { beforeEach, describe, expect, it, vi } from 'vitest';

import { toImportFn } from './codegen-importfn-script';

describe('toImportFn', () => {
  it('should correctly map story paths to import functions for absolute paths on Linux', async () => {
    const root = '/absolute/path';
    const stories = ['/absolute/path/to/story1.js', '/absolute/path/to/story2.js'];

    const result = await toImportFn(root, stories);

    expect(result).toMatchInlineSnapshot(`
      "const importers = {
        "./to/story1.js": () => import("/absolute/path/to/story1.js"),
        "./to/story2.js": () => import("/absolute/path/to/story2.js")
      };

      export async function importFn(path) {
        return await importers[path]();
      }"
    `);
  });

  it('should correctly map story paths to import functions for absolute paths on Windows', async () => {
    const root = 'C:\\absolute\\path';
    const stories = ['C:\\absolute\\path\\to\\story1.js', 'C:\\absolute\\path\\to\\story2.js'];

    const result = await toImportFn(root, stories);

    expect(result).toMatchInlineSnapshot(`
      "const importers = {
        "./to/story1.js": () => import("C:/absolute/path/to/story1.js"),
        "./to/story2.js": () => import("C:/absolute/path/to/story2.js")
      };

      export async function importFn(path) {
        return await importers[path]();
      }"
    `);
  });

  it('should handle an empty array of stories', async () => {
    const root = '/absolute/path';
    const stories: string[] = [];

    const result = await toImportFn(root, stories);

    expect(result).toMatchInlineSnapshot(`
      "const importers = {};

      export async function importFn(path) {
        return await importers[path]();
      }"
    `);
  });
});
