import { readFile, writeFile } from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { formatExistingFile, type JsPackageManager } from 'storybook/internal/common';
import { loadConfig } from 'storybook/internal/csf-tools';

import { fs, vol } from 'memfs';

import { checkFix, runFix } from '../helpers/fix-test-utils.ts';
import { storySortToMain } from './story-sort-to-main.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('storybook/internal/common', { spy: true });

const mainConfigPath = '/project/.storybook/main.ts';
const previewConfigPath = '/project/.storybook/preview.ts';

const options = {
  packageManager: {} as JsPackageManager,
  configDir: '/project/.storybook',
  mainConfig: { stories: [] },
  mainConfigPath,
  previewConfigPath,
  storybookVersion: '11.0.0',
  storiesPaths: [],
};

const migrate = async (main: string, preview: string) => {
  vol.fromJSON({ [mainConfigPath]: main, [previewConfigPath]: preview });
  const result = await checkFix(storySortToMain, options);
  const failures = result ? await runFix(storySortToMain, { ...options, result }) : [];
  return {
    applies: result !== null,
    failures,
    main: fs.readFileSync(mainConfigPath, 'utf8') as string,
    preview: fs.readFileSync(previewConfigPath, 'utf8') as string,
  };
};

const expectMoved = async (main: string, preview: string, storySort: unknown) => {
  const migrated = await migrate(main, preview);
  expect(migrated.failures).toEqual([]);
  expect(loadConfig(migrated.main).parse().getValue(['storySort'])).toEqual(storySort);
  expect(
    loadConfig(migrated.preview).parse().get(['parameters', 'options', 'storySort'])
  ).toBeUndefined();
  return migrated;
};

const expectUntouched = async (main: string, preview: string) => {
  const migrated = await migrate(main, preview);
  expect(migrated.failures).toEqual([
    {
      file: mainConfigPath,
      kind: 'main',
      message: expect.stringContaining('Cannot automigrate storySort'),
    },
  ]);
  expect(migrated.main).toBe(main);
  expect(migrated.preview).toBe(preview);
};

const legacy = `export default { parameters: { options: { storySort: { order: ['Legacy'] } } } }`;

beforeEach(() => {
  vol.reset();
  vi.mocked(readFile).mockImplementation(fs.promises.readFile as typeof readFile);
  vi.mocked(writeFile).mockImplementation(fs.promises.writeFile as typeof writeFile);
  vi.mocked(formatExistingFile).mockImplementation(async (_path, source) => source);
});

afterEach(() => {
  vi.mocked(readFile).mockRestore();
  vi.mocked(writeFile).mockRestore();
});

describe('story-sort-to-main', () => {
  it('does not apply when the preview has no storySort', async () => {
    const migrated = await migrate(
      `export default { stories: [] }`,
      `const unrelated = { storySort: { order: ['Intro'] } }; export default { tags: ['test'] }`
    );

    expect(migrated.applies).toBe(false);
  });

  it('moves a literal object and keeps unrelated configuration', async () => {
    const { preview } = await expectMoved(
      `export default { stories: ['./src/**/*.stories.ts'] }`,
      `export default { parameters: { options: { storySort: { order: ['Intro', '*'], method: 'alphabetical' }, showPanel: false }, docs: { source: {} } } }`,
      { order: ['Intro', '*'], method: 'alphabetical' }
    );

    expect(preview).toContain('showPanel: false');
    expect(preview).toContain('docs: { source: {} }');
  });

  it('moves a literal array and prunes the containers it empties', async () => {
    const { preview } = await expectMoved(
      `export default { stories: [] }`,
      `export default { parameters: { options: { storySort: ['Intro', ['Start', '*']] } }, tags: ['test'] }`,
      ['Intro', ['Start', '*']]
    );

    expect(preview).not.toContain('parameters');
    expect(preview).toContain(`tags: ['test']`);
  });

  it('moves storySort from a named parameters export and keeps sibling declarators', async () => {
    const { preview } = await expectMoved(
      `const config = { stories: [] }; export default config;`,
      `export const parameters = { options: { storySort: { order: ['Intro'] } } }, tags = ['test'];`,
      { order: ['Intro'] }
    );

    expect(preview).not.toContain('parameters');
    expect(preview).toContain(`tags = ['test']`);
  });

  it('inlines a local constant, so main does not reference the preview module', async () => {
    const { main } = await expectMoved(
      `export default { stories: [] }`,
      `const sortOrder = ['Intro', ['Start', '*']]; export default { parameters: { options: { storySort: { order: sortOrder } } } };`,
      { order: ['Intro', ['Start', '*']] }
    );

    expect(main).not.toContain('sortOrder');
  });

  it.each([
    ['satisfies', `({ order: ['Intro'] } satisfies Record<string, unknown>)`, { order: ['Intro'] }],
    ['as const', `(['Intro', '*'] as const)`, ['Intro', '*']],
  ])('moves a static value wrapped with %s', async (_name, storySort, value) => {
    await expectMoved(
      `export default { stories: [] }`,
      `export default { parameters: { options: { storySort: ${storySort} } } }`,
      value
    );
  });

  it.each([
    [
      'an options identifier',
      `const options = { storySort: { order: ['Intro'] } }; export default { parameters: { options } }`,
    ],
    [
      'definePreview',
      `export default definePreview({ parameters: { options: { storySort: { order: ['Intro'] } } } })`,
    ],
    [
      'a root export identifier',
      `const config = { parameters: { options: { storySort: { order: ['Intro'] } } } }; export default config`,
    ],
    [
      'a parameters shorthand',
      `const parameters = { options: { storySort: { order: ['Intro'] } } }; export default { parameters }`,
    ],
    [
      'a named export specifier',
      `const parameters = { options: { storySort: { order: ['Intro'] } } }; export { parameters }`,
    ],
    [
      'a CommonJS root',
      `const config = { parameters: { options: { storySort: { order: ['Intro'] } } } }; module.exports = config`,
    ],
    [
      'a root computed property',
      `export default { [key]: legacy, parameters: { options: { storySort: { order: ['Intro'] } } } }`,
    ],
    [
      'a parameters computed property',
      `export default { parameters: { [key]: legacy, options: { storySort: { order: ['Intro'] } } } }`,
    ],
    [
      'a root spread before parameters',
      `export default { ...shared, parameters: { options: { storySort: { order: ['Intro'] } } } }`,
    ],
    [
      'a parameters spread before options',
      `export default { parameters: { ...shared, options: { storySort: { order: ['Intro'] } } } }`,
    ],
  ])('moves storySort from %s', async (_name, preview) => {
    await expectMoved('export default { stories: [] }', preview, { order: ['Intro'] });
  });

  it.each([
    ['a direct object', `module.exports = { stories: [] }`],
    ['a const object alias', `const config = { stories: [] }; module.exports = config`],
    ['a known factory', `module.exports = definePreview({ stories: [] })`],
    [
      'a known factory alias',
      `const config = definePreview({ stories: [] }); module.exports = config satisfies StorybookConfig`,
    ],
  ])('moves storySort into a CommonJS main with %s', async (_name, main) => {
    await expectMoved(main, legacy, { order: ['Legacy'] });
  });

  it.each([
    [
      'a preview spread',
      `const legacy = { parameters: { options: { storySort: { order: ['Intro'] } } } }; export default { ...legacy }`,
    ],
    [
      'Object.assign',
      `export default Object.assign({ parameters: { options: { storySort: { order: ['First'] } } } }, { parameters: { options: { storySort: { order: ['Second'] } } } })`,
    ],
    [
      'a CommonJS bracket root',
      `const config = { parameters: { options: { storySort: { order: ['Intro'] } } } }; module['exports'] = config`,
    ],
    [
      'an options computed property',
      `export default { parameters: { options: { [key]: legacy, storySort: { order: ['Intro'] } } } }`,
    ],
    [
      'a root spread after parameters',
      `export default { parameters: { options: { storySort: { order: ['Intro'] } } }, ...shared }`,
    ],
    [
      'a parameters spread after options',
      `export default { parameters: { options: { storySort: { order: ['Intro'] } }, ...shared } }`,
    ],
    [
      'an options spread before storySort',
      `export default { parameters: { options: { ...shared, storySort: { order: ['Intro'] } } } }`,
    ],
    [
      'an options spread after storySort',
      `export default { parameters: { options: { storySort: { order: ['Intro'] }, ...shared } } }`,
    ],
    [
      'a definePreview spread',
      `const legacy = { parameters: { options: { storySort: { order: ['Intro'] } } } }; export default definePreview({ ...legacy })`,
    ],
    [
      'an aliased preview factory spread',
      `const legacy = { parameters: { options: { storySort: { order: ['Intro'] } } } }; export default makePreview({ ...legacy })`,
    ],
    [
      'a namespace preview factory spread',
      `const legacy = { parameters: { options: { storySort: { order: ['Intro'] } } } }; export default preview.define({ ...legacy })`,
    ],
    [
      'a computed parameters key',
      `export default { [key]: { options: { storySort: { order: ['Intro'] } } } }`,
    ],
    [
      'a computed options key',
      `export default { parameters: { [key]: { storySort: { order: ['Intro'] } } } }`,
    ],
    [
      'a computed storySort key',
      `export default { parameters: { options: { [key]: { order: ['Intro'] } } } }`,
    ],
    [
      'both default and named exports',
      `export const parameters = { options: { storySort: { order: ['Named'] } } }; export default { parameters: { options: { storySort: { order: ['Default'] } } } }`,
    ],
    [
      'mixed default and named parameters roots',
      `export const parameters = { docs: {} }; export default { parameters: { options: { storySort: { order: ['Intro'] } } } }`,
    ],
    [
      'a storySort method',
      `export default { parameters: { options: { storySort(a, b) { return 0 } } } }`,
    ],
    [
      'a storySort getter',
      `export default { parameters: { options: { get storySort() { return legacy } } } }`,
    ],
    [
      'an options getter',
      `export default { parameters: { get options() { return { storySort: { order: ['Intro'] } } } } }`,
    ],
    [
      'a parameters getter',
      `export default { get parameters() { return { options: { storySort: { order: ['Intro'] } } } } }`,
    ],
    [
      'a parameters getter with control flow',
      `export default { get parameters() { if (enabled) return { options: { storySort: { order: ['Intro'] } } }; return {} } }`,
    ],
    [
      'a computed getter',
      `export default { get [key]() { return { options: { storySort: { order: ['Intro'] } } } } }`,
    ],
    [
      'duplicate storySort properties',
      `export default { parameters: { options: { storySort: { order: ['First'] }, storySort: { order: ['Second'] } } } }`,
    ],
    [
      'duplicate parameters, storySort in the last',
      `export default { parameters: { docs: {} }, parameters: { options: { storySort: { order: ['Intro'] } } } }`,
    ],
    [
      'duplicate parameters, storySort in the first',
      `export default { parameters: { options: { storySort: { order: ['Intro'] } } }, parameters: { docs: {} } }`,
    ],
    [
      'duplicate options, storySort in the first',
      `export default { parameters: { options: { storySort: { order: ['Intro'] } }, options: { showPanel: false } } }`,
    ],
    [
      'duplicate options, storySort in the last',
      `export default { parameters: { options: { showPanel: false }, options: { storySort: { order: ['Intro'] } } } }`,
    ],
    [
      'a computed duplicate parameters',
      `export default { ['parameters']: { options: { storySort: { order: ['First'] } } }, parameters: { options: { storySort: { order: ['Second'] } } } }`,
    ],
    [
      'a parameters accessor next to parameters',
      `export default { get parameters() { return legacy }, parameters: { options: { storySort: { order: ['Intro'] } } } }`,
    ],
    [
      'a computed duplicate options',
      `export default { parameters: { ['options']: { storySort: { order: ['First'] } }, options: { storySort: { order: ['Second'] } } } }`,
    ],
    [
      'an options accessor next to options',
      `export default { parameters: { get options() { return legacy }, options: { storySort: { order: ['Intro'] } } } }`,
    ],
    [
      'a computed duplicate storySort',
      `export default { parameters: { options: { storySort: { order: ['First'] }, ['storySort']: { order: ['Second'] } } } }`,
    ],
    [
      'a comparator function',
      `export default { parameters: { options: { storySort: (a, b) => a.title.localeCompare(b.title) } } }`,
    ],
    ['an identifier', `export default { parameters: { options: { storySort } } }`],
    ['a call', `export default { parameters: { options: { storySort: createSort() } } }`],
    [
      'a value spread',
      `export default { parameters: { options: { storySort: { order: ['Intro'], ...shared } } } }`,
    ],
    [
      'a value computed key',
      `export default { parameters: { options: { storySort: { [key]: 'value' } } } }`,
    ],
  ])('leaves both files untouched for a preview with %s', async (_name, preview) => {
    await expectUntouched('export default { stories: [] }', preview);
  });

  it.each([
    ['an existing storySort', `export default { stories: [], storySort: { order: ['Existing'] } }`],
    ['a storySort method', `export default { stories: [], storySort(a, b) { return 0 } }`],
    [
      'a storySort getter',
      `export default { stories: [], get storySort() { return existingSort } }`,
    ],
    ['an unresolved spread', `const shared = { stories: [] }; export default { ...shared }`],
    ['a bracket CommonJS export', `module['exports'] = { stories: [] }`],
    ['a direct call wrapper', `export default configure({ stories: [] })`],
    [
      'an indirect call wrapper',
      `const config = configure({ stories: [] }); export default config satisfies StorybookConfig`,
    ],
    ['a chained call wrapper', `export default configure({ stories: [] }).finalize()`],
    ['a chained CommonJS factory', `module.exports = definePreview({ stories: [] }).finalize()`],
    [
      'a CommonJS alias assigned after its declaration',
      `let config; config = definePreview({ stories: [] }); module.exports = config`,
    ],
    [
      'a CommonJS alias mutated before the export',
      `const existing = { order: ['Runtime'] }; const config = { stories: [] }; Object.assign(config, { storySort: existing }); module.exports = config`,
    ],
  ])('leaves both files untouched for a main with %s', async (_name, main) => {
    await expectUntouched(main, legacy);
  });

  it('does not apply again once storySort lives in main', async () => {
    const { main, preview } = await expectMoved(`export default { stories: [] }`, legacy, {
      order: ['Legacy'],
    });

    expect((await migrate(main, preview)).applies).toBe(false);
  });
});
