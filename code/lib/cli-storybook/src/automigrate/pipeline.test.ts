import { readFile, writeFile } from 'node:fs/promises';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fs, vol } from 'memfs';

import { runTransforms } from './pipeline.ts';

vi.mock('node:fs/promises', { spy: true });

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
    expect(outcomes.get('strict')?.errors).toEqual([
      `- ${project.storiesPaths[0]}: cannot migrate a`,
      expect.stringContaining(`- ${project.storiesPaths[1]}: ENOENT`),
    ]);
    expect(outcomes.get('lenient')).toEqual({
      changed: [project.storiesPaths[0]],
      errors: [expect.stringContaining(`- ${project.storiesPaths[1]}: ENOENT`)],
    });
  });
});
