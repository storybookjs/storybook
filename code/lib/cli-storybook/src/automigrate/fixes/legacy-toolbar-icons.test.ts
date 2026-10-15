import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { formatExistingFile, JsPackageManager } from 'storybook/internal/common';

import { fs, vol } from 'memfs';

import { checkFix, runFix } from '../helpers/fix-test-utils.ts';
import { legacyToolbarIcons } from './legacy-toolbar-icons.ts';

vi.mock('node:fs/promises', { spy: true });
vi.mock('storybook/internal/common', { spy: true });

const configDir = resolve('.storybook');
const mainConfigPath = resolve('.storybook/main.ts');
const previewConfigPath = resolve('.storybook/preview.ts');
const storyPath = resolve('src/Button.stories.ts');
const options = {
  packageManager: vi.mocked(JsPackageManager.prototype),
  mainConfig: { stories: [] },
  mainConfigPath,
  configDir,
  previewConfigPath,
  storybookVersion: '11.0.0',
  storiesPaths: [storyPath],
};

describe('legacy-toolbar-icons', () => {
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

  // The pipeline reads every file its hooks may visit, so each fixture provides them all.
  const setupFiles = (files: { preview?: string; story?: string }) => {
    vol.fromJSON({
      [mainConfigPath]: 'export default { stories: [] };',
      [previewConfigPath]: files.preview ?? '',
      [storyPath]: files.story ?? '',
    });
  };

  it('applies only on Storybook 11 or later', async () => {
    setupFiles({
      preview: "export default { globalTypes: { theme: { toolbar: { icon: 'globe' } } } };",
    });
    await expect(checkFix(legacyToolbarIcons, options)).resolves.toEqual({});
    await expect(
      checkFix(legacyToolbarIcons, { ...options, storybookVersion: '10.0.0' })
    ).resolves.toBeNull();
  });

  it('is not applicable when no legacy icon name is configured', async () => {
    setupFiles({
      preview: "export default { globalTypes: { theme: { toolbar: { icon: 'GlobeIcon' } } } };",
    });
    await expect(checkFix(legacyToolbarIcons, options)).resolves.toBeNull();
  });

  it('rewrites toolbar and item icons in the preview config', async () => {
    setupFiles({
      preview: [
        'export default {',
        '  globalTypes: {',
        '    theme: {',
        '      toolbar: {',
        "        title: 'Theme',",
        "        icon: 'globe',",
        "        items: [{ value: 'light', icon: 'circlehollow', title: 'light' }],",
        '      },',
        '    },',
        '  },',
        '};',
      ].join('\n'),
    });

    const failures = await runFix(legacyToolbarIcons, { ...options, result: {} });
    expect(failures).toEqual([]);
    const preview = fs.readFileSync(previewConfigPath, 'utf8') as string;
    expect(preview).toContain("icon: 'GlobeIcon'");
    expect(preview).toContain("icon: 'CircleHollowIcon'");
    expect(preview).not.toContain("'globe'");
    expect(preview).not.toContain("'circlehollow'");
  });

  it('rewrites toolbar icons in story argTypes', async () => {
    setupFiles({
      story: [
        'export default {',
        '  argTypes: {',
        '    theme: {',
        '      toolbar: {',
        "        icon: 'globe',",
        "        items: [{ type: 'reset', title: 'Reset' }, { value: 'light', icon: 'heart' }],",
        '      },',
        '    },',
        '  },',
        '};',
      ].join('\n'),
    });

    const failures = await runFix(legacyToolbarIcons, { ...options, result: {} });
    expect(failures).toEqual([]);
    const story = fs.readFileSync(storyPath, 'utf8') as string;
    expect(story).toContain("icon: 'GlobeIcon'");
    expect(story).toContain("icon: 'HeartIcon'");
  });

  it('leaves migrated values and non-toolbar icon strings untouched', async () => {
    setupFiles({
      preview: [
        'export default {',
        '  globalTypes: {',
        '    theme: { toolbar: { icon: "GlobeIcon" } },',
        '  },',
        '  custom: { icon: "globe" },',
        '};',
      ].join('\n'),
    });

    const failures = await runFix(legacyToolbarIcons, { ...options, result: {} });
    expect(failures).toEqual([]);
    const preview = fs.readFileSync(previewConfigPath, 'utf8') as string;
    expect(preview).toContain('icon: "GlobeIcon"');
    expect(preview).toContain('icon: "globe"');
  });
});
