import { readFile, writeFile } from 'node:fs/promises';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { formatExistingFile, type JsPackageManager } from 'storybook/internal/common';
import { generate, types as t } from 'storybook/internal/babel';
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
  expect(loadConfig(migrated.main).parse().getValue(['storySorts'])).toEqual([storySort]);
  expect(
    loadConfig(migrated.preview).parse().get(['parameters', 'options', 'storySort'])
  ).toBeUndefined();
  return migrated;
};

const expectMovedFunction = async (main: string, preview: string, expectedSource: string) => {
  const migrated = await migrate(main, preview);
  expect(migrated.failures).toEqual([]);
  const sorters = loadConfig(migrated.main).parse().get(['storySorts']);
  expect(t.isArrayExpression(sorters)).toBe(true);
  const [first] = (sorters as t.ArrayExpression).elements;
  expect(generate(first as t.Expression).code).toBe(expectedSource);
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
  it.each([
    ['a static object', `export default { tags: ['test'] }`],
    ['a spread', `export default { ...shared }`],
    ['an imported factory argument', `export default definePreview(importedConfig)`],
    [
      'a computed options key',
      `export default { parameters: { options: { [key]: { order: ['Intro'] } } } }`,
    ],
  ])('does not apply to a preview without storySort that has %s', async (_name, preview) => {
    const migrated = await migrate(`export default { stories: [] }`, preview);

    expect(migrated.applies).toBe(false);
  });

  it('fails when storySort appears only outside the parameters, leaving both files untouched', async () => {
    await expectUntouched(
      `export default { stories: [] }`,
      `const unrelated = { storySort: { order: ['Intro'] } }; export default { tags: ['test'] }`
    );
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
  ])('moves storySort from %s', async (_name, preview) => {
    await expectMoved('export default { stories: [] }', preview, { order: ['Intro'] });
  });

  it('moves storySort and leaves an emptied shell when a spread before parameters blocks deeper pruning', async () => {
    const { preview } = await expectMoved(
      `export default { stories: [] }`,
      `export default { ...shared, parameters: { options: { storySort: { order: ['Intro'] } } } }`,
      { order: ['Intro'] }
    );

    expect(preview).toContain('...shared');
    expect(preview).toContain('parameters: {}');
  });

  it('moves storySort and leaves an emptied shell when a spread before options blocks deeper pruning', async () => {
    const { preview } = await expectMoved(
      `export default { stories: [] }`,
      `export default { parameters: { ...shared, options: { storySort: { order: ['Intro'] } } } }`,
      { order: ['Intro'] }
    );

    expect(preview).toContain('...shared');
    expect(preview).toContain('options: {}');
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
      'an options spread before storySort',
      `export default { parameters: { options: { ...shared, storySort: { order: ['Intro'] } } } }`,
    ],
    [
      'a computed key next to storySort',
      `export default { parameters: { options: { [key]: legacy, storySort: { order: ['Intro'] } } } }`,
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
      'a root spread after parameters',
      `export default { parameters: { options: { storySort: { order: ['Intro'] } } }, ...shared }`,
    ],
    [
      'a parameters spread after options',
      `export default { parameters: { options: { storySort: { order: ['Intro'] } }, ...shared } }`,
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
    [
      'existing storySorts',
      `export default { stories: [], storySorts: [{ order: ['Existing'] }] }`,
    ],
    [
      'a storySorts method',
      `export default { stories: [], storySorts(sorters) { return sorters } }`,
    ],
    [
      'a storySorts getter',
      `export default { stories: [], get storySorts() { return existingSorters } }`,
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
      `const existing = { order: ['Runtime'] }; const config = { stories: [] }; Object.assign(config, { storySorts: [existing] }); module.exports = config`,
    ],
  ])('leaves both files untouched for a main with %s', async (_name, main) => {
    await expectUntouched(main, legacy);
  });

  it('does not apply again once storySort lives in the main storySorts', async () => {
    const { main, preview } = await expectMoved(`export default { stories: [] }`, legacy, {
      order: ['Legacy'],
    });

    expect((await migrate(main, preview)).applies).toBe(false);
  });

  it('moves a comparator function with its source intact', async () => {
    await expectMovedFunction(
      `export default { stories: [] }`,
      `export default { parameters: { options: { storySort: (a, b) => a.title.localeCompare(b.title) } } }`,
      `(a, b) => a.title.localeCompare(b.title)`
    );
  });

  it('moves a storySort method as a function', async () => {
    await expectMovedFunction(
      `export default { stories: [] }`,
      `export default { parameters: { options: { storySort(a, b) { return 0 } } } }`,
      `function (a, b) {\n  return 0;\n}`
    );
  });

  it('moves a comparator that only reaches the global undefined', async () => {
    await expectMovedFunction(
      `export default { stories: [] }`,
      `export default { parameters: { options: { storySort: (a, b) => a.title.localeCompare(b.title, undefined, { numeric: true }) } } }`,
      `(a, b) => a.title.localeCompare(b.title, undefined, {\n  numeric: true\n})`
    );
  });

  it('leaves both files untouched when the comparator references a preview binding', async () => {
    await expectUntouched(
      `export default { stories: [] }`,
      `const order = ['Intro']; export default { parameters: { options: { storySort: (a, b) => order.indexOf(a) - order.indexOf(b) } } }`
    );
  });

  it('leaves both files untouched when both the default and the named export define storySort', async () => {
    const { main, preview, failures } = await migrate(
      `export default { stories: [] }`,
      `export const parameters = { options: { storySort: { order: ['Named'] } } }; export default { parameters: { options: { storySort: { order: ['Default'] } } } }`
    );

    expect(failures).toEqual([
      {
        file: mainConfigPath,
        kind: 'main',
        message: expect.stringContaining('Cannot automigrate storySort'),
      },
    ]);
    expect(loadConfig(main).parse().get(['storySorts'])).toBeUndefined();
    expect(preview).toContain(`order: ['Named']`);
    expect(preview).toContain(`order: ['Default']`);
  });

  it('moves the default storySort when the named export has none and prunes the emptied default copy', async () => {
    const { main, preview, failures } = await migrate(
      `export default { stories: [] }`,
      `export const parameters = { docs: {} }; export default { parameters: { options: { storySort: { order: ['Intro'] } } } }`
    );

    expect(failures).toEqual([]);
    expect(loadConfig(main).parse().getValue(['storySorts'])).toEqual([{ order: ['Intro'] }]);
    expect(preview).not.toContain(`order: ['Intro']`);
    expect(preview).not.toContain('storySort');
    expect(preview).toContain('docs: {}');
  });

  it('leaves both files untouched when the comparator shadows a preview binding in a nested function', async () => {
    await expectUntouched(
      `export default { stories: [] }`,
      `const x = 'x'; export default { parameters: { options: { storySort: (a, b) => { const f = (x) => x; return x < a } } } }`
    );
  });

  it('moves storySort shadowed by a later default export that also defines parameters', async () => {
    const { main, preview } = await expectMovedFunction(
      `import type { StorybookConfig } from '@storybook/nextjs-vite';\n\nconst config: StorybookConfig = {\n  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],\n};\n\nexport default config;\n`,
      `export const parameters = {\n  options: {\n    storySort: (a, b) =>\n      a.title.localeCompare(b.title, undefined, { numeric: true }),\n  },\n};\n\nexport default {\n  parameters: {\n    layout: 'fullscreen',\n  },\n};\n`,
      `(a, b) => a.title.localeCompare(b.title, undefined, {\n  numeric: true\n})`
    );

    expect(main).toContain(`stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)']`);
    expect(preview).not.toContain('storySort');
    expect(preview).toContain(`layout: 'fullscreen'`);
  });

  it('moves storySort when the shadowing default export resolves to a const', async () => {
    const { preview } = await expectMovedFunction(
      `import type { StorybookConfig } from '@storybook/nextjs-vite';\n\nconst config: StorybookConfig = {\n  stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],\n};\n\nexport default config;\n`,
      `export const parameters = {\n  options: {\n    storySort: (a: any, b: any) =>\n      a.title.localeCompare(b.title, undefined, { numeric: true }),\n  },\n};\n\nconst defaultParameters = {\n  parameters: {\n    layout: 'fullscreen',\n  },\n};\n\nexport default defaultParameters;\n`,
      `(a: any, b: any) => a.title.localeCompare(b.title, undefined, {\n  numeric: true\n})`
    );

    expect(preview).not.toContain('storySort');
    expect(preview).toContain(`layout: 'fullscreen'`);
  });

  it('moves a function-expression storySort shadowed by a later default export', async () => {
    const { preview } = await expectMovedFunction(
      `export default { stories: [] }`,
      `export const parameters = {\n  options: {\n    storySort: function (a, b) {\n      return a.title.localeCompare(b.title);\n    },\n  },\n};\n\nexport default {\n  parameters: {\n    layout: 'fullscreen',\n  },\n};\n`,
      `function (a, b) {\n  return a.title.localeCompare(b.title);\n}`
    );

    expect(preview).not.toContain('storySort');
    expect(preview).toContain(`layout: 'fullscreen'`);
  });

  it('moves a statically readable storySort shadowed by a later default export', async () => {
    const { main, preview, failures } = await migrate(
      `export default { stories: [] }`,
      `export const parameters = { options: { storySort: { order: ['Intro'] } } };\n\nexport default {\n  parameters: {\n    layout: 'fullscreen',\n  },\n};\n`
    );

    expect(failures).toEqual([]);
    expect(loadConfig(main).parse().getValue(['storySorts'])).toEqual([{ order: ['Intro'] }]);
    expect(preview).not.toContain('storySort');
    expect(preview).toContain(`layout: 'fullscreen'`);
  });

  it('leaves both files untouched when a spread after storySort can override it in the shadowed export', async () => {
    const { main, preview, failures } = await migrate(
      `export default { stories: [] }`,
      `export const parameters = { options: { storySort: { order: ['Intro'] }, ...shared } }; export default { parameters: { other: 1 } }`
    );

    expect(failures).toEqual([
      {
        file: mainConfigPath,
        kind: 'main',
        message: expect.stringContaining('Cannot automigrate storySort'),
      },
    ]);
    expect(loadConfig(main).parse().get(['storySorts'])).toBeUndefined();
    expect(preview).toContain('storySort');
  });

  it('migrates the reported shape: imports-plus-default main and a mixed preview with a comparator', async () => {
    const { main, preview, failures } = await migrate(
      `import type { StorybookConfig } from '@storybook/nextjs-vite';\n\nconst config: StorybookConfig = {\n  stories: ['../src/**/*.stories.*'],\n};\n\nexport default config;\n`,
      `import type { Preview } from '@storybook/nextjs-vite'\n\nconst preview: Preview = {\n  parameters: {\n    layout: 'centered',\n  },\n};\n\nexport default preview;\n\nexport const globalTypes = {\n  theme: { defaultValue: 'light' },\n};\n\nexport const parameters = {\n  layout: 'centered',\n  options: {\n    storySort: (a: any, b: any) =>\n      a.title.localeCompare(b.title, undefined, { numeric: true }),\n  },\n};\n`
    );

    expect(failures).toEqual([]);
    const sorters = loadConfig(main).parse().get(['storySorts']);
    const [first] = (sorters as t.ArrayExpression).elements;
    expect(generate(first as t.Expression).code).toContain('localeCompare');
    expect(generate(first as t.Expression).code).toContain('numeric');
    expect(main).toContain(`stories: ['../src/**/*.stories.*']`);
    expect(preview).not.toContain('storySort');
    expect(preview).toContain('globalTypes');
    // Both exports keep their own layout copy; only the ignored storySort property is pruned.
    expect(preview.match(/layout: 'centered'/g)).toHaveLength(2);
  });
});
