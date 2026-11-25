import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { formatExistingFile, JsPackageManager } from 'storybook/internal/common';

import { fs, vol } from 'memfs';

import { checkFix, runFix } from '../helpers/fix-test-utils.ts';
import { argtypesDefaultValue } from './argtypes-default-value.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('storybook/internal/common', { spy: true });

const previewConfigPath = resolve('.storybook/preview.ts');
const storyPath = resolve('src/Button.stories.ts');
const options = {
  packageManager: vi.mocked(JsPackageManager.prototype),
  mainConfig: { stories: [] },
  mainConfigPath: resolve('.storybook/main.ts'),
  configDir: resolve('.storybook'),
  storybookVersion: '11.0.0',
  previewConfigPath,
  storiesPaths: [storyPath],
};

const migrate = async (files: { preview?: string; story?: string }, storiesPaths = [storyPath]) => {
  vol.fromJSON({
    [previewConfigPath]: files.preview ?? 'export default {};',
    [storyPath]: files.story ?? 'export default {};',
  });
  const failures = await runFix(argtypesDefaultValue, {
    ...options,
    storiesPaths,
    result: {},
  });
  return {
    failures,
    preview: fs.readFileSync(previewConfigPath, 'utf8') as string,
    story: fs.readFileSync(storyPath, 'utf8') as string,
  };
};

describe('argtypes-default-value', () => {
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

  it('does not apply when defaultValue is only the docs-table field', async () => {
    vol.fromJSON({
      [previewConfigPath]:
        "export default { globalTypes: { locale: { defaultValue: 'en' } }, argTypes: { label: { table: { defaultValue: { summary: 'Hi' } } } } };",
      [storyPath]: 'export default {};',
    });

    expect(await checkFix(argtypesDefaultValue, options)).toBeNull();
  });

  it('deletes a static argTypes defaultValue and leaves args, table.defaultValue, and globalTypes', async () => {
    const { failures, preview, story } = await migrate({
      preview: [
        'export default {',
        "  globalTypes: { locale: { defaultValue: 'en' } },",
        '  argTypes: {',
        "    label: { defaultValue: 'Preview', control: 'text' },",
        '  },',
        '};',
      ].join('\n'),
      story: [
        'export default {',
        '  args: { label: "Keep" },',
        '  argTypes: {',
        "    label: { defaultValue: 'Meta', table: { defaultValue: { summary: 'Shown' } } },",
        '  },',
        '};',
        'export const Primary = {',
        "  argTypes: { value: { 'defaultValue': 0, control: 'number' } },",
        '};',
      ].join('\n'),
    });

    expect(failures).toEqual([]);
    expect(preview).toContain("defaultValue: 'en'");
    expect(preview).not.toContain("defaultValue: 'Preview'");
    expect(preview).toContain("control: 'text'");
    expect(story).toContain('label: "Keep"');
    expect(story).not.toContain("defaultValue: 'Meta'");
    expect(story).toContain("summary: 'Shown'");
    expect(story).not.toContain("'defaultValue': 0");
    expect(story).toContain("control: 'number'");
  });

  it('leaves a preview with default and named exports and no argTypes', async () => {
    const preview = [
      'export const withTheme = (Story) => Story();',
      "export default { decorators: [withTheme], globalTypes: { theme: { defaultValue: 'light' } } };",
    ].join('\n');
    const result = await migrate({ preview });

    expect(result.failures).toEqual([]);
    expect(result.preview).toBe(preview);
  });

  it('leaves a factory call unchanged when the editor cannot remove it', async () => {
    const story = [
      'const makeArgType = (argType) => argType;',
      "export default { argTypes: { label: makeArgType({ defaultValue: 'Hi' }) } };",
    ].join('\n');
    const result = await migrate({ story });

    expect(result.failures).toEqual([
      { file: storyPath, kind: 'story', message: expect.stringContaining('Cannot mutate') },
    ]);
    expect(result.story).toBe(story);
  });

  it('deletes an explicit defaultValue that sits beside a spread', async () => {
    const result = await migrate({
      story:
        "import { shared } from './shared';\nexport default { argTypes: { ...shared, label: { defaultValue: 'A', control: 'text' } } };",
    });

    expect(result.failures).toEqual([]);
    expect(result.story).toContain('...shared');
    expect(result.story).toContain("control: 'text'");
    expect(result.story).not.toContain("defaultValue: 'A'");
  });

  it('deletes a static defaultValue on a CSF2 StoryFn argTypes assignment', async () => {
    const result = await migrate({
      story: [
        "import type { StoryFn } from '@storybook/react';",
        'export default { title: "Example" };',
        'export const Playground: StoryFn = () => null;',
        'Playground.argTypes = { autoTruncateTokens: { defaultValue: false, control: { type: "boolean" } } };',
      ].join('\n'),
    });

    expect(result.failures).toEqual([]);
    expect(result.story).toContain('Playground.argTypes');
    expect(result.story).toContain('type: "boolean"');
    expect(result.story).not.toContain('defaultValue');
  });

  it('migrates a story declared as another story through the story it names', async () => {
    const result = await migrate({
      story: [
        'export default { title: "Example" };',
        "export const Primary = { argTypes: { label: { defaultValue: 'A', control: 'text' } } };",
        'export const Secondary = Primary;',
        'export const Tertiary = Secondary as typeof Primary;',
      ].join('\n'),
    });

    expect(result.failures).toEqual([]);
    expect(result.story).toContain("control: 'text'");
    expect(result.story).not.toContain('defaultValue');
    expect(result.story).toContain('export const Secondary = Primary;');
  });

  it('migrates a story exported under two names through its first export', async () => {
    const result = await migrate({
      story: [
        'export default { title: "Example" };',
        "export const Primary = { argTypes: { label: { defaultValue: 'A', control: 'text' } } };",
        'export { Primary as Secondary };',
        'export const Tertiary = Primary;',
        'export { Tertiary as Quaternary };',
      ].join('\n'),
    });

    expect(result.failures).toEqual([]);
    expect(result.story).not.toContain('defaultValue');
    expect(result.story).toContain('export { Primary as Secondary };');
  });

  it('fails a story exported under two names when its first export cannot be edited', async () => {
    const story = [
      'export default { title: "Example" };',
      "export const Primary = makeStory({ argTypes: { label: { defaultValue: 'A' } } });",
      'export { Primary as Secondary };',
    ].join('\n');
    const result = await migrate({ story });

    expect(result.failures).toEqual([
      { file: storyPath, kind: 'story', message: expect.stringContaining('Primary') },
    ]);
    expect(result.story).toBe(story);
  });

  it('fails a story declared as a value it cannot edit', async () => {
    const story = [
      'export default { title: "Example" };',
      "const base = { argTypes: { label: { defaultValue: 'A' } } };",
      "export const Primary = { argTypes: { label: { defaultValue: 'B' } } };",
      'export const Secondary = base;',
    ].join('\n');
    const result = await migrate({ story });

    expect(result.failures).toEqual([
      {
        file: storyPath,
        kind: 'story',
        message: expect.stringContaining('Secondary'),
      },
    ]);
    expect(result.story).toBe(story);
  });

  it('fails an alias of a story it cannot edit, through that story', async () => {
    const story = [
      'export default { title: "Example" };',
      "export const Primary = makeStory({ argTypes: { label: { defaultValue: 'A' } } });",
      'export const Secondary = Primary;',
    ].join('\n');
    const result = await migrate({ story });

    expect(result.failures).toEqual([
      { file: storyPath, kind: 'story', message: expect.stringContaining('Primary') },
    ]);
    expect(result.story).toBe(story);
  });

  it('fails a story whose alias receives an assignment, through that story', async () => {
    const story = [
      'export default { title: "Example" };',
      "export const Primary = { argTypes: { label: { defaultValue: 'A' } } };",
      'export const Secondary = Primary;',
      "Secondary.args = { label: 'B' };",
    ].join('\n');
    const result = await migrate({ story });

    expect(result.failures).toEqual([
      {
        file: storyPath,
        kind: 'story',
        message: expect.stringContaining('Cannot mutate Primary because Secondary, an alias of it'),
      },
    ]);
    expect(result.story).toBe(story);
  });

  it('leaves a spread inside the arg unchanged when the editor cannot remove it', async () => {
    const story =
      "import { shared } from './shared';\nexport default { argTypes: { label: { ...shared, defaultValue: 'A' } } };";
    const result = await migrate({ story });

    expect(result.failures).toEqual([
      { file: storyPath, kind: 'story', message: expect.stringContaining('Cannot mutate') },
    ]);
    expect(result.story).toBe(story);
  });

  it('skips args it cannot read when they show no defaultValue', async () => {
    const result = await migrate({
      story: [
        "import { HiddenArgType, intlArgType, PaletteArgType } from './helpers';",
        "const translations = { label: 'Label' };",
        'export default {',
        '  argTypes: {',
        "    intl: intlArgType(translations, 'Label'),",
        "    size: { defaultValue: 'M', table: { defaultValue: { summary: 'M' } } },",
        '  },',
        '};',
        'export const Primary = {',
        '  argTypes: {',
        "    label: { table: { defaultValue: { summary: 'Hi' } } },",
        '    prefix: HiddenArgType,',
        '    ...PaletteArgType,',
        '  },',
        '};',
      ].join('\n'),
    });

    expect(result.failures).toEqual([]);
    expect(result.story).not.toContain("defaultValue: 'M'");
    expect(result.story).toContain("intl: intlArgType(translations, 'Label')");
    expect(result.story).toContain("summary: 'Hi'");
  });

  it('fails an arg it cannot read when it shows a defaultValue', async () => {
    const story = [
      "import { shared } from './shared';",
      "export default { argTypes: { label: { defaultValue: 'A' }, ...shared } };",
    ].join('\n');
    const result = await migrate({ story });

    expect(result.failures).toEqual([
      { file: storyPath, kind: 'story', message: expect.stringContaining('argTypes.label') },
    ]);
    expect(result.story).toBe(story);
  });

  it('fails an arg it cannot read when a local constant shows a defaultValue', async () => {
    for (const arg of ['make(base)', "{ ...base, control: 'text' }"]) {
      const story = [
        "const base = { defaultValue: 'A' };",
        `export default { argTypes: { label: ${arg} } };`,
      ].join('\n');
      const result = await migrate({ story });

      expect(result.failures).toEqual([
        { file: storyPath, kind: 'story', message: expect.stringContaining('argTypes.label') },
      ]);
      expect(result.story).toBe(story);
    }
  });

  it('fails an arg a later local spread shows a defaultValue for', async () => {
    const story = [
      "const shared = { label: { defaultValue: 'A' } };",
      "export default { argTypes: { label: { control: 'text' }, ...shared } };",
    ].join('\n');
    const result = await migrate({ story });

    expect(result.failures).toEqual([
      {
        file: storyPath,
        kind: 'story',
        message: expect.stringContaining('argTypes.*.defaultValue'),
      },
    ]);
    expect(result.story).toBe(story);
  });

  it('fails an arg read with brackets from a local constant that shows a defaultValue', async () => {
    const story = [
      "const types = { label: { defaultValue: 'A' } };",
      "export default { argTypes: { label: types['label'] } };",
    ].join('\n');
    const result = await migrate({ story });

    expect(result.failures).toEqual([
      { file: storyPath, kind: 'story', message: expect.stringContaining('argTypes.label') },
    ]);
    expect(result.story).toBe(story);
  });

  it('fails an arg a local function declaration shows a defaultValue for', async () => {
    const story = [
      "function arg() { return { defaultValue: 'A' }; }",
      'export default { argTypes: { label: arg() } };',
    ].join('\n');
    const result = await migrate({ story });

    expect(result.failures).toEqual([
      { file: storyPath, kind: 'story', message: expect.stringContaining('argTypes.label') },
    ]);
    expect(result.story).toBe(story);
  });

  it('skips a file whose only defaultValue is a prop in args', async () => {
    const story = [
      "import { shared } from './shared';",
      "export default { ...shared, args: { defaultValue: 'hello' } };",
      'function createVariantsStory(layout: string) { return () => layout; }',
      "export const Horizontal = createVariantsStory('horizontal');",
      "Horizontal.args = { defaultValue: 'bye' };",
    ].join('\n');
    const result = await migrate({ story });

    expect(result.failures).toEqual([]);
    expect(result.story).toBe(story);
  });

  it('deletes the defaultValue of an arg named args', async () => {
    const result = await migrate({
      story: "export default { argTypes: { args: { defaultValue: 'x', control: 'text' } } };",
    });

    expect(result.failures).toEqual([]);
    expect(result.story).toContain("control: 'text'");
    expect(result.story).not.toContain('defaultValue');
  });

  it('skips a file whose arg named defaultValue has none, beside a story it cannot read', async () => {
    const story = [
      "export default { argTypes: { defaultValue: { control: 'text' } } };",
      'function createVariantsStory(layout: string) { return () => layout; }',
      "export const Horizontal = createVariantsStory('horizontal');",
    ].join('\n');
    const result = await migrate({ story });

    expect(result.failures).toEqual([]);
    expect(result.story).toBe(story);
  });

  it('skips a story a helper builds from destructured imports and reassigned locals', async () => {
    const story = [
      "import { ATTRIBUTES } from './resources';",
      'const { dir } = ATTRIBUTES;',
      'export default { args: { dir: dir.defaultValue } };',
      'function make(layout: string) {',
      '  let selected = false;',
      '  selected = layout === dir.defaultValue;',
      '  return () => `${selected}`;',
      '}',
      "export const Horizontal = make('horizontal');",
    ].join('\n');
    const result = await migrate({ story });

    expect(result.failures).toEqual([]);
    expect(result.story).toBe(story);
  });

  it('deletes a defaultValue beside a story spread it cannot read', async () => {
    const result = await migrate({
      story: [
        "import { Base } from './base';",
        "export default { argTypes: { size: { defaultValue: 'M', control: 'text' } } };",
        'export const A = { ...Base, args: { a: 1 } };',
      ].join('\n'),
    });

    expect(result.failures).toEqual([]);
    expect(result.story).not.toContain('defaultValue');
    expect(result.story).toContain('...Base');
  });

  it('deletes a defaultValue from argTypes declared as a constant', async () => {
    const result = await migrate({
      story: [
        "const argTypes = { label: { defaultValue: 'A', control: 'text' } };",
        'export default { argTypes };',
      ].join('\n'),
    });

    expect(result.failures).toEqual([]);
    expect(result.story).not.toContain('defaultValue');
    expect(result.story).toContain("control: 'text'");
  });

  it('fails a local spread in argTypes that shows a defaultValue', async () => {
    const story = [
      "const shared = { label: { defaultValue: 'A' } };",
      'export default { argTypes: { ...shared } };',
    ].join('\n');
    const result = await migrate({ story });

    expect(result.failures).toEqual([
      { file: storyPath, kind: 'story', message: expect.stringContaining('spread field') },
    ]);
    expect(result.story).toBe(story);
  });

  it.each(['satisfies object', 'as const'])(
    'deletes a defaultValue from argTypes written with %s',
    async (suffix) => {
      const result = await migrate({
        story: `export default { argTypes: { label: { defaultValue: 'A', control: 'text' } } ${suffix} };`,
      });

      expect(result.failures).toEqual([]);
      expect(result.story).not.toContain('defaultValue');
      expect(result.story).toContain(suffix);
    }
  );

  it.each(["cond ? { label: { defaultValue: 'A' } } : {}", "mk({ label: { defaultValue: 'A' } })"])(
    'fails argTypes written as %s, which shows a defaultValue',
    async (argTypes) => {
      const story = `export default { argTypes: ${argTypes} };`;
      const result = await migrate({ story });

      expect(result.failures).toEqual([
        {
          file: storyPath,
          kind: 'story',
          message: expect.stringContaining('argTypes.*.defaultValue'),
        },
      ]);
      expect(result.story).toBe(story);
    }
  );

  it('fails a story a helper builds from one of several destructured names', async () => {
    const story = [
      'const { base, config } = {',
      '  base: {},',
      "  config: { argTypes: { label: { defaultValue: 'A' } } },",
      '};',
      'export default {};',
      'export const Primary = makeStory(base, config);',
    ].join('\n');
    const result = await migrate({ story });

    expect(result.failures).toEqual([
      { file: storyPath, kind: 'story', message: expect.stringContaining('Primary') },
    ]);
    expect(result.story).toBe(story);
  });

  it('fails an annotation on a factory-shaped story it cannot read', async () => {
    const story = [
      "import { helpers } from './helpers';",
      'export default {};',
      'export const Primary = helpers.variants.story();',
      "Primary.argTypes = { label: { defaultValue: 'A' } };",
    ].join('\n');
    const result = await migrate({ story });

    expect(result.failures).toEqual([
      { file: storyPath, kind: 'story', message: expect.stringContaining('Primary') },
    ]);
    expect(result.story).toBe(story);
  });

  it('skips an arg a class builds without a defaultValue', async () => {
    const story = [
      "class Arg { constructor() { this.control = 'text'; } }",
      "export default { argTypes: { label: new Arg(), size: { defaultValue: 'M' } } };",
    ].join('\n');
    const result = await migrate({ story });

    expect(result.failures).toEqual([]);
    expect(result.story).toContain('label: new Arg()');
    expect(result.story).not.toContain("defaultValue: 'M'");
  });

  it('skips an arg whose helper refers to a defaultValue only in a type', async () => {
    const story = [
      "const defaults = { defaultValue: 'unused' };",
      "function arg<T = typeof defaults>() { return { control: 'text' }; }",
      "export default { argTypes: { label: arg(), size: { defaultValue: 'M' } } };",
    ].join('\n');
    const result = await migrate({ story });

    expect(result.failures).toEqual([]);
    expect(result.story).toContain('label: arg()');
    expect(result.story).not.toContain("defaultValue: 'M'");
  });

  it('deletes the defaultValue of an arg named table', async () => {
    const result = await migrate({
      story: "export default { argTypes: { table: { defaultValue: 'x', control: 'text' } } };",
    });

    expect(result.failures).toEqual([]);
    expect(result.story).toContain("control: 'text'");
    expect(result.story).not.toContain('defaultValue');
  });

  it('skips a file that only reads a defaultValue', async () => {
    const story = [
      "import { shared } from './shared';",
      "import { dir } from './resources';",
      'export default { ...shared, args: { dir: dir.defaultValue } };',
      'export const Primary = { args: { dir: dir.defaultValue }, ...shared };',
    ].join('\n');
    const result = await migrate({ story });

    expect(result.failures).toEqual([]);
    expect(result.story).toBe(story);
  });

  it('skips a story it cannot read when it shows no defaultValue', async () => {
    const story = [
      "import { dir } from './resources';",
      "export default { args: { dir: dir.defaultValue }, argTypes: { dir: { control: 'select' } } };",
      'function createVariantsStory(layout: string): () => string {',
      "  return () => `<tile-group layout='${layout}'></tile-group>`;",
      '}',
      "export const Horizontal = createVariantsStory('horizontal');",
    ].join('\n');
    const result = await migrate({ story });

    expect(result.failures).toEqual([]);
    expect(result.story).toBe(story);
  });

  it('does not edit an MDX story', async () => {
    const docsPath = resolve('src/Intro.mdx');
    const source = '<Meta argTypes={{ value: { defaultValue: 0 } }} />';
    vol.fromJSON({
      [previewConfigPath]: 'export default {};',
      [docsPath]: source,
    });

    const failures = await runFix(argtypesDefaultValue, {
      ...options,
      storiesPaths: [docsPath],
      result: {},
    });

    expect(failures).toEqual([]);
    expect(fs.readFileSync(docsPath, 'utf8')).toBe(source);
  });
});
