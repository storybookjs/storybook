import { describe, expect, test } from 'vitest';

import type { StorybookConfig } from 'storybook/internal/types';

import { blocker } from './block-react-legacy-root-api.ts';

const check = (framework: StorybookConfig['framework']) =>
  blocker.check({
    packageManager: {} as any,
    mainConfig: { stories: [], framework } as StorybookConfig,
    mainConfigPath: '.storybook/main.ts',
    configDir: '.storybook',
  });

describe('blocks', () => {
  test('when legacyRootApi is true', async () => {
    await expect(
      check({ name: '@storybook/react-vite', options: { legacyRootApi: true } })
    ).resolves.toBe(true);
  });

  // The option no longer exists, so an explicit `false` must be removed as well.
  test('when legacyRootApi is false', async () => {
    await expect(
      check({ name: '@storybook/react-vite', options: { legacyRootApi: false } })
    ).resolves.toBe(true);
  });

  test('when legacyRootApi is set on react-webpack5', async () => {
    await expect(
      check({ name: '@storybook/react-webpack5', options: { legacyRootApi: true } })
    ).resolves.toBe(true);
  });
});

describe('does not block', () => {
  test('when framework has no options', async () => {
    await expect(check({ name: '@storybook/react-vite' })).resolves.toBe(false);
  });

  test('when options omit legacyRootApi', async () => {
    await expect(check({ name: '@storybook/react-vite', options: { builder: {} } })).resolves.toBe(
      false
    );
  });

  test('when framework is a bare string', async () => {
    await expect(check('@storybook/react-vite')).resolves.toBe(false);
  });

  test('when framework is undefined', async () => {
    await expect(check(undefined)).resolves.toBe(false);
  });
});

describe('log', () => {
  test('names the option, both values, and links React upgrade guidance', () => {
    const { title, message, link } = blocker.log(true);

    expect(title).toBe('React legacy root API removed');
    expect(message).toContain('legacyRootApi');
    expect(message).toContain('`true` or `false`');
    expect(message).toContain('https://react.dev/blog/2022/03/08/react-18-upgrade-guide');
    expect(link).toBe(
      'https://github.com/storybookjs/storybook/blob/next/MIGRATION.md#react-require-v18-and-up'
    );
  });
});
