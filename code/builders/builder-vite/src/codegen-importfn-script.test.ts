import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';

import type { StoryIndex } from 'storybook/internal/types';

import { dedent } from 'ts-dedent';

import { generateImportFnScriptCode } from './codegen-importfn-script.ts';

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

describe('generateImportFnScriptCode with a module importer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const index: StoryIndex = {
    v: 5,
    entries: {
      'button--primary': {
        id: 'button--primary',
        title: 'Button',
        name: 'Primary',
        importPath: './Button.stories.js',
        type: 'story',
        subtype: 'story',
      },
    },
  };

  it('imports every file through the importModule function of the importer', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue('/absolute/path');

    expect(generateImportFnScriptCode(index, '/absolute/importer.js')).toMatchInlineSnapshot(`
      "import { importModule } from "/absolute/importer.js";

      const importers = {
        "./Button.stories.js": () => import("/absolute/path/Button.stories.js")
      };

      export async function importFn(path) {
        return await importModule(path, (path) => importers[path]());
      }"
    `);
  });

  it('importFn returns what importModule returns, asked with the path of the index', async () => {
    const dir = await realpath(await mkdtemp(join(tmpdir(), 'module-importer-')));
    onTestFinished(() => rm(dir, { recursive: true }));
    vi.spyOn(process, 'cwd').mockReturnValue(dir);
    await writeFile(join(dir, 'Button.stories.js'), 'export const Primary = {};');
    await writeFile(
      join(dir, 'importer.js'),
      dedent`
        export const paths = [];
        export async function importModule(importPath, importFn) {
          paths.push(importPath);
          return { ...(await importFn(importPath)), loaded: true };
        }
      `
    );
    await writeFile(
      join(dir, 'stories.js'),
      generateImportFnScriptCode(index, join(dir, 'importer.js'))
    );

    const { importFn } = await import(/* @vite-ignore */ join(dir, 'stories.js'));
    const { paths } = await import(/* @vite-ignore */ join(dir, 'importer.js'));

    expect(await importFn('./Button.stories.js')).toEqual({
      Primary: {},
      loaded: true,
    });
    expect(paths).toEqual(['./Button.stories.js']);
  });

  it('importModule can return a module for a path the build never saw', async () => {
    const dir = await realpath(await mkdtemp(join(tmpdir(), 'module-importer-')));
    onTestFinished(() => rm(dir, { recursive: true }));
    vi.spyOn(process, 'cwd').mockReturnValue(dir);
    await writeFile(
      join(dir, 'importer.js'),
      dedent`
        export async function importModule(importPath, importFn) {
          if (importPath.endsWith('.stories.json')) {
            return { default: { title: 'Runtime' }, Story: {} };
          }
          return importFn(importPath);
        }
      `
    );
    await writeFile(
      join(dir, 'stories.js'),
      generateImportFnScriptCode({ v: 5, entries: {} }, join(dir, 'importer.js'))
    );

    const { importFn } = await import(/* @vite-ignore */ join(dir, 'stories.js'));

    expect(await importFn('./archives/Login.stories.json')).toEqual({
      default: { title: 'Runtime' },
      Story: {},
    });
  });
});
