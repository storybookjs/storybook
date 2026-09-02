import * as fsp from 'node:fs/promises';
import { join } from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { storySortToMain } from './story-sort-to-main.ts';

vi.mock('node:fs/promises', async () => import('../../../../../__mocks__/fs/promises.ts'));

const mainConfigPath = join('.storybook', 'main.ts');
const previewConfigPath = join('.storybook', 'preview.ts');

const check = async (main: string, preview: string) => {
  vi.mocked<typeof import('../../../../../__mocks__/fs/promises')>(fsp as any).__setMockFiles({
    [mainConfigPath]: main,
    [previewConfigPath]: preview,
  });
  return storySortToMain.check({
    packageManager: {} as any,
    configDir: '.storybook',
    mainConfig: {} as any,
    mainConfigPath,
    previewConfigPath,
    storybookVersion: '11.0.0',
    storiesPaths: [],
    hasCsfFactoryPreview: false,
  });
};

const run = async (main: string, preview: string, dryRun = false) => {
  const result = await check(main, preview);
  expect(result).toBeTruthy();
  await storySortToMain.run?.({ result, dryRun } as any);
  return vi.mocked(fsp.writeFile).mock.calls.map(([path, contents]) => [path, String(contents)]);
};

beforeEach(() => {
  vi.mocked(fsp.writeFile).mockClear();
});

describe('story-sort-to-main', () => {
  it('does nothing when preview has no storySort', async () => {
    await expect(
      check(`export default { stories: [] }`, `export default { tags: ['test'] }`)
    ).resolves.toBeNull();
  });

  it('ignores an unrelated storySort property', async () => {
    await expect(
      check(
        `export default { stories: [] }`,
        `const unrelated = { storySort: { order: ['Intro'] } }; export default { tags: ['test'] }`
      )
    ).resolves.toBeNull();
  });

  it('moves a literal object and preserves unrelated configuration', async () => {
    const writes = await run(
      `export default { stories: ['./src/**/*.stories.ts'] }`,
      `export default { parameters: { options: { storySort: { order: ['Intro', '*'], method: 'alphabetical' }, showPanel: false }, docs: { source: {} } } }`
    );

    expect(writes).toHaveLength(2);
    expect(writes[0]?.[0]).toBe(mainConfigPath);
    expect(writes[0]?.[1]).toContain('storySort: {');
    expect(writes[0]?.[1]).toContain('order: ["Intro", "*"]');
    expect(writes[0]?.[1]).toContain('method: "alphabetical"');
    expect(writes[1]?.[1]).not.toContain('storySort');
    expect(writes[1]?.[1]).toContain('showPanel: false');
    expect(writes[1]?.[1]).toContain('docs: { source: {} }');
  });

  it('moves a literal array and prunes empty containers', async () => {
    const writes = await run(
      `export default { stories: [] }`,
      `export default { parameters: { options: { storySort: ['Intro', ['Start', '*']] } }, tags: ['test'] }`
    );

    expect(writes[0]?.[1]).toContain('storySort: ["Intro", ["Start", "*"]]');
    expect(writes[1]?.[1]).not.toContain('parameters');
    expect(writes[1]?.[1]).toContain(`tags: ['test']`);
  });

  it('moves storySort from a named parameters export', async () => {
    const writes = await run(
      `const config = { stories: [] }; export default config;`,
      `export const parameters = { options: { storySort: { order: ['Intro'] } } }; export const tags = ['test'];`
    );

    expect(writes[0]?.[1]).toContain('storySort: {');
    expect(writes[1]?.[1]).not.toContain('parameters');
    expect(writes[1]?.[1]).toContain(`export const tags = ['test']`);
  });

  it.each([
    ['satisfies', `({ order: ['Intro'] } satisfies Record<string, unknown>)`],
    ['as const', `(['Intro', '*'] as const)`],
  ])('moves a static value wrapped with %s', async (_name, storySort) => {
    const writes = await run(
      `export default { stories: [] }`,
      `export default { parameters: { options: { storySort: ${storySort} } } }`
    );

    expect(writes[0]?.[1]).toContain('storySort:');
    expect(writes[0]?.[1]).not.toContain('satisfies');
    expect(writes[0]?.[1]).not.toContain('as const');
    expect(writes[1]?.[1]).not.toContain('storySort');
  });

  it('rejects duplicate preview storySort properties', async () => {
    await expect(
      check(
        `export default { stories: [] }`,
        `export default { parameters: { options: { storySort: { order: ['First'] }, storySort: { order: ['Second'] } } } }`
      )
    ).rejects.toThrow('defines storySort more than once');
    expect(fsp.writeFile).not.toHaveBeenCalled();
  });

  it.each([
    [
      'identifier',
      `const options = { storySort: { order: ['Intro'] } }; export default { parameters: { options } }`,
    ],
    [
      'spread',
      `const legacy = { parameters: { options: { storySort: { order: ['Intro'] } } } }; export default { ...legacy }`,
    ],
  ])('rejects an unresolved preview %s', async (_name, preview) => {
    await expect(check(`export default { stories: [] }`, preview)).rejects.toThrow(
      'cannot safely locate parameters.options.storySort'
    );
    expect(fsp.writeFile).not.toHaveBeenCalled();
  });

  it('rejects an unresolved spread in main before adding storySort', async () => {
    await expect(
      check(
        `const shared = { stories: [] }; export default { ...shared }`,
        `export default { parameters: { options: { storySort: { order: ['Intro'] } } } }`
      )
    ).rejects.toThrow('main config contains a spread');
    expect(fsp.writeFile).not.toHaveBeenCalled();
  });

  it('preserves sibling declarators when parameters becomes empty', async () => {
    const writes = await run(
      `export default { stories: [] }`,
      `export const parameters = { options: { storySort: { order: ['Intro'] } } }, tags = ['test'];`
    );

    expect(writes[1]?.[1]).not.toContain('parameters');
    expect(writes[1]?.[1]).toContain(`tags = ['test']`);
  });

  it('does not write during a dry run', async () => {
    await run(
      `export default { stories: [] }`,
      `export default { parameters: { options: { storySort: { order: ['Intro'] } } } }`,
      true
    );

    expect(fsp.writeFile).not.toHaveBeenCalled();
  });

  it('rejects a main conflict before writing', async () => {
    await expect(
      check(
        `export default { stories: [], storySort: { order: ['Existing'] } }`,
        `export default { parameters: { options: { storySort: { order: ['Legacy'] } } } }`
      )
    ).rejects.toThrow('Both main and preview define storySort');
    expect(fsp.writeFile).not.toHaveBeenCalled();
  });

  it.each([
    ['function', `(a, b) => a.title.localeCompare(b.title)`],
    ['identifier', `storySort`],
    ['call', `createSort()`],
    ['spread', `{ order: ['Intro'], ...shared }`],
    ['computed key', `{ [key]: 'value' }`],
  ])('rejects a dynamic %s before writing', async (_name, value) => {
    await expect(
      check(
        `export default { stories: [] }`,
        `export default { parameters: { options: { storySort: ${value} } } }`
      )
    ).rejects.toThrow('Move it manually to top-level storySort');
    expect(fsp.writeFile).not.toHaveBeenCalled();
  });
});
