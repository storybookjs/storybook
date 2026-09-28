import { readFile, writeFile } from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { findConfigFile, formatFileContent } from 'storybook/internal/common';

import { fs, vol } from 'memfs';

import { reactViteToTanstackReact } from './fixes/react-vite-to-tanstack-react.ts';
import { setConfigLayout } from './fixes/set-config-layout.ts';
import { pluginsFor, runTransforms } from './pipeline.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('storybook/internal/common', { spy: true });
vi.mock('globby', () => ({
  globby: vi.fn(async (pattern: string) =>
    Object.keys(vol.toJSON()).filter((file) => file.startsWith(pattern.replace('/**/*', '/')))
  ),
}));

const project = {
  configDir: '/project/.storybook',
  mainConfigPath: '/project/.storybook/main.ts',
  previewConfigPath: '/project/.storybook/preview.ts',
  storiesPaths: ['/project/src/A.stories.ts', '/project/src/B.stories.ts'],
};

describe('runTransforms', () => {
  beforeEach(() => {
    vol.reset();
    vi.mocked(readFile)
      .mockClear()
      .mockImplementation(fs.promises.readFile as typeof readFile);
    vi.mocked(writeFile)
      .mockClear()
      .mockImplementation(fs.promises.writeFile as typeof writeFile);
    vol.fromJSON({
      [project.mainConfigPath]: 'main',
      [project.previewConfigPath]: 'preview',
      [project.storiesPaths[0]]: 'a',
      [project.storiesPaths[1]]: 'b',
    });
  });

  afterEach(() => {
    vi.mocked(readFile).mockRestore();
    vi.mocked(writeFile).mockRestore();
  });

  it('reads and writes each file once, chaining every fix in order', async () => {
    const outcomes = await runTransforms(
      project,
      [
        {
          fixId: 'first',
          hooks: [{ filter: { kind: ['main', 'story'] }, handler: (code) => `${code}+first` }],
        },
        {
          fixId: 'second',
          hooks: [{ filter: { kind: ['story'] }, handler: (code) => `${code}+second` }],
        },
      ],
      { write: true }
    );

    expect(vol.toJSON()).toEqual({
      [project.mainConfigPath]: 'main+first',
      [project.previewConfigPath]: 'preview',
      [project.storiesPaths[0]]: 'a+first+second',
      [project.storiesPaths[1]]: 'b+first+second',
    });
    expect(vi.mocked(readFile).mock.calls.map(([path]) => path)).toEqual([
      project.mainConfigPath,
      ...project.storiesPaths,
    ]);
    expect(vi.mocked(writeFile)).toHaveBeenCalledTimes(3);
    expect(outcomes.get('second')).toEqual({ changed: project.storiesPaths, errors: [] });
  });

  it('visits the preview before stories, so hooks can carry state across files', async () => {
    let fromPreview = '';
    await runTransforms(
      project,
      [
        {
          fixId: 'inherit',
          hooks: [
            {
              filter: { kind: ['preview', 'story'] },
              handler: (code, { kind }) => {
                if (kind === 'preview') {
                  fromPreview = code;
                  return null;
                }
                return `${code} inherits ${fromPreview}`;
              },
            },
          ],
        },
      ],
      { write: true }
    );

    expect(fs.readFileSync(project.storiesPaths[1], 'utf8')).toBe('b inherits preview');
  });

  it('isolates a failing fix to the files it failed on, and writes nothing on detection', async () => {
    fs.unlinkSync(project.storiesPaths[1]);
    const before = vol.toJSON();

    const outcomes = await runTransforms(
      project,
      [
        {
          fixId: 'strict',
          hooks: [
            {
              filter: { kind: ['story'] },
              handler: (code) => {
                throw new Error(`cannot migrate ${code}`);
              },
            },
          ],
        },
        {
          fixId: 'lenient',
          hooks: [{ filter: { kind: ['story'] }, handler: (code) => code.toUpperCase() }],
        },
      ],
      { write: false }
    );

    expect(vol.toJSON()).toEqual(before);
    const unreadable = {
      file: project.storiesPaths[1],
      message: expect.stringContaining('ENOENT'),
    };
    expect(outcomes.get('strict')?.errors).toEqual([
      { file: project.storiesPaths[0], message: 'cannot migrate a' },
      unreadable,
    ]);
    expect(outcomes.get('lenient')).toEqual({
      changed: [project.storiesPaths[0]],
      errors: [unreadable],
    });
  });

  it('classifies a file the same way whichever fixes run together', async () => {
    const managerConfigPath = `${project.configDir}/manager.ts`;
    const storyInConfigDir = `${project.configDir}/Intro.stories.tsx`;
    vol.fromJSON({
      [managerConfigPath]: [
        "import { addons } from 'storybook/manager-api';",
        "import { theme } from '@storybook/react-vite';",
        'addons.setConfig({ showNav: false, theme });',
      ].join('\n'),
      [storyInConfigDir]: "import type { Meta } from '@storybook/react-vite';",
    });
    vi.mocked(findConfigFile).mockReturnValue(managerConfigPath);
    vi.mocked(formatFileContent).mockImplementation(async (_path, source) => source);
    const withStory = { ...project, storiesPaths: [...project.storiesPaths, storyInConfigDir] };
    const result = { hasTanstackRouterDecorator: false };

    await runTransforms(
      withStory,
      pluginsFor(
        [
          { fix: reactViteToTanstackReact, result },
          { fix: setConfigLayout, result: {} },
        ],
        withStory as never
      ),
      { write: true }
    );

    expect(fs.readFileSync(managerConfigPath, 'utf8')).toMatchInlineSnapshot(`
      "import { addons } from 'storybook/manager-api';
      import { theme } from '@storybook/tanstack-react';
      addons.setConfig({ layout: {
        showNav: false
      }, theme });"
    `);
    expect(fs.readFileSync(storyInConfigDir, 'utf8')).toBe(
      "import type { Meta } from '@storybook/tanstack-react';"
    );
  });

  it('reports a failed write for the fixes that changed the file and keeps going', async () => {
    const [first, second] = project.storiesPaths;
    vi.mocked(writeFile).mockImplementation(async (path, data) => {
      if (path === first) {
        throw new Error('EACCES: permission denied');
      }
      return fs.promises.writeFile(path as string, data as string);
    });

    const outcomes = await runTransforms(
      project,
      [
        {
          fixId: 'upper',
          hooks: [{ filter: { kind: ['story'] }, handler: (code) => code.toUpperCase() }],
        },
        { fixId: 'untouched', hooks: [{ filter: { kind: ['story'] }, handler: () => null }] },
      ],
      { write: true }
    );

    expect(outcomes.get('upper')).toEqual({
      changed: [second],
      errors: [{ file: first, message: 'EACCES: permission denied' }],
    });
    expect(outcomes.get('untouched')).toEqual({ changed: [], errors: [] });
    expect(fs.readFileSync(first, 'utf8')).toBe('a');
    expect(fs.readFileSync(second, 'utf8')).toBe('B');
  });

  it('skips the main config when the project has none, instead of failing the pass', async () => {
    const outcomes = await runTransforms(
      { ...project, mainConfigPath: undefined as unknown as string },
      [
        {
          fixId: 'both',
          hooks: [{ filter: { kind: ['main', 'story'] }, handler: (code) => `${code}!` }],
        },
      ],
      { write: true }
    );

    expect(outcomes.get('both')).toEqual({ changed: project.storiesPaths, errors: [] });
    expect(fs.readFileSync(project.mainConfigPath, 'utf8')).toBe('main');
  });
});
