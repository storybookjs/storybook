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

describe('generateImportFnScriptCode with module importers', () => {
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

    expect(generateImportFnScriptCode(index, ['/absolute/importer.js'])).toMatchInlineSnapshot(`
      "import { importModule as importModule_0 } from "/absolute/importer.js";

      const importers = {
        "./Button.stories.js": () => import("/absolute/path/Button.stories.js")
      };

      export async function importFn(path) {
        return await importModule_0(path, (path) => importers[path]());
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
      generateImportFnScriptCode(index, [join(dir, 'importer.js')])
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
      generateImportFnScriptCode({ v: 5, entries: {} }, [join(dir, 'importer.js')])
    );

    const { importFn } = await import(/* @vite-ignore */ join(dir, 'stories.js'));

    expect(await importFn('./archives/Login.stories.json')).toEqual({
      default: { title: 'Runtime' },
      Story: {},
    });
  });

  it('asks the last importer first, and each importer passes on to the one before it', async () => {
    vi.spyOn(process, 'cwd').mockReturnValue('/absolute/path');

    expect(generateImportFnScriptCode(index, ['/framework/importer.js', '/project/importer.js']))
      .toMatchInlineSnapshot(`
        "import { importModule as importModule_0 } from "/framework/importer.js";
        import { importModule as importModule_1 } from "/project/importer.js";

        const importers = {
          "./Button.stories.js": () => import("/absolute/path/Button.stories.js")
        };

        export async function importFn(path) {
          return await importModule_1(path, (path) => importModule_0(path, (path) => importers[path]()));
        }"
      `);
  });

  it('runs the chain from the last importer down to the build', async () => {
    const dir = await realpath(await mkdtemp(join(tmpdir(), 'module-importer-')));
    onTestFinished(() => rm(dir, { recursive: true }));
    vi.spyOn(process, 'cwd').mockReturnValue(dir);
    await writeFile(join(dir, 'Button.stories.js'), 'export const Primary = {};');
    const importer = (name: string) => dedent`
      import { calls } from './calls.js';
      export async function importModule(importPath, importFn) {
        calls.push('${name} ' + importPath);
        return { ...(await importFn(importPath)), ${name}: true };
      }
    `;
    await writeFile(join(dir, 'calls.js'), 'export const calls = [];');
    await writeFile(join(dir, 'framework.js'), importer('framework'));
    await writeFile(join(dir, 'project.js'), importer('project'));
    await writeFile(
      join(dir, 'stories.js'),
      generateImportFnScriptCode(index, [join(dir, 'framework.js'), join(dir, 'project.js')])
    );

    const { importFn } = await import(/* @vite-ignore */ join(dir, 'stories.js'));
    const { calls } = await import(/* @vite-ignore */ join(dir, 'calls.js'));

    expect(await importFn('./Button.stories.js')).toEqual({
      Primary: {},
      framework: true,
      project: true,
    });
    expect(calls).toEqual(['project ./Button.stories.js', 'framework ./Button.stories.js']);
  });
});
