import { describe, expect, it, vi } from 'vitest';

import { JsPackageManager } from 'storybook/internal/common';
import type { StorybookConfigRaw } from 'storybook/internal/types';

import type { CheckOptions } from '../types.ts';
import { craPresetRemoved } from './cra-preset-removed.ts';

vi.mock('storybook/internal/common', { spy: true });

const mockPackageManager = vi.mocked(JsPackageManager.prototype);

const buildCheckOptions = (addons: string[]): CheckOptions => ({
  packageManager: mockPackageManager,
  mainConfig: {
    stories: ['../src/**/*.stories.@(js|jsx|ts|tsx)'],
    addons,
  } as StorybookConfigRaw,
  storybookVersion: '11.0.0',
  configDir: '.storybook',
  storiesPaths: [],
  hasCsfFactoryPreview: false,
});

describe('craPresetRemoved', () => {
  it('detects @storybook/preset-create-react-app in the addons list', async () => {
    const options = buildCheckOptions([
      '@storybook/addon-essentials',
      '@storybook/preset-create-react-app',
    ]);

    await expect(craPresetRemoved.check(options)).resolves.toBe(true);
  });

  it('is silent when the CRA preset is not configured', async () => {
    const options = buildCheckOptions(['@storybook/addon-essentials']);

    await expect(craPresetRemoved.check(options)).resolves.toBeNull();
  });

  it('prompts with the removal notice and the migration link', () => {
    const prompt = craPresetRemoved.prompt();

    expect(prompt).toContain('@storybook/preset-create-react-app no longer has any effect');
    expect(prompt).toContain('https://storybook.js.org/docs/get-started/frameworks/react-vite');
  });
});
