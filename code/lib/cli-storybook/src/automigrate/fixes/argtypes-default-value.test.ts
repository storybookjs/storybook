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

  it('reports a deprecated defaultValue in shared argTypes for manual migration', async () => {
    const story = [
      'const sharedArgTypes = { label: { defaultValue: "Hi", control: "text" } };',
      'export default { argTypes: sharedArgTypes };',
    ].join('\n');
    const result = await migrate({ story });

    expect(result.failures).toEqual([
      {
        file: storyPath,
        kind: 'story',
        message: expect.stringContaining('Shared argTypes contain defaultValue'),
      },
    ]);
    expect(result.story).toBe(story);
  });

  it.each(['as const', 'satisfies Record<string, unknown>'])(
    'reports a deprecated defaultValue in shared argTypes with %s',
    async (assertion) => {
      const story = [
        `const sharedArgTypes = { label: { defaultValue: "Hi" } } ${assertion};`,
        'export default { argTypes: sharedArgTypes };',
      ].join('\n');
      const result = await migrate({ story });

      expect(result.failures).toEqual([
        {
          file: storyPath,
          kind: 'story',
          message: expect.stringContaining('Shared argTypes contain defaultValue'),
        },
      ]);
      expect(result.story).toBe(story);
    }
  );

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

  it('leaves a spread inside the arg unchanged when the editor cannot remove it', async () => {
    const story =
      "import { shared } from './shared';\nexport default { argTypes: { label: { ...shared, defaultValue: 'A' } } };";
    const result = await migrate({ story });

    expect(result.failures).toEqual([
      { file: storyPath, kind: 'story', message: expect.stringContaining('Cannot mutate') },
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
