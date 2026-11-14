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

  it('does not apply to argTypes it cannot read when no argType has a defaultValue', async () => {
    // Helper calls, spreads and story factories, beside `table.defaultValue` and an arg named so.
    const story = [
      "import { intlArgType, PaletteArgType, generateStory } from '../helpers';",
      'const { defaultValue } = PaletteArgType;',
      'export default {',
      "  args: { defaultValue: 'Hi' },",
      '  argTypes: {',
      "    intl: intlArgType('LinkTranslate'),",
      "    palette: { ...PaletteArgType, table: { category: 'inputs', defaultValue: { summary: defaultValue } } },",
      '  },',
      '};',
      "export const Select = generateStory({ name: 'Select', argTypes: { size: { table: { defaultValue: { summary: 'M' } } } } });",
    ].join('\n');
    vol.fromJSON({ [previewConfigPath]: 'export default {};', [storyPath]: story });

    expect(await checkFix(argtypesDefaultValue, options)).toBeNull();
    const result = await migrate({ story });
    expect(result.failures).toEqual([]);
    expect(result.story).toBe(story);
  });

  it('deletes the defaultValue it can read beside an argType it cannot read', async () => {
    const result = await migrate({
      story: [
        "import { intlArgType } from '../helpers';",
        "export default { argTypes: { intl: intlArgType('LinkTranslate'), label: { defaultValue: 'A', control: 'text' } } };",
      ].join('\n'),
    });

    expect(result.failures).toEqual([]);
    expect(result.story).toContain("intl: intlArgType('LinkTranslate')");
    expect(result.story).toContain("control: 'text'");
    expect(result.story).not.toContain('defaultValue');
  });

  it('fails a defaultValue that reaches an argType through a spread, naming its line', async () => {
    const story = [
      "const base = { defaultValue: 'A', control: 'text' };",
      'export default { argTypes: { label: { ...base } } };',
    ].join('\n');
    const result = await migrate({ story });

    expect(result.failures).toEqual([
      {
        file: storyPath,
        kind: 'story',
        message: expect.stringMatching(
          /^`base\.defaultValue` \(line 1\) is left in place: it may reach an argType the migration could not read/
        ),
      },
    ]);
    expect(result.story).toBe(story);
  });

  it('names why the argType that holds the defaultValue left could not be read, and only that one', async () => {
    const story = [
      "import { intlArgType, makeArgType } from '../helpers';",
      'export default {',
      '  argTypes: {',
      "    intl: intlArgType('LinkTranslate'),",
      "    label: makeArgType({ defaultValue: 'Hi' }),",
      '  },',
      '};',
    ].join('\n');
    const result = await migrate({ story });

    expect(result.failures).toEqual([
      {
        file: storyPath,
        kind: 'story',
        message:
          '`argTypes.label.makeArgType(…).defaultValue` (line 5) is left in place; line 5: Cannot mutate argTypes.label.defaultValue because the target contains unsupported member',
      },
    ]);
    expect(result.story).toBe(story);
  });

  it('fails a defaultValue left in place when the story has an alias', async () => {
    const story = [
      "const base = { defaultValue: 'A', control: 'text' };",
      'export default { title: "Example" };',
      'export const Primary = { argTypes: { label: { ...base } } };',
      'export const Secondary = Primary;',
    ].join('\n');
    const result = await migrate({ story });

    expect(result.failures).toEqual([
      { file: storyPath, kind: 'story', message: expect.stringContaining('`base.defaultValue`') },
    ]);
    expect(result.story).toBe(story);
  });

  it('keeps an arg named defaultValue, and migrates args named like other fields', async () => {
    const result = await migrate({
      preview: "export default { argTypes: { defaultValue: { control: 'text' } } };",
      story: [
        'export default {',
        '  argTypes: {',
        "    defaultValue: { control: 'text', defaultValue: 'x' },",
        "    table: { defaultValue: 1, control: 'number' },",
        "    args: { defaultValue: 2, table: { defaultValue: { summary: '2' } } },",
        '  },',
        '};',
      ].join('\n'),
    });

    expect(result.failures).toEqual([]);
    expect(result.preview).toContain("defaultValue: { control: 'text' }");
    expect(result.story).toContain("defaultValue: { control: 'text' }");
    expect(result.story).toContain("table: { control: 'number' }");
    expect(result.story).toContain("summary: '2'");
    expect(result.story).not.toMatch(/defaultValue: (1|2|'x')/);
  });

  it('does not fail on a defaultValue that no argType can reach', async () => {
    const story = [
      "const options = [{ label: 'a', defaultValue: true }];",
      'export default {',
      "  argTypes: { label: { control: 'text', defaultValue: 'A' } },",
      "  render: (args) => ({ props: { ...args, options, defaultValue: 'x' } }),",
      '};',
    ].join('\n');
    const result = await migrate({ story });

    expect(result.failures).toEqual([]);
    expect(result.story).toContain("options = [{ label: 'a', defaultValue: true }]");
    expect(result.story).toContain("defaultValue: 'x'");
    expect(result.story).not.toContain("defaultValue: 'A'");
  });

  it('names lines as they are on disk when an earlier argType was migrated', async () => {
    const story = [
      "import { makeArgType } from '../helpers';",
      'export default {',
      '  argTypes: {',
      '    first: {',
      '      defaultValue: {',
      "        value: 'long',",
      '      },',
      '    },',
      '    second: makeArgType({ defaultValue: 2 }),',
      '  },',
      '};',
    ].join('\n');
    const result = await migrate({ story });

    expect(result.failures).toEqual([
      {
        file: storyPath,
        kind: 'story',
        message:
          '`argTypes.second.makeArgType(…).defaultValue` (line 9) is left in place; line 9: Cannot mutate argTypes.second.defaultValue because the target contains unsupported member',
      },
    ]);
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
