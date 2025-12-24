import { describe, expect, it, vi } from 'vitest';

import type { StoryIndex } from 'storybook/internal/types';

import { generateImportFnScriptCode } from './codegen-importfn-script';

describe('generateImportFnScriptCode', () => {
  it('should correctly map story paths to import functions for POSIX paths', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue('/absolute/path');

    const index: StoryIndex = {
      v: 5,
      entries: {
        'path-to-story': {
          id: 'path-to-story',
          title: 'Path to Story',
          name: 'Default',
          importPath: './to/abs-story.js',
          type: 'story',
          subtype: 'story',
        },
        'virtual-story': {
          id: 'virtual-story',
          title: 'Virtual Story',
          name: 'Default',
          importPath: 'virtual:story.js',
          type: 'story',
          subtype: 'story',
        },
      },
    };

    const result = generateImportFnScriptCode(index);

    expect(result).toMatchInlineSnapshot(`
      "const importers = {
        "./to/abs-story.js": () => import("/absolute/path/to/abs-story.js"),
        "virtual:story.js": () => import("virtual:story.js")
      };

      export async function importFn(path) {
        return await importers[path]();
      }"
    `);
  });

  it('should correctly map story paths to import functions for Windows paths', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue('C:\\absolute\\path');

    const index: StoryIndex = {
      v: 5,
      entries: {
        'abs-path-to-story': {
          id: 'abs-path-to-story',
          title: 'Absolute Path to Story',
          name: 'Default',
          importPath: 'to\\abs-story.js',
          type: 'story',
          subtype: 'story',
        },
        'virtual-story': {
          id: 'virtual-story',
          title: 'Virtual Story',
          name: 'Default',
          importPath: 'virtual:story.js',
          type: 'story',
          subtype: 'story',
        },
      },
    };

    const result = generateImportFnScriptCode(index);

    expect(result).toMatchInlineSnapshot(`
      "const importers = {
        "./to/abs-story.js": () => import("C:/absolute/path/to/abs-story.js"),
        "virtual:story.js": () => import("virtual:story.js")
      };

      export async function importFn(path) {
        return await importers[path]();
      }"
    `);
  });

  it('should handle an empty index', async () => {
    const result = generateImportFnScriptCode({ v: 5, entries: {} });

    expect(result).toMatchInlineSnapshot(`
      "const importers = {};

      export async function importFn(path) {
        return await importers[path]();
      }"
    `);
  });
});
