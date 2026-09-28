import { readFile, writeFile } from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { findConfigFile, formatFileContent } from 'storybook/internal/common';
import { loadConfig } from 'storybook/internal/csf-tools';

import { fs, vol } from 'memfs';

import { reactViteToTanstackReact } from './fixes/react-vite-to-tanstack-react.ts';
import { setConfigLayout } from './fixes/set-config-layout.ts';
import { detectApplicable, pluginsFor, runTransforms } from './pipeline.ts';
import type { Fix } from './types.ts';
import type { ConfigFile } from 'storybook/internal/csf-tools';

vi.mock('node:fs/promises', { spy: true });
vi.mock('storybook/internal/common', { spy: true });
vi.mock('storybook/internal/csf-tools', { spy: true });
vi.mock('globby', async (importOriginal) => {
  const { globby } = await importOriginal<typeof import('globby')>();
  const { fs: memoryFs } = await import('memfs');
  return {
    globby: (patterns: string, options: object) =>
      globby(patterns, { ...options, fs: memoryFs as never }),
  };
});

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

  it('isolates a failing fix to the files it failed on', async () => {
    fs.unlinkSync(project.storiesPaths[1]);

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
      { write: true }
    );

    expect(fs.readFileSync(project.storiesPaths[0], 'utf8')).toBe('A');
    const unreadable = {
      file: project.storiesPaths[1],
      kind: 'story',
      message: expect.stringContaining('ENOENT'),
    };
    expect(outcomes.get('strict')?.errors).toEqual([
      { file: project.storiesPaths[0], kind: 'story', message: 'cannot migrate a' },
      unreadable,
    ]);
    expect(outcomes.get('lenient')).toEqual({
      changed: [project.storiesPaths[0]],
      errors: [unreadable],
    });
  });

  it('stops detecting a fix at its first changed or failed file, and writes nothing', async () => {
    const before = vol.toJSON();

    const outcomes = await runTransforms(
      project,
      [
        {
          fixId: 'changes',
          hooks: [{ filter: { kind: ['main', 'story'] }, handler: (code) => `${code}!` }],
        },
        {
          fixId: 'fails',
          hooks: [
            {
              filter: { kind: ['story'] },
              handler: () => {
                throw new Error('cannot migrate');
              },
            },
          ],
        },
      ],
      { write: false }
    );

    expect(vol.toJSON()).toEqual(before);
    expect(vi.mocked(readFile).mock.calls.map(([path]) => path)).toEqual([
      project.mainConfigPath,
      project.storiesPaths[0],
    ]);
    expect(Object.fromEntries(outcomes)).toEqual({
      changes: { changed: [project.mainConfigPath], errors: [] },
      fails: {
        changed: [],
        errors: [{ file: project.storiesPaths[0], kind: 'story', message: 'cannot migrate' }],
      },
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

  it('offers config-directory scripts to config hooks, skipping node_modules and dist', async () => {
    const decorators = `${project.configDir}/decorators.tsx`;
    const skipped = [
      `${project.configDir}/node_modules/pkg/index.js`,
      `${project.configDir}/dist/generated.js`,
      `${project.configDir}/preview-head.html`,
    ];
    vol.fromJSON(
      Object.fromEntries([decorators, ...skipped].map((file) => [file, "import 'old';"]))
    );

    await runTransforms(
      project,
      [
        {
          fixId: 'rename',
          hooks: [{ filter: { kind: ['config'] }, handler: (code) => code.replace('old', 'new') }],
        },
      ],
      { write: true }
    );

    expect(fs.readFileSync(decorators, 'utf8')).toBe("import 'new';");
    skipped.forEach((file) => expect(fs.readFileSync(file, 'utf8')).toBe("import 'old';"));
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
      errors: [{ file: first, kind: 'story', message: 'EACCES: permission denied' }],
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

describe('edit hooks', () => {
  const mainConfigPath = '/project/.storybook/main.ts';
  const project = { configDir: '/project/.storybook', mainConfigPath, storiesPaths: [] };
  const setFeature = (name: string) => ({
    filter: { kind: ['main'] as const },
    editConfig: (main: ConfigFile) => main.set(['features', name], true),
  });

  beforeEach(() => {
    vol.reset();
    vi.mocked(loadConfig).mockClear();
    vi.mocked(readFile).mockImplementation(fs.promises.readFile as typeof readFile);
    vi.mocked(writeFile).mockImplementation(fs.promises.writeFile as typeof writeFile);
    vi.mocked(formatFileContent)
      .mockClear()
      .mockImplementation(async (_path, source) => `${source}\n// formatted`);
    vol.fromJSON({ [mainConfigPath]: 'export default { features: {} };' });
  });

  afterEach(() => {
    vi.mocked(readFile).mockRestore();
    vi.mocked(writeFile).mockRestore();
  });

  it('parses a file once for consecutive edits and formats it once when writing', async () => {
    const outcomes = await runTransforms(
      project,
      [
        { fixId: 'a', hooks: [setFeature('a')] },
        { fixId: 'b', hooks: [setFeature('b')] },
      ],
      { write: true }
    );

    expect(loadConfig).toHaveBeenCalledTimes(1);
    expect(formatFileContent).toHaveBeenCalledTimes(1);
    expect(fs.readFileSync(mainConfigPath, 'utf8')).toMatchInlineSnapshot(`
      "export default { features: {
        a: true,
        b: true
      } };
      // formatted"
    `);
    expect(outcomes.get('b')).toEqual({ changed: [mainConfigPath], errors: [] });
  });

  it('sees no change in a CRLF file that an edit leaves alone, and keeps CRLF when it writes', async () => {
    vol.fromJSON({ [mainConfigPath]: 'export default {\r\n  features: {},\r\n};\r\n' });
    const untouched = { filter: { kind: ['main'] as const }, editConfig: () => {} };

    const detection = await runTransforms(project, [{ fixId: 'noop', hooks: [untouched] }], {
      write: false,
    });
    await runTransforms(project, [{ fixId: 'a', hooks: [setFeature('a')] }], { write: true });

    expect(detection.get('noop')).toEqual({ changed: [], errors: [] });
    expect(fs.readFileSync(mainConfigPath, 'utf8')).toBe(
      'export default {\r\n  features: {\r\n    a: true\r\n  },\r\n};\r\n\r\n// formatted'
    );
  });

  it('passes MDX stories to text handlers only', async () => {
    const mdx = '/project/src/Intro.mdx';
    vol.fromJSON({ [mdx]: "import { Meta } from '@storybook/addon-docs/blocks';" });
    const editCsf = vi.fn();

    const outcomes = await runTransforms(
      { ...project, storiesPaths: [mdx] },
      [
        { fixId: 'edit', hooks: [{ filter: { kind: ['story'] }, editCsf }] },
        {
          fixId: 'rename',
          hooks: [{ filter: { kind: ['story'] }, handler: (code) => code.replace('blocks', 'x') }],
        },
      ],
      { write: true }
    );

    expect(editCsf).not.toHaveBeenCalled();
    expect(outcomes.get('edit')).toEqual({ changed: [], errors: [] });
    expect(outcomes.get('rename')).toEqual({ changed: [mdx], errors: [] });
  });

  it('drops the edits of a failed hook and keeps the others', async () => {
    const outcomes = await runTransforms(
      project,
      [
        { fixId: 'a', hooks: [setFeature('a')] },
        {
          fixId: 'broken',
          hooks: [
            {
              filter: { kind: ['main'] },
              editConfig: (main) => {
                main.set(['features', 'broken'], true);
                throw new Error('cannot finish');
              },
            },
          ],
        },
        { fixId: 'c', hooks: [setFeature('c')] },
      ],
      { write: true }
    );

    expect(fs.readFileSync(mainConfigPath, 'utf8')).toMatchInlineSnapshot(`
      "export default { features: {
        a: true,
        c: true
      } };
      // formatted"
    `);
    expect(outcomes.get('broken')).toEqual({
      changed: [],
      errors: [{ file: mainConfigPath, kind: 'main', message: 'cannot finish' }],
    });
  });

  it('fails a hook that leaves mutation diagnostics, with their line', async () => {
    fs.writeFileSync(mainConfigPath, 'const base = {};\nexport default { ...base };');

    const outcomes = await runTransforms(project, [{ fixId: 'a', hooks: [setFeature('a')] }], {
      write: true,
    });

    expect(outcomes.get('a')?.errors).toEqual([
      { file: mainConfigPath, kind: 'main', message: expect.stringMatching(/^line 2: /) },
    ]);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('writes text from a handler as returned, without formatting it', async () => {
    await runTransforms(
      project,
      [
        {
          fixId: 'text',
          hooks: [{ filter: { kind: ['main'] }, handler: () => 'export default {};' }],
        },
      ],
      { write: true }
    );

    expect(fs.readFileSync(mainConfigPath, 'utf8')).toBe('export default {};');
    expect(formatFileContent).not.toHaveBeenCalled();
  });

  it('runs a hook only on files whose code matches filter.code, and formats nothing on detection', async () => {
    const handler = vi.fn(() => 'changed');
    const outcomes = await runTransforms(
      project,
      [
        {
          fixId: 'miss',
          hooks: [{ filter: { kind: ['main'], code: 'componentSubtitle' }, handler }],
        },
        { fixId: 'hit', hooks: [{ filter: { kind: ['main'], code: /features/ }, handler }] },
      ],
      { write: false }
    );

    expect(handler).toHaveBeenCalledTimes(1);
    expect(outcomes.get('hit')?.changed).toEqual([mainConfigPath]);
    expect(formatFileContent).not.toHaveBeenCalled();
  });
});

describe('detectApplicable', () => {
  beforeEach(() => {
    vol.reset();
    vi.mocked(readFile)
      .mockClear()
      .mockImplementation(fs.promises.readFile as typeof readFile);
    vol.fromJSON({
      [project.mainConfigPath]: 'main',
      [project.storiesPaths[0]]: 'a',
      [project.storiesPaths[1]]: 'b',
    });
  });

  afterEach(() => {
    vi.mocked(readFile).mockRestore();
  });

  const hookOnly = (id: string, handler: (code: string) => string | null): Fix => ({
    id,
    prompt: () => id,
    transform: () => [{ filter: { kind: ['main', 'story'] }, handler }],
  });

  it('offers a hook-only fix only when a hook changes a file', async () => {
    const changes = { fix: hookOnly('changes', (code) => `${code}!`), result: {} };
    const noop = { fix: hookOnly('noop', () => null), result: {} };

    await expect(detectApplicable(project as never, [changes, noop])).resolves.toEqual([changes]);
  });

  it('offers a fix with its own run on its check alone, without running its hooks', async () => {
    const handler = vi.fn(() => null);
    const withRun: { fix: Fix; result: unknown } = {
      fix: {
        id: 'with-run',
        prompt: () => 'with-run',
        check: async () => ({}),
        transform: () => [{ filter: { kind: ['main', 'story'] }, handler }],
        run: async () => {},
      },
      result: {},
    };

    await expect(detectApplicable(project as never, [withRun])).resolves.toEqual([withRun]);
    expect(handler).not.toHaveBeenCalled();
    expect(readFile).not.toHaveBeenCalled();
  });
});
